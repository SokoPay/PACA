import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createRng, shuffle, generateSeed } from "./rng.ts";
import { selectQuestions, InsufficientQuestionsError, type CandidateQuestion } from "./selection.ts";
import { scoreAttempt, formatBps } from "./scoring.ts";

/** Build a pool: `perTopic` questions in each topic, all at one difficulty. */
function pool(topics: string[], perTopic: number, difficulty: CandidateQuestion["difficulty"] = "INTERMEDIATE") {
  const out: CandidateQuestion[] = [];
  for (const t of topics) {
    for (let i = 0; i < perTopic; i++) out.push({ id: `${t}-${i}`, topicId: t, difficulty });
  }
  return out;
}

describe("rng", () => {
  test("same seed produces the same sequence", () => {
    const a = createRng("seed-1");
    const b = createRng("seed-1");
    for (let i = 0; i < 100; i++) assert.equal(a(), b());
  });

  test("different seeds diverge", () => {
    const a = createRng("seed-1");
    const b = createRng("seed-2");
    const sameCount = Array.from({ length: 100 }, () => (a() === b() ? 1 : 0)).reduce<number>((x, y) => x + y, 0);
    assert.equal(sameCount, 0);
  });

  test("shuffle is deterministic and preserves membership", () => {
    const input = Array.from({ length: 50 }, (_, i) => i);
    const a = shuffle(input, createRng("s"));
    const b = shuffle(input, createRng("s"));
    assert.deepEqual(a, b);
    assert.deepEqual([...a].sort((x, y) => x - y), input);
    assert.deepEqual(input, Array.from({ length: 50 }, (_, i) => i), "input must not be mutated");
  });

  test("generateSeed yields distinct 32-char hex", () => {
    const seeds = new Set(Array.from({ length: 200 }, generateSeed));
    assert.equal(seeds.size, 200);
    for (const s of seeds) assert.match(s, /^[0-9a-f]{32}$/);
  });
});

describe("selection", () => {
  const topics = ["scrum", "kanban", "flow", "lean"];

  test("returns exactly the requested number of questions", () => {
    const r = selectQuestions({ pool: pool(topics, 50), count: 60, difficulty: "INTERMEDIATE", seed: "a" });
    assert.equal(r.questionIds.length, 60);
    assert.equal(new Set(r.questionIds).size, 60, "no duplicates within a paper");
  });

  test("is reproducible from the seed", () => {
    const p = pool(topics, 50);
    const a = selectQuestions({ pool: p, count: 60, difficulty: "INTERMEDIATE", seed: "attempt-xyz" });
    const b = selectQuestions({ pool: p, count: 60, difficulty: "INTERMEDIATE", seed: "attempt-xyz" });
    assert.deepEqual(a.questionIds, b.questionIds);
  });

  test("different seeds give different papers", () => {
    const p = pool(topics, 50);
    const a = selectQuestions({ pool: p, count: 60, difficulty: "INTERMEDIATE", seed: "one" });
    const b = selectQuestions({ pool: p, count: 60, difficulty: "INTERMEDIATE", seed: "two" });
    assert.notDeepEqual(a.questionIds, b.questionIds);
  });

  test("respects the difficulty band", () => {
    const mixed = [...pool(topics, 30, "FOUNDATION"), ...pool(topics, 30, "ADVANCED")];
    const r = selectQuestions({ pool: mixed, count: 40, difficulty: "ADVANCED", seed: "s" });
    const advanced = new Set(mixed.filter((q) => q.difficulty === "ADVANCED").map((q) => q.id));
    for (const id of r.questionIds) assert.ok(advanced.has(id), `${id} is not ADVANCED`);
  });

  test("never serves a question the user has already seen today", () => {
    const p = pool(topics, 50);
    const seen = p.slice(0, 150).map((q) => q.id);
    const r = selectQuestions({
      pool: p,
      count: 40,
      difficulty: "INTERMEDIATE",
      seed: "s",
      excludeQuestionIds: seen,
    });
    const seenSet = new Set(seen);
    for (const id of r.questionIds) assert.ok(!seenSet.has(id), `${id} was already served today`);
  });

  test("spreads across topics rather than clustering", () => {
    const r = selectQuestions({ pool: pool(topics, 50), count: 60, difficulty: "INTERMEDIATE", seed: "s" });
    // 60 across 4 equally-weighted topics => 15 each.
    for (const t of topics) assert.equal(r.topicBreakdown[t], 15, `topic ${t}`);
  });

  test("honours topic weights and still sums exactly to count", () => {
    const r = selectQuestions({
      pool: pool(topics, 50),
      count: 60,
      difficulty: "INTERMEDIATE",
      seed: "s",
      topicWeights: { scrum: 5, kanban: 3, flow: 1, lean: 1 },
    });
    assert.equal(r.questionIds.length, 60);
    const total = Object.values(r.topicBreakdown).reduce<number>((a, b) => a + b, 0);
    assert.equal(total, 60);
    assert.equal(r.topicBreakdown.scrum, 30);
    assert.equal(r.topicBreakdown.kanban, 18);
  });

  test("backfills when a topic is too thin to meet its quota", () => {
    // 'lean' has only 2 questions but the blueprint wants 15.
    const thin = [...pool(["scrum", "kanban", "flow"], 50), ...pool(["lean"], 2)];
    const r = selectQuestions({ pool: thin, count: 60, difficulty: "INTERMEDIATE", seed: "s" });
    assert.equal(r.questionIds.length, 60, "paper must still be full length");
    assert.equal(r.topicBreakdown.lean, 2);
  });

  test("refuses to build a paper from an insufficient pool", () => {
    assert.throws(
      () => selectQuestions({ pool: pool(topics, 5), count: 60, difficulty: "INTERMEDIATE", seed: "s" }),
      InsufficientQuestionsError,
    );
  });

  test("exclusions can push a viable pool below the threshold", () => {
    const p = pool(topics, 20); // 80 total
    const seen = p.slice(0, 40).map((q) => q.id);
    assert.throws(
      () =>
        selectQuestions({ pool: p, count: 60, difficulty: "INTERMEDIATE", seed: "s", excludeQuestionIds: seen }),
      InsufficientQuestionsError,
    );
  });
});

