/**
 * What a candidate is shown the instant they submit.
 *
 * Marking is automatic and synchronous — no admin ever sits in this path. The only
 * question is how much detail to disclose, and that differs sharply by assessment
 * type:
 *
 *   CERTIFICATION — score, pass/fail and a per-topic breakdown. NO question text,
 *     NO correct answers, NO explanations. A candidate has three attempts; showing
 *     them the items they failed would hand them a partial copy of the bank to use
 *     on the next one. The topic breakdown gives them everything they need to study
 *     without leaking a single item.
 *
 *   FREE_OPEN — everything, including correct answers and explanations. Nothing is
 *     at stake, the feedback is the point, and it advertises the paid tier.
 *
 * The two view types are deliberately separate shapes rather than one shape with
 * optional fields, so a certification result cannot accidentally carry question
 * content. See the leak test in results.test.ts.
 */
import type { ScoreResult } from "./scoring.ts";

export interface ResultQuestionInput {
  questionId: string;
  topicId: string;
  topicName: string;
  stem: string;
  explanation: string | null;
  sourceRef: string | null;
  options: ReadonlyArray<{ id: string; text: string; isCorrect: boolean }>;
  selectedOptionIds: readonly string[];
}

export interface TopicScore {
  topicId: string;
  topicName: string;
  correct: number;
  total: number;
  scoreBps: number;
}

/** Safe to return to a candidate who may resit. Carries no question content. */
export interface CertificationResultView {
  type: "CERTIFICATION";
  totalQuestions: number;
  answeredCount: number;
  correctCount: number;
  scoreBps: number;
  passMarkBps: number;
  passed: boolean;
  /** Weakest topic first — this is study guidance, so order it usefully. */
  topicBreakdown: TopicScore[];
  attemptsRemaining: number;
}

export interface PracticeQuestionReview {
  questionId: string;
  topicName: string;
  stem: string;
  explanation: string | null;
  sourceRef: string | null;
  options: Array<{ id: string; text: string; isCorrect: boolean; wasSelected: boolean }>;
  isCorrect: boolean;
  answered: boolean;
}

/** Full disclosure. Only ever built for the free open assessment. */
export interface PracticeResultView {
  type: "FREE_OPEN";
  totalQuestions: number;
  answeredCount: number;
  correctCount: number;
  scoreBps: number;
  questions: PracticeQuestionReview[];
}

function buildTopicBreakdown(score: ScoreResult, questions: readonly ResultQuestionInput[]): TopicScore[] {
  const byId = new Map(questions.map((q) => [q.questionId, q]));
  const acc = new Map<string, { name: string; correct: number; total: number }>();

  for (const outcome of score.outcomes) {
    const q = byId.get(outcome.questionId);
    if (!q) continue;

    const entry = acc.get(q.topicId) ?? { name: q.topicName, correct: 0, total: 0 };
    entry.total++;
    if (outcome.isCorrect) entry.correct++;
    acc.set(q.topicId, entry);
  }

  return [...acc.entries()]
    .map(([topicId, v]) => ({
      topicId,
      topicName: v.name,
      correct: v.correct,
      total: v.total,
      scoreBps: v.total === 0 ? 0 : Math.round((v.correct * 10000) / v.total),
    }))
    .sort((a, b) => a.scoreBps - b.scoreBps || a.topicName.localeCompare(b.topicName));
}

export function buildCertificationResult(
  score: ScoreResult,
  questions: readonly ResultQuestionInput[],
  passMarkBps: number,
  attemptsRemaining: number,
): CertificationResultView {
  return {
    type: "CERTIFICATION",
    totalQuestions: score.totalQuestions,
    answeredCount: score.answeredCount,
    correctCount: score.correctCount,
    scoreBps: score.scoreBps,
    passMarkBps,
    passed: score.passed,
    topicBreakdown: buildTopicBreakdown(score, questions),
    attemptsRemaining: Math.max(0, attemptsRemaining),
  };
}

export function buildPracticeResult(
  score: ScoreResult,
  questions: readonly ResultQuestionInput[],
): PracticeResultView {
  const outcomeById = new Map(score.outcomes.map((o) => [o.questionId, o]));

  return {
    type: "FREE_OPEN",
    totalQuestions: score.totalQuestions,
    answeredCount: score.answeredCount,
    correctCount: score.correctCount,
    scoreBps: score.scoreBps,
    questions: questions.map((q) => {
      const outcome = outcomeById.get(q.questionId);
      const selected = new Set(q.selectedOptionIds);
      return {
        questionId: q.questionId,
        topicName: q.topicName,
        stem: q.stem,
        explanation: q.explanation,
        sourceRef: q.sourceRef,
        options: q.options.map((o) => ({
          id: o.id,
          text: o.text,
          isCorrect: o.isCorrect,
          wasSelected: selected.has(o.id),
        })),
        isCorrect: outcome?.isCorrect ?? false,
        answered: outcome?.answered ?? false,
      };
    }),
  };
}
