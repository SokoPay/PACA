/**
 * Question drafting pipeline.
 *
 * Nothing here writes to the database and nothing here publishes. The output is a
 * batch of drafts destined for the review queue at status IN_REVIEW. Only a human
 * (Kojo) moves an item to PUBLISHED. That boundary is the whole reason the
 * certificate is worth anything.
 *
 * The provider is an interface so the pipeline is testable and buildable before an
 * API key exists — StubProvider today, AnthropicProvider when the key arrives.
 */
import { validateDraftQuestion, triageBatch, type DraftQuestion, type Difficulty } from "./validate.ts";

export interface GenerationRequest {
  topicSlug: string;
  /** Human-readable topic name, for the prompt. */
  topicName: string;
  difficulty: Difficulty;
  count: number;
  /**
   * Stems already in the bank for this topic. Passed to the model so it does not
   * regenerate items you already have — the single biggest waste in a drafting run.
   */
  existingStems?: readonly string[];
  /** Grounding material, e.g. the relevant section of the Scrum Guide. */
  sourceMaterial?: string;
}

export interface GenerationProvider {
  readonly name: string;
  generate(prompt: string, request: GenerationRequest): Promise<string>;
}

export interface GenerationOutcome {
  requested: number;
  accepted: Array<{ draft: DraftQuestion; warnings: ReturnType<typeof validateDraftQuestion>["warnings"] }>;
  rejected: Array<{ draft: DraftQuestion; errors: ReturnType<typeof validateDraftQuestion>["errors"] }>;
  /** Raw items the model returned that were not even parseable as a question. */
  malformed: number;
  provider: string;
}

const DIFFICULTY_GUIDANCE: Record<Difficulty, string> = {
  FOUNDATION:
    "Recall and comprehension. A candidate who has read the primary source carefully should answer correctly. Definitions, timeboxes, named accountabilities, list membership.",
  INTERMEDIATE:
    "Application. Present a short, realistic situation and ask what the framework prescribes. Avoid pure recall; the candidate should have to apply a rule rather than recite it.",
  ADVANCED:
    "Analysis and judgement. Present a scenario with competing considerations where several options look defensible, and exactly one is best-supported by the source. Test why a practice exists, not just what it is.",
  EXPERT:
    "Synthesis and critique. Organisational-level scenarios, trade-offs between practices, diagnosing systemic dysfunction. The distractors should each represent a plausible but flawed reading held by experienced practitioners.",
};

export function buildPrompt(req: GenerationRequest): string {
  const existing = req.existingStems?.length
    ? `\n\nQuestions ALREADY in the bank for this topic — do not duplicate these, or produce near-paraphrases of them:\n${req.existingStems
        .map((s, i) => `${i + 1}. ${s}`)
        .join("\n")}`
    : "";

  const grounding = req.sourceMaterial
    ? `\n\nGround every question in this source material. Do not assert anything it does not support:\n"""\n${req.sourceMaterial}\n"""`
    : "";

  return `You are writing certification exam questions for PACA (Professional Agile Certification - Africa), a professional body that issues paid, credential-bearing certifications.

Write ${req.count} multiple-choice questions on the topic "${req.topicName}" at ${req.difficulty} difficulty.

${req.difficulty} means: ${DIFFICULTY_GUIDANCE[req.difficulty]}

Hard requirements:
- Each question has 4 options, exactly one correct.
- Write in your own words. Do NOT reproduce sentences from any source document; the bank must be PACA's own material.
- Never write options such as "All of the above", "None of the above", or "Both A and C". Option order is randomised per candidate, so positional references are meaningless.
- Distractors must be plausible to someone who half-knows the material - a common misconception, an adjacent concept, or an outdated practice. Never filler.
- Keep all four options similar in length and grammatical form. A longer correct answer lets candidates guess without knowledge.
- Avoid "always" and "never" in distractors; they are trivially eliminated.
- Do not restate the correct option verbatim inside the question stem.
- "sourceRef" must cite a specific, checkable location, e.g. "Scrum Guide 2020, Sprint Review" or "Kanban Guide, Flow Metrics". A reviewer must be able to verify the answer in under a minute.
- "explanation" must say why the correct option is right AND why the tempting distractor is wrong.

Use British English spelling.${grounding}${existing}

Return ONLY a JSON array, no prose and no markdown fences, of this exact shape:
[
  {
    "stem": "string",
    "explanation": "string",
    "sourceRef": "string",
    "options": [
      { "text": "string", "isCorrect": true },
      { "text": "string", "isCorrect": false },
      { "text": "string", "isCorrect": false },
      { "text": "string", "isCorrect": false }
    ]
  }
]`;
}

