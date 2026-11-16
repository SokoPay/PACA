import { Body, Controller, Get, HttpCode, Post } from "@nestjs/common";
import { z } from "zod";
import { QuestionGeneratorService } from "./question-generator.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

const generateSchema = z.object({
  tier: z.enum(["STUDENT", "PROFESSIONAL", "EXECUTIVE", "RETIRED"]),
  count: z.number().int().min(5).max(30).default(20),
});

/** Exam question bank per membership tier, and AI drafting of new questions (reviewed before use). */
@Roles("ADMIN")
@Controller("admin/question-bank")
export class QuestionBankController {
  constructor(private readonly generator: QuestionGeneratorService) {}

  @Get()
  stats() {
    return this.generator.bankStats();
  }

  @Post("generate")
  @HttpCode(200)
  generate(@CurrentUser() actor: AuthenticatedUser, @Body(new ZodValidationPipe(generateSchema)) body: z.infer<typeof generateSchema>) {
    return this.generator.generate(actor, body.tier, body.count);
  }
}
