import { Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes } from "crypto";
import { PrismaService } from "../common/prisma.service";
import { AuditService } from "../common/audit.service";
import { NotificationsService } from "../common/notifications.service";
import { paidAccess } from "../common/membership-access";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

type Ctx = { ipAddress?: string | null; userAgent?: string | null };

export interface EventInput {
  title: string;
  summary: string;
  description?: string | null;
  startsAt: Date;
  endsAt?: Date | null;
  location?: string | null;
  isOnline: boolean;
  registerUrl?: string | null;
  priceText?: string | null;
  memberDiscountPercent?: number | null;
  memberDiscountCode?: string | null;
  publish: boolean;
}

const PUBLIC_FIELDS = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  description: true,
  startsAt: true,
  endsAt: true,
  location: true,
  isOnline: true,
  registerUrl: true,
  priceText: true,
  memberDiscountPercent: true,
} as const;

/** Events shown on the home page and dashboards; admins push them to members with a discount code. */
@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private upcomingWhere() {
    // Still running or yet to start (an event without an end counts until a day after it starts).
    const now = new Date();
    return {
      status: "PUBLISHED" as const,
      OR: [{ endsAt: { gte: now } }, { endsAt: null, startsAt: { gte: new Date(now.getTime() - 86_400_000) } }],
    };
  }

  /** Public: upcoming events, member discount percentage only (never the code). */
  upcoming() {
    return this.prisma.event.findMany({ where: this.upcomingWhere(), orderBy: { startsAt: "asc" }, take: 12, select: PUBLIC_FIELDS });
  }

  /** Signed in: the same, plus the code when the user is a paid member. */
  async forMember(user: AuthenticatedUser) {
    const access = await paidAccess(this.prisma, user);
    const rows = await this.prisma.event.findMany({
      where: this.upcomingWhere(),
      orderBy: { startsAt: "asc" },
      take: 12,
      select: { ...PUBLIC_FIELDS, memberDiscountCode: true },
    });
    return {
      paid: access.active,
      items: rows.map((e) => ({ ...e, memberDiscountCode: access.active ? e.memberDiscountCode : null })),
    };
  }

  adminList() {
    return this.prisma.event.findMany({ orderBy: { startsAt: "desc" }, take: 100 });
  }

  async create(actor: AuthenticatedUser, input: EventInput, ctx: Ctx) {
    const slug = `${input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50)}-${randomBytes(3).toString("hex")}`;
    const { publish, ...data } = input;
    const created = await this.prisma.event.create({ data: { ...data, slug } });
    await this.audit.record({
      actorUserId: actor.id,
      action: "event.created",
      entityType: "Event",
      entityId: created.id,
      metadata: { title: input.title, hasCode: Boolean(input.memberDiscountCode) },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    return publish ? this.publish(actor, created.id, ctx) : created;
  }

  /** Publishing pushes a notification to every paid member (the code is in the event card, not the notification). */
  async publish(actor: AuthenticatedUser, id: string, ctx: Ctx) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException("Event not found");
    if (event.status === "PUBLISHED") return event;

    const published = await this.prisma.event.update({ where: { id }, data: { status: "PUBLISHED", publishedAt: new Date() } });
    const members = await this.prisma.membership.findMany({ where: { status: "ACTIVE" }, select: { userId: true } });
    const when = event.startsAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    const sent = await this.notifications.notifyMany(
      members.map((m) => m.userId),
      {
        kind: "ANNOUNCEMENT",
        title: `New event: ${event.title}`,
        body: `${when}${event.location ? ` · ${event.location}` : ""}. ${
          event.memberDiscountPercent ? `PACA members save ${event.memberDiscountPercent}% — your code is on your dashboard.` : event.summary
        }`,
        link: "/dashboard#events",
      },
    );
    await this.audit.record({
      actorUserId: actor.id,
      action: "event.published",
      entityType: "Event",
      entityId: id,
      metadata: { recipients: sent },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    return published;
  }

  async remove(actor: AuthenticatedUser, id: string, ctx: Ctx) {
    await this.prisma.event.delete({ where: { id } }).catch(() => {
      throw new NotFoundException("Event not found");
    });
    await this.audit.record({ actorUserId: actor.id, action: "event.deleted", entityType: "Event", entityId: id, ipAddress: ctx.ipAddress, userAgent: ctx.userAgent });
  }
}
