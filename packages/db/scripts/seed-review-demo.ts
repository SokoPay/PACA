/**
 * Seeds the review queue with genuine draft questions.
 *
 * These are real, reviewable items — Kojo can approve or reject them for actual
 * value. One is DELIBERATELY mis-keyed so the queue's failure path is visible.
 *
 * The auto-review metadata is SIMULATED, because no Anthropic key is configured
 * yet. Once a key exists, `draft-questions.ts` produces this metadata for real and
 * this script becomes unnecessary.
 *
 * Run: tsx scripts/seed-review-demo.ts
 */
import { PrismaClient, type Difficulty, type AutoReviewVerdict } from "@prisma/client";

const prisma = new PrismaClient();

interface DemoDraft {
  topicSlug: string;
  difficulty: Difficulty;
  stem: string;
  explanation: string;
  sourceRef: string;
  options: Array<[string, boolean]>;
  verdict: AutoReviewVerdict;
  confidence: number;
  agreed: boolean;
  issues: string[];
  notes: string;
}

const DRAFTS: DemoDraft[] = [
  {
    // Deliberately mis-keyed: the Product Owner cancels a Sprint, not the Scrum Master.
    topicSlug: "scrum-events",
    difficulty: "INTERMEDIATE",
    stem: "A Sprint Goal has become obsolete after a major change in market conditions. Who has the authority to cancel the Sprint?",
    explanation:
      "A Sprint may be cancelled when the Sprint Goal becomes obsolete. The authority rests with the accountability that owns product value.",
    sourceRef: "Scrum Guide 2020, The Sprint",
    options: [
      ["The Scrum Master", true],
      ["The Product Owner", false],
      ["The Developers, by consensus", false],
      ["The stakeholder who funds the product", false],
    ],
    verdict: "REJECT",
    confidence: 0.18,
    agreed: false,
    issues: [
      "Independent answer was option 1, but the item is keyed to option 0. The key may be wrong.",
      "Low factual confidence (0.20) in the keyed answer.",
      "The Scrum Guide states only the Product Owner has the authority to cancel a Sprint.",
    ],
    notes: "The keyed answer contradicts the cited source. Reject or re-key to the Product Owner.",
  },
  {
    topicSlug: "wip-control",
    difficulty: "ADVANCED",
    stem: "A team lowers its WIP limit from 12 to 6. Throughput is unchanged after four weeks. What is the most defensible interpretation?",
    explanation:
      "By Little's Law, halving WIP at constant throughput halves average Cycle Time. Unchanged throughput with lower WIP is the expected and desirable outcome, not a failure — the same amount of work now finishes faster.",
    sourceRef: "Kanban Guide, Flow Metrics; Little's Law",
    options: [
      ["Average Cycle Time should have roughly halved, so the change is working as intended", true],
      ["The WIP limit is too low and is starving the team of work", false],
      ["The change has had no effect and should be reverted", false],
      ["Throughput will fall in later weeks as the limit binds", false],
    ],
    verdict: "FLAG",
    confidence: 0.62,
    agreed: true,
    issues: [
      "Correct option is 71% longer than the average distractor — candidates can guess by length.",
    ],
    notes: "Content is sound; shorten the correct option to match the distractors.",
  },
  {
    topicSlug: "scrum-artifacts",
    difficulty: "ADVANCED",
    stem: "During the Sprint Review, stakeholders request a change that would not fit the current Sprint. Where should that request go?",
    explanation:
      "The Sprint Review may result in the Product Backlog being adjusted to meet new opportunities. New work is added to the Product Backlog for ordering by the Product Owner, not injected into the running Sprint.",
    sourceRef: "Scrum Guide 2020, Sprint Review",
    options: [
      ["Into the Product Backlog, for the Product Owner to order", true],
      ["Into the current Sprint Backlog, if capacity allows", false],
      ["Into a separate change register held by the Scrum Master", false],
      ["Into the next Sprint Backlog directly, bypassing the Product Backlog", false],
    ],
    verdict: "FLAG",
    confidence: 0.58,
    agreed: true,
    issues: [
      "High ambiguity risk (0.55): another option may be defensible.",
      "Option 1 could be argued if the Sprint Goal is unaffected; consider tightening the stem.",
    ],
    notes: "Answer is right, but the stem should rule out the capacity case explicitly.",
  },
  {
    topicSlug: "scrum-accountabilities",
    difficulty: "FOUNDATION",
    stem: "Which accountability is responsible for establishing Scrum as described in the Scrum Guide?",
    explanation:
      "The Scrum Master is accountable for establishing Scrum by helping everyone understand Scrum theory and practice. The Product Owner maximises value; the Developers build the Increment.",
    sourceRef: "Scrum Guide 2020, Scrum Master",
    options: [
      ["The Scrum Master", true],
      ["The Product Owner", false],
      ["The Developers", false],
      ["The delivery manager", false],
    ],
    verdict: "APPROVE",
    confidence: 0.96,
    agreed: true,
    issues: [],
    notes: "Clean recall item, well aligned to the cited section.",
  },
  {
    topicSlug: "flow-metrics",
    difficulty: "FOUNDATION",
    stem: "Which flow metric counts the number of work items finished per unit of time?",
    explanation:
      "Throughput is the number of work items finished per unit of time. Cycle Time measures elapsed time per item, WIP counts items in progress, and Work Item Age applies only to unfinished items.",
    sourceRef: "Kanban Guide, Flow Metrics",
    options: [
      ["Throughput", true],
      ["Cycle Time", false],
      ["Work Item Age", false],
      ["Work in Progress", false],
    ],
    verdict: "APPROVE",
    confidence: 0.97,
    agreed: true,
    issues: [],
    notes: "Unambiguous definition item.",
  },
  {
    topicSlug: "empiricism",
    difficulty: "INTERMEDIATE",
    stem: "A Scrum Team shortens its Sprint from four weeks to two. Which empirical benefit is most directly gained?",
    explanation:
      "Shorter Sprints generate more learning cycles and limit risk to a smaller time horizon, because inspection and adaptation occur more frequently. Cost and predictability effects are indirect at best.",
    sourceRef: "Scrum Guide 2020, The Sprint",
    options: [
      ["More frequent inspection and adaptation, limiting risk to a shorter horizon", true],
      ["Lower total cost of delivery for the same scope", false],
      ["Reduced need for a Definition of Done", false],
      ["Greater accuracy in long-range estimates", false],
    ],
    verdict: "APPROVE",
    confidence: 0.91,
    agreed: true,
    issues: [],
    notes: "Good application-level item; distractors are plausible misconceptions.",
  },
];

