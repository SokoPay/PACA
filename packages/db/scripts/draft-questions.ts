/**
 * Drafting run: generate -> quality gate -> auto-review -> insert at IN_REVIEW.
 *
 * Dry-run by default. Nothing is written without --write, because a bad run that
 * dumps hundreds of items into Kojo's queue is tedious to unpick.
 *
 * Usage:
 *   tsx scripts/draft-questions.ts --topic scrum-events --difficulty INTERMEDIATE --count 10
 *   tsx scripts/draft-questions.ts --topic scrum-events --difficulty INTERMEDIATE --count 10 --write
 *
 * Uses the real Anthropic provider when ANTHROPIC_API_KEY is set, otherwise the
 * stub — so the whole pipeline is exercisable before a key exists.
 */
import { PrismaClient, type Difficulty } from "@prisma/client";
import {
  generateQuestions,
  autoReviewBatch,
  StubProvider,
  StubReviewProvider,
  AnthropicProvider,
  type GenerationProvider,
  type ReviewProvider,
} from "../../core/src/index.ts";

const prisma = new PrismaClient();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

async function main() {
  const topicSlug = arg("topic");
  const difficulty = (arg("difficulty") ?? "INTERMEDIATE") as Difficulty;
  const count = Number(arg("count") ?? 10);
  const write = flag("write");

  if (!topicSlug) throw new Error("--topic is required (a topic slug, e.g. scrum-events)");
  if (!Number.isInteger(count) || count < 1 || count > 50) {
    throw new Error("--count must be an integer between 1 and 50");
  }

  const topic = await prisma.topic.findUnique({ where: { slug: topicSlug } });
  if (!topic) throw new Error(`No topic with slug "${topicSlug}"`);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.AI_MODEL ?? "claude-sonnet-5";

  let generator: GenerationProvider;
  let reviewer: ReviewProvider;

  if (apiKey) {
    generator = new AnthropicProvider({ apiKey, model, temperature: 0.8 });
    // Review runs at low temperature — we want its most consistent judgement.
    reviewer = new AnthropicProvider({ apiKey, model, temperature: 0.1 });
    console.log(`Provider: ${model}`);
  } else {
    generator = new StubProvider();
    reviewer = new StubReviewProvider();
    console.log("Provider: STUB (set ANTHROPIC_API_KEY for real generation)");
  }

  // Give the model what we already have so it does not regenerate the bank.
  const existing = await prisma.question.findMany({
    where: { topicId: topic.id, status: { in: ["PUBLISHED", "IN_REVIEW"] } },
    select: { stem: true },
    take: 100,
  });

  console.log(`\nDrafting ${count} ${difficulty} questions on "${topic.name}"...`);
  console.log(`(${existing.length} existing stems supplied as exclusions)\n`);

  const outcome = await generateQuestions(generator, {
    topicSlug,
    topicName: topic.name,
    difficulty: difficulty as never,
    count,
    existingStems: existing.map((e) => e.stem),
  });

  console.log(`Generated:   ${outcome.accepted.length + outcome.rejected.length + outcome.malformed}`);
  console.log(`Malformed:   ${outcome.malformed}`);
  console.log(`Gate reject: ${outcome.rejected.length}`);
  for (const r of outcome.rejected) {
    console.log(`  ✗ ${r.draft.stem.slice(0, 70)}...`);
    for (const e of r.errors) console.log(`      ${e.code}: ${e.message}`);
  }
  console.log(`Gate pass:   ${outcome.accepted.length}\n`);

  if (outcome.accepted.length === 0) {
    console.log("Nothing survived the quality gate. Nothing to review.");
    return;
  }

  console.log("Auto-reviewing...");
  const reviewed = await autoReviewBatch(reviewer, outcome.accepted.map((a) => a.draft));

  const tally = { APPROVE: 0, FLAG: 0, REJECT: 0 };
  for (const { review } of reviewed) tally[review.verdict]++;

  console.log(`\n  REJECT  ${tally.REJECT}   FLAG  ${tally.FLAG}   APPROVE  ${tally.APPROVE}`);
  console.log("\nQueue order (worst first):");
  for (const { draft, review } of reviewed) {
    console.log(`\n  [${review.verdict}] confidence ${review.confidence.toFixed(2)}`);
    console.log(`  ${draft.stem.slice(0, 90)}`);
    for (const reason of review.reasons.slice(0, 3)) console.log(`    - ${reason}`);
  }

  if (!write) {
    console.log(`\n--- DRY RUN --- nothing written. Re-run with --write to insert ${reviewed.length} items.\n`);
    return;
  }

  let inserted = 0;
  for (const { draft, review } of reviewed) {
    await prisma.question.create({
      data: {
        topicId: topic.id,
        stem: draft.stem,
        explanation: draft.explanation,
        sourceRef: draft.sourceRef,
        difficulty: draft.difficulty as Difficulty,
        kind: draft.options.filter((o) => o.isCorrect).length > 1 ? "MULTI_CHOICE" : "SINGLE_CHOICE",
        // Always IN_REVIEW. There is no code path that publishes without a human.
        status: "IN_REVIEW",
        origin: apiKey ? "AI_GENERATED" : "IMPORTED",
        aiModel: apiKey ? model : "stub",
        autoReviewVerdict: review.verdict,
        autoReviewConfidence: review.confidence,
        autoReviewNotes: review.critique.notes,
        autoReviewIssues: review.reasons,
        autoReviewProvider: review.provider,
        autoReviewedAt: new Date(),
        independentAnswerAgreed: review.agreesWithKey,
        reviewPriority: review.reviewPriority,
        options: {
          create: draft.options.map((o, i) => ({ text: o.text, isCorrect: o.isCorrect, sortOrder: i })),
        },
      },
    });
    inserted++;
  }

  console.log(`\nInserted ${inserted} questions at IN_REVIEW, awaiting human approval.\n`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
