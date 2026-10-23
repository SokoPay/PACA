import { Body, Controller, Get, Param, Patch, Post, Query, Req, UsePipes } from "@nestjs/common";
import { z } from "zod";
import { ReviewService } from "./review.service";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

const difficulties = ["FOUNDATION", "INTERMEDIATE", "ADVANCED", "EXPERT"] as const;
const verdicts = ["APPROVE", "FLAG", "REJECT"] as const;
const statuses = ["DRAFT", "IN_REVIEW", "PUBLISHED", "REJECTED", "RETIRED"] as const;
const origins = ["HUMAN", "AI_GENERATED", "IMPORTED"] as const;

const queueQuerySchema = z.object({
  verdict: z.enum(verdicts).optional(),
  difficulty: z.enum(difficulties).optional(),
  topicSlug: z.string().min(1).max(200).optional(),
  // Defaults to IN_REVIEW in the service when omitted, so the existing review
  // queue keeps behaving exactly as before — this only widens what's possible.
  status: z.enum(statuses).optional(),
  origin: z.enum(origins).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const approveSchema = z.object({ notes: z.string().max(2000).optional() });

const rejectSchema = z.object({
  reason: z.string().min(3, "Give a reason — the drafting prompt improves from these").max(2000),
});

const optionSchema = z.object({
  id: z.string().optional(),
  text: z.string().min(1).max(500),
  isCorrect: z.boolean(),
});

const patchSchema = z
  .object({
    stem: z.string().min(20).max(700).optional(),
    explanation: z.string().min(30).max(2000).optional(),
    sourceRef: z.string().min(1).max(300).optional(),
    difficulty: z.enum(difficulties).optional(),
    topicId: z.string().min(1).optional(),
    options: z.array(optionSchema).min(2).max(6).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update" });

const bulkApproveSchema = z.object({ questionIds: z.array(z.string().min(1)).min(1).max(100) });

/**
 * Kojo's review queue.
 *
 * The only route into the certification question pool. REVIEWER is the minimum
 * role; the hierarchy in RolesGuard means ADMIN and SUPERADMIN also qualify.
 */
@Controller("admin/questions")
@Roles("REVIEWER")
export class ReviewController {
  constructor(private readonly review: ReviewService) {}

  /** Counts by verdict and difficulty — the queue header. */
  @Get("review-stats")
  getStats() {
    return this.review.getStats();
  }

  /** The queue itself, worst-first. */
  @Get("review-queue")
  @UsePipes(new ZodValidationPipe(queueQuerySchema))
  getQueue(@Query() query: z.infer<typeof queueQuerySchema>) {
    return this.review.getQueue(query);
  }

  @Get(":id")
  getOne(@Param("id") id: string) {
    return this.review.getOne(id);
  }

  @Post(":id/approve")
  approve(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(approveSchema)) body: z.infer<typeof approveSchema>,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: { ip?: string; headers: Record<string, string | undefined> },
  ) {
    return this.review.approve(id, user, body.notes, context(req));
  }

  @Post(":id/reject")
  reject(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(rejectSchema)) body: z.infer<typeof rejectSchema>,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: { ip?: string; headers: Record<string, string | undefined> },
  ) {
    return this.review.reject(id, user, body.reason, context(req));
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(patchSchema)) body: z.infer<typeof patchSchema>,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: { ip?: string; headers: Record<string, string | undefined> },
  ) {
    return this.review.update(id, body, user, context(req));
  }

  /** Fast path for the high-confidence tail. Refuses anything not verdict APPROVE. */
  @Post("bulk-approve")
  bulkApprove(
    @Body(new ZodValidationPipe(bulkApproveSchema)) body: z.infer<typeof bulkApproveSchema>,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: { ip?: string; headers: Record<string, string | undefined> },
  ) {
    return this.review.bulkApprove(body.questionIds, user, context(req));
  }
}

function context(req: { ip?: string; headers: Record<string, string | undefined> }) {
  return { ipAddress: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null };
}
