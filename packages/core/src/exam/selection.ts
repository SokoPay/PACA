/**
 * Question selection for an exam attempt.
 *
 * Three rules, in priority order:
 *   1. Never serve a question this user has already seen today (PACA requirement).
 *   2. Match the tier's difficulty band.
 *   3. Spread across topics to a blueprint, so every candidate sits an exam of
 *      comparable domain coverage. Without this, one candidate gets 40 Scrum
 *      questions and another gets 40 Kanban questions, and the two results are
 *      not comparable — which quietly destroys the meaning of the pass mark.
 *
 * Deterministic: same seed + same pool => same paper.
 */
import { createRng, shuffle, type Rng } from "./rng.ts";

export type Difficulty = "FOUNDATION" | "INTERMEDIATE" | "ADVANCED" | "EXPERT";

export interface CandidateQuestion {
  id: string;
  topicId: string;
  difficulty: Difficulty;
}

export interface SelectionRequest {
  pool: readonly CandidateQuestion[];
  count: number;
  difficulty: Difficulty;
  /** Question ids this user has already been served today. */
  excludeQuestionIds?: readonly string[];
  seed: string;
  /**
   * Desired share per topicId, e.g. { scrum: 0.4, kanban: 0.3 }.
   * Omitted topics are treated as equally weighted. Values are normalised,
   * so they need not sum to 1.
   */
  topicWeights?: Readonly<Record<string, number>>;
}

export interface SelectionResult {
  questionIds: string[];
  /** How many were drawn from each topic — useful for admin diagnostics. */
  topicBreakdown: Record<string, number>;
}

export class InsufficientQuestionsError extends Error {
  readonly requested: number;
  readonly available: number;
  readonly difficulty: Difficulty;

  constructor(requested: number, available: number, difficulty: Difficulty) {
    super(
      `Cannot build a ${requested}-question paper at ${difficulty}: only ${available} eligible questions available. ` +
        `Publish more questions at this difficulty, or lower the exam question count.`,
    );
    this.name = "InsufficientQuestionsError";
    this.requested = requested;
    this.available = available;
    this.difficulty = difficulty;
  }
}

/**
 * Largest-remainder apportionment. Distributes `total` across weighted buckets so
 * the parts sum exactly to `total` — naive rounding does not, and would silently
 * produce a 59- or 61-question exam.
 */
function apportion(total: number, weights: Record<string, number>): Record<string, number> {
  const keys = Object.keys(weights);
  if (keys.length === 0) return {};

  const sum = keys.reduce((acc, k) => acc + weights[k], 0);
  if (sum <= 0) return Object.fromEntries(keys.map((k) => [k, 0]));

  const exact = keys.map((k) => ({ key: k, value: (weights[k] / sum) * total }));
  const result: Record<string, number> = {};
  let assigned = 0;

  for (const { key, value } of exact) {
    result[key] = Math.floor(value);
    assigned += result[key];
  }

  // Hand out the remainder to the largest fractional parts.
  const remainder = total - assigned;
  const byFraction = [...exact].sort((a, b) => (b.value % 1) - (a.value % 1));
  for (let i = 0; i < remainder; i++) {
    result[byFraction[i % byFraction.length].key]++;
  }

  return result;
}

/** Draw up to `n` items, deterministically. */
function draw<T>(items: readonly T[], n: number, rng: Rng): T[] {
  if (n <= 0) return [];
  return shuffle(items, rng).slice(0, n);
}

export function selectQuestions(req: SelectionRequest): SelectionResult {
  const { pool, count, difficulty, seed, excludeQuestionIds = [], topicWeights } = req;

  if (count <= 0) throw new RangeError("count must be a positive integer");

  const excluded = new Set(excludeQuestionIds);
  const eligible = pool.filter((q) => q.difficulty === difficulty && !excluded.has(q.id));

  if (eligible.length < count) {
    throw new InsufficientQuestionsError(count, eligible.length, difficulty);
  }

  const rng = createRng(seed);

  // Group by topic.
  const byTopic = new Map<string, CandidateQuestion[]>();
  for (const q of eligible) {
    const list = byTopic.get(q.topicId);
    if (list) list.push(q);
    else byTopic.set(q.topicId, [q]);
  }

  // Sort topic keys for determinism — Map iteration order depends on insertion,
  // which depends on pool order, which we do not control.
  const topics = [...byTopic.keys()].sort();

  const weights: Record<string, number> = {};
  for (const t of topics) weights[t] = topicWeights?.[t] ?? 1;

  const quota = apportion(count, weights);

  const picked: CandidateQuestion[] = [];

  for (const topic of topics) {
    const available = byTopic.get(topic)!;
    const want = quota[topic] ?? 0;
    picked.push(...draw(available, Math.min(want, available.length), rng));
  }

  // A thin topic can't fill its quota. Backfill from whatever remains so the paper
  // is still the requested length — coverage degrades gracefully rather than failing.
  if (picked.length < count) {
    const takenIds = new Set(picked.map((q) => q.id));
    const remaining = eligible.filter((q) => !takenIds.has(q.id));
    picked.push(...draw(remaining, count - picked.length, rng));
  }

  // Final shuffle so questions are not grouped by topic in presentation order.
  const finalOrder = shuffle(picked.slice(0, count), rng);

  const topicBreakdown: Record<string, number> = {};
  for (const q of finalOrder) {
    topicBreakdown[q.topicId] = (topicBreakdown[q.topicId] ?? 0) + 1;
  }

  return { questionIds: finalOrder.map((q) => q.id), topicBreakdown };
}
