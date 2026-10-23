import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { AuditService } from "../common/audit.service";
import { CertificateService } from "../certificates/certificate.service";

export interface RequestContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * The "PACA open assessment" — AssessmentType.FREE_OPEN in the schema: open to
 * everyone, no entitlement required. It exists so the published question bank
 * (built for CERTIFICATION exams) has somewhere to actually be used while the
 * paid, tier-gated certification flow isn't built yet. A pass earns a Udemy-style
 * completion certificate (see CertificateService) — not a formal PACA
 * certification, which still needs the CERTIFICATION flow to exist.
 */
const QUESTION_COUNT = 20;
const DURATION_MINS = 30;
const PASS_MARK_BPS = 7000; // 70% — a practice threshold, not a certification one

/** Deterministic PRNG so a completed attempt's shuffle is reproducible from its seed. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(items: T[], rand: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function todayDateOnly(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

@Injectable()
export class AssessmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly certificates: CertificateService,
  ) {}

  private questionSelect() {
    return {
      id: true,
      stem: true,
      kind: true,
      difficulty: true,
      options: { select: { id: true, text: true, sortOrder: true } },
    } as const;
  }

  /** Shapes one AttemptQuestion for the client — never includes isCorrect. */
  private async presentAttempt(attemptId: string) {
    const rows = await this.prisma.attemptQuestion.findMany({
      where: { attemptId },
      orderBy: { position: "asc" },
      select: {
        position: true,
        selectedOptionIds: true,
        answeredAt: true,
        question: { select: this.questionSelect() },
      },
    });

    return rows.map((r) => ({
      position: r.position,
      questionId: r.question.id,
      stem: r.question.stem,
      kind: r.question.kind,
      selectedOptionIds: r.selectedOptionIds,
      options: r.question.options
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((o) => ({ id: o.id, text: o.text })),
    }));
  }

  /** Auto-finalizes an attempt that ran out of time. Idempotent. */
  private async finalizeIfExpired(attemptId: string) {
    const attempt = await this.prisma.attempt.findUnique({ where: { id: attemptId } });
    if (!attempt || attempt.status !== "IN_PROGRESS") return attempt;
    if (attempt.expiresAt.getTime() > Date.now()) return attempt;
    return this.score(attemptId, "EXPIRED");
  }

  private async score(attemptId: string, status: "SUBMITTED" | "EXPIRED") {
    const questions = await this.prisma.attemptQuestion.findMany({
      where: { attemptId },
      include: { question: { include: { options: true } } },
    });

    let correctCount = 0;
    for (const aq of questions) {
      const correctIds = new Set(aq.question.options.filter((o) => o.isCorrect).map((o) => o.id));
      const selected = new Set(aq.selectedOptionIds);
      const isCorrect =
        selected.size === correctIds.size && [...selected].every((id) => correctIds.has(id));
      if (isCorrect) correctCount++;
      await this.prisma.attemptQuestion.update({ where: { id: aq.id }, data: { isCorrect } });
    }

    const attempt = await this.prisma.attempt.findUniqueOrThrow({ where: { id: attemptId } });
    const scoreBps = Math.round((correctCount / attempt.questionCount) * 10000);
    const passed = scoreBps >= attempt.passMarkBps;

    const updated = await this.prisma.attempt.update({
      where: { id: attemptId },
      data: { status, submittedAt: new Date(), scoreBps, correctCount, passed },
    });

    if (passed) {
      // Best-effort: a certificate-issuance failure must not undo a legitimate pass.
      await this.certificates.issueForAttempt(attemptId).catch(() => {});
    }

    return updated;
  }

  async getActive(userId: string) {
    const attempt = await this.prisma.attempt.findFirst({
      where: { userId, type: "FREE_OPEN", status: "IN_PROGRESS" },
      orderBy: { startedAt: "desc" },
    });
    if (!attempt) return null;

    const current = await this.finalizeIfExpired(attempt.id);
    if (!current || current.status !== "IN_PROGRESS") return null;
    return this.toAttemptView(current);
  }

  private async toAttemptView(attempt: { id: string; status: string; expiresAt: Date; questionCount: number; durationMins: number }) {
    return {
      id: attempt.id,
      status: attempt.status,
      expiresAt: attempt.expiresAt,
      questionCount: attempt.questionCount,
      durationMins: attempt.durationMins,
      questions: await this.presentAttempt(attempt.id),
    };
  }

  /** Starts a new sitting, or hands back the current one if already in progress. */
  async start(userId: string, ctx: RequestContext) {
    const existing = await this.getActive(userId);
    if (existing) return existing;

    const today = todayDateOnly();
    const seenTodayIds = (
      await this.prisma.questionExposure.findMany({ where: { userId, servedOn: today }, select: { questionId: true } })
    ).map((e) => e.questionId);

    const eligible = await this.prisma.question.findMany({
      where: { status: "PUBLISHED", id: { notIn: seenTodayIds } },
      select: { id: true },
    });

    if (eligible.length === 0) {
      throw new ConflictException("You have already seen today's question pool — come back tomorrow for a fresh set.");
    }

    const seed = Math.floor(Math.random() * 2 ** 31);
    const rand = mulberry32(seed);
    const chosenIds = seededShuffle(eligible, rand)
      .slice(0, Math.min(QUESTION_COUNT, eligible.length))
      .map((q) => q.id);

    const previousAttempts = await this.prisma.attempt.count({ where: { userId, type: "FREE_OPEN" } });
    const now = new Date();

    const attempt = await this.prisma.attempt.create({
      data: {
        userId,
        type: "FREE_OPEN",
        tier: null,
        entitlementId: null,
        attemptNumber: previousAttempts + 1,
        status: "IN_PROGRESS",
        questionCount: chosenIds.length,
        passMarkBps: PASS_MARK_BPS,
        durationMins: DURATION_MINS,
        // FREE_OPEN draws across all difficulties — there is no single-tier
        // difficulty to snapshot here, so this is a nominal placeholder only.
        difficulty: "FOUNDATION",
        seed: String(seed),
        startedAt: now,
        expiresAt: new Date(now.getTime() + DURATION_MINS * 60_000),
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      },
    });

    await this.prisma.attemptQuestion.createMany({
      data: chosenIds.map((questionId, i) => ({
        attemptId: attempt.id,
        questionId,
        position: i,
        // Options are presented in the question's own sortOrder rather than a
        // per-attempt shuffle — optionOrder is left empty; anti-memorization
        // shuffling can be added later without a schema change.
        optionOrder: [],
      })),
    });

    await this.prisma.questionExposure.createMany({
      data: chosenIds.map((questionId) => ({ userId, questionId, servedOn: today })),
      skipDuplicates: true,
    });

    await this.audit.record({
      actorUserId: userId,
      action: "assessment.started",
      entityType: "Attempt",
      entityId: attempt.id,
      metadata: { questionCount: chosenIds.length },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return this.toAttemptView(attempt);
  }

  async getOne(userId: string, attemptId: string) {
    const attempt = await this.prisma.attempt.findUnique({ where: { id: attemptId } });
    if (!attempt || attempt.userId !== userId) throw new NotFoundException("Attempt not found");

    const current = attempt.status === "IN_PROGRESS" ? await this.finalizeIfExpired(attemptId) : attempt;
    if (!current) throw new NotFoundException("Attempt not found");

    if (current.status === "IN_PROGRESS") return this.toAttemptView(current);
    return this.resultView(current.id);
  }

  async answer(userId: string, attemptId: string, questionId: string, selectedOptionIds: string[], ctx: RequestContext) {
    const attempt = await this.prisma.attempt.findUnique({ where: { id: attemptId } });
    if (!attempt || attempt.userId !== userId) throw new NotFoundException("Attempt not found");
    if (attempt.status !== "IN_PROGRESS") throw new BadRequestException("This attempt is no longer in progress");
    if (attempt.expiresAt.getTime() <= Date.now()) {
      await this.finalizeIfExpired(attemptId);
      throw new BadRequestException("Time is up — this attempt has been submitted automatically");
    }

    const question = await this.prisma.question.findUnique({ where: { id: questionId }, include: { options: true } });
    if (!question) throw new NotFoundException("Question not found");
    const validIds = new Set(question.options.map((o) => o.id));
    if (!selectedOptionIds.every((id) => validIds.has(id))) {
      throw new BadRequestException("One or more selected options do not belong to this question");
    }

    await this.prisma.attemptQuestion.update({
      where: { attemptId_questionId: { attemptId, questionId } },
      data: { selectedOptionIds, answeredAt: new Date() },
    });

    return { saved: true };
  }

  async submit(userId: string, attemptId: string, ctx: RequestContext) {
    const attempt = await this.prisma.attempt.findUnique({ where: { id: attemptId } });
    if (!attempt || attempt.userId !== userId) throw new NotFoundException("Attempt not found");
    if (attempt.status !== "IN_PROGRESS") throw new BadRequestException("This attempt is no longer in progress");

    await this.score(attemptId, "SUBMITTED");

    await this.audit.record({
      actorUserId: userId,
      action: "assessment.submitted",
      entityType: "Attempt",
      entityId: attemptId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return this.resultView(attemptId);
  }

  /** Full review for a finished attempt — this is a practice tool, so we show the answer key. */
  private async resultView(attemptId: string) {
    const attempt = await this.prisma.attempt.findUniqueOrThrow({ where: { id: attemptId } });

    const rows = await this.prisma.attemptQuestion.findMany({
      where: { attemptId },
      orderBy: { position: "asc" },
      include: { question: { include: { options: true } } },
    });

    const certificate = attempt.passed
      ? await this.prisma.certificate.findUnique({ where: { attemptId }, select: { id: true, credentialId: true } })
      : null;

    return {
      id: attempt.id,
      status: attempt.status,
      questionCount: attempt.questionCount,
      correctCount: attempt.correctCount,
      scoreBps: attempt.scoreBps,
      passed: attempt.passed,
      passMarkBps: attempt.passMarkBps,
      certificate,
      review: rows.map((r) => ({
        stem: r.question.stem,
        explanation: r.question.explanation,
        isCorrect: r.isCorrect,
        selectedOptionIds: r.selectedOptionIds,
        options: r.question.options
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect })),
      })),
    };
  }
}
