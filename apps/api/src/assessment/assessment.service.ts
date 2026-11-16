import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { AssessmentType, Difficulty, MembershipTier } from "@prisma/client";
import { PrismaService } from "../common/prisma.service";
import { AuditService } from "../common/audit.service";
import { NotificationsService } from "../common/notifications.service";
import { paidAccess } from "../common/membership-access";
import { CertificateService } from "../certificates/certificate.service";

export interface RequestContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Two kinds of sitting share this engine:
 *
 *  - FREE_OPEN — the free competency test. Every registered user, no
 *    certificate. Afterwards the member sees what they got wrong AND the correct
 *    answers with explanations, because its job is learning.
 *  - CERTIFICATION — the paid exam for the member's tier. Needs an active
 *    membership and a remaining attempt (ExamEntitlement). A pass issues the
 *    PACA certificate. The answer key is never revealed, so the exam stays fair.
 */
const FREE_QUESTION_COUNT = 20;
const FREE_DURATION_MINS = 30;
const FREE_PASS_MARK_BPS = 7000;

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

/** Advisory competency band for the free test. */
export function competencyFor(scoreBps: number) {
  if (scoreBps >= 8500)
    return { level: "Advanced", advice: "Strong, broad Agile knowledge. The Professional or Executive membership suits you." };
  if (scoreBps >= 7000)
    return { level: "Proficient", advice: "Solid working knowledge. Professional membership is a good fit; review the topics you missed." };
  if (scoreBps >= 5000)
    return { level: "Developing", advice: "Good foundations with gaps. Study the member library before sitting the certification exam." };
  return { level: "Foundation", advice: "You are early in your Agile journey. Student membership and its study books are a good place to start." };
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
    private readonly notifications: NotificationsService,
  ) {}

  // ------------------------------------------------------------------ shared

  /** Shapes the questions for the candidate — never includes isCorrect. */
  private async presentAttempt(attemptId: string) {
    const rows = await this.prisma.attemptQuestion.findMany({
      where: { attemptId },
      orderBy: { position: "asc" },
      select: {
        position: true,
        selectedOptionIds: true,
        question: {
          select: { id: true, stem: true, kind: true, options: { select: { id: true, text: true, sortOrder: true } } },
        },
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

  private async toAttemptView(attempt: {
    id: string;
    type: AssessmentType;
    status: string;
    expiresAt: Date;
    questionCount: number;
    durationMins: number;
  }) {
    return {
      id: attempt.id,
      type: attempt.type,
      status: attempt.status,
      expiresAt: attempt.expiresAt,
      questionCount: attempt.questionCount,
      durationMins: attempt.durationMins,
      questions: await this.presentAttempt(attempt.id),
    };
  }

  /** Auto-finalizes an attempt that ran out of time. Idempotent. */
  private async finalizeIfExpired(attemptId: string) {
    const attempt = await this.prisma.attempt.findUnique({ where: { id: attemptId } });
    if (!attempt || attempt.status !== "IN_PROGRESS") return attempt;
    if (attempt.expiresAt.getTime() > Date.now()) return attempt;
    return this.score(attemptId, "EXPIRED");
  }

  private async score(attemptId: string, status: "SUBMITTED" | "EXPIRED") {
    // Atomic claim: only one caller may move an attempt out of IN_PROGRESS, so a
    // double-clicked submit can't score twice or issue two certificates.
    const claimed = await this.prisma.attempt.updateMany({
      where: { id: attemptId, status: "IN_PROGRESS" },
      data: { status, submittedAt: new Date() },
    });
    if (claimed.count === 0) {
      return this.prisma.attempt.findUniqueOrThrow({ where: { id: attemptId } });
    }

    const questions = await this.prisma.attemptQuestion.findMany({
      where: { attemptId },
      include: { question: { include: { options: true } } },
    });

    let correctCount = 0;
    for (const aq of questions) {
      const correctIds = new Set(aq.question.options.filter((o) => o.isCorrect).map((o) => o.id));
      const selected = new Set(aq.selectedOptionIds);
      const isCorrect = selected.size === correctIds.size && [...selected].every((id) => correctIds.has(id));
      if (isCorrect) correctCount++;
      await this.prisma.attemptQuestion.update({ where: { id: aq.id }, data: { isCorrect } });
    }

    const attempt = await this.prisma.attempt.findUniqueOrThrow({ where: { id: attemptId } });
    const scoreBps = attempt.questionCount ? Math.round((correctCount / attempt.questionCount) * 10000) : 0;
    const passed = scoreBps >= attempt.passMarkBps;

    const updated = await this.prisma.attempt.update({
      where: { id: attemptId },
      data: { scoreBps, correctCount, passed },
    });

    // Certificates are earned only through the paid certification exam.
    if (attempt.type === "CERTIFICATION") {
      if (passed) {
        try {
          const cert = await this.certificates.issueForAttempt(attemptId);
          await this.prisma.attempt.update({ where: { id: attemptId }, data: { certificateIssued: true } });
          await this.notifications.notify(attempt.userId, {
            kind: "CERTIFICATE",
            title: "Congratulations — you are PACA certified!",
            body: `You passed the certification exam with ${Math.round(scoreBps / 100)}%. Your certificate (${cert.credentialId}) is ready to download and share.`,
            link: "/certificates",
          });
        } catch {
          // Issuance failure must not undo a legitimate pass; it can be re-issued.
        }
      } else {
        await this.notifications.notify(attempt.userId, {
          kind: "ASSESSMENT",
          title: "Certification exam result",
          body: `You scored ${Math.round(scoreBps / 100)}% (pass mark ${Math.round(attempt.passMarkBps / 100)}%). Review the member library and try again.`,
          link: "/exam",
        });
      }
    }

    return updated;
  }

  private async findOwned(userId: string, attemptId: string) {
    const attempt = await this.prisma.attempt.findUnique({ where: { id: attemptId } });
    if (!attempt || attempt.userId !== userId) throw new NotFoundException("Attempt not found");
    return attempt;
  }

  async getOne(userId: string, attemptId: string) {
    const attempt = await this.findOwned(userId, attemptId);
    const current = attempt.status === "IN_PROGRESS" ? await this.finalizeIfExpired(attemptId) : attempt;
    if (!current) throw new NotFoundException("Attempt not found");
    if (current.status === "IN_PROGRESS") return this.toAttemptView(current);
    return this.resultView(current.id);
  }

  async answer(userId: string, attemptId: string, questionId: string, selectedOptionIds: string[]) {
    const attempt = await this.findOwned(userId, attemptId);
    if (attempt.status !== "IN_PROGRESS") throw new BadRequestException("This attempt is no longer in progress");
    if (attempt.expiresAt.getTime() <= Date.now()) {
      await this.finalizeIfExpired(attemptId);
      throw new BadRequestException("Time is up — this attempt has been submitted automatically");
    }

    const slot = await this.prisma.attemptQuestion.findUnique({
      where: { attemptId_questionId: { attemptId, questionId } },
      include: { question: { include: { options: true } } },
    });
    if (!slot) throw new NotFoundException("Question is not part of this attempt");
    const validIds = new Set(slot.question.options.map((o) => o.id));
    if (!selectedOptionIds.every((id) => validIds.has(id))) {
      throw new BadRequestException("One or more selected options do not belong to this question");
    }

    await this.prisma.attemptQuestion.update({
      where: { attemptId_questionId: { attemptId, questionId } },
      data: { selectedOptionIds: [...new Set(selectedOptionIds)], answeredAt: new Date() },
    });
    return { saved: true };
  }

  async submit(userId: string, attemptId: string, ctx: RequestContext) {
    const attempt = await this.findOwned(userId, attemptId);
    if (attempt.status !== "IN_PROGRESS") throw new BadRequestException("This attempt is no longer in progress");

    await this.score(attemptId, "SUBMITTED");
    await this.audit.record({
      actorUserId: userId,
      action: attempt.type === "CERTIFICATION" ? "exam.submitted" : "assessment.submitted",
      entityType: "Attempt",
      entityId: attemptId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    return this.resultView(attemptId);
  }

  private async activeOf(userId: string, type: AssessmentType) {
    const attempt = await this.prisma.attempt.findFirst({
      where: { userId, type, status: "IN_PROGRESS" },
      orderBy: { startedAt: "desc" },
    });
    if (!attempt) return null;
    const current = await this.finalizeIfExpired(attempt.id);
    if (!current || current.status !== "IN_PROGRESS") return null;
    return this.toAttemptView(current);
  }

  private async createAttempt(input: {
    userId: string;
    type: AssessmentType;
    tier: MembershipTier | null;
    entitlementId: string | null;
    questionIds: string[];
    passMarkBps: number;
    durationMins: number;
    difficulty: Difficulty;
    seed: number;
    ctx: RequestContext;
  }) {
    const previous = await this.prisma.attempt.count({ where: { userId: input.userId, type: input.type } });
    const now = new Date();
    const attempt = await this.prisma.attempt.create({
      data: {
        userId: input.userId,
        type: input.type,
        tier: input.tier,
        entitlementId: input.entitlementId,
        attemptNumber: previous + 1,
        status: "IN_PROGRESS",
        questionCount: input.questionIds.length,
        passMarkBps: input.passMarkBps,
        durationMins: input.durationMins,
        difficulty: input.difficulty,
        seed: String(input.seed),
        startedAt: now,
        expiresAt: new Date(now.getTime() + input.durationMins * 60_000),
        ipAddress: input.ctx.ipAddress,
        userAgent: input.ctx.userAgent,
      },
    });

    await this.prisma.attemptQuestion.createMany({
      data: input.questionIds.map((questionId, i) => ({ attemptId: attempt.id, questionId, position: i, optionOrder: [] })),
    });

    await this.audit.record({
      actorUserId: input.userId,
      action: input.type === "CERTIFICATION" ? "exam.started" : "assessment.started",
      entityType: "Attempt",
      entityId: attempt.id,
      metadata: { questionCount: input.questionIds.length, tier: input.tier },
      ipAddress: input.ctx.ipAddress,
      userAgent: input.ctx.userAgent,
    });
    return attempt;
  }

  // ------------------------------------------------------------------ free test

  getActiveFree(userId: string) {
    return this.activeOf(userId, "FREE_OPEN");
  }

  async startFree(userId: string, ctx: RequestContext) {
    const existing = await this.getActiveFree(userId);
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
    const questionIds = seededShuffle(eligible, mulberry32(seed))
      .slice(0, Math.min(FREE_QUESTION_COUNT, eligible.length))
      .map((q) => q.id);

    const attempt = await this.createAttempt({
      userId,
      type: "FREE_OPEN",
      tier: null,
      entitlementId: null,
      questionIds,
      passMarkBps: FREE_PASS_MARK_BPS,
      durationMins: FREE_DURATION_MINS,
      difficulty: "FOUNDATION",
      seed,
      ctx,
    });

    await this.prisma.questionExposure.createMany({
      data: questionIds.map((questionId) => ({ userId, questionId, servedOn: today })),
      skipDuplicates: true,
    });

    return this.toAttemptView(attempt);
  }

  /** Makes a finished free-test result publicly viewable at /score/{id}. */
  async share(userId: string, attemptId: string) {
    const attempt = await this.findOwned(userId, attemptId);
    if (attempt.type !== "FREE_OPEN") throw new BadRequestException("Only free test results can be shared");
    if (attempt.status === "IN_PROGRESS") throw new BadRequestException("Finish the test before sharing your score");
    if (!attempt.sharedAt) {
      await this.prisma.attempt.update({ where: { id: attemptId }, data: { sharedAt: new Date() } });
    }
    return { id: attemptId };
  }

  /** Public view of a shared score: first name, initial, score and level only. */
  async publicScore(attemptId: string) {
    const attempt = await this.prisma.attempt.findUnique({
      where: { id: attemptId },
      include: { user: { select: { firstName: true, lastName: true } } },
    });
    if (!attempt || attempt.type !== "FREE_OPEN" || !attempt.sharedAt || attempt.status === "IN_PROGRESS") {
      throw new NotFoundException("Shared result not found");
    }
    const scoreBps = attempt.scoreBps ?? 0;
    return {
      id: attempt.id,
      name: `${attempt.user.firstName} ${attempt.user.lastName.charAt(0)}.`,
      scoreBps,
      correctCount: attempt.correctCount ?? 0,
      questionCount: attempt.questionCount,
      level: competencyFor(scoreBps).level,
      takenAt: attempt.submittedAt ?? attempt.startedAt,
    };
  }

  // ------------------------------------------------------------------ certification exam

  /** What the /exam page needs: whether the member can sit, and on what terms. */
  async examStatus(user: { id: string; role: string }) {
    const access = await paidAccess(this.prisma, user);
    const membership = await this.prisma.membership.findUnique({ where: { userId: user.id }, select: { tier: true, status: true } });
    const tier = membership?.tier ?? null;
    const config = tier ? await this.prisma.tierConfig.findUnique({ where: { tier } }) : null;

    const certificate = tier
      ? await this.prisma.certificate.findFirst({
          where: { userId: user.id, tier, status: "VALID" },
          select: { id: true, credentialId: true, issuedAt: true },
          orderBy: { issuedAt: "desc" },
        })
      : null;

    const entitlements = tier
      ? await this.prisma.examEntitlement.findMany({
          where: { userId: user.id, tier, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
          select: { attemptsGranted: true, attemptsUsed: true },
        })
      : [];
    const attemptsRemaining = entitlements.reduce((n, e) => n + Math.max(0, e.attemptsGranted - e.attemptsUsed), 0);

    const last = await this.prisma.attempt.findFirst({
      where: { userId: user.id, type: "CERTIFICATION", status: { not: "IN_PROGRESS" } },
      orderBy: { startedAt: "desc" },
      select: { id: true, scoreBps: true, passed: true, submittedAt: true },
    });

    let reason: string | null = null;
    if (!membership || membership.status !== "ACTIVE" || !access.active) {
      reason = "The certification exam unlocks once your membership payment is complete.";
    } else if (config && !config.requiresExam) {
      reason = config.requiresPanel
        ? "Your membership type is assessed by a panel, not a written exam."
        : "Your membership type does not require an exam.";
    } else if (certificate) {
      reason = "You are already certified for your membership type.";
    } else if (attemptsRemaining === 0) {
      reason = "You have used all your exam attempts. Contact PACA to arrange more.";
    }

    return {
      eligible: reason === null,
      reason,
      tier,
      tierName: config?.displayName ?? null,
      questionCount: config?.examQuestionCount ?? null,
      durationMins: config?.examDurationMins ?? null,
      passMarkBps: config?.passMarkBps ?? null,
      attemptsRemaining,
      certificate,
      lastAttempt: last,
      activeAttempt: await this.activeOf(user.id, "CERTIFICATION"),
    };
  }

  async startExam(user: { id: string; role: string }, ctx: RequestContext) {
    const active = await this.activeOf(user.id, "CERTIFICATION");
    if (active) return active;

    const status = await this.examStatus(user);
    if (!status.eligible || !status.tier) throw new ForbiddenException(status.reason ?? "You cannot sit the exam yet");

    const config = await this.prisma.tierConfig.findUniqueOrThrow({ where: { tier: status.tier } });

    // Draw one attempt from the oldest entitlement that still has one. The
    // conditional update makes two simultaneous starts unable to share an attempt.
    const entitlements = await this.prisma.examEntitlement.findMany({
      where: { userId: user.id, tier: status.tier, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      orderBy: { createdAt: "asc" },
    });
    let entitlementId: string | null = null;
    for (const e of entitlements) {
      if (e.attemptsUsed >= e.attemptsGranted) continue;
      const claimed = await this.prisma.examEntitlement.updateMany({
        where: { id: e.id, attemptsUsed: e.attemptsUsed },
        data: { attemptsUsed: { increment: 1 } },
      });
      if (claimed.count === 1) {
        entitlementId = e.id;
        break;
      }
    }
    if (!entitlementId) throw new ForbiddenException("You have no exam attempts remaining.");

    // Prefer questions at the tier's difficulty; top up from the rest of the bank.
    const atLevel = await this.prisma.question.findMany({
      where: { status: "PUBLISHED", difficulty: config.difficulty },
      select: { id: true },
    });
    const others = await this.prisma.question.findMany({
      where: { status: "PUBLISHED", difficulty: { not: config.difficulty } },
      select: { id: true },
    });
    const seed = Math.floor(Math.random() * 2 ** 31);
    const rand = mulberry32(seed);
    const pool = [...seededShuffle(atLevel, rand), ...seededShuffle(others, rand)];
    const questionIds = pool.slice(0, Math.min(config.examQuestionCount, pool.length)).map((q) => q.id);
    if (questionIds.length === 0) {
      // Give the attempt back — nothing was sat.
      await this.prisma.examEntitlement.update({ where: { id: entitlementId }, data: { attemptsUsed: { decrement: 1 } } });
      throw new ConflictException("The exam question bank is not ready yet. Please try again later.");
    }

    const attempt = await this.createAttempt({
      userId: user.id,
      type: "CERTIFICATION",
      tier: status.tier,
      entitlementId,
      questionIds,
      passMarkBps: config.passMarkBps,
      durationMins: config.examDurationMins,
      difficulty: config.difficulty,
      seed,
      ctx,
    });
    return this.toAttemptView(attempt);
  }

  // ------------------------------------------------------------------ results

  private async resultView(attemptId: string) {
    const attempt = await this.prisma.attempt.findUniqueOrThrow({ where: { id: attemptId } });
    const reveal = attempt.type === "FREE_OPEN";

    const rows = await this.prisma.attemptQuestion.findMany({
      where: { attemptId },
      orderBy: { position: "asc" },
      include: {
        question: {
          select: {
            stem: true,
            explanation: true,
            topic: { select: { name: true } },
            options: { select: { id: true, text: true, sortOrder: true, isCorrect: true } },
          },
        },
      },
    });

    const byTopic = new Map<string, { topic: string; correct: number; total: number }>();
    for (const r of rows) {
      const name = r.question.topic?.name ?? "General";
      const t = byTopic.get(name) ?? { topic: name, correct: 0, total: 0 };
      t.total++;
      if (r.isCorrect) t.correct++;
      byTopic.set(name, t);
    }

    const certificate =
      attempt.type === "CERTIFICATION" && attempt.passed
        ? await this.prisma.certificate.findUnique({ where: { attemptId }, select: { id: true, credentialId: true } })
        : null;

    return {
      id: attempt.id,
      type: attempt.type,
      status: attempt.status,
      questionCount: attempt.questionCount,
      correctCount: attempt.correctCount,
      scoreBps: attempt.scoreBps,
      passed: attempt.passed,
      passMarkBps: attempt.passMarkBps,
      sharedAt: attempt.sharedAt,
      certificate,
      competency: competencyFor(attempt.scoreBps ?? 0),
      topics: [...byTopic.values()].sort((a, b) => a.correct / a.total - b.correct / b.total),
      // The free test teaches: correct answers and explanations are included.
      // The certification exam never reveals its key.
      review: rows.map((r) => {
        const options = r.question.options.slice().sort((a, b) => a.sortOrder - b.sortOrder);
        return {
          stem: r.question.stem,
          isCorrect: r.isCorrect,
          selectedOptionIds: r.selectedOptionIds,
          options: options.map((o) => ({ id: o.id, text: o.text })),
          correctOptionIds: reveal ? options.filter((o) => o.isCorrect).map((o) => o.id) : null,
          explanation: reveal ? r.question.explanation : null,
        };
      }),
    };
  }
}
