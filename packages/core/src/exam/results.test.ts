import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { scoreAttempt } from "./scoring.ts";
import { buildCertificationResult, buildPracticeResult, type ResultQuestionInput } from "./results.ts";

/**
 * Fixtures use unmistakable sentinel strings. If any of these appear in a
 * certification result, the bank is leaking.
 */
const SENTINELS = {
  stem: "SENTINEL_STEM_TEXT_MUST_NOT_LEAK",
  correct: "SENTINEL_CORRECT_OPTION_MUST_NOT_LEAK",
  distractor: "SENTINEL_DISTRACTOR_MUST_NOT_LEAK",
  explanation: "SENTINEL_EXPLANATION_MUST_NOT_LEAK",
  sourceRef: "SENTINEL_SOURCE_REF_MUST_NOT_LEAK",
};

function question(id: string, topicId: string, topicName: string, gotItRight: boolean): ResultQuestionInput {
  return {
    questionId: id,
    topicId,
    topicName,
    stem: `${SENTINELS.stem} ${id}`,
    explanation: `${SENTINELS.explanation} ${id}`,
    sourceRef: SENTINELS.sourceRef,
    options: [
      { id: `${id}-a`, text: `${SENTINELS.correct} ${id}`, isCorrect: true },
      { id: `${id}-b`, text: `${SENTINELS.distractor} ${id}`, isCorrect: false },
    ],
    selectedOptionIds: gotItRight ? [`${id}-a`] : [`${id}-b`],
  };
}

/** Scrum 2/3, Kanban 1/2 — deliberately uneven so the breakdown is meaningful. */
const QUESTIONS: ResultQuestionInput[] = [
  question("q1", "scrum", "Scrum", true),
  question("q2", "scrum", "Scrum", true),
  question("q3", "scrum", "Scrum", false),
  question("q4", "kanban", "Kanban", true),
  question("q5", "kanban", "Kanban", false),
];

const scored = scoreAttempt(
  QUESTIONS.map((q) => ({
    questionId: q.questionId,
    correctOptionIds: q.options.filter((o) => o.isCorrect).map((o) => o.id),
    selectedOptionIds: q.selectedOptionIds,
  })),
  8500,
);

describe("certification result", () => {
  test("leaks no question content whatsoever", () => {
    const view = buildCertificationResult(scored, QUESTIONS, 8500, 2);
    const serialised = JSON.stringify(view);

    for (const [field, sentinel] of Object.entries(SENTINELS)) {
      assert.ok(
        !serialised.includes(sentinel),
        `certification result leaked ${field} — a resitting candidate would gain part of the bank`,
      );
    }
  });

  test("gives the candidate their mark immediately", () => {
    const view = buildCertificationResult(scored, QUESTIONS, 8500, 2);
    assert.equal(view.correctCount, 3);
    assert.equal(view.totalQuestions, 5);
    assert.equal(view.scoreBps, 6000);
    assert.equal(view.passed, false);
    assert.equal(view.attemptsRemaining, 2);
  });

  test("breaks the score down by topic so a resit can be studied for", () => {
    const view = buildCertificationResult(scored, QUESTIONS, 8500, 2);
    const kanban = view.topicBreakdown.find((t) => t.topicId === "kanban");
    const scrum = view.topicBreakdown.find((t) => t.topicId === "scrum");

    assert.deepEqual(
      { correct: scrum?.correct, total: scrum?.total, scoreBps: scrum?.scoreBps },
      { correct: 2, total: 3, scoreBps: 6667 },
    );
    assert.deepEqual(
      { correct: kanban?.correct, total: kanban?.total, scoreBps: kanban?.scoreBps },
      { correct: 1, total: 2, scoreBps: 5000 },
    );
  });

  test("orders the breakdown weakest topic first", () => {
    const view = buildCertificationResult(scored, QUESTIONS, 8500, 2);
    assert.equal(view.topicBreakdown[0].topicId, "kanban", "weakest topic should lead the study guidance");
  });

  test("never reports negative attempts remaining", () => {
    const view = buildCertificationResult(scored, QUESTIONS, 8500, -3);
    assert.equal(view.attemptsRemaining, 0);
  });

  test("a passing attempt is reported as passed", () => {
    const allRight = QUESTIONS.map((q) => ({
      questionId: q.questionId,
      correctOptionIds: q.options.filter((o) => o.isCorrect).map((o) => o.id),
      selectedOptionIds: q.options.filter((o) => o.isCorrect).map((o) => o.id),
    }));
    const view = buildCertificationResult(scoreAttempt(allRight, 8500), QUESTIONS, 8500, 3);
    assert.equal(view.scoreBps, 10000);
    assert.equal(view.passed, true);
  });
});

describe("free open assessment result", () => {
  test("discloses everything, including answers and explanations", () => {
    const view = buildPracticeResult(scored, QUESTIONS);
    const serialised = JSON.stringify(view);

    assert.ok(serialised.includes(SENTINELS.stem));
    assert.ok(serialised.includes(SENTINELS.correct));
    assert.ok(serialised.includes(SENTINELS.explanation));
    assert.equal(view.questions.length, 5);
  });

  test("marks which option the candidate chose and whether it was right", () => {
    const view = buildPracticeResult(scored, QUESTIONS);

    const right = view.questions.find((q) => q.questionId === "q1")!;
    assert.equal(right.isCorrect, true);
    assert.equal(right.answered, true);
    assert.equal(right.options.find((o) => o.id === "q1-a")?.wasSelected, true);

    const wrong = view.questions.find((q) => q.questionId === "q3")!;
    assert.equal(wrong.isCorrect, false);
    assert.equal(wrong.options.find((o) => o.id === "q3-b")?.wasSelected, true);
    assert.equal(wrong.options.find((o) => o.id === "q3-a")?.isCorrect, true, "the right answer is still shown");
  });

  test("handles an unanswered question", () => {
    const unanswered: ResultQuestionInput[] = [{ ...question("q9", "scrum", "Scrum", false), selectedOptionIds: [] }];
    const s = scoreAttempt(
      unanswered.map((q) => ({
        questionId: q.questionId,
        correctOptionIds: q.options.filter((o) => o.isCorrect).map((o) => o.id),
        selectedOptionIds: [],
      })),
      8500,
    );
    const view = buildPracticeResult(s, unanswered);
    assert.equal(view.questions[0].answered, false);
    assert.equal(view.questions[0].isCorrect, false);
  });
});
