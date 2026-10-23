/**
 * Attempt scoring. Server-side only — this module must never be bundled into the
 * client, because it operates on the correct-answer sets.
 *
 * Scores are basis points (0..10000). Integer arithmetic throughout: a float
 * comparison deciding whether someone passed a paid certification is a defect
 * you only discover from an angry member.
 */

export interface ScorableQuestion {
  questionId: string;
  /** Option ids that are correct. Order irrelevant. */
  correctOptionIds: readonly string[];
  /** Option ids the candidate chose. Empty = unanswered. */
  selectedOptionIds: readonly string[];
}

export interface QuestionOutcome {
  questionId: string;
  isCorrect: boolean;
  answered: boolean;
}

export interface ScoreResult {
  totalQuestions: number;
  answeredCount: number;
  correctCount: number;
  /** 0..10000. 8500 = 85.00%. */
  scoreBps: number;
  passed: boolean;
  outcomes: QuestionOutcome[];
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  for (const x of b) if (!set.has(x)) return false;
  return true;
}

/**
 * Multi-answer questions are all-or-nothing: the selected set must match the correct
 * set exactly. Partial credit is deliberately not offered — it makes the pass mark
 * ambiguous and is not defensible when a result is challenged.
 *
 * Unanswered questions score zero. There is no negative marking.
 */
export function scoreAttempt(questions: readonly ScorableQuestion[], passMarkBps: number): ScoreResult {
  if (!Number.isInteger(passMarkBps) || passMarkBps < 0 || passMarkBps > 10000) {
    throw new RangeError(`passMarkBps must be an integer in 0..10000, got ${passMarkBps}`);
  }

  const total = questions.length;
  if (total === 0) {
    return { totalQuestions: 0, answeredCount: 0, correctCount: 0, scoreBps: 0, passed: false, outcomes: [] };
  }

  const outcomes: QuestionOutcome[] = questions.map((q) => {
    const answered = q.selectedOptionIds.length > 0;
    return {
      questionId: q.questionId,
      answered,
      isCorrect: answered && sameSet(q.correctOptionIds, q.selectedOptionIds),
    };
  });

  const correctCount = outcomes.reduce((n, o) => n + (o.isCorrect ? 1 : 0), 0);
  const answeredCount = outcomes.reduce((n, o) => n + (o.answered ? 1 : 0), 0);

  // Round half-up, in integer space.
  const scoreBps = Math.round((correctCount * 10000) / total);

  return {
    totalQuestions: total,
    answeredCount,
    correctCount,
    scoreBps,
    passed: scoreBps >= passMarkBps,
    outcomes,
  };
}

/** Format basis points for display, e.g. 8567 -> "85.67%". */
export function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}
