import { Injectable, NotFoundException } from "@nestjs/common";
import type { CampaignAudience, MembershipTier, Prisma } from "@prisma/client";
import { randomBytes } from "crypto";
import { PrismaService } from "../common/prisma.service";
import { AuditService } from "../common/audit.service";
import { NotificationsService } from "../common/notifications.service";
import { paidAccess, requirePaidMember } from "../common/membership-access";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

type Ctx = { ipAddress?: string | null; userAgent?: string | null };

export interface AnnouncementInput {
  title: string;
  body: string;
  audience: CampaignAudience;
  tiers: MembershipTier[];
  publish: boolean;
  pinDays?: number | null;
}

const PROFILE_FIELDS = {
  occupation: true,
  employer: true,
  country: true,
  city: true,
  linkedinUrl: true,
  bio: true,
  isPublicInDirectory: true,
} as const;

/**
 * Announcements, in-app notifications, member profiles, the members-only
 * professional network and the public member-badge page.
 */
@Injectable()
export class EngagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  // ------------------------------------------------------------------ notifications

  async myNotifications(userId: string) {
    const [items, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { id: true, kind: true, title: true, body: true, link: true, readAt: true, createdAt: true },
      }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { unread, items };
  }

  async markRead(userId: string, id?: string) {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null, ...(id ? { id } : {}) },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  // ------------------------------------------------------------------ announcements

  /** Published announcements this user may see, pinned first. */
  async announcementsFor(user: AuthenticatedUser) {
    const access = await paidAccess(this.prisma, user);
    const or: Prisma.AnnouncementWhereInput[] = [{ audience: "ALL_USERS" }];
    if (access.active) or.push({ audience: "ALL_MEMBERS" });
    if (access.staff) or.push({ audience: "BY_TIER" });
    else if (access.active && access.tier) or.push({ audience: "BY_TIER", visibleToTiers: { has: access.tier } });

    const rows = await this.prisma.announcement.findMany({
      where: { status: "PUBLISHED", OR: or },
      orderBy: { publishedAt: "desc" },
      take: 20,
      select: { id: true, title: true, body: true, publishedAt: true, pinnedUntil: true },
    });
    const now = Date.now();
    return rows
      .map((r) => ({ ...r, pinned: Boolean(r.pinnedUntil && r.pinnedUntil.getTime() > now) }))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned));
  }

  adminAnnouncements() {
    return this.prisma.announcement.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  }

  async createAnnouncement(actor: AuthenticatedUser, input: AnnouncementInput, ctx: Ctx) {
    const slug = `${input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50)}-${randomBytes(3).toString("hex")}`;
    const created = await this.prisma.announcement.create({
      data: {
        title: input.title,
        body: input.body,
        slug,
        audience: input.audience,
        visibleToTiers: input.audience === "BY_TIER" ? input.tiers : [],
        pinnedUntil: input.pinDays ? new Date(Date.now() + input.pinDays * 86_400_000) : null,
      },
    });
    await this.audit.record({
      actorUserId: actor.id,
      action: "announcement.created",
      entityType: "Announcement",
      entityId: created.id,
      metadata: { audience: input.audience, tiers: input.tiers },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    return input.publish ? this.publishAnnouncement(actor, created.id, ctx) : created;
  }

  /** Publishing also drops a notification into each recipient's bell. */
  async publishAnnouncement(actor: AuthenticatedUser, id: string, ctx: Ctx) {
    const a = await this.prisma.announcement.findUnique({ where: { id } });
    if (!a) throw new NotFoundException("Announcement not found");
    if (a.status === "PUBLISHED") return a;

    const published = await this.prisma.announcement.update({
      where: { id },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });

    const recipients = await this.audienceUserIds(a.audience, a.visibleToTiers);
    const sent = await this.notifications.notifyMany(recipients, {
      kind: "ANNOUNCEMENT",
      title: a.title,
      body: a.body.length > 280 ? `${a.body.slice(0, 277)}…` : a.body,
      link: "/notifications",
    });

    await this.audit.record({
      actorUserId: actor.id,
      action: "announcement.published",
      entityType: "Announcement",
      entityId: id,
      metadata: { recipients: sent },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    return published;
  }

  async deleteAnnouncement(actor: AuthenticatedUser, id: string, ctx: Ctx) {
    await this.prisma.announcement.delete({ where: { id } }).catch(() => {
      throw new NotFoundException("Announcement not found");
    });
    await this.audit.record({
      actorUserId: actor.id,
      action: "announcement.deleted",
      entityType: "Announcement",
      entityId: id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
  }

  private async audienceUserIds(audience: CampaignAudience, tiers: MembershipTier[]): Promise<string[]> {
    if (audience === "ALL_USERS" || audience === "SPECIFIC_USERS") {
      const users = await this.prisma.user.findMany({
        where: { deletedAt: null, status: { notIn: ["SUSPENDED", "DELETED"] } },
        select: { id: true },
      });
      return users.map((u) => u.id);
    }
    const members = await this.prisma.membership.findMany({
      where: { status: "ACTIVE", ...(audience === "BY_TIER" ? { tier: { in: tiers } } : {}) },
      select: { userId: true },
    });
    return members.map((m) => m.userId);
  }

  // ------------------------------------------------------------------ profile + network

  async myProfile(userId: string) {
    const profile = await this.prisma.profile.upsert({
      where: { userId },
      update: {},
      create: { userId },
      select: PROFILE_FIELDS,
    });
    return profile;
  }

  async updateProfile(userId: string, patch: Partial<Record<keyof typeof PROFILE_FIELDS, unknown>>) {
    return this.prisma.profile.upsert({
      where: { userId },
      update: patch as Prisma.ProfileUpdateInput,
      create: { userId, ...(patch as Prisma.ProfileCreateWithoutUserInput) },
      select: PROFILE_FIELDS,
    });
  }

  /** Members-only professional network: paid members who opted in, with contact links. */
  async network(user: AuthenticatedUser, q?: string) {
    await requirePaidMember(this.prisma, user);
    const rows = await this.prisma.profile.findMany({
      where: {
        isPublicInDirectory: true,
        user: {
          deletedAt: null,
          membership: { status: "ACTIVE" },
          ...(q
            ? {
                OR: [
                  { firstName: { contains: q, mode: "insensitive" } },
                  { lastName: { contains: q, mode: "insensitive" } },
                ],
              }
            : {}),
        },
      },
      take: 200,
      select: {
        ...PROFILE_FIELDS,
        user: { select: { firstName: true, lastName: true, membership: { select: { tier: true, memberNumber: true } } } },
      },
    });
    return rows.map((r) => ({
      name: `${r.user.firstName} ${r.user.lastName}`,
      tier: r.user.membership?.tier ?? null,
      memberNumber: r.user.membership?.memberNumber ?? null,
      occupation: r.occupation,
      employer: r.employer,
      country: r.country,
      city: r.city,
      linkedinUrl: r.linkedinUrl,
      bio: r.bio,
    }));
  }

  // ------------------------------------------------------------------ public member page

  /**
   * The shareable badge page (pac-a.org/members/{memberNumber}). PACA publishes
   * a register of members in good standing, so this shows only what a register
   * would: name, membership type, status and dates. No contact details.
   */
  async publicMember(memberNumber: string) {
    const m = await this.prisma.membership.findUnique({
      where: { memberNumber },
      select: {
        memberNumber: true,
        tier: true,
        status: true,
        activatedAt: true,
        currentPeriodEnd: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            deletedAt: true,
            certificates: {
              where: { status: "VALID", tier: { not: null } },
              select: { credentialId: true, tier: true, designation: true, issuedAt: true },
              orderBy: { issuedAt: "desc" },
            },
          },
        },
      },
    });
    if (!m || m.user.deletedAt || !m.activatedAt) throw new NotFoundException("Member not found");
    const config = await this.prisma.tierConfig.findUnique({
      where: { tier: m.tier },
      select: { displayName: true, designation: true },
    });
    const inGoodStanding =
      m.status === "ACTIVE" && (!m.currentPeriodEnd || m.currentPeriodEnd.getTime() > Date.now());
    return {
      memberNumber: m.memberNumber,
      name: `${m.user.firstName} ${m.user.lastName}`,
      tier: m.tier,
      tierName: config?.displayName ?? m.tier,
      designation: config?.designation ?? null,
      inGoodStanding,
      memberSince: m.activatedAt,
      validUntil: m.currentPeriodEnd,
      certificates: m.user.certificates,
    };
  }
}
