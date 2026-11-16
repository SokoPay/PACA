import { BadRequestException, Controller, Delete, Get, Param, Post, Query, Req, Res, StreamableFile } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { createReadStream } from "fs";
import { DocumentsService } from "./documents.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

const kinds = [
  "STUDENT_ID",
  "RECOMMENDATION_LETTER",
  "PROFESSIONAL_CERTIFICATE",
  "CV",
  "PROOF_OF_RETIREMENT",
  "PUBLICATION",
  "OTHER",
] as const;
const kindSchema = z.enum(kinds);

@Controller("membership/applications/:applicationId/documents")
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Post()
  async upload(
    @Param("applicationId") applicationId: string,
    @Query("kind") kindRaw: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: FastifyRequest,
  ) {
    const parsed = kindSchema.safeParse(kindRaw);
    if (!parsed.success) throw new BadRequestException("Unknown document kind");

    const part = await req.file();
    if (!part) throw new BadRequestException("No file uploaded");
    const buffer = await part.toBuffer();

    return this.documents.upload(
      user.id,
      applicationId,
      parsed.data,
      { filename: part.filename, mimetype: part.mimetype, buffer },
      context(req),
    );
  }

  @Delete(":documentId")
  async remove(
    @Param("applicationId") applicationId: string,
    @Param("documentId") documentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: FastifyRequest,
  ) {
    await this.documents.remove(user.id, applicationId, documentId, context(req));
    return { removed: true };
  }

  /** Ownership is enforced here (not in the service) — the same service method backs the admin download route. */
  @Get(":documentId/file")
  async download(
    @Param("applicationId") applicationId: string,
    @Param("documentId") documentId: string,
    @Query("download") download: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: FastifyReply,
  ): Promise<StreamableFile> {
    await this.documents.assertOwnedApplication(user.id, applicationId);
    const file = await this.documents.resolveFile(applicationId, documentId);
    res.header("Content-Type", file.mimeType);
    res.header("X-Content-Type-Options", "nosniff");
    res.header(
      "Content-Disposition",
      `${download !== undefined ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
    );
    return new StreamableFile(createReadStream(file.absolutePath));
  }

  /** Word files rendered as safe HTML for the on-page viewer. */
  @Get(":documentId/preview")
  async preview(
    @Param("applicationId") applicationId: string,
    @Param("documentId") documentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.documents.assertOwnedApplication(user.id, applicationId);
    return this.documents.preview(applicationId, documentId);
  }
}

function context(req: FastifyRequest) {
  const ua = req.headers["user-agent"];
  return { ipAddress: req.ip ?? null, userAgent: (Array.isArray(ua) ? ua[0] : ua) ?? null };
}
