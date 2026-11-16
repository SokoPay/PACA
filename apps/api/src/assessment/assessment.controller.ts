import { Body, Controller, Get, HttpCode, Param, Post, Req } from "@nestjs/common";
import { z } from "zod";
import { AssessmentService } from "./assessment.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Public } from "../common/decorators/public.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

const answerSchema = z.object({
  questionId: z.string().min(1),
  selectedOptionIds: z.array(z.string().min(1)).max(6),
});

type Req_ = { ip?: string; headers: Record<string, string | undefined> };

/**
 * Free competency test (FREE_OPEN). The :id routes also serve certification
 * exam attempts — ownership is checked in the service either way.
 */
@Controller("assessment")
export class AssessmentController {
  constructor(private readonly assessment: AssessmentService) {}

  @Get("active")
  active(@CurrentUser() user: AuthenticatedUser) {
    return this.assessment.getActiveFree(user.id);
  }

  @Post("start")
  start(@CurrentUser() user: AuthenticatedUser, @Req() req: Req_) {
    return this.assessment.startFree(user.id, context(req));
  }

  @Get(":id")
  getOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.assessment.getOne(user.id, id);
  }

  @Post(":id/answer")
  answer(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(answerSchema)) body: z.infer<typeof answerSchema>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assessment.answer(user.id, id, body.questionId, body.selectedOptionIds);
  }

  @Post(":id/submit")
  submit(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser, @Req() req: Req_) {
    return this.assessment.submit(user.id, id, context(req));
  }

  @Post(":id/share")
  @HttpCode(200)
  share(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.assessment.share(user.id, id);
  }
}

/** The paid certification exam for the member's tier. */
@Controller("exam")
export class ExamController {
  constructor(private readonly assessment: AssessmentService) {}

  @Get("status")
  status(@CurrentUser() user: AuthenticatedUser) {
    return this.assessment.examStatus(user);
  }

  @Post("start")
  start(@CurrentUser() user: AuthenticatedUser, @Req() req: Req_) {
    return this.assessment.startExam(user, context(req));
  }
}

/** Shared free-test scores, for social media links. */
@Public()
@Controller("public/scores")
export class PublicScoresController {
  constructor(private readonly assessment: AssessmentService) {}

  @Get(":id")
  get(@Param("id") id: string) {
    return this.assessment.publicScore(id);
  }
}

function context(req: Req_) {
  return { ipAddress: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null };
}
