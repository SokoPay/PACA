import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req, Res, StreamableFile } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { createReadStream } from "fs";
import { z } from "zod";
import { LibraryService, MAX_BOOK_BYTES } from "./library.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

const TIERS = ["STUDENT", "PROFESSIONAL", "EXECUTIVE", "FELLOW", "RETIRED"] as const;
const tiersSchema = z.array(z.enum(TIERS)).max(TIERS.length);

const uploadMetaSchema = z.object({
  title: z.string().trim().min(2, "Give the book a title").max(200),
  description: z.string().trim().max(2000).optional(),
  tiers: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean) : []))
    .pipe(tiersSchema),
});

const updateSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  tiers: tiersSchema.optional(),
  published: z.boolean().optional(),
});

/** Members: list the books for their membership type, and read them once paid. */
@Controller("library")
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.library.listForMember(user);
  }

  @Get(":id/file")
  async file(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: FastifyReply,
  ): Promise<StreamableFile> {
    const book = await this.library.openForMember(user, id);
    res.header("Content-Type", "application/pdf");
    res.header("Content-Disposition", `inline; filename="${encodeURIComponent(book.fileName)}"`);
    res.header("Cache-Control", "private, no-store");
    return new StreamableFile(createReadStream(book.absolutePath));
  }
}

@Roles("ADMIN")
@Controller("admin/library")
export class AdminLibraryController {
  constructor(private readonly library: LibraryService) {}

  @Get()
  list() {
    return this.library.adminList();
  }

  /**
   * multipart/form-data with the text fields (title, description, tiers as a
   * comma-separated list) sent BEFORE the file part.
   */
  @Post()
  async upload(@CurrentUser() actor: AuthenticatedUser, @Req() req: FastifyRequest) {
    const part = await req.file({ limits: { fileSize: MAX_BOOK_BYTES, files: 1 } });
    if (!part) throw new BadRequestException("No file uploaded");

    const field = (name: string): string | undefined => {
      const f = part.fields[name] as { value?: unknown } | undefined;
      return typeof f?.value === "string" ? f.value : undefined;
    };
    const meta = uploadMetaSchema.safeParse({
      title: field("title"),
      description: field("description") || undefined,
      tiers: field("tiers"),
    });
    if (!meta.success) {
      throw new BadRequestException(meta.error.issues[0]?.message ?? "Invalid book details");
    }

    let buffer: Buffer;
    try {
      buffer = await part.toBuffer();
    } catch {
      throw new BadRequestException("Books must be 50MB or smaller");
    }

    return this.library.adminUpload(
      actor,
      { title: meta.data.title, description: meta.data.description ?? null, tiers: meta.data.tiers },
      { filename: part.filename, buffer },
      context(req),
    );
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateSchema)) body: z.infer<typeof updateSchema>,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: FastifyRequest,
  ) {
    return this.library.adminUpdate(actor, id, body, context(req));
  }

  @Delete(":id")
  @HttpCode(204)
  async remove(@Param("id") id: string, @CurrentUser() actor: AuthenticatedUser, @Req() req: FastifyRequest) {
    await this.library.adminDelete(actor, id, context(req));
  }
}

function context(req: FastifyRequest) {
  const ua = req.headers["user-agent"];
  return { ipAddress: req.ip ?? null, userAgent: (Array.isArray(ua) ? ua[0] : ua) ?? null };
}
