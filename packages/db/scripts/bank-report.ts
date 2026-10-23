/**
 * Question bank readiness report.
 *
 * Answers the only question that matters before launch: can we actually build a
 * legitimate exam for each tier right now, and if not, how many more questions
 * are needed and where?
 *
 * Run: pnpm --filter @paca/db exec tsx scripts/bank-report.ts
 */
import { PrismaClient } from "@prisma/client";
import { selectQuestions, generateSeed, InsufficientQuestionsError } from "../../core/src/index.ts";
import type { CandidateQuestion, Difficulty } from "../../core/src/index.ts";

const prisma = new PrismaClient();

/**
 * Headroom multiplier over a single paper.
 *
 * A member gets 3 attempts and must not see a repeat within a day. Three papers of
 * 60 is 180 distinct items as a hard floor; below roughly 5x a single paper the
 * same items recur across candidates often enough that answers circulate.
 */
const HEALTHY_MULTIPLE = 5;

async function main() {
  const tiers = await prisma.tierConfig.findMany({ orderBy: { sortOrder: "asc" } });

  const published = await prisma.question.findMany({
    where: { status: "PUBLISHED" },
    select: { id: true, topicId: true, difficulty: true },
  });

  const pool: CandidateQuestion[] = published.map((q) => ({
    id: q.id,
    topicId: q.topicId,
    difficulty: q.difficulty as Difficulty,
  }));

  console.log(`\nPublished questions in bank: ${pool.length}\n`);

  const byDifficulty = new Map<string, number>();
  for (const q of pool) byDifficulty.set(q.difficulty, (byDifficulty.get(q.difficulty) ?? 0) + 1);

  console.log("Tier          Difficulty     Have  Paper  Healthy  Status");
  console.log("─".repeat(72));

  for (const t of tiers) {
    const have = byDifficulty.get(t.difficulty) ?? 0;
    const healthy = t.examQuestionCount * HEALTHY_MULTIPLE;

    if (!t.requiresExam) {
      const why = t.requiresPanel ? "panel-assessed" : "retains prior credential";
      console.log(
        `${t.tier.padEnd(13)} ${t.difficulty.padEnd(14)} ${String(have).padStart(4)} ` +
          `${"—".padStart(6)} ${"—".padStart(8)}  no exam (${why})`,
      );
      continue;
    }

    let status: string;
    try {
      const paper = selectQuestions({
        pool,
        count: t.examQuestionCount,
        difficulty: t.difficulty as Difficulty,
        seed: generateSeed(),
      });
      const topics = Object.keys(paper.topicBreakdown).length;
      status =
        have >= healthy
          ? `OK — ${topics} topics covered`
          : `THIN — can build, needs ${healthy - have} more for headroom`;
    } catch (err) {
      if (err instanceof InsufficientQuestionsError) {
        status = `BLOCKED — need ${err.requested - err.available} more to build one paper`;
      } else throw err;
    }

    console.log(
      `${t.tier.padEnd(13)} ${t.difficulty.padEnd(14)} ${String(have).padStart(4)} ` +
        `${String(t.examQuestionCount).padStart(6)} ${String(healthy).padStart(8)}  ${status}`,
    );
  }

  // Topic coverage — a band can have enough questions overall yet be lopsided.
  console.log("\nCoverage by topic and difficulty:");
  const topics = await prisma.topic.findMany({ orderBy: { slug: "asc" } });
  const topicName = new Map(topics.map((t) => [t.id, t.slug]));

  const grid = new Map<string, Map<string, number>>();
  for (const q of pool) {
    const slug = topicName.get(q.topicId) ?? q.topicId;
    if (!grid.has(slug)) grid.set(slug, new Map());
    const row = grid.get(slug)!;
    row.set(q.difficulty, (row.get(q.difficulty) ?? 0) + 1);
  }

  const bands = ["FOUNDATION", "INTERMEDIATE", "ADVANCED", "EXPERT"];
  console.log(`  ${"topic".padEnd(30)} ${bands.map((b) => b.slice(0, 4).padStart(6)).join("")}`);
  for (const [slug, row] of [...grid.entries()].sort()) {
    const cells = bands.map((b) => String(row.get(b) ?? 0).padStart(6)).join("");
    console.log(`  ${slug.padEnd(30)}${cells}`);
  }
  console.log();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
