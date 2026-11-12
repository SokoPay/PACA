import { randomBytes } from "crypto";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import PDFDocument from "pdfkit";
import { PrismaService } from "../common/prisma.service";
import { loadEnv } from "../config/env";

@Injectable()
export class CertificateService {
  private readonly logger = new Logger(CertificateService.name);

  constructor(private readonly prisma: PrismaService) {}

  private generateCredentialId(): string {
    // 8 chars from an unambiguous alphabet (no 0/O/1/I) — meant to be read aloud or retyped.
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = randomBytes(8);
    let code = "";
    for (const b of bytes) code += alphabet[b % alphabet.length];
    return `PACA-${code}`;
  }

  /**
   * Issues a completion certificate for a passed attempt. Idempotent — an
   * attempt can only ever have one certificate (Certificate.attemptId is
   * unique), so a second call for the same attempt just returns the first one.
   *
   * This is a Udemy-style "certificate of completion", not a formal PACA
   * certification: FREE_OPEN attempts have no tier, so `tier` and `designation`
   * are left null. Real MPACA/FPACA certification needs the paid, tier-gated
   * CERTIFICATION exam flow, which does not exist yet.
   */
  async issueForAttempt(attemptId: string) {
    const existing = await this.prisma.certificate.findUnique({ where: { attemptId } });
    if (existing) return existing;

    const attempt = await this.prisma.attempt.findUniqueOrThrow({
      where: { id: attemptId },
      include: { user: { select: { firstName: true, lastName: true } } },
    });

    let credentialId = this.generateCredentialId();
    // Vanishingly unlikely, but the field is unique — retry rather than crash.
    for (let attempts = 0; attempts < 5; attempts++) {
      const clash = await this.prisma.certificate.findUnique({ where: { credentialId } });
      if (!clash) break;
      credentialId = this.generateCredentialId();
    }

    return this.prisma.certificate.create({
      data: {
        userId: attempt.userId,
        attemptId: attempt.id,
        credentialId,
        tier: null,
        holderName: `${attempt.user.firstName} ${attempt.user.lastName}`,
        scoreBps: attempt.scoreBps,
        status: "VALID",
      },
    });
  }

  async listForUser(userId: string) {
    return this.prisma.certificate.findMany({ where: { userId }, orderBy: { issuedAt: "desc" } });
  }

  /** Public — no auth. Only what a verifier needs, nothing that identifies the account beyond the printed name. */
  async verify(credentialId: string) {
    const cert = await this.prisma.certificate.findUnique({ where: { credentialId } });
    if (!cert) throw new NotFoundException("No certificate found with that credential ID");

    return {
      credentialId: cert.credentialId,
      holderName: cert.holderName,
      tier: cert.tier,
      designation: cert.designation,
      scoreBps: cert.scoreBps,
      issuedAt: cert.issuedAt,
      status: cert.status,
      revokedReason: cert.status === "REVOKED" ? cert.revokedReason : null,
    };
  }

  async getOwned(userId: string, id: string) {
    const cert = await this.prisma.certificate.findUnique({ where: { id } });
    if (!cert || cert.userId !== userId) throw new NotFoundException("Certificate not found");
    return cert;
  }

  async getByCredentialId(credentialId: string) {
    const cert = await this.prisma.certificate.findUnique({ where: { credentialId } });
    if (!cert) throw new NotFoundException("No certificate found with that credential ID");
    return cert;
  }

  /** Rendered fresh on every request — cheap enough that caching isn't worth the storage bookkeeping yet. */
  renderPdf(cert: { holderName: string; credentialId: string; scoreBps: number | null; issuedAt: Date; tier: string | null }): PDFKit.PDFDocument {
    const env = loadEnv();
    const doc = new PDFDocument({ layout: "landscape", size: "A4", margin: 0 });

    const width = doc.page.width;
    const height = doc.page.height;
    const gold = "#c9a227";
    const ink = "#1f2937";

    doc.rect(0, 0, width, height).fill("#fdfaf3");
    doc.lineWidth(3).strokeColor(gold).rect(24, 24, width - 48, height - 48).stroke();
    doc.lineWidth(0.75).strokeColor(gold).rect(34, 34, width - 68, height - 68).stroke();

    doc
      .fillColor(ink)
      .font("Helvetica-Bold")
      .fontSize(14)
      .text("PROFESSIONAL AGILE CERTIFICATION — AFRICA", 0, 90, { align: "center" });

    doc.font("Helvetica").fontSize(22).fillColor(gold).text("Certificate of Completion", 0, 130, { align: "center" });

    doc.fillColor(ink).font("Helvetica").fontSize(13).text("This certifies that", 0, 190, { align: "center" });

    doc.font("Helvetica-Bold").fontSize(32).text(cert.holderName, 0, 220, { align: "center" });

    const title = cert.tier ? `the ${cert.tier} certification assessment` : "the PACA Open Assessment";
    doc.font("Helvetica").fontSize(14).text(`has successfully completed ${title}`, 0, 275, { align: "center" });

    if (cert.scoreBps !== null) {
      doc.fontSize(13).fillColor(gold).text(`Score: ${Math.round(cert.scoreBps / 100)}%`, 0, 305, { align: "center" });
    }

    doc
      .fillColor(ink)
      .fontSize(10)
      .text(`Issued ${cert.issuedAt.toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}`, 0, height - 110, {
        align: "center",
      });

    doc.font("Helvetica-Bold").fontSize(10).text(`Credential ID: ${cert.credentialId}`, 0, height - 90, { align: "center" });

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#6b7280")
      .text(`Verify at ${env.WEB_PUBLIC_URL}/verify/${cert.credentialId}`, 0, height - 72, { align: "center" });

    doc.end();
    return doc;
  }
}
