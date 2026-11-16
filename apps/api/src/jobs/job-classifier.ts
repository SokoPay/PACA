import Anthropic from "@anthropic-ai/sdk";
import { Logger } from "@nestjs/common";
import { z } from "zod";
import type { AgileRole, Seniority } from "@prisma/client";

export interface Classification {
  relevant: boolean;
  agileRole: AgileRole;
  seniority: Seniority;
  confidence: number;
  summary: string;
}

const ROLES = [
  "SCRUM_MASTER",
  "PRODUCT_OWNER",
  "PRODUCT_MANAGER",
  "AGILE_COACH",
  "RELEASE_TRAIN_ENGINEER",
  "DELIVERY_MANAGER",
  "BUSINESS_ANALYST",
  "AGILE_TRAINER",
  "OTHER",
] as const;
const LEVELS = ["ENTRY", "MID", "SENIOR", "LEAD", "EXECUTIVE"] as const;

const resultSchema = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      relevant: z.boolean(),
      agileRole: z.enum(ROLES),
      seniority: z.enum(LEVELS),
      confidence: z.number().min(0).max(1),
      summary: z.string(),
    }),
  ),
});

// JSON Schema for structured outputs (output_config.format) — mirrors resultSchema.
const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          relevant: { type: "boolean" },
          agileRole: { type: "string", enum: [...ROLES] },
          seniority: { type: "string", enum: [...LEVELS] },
          confidence: { type: "number" },
          summary: { type: "string" },
        },
        required: ["id", "relevant", "agileRole", "seniority", "confidence", "summary"],
        additionalProperties: false,
      },
    },
  },
  required: ["results"],
  additionalProperties: false,
} as const;

const SYSTEM = `You screen job postings for PACA (Professional Agile Certification Africa), whose members are Agile practitioners: Scrum Masters, Product Owners, Agile coaches, delivery managers and similar.

For each posting decide:
- relevant: true only if the role's core work is Agile delivery or Agile product work (e.g. Scrum Master, Product Owner, Agile Coach, RTE, Agile delivery/project manager, Agile business analyst). A software engineer or salesperson role that merely mentions "agile" is NOT relevant.
- agileRole: the closest category; OTHER if none fits.
- seniority: ENTRY, MID, SENIOR, LEAD or EXECUTIVE from the title and requirements.
- confidence: 0 to 1, how sure you are about "relevant".
- summary: one plain sentence (max 30 words) describing the role for a job card. No marketing language.

Return one result per posting, using the posting's id.`;

/**
 * Classifies postings with Claude, in batches. Without ANTHROPIC_API_KEY it falls
 * back to a title heuristic so the job board still works (less precisely).
 */
export class JobClassifier {
  private readonly logger = new Logger(JobClassifier.name);
  private readonly client: Anthropic | null;

  constructor(
    apiKey: string | undefined,
    private readonly model: string,
  ) {
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
  }

  get usesAi(): boolean {
    return this.client !== null;
  }

  async classify(jobs: Array<{ id: string; title: string; company: string; description: string }>): Promise<Map<string, Classification>> {
    const out = new Map<string, Classification>();
    for (let i = 0; i < jobs.length; i += 15) {
      const batch = jobs.slice(i, i + 15);
      const ai = this.client ? await this.classifyWithClaude(batch).catch((err) => {
        this.logger.warn(`AI classification failed, using heuristics for this batch: ${(err as Error).message}`);
        return null;
      }) : null;
      for (const job of batch) out.set(job.id, ai?.get(job.id) ?? heuristic(job.title, job.description));
    }
    return out;
  }

  private async classifyWithClaude(batch: Array<{ id: string; title: string; company: string; description: string }>) {
    const postings = batch
      .map((j) => `<posting id="${j.id}">\nTitle: ${j.title}\nCompany: ${j.company}\nDescription: ${j.description.slice(0, 1500)}\n</posting>`)
      .join("\n\n");

    const response = await this.client!.beta.messages.create({
      model: this.model,
      max_tokens: 16000,
      // Server-side fallback: if the model declines a request, the API retries it on a suitable fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: OUTPUT_SCHEMA },
      },
      system: SYSTEM,
      messages: [{ role: "user", content: `Classify these ${batch.length} job postings.\n\n${postings}` }],
    });

    if (response.stop_reason === "refusal") throw new Error("model declined the request");
    if (response.stop_reason === "max_tokens") throw new Error("response was cut off");

    const text = response.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")?.text ?? "";
    const parsed = resultSchema.safeParse(JSON.parse(text));
    if (!parsed.success) throw new Error("response did not match the schema");

    const map = new Map<string, Classification>();
    for (const r of parsed.data.results) {
      map.set(r.id, {
        relevant: r.relevant,
        agileRole: r.agileRole,
        seniority: r.seniority,
        confidence: r.confidence,
        summary: r.summary.slice(0, 300),
      });
    }
    return map;
  }
}

/** Title-only fallback when no API key is configured. */
export function heuristic(title: string, description: string): Classification {
  const t = title.toLowerCase();
  const role: AgileRole = /scrum master/.test(t)
    ? "SCRUM_MASTER"
    : /product owner/.test(t)
      ? "PRODUCT_OWNER"
      : /product manager/.test(t)
        ? "PRODUCT_MANAGER"
        : /agile coach|coach/.test(t)
          ? "AGILE_COACH"
          : /release train|\brte\b/.test(t)
            ? "RELEASE_TRAIN_ENGINEER"
            : /delivery (manager|lead)|project manager|program/.test(t)
              ? "DELIVERY_MANAGER"
              : /business analyst/.test(t)
                ? "BUSINESS_ANALYST"
                : /trainer/.test(t)
                  ? "AGILE_TRAINER"
                  : "OTHER";
  const seniority: Seniority = /chief|head of|director|vp\b|vice president/.test(t)
    ? "EXECUTIVE"
    : /lead|principal|staff/.test(t)
      ? "LEAD"
      : /senior|sr\.?\b/.test(t)
        ? "SENIOR"
        : /junior|jr\.?\b|graduate|intern|entry/.test(t)
          ? "ENTRY"
          : "MID";
  const strong = role !== "OTHER" && role !== "DELIVERY_MANAGER";
  const firstSentence = description.split(/(?<=[.!?])\s/)[0]?.slice(0, 200) ?? "";
  return { relevant: role !== "OTHER", agileRole: role, seniority, confidence: strong ? 0.8 : 0.5, summary: firstSentence };
}
