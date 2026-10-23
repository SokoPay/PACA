/**
 * Automated pre-review of draft questions.
 *
 * This does NOT replace human review. Kojo still confirms every item. What this does
 * is turn his job from "analyse this question from scratch" into "confirm or override
 * a decision that has already been argued", and sort the queue so the items most
 * likely to be wrong reach him first.
 *
 * The core technique is INDEPENDENT RE-ANSWERING: the reviewing model is shown the
 * question WITHOUT the answer key and asked to answer it. If it disagrees with the
 * key, that is real evidence of a defective item. Asking a model "is this answer
 * correct?" is nearly worthless by comparison — models agree with whatever they are
 * shown.
 *
 * Nothing in this module may publish a question. It annotates and ranks only.
 */
import { validateDraftQuestion, type DraftQuestion, type ValidationIssue } from "./validate.ts";

export interface ReviewProvider {
  readonly name: string;
  complete(prompt: string): Promise<string>;
}

export type AutoReviewVerdict = "APPROVE" | "FLAG" | "REJECT";

export interface Critique {
  /** 0..1 — risk that more than one option is defensible. */
  ambiguityRisk: number;
  /** 0..1 — confidence that the keyed answer is factually correct. */
  factualConfidence: number;
  issues: string[];
  notes: string;
}

export interface AutoReviewResult {
  verdict: AutoReviewVerdict;
  /** 0..1 — overall confidence the item is sound as keyed. */
  confidence: number;
  /** Index the reviewing model chose when answering cold; null if unparseable. */
  independentAnswerIndex: number | null;
  agreesWithKey: boolean;
  critique: Critique;
  /** Deterministic warnings carried through from the quality gate. */
  gateWarnings: ValidationIssue[];
  reasons: string[];
  /**
   * Queue ordering. Lower sorts first. Items needing the most human attention
   * come first, so a reviewer working top-down spends their sharpest time well.
   */
  reviewPriority: number;
  provider: string;
}

/** Options are presented in authored order and referenced by index. */
export function buildAnswerPrompt(q: DraftQuestion): string {
  const options = q.options.map((o, i) => `${i}: ${o.text}`).join("\n");
  return `Answer this multiple-choice question about Agile practice. You are being used to independently verify an exam item, so answer from your own knowledge of the primary sources.

Question: ${q.stem}

Options:
${options}

Respond with ONLY a JSON object, no prose and no markdown fences:
{"answerIndex": <integer index of the single best option>, "reasoning": "<one or two sentences>"}`;
}

export function buildCritiquePrompt(q: DraftQuestion): string {
  const keyed = q.options.findIndex((o) => o.isCorrect);
  const options = q.options.map((o, i) => `${i}: ${o.text}${o.isCorrect ? "  <-- keyed correct" : ""}`).join("\n");

  return `You are reviewing a draft question for a paid professional certification exam. Be strict: a defective item that reaches candidates damages the credential.

Question: ${q.stem}

Options:
${options}

Keyed answer: index ${keyed}
Stated source: ${q.sourceRef}
Author's explanation: ${q.explanation}

Assess:
1. Is the keyed answer factually correct according to the cited primary source?
2. Could a well-prepared candidate defend a different option? Any item with two defensible answers is unusable.
3. Is the stem unambiguous and free of trick wording?
4. Are the distractors plausible but clearly wrong?
5. Does the stated source actually support the claim, or is it decorative?

Respond with ONLY a JSON object, no prose and no markdown fences:
{
  "ambiguityRisk": <0.0-1.0, probability another option is defensible>,
  "factualConfidence": <0.0-1.0, confidence the keyed answer is correct>,
  "issues": ["<short specific problem>", "..."],
  "notes": "<two sentences maximum for the human reviewer>"
}`;
}

function extractJsonObject(raw: string): Record<string, unknown> {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();

  if (!text.startsWith("{")) {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end > start) text = text.slice(start, end + 1);
  }

  const parsed = JSON.parse(text);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("expected a JSON object");
  }
  return parsed as Record<string, unknown>;
}

function clamp01(n: unknown, fallback: number): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

export function parseAnswerResponse(raw: string, optionCount: number): number | null {
  try {
    const o = extractJsonObject(raw);
    const idx = o.answerIndex;
    if (typeof idx !== "number" || !Number.isInteger(idx) || idx < 0 || idx >= optionCount) return null;
    return idx;
  } catch {
    return null;
  }
}

export function parseCritiqueResponse(raw: string): Critique {
  try {
    const o = extractJsonObject(raw);
    return {
      // Unparseable fields default to the cautious end: assume risk, not safety.
      ambiguityRisk: clamp01(o.ambiguityRisk, 0.5),
      factualConfidence: clamp01(o.factualConfidence, 0.5),
      issues: Array.isArray(o.issues) ? o.issues.filter((x): x is string => typeof x === "string") : [],
      notes: typeof o.notes === "string" ? o.notes : "",
    };
  } catch {
    return {
      ambiguityRisk: 0.5,
      factualConfidence: 0.5,
      issues: ["Automated critique could not be parsed; review manually."],
      notes: "",
    };
  }
}

