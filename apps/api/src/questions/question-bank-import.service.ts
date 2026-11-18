import { Injectable, Logger, type OnApplicationBootstrap } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { QUESTION_BANK, checkQuestion, expandSource, normaliseStem } from "./bank";

const IMPORT_TAG = "PACA question bank v1";

/** Deterministic shuffle seeded by the question's wording. */
function mixedOrder(options: string[], seedText: string): Array<{ text: string; index: number }> {
  let h = 2166136261;
  for (let i = 0; i < seedText.length; i++) h = Math.imul(h ^ seedText.charCodeAt(i), 16777619) >>> 0;
  const items = options.map((text, index) => ({ text, index }));
  for (let i = items.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    const j = h % (i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/**
 * Files PACA's built-in question bank into the review queue on start-up.
 *
 * - Idempotent: a question whose wording already exists (any status) is skipped,
 *   so restarts and redeploys never duplicate, and rejected questions never return.
 * - Nothing reaches an exam automatically. Every question goes in as IN_REVIEW;
 *   a PACA reviewer approves it (individually or 100 at a time with bulk approve).
 * - Structural checks (one correct answer, three distinct wrong answers,
 *   explanation and source present) run first; only passing questions get the
 *   APPROVE pre-check that makes them eligible for bulk approval.
 */
@Injectable()
export class QuestionBankImportService implements OnApplicationBootstrap {
  private readonly logger = new Logger(QuestionBankImportService.name);

  constructor(private readonly prisma: PrismaService) {}

  onApplicationBootstrap() {
    // Never block or fail start-up on this.
    void this.importAll().catch((err) => this.logger.error(`Question bank import failed: ${(err as Error).message}`));
  }

  async importAll() {
    const existing = await this.prisma.question.findMany({ select: { stem: true } });
    const seen = new Set(existing.map((q) => normaliseStem(q.stem)));
    const topics = new Map((await this.prisma.topic.findMany({ select: { id: true, slug: true } })).map((t) => [t.slug, t.id]));

    for (const pool of QUESTION_BANK) {
      let created = 0;
      let skipped = 0;
      let invalid = 0;
      for (const q of pool.questions) {
        const [topicSlug, stem, correct, wrong, explanation, source] = q;
        const key = normaliseStem(stem);
        if (seen.has(key)) {
          skipped++;
          continue;
        }
        const problems = checkQuestion(q);
        if (problems.length > 0) {
          invalid++;
          this.logger.warn(`Bank question skipped (${problems.join(", ")}): ${stem.slice(0, 80)}`);
          continue;
        }
        let topicId = topics.get(topicSlug);
        if (!topicId) {
          const name = topicSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
          topicId = (await this.prisma.topic.upsert({ where: { slug: topicSlug }, update: {}, create: { slug: topicSlug, name } })).id;
          topics.set(topicSlug, topicId);
        }
        await this.prisma.question.create({
          data: {
            topicId,
            kind: "SINGLE_CHOICE",
            difficulty: pool.difficulty,
            stem: stem.trim(),
            explanation: explanation.trim(),
            sourceRef: expandSource(source).slice(0, 200),
            status: "IN_REVIEW",
            origin: "AI_GENERATED",
            aiModel: "claude-opus-5-5",
            aiPrompt: `${IMPORT_TAG} · ${pool.label}`,
            autoReviewVerdict: "APPROVE",
            autoReviewProvider: "paca-bank-checks",
            autoReviewNotes:
              "Structural checks passed: one correct answer, three distinct plausible wrong answers, explanation and source present. A reviewer should still read the question and confirm the answer before approving.",
            autoReviewedAt: new Date(),
            // Stored in a mixed order (stable per question) so the correct answer is
            // not always "A" in places that do not shuffle, such as the free test.
            options: {
              create: mixedOrder([correct, ...wrong], key).map(({ text, index }, i) => ({
                text: text.trim(),
                isCorrect: index === 0,
                sortOrder: i,
              })),
            },
          },
        });
        seen.add(key);
        created++;
      }
      if (created > 0 || invalid > 0) {
        this.logger.log(`${pool.label}: ${created} questions filed for review, ${skipped} already present, ${invalid} failed checks`);
      }
    }
  }
}