/** Tolerates markdown fences and leading prose, which models sometimes emit anyway. */
export function parseGeneratedJson(raw: string): unknown[] {
  let text = raw.trim();

  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();

  if (!text.startsWith("[")) {
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start !== -1 && end > start) text = text.slice(start, end + 1);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Model did not return valid JSON. First 200 chars: ${raw.slice(0, 200)}`);
  }

  if (!Array.isArray(parsed)) throw new Error("Model returned JSON, but not an array");
  return parsed;
}

/** Shape-check a single raw item before validation proper. */
function coerceDraft(raw: unknown, req: GenerationRequest): DraftQuestion | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;

  if (typeof o.stem !== "string") return null;
  if (!Array.isArray(o.options)) return null;

  const options = o.options
    .map((opt) => {
      if (typeof opt !== "object" || opt === null) return null;
      const p = opt as Record<string, unknown>;
      if (typeof p.text !== "string") return null;
      return { text: p.text, isCorrect: p.isCorrect === true };
    })
    .filter((x): x is { text: string; isCorrect: boolean } => x !== null);

  if (options.length !== o.options.length) return null;

  return {
    topicSlug: req.topicSlug,
    difficulty: req.difficulty,
    stem: o.stem,
    explanation: typeof o.explanation === "string" ? o.explanation : "",
    sourceRef: typeof o.sourceRef === "string" ? o.sourceRef : "",
    options,
  };
}

export async function generateQuestions(
  provider: GenerationProvider,
  req: GenerationRequest,
): Promise<GenerationOutcome> {
  if (req.count <= 0) throw new RangeError("count must be a positive integer");

  const raw = await provider.generate(buildPrompt(req), req);
  const items = parseGeneratedJson(raw);

  const drafts: DraftQuestion[] = [];
  let malformed = 0;

  for (const item of items) {
    const draft = coerceDraft(item, req);
    if (draft) drafts.push(draft);
    else malformed++;
  }

  const { accepted, rejected } = triageBatch(drafts);

  return { requested: req.count, accepted, rejected, malformed, provider: provider.name };
}

/**
 * Deterministic stand-in so the pipeline is exercisable before an API key exists.
 * Produces structurally valid drafts with obviously placeholder content — it must
 * never be mistaken for real question content, so every stem is clearly marked.
 */
export class StubProvider implements GenerationProvider {
  readonly name = "stub";

  async generate(_prompt: string, req: GenerationRequest): Promise<string> {
    const items = Array.from({ length: req.count }, (_, i) => ({
      stem: `[STUB ${i + 1}] Placeholder ${req.difficulty} question about ${req.topicName} awaiting a real generation provider.`,
      explanation:
        "Placeholder explanation generated by the stub provider. Replace by configuring a real generation provider.",
      sourceRef: `Stub source reference for ${req.topicSlug}`,
      options: [
        { text: `Correct placeholder option for ${req.topicName}`, isCorrect: true },
        { text: `First incorrect placeholder option`, isCorrect: false },
        { text: `Second incorrect placeholder option`, isCorrect: false },
        { text: `Third incorrect placeholder option`, isCorrect: false },
      ],
    }));
    return JSON.stringify(items);
  }
}
