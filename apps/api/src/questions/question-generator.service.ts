import Anthropic from "@anthropic-ai/sdk";
import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { z } from "zod";
import type { Difficulty, MembershipTier } from "@prisma/client";
import { PrismaService } from "../common/prisma.service";
import { AuditService } from "../common/audit.service";
import { loadEnv } from "../config/env";
import { htmlToText } from "../jobs/job-feeds";

/**
 * Drafts ORIGINAL exam questions with Claude, per membership tier, grounded in
 * the openly licensed Scrum Guide 2020 and Kanban Guide (both CC BY-SA 4.0).
 *
 * We deliberately do not copy question banks from other websites: those are
 * copyrighted, and questions that circulate online make a certification
 * worthless. Every drafted question lands IN_REVIEW and only reaches the exam
 * pool after a PACA reviewer approves it in the review queue.
 */

const SOURCES = [
  { name: "Scrum Guide 2020", url: "https://scrumguides.org/scrum-guide.html" },
  { name: "Kanban Guide", url: "https://kanbanguides.org/english/" },
];

/** Who each tier's exam is for — this is what makes Student, Professional and Executive questions different. */
const AUDIENCE: Partial<Record<MembershipTier, string>> = {
  STUDENT:
    "University and college students new to Agile. Test core knowledge: the Agile Manifesto and principles, Scrum accountabilities, events, artifacts and commitments, Scrum values, basic Kanban practices. Clear, direct questions about definitions and purpose.",
  PROFESSIONAL:
    "Working practitioners (Scrum Masters, Product Owners, developers, delivery leads). Test applied knowledge with realistic team scenarios: facilitating events, backlog management, Definition of Done, impediments, WIP limits, flow metrics (cycle time, throughput, work item age), forecasting, coaching a team.",
  EXECUTIVE:
    "Senior leaders, managers, directors and C-level executives. Test leadership and organisational judgement with business scenarios: leading Agile transformation, enabling self-managing teams, Evidence-Based Management and value metrics, portfolio flow and scaling Scrum/Kanban across teams, governance, funding and stakeholder alignment, removing organisational impediments, Agile culture.",
  RETIRED:
    "Experienced former practitioners. Test broad applied knowledge of Scrum, Kanban and Agile leadership with realistic scenarios.",
};

const outputSchema = z.object({
  questions: z.array(
    z.object({
      topicSlug: z.string(),
      kind: z.enum(["SINGLE_CHOICE", "MULTI_CHOICE"]),
      stem: z.string().min(10),
      options: z.array(z.object({ text: z.string().min(1), isCorrect: z.boolean() })).min(3).max(6),
      explanation: z.string().min(10),
      sourceRef: z.string(),
    }),
  ),
});

const OUTPUT_JSON_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          topicSlug: { type: "string" },
          kind: { type: "string", enum: ["SINGLE_CHOICE", "MULTI_CHOICE"] },
          stem: { type: "string" },
          options: {
            type: "array",
            items: {
              type: "object",
              properties: { text: { type: "string" }, isCorrect: { type: "boolean" } },
              required: ["text", "isCorrect"],
              additionalProperties: false,
            },
          },
          explanation: { type: "string" },
          sourceRef: { type: "string" },
        },
        required: ["topicSlug", "kind", "stem", "options", "explanation", "sourceRef"],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
} as const;

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

