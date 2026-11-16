import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { createHash, randomBytes } from "crypto";
import { PrismaService } from "../common/prisma.service";
import { AuditService } from "../common/audit.service";
import { MailService } from "../common/mail.service";
import { brandedEmail } from "../common/branded-email";
import { loadEnv } from "../config/env";
import { PasswordService } from "./password.service";
import { TokensService } from "./tokens.service";

const LINK_TTL_MS = 30 * 60 * 1000;
const REQUEST_COOLDOWN_MS = 60 * 1000;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** "kofi.mensah@gmail.com" → "ko•••••@gmail.com", so the page can confirm the right account without exposing it. */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 2)}${"•".repeat(Math.max(3, local.length - 2))}@${domain}`;
}

export interface RequestContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Forgotten-password recovery by emailed link.
 *
 * - The link carries 32 random bytes; only its SHA-256 is stored (OneTimeToken,
 *   purpose PASSWORD_RESET), so a database leak cannot be used to reset anyone.
 * - Links expire after 30 minutes and work once. Requesting a new link kills older ones.
 * - The request endpoint answers the same way whether or not the email is
 *   registered, so it cannot be used to find out who has a PACA account.
 * - A successful reset signs the account out everywhere, clears any lockout and
 *   emails a "your password was changed" notice.
 */
@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);
  private readonly env = loadEnv();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokensService,
  ) {}

  async request(emailInput: string, ctx: RequestContext): Promise<{ ok: true }> {
    const email = emailInput.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, firstName: true, deletedAt: true, status: true },
    });
    if (!user || user.deletedAt || user.status === "DELETED") return { ok: true };

    const latest = await this.prisma.oneTimeToken.findFirst({
      where: { userId: user.id, purpose: "PASSWORD_RESET" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    // Quietly ignore rapid repeats: same answer to the caller, no email flood.
    if (latest && Date.now() - latest.createdAt.getTime() < REQUEST_COOLDOWN_MS) return { ok: true };

    const token = randomBytes(32).toString("base64url");
    await this.prisma.$transaction([
      this.prisma.oneTimeToken.deleteMany({ where: { userId: user.id, purpose: "PASSWORD_RESET" } }),
      this.prisma.oneTimeToken.create({
        data: {
          userId: user.id,
          purpose: "PASSWORD_RESET",
          tokenHash: sha256(token),
          expiresAt: new Date(Date.now() + LINK_TTL_MS),
        },
      }),
    ]);

    const link = `${this.env.WEB_PUBLIC_URL.replace(/\/$/, "")}/reset-password?token=${token}`;
    const { html, text } = brandedEmail({
      firstName: user.firstName,
      heading: "Reset your PACA password",
      paragraphs: [
        "We received a request to reset the password for your PACA account. Click the button below to choose a new password.",
        "The link works once and expires in 30 minutes. If you did not ask for this, you can ignore this email — your password will not change.",
      ],
      cta: { label: "Choose a new password", url: link },
    });
    try {
      await this.mail.send({ to: { email: user.email, name: user.firstName }, subject: "Reset your PACA password", html, text });
    } catch (err) {
      this.logger.error(`Could not send password reset email: ${(err as Error).message}`);
    }

    await this.audit.record({
      actorUserId: user.id,
      action: "user.password_reset_requested",
      entityType: "User",
      entityId: user.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    return { ok: true };
  }

  private async findLiveToken(token: string) {
    const row = await this.prisma.oneTimeToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!row || row.purpose !== "PASSWORD_RESET" || row.usedAt || row.expiresAt.getTime() < Date.now()) return null;
    const user = await this.prisma.user.findUnique({
      where: { id: row.userId },
      select: { id: true, email: true, firstName: true, deletedAt: true, emailVerifiedAt: true },
    });
    if (!user || user.deletedAt) return null;
    return { ...row, user };
  }

  /** Lets the reset page show "link expired" before the member types a new password. */
  async check(token: string): Promise<{ valid: boolean; email?: string }> {
    const row = await this.findLiveToken(token);
    return row ? { valid: true, email: maskEmail(row.user.email) } : { valid: false };
  }

  async reset(token: string, newPassword: string, ctx: RequestContext): Promise<{ ok: true; email: string }> {
    const row = await this.findLiveToken(token);
    if (!row) throw new BadRequestException("This reset link is invalid or has expired. Please request a new one.");

    const passwordHash = await this.passwords.hash(newPassword);
    // Claim the token atomically so two submissions of the same link cannot both succeed.
    const claimed = await this.prisma.oneTimeToken.updateMany({
      where: { id: row.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claimed.count === 0) throw new BadRequestException("This reset link has already been used. Please request a new one.");

    await this.prisma.user.update({
      where: { id: row.user.id },
      data: {
        passwordHash,
        failedLoginCount: 0,
        lockedUntil: null,
        // Opening a link sent to this address proves the member owns it.
        emailVerifiedAt: row.user.emailVerifiedAt ?? new Date(),
      },
    });
    await this.tokens.revokeAllForUser(row.user.id);

    await this.audit.record({
      actorUserId: row.user.id,
      action: "user.password_reset",
      entityType: "User",
      entityId: row.user.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    const { html, text } = brandedEmail({
      firstName: row.user.firstName,
      heading: "Your PACA password was changed",
      paragraphs: [
        "The password for your PACA account was just changed, and you were signed out on all devices.",
        "If this was you, no action is needed. If it was not you, reset your password straight away and contact PACA.",
      ],
      cta: { label: "Sign in", url: `${this.env.WEB_PUBLIC_URL.replace(/\/$/, "")}/login` },
    });
    await this.mail
      .send({ to: { email: row.user.email, name: row.user.firstName }, subject: "Your PACA password was changed", html, text })
      .catch((err) => this.logger.warn(`Could not send password-changed notice: ${(err as Error).message}`));

    return { ok: true, email: row.user.email };
  }
}
