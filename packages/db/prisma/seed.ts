/**
 * Seeds reference data: tier configuration, the topic tree, and a starter question bank.
 * Idempotent — safe to re-run.
 */
import { PrismaClient, Difficulty, MembershipTier } from "@prisma/client";
import { STARTER_QUESTIONS } from "./seed-questions";

const prisma = new PrismaClient();

/**
 * Fees are from pac-a.org "Getting Started with PACA" (annual, due 1 January).
 *
 * Exam: 60 questions, 60 minutes, 85% to pass, 3 attempts per entitlement.
 * A resit block costs 50% of the tier fee.
 *
 * Fellow is panel-assessed, not exam-assessed.
 * Retired members carry the credential they already held and do not re-sit.
 *
 * All tiers share the designation "PACA Member" on the certificate.
 */
const DESIGNATION = "PACA Member";
const EXAM_DURATION_MINS = 60;

/** A resit block costs half the annual tier fee. */
const halfFee = (priceUsdCents: number) => Math.round(priceUsdCents / 2);

const TIERS = [
  {
    tier: MembershipTier.STUDENT,
    displayName: "PACA Student",
    designation: DESIGNATION,
    priceUsdCents: 5_000,
    sortOrder: 1,
    difficulty: Difficulty.FOUNDATION,
    examQuestionCount: 60,
    examDurationMins: EXAM_DURATION_MINS,
    requiresExam: true,
    requiresPanel: false,
    resitPriceUsdCents: halfFee(5_000), // $25
  },
  {
    tier: MembershipTier.PROFESSIONAL,
    displayName: "PACA Professional",
    designation: DESIGNATION,
    priceUsdCents: 15_000,
    sortOrder: 2,
    difficulty: Difficulty.INTERMEDIATE,
    examQuestionCount: 60,
    examDurationMins: EXAM_DURATION_MINS,
    requiresExam: true,
    requiresPanel: false,
    resitPriceUsdCents: halfFee(15_000), // $75
  },
  {
    tier: MembershipTier.EXECUTIVE,
    displayName: "PACA Executive",
    designation: DESIGNATION,
    priceUsdCents: 25_000,
    sortOrder: 3,
    difficulty: Difficulty.ADVANCED,
    examQuestionCount: 60,
    examDurationMins: EXAM_DURATION_MINS,
    requiresExam: true,
    requiresPanel: false,
    resitPriceUsdCents: halfFee(25_000), // $125
  },
  {
    tier: MembershipTier.FELLOW,
    displayName: "PACA Fellow",
    designation: DESIGNATION,
    priceUsdCents: 35_000,
    sortOrder: 4,
    difficulty: Difficulty.EXPERT,
    examQuestionCount: 60,
    examDurationMins: EXAM_DURATION_MINS,
    // Assessed by a panel of academic and industry leaders — no exam, so no resit.
    requiresExam: false,
    requiresPanel: true,
    resitPriceUsdCents: 0,
  },
  {
    tier: MembershipTier.RETIRED,
    displayName: "PACA Retired",
    designation: DESIGNATION,
    priceUsdCents: 5_000,
    sortOrder: 5,
    difficulty: Difficulty.INTERMEDIATE,
    examQuestionCount: 60,
    examDurationMins: EXAM_DURATION_MINS,
    // Retains the credential held before retirement — does not re-sit.
    requiresExam: false,
    requiresPanel: false,
    resitPriceUsdCents: 0,
  },
];

