import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { z } from "zod";
import { ApplicationsService } from "./applications.service";
import { Public } from "../common/decorators/public.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

const TIERS = ["STUDENT", "PROFESSIONAL", "EXECUTIVE", "FELLOW", "RETIRED"] as const;

const saveDraftSchema = z.object({
  tier: z.enum(TIERS),
  // Field-level shape is validated server-side against the tier's own schema.
  answers: z.record(z.unknown()),
});

@Controller("membership")
export class MembershipController {
  constructor(private readonly applications: ApplicationsService) {}

  /** Public catalogue: prices, exam rules and the form definition per tier. */
  @Public()
  @Get("tiers")
  listTiers() {
    return this.applications.listTiers();
  }

  @Get("status")
  status(@CurrentUser() user: AuthenticatedUser) {
    return this.applications.myStatus(user.id);
  }

  @Get("applications")
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.applications.myApplications(user.id);
  }

  @Post("applications")
  saveDraft(
    @Body(new ZodValidationPipe(saveDraftSchema)) body: z.infer<typeof saveDraftSchema>,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: { ip?: string; headers: Record<string, string | undefined> },
  ) {
    return this.applications.saveDraft(user, body.tier, body.answers, context(req));
  }

  @Post("applications/:id/submit")
  submit(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: { ip?: string; headers: Record<string, string | undefined> },
  ) {
    return this.applications.submit(user, id, context(req));
  }

  /** Take a submitted application back out of review to edit it. */
  @Post("applications/:id/reopen")
  reopen(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: { ip?: string; headers: Record<string, string | undefined> },
  ) {
    return this.applications.reopen(user, id, context(req));
  }

  @Post("applications/:id/withdraw")
  withdraw(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: { ip?: string; headers: Record<string, string | undefined> },
  ) {
    return this.applications.withdraw(user, id, context(req));
  }
}

function context(req: { ip?: string; headers: Record<string, string | undefined> }) {
  return { ipAddress: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null };
}
