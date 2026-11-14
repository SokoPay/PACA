import { BadRequestException, HttpException, HttpStatus, Injectable, Logger } from "@nestjs/common";
import { createHash, randomBytes, randomInt, timingSafeEqual } from "crypto";
import { PrismaService } from "../common/prisma.service";
import { AuditService } from "../common/audit.service";
import { MailService } from "../common/mail.service";

const CODE_TTL_MS = 15 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
/** A 6-digit code has 10^6 values; 5 guesses per code is a 0.0005% chance. */
const MAX_GUESSES = 5;

function hashCode(salt: string, code: string): string {
  return createHash("sha256").update(`${salt}:${code}`).digest("hex");
}

/**
 * Six-digit email verification codes, sent through Brevo.
 *
 * Stored as OneTimeToken rows (purpose EMAIL_VERIFICATION) holding only a salted
 * hash. Issuing a new code deletes the old ones, so exactly one code is live.
 */
@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
  ) {}

  async issue(userId: string, opts: { enforceCooldown: boolean }): Promise<{ sentTo: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true, emailVerifiedAt: true },
    });
    if (!user) throw new BadRequestException("Account not found");
    if (user.emailVerifiedAt) throw new BadRequestException("Your email address is already verified");

    if (opts.enforceCooldown) {
      const latest = await this.prisma.oneTimeToken.findFirst({
        where: { userId, purpose: "EMAIL_VERIFICATION" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      const wait = latest ? RESEND_COOLDOWN_MS - (Date.now() - latest.createdAt.getTime()) : 0;
      if (wait > 0) {
        throw new HttpException(
          `Please wait ${Math.ceil(wait / 1000)} seconds before requesting another code`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const salt = randomBytes(16).toString("hex");

    await this.prisma.$transaction([
      this.prisma.oneTimeToken.deleteMany({ where: { userId, purpose: "EMAIL_VERIFICATION" } }),
      this.prisma.oneTimeToken.create({
        data: {
          userId,
          purpose: "EMAIL_VERIFICATION",
          // "salt:hash" — the salt keeps the column unique even if two users draw the same code.
          tokenHash: `${salt}:${hashCode(salt, code)}`,
          expiresAt: new Date(Date.now() + CODE_TTL_MS),
        },
      }),
    ]);

    await this.mail.send({
      to: { email: user.email, name: user.firstName },
      subject: `${code} is your PACA verification code`,
      text: [
        `Hello ${user.firstName},`,
        "",
        `Your PACA verification code is: ${code}`,
        "",
        "It expires in 15 minutes. If you did not create a PACA account, ignore this email.",
      ].join("\n"),
      html: verificationHtml(user.firstName, code),
    });

    return { sentTo: user.email };
  }

  /** Called right after registration. A mail outage must not fail the signup — the member can resend. */
  async issueAfterRegistration(userId: string): Promise<void> {
    try {
      await this.issue(userId, { enforceCooldown: false });
    } catch (err) {
      this.logger.error(`Could not send the verification code after registration: ${(err as Error).message}`);
    }
  }

  async verify(userId: string, code: string, ctx: { ipAddress?: string | null; userAgent?: string | null }) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { emailVerifiedAt: true, status: true },
    });
    if (!user) throw new BadRequestException("Account not found");
    if (user.emailVerifiedAt) return { verified: true };

    const token = await this.prisma.oneTimeToken.findFirst({
      where: { userId, purpose: "EMAIL_VERIFICATION", usedAt: null },
      orderBy: { createdAt: "desc" },
    });
    if (!token || token.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException("This code has expired. Request a new one.");
    }
    if (token.attempts >= MAX_GUESSES) {
      throw new BadRequestException("Too many incorrect attempts. Request a new code.");
    }

    const [salt, expected = ""] = token.tokenHash.split(":");
    const actual = hashCode(salt, code.trim());
    const match = expected.length === actual.length && timingSafeEqual(Buffer.from(expected), Buffer.from(actual));

    if (!match) {
      const updated = await this.prisma.oneTimeToken.update({
        where: { id: token.id },
        data: { attempts: { increment: 1 } },
        select: { attempts: true },
      });
      const left = MAX_GUESSES - updated.attempts;
      throw new BadRequestException(
        left > 0
          ? `Incorrect code. ${left} attempt${left === 1 ? "" : "s"} left.`
          : "Too many incorrect attempts. Request a new code.",
      );
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.oneTimeToken.update({ where: { id: token.id }, data: { usedAt: now } }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          emailVerifiedAt: now,
          ...(user.status === "PENDING_VERIFICATION" ? { status: "ACTIVE" as const } : {}),
        },
      }),
    ]);

    await this.audit.record({
      actorUserId: userId,
      action: "user.email_verified",
      entityType: "User",
      entityId: userId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return { verified: true };
  }
}

function verificationHtml(firstName: string, code: string): string {
  const name = firstName.replace(/[<>&"]/g, "");
  return `<!doctype html><html><body style="margin:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#1f2933">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:12px;padding:32px">
<tr><td style="font-size:22px;font-weight:bold;color:#0f766e">PACA</td></tr>
<tr><td style="padding-top:16px;font-size:15px;line-height:1.5">Hello ${name},<br><br>Use this code to verify your email address:</td></tr>
<tr><td align="center" style="padding:24px 0"><div style="display:inline-block;font-size:32px;letter-spacing:8px;font-weight:bold;background:#f0fdfa;color:#0f766e;padding:12px 24px;border-radius:8px">${code}</div></td></tr>
<tr><td style="font-size:13px;line-height:1.5;color:#52606d">The code expires in 15 minutes. If you did not create a PACA account, you can ignore this email.</td></tr>
</table></td></tr></table></body></html>`;
}