/** Topic tree. Slugs are stable identifiers used by the question generator. */
const TOPICS: Array<{ slug: string; name: string; children?: Array<{ slug: string; name: string }> }> = [
  {
    slug: "agile-fundamentals",
    name: "Agile Fundamentals",
    children: [
      { slug: "agile-manifesto", name: "Agile Manifesto & Principles" },
      { slug: "agile-mindset", name: "Agile Mindset & Culture" },
      { slug: "empiricism", name: "Empiricism & Adaptive Planning" },
    ],
  },
  {
    slug: "scrum",
    name: "Scrum",
    children: [
      { slug: "scrum-accountabilities", name: "Accountabilities" },
      { slug: "scrum-events", name: "Events" },
      { slug: "scrum-artifacts", name: "Artifacts & Commitments" },
      { slug: "scrum-values", name: "Scrum Values" },
    ],
  },
  {
    slug: "kanban",
    name: "Kanban",
    children: [
      { slug: "kanban-practices", name: "Kanban Practices" },
      { slug: "definition-of-workflow", name: "Definition of Workflow" },
      { slug: "wip-control", name: "WIP Control" },
    ],
  },
  {
    slug: "flow-metrics",
    name: "Flow & Metrics",
    children: [
      { slug: "cycle-time", name: "Cycle Time & Work Item Age" },
      { slug: "throughput", name: "Throughput & Forecasting" },
      { slug: "littles-law", name: "Little's Law" },
      { slug: "service-level-expectation", name: "Service Level Expectations" },
    ],
  },
  { slug: "lean", name: "Lean Thinking" },
  { slug: "xp", name: "Extreme Programming & Technical Practices" },
  { slug: "devops", name: "DevOps & Continuous Delivery" },
  { slug: "product-management", name: "Product Management & Value" },
  {
    slug: "evidence-based-management",
    name: "Evidence-Based Management",
    children: [
      { slug: "ebm-key-value-areas", name: "Key Value Areas" },
      { slug: "ebm-measures", name: "EBM Measures" },
    ],
  },
  { slug: "scaling", name: "Scaling Agile" },
  { slug: "agile-coaching", name: "Agile Coaching & Facilitation" },
  { slug: "agile-leadership", name: "Agile Leadership & Organisational Change" },
];

async function seedTiers() {
  for (const t of TIERS) {
    await prisma.tierConfig.upsert({
      where: { tier: t.tier },
      update: t,
      create: t,
    });
  }
  console.log(`  tiers: ${TIERS.length}`);
}

async function seedTopics() {
  let count = 0;
  for (const t of TOPICS) {
    const parent = await prisma.topic.upsert({
      where: { slug: t.slug },
      update: { name: t.name },
      create: { slug: t.slug, name: t.name, sortOrder: count },
    });
    count++;
    for (const child of t.children ?? []) {
      await prisma.topic.upsert({
        where: { slug: child.slug },
        update: { name: child.name, parentId: parent.id },
        create: { slug: child.slug, name: child.name, parentId: parent.id, sortOrder: count },
      });
      count++;
    }
  }
  console.log(`  topics: ${count}`);
}

async function seedQuestions() {
  let created = 0;
  let skipped = 0;

  for (const q of STARTER_QUESTIONS) {
    const topic = await prisma.topic.findUnique({ where: { slug: q.topicSlug } });
    if (!topic) throw new Error(`Unknown topic slug in seed data: ${q.topicSlug}`);

    // Dedupe on the stem so re-running does not duplicate the bank.
    const existing = await prisma.question.findFirst({ where: { stem: q.stem } });
    if (existing) {
      skipped++;
      continue;
    }

    await prisma.question.create({
      data: {
        topicId: topic.id,
        stem: q.stem,
        explanation: q.explanation,
        sourceRef: q.sourceRef,
        difficulty: q.difficulty,
        kind: q.options.filter((o) => o.isCorrect).length > 1 ? "MULTI_CHOICE" : "SINGLE_CHOICE",
        // Hand-authored and verified against the primary sources, so these go
        // straight to PUBLISHED. AI-drafted items must never do this.
        status: "PUBLISHED",
        origin: "HUMAN",
        reviewedAt: new Date(),
        options: {
          create: q.options.map((o, i) => ({ text: o.text, isCorrect: o.isCorrect, sortOrder: i })),
        },
      },
    });
    created++;
  }
  console.log(`  questions: ${created} created, ${skipped} already present`);
}

async function main() {
  console.log("Seeding PACA reference data...");
  await seedTiers();
  await seedTopics();
  await seedQuestions();
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
