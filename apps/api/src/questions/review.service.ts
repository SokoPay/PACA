import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { AutoReviewVerdict, Difficulty, QuestionOrigin, QuestionStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../common/prisma.service";
import { AuditService } from "../common/audit.service";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

export interface QueueFilters {
  verdict?: AutoReviewVerdict;
  difficulty?: Difficulty;
  topicSlug?: string;
  status?: QuestionStatus;
  origin?: QuestionOrigin;
  page: number;
  pageSize: number;
}

export interface RequestContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface OptionPatch {
  id?: string;
  text: string;
  isCorrect: boolean;
}

export interface QuestionPatch {
  stem?: string;
  explanation?: string;
  sourceRef?: string;
  difficulty?: Difficulty;
  topicId?: string;
  options?: OptionPatch[];
}

/** Positional options break under per-attempt shuffling, so they can never publish. */
const POSITIONAL = [
  /\ball of the above\b/i,
  /\bnone of the above\b/i,
  /\bboth of the above\b/i,
  /\ball of these\b/i,
  /\bnone of these\b/i,
  /\bboth\s+[a-e]\s+and\s+[a-e]\b/i,
];

@Injectable()
export class ReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * The queue, ordered worst-first.
   *
   * `reviewPriority` puts REJECT before FLAG before APPROVE, and within each band
   * the least-confident items first — so a reviewer working top-down spends their
   * freshest attention where it is most likely to change an outcome. Items with no
   * auto-review yet sort last (nulls last) rather than jumping the queue.
   */
  async getQueue(filters: QueueFilters) {
    const where: Prisma.QuestionWhereInput = {
      status: filters.status ?? "IN_REVIEW",
      ...(filters.verdict ? { autoReviewVerdict: filters.verdict } : {}),
      ...(filters.difficulty ? { difficulty: filters.difficulty } : {}),
      ...(filters.topicSlug ? { topic: { slug: filters.topicSlug } } : {}),
      ...(filters.origin ? { origin: filters.origin } : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.question.count({ where }),
      this.prisma.question.findMany({
        where,
        orderBy: [{ reviewPriority: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
        include: {
          topic: { select: { id: true, slug: true, name: true } },
          options: { orderBy: { sortOrder: "asc" } },
        },
      }),
    ]);

    return {
      total,
      page: filters.page,
      pageSize: filters.pageSize,
      pageCount: Math.ceil(total / filters.pageSize),
      items,
    };
  }

  /** Counts for the queue header, so Kojo can see the shape of the work. */
  async getStats() {
    const grouped = await this.prisma.question.groupBy({
      by: ["autoReviewVerdict", "difficulty"],
      where: { status: "IN_REVIEW" },
      _count: { _all: true },
    });

    const byVerdict: Record<string, number> = { REJECT: 0, FLAG: 0, APPROVE: 0, UNREVIEWED: 0 };
    const byDifficulty: Record<string, number> = {};

    for (const row of grouped) {
      byVerdict[row.autoReviewVerdict ?? "UNREVIEWED"] += row._count._all;
      byDifficulty[row.difficulty] = (byDifficulty[row.difficulty] ?? 0) + row._count._all;
    }

    const [pending, published, aiGenerated, humanAuthored] = await this.prisma.$transaction([
      this.prisma.question.count({ where: { status: "IN_REVIEW" } }),
      this.prisma.question.count({ where: { status: "PUBLISHED" } }),
      this.prisma.question.count({ where: { origin: "AI_GENERATED" } }),
      this.prisma.question.count({ where: { origin: "HUMAN" } }),
    ]);

    return { pending, published, byVerdict, byDifficulty, byOrigin: { AI_GENERATED: aiGenerated, HUMAN: humanAuthored } };
  }

  async getOne(id: string) {
    const question = await this.prisma.question.findUnique({
      where: { id },
      include: {
        topic: { select: { id: true, slug: true, name: true } },
        options: { orderBy: { sortOrder: "asc" } },
        reviews: {
          orderBy: { createdAt: "desc" },
          include: { reviewer: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    });

    if (!question) throw new NotFoundException("Question not found");
    return question;
  }

  /**
   * Final publication check, run against the persisted rows rather than the draft.
   *
   * The drafting gate runs before a human edits. This runs after. An edit that
   * introduces a duplicate option or removes the correct answer must not be able to
   * reach candidates just because the item passed validation days earlier.
   */
  private assertPublishable(options: Array<{ text: string; isCorrect: boolean }>): void {
    if (options.length < 2) {
      throw new BadRequestException("A question needs at least two options");
    }

    const correct = options.filter((o) => o.isCorrect);
    if (correct.length === 0) throw new BadRequestException("No option is marked correct");
    if (correct.length === options.length) throw new BadRequestException("Every option is marked correct");

    const seen = new Set<string>();
    for (const o of options) {
      const key = o.text.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.,;:!?]+$/, "");
      if (!key) throw new BadRequestException("Options must not be blank");
      if (seen.has(key)) throw new BadRequestException(`Duplicate option text: "${o.text}"`);
      seen.add(key);

      if (POSITIONAL.some((re) => re.test(o.text))) {
        throw new BadRequestException(
          `Option "${o.text}" refers to other options by position. Option order is randomised per candidate, so this cannot be published.`,
        );
      }
    }
  }

  async approve(id: string, reviewer: AuthenticatedUser, notes: string | undefined, ctx: RequestContext) {
    const question = await this.prisma.question.findUnique({ where: { id }, include: { options: true } });
    if (!question) throw new NotFoundException("Question not found");

    if (question.status === "PUBLISHED") {
      throw new BadRequestException("Question is already published");
    }
    if (question.status === "RETIRED") {
      throw new BadRequestException("Retired questions cannot be re-published; create a new version");
    }

    this.assertPublishable(question.options);

    const updated = await this.prisma.$transaction(async (tx) => {
      const q = await tx.question.update({
        where: { id },
        data: {
          status: "PUBLISHED",
          reviewedByUserId: reviewer.id,
          reviewedAt: new Date(),
        },
      });

      await tx.questionReview.create({
        data: { questionId: id, reviewerId: reviewer.id, decision: "APPROVED", notes: notes ?? null },
      });

      return q;
    });

    await this.audit.record({
      actorUserId: reviewer.id,
      action: "question.published",
      entityType: "Question",
      entityId: id,
      metadata: {
        difficulty: question.difficulty,
        autoReviewVerdict: question.autoReviewVerdict,
        // Recorded because a human publishing over a REJECT verdict is the single
        // most important thing to be able to find later.
        overrodeAutoReview: question.autoReviewVerdict === "REJECT" || question.autoReviewVerdict === "FLAG",
      },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return updated;
  }

  async reject(id: string, reviewer: AuthenticatedUser, reason: string, ctx: RequestContext) {
    const question = await this.prisma.question.findUnique({ where: { id } });
    if (!question) throw new NotFoundException("Question not found");
    if (question.status === "PUBLISHED") {
      throw new BadRequestException("Retire a published question rather than rejecting it");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const q = await tx.question.update({
        where: { id },
        data: { status: "REJECTED", reviewedByUserId: reviewer.id, reviewedAt: new Date() },
      });

      await tx.questionReview.create({
        data: { questionId: id, reviewerId: reviewer.id, decision: "REJECTED", notes: reason },
      });

      return q;
    });

    await this.audit.record({
      actorUserId: reviewer.id,
      action: "question.rejected",
      entityType: "Question",
      entityId: id,
      metadata: { reason },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return updated;
  }

  /** Edit an item in the queue. Replaces options wholesale when supplied. */
  async update(id: string, patch: QuestionPatch, reviewer: AuthenticatedUser, ctx: RequestContext) {
    const question = await this.prisma.question.findUnique({ where: { id }, include: { options: true } });
    if (!question) throw new NotFoundException("Question not found");
    if (question.status === "PUBLISHED") {
      throw new BadRequestException("Published questions are immutable; retire and replace instead");
    }

    if (patch.options) this.assertPublishable(patch.options);

    const updated = await this.prisma.$transaction(async (tx) => {
      if (patch.options) {
        await tx.questionOption.deleteMany({ where: { questionId: id } });
        await tx.questionOption.createMany({
          data: patch.options.map((o, i) => ({
            questionId: id,
            text: o.text,
            isCorrect: o.isCorrect,
            sortOrder: i,
          })),
        });
      }

      return tx.question.update({
        where: { id },
        data: {
          ...(patch.stem !== undefined ? { stem: patch.stem } : {}),
          ...(patch.explanation !== undefined ? { explanation: patch.explanation } : {}),
          ...(patch.sourceRef !== undefined ? { sourceRef: patch.sourceRef } : {}),
          ...(patch.difficulty !== undefined ? { difficulty: patch.difficulty } : {}),
          ...(patch.topicId !== undefined ? { topicId: patch.topicId } : {}),
          // A human edit supersedes the machine's assessment — clear it so the UI
          // cannot present a stale verdict about text that has since changed.
          autoReviewVerdict: null,
          autoReviewConfidence: null,
          autoReviewNotes: null,
          autoReviewIssues: [],
          independentAnswerAgreed: null,
          reviewPriority: null,
          version: { increment: 1 },
        },
        include: { options: { orderBy: { sortOrder: "asc" } } },
      });
    });

    await this.audit.record({
      actorUserId: reviewer.id,
      action: "question.edited",
      entityType: "Question",
      entityId: id,
      metadata: { fields: Object.keys(patch) },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return updated;
  }

  /**
   * Bulk approval for the high-confidence tail of the queue.
   *
   * Restricted to items the auto-reviewer marked APPROVE. Bulk-approving FLAGged or
   * REJECTed items would defeat the entire review process, so it is refused here
   * rather than left to the UI to prevent.
   */
  async bulkApprove(ids: string[], reviewer: AuthenticatedUser, ctx: RequestContext) {
    if (ids.length === 0) throw new BadRequestException("No questions selected");
    if (ids.length > 100) throw new BadRequestException("Approve at most 100 questions at a time");

    const questions = await this.prisma.question.findMany({
      where: { id: { in: ids }, status: "IN_REVIEW" },
      include: { options: true },
    });

    const approved: string[] = [];
    const skipped: Array<{ id: string; reason: string }> = [];

    for (const q of questions) {
      if (q.autoReviewVerdict !== "APPROVE") {
        skipped.push({ id: q.id, reason: `Verdict is ${q.autoReviewVerdict ?? "unreviewed"}; approve individually` });
        continue;
      }
      try {
        this.assertPublishable(q.options);
        approved.push(q.id);
      } catch (err) {
        skipped.push({ id: q.id, reason: err instanceof Error ? err.message : "Failed publication checks" });
      }
    }

    const missing = ids.filter((id) => !questions.some((q) => q.id === id));
    for (const id of missing) skipped.push({ id, reason: "Not found or not awaiting review" });

    if (approved.length > 0) {
      await this.prisma.$transaction([
        this.prisma.question.updateMany({
          where: { id: { in: approved } },
          data: { status: "PUBLISHED", reviewedByUserId: reviewer.id, reviewedAt: new Date() },
        }),
        this.prisma.questionReview.createMany({
          data: approved.map((questionId) => ({
            questionId,
            reviewerId: reviewer.id,
            decision: "APPROVED" as const,
            notes: "Bulk approved",
          })),
        }),
      ]);

      await this.audit.record({
        actorUserId: reviewer.id,
        action: "question.bulk_published",
        entityType: "Question",
        entityId: null,
        metadata: { count: approved.length, questionIds: approved },
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
    }

    return { approvedCount: approved.length, approved, skipped };
  }
}
