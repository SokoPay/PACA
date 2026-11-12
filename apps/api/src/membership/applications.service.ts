import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { MembershipTier } from "@prisma/client";
import { PrismaService } from "../common/prisma.service";
import { AuditService } from "../common/audit.service";
import { requiredDocuments, schemaForTier, TIER_FORMS } from "./tier-forms";
import { loadEnv } from "../config/env";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

export interface RequestContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

/** Statuses from which an applicant may still edit their submission. */
const EDITABLE = new Set(["DRAFT", "DECLINED"]);

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Public: tier catalogue plus the form definition the web app renders. */
  async listTiers() {
    const configs = await this.prisma.tierConfig.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });

    return configs.map((c) => ({
      tier: c.tier,
      displayName: c.displayName,
      designation: c.designation,
      priceUsdCents: c.priceUsdCents,
      // Exam rules are public — candidates should know what they are paying for.
      requiresExam: c.requiresExam,
      requiresPanel: c.requiresPanel,
      examQuestionCount: c.requiresExam ? c.examQuestionCount : null,
      examDurationMins: c.requiresExam ? c.examDurationMins : null,
      passMarkBps: c.requiresExam ? c.passMarkBps : null,
      attemptsPerEntitlement: c.requiresExam ? c.attemptsPerEntitlement : null,
      resitPriceUsdCents: c.requiresExam ? c.resitPriceUsdCents : null,
      form: TIER_FORMS[c.tier],
    }));
  }

  async myApplications(userId: string) {
    return this.prisma.membershipApplication.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        documents: {
          select: { id: true, kind: true, originalName: true, sizeBytes: true, scanStatus: true, uploadedAt: true },
        },
      },
    });
  }

  /**
   * Create or update the applicant's draft for a tier.
   *
   * Answers are validated against the tier schema even while drafting, so a draft
   * cannot accumulate junk that only fails at submit time.
   */
  async saveDraft(user: AuthenticatedUser, tier: MembershipTier, answers: unknown, ctx: RequestContext) {
    const existingMembership = await this.prisma.membership.findUnique({ where: { userId: user.id } });
    if (existingMembership && existingMembership.status === "ACTIVE") {
      throw new ConflictException("You already hold an active membership");
    }

    const inFlight = await this.prisma.membershipApplication.findFirst({
      where: { userId: user.id, status: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
    });
    if (inFlight) {
      throw new ConflictException("You already have an application under review");
    }

    // Partial validation while drafting: unknown keys are still rejected, but a
    // half-finished form must be savable.
    const parsed = schemaForTier(tier).safeParse(answers);
    const cleaned = parsed.success ? parsed.data : this.stripUnknownKeys(tier, answers);

    const draft = await this.prisma.membershipApplication.findFirst({
      where: { userId: user.id, tier, status: { in: ["DRAFT", "DECLINED"] } },
      orderBy: { createdAt: "desc" },
    });

    if (draft) {
      return this.prisma.membershipApplication.update({
        where: { id: draft.id },
        data: { answers: cleaned as object, status: "DRAFT", decisionReason: null },
        include: { documents: true },
      });
    }

    const created = await this.prisma.membershipApplication.create({
      data: { userId: user.id, tier, answers: cleaned as object, status: "DRAFT" },
      include: { documents: true },
    });

    await this.audit.record({
      actorUserId: user.id,
      action: "application.draft_created",
      entityType: "MembershipApplication",
      entityId: created.id,
      metadata: { tier },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return created;
  }

  /** Keep only keys the tier's form defines — never persist arbitrary client JSON. */
  private stripUnknownKeys(tier: MembershipTier, answers: unknown): Record<string, unknown> {
    if (typeof answers !== "object" || answers === null) return {};
    const allowed = new Set(TIER_FORMS[tier].sections.flatMap((s) => s.fields.map((f) => f.name)));
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(answers as Record<string, unknown>)) {
      if (allowed.has(k) && v !== "" && v !== null) out[k] = v;
    }
    return out;
  }

  /**
   * Submit for review. Full validation applies here — this is the gate, not the draft.
   */
  async submit(user: AuthenticatedUser, applicationId: string, ctx: RequestContext) {
    const application = await this.prisma.membershipApplication.findUnique({
      where: { id: applicationId },
      include: { documents: true },
    });

    if (!application || application.userId !== user.id) {
      throw new NotFoundException("Application not found");
    }
    if (!EDITABLE.has(application.status)) {
      throw new BadRequestException(`An application with status ${application.status} cannot be submitted`);
    }

    const parsed = schemaForTier(application.tier).safeParse(application.answers);
    if (!parsed.success) {
      throw new BadRequestException({
        message: "Your application is incomplete",
        errors: parsed.error.issues.map((i) => ({ field: i.path.join(".") || "(root)", message: i.message })),
      });
    }

    const supplied = new Set(application.documents.map((d) => d.kind));
    const missing = requiredDocuments(application.tier).filter((k) => !supplied.has(k));
    if (missing.length > 0) {
      const labels = TIER_FORMS[application.tier].documents
        .filter((d) => missing.includes(d.kind))
        .map((d) => d.label);
      throw new BadRequestException({
        message: "Required documents are missing",
        errors: labels.map((label) => ({ field: "documents", message: `${label} is required` })),
      });
    }

    // An infected or unscanned upload must not reach a reviewer's machine.
    const unsafe = application.documents.filter((d) => d.scanStatus === "INFECTED");
    if (unsafe.length > 0) {
      throw new BadRequestException("One or more uploaded files failed a malware scan. Please replace them.");
    }

    const updated = await this.prisma.membershipApplication.update({
      where: { id: applicationId },
      data: { status: "SUBMITTED", submittedAt: new Date(), decisionReason: null },
      include: { documents: true },
    });

    await this.audit.record({
      actorUserId: user.id,
      action: "application.submitted",
      entityType: "MembershipApplication",
      entityId: applicationId,
      metadata: { tier: application.tier },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return updated;
  }

  async withdraw(user: AuthenticatedUser, applicationId: string, ctx: RequestContext) {
    const application = await this.prisma.membershipApplication.findUnique({ where: { id: applicationId } });
    if (!application || application.userId !== user.id) throw new NotFoundException("Application not found");
    if (application.status === "APPROVED") {
      throw new BadRequestException("An approved application cannot be withdrawn");
    }

    const updated = await this.prisma.membershipApplication.update({
      where: { id: applicationId },
      data: { status: "WITHDRAWN" },
    });

    await this.audit.record({
      actorUserId: user.id,
      action: "application.withdrawn",
      entityType: "MembershipApplication",
      entityId: applicationId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return updated;
  }

  /** What the Paystack checkout will actually charge — same conversion as PaymentsService. */
  private chargeEstimate(amountUsdCents: number): { chargeAmount: number | null; chargeCurrency: string | null } {
    const env = loadEnv();
    if (!env.PAYSTACK_SECRET_KEY) return { chargeAmount: null, chargeCurrency: null };
    const rate = env.PAYSTACK_CURRENCY === "USD" ? 1 : env.PAYSTACK_USD_RATE;
    if (!rate) return { chargeAmount: null, chargeCurrency: null };
    return { chargeAmount: Math.round(amountUsdCents * rate), chargeCurrency: env.PAYSTACK_CURRENCY };
  }

  /**
   * The member's own dashboard view: what they hold, what they owe, what is blocked.
   * `nextAction` is what drives the "unlock your benefits" prompt in the UI.
   */
  async myStatus(userId: string) {
    const [membership, applications, tiers] = await Promise.all([
      this.prisma.membership.findUnique({ where: { userId } }),
      this.prisma.membershipApplication.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 5 }),
      this.prisma.tierConfig.findMany(),
    ]);

    const tierConfig = membership ? tiers.find((t) => t.tier === membership.tier) : null;
    const latest = applications[0] ?? null;

    let nextAction:
      | { kind: "APPLY"; message: string }
      | { kind: "COMPLETE_DRAFT"; message: string; applicationId: string }
      | { kind: "AWAIT_REVIEW"; message: string }
      | { kind: "PAY"; message: string; amountUsdCents: number; chargeAmount: number | null; chargeCurrency: string | null }
      | { kind: "SIT_EXAM"; message: string }
      | { kind: "NONE"; message: string };

    if (membership?.status === "ACTIVE") {
      nextAction = tierConfig?.requiresExam
        ? { kind: "SIT_EXAM", message: "Your membership is active. Sit the certification assessment to earn your certificate and badge." }
        : { kind: "NONE", message: "Your membership is active." };
    } else if (membership?.status === "PENDING_PAYMENT" || membership?.status === "LAPSED") {
      const amountUsdCents = tierConfig?.priceUsdCents ?? 0;
      nextAction = {
        kind: "PAY",
        message:
          membership.status === "LAPSED"
            ? "Your membership has lapsed. Renew it to restore your PACA benefits and certificates."
            : "Your application was approved. Pay your membership fee to unlock your PACA benefits.",
        amountUsdCents,
        ...this.chargeEstimate(amountUsdCents),
      };
    } else if (latest?.status === "SUBMITTED" || latest?.status === "UNDER_REVIEW") {
      nextAction = { kind: "AWAIT_REVIEW", message: "Your application is with the review panel. We will email you when there is a decision." };
    } else if (latest && EDITABLE.has(latest.status)) {
      nextAction = {
        kind: "COMPLETE_DRAFT",
        message: latest.status === "DECLINED" ? "Your application was declined. You may revise and resubmit." : "Finish your application to submit it for review.",
        applicationId: latest.id,
      };
    } else {
      nextAction = { kind: "APPLY", message: "Choose a membership type to get started." };
    }

    return {
      membership: membership
        ? {
            memberNumber: membership.memberNumber,
            tier: membership.tier,
            status: membership.status,
            currentPeriodEnd: membership.currentPeriodEnd,
          }
        : null,
      // The banner shows whenever benefits are locked behind payment.
      benefitsLocked: membership?.status !== "ACTIVE",
      latestApplication: latest
        ? { id: latest.id, tier: latest.tier, status: latest.status, decisionReason: latest.decisionReason, submittedAt: latest.submittedAt }
        : null,
      nextAction,
    };
  }
}
