import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { z } from "zod";
import { AssessmentService } from "./assessment.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

const answerSchema = z.object({
  questionId: z.string().min(1),
  selectedOptionIds: z.array(z.string().min(1)).max(6),
});

/** The FREE_OPEN "PACA open assessment" — signed-in members only, no entitlement required. */
@Controller("assessment")
export class AssessmentController {
  constructor(private readonly assessment: AssessmentService) {}

  @Get("active")
  active(@CurrentUser() user: AuthenticatedUser) {
    return this.assessment.getActive(user.id);
  }

  @Post("start")
  start(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: { ip?: string; headers: Record<string, string | undefined> },
  ) {
    return this.assessment.start(user.id, context(req));
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
    @Req() req: { ip?: string; headers: Record<string, string | undefined> },
  ) {
    return this.assessment.answer(user.id, id, body.questionId, body.selectedOptionIds, context(req));
  }

  @Post(":id/submit")
  submit(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: { ip?: string; headers: Record<string, string | undefined> },
  ) {
    return this.assessment.submit(user.id, id, context(req));
  }
}

function context(req: { ip?: string; headers: Record<string, string | undefined> }) {
  return { ipAddress: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null };
}
