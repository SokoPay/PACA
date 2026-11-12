import { promises as fs } from "fs";
import * as path from "path";
import { randomUUID, createHash } from "crypto";
import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import type { DocumentKind } from "@prisma/client";
import { PrismaService } from "../common/prisma.service";
import { AuditService } from "../common/audit.service";
import { VirusScanService } from "../common/virus-scan.service";

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

/**
 * Root for locally stored uploads. UPLOAD_DIR points it at a persistent volume in
 * deployment; the default (relative to apps/api's cwd) suits local dev.
 */
const UPLOAD_ROOT = path.join(path.resolve(process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads")), "applications");

/**
 * Detects the real type from the file's leading bytes. The client-declared
 * mimetype and filename are attacker-controlled: without this, an HTML or SVG
 * file labelled "application/pdf" would be stored and later served to a
 * reviewer's browser.
 */
function sniffType(buffer: Buffer): "application/pdf" | "image/png" | "image/jpeg" | null {
  if (buffer.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  return null;
}

const EXTENSION: Record<string, string> = { "application/pdf": ".pdf", "image/png": ".png", "image/jpeg": ".jpg" };

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly scanner: VirusScanService,
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

    if (file.buffer.length === 0) throw new BadRequestException("The uploaded file is empty");
    if (file.buffer.length > MAX_BYTES) throw new BadRequestException("Files must be 8MB or smaller");
    const mimeType = sniffType(file.buffer);
    if (!mimeType || !ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new BadRequestException("Only PDF, JPEG or PNG files are accepted");
    }

    // Scan before anything touches disk. A scanner failure rejects the upload
    // (fail closed) rather than storing a file nobody has checked.
    let scan;
    try {
      scan = await this.scanner.scan(file.buffer);
    } catch (err) {
      this.logger.error(`Virus scan failed: ${err instanceof Error ? err.message : String(err)}`);
      throw new ServiceUnavailableException("File scanning is temporarily unavailable. Please try again in a few minutes.");
    }
    if (scan.status === "INFECTED") {
      await this.audit.record({
        actorUserId: userId,
        action: "application.document_infected",
        entityType: "MembershipApplication",
        entityId: applicationId,
        metadata: { kind, signature: scan.signature },
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      throw new BadRequestException("This file failed a virus scan and was not uploaded.");
    }

    const existing = await this.prisma.applicationDocument.findFirst({ where: { applicationId, kind } });

    const storageKey = path.join(applicationId, `${kind}-${randomUUID()}${EXTENSION[mimeType]}`);
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
          mimeType,
          sizeBytes: file.buffer.length,
          checksum,
          // Infected files never get this far. PENDING = no scanner configured
          // (local dev only; production refuses to boot without CLAMAV_HOST).
          scanStatus: scan.status === "CLEAN" ? "CLEAN" : "PENDING",
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
