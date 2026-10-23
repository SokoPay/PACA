/**
 * Item quality gate for generated (and imported) questions.
 *
 * PACA has exactly one reviewer. Every item that reaches the review queue with an
 * obvious defect is wasted reviewer time, so we reject mechanically-detectable
 * problems before a human ever sees them.
 *
 * ERRORS reject the item outright. WARNINGS let it through but are surfaced in the
 * review UI so the reviewer knows where to look first.
 */

export type Difficulty = "FOUNDATION" | "INTERMEDIATE" | "ADVANCED" | "EXPERT";

export interface DraftOption {
  text: string;
  isCorrect: boolean;
}

export interface DraftQuestion {
  topicSlug: string;
  difficulty: Difficulty;
  stem: string;
  explanation: string;
  sourceRef: string;
  options: DraftOption[];
}

export interface ValidationIssue {
  code: string;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

const DIFFICULTIES: readonly string[] = ["FOUNDATION", "INTERMEDIATE", "ADVANCED", "EXPERT"];

const MIN_OPTIONS = 3;
const MAX_OPTIONS = 5;
const MIN_STEM = 20;
const MAX_STEM = 700;
const MIN_EXPLANATION = 30;

/**
 * Options referring to other options by position or letter. These are fatal here,
 * not merely poor style: option order is shuffled per attempt, so "all of the above"
 * and "both A and B" are meaningless by the time a candidate reads them.
 */
const POSITIONAL_PATTERNS: readonly RegExp[] = [
  /\ball of the above\b/i,
  /\bnone of the above\b/i,
  /\bboth of the above\b/i,
  /\ball of these\b/i,
  /\bnone of these\b/i,
  /\bboth\s+[a-e]\s+and\s+[a-e]\b/i,
  /\b(?:options?|answers?)\s+[a-e]\s+and\s+[a-e]\b/i,
  /\ba\s+and\s+b\s+only\b/i,
];

/** Absolute qualifiers make a distractor obviously false to test-wise candidates. */
const ABSOLUTE_QUALIFIERS = /\b(?:always|never|all|every|none|only|must never|impossible)\b/i;

function normalise(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.,;:!?]+$/, "");
}

export function validateDraftQuestion(q: DraftQuestion): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const err = (code: string, message: string) => errors.push({ code, message, severity: "error" });
  const warn = (code: string, message: string) => warnings.push({ code, message, severity: "warning" });

  // ---- required fields -------------------------------------------------
  if (!q.topicSlug?.trim()) err("topic_missing", "topicSlug is required");

  if (!DIFFICULTIES.includes(q.difficulty)) {
    err("difficulty_invalid", `difficulty must be one of ${DIFFICULTIES.join(", ")}, got "${q.difficulty}"`);
  }

  const stem = q.stem?.trim() ?? "";
  if (stem.length < MIN_STEM) err("stem_too_short", `stem must be at least ${MIN_STEM} characters`);
  if (stem.length > MAX_STEM) err("stem_too_long", `stem must be at most ${MAX_STEM} characters`);

  const explanation = q.explanation?.trim() ?? "";
  if (explanation.length < MIN_EXPLANATION) {
    err("explanation_too_short", `explanation must be at least ${MIN_EXPLANATION} characters — the reviewer relies on it`);
  }

  if (!q.sourceRef?.trim()) {
    err("source_missing", "sourceRef is required so the reviewer can verify the answer against a primary source");
  }

  // ---- options ---------------------------------------------------------
  const options = q.options ?? [];

  if (options.length < MIN_OPTIONS || options.length > MAX_OPTIONS) {
    err("option_count", `expected ${MIN_OPTIONS}-${MAX_OPTIONS} options, got ${options.length}`);
  }

  if (options.some((o) => !o.text?.trim())) err("option_empty", "options must not be blank");

  const seen = new Map<string, number>();
  for (const o of options) {
    const key = normalise(o.text ?? "");
    if (!key) continue;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  for (const [text, count] of seen) {
    if (count > 1) err("option_duplicate", `duplicate option text: "${text}"`);
  }

  const correct = options.filter((o) => o.isCorrect);
  if (correct.length === 0) err("no_correct_option", "at least one option must be marked correct");
  if (options.length > 0 && correct.length === options.length) {
    err("all_options_correct", "every option is marked correct");
  }

  // Positional references break under per-attempt option shuffling.
  for (const o of options) {
    const text = o.text ?? "";
    if (POSITIONAL_PATTERNS.some((re) => re.test(text))) {
      err(
        "positional_option",
        `option "${text.slice(0, 60)}" refers to other options by position; option order is shuffled per attempt, so this cannot work`,
      );
    }
  }

  // ---- giveaway heuristics --------------------------------------------
  const distractors = options.filter((o) => !o.isCorrect);

  if (correct.length === 1 && distractors.length >= 2) {
    const correctLen = correct[0].text.trim().length;
    const meanDistractor = distractors.reduce((n, o) => n + o.text.trim().length, 0) / distractors.length;

    // A conspicuously longer correct answer is the classic generated-MCQ tell:
    // candidates learn to pick the longest option without knowing the subject.
    if (correctLen > meanDistractor * 1.6 && correctLen - meanDistractor > 25) {
      warn(
        "length_bias",
        `correct option is ${Math.round(correctLen / meanDistractor * 100 - 100)}% longer than the average distractor — candidates can guess by length`,
      );
    }
  }

  for (const o of distractors) {
    if (ABSOLUTE_QUALIFIERS.test(o.text ?? "")) {
      warn(
        "absolute_qualifier",
        `distractor "${(o.text ?? "").slice(0, 50)}" uses an absolute qualifier, which makes it easy to eliminate`,
      );
    }
  }

  // An answer restated verbatim in the stem gives the item away.
  if (correct.length === 1 && stem) {
    const answer = normalise(correct[0].text);
    if (answer.length > 12 && normalise(stem).includes(answer)) {
      warn("answer_in_stem", "the correct option's text appears verbatim in the stem");
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

/** Partition a batch into what a human should see and what to discard. */
export function triageBatch(drafts: readonly DraftQuestion[]): {
  accepted: Array<{ draft: DraftQuestion; warnings: ValidationIssue[] }>;
  rejected: Array<{ draft: DraftQuestion; errors: ValidationIssue[] }>;
} {
  const accepted: Array<{ draft: DraftQuestion; warnings: ValidationIssue[] }> = [];
  const rejected: Array<{ draft: DraftQuestion; errors: ValidationIssue[] }> = [];

  for (const draft of drafts) {
    const result = validateDraftQuestion(draft);
    if (result.ok) accepted.push({ draft, warnings: result.warnings });
    else rejected.push({ draft, errors: result.errors });
  }

  return { accepted, rejected };
}