export interface VerdictInput {
  keyedIndex: number;
  independentAnswerIndex: number | null;
  critique: Critique;
  gateWarnings: ValidationIssue[];
}

/**
 * Pure verdict logic — no provider, no I/O, fully unit-testable.
 *
 * Deliberately conservative. A false FLAG costs Kojo thirty seconds; a false
 * APPROVE puts a defective item into a paid certification exam.
 */
export function computeVerdict(input: VerdictInput): {
  verdict: AutoReviewVerdict;
  confidence: number;
  reasons: string[];
  reviewPriority: number;
} {
  const { keyedIndex, independentAnswerIndex, critique, gateWarnings } = input;
  const reasons: string[] = [];

  const answered = independentAnswerIndex !== null;
  const agrees = answered && independentAnswerIndex === keyedIndex;

  if (!answered) {
    reasons.push("The reviewing model did not return a usable answer; treat as unverified.");
  } else if (!agrees) {
    reasons.push(
      `Independent answer was option ${independentAnswerIndex}, but the item is keyed to option ${keyedIndex}. The key may be wrong.`,
    );
  }

  if (critique.ambiguityRisk >= 0.5) {
    reasons.push(`High ambiguity risk (${critique.ambiguityRisk.toFixed(2)}): another option may be defensible.`);
  }
  if (critique.factualConfidence < 0.6) {
    reasons.push(`Low factual confidence (${critique.factualConfidence.toFixed(2)}) in the keyed answer.`);
  }
  for (const issue of critique.issues) reasons.push(issue);
  for (const w of gateWarnings) reasons.push(w.message);

  // Confidence blends independent agreement with the critique's own assessment.
  const agreementScore = agrees ? 1 : answered ? 0 : 0.4;
  let confidence = agreementScore * 0.5 + critique.factualConfidence * 0.3 + (1 - critique.ambiguityRisk) * 0.2;
  confidence = Math.min(1, Math.max(0, confidence - gateWarnings.length * 0.05));

  let verdict: AutoReviewVerdict;
  if (answered && !agrees && critique.factualConfidence < 0.4) {
    // Two independent signals both say the key is wrong.
    verdict = "REJECT";
  } else if (!agrees || critique.ambiguityRisk >= 0.5 || critique.factualConfidence < 0.6 || gateWarnings.length > 0) {
    verdict = "FLAG";
  } else {
    verdict = "APPROVE";
  }

  // Priority: disagreement on the key is the most valuable thing a human can look at.
  const rank = { REJECT: 0, FLAG: 1, APPROVE: 2 }[verdict];
  const reviewPriority = rank * 1000 + Math.round((1 - confidence) * -100) + 100;

  return { verdict, confidence, reasons, reviewPriority };
}

export async function autoReview(provider: ReviewProvider, draft: DraftQuestion): Promise<AutoReviewResult> {
  const keyedIndex = draft.options.findIndex((o) => o.isCorrect);
  if (keyedIndex === -1) throw new Error("Cannot auto-review an item with no correct option");

  const gateWarnings = validateDraftQuestion(draft).warnings;

  // Independent answer first, then critique. Two separate calls so the answering
  // step is never contaminated by the key.
  const [answerRaw, critiqueRaw] = await Promise.all([
    provider.complete(buildAnswerPrompt(draft)),
    provider.complete(buildCritiquePrompt(draft)),
  ]);

  const independentAnswerIndex = parseAnswerResponse(answerRaw, draft.options.length);
  const critique = parseCritiqueResponse(critiqueRaw);

  const { verdict, confidence, reasons, reviewPriority } = computeVerdict({
    keyedIndex,
    independentAnswerIndex,
    critique,
    gateWarnings,
  });

  return {
    verdict,
    confidence,
    independentAnswerIndex,
    agreesWithKey: independentAnswerIndex === keyedIndex,
    critique,
    gateWarnings,
    reasons,
    reviewPriority,
    provider: provider.name,
  };
}

/** Review a batch and return it sorted into the order a human should work through. */
export async function autoReviewBatch(
  provider: ReviewProvider,
  drafts: readonly DraftQuestion[],
): Promise<Array<{ draft: DraftQuestion; review: AutoReviewResult }>> {
  const results = await Promise.all(
    drafts.map(async (draft) => ({ draft, review: await autoReview(provider, draft) })),
  );
  return results.sort((a, b) => a.review.reviewPriority - b.review.reviewPriority);
}

/** Deterministic stand-in until a real API key is configured. Always agrees. */
export class StubReviewProvider implements ReviewProvider {
  readonly name = "stub-review";

  async complete(prompt: string): Promise<string> {
    if (prompt.includes('"answerIndex"')) {
      const match = prompt.match(/^0: /m);
      return JSON.stringify({ answerIndex: match ? 0 : 0, reasoning: "Stub review provider." });
    }
    return JSON.stringify({
      ambiguityRisk: 0.1,
      factualConfidence: 0.9,
      issues: [],
      notes: "Stub review provider — no real assessment performed.",
    });
  }
}
