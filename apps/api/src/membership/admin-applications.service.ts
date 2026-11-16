import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type ApplicationStatus, type MembershipTier } from "@prisma/client";
import { PrismaService } from "../common/prisma.service";
import { AuditService } from "../common/audit.service";
import { NotificationsService } from "../common/notifications.service";

export interface RequestContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface ListApplicationsQuery {
  status?: ApplicationStatus;
  tier?: MembershipTier;
  page: number;
  pageSize: number;
}

/** Statuses a reviewer can still act on. */
const DECIDABLE = new Set<ApplicationStatus>(["SUBMITTED", "UNDER_REVIEW"]);

@Injectable()
export class AdminApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(q: ListApplicationsQuery) {
    const where = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.tier ? { tier: q.tier } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.membershipApplication.findMany({
        where,
        // Oldest-first so the queue actually drains instead of newest-first
        // burying whoever applied first.
        orderBy: { createdAt: "asc" },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        select: {
          id: true,
          tier: true,
          status: true,
          submittedAt: true,
          reviewedAt: true,
          createdAt: true,
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.membershipApplication.count({ where }),
    ]);

    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  async getOne(id: string) {
    const application = await this.prisma.membershipApplication.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
        documents: {
          select: { id: true, kind: true, originalName: true, sizeBytes: true, scanStatus: true, uploadedAt: true },
        },
      },
    });
    if (!application) throw new NotFoundException("Application not found");
    return application;
  }

  /** "PACA-2026-00042" — sequential within the calendar year. */
  private async generateMemberNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.membership.count({
      where: { memberNumber: { startsWith: `PACA-${year}-` } },
    });
    return `PACA-${year}-${String(count + 1).padStart(5, "0")}`;
  }

  /**
   * Approving creates (or reuses, on a resubmission after a prior decline) the
   * member's Membership row in PENDING_PAYMENT — myStatus() on the member
   * dashboard already assumes an approved application implies exactly that state.
   */
  async approve(id: string, reviewerId: string, notes: string | undefined, ctx: RequestContext) {
    const application = await this.prisma.membershipApplication.findUnique({ where: { id } });
    if (!application) throw new NotFoundException("Application not found");
    if (!DECIDABLE.has(application.status)) {
      throw new BadRequestException(`An application with status ${application.status} cannot be approved`);
    }

    const updated = await this.approveWithMemberNumber(id, application, reviewerId, notes);

    await this.audit.record({
      actorUserId: reviewerId,
      action: "application.approved",
      entityType: "MembershipApplication",
      entityId: id,
      metadata: { tier: application.tier },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    await this.notifications.notify(application.userId, {
      kind: "MEMBERSHIP",
      title: "Your membership application is approved",
      body: "Welcome to PACA! Pay your subscription to unlock your certification exam, study library, badge and member discounts.",
      link: "/dashboard",
    });

    return updated;
  }

  /**
   * Member numbers are count-based, so two approvals at the same moment can
   * compute the same one. memberNumber is unique, so the loser of that race gets
   * P2002 — retry with a fresh count rather than failing the approval.
   */
  private async approveWithMemberNumber(
    id: string,
    application: { userId: string; tier: MembershipTier },
    reviewerId: string,
    notes: string | undefined,
  ) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.approveOnce(id, application, reviewerId, notes, await this.generateMemberNumber());
      } catch (err) {
        // meta.target is the field list or the constraint name depending on the
        // driver — both mention member_number / memberNumber.
        const isMemberNumberClash =
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002" &&
          /member_?number/i.test(JSON.stringify(err.meta?.target ?? ""));
        if (!isMemberNumberClash || attempt >= 4) throw err;
      }
    }
  }

  private async approveOnce(
    id: string,
    application: { userId: string; tier: MembershipTier },
    reviewerId: string,
    notes: string | undefined,
    memberNumber: string,
  ) {
    const [updated] = await this.prisma.$transaction([
      this.prisma.membershipApplication.update({
        where: { id },
        data: {
          status: "APPROVED",
          reviewedByUserId: reviewerId,
          reviewedAt: new Date(),
          reviewerNotes: notes ?? null,
          decisionReason: null,
        },
      }),
      this.prisma.membership.upsert({
        where: { userId: application.userId },
        update: { tier: application.tier, status: "PENDING_PAYMENT", approvedAt: new Date() },
        create: {
          userId: application.userId,
          memberNumber,
          tier: application.tier,
          status: "PENDING_PAYMENT",
          approvedAt: new Date(),
        },
      }),
    ]);

    return updated;
  }

  async decline(id: string, reviewerId: string, reason: string, ctx: RequestContext) {
    const application = await this.prisma.membershipApplication.findUnique({ where: { id } });
    if (!application) throw new NotFoundException("Application not found");
    if (!DECIDABLE.has(application.status)) {
      throw new BadRequestException(`An application with status ${application.status} cannot be declined`);
    }

    const updated = await this.prisma.membershipApplication.update({
      where: { id },
      data: {
        status: "DECLINED",
        reviewedByUserId: reviewerId,
        reviewedAt: new Date(),
        decisionReason: reason,
      },
    });

    await this.audit.record({
      actorUserId: reviewerId,
      action: "application.declined",
      entityType: "MembershipApplication",
      entityId: id,
      metadata: { reason },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    await this.notifications.notify(application.userId, {
      kind: "MEMBERSHIP",
      title: "Update on your membership application",
      body: `Your application was not approved: ${reason} You can update it and submit again.`,
      link: "/dashboard",
    });

    return updated;
  }
}
