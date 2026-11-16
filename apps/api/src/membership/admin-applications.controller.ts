import { Body, Controller, Get, Param, Post, Query, Req, Res, StreamableFile } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { createReadStream } from "fs";
import { z } from "zod";
import { AdminApplicationsService } from "./admin-applications.service";
import { DocumentsService } from "./documents.service";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

const statuses = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "DECLINED", "WITHDRAWN"] as const;
const tiers = ["STUDENT", "PROFESSIONAL", "EXECUTIVE", "FELLOW", "RETIRED"] as const;

const listQuerySchema = z.object({
  status: z.enum(statuses).optional(),
  query: z.string().trim().max(200).optional(),
  tier: z.enum(tiers).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const approveSchema = z.object({ notes: z.string().max(2000).optional() });

const declineSchema = z.object({
  reason: z.string().min(3, "Give a reason — it is shown to the applicant").max(2000),
});

/**
 * Admin side of apply -> review -> approve. Applicant PII and uploaded
 * documents live here, so ADMIN is the floor — same boundary as the user
 * directory, not the REVIEWER-accessible question queue.
 */
@Controller("admin/applications")
@Roles("ADMIN")
export class AdminApplicationsController {
  constructor(
    private readonly applications: AdminApplicationsService,
    private readonly documents: DocumentsService,
  ) {}

  @Get()
  list(@Query(new ZodValidationPipe(listQuerySchema)) query: z.infer<typeof listQuerySchema>) {
    return this.applications.list(query);
  }

  @Get(":id")
  getOne(@Param("id") id: string) {
    return this.applications.getOne(id);
  }

  /** The class-level @Roles("ADMIN") above is the only access check needed here. */
  @Get(":id/documents/:documentId/file")
  async downloadDocument(
    @Param("id") id: string,
    @Param("documentId") documentId: string,
    @Query("download") download: string | undefined,
    @Res({ passthrough: true }) res: FastifyReply,
  ): Promise<StreamableFile> {
    const file = await this.documents.resolveFile(id, documentId);
    res.header("Content-Type", file.mimeType);
    res.header("X-Content-Type-Options", "nosniff");
    res.header(
      "Content-Disposition",
      `${download !== undefined ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
    );
    return new StreamableFile(createReadStream(file.absolutePath));
  }

  /** Word files rendered as safe HTML so reviewers can read them on the page. */
  @Get(":id/documents/:documentId/preview")
  previewDocument(@Param("id") id: string, @Param("documentId") documentId: string) {
    return this.documents.preview(id, documentId);
  }

  @Post(":id/approve")
  approve(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(approveSchema)) body: z.infer<typeof approveSchema>,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: { ip?: string; headers: Record<string, string | undefined> },
  ) {
    return this.applications.approve(id, user.id, body.notes, context(req));
  }

  @Post(":id/decline")
  decline(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(declineSchema)) body: z.infer<typeof declineSchema>,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: { ip?: string; headers: Record<string, string | undefined> },
  ) {
    return this.applications.decline(id, user.id, body.reason, context(req));
  }
}

function context(req: { ip?: string; headers: Record<string, string | undefined> }) {
  return { ipAddress: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null };
}