describe("scoring", () => {
  const q = (id: string, correct: string[], selected: string[]) => ({
    questionId: id,
    correctOptionIds: correct,
    selectedOptionIds: selected,
  });

  test("85% pass mark: 51/60 passes, 50/60 fails", () => {
    const mk = (correctCount: number) =>
      Array.from({ length: 60 }, (_, i) => q(`q${i}`, ["a"], [i < correctCount ? "a" : "b"]));

    const pass = scoreAttempt(mk(51), 8500);
    assert.equal(pass.correctCount, 51);
    assert.equal(pass.scoreBps, 8500);
    assert.equal(pass.passed, true);

    const fail = scoreAttempt(mk(50), 8500);
    assert.equal(fail.scoreBps, 8333);
    assert.equal(fail.passed, false);
  });

  test("unanswered questions score zero and are not counted as answered", () => {
    const r = scoreAttempt([q("a", ["x"], ["x"]), q("b", ["x"], [])], 5000);
    assert.equal(r.correctCount, 1);
    assert.equal(r.answeredCount, 1);
    assert.equal(r.scoreBps, 5000);
    assert.equal(r.passed, true);
  });

  test("multi-answer is all-or-nothing and order-insensitive", () => {
    const exact = scoreAttempt([q("a", ["x", "y"], ["y", "x"])], 10000);
    assert.equal(exact.correctCount, 1, "order must not matter");

    const partial = scoreAttempt([q("a", ["x", "y"], ["x"])], 1);
    assert.equal(partial.correctCount, 0, "partial selection earns nothing");

    const over = scoreAttempt([q("a", ["x"], ["x", "y"])], 1);
    assert.equal(over.correctCount, 0, "extra selections earn nothing");
  });

  test("rejects a nonsensical pass mark", () => {
    assert.throws(() => scoreAttempt([q("a", ["x"], ["x"])], 10001), RangeError);
    assert.throws(() => scoreAttempt([q("a", ["x"], ["x"])], -1), RangeError);
    assert.throws(() => scoreAttempt([q("a", ["x"], ["x"])], 85.5), RangeError);
  });

  test("empty attempt does not divide by zero", () => {
    const r = scoreAttempt([], 8500);
    assert.equal(r.scoreBps, 0);
    assert.equal(r.passed, false);
  });

  test("formatBps renders two decimal places", () => {
    assert.equal(formatBps(8500), "85.00%");
    assert.equal(formatBps(8333), "83.33%");
    assert.equal(formatBps(10000), "100.00%");
  });
});
