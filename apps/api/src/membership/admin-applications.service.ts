import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Prisma, type ApplicationStatus, type MembershipTier } from "@prisma/client";
import { PrismaService } from "../common/prisma.service";
import { AuditService } from "../common/audit.service";
import { NotificationsService } from "../common/notifications.service";
import { MailService } from "../common/mail.service";
import { brandedEmail, type BrandedEmail } from "../common/branded-email";
import { loadEnv } from "../config/env";
import { TIER_FORMS } from "./tier-forms";

export interface RequestContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface ListApplicationsQuery {
  status?: ApplicationStatus;
  query?: string;
  tier?: MembershipTier;
  page: number;
  pageSize: number;
}

/** Statuses a reviewer can still act on. */
const DECIDABLE = new Set<ApplicationStatus>(["SUBMITTED", "UNDER_REVIEW"]);

@Injectable()
export class AdminApplicationsService {
  private readonly logger = new Logger(AdminApplicationsService.name);
  private readonly env = loadEnv();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
  ) {}

  async list(q: ListApplicationsQuery) {
    const search: Prisma.MembershipApplicationWhereInput = q.query
      ? {
          user: {
            OR: [
              { email: { contains: q.query, mode: "insensitive" } },
              { firstName: { contains: q.query, mode: "insensitive" } },
              { lastName: { contains: q.query, mode: "insensitive" } },
            ],
          },
        }
      : {};
    const where: Prisma.MembershipApplicationWhereInput = {
      ...search,
      ...(q.status ? { status: q.status } : {}),
      ...(q.tier ? { tier: q.tier } : {}),
    };

    const [items, total, byStatus] = await Promise.all([
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
          user: { select: { id: true, email: true, firstName: true, lastName: true, membership: { select: { status: true } } } },
          _count: { select: { documents: true } },
        },
      }),
      this.prisma.membershipApplication.count({ where }),
      // Counts per status (ignoring the status filter) so drafts and declined
      // applications are never invisible to staff.
      this.prisma.membershipApplication.groupBy({
        by: ["status"],
        where: { ...search, ...(q.tier ? { tier: q.tier } : {}) },
        _count: { _all: true },
      }),
    ]);

    const counts = Object.fromEntries(byStatus.map((r) => [r.status, r._count._all]));
    return {
      items: items.map(({ _count, ...i }) => ({ ...i, documentCount: _count.documents })),
      total,
      counts,
      page: q.page,
      pageSize: q.pageSize,
    };
  }

  /**
   * Everything a reviewer needs on one screen: the applicant's account and
   * profile, every answer (with the form's own labels), every uploaded file,
   * and their earlier applications.
   */
  async getOne(id: string) {
    const application = await this.prisma.membershipApplication.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            emailVerifiedAt: true,
            firstName: true,
            lastName: true,
            phone: true,
            createdAt: true,
            profile: true,
            membership: { select: { memberNumber: true, tier: true, status: true, currentPeriodEnd: true } },
          },
        },
        reviewer: { select: { firstName: true, lastName: true } },
        documents: {
          select: { id: true, kind: true, originalName: true, mimeType: true, sizeBytes: true, scanStatus: true, uploadedAt: true },
          orderBy: { uploadedAt: "asc" },
        },
      },
    });
    if (!application) throw new NotFoundException("Application not found");
    const history = await this.prisma.membershipApplication.findMany({
      where: { userId: application.userId, id: { not: id } },
      orderBy: { createdAt: "desc" },
      select: { id: true, tier: true, status: true, submittedAt: true, reviewedAt: true, decisionReason: true },
    });
    return { ...application, form: TIER_FORMS[application.tier], history };
  }

  /** Email the applicant about a decision. Never fails the decision itself. */
  private async emailApplicant(userId: string, subject: string, body: Omit<BrandedEmail, "firstName">) {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, firstName: true } });
      if (!user) return;
      const { html, text } = brandedEmail({ firstName: user.firstName, ...body });
      await this.mail.send({ to: { email: user.email, name: user.firstName }, subject, html, text });
    } catch (err) {
      this.logger.error(`Could not email applicant ${userId}: ${(err as Error).message}`);
    }
  }

  private link(path: string) {
    return `${this.env.WEB_PUBLIC_URL.replace(/\/$/, "")}${path}`;
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

    const tierName =
      (await this.prisma.tierConfig.findUnique({ where: { tier: application.tier }, select: { displayName: true } }))
        ?.displayName ?? application.tier;
    await this.emailApplicant(application.userId, "Your PACA membership application is approved", {
      heading: `Congratulations, your ${tierName} application is approved!`,
      paragraphs: [
        "Welcome to PACA — Professional Agile Certification Africa. The review panel has approved your membership application.",
        "Your membership is approved but not active yet. Your next step is to pay your annual membership fee: online from your dashboard, or in cash or by transfer directly to PACA (a PACA administrator then confirms it).",
        "As soon as your payment is confirmed, your membership becomes active for one full year and you unlock your member badge, the certification exam, the study library, the Agile job board and member discounts.",
      ],
      cta: { label: "Go to my dashboard and pay", url: this.link("/dashboard") },
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
      link: "/dashboard/applications",
    });

    await this.emailApplicant(application.userId, "Update on your PACA membership application", {
      heading: "Your application needs some changes",
      paragraphs: [
        "Thank you for applying to PACA. The review panel could not approve your application as it stands.",
        "Please read the note below, update your details or documents, and submit your application again. Nothing is lost — your previous answers and files are kept.",
      ],
      note: { label: "What needs to change", text: reason },
      cta: { label: "Update my application", url: this.link("/dashboard/applications") },
    });

    return updated;
  }
}