@Injectable()
export class QuestionGeneratorService {
  private readonly logger = new Logger(QuestionGeneratorService.name);
  private readonly env = loadEnv();
  private readonly client = this.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: this.env.ANTHROPIC_API_KEY }) : null;
  private sourceCache: { at: number; text: string } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Exam-pool health per tier: how many approved questions each tier's exam can draw from. */
  async bankStats() {
    const configs = await this.prisma.tierConfig.findMany({
      where: { requiresExam: true },
      orderBy: { sortOrder: "asc" },
      select: { tier: true, displayName: true, difficulty: true, examQuestionCount: true },
    });
    const counts = await this.prisma.question.groupBy({ by: ["difficulty", "status"], _count: { _all: true } });
    const count = (d: Difficulty, status: string) =>
      counts.find((c) => c.difficulty === d && c.status === status)?._count._all ?? 0;
    return {
      aiEnabled: Boolean(this.client),
      tiers: configs.map((c) => ({
        tier: c.tier,
        name: c.displayName,
        difficulty: c.difficulty,
        perExam: c.examQuestionCount,
        published: count(c.difficulty, "PUBLISHED"),
        inReview: count(c.difficulty, "IN_REVIEW"),
        // Enough for several members to sit at once and still get different papers.
        recommended: c.examQuestionCount * 4,
      })),
    };
  }

  private async sourceText(): Promise<string> {
    if (this.sourceCache && Date.now() - this.sourceCache.at < 86_400_000) return this.sourceCache.text;
    const parts: string[] = [];
    for (const s of SOURCES) {
      try {
        const res = await fetch(s.url, { headers: { "user-agent": "PACA/1.0 (+https://pac-a.org)" }, signal: AbortSignal.timeout(20_000) });
        if (res.ok) parts.push(`<source name="${s.name}" licence="CC BY-SA 4.0">\n${htmlToText(await res.text())}\n</source>`);
      } catch (err) {
        this.logger.warn(`Could not fetch ${s.name}: ${(err as Error).message}`);
      }
    }
    const text = parts.join("\n\n");
    if (text) this.sourceCache = { at: Date.now(), text };
    return text;
  }

  async generate(actor: { id: string }, tier: MembershipTier, count: number) {
    if (!this.client) throw new BadRequestException("Set ANTHROPIC_API_KEY on the server to generate questions.");
    const config = await this.prisma.tierConfig.findUnique({ where: { tier } });
    const audience = AUDIENCE[tier];
    if (!config || !config.requiresExam || !audience) {
      throw new BadRequestException("This membership type has no written exam.");
    }

    const topics = await this.prisma.topic.findMany({ select: { id: true, slug: true, name: true } });
    if (topics.length === 0) throw new BadRequestException("No topics exist yet — run the seed first.");

    // Show the model recent stems at this level so it doesn't repeat them.
    const existing = await this.prisma.question.findMany({
      where: { difficulty: config.difficulty, status: { in: ["PUBLISHED", "IN_REVIEW", "DRAFT"] } },
      select: { stem: true },
      orderBy: { createdAt: "desc" },
      take: 150,
    });
    const sources = await this.sourceText();

    const system = `You write original multiple-choice certification exam questions for PACA (Professional Agile Certification Africa).

Rules:
- Every question must be ORIGINAL. Never reproduce questions from Scrum.org, Scrum Alliance, ProKanban.org, PMI or any published practice test.
- Ground facts in the source documents provided (Scrum Guide 2020 and Kanban Guide, CC BY-SA 4.0). For leadership topics not covered there, use well-established Agile practice and say so in sourceRef.
- Exactly one correct option for SINGLE_CHOICE; two or three for MULTI_CHOICE (use MULTI_CHOICE for about 1 in 5 questions). Four options is typical.
- Wrong options must be plausible to someone who has not studied — no joke answers, no "all of the above" / "none of the above".
- Prefer realistic scenarios over trivia, using African workplace contexts (Accra, Lagos, Nairobi, Kigali, Johannesburg…) where natural.
- explanation: 1–3 sentences on why the correct answer is right, citing the guide where possible.
- sourceRef: e.g. "Scrum Guide 2020 — Sprint Review" or "Kanban Guide — Work item age" or "Agile leadership practice".
- topicSlug must be one of the provided topic slugs.`;

    const user = `Write ${count} new questions for the ${config.displayName} certification exam.

Audience and focus: ${audience}
Difficulty level: ${config.difficulty}

Topic slugs you may use: ${topics.map((t) => `${t.slug} (${t.name})`).join(", ")}

Do not repeat or closely paraphrase any of these existing questions:
${existing.map((e) => `- ${e.stem.slice(0, 160)}`).join("\n") || "(none yet)"}

${sources || "(Source documents could not be fetched; rely on the Scrum Guide 2020 and Kanban Guide as you know them.)"}`;

    let response: Anthropic.Beta.BetaMessage;
    try {
      response = await this.client.beta.messages
        .stream({
          model: this.env.AI_MODEL,
          max_tokens: 32000,
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          output_config: { effort: "medium", format: { type: "json_schema", schema: OUTPUT_JSON_SCHEMA } },
          system,
          messages: [{ role: "user", content: user }],
        })
        .finalMessage();
    } catch (err) {
      this.logger.error(`Question generation failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException("The AI service could not draft questions right now. Please try again.");
    }
    if (response.stop_reason === "refusal") throw new ServiceUnavailableException("The AI declined this request. Try again.");

    const text = response.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")?.text ?? "";
    let parsed: z.infer<typeof outputSchema>;
    try {
      parsed = outputSchema.parse(JSON.parse(text));
    } catch {
      throw new ServiceUnavailableException("The AI returned questions in an unexpected format. Please try again.");
    }

    const seen = new Set(existing.map((e) => normalise(e.stem)));
    const bySlug = new Map(topics.map((t) => [t.slug, t.id]));
    let created = 0;
    let skipped = 0;
    for (const q of parsed.questions) {
      const correct = q.options.filter((o) => o.isCorrect).length;
      const validKind = q.kind === "SINGLE_CHOICE" ? correct === 1 : correct >= 2 && correct < q.options.length;
      const key = normalise(q.stem);
      if (!validKind || seen.has(key)) {
        skipped++;
        continue;
      }
      seen.add(key);
      await this.prisma.question.create({
        data: {
          topicId: bySlug.get(q.topicSlug) ?? topics[0].id,
          kind: q.kind,
          difficulty: config.difficulty,
          stem: q.stem.trim(),
          explanation: q.explanation.trim(),
          sourceRef: q.sourceRef.slice(0, 200),
          status: "IN_REVIEW",
          origin: "AI_GENERATED",
          aiModel: response.model,
          aiPrompt: `${config.displayName} exam · ${config.difficulty} · batch of ${count}`,
          createdByUserId: actor.id,
          options: { create: q.options.map((o, i) => ({ text: o.text.trim(), isCorrect: o.isCorrect, sortOrder: i })) },
        },
      });
      created++;
    }

    await this.audit.record({
      actorUserId: actor.id,
      action: "questions.generated",
      entityType: "Question",
      metadata: { tier, difficulty: config.difficulty, requested: count, created, skipped, model: response.model },
    });
    return { created, skipped, difficulty: config.difficulty };
  }
}
