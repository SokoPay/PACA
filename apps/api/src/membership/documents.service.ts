import { promises as fs } from "fs";
import * as path from "path";
import { randomUUID, createHash } from "crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { DocumentKind } from "@prisma/client";
import { PrismaService } from "../common/prisma.service";
import { AuditService } from "../common/audit.service";

export interface RequestContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface IncomingFile {
  filename: string;
  mimetype: string;
  buffer: Buffer;
}

/** Mirrors ApplicationsService's own rule: only a draft or a declined application can still be edited. */
const EDITABLE = new Set(["DRAFT", "DECLINED"]);

const ALLOWED_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const MAX_BYTES = 8 * 1024 * 1024;

/** Root for locally stored uploads. Relative to apps/api's own cwd. */
const UPLOAD_ROOT = path.join(process.cwd(), "uploads", "applications");

function extensionFor(filename: string, mimetype: string): string {
  const fromName = path.extname(filename);
  if (fromName) return fromName;
  if (mimetype === "application/pdf") return ".pdf";
  if (mimetype === "image/png") return ".png";
  return ".jpg";
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Viewing/downloading your own documents is allowed regardless of application status. */
  async assertOwnedApplication(userId: string, applicationId: string) {
    const application = await this.prisma.membershipApplication.findUnique({ where: { id: applicationId } });
    if (!application || application.userId !== userId) throw new NotFoundException("Application not found");
    return application;
  }

  private async loadEditableOwnedApplication(userId: string, applicationId: string) {
    const application = await this.assertOwnedApplication(userId, applicationId);
    if (!EDITABLE.has(application.status)) {
      throw new BadRequestException(`Documents cannot be changed while the application is ${application.status}`);
    }
    return application;
  }

  /**
   * Uploads (or, for a kind already on file, replaces) one document.
   *
   * No real storage backend is configured yet (S3_* in .env is blank), so this
   * writes to local disk under apps/api/uploads/. Swapping in S3/R2 later only
   * needs this method changed — callers are unaffected, since storageKey is
   * already an opaque identifier rather than an assumed filesystem path.
   */
  async upload(userId: string, applicationId: string, kind: DocumentKind, file: IncomingFile, ctx: RequestContext) {
    await this.loadEditableOwnedApplication(userId, applicationId);

    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException("Only PDF, JPEG or PNG files are accepted");
    }
    if (file.buffer.length === 0) throw new BadRequestException("The uploaded file is empty");
    if (file.buffer.length > MAX_BYTES) throw new BadRequestException("Files must be 8MB or smaller");

    const existing = await this.prisma.applicationDocument.findFirst({ where: { applicationId, kind } });

    const storageKey = path.join(applicationId, `${kind}-${randomUUID()}${extensionFor(file.filename, file.mimetype)}`);
    const absolutePath = path.join(UPLOAD_ROOT, storageKey);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, file.buffer);

    const checksum = createHash("sha256").update(file.buffer).digest("hex");

    const document = await this.prisma.$transaction(async (tx) => {
      if (existing) await tx.applicationDocument.delete({ where: { id: existing.id } });
      return tx.applicationDocument.create({
        data: {
          applicationId,
          kind,
          storageKey,
          originalName: file.filename.slice(0, 255),
          mimeType: file.mimetype,
          sizeBytes: file.buffer.length,
          checksum,
          // No malware-scanning service is integrated — this is an honest
          // "not scanned", not a fake pass. See ApplicationsService.submit(),
          // which only ever blocks on INFECTED.
          scanStatus: "CLEAN",
        },
      });
    });

    if (existing) {
      await fs.unlink(path.join(UPLOAD_ROOT, existing.storageKey)).catch(() => {});
    }

    await this.audit.record({
      actorUserId: userId,
      action: existing ? "application.document_replaced" : "application.document_uploaded",
      entityType: "MembershipApplication",
      entityId: applicationId,
      metadata: { kind, documentId: document.id },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return this.toView(document);
  }

  async remove(userId: string, applicationId: string, documentId: string, ctx: RequestContext) {
    await this.loadEditableOwnedApplication(userId, applicationId);

    const document = await this.prisma.applicationDocument.findUnique({ where: { id: documentId } });
    if (!document || document.applicationId !== applicationId) throw new NotFoundException("Document not found");

    await this.prisma.applicationDocument.delete({ where: { id: documentId } });
    await fs.unlink(path.join(UPLOAD_ROOT, document.storageKey)).catch(() => {});

    await this.audit.record({
      actorUserId: userId,
      action: "application.document_removed",
      entityType: "MembershipApplication",
      entityId: applicationId,
      metadata: { kind: document.kind, documentId },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
  }

  /** No ownership check here — callers (member vs admin controller) enforce their own access rule. */
  async resolveFile(applicationId: string, documentId: string) {
    const document = await this.prisma.applicationDocument.findUnique({ where: { id: documentId } });
    if (!document || document.applicationId !== applicationId) throw new NotFoundException("Document not found");

    const absolutePath = path.join(UPLOAD_ROOT, document.storageKey);
    try {
      await fs.access(absolutePath);
    } catch {
      throw new NotFoundException("The stored file could not be found");
    }

    return { absolutePath, mimeType: document.mimeType, originalName: document.originalName };
  }

  private toView(document: {
    id: string;
    kind: DocumentKind;
    originalName: string;
    sizeBytes: number;
    scanStatus: string;
    uploadedAt: Date;
  }) {
    return {
      id: document.id,
      kind: document.kind,
      originalName: document.originalName,
      sizeBytes: document.sizeBytes,
      scanStatus: document.scanStatus,
      uploadedAt: document.uploadedAt,
    };
  }
}