/** Mirrors computeVerdict's ranking so the queue orders these the same way. */
function priorityFor(verdict: AutoReviewVerdict, confidence: number): number {
  const rank = { REJECT: 0, FLAG: 1, APPROVE: 2 }[verdict];
  return rank * 1000 + Math.round((1 - confidence) * -100) + 100;
}

async function main() {
  let created = 0;
  let skipped = 0;

  for (const d of DRAFTS) {
    const topic = await prisma.topic.findUnique({ where: { slug: d.topicSlug } });
    if (!topic) throw new Error(`Unknown topic slug: ${d.topicSlug}`);

    const existing = await prisma.question.findFirst({ where: { stem: d.stem } });
    if (existing) {
      skipped++;
      continue;
    }

    await prisma.question.create({
      data: {
        topicId: topic.id,
        difficulty: d.difficulty,
        stem: d.stem,
        explanation: d.explanation,
        sourceRef: d.sourceRef,
        kind: "SINGLE_CHOICE",
        status: "IN_REVIEW",
        origin: "AI_GENERATED",
        aiModel: "simulated",
        autoReviewVerdict: d.verdict,
        autoReviewConfidence: d.confidence,
        autoReviewNotes: d.notes,
        autoReviewIssues: d.issues,
        autoReviewProvider: "simulated",
        autoReviewedAt: new Date(),
        independentAnswerAgreed: d.agreed,
        reviewPriority: priorityFor(d.verdict, d.confidence),
        options: { create: d.options.map(([text, isCorrect], i) => ({ text, isCorrect, sortOrder: i })) },
      },
    });
    created++;
  }

  const pending = await prisma.question.count({ where: { status: "IN_REVIEW" } });
  console.log(`Seeded ${created} drafts (${skipped} already present). Queue now holds ${pending} items.`);
  console.log("NOTE: auto-review metadata is simulated pending an Anthropic API key.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
