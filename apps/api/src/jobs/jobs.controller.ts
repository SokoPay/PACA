import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import { z } from "zod";
import { JobsService } from "./jobs.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

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

const memberQuery = z.object({
  role: z.enum(ROLES).optional(),
  remote: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).max(100).default(1),
});

const sourceSchema = z.object({
  kind: z.enum(["GREENHOUSE", "LEVER"]),
  name: z.string().trim().min(2).max(100),
  handle: z.string().trim().regex(/^[a-zA-Z0-9_-]{2,80}$/, "Use the board token / company handle from the job board URL"),
});

/** Paid members' Agile job board. */
@Controller("member-jobs")
export class MemberJobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query(new ZodValidationPipe(memberQuery)) q: z.infer<typeof memberQuery>) {
    return this.jobs.memberJobs(user, { role: q.role, remote: q.remote, search: q.q || undefined, page: q.page });
  }
}

@Roles("ADMIN")
@Controller("admin/jobs")
export class AdminJobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get("sources")
  sources() {
    return this.jobs.sources();
  }

  @Post("sources")
  addSource(@CurrentUser() actor: AuthenticatedUser, @Body(new ZodValidationPipe(sourceSchema)) body: z.infer<typeof sourceSchema>) {
    return this.jobs.addSource(actor, body);
  }

  @Patch("sources/:id")
  toggle(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(z.object({ isActive: z.boolean() }))) body: { isActive: boolean },
  ) {
    return this.jobs.setSourceActive(actor, id, body.isActive);
  }

  /** Runs a crawl now and waits for it (a minute or two). */
  @Post("run")
  @HttpCode(200)
  run() {
    return this.jobs.crawlAll("admin");
  }

  @Get("listings")
  listings(
    @Query(
      new ZodValidationPipe(
        z.object({
          status: z.enum(["PENDING_REVIEW", "PUBLISHED", "REJECTED", "EXPIRED"]).default("PENDING_REVIEW"),
          page: z.coerce.number().int().min(1).default(1),
        }),
      ),
    )
    q: { status: "PENDING_REVIEW" | "PUBLISHED" | "REJECTED" | "EXPIRED"; page: number },
  ) {
    return this.jobs.listings(q.status, q.page);
  }

  @Patch("listings/:id")
  review(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(z.object({ status: z.enum(["PUBLISHED", "REJECTED"]) }))) body: { status: "PUBLISHED" | "REJECTED" },
  ) {
    return this.jobs.setListingStatus(actor, id, body.status);
  }
}
