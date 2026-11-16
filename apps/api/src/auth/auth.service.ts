import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { AuditService } from "../common/audit.service";
import { PasswordService } from "./password.service";
import { TokensService, type TokenPair } from "./tokens.service";
import { EmailVerificationService } from "./email-verification.service";
import { PasswordResetService } from "./password-reset.service";

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  acceptedTerms: boolean;
  marketingOptIn?: boolean;
}

export interface RequestContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

/** Lock an account after this many consecutive failures. */
/** 3 wrong passwords → locked for 30 minutes → one more wrong password → must reset the password. */
const MAX_FAILED_LOGINS = 3;
const LOCKOUT_MS = 30 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokensService,
    private readonly audit: AuditService,
    private readonly verification: EmailVerificationService,
    private readonly passwordReset: PasswordResetService,
  ) {}

  async register(input: RegisterInput, ctx: RequestContext) {
    const email = input.email.trim().toLowerCase();

    const existing = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      // Registration is one of the few places where leaking existence is
      // acceptable — the alternative silently swallows a genuine signup.
      throw new ConflictException("An account with that email already exists");
    }

    const passwordHash = await this.passwords.hash(input.password);

    // Every self-registration is a MEMBER. The first SUPERADMIN is promoted from
    // the server with `npm run db:promote -- <email> SUPERADMIN` — auto-promoting
    // the first registrant would hand a fresh public deployment to whoever reaches
    // the signup page first.
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        phone: input.phone?.trim() || null,
        // Free registration; membership is applied for separately and paid later.
        status: "PENDING_VERIFICATION",
        role: "MEMBER",
        marketingOptInAt: input.marketingOptIn ? new Date() : null,
        profile: { create: {} },
      },
      select: { id: true, email: true, role: true, firstName: true, lastName: true },
    });

    // Record consent against the CURRENT version of each required document, so the
    // exact text accepted is reconstructable years later.
    await this.recordConsent(user.id, ctx);

    await this.audit.record({
      actorUserId: user.id,
      action: "user.registered",
      entityType: "User",
      entityId: user.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    await this.verification.issueAfterRegistration(user.id);

    return user;
  }

  private async recordConsent(userId: string, ctx: RequestContext): Promise<void> {
    const current = await this.prisma.legalDocument.findMany({
      where: { isCurrent: true, type: { in: ["TERMS_AND_CONDITIONS", "PRIVACY_POLICY"] } },
      select: { id: true },
    });

    if (current.length === 0) return;

    await this.prisma.userConsent.createMany({
      data: current.map((doc) => ({
        userId,
        documentId: doc.id,
        ipAddress: ctx.ipAddress ?? null,
        userAgent: ctx.userAgent ?? null,
      })),
      skipDuplicates: true,
    });
  }

  async login(emailInput: string, password: string, ctx: RequestContext): Promise<TokenPair & { user: unknown }> {
    const email = emailInput.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        passwordHash: true,
        firstName: true,
        lastName: true,
        emailVerifiedAt: true,
        deletedAt: true,
        failedLoginCount: true,
        lockedUntil: true,
        passwordResetRequired: true,
      },
    });

    // Uniform failure message throughout — never reveal whether the email exists.
    const invalid = () => new UnauthorizedException("Invalid email or password");

    if (!user || user.deletedAt) {
      // Hash anyway so a missing account is not detectably faster than a wrong
      // password. Timing differences here are a real enumeration vector.
      await this.passwords.hash(password);
      throw invalid();
    }

    const resetNeeded = () =>
      new ForbiddenException(
        "For your security this account is locked. We have emailed you a link to reset your password — use “Forgot password?” to get a new one.",
      );

    if (user.passwordResetRequired) throw resetNeeded();

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
      throw new UnauthorizedException(
        `Too many wrong passwords. Your account is locked for ${mins} more minute${mins === 1 ? "" : "s"}, or reset your password with “Forgot password?”.`,
      );
    }

    const ok = await this.passwords.verify(user.passwordHash, password);

    if (!ok) {
      // A lock that has run out is still on record: guessing wrong again now
      // means the account only reopens through a password reset.
      if (user.lockedUntil) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { passwordResetRequired: true, lockedUntil: null, failedLoginCount: user.failedLoginCount + 1 },
        });
        await this.audit.record({
          actorUserId: user.id,
          action: "user.password_reset_required",
          entityType: "User",
          entityId: user.id,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        });
        await this.passwordReset.request(user.email, ctx, { force: true });
        throw resetNeeded();
      }

      const failures = user.failedLoginCount + 1;
      const lock = failures >= MAX_FAILED_LOGINS;
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: failures, lockedUntil: lock ? new Date(Date.now() + LOCKOUT_MS) : null },
      });
      if (lock) {
        await this.audit.record({
          actorUserId: user.id,
          action: "user.locked",
          entityType: "User",
          entityId: user.id,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        });
        throw new UnauthorizedException(
          "Too many wrong passwords. Your account is locked for 30 minutes. If you have forgotten your password, use “Forgot password?”.",
        );
      }
      throw invalid();
    }

    if (user.status === "SUSPENDED" || user.status === "DELETED") {
      throw new UnauthorizedException("Account is not active");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    const pair = await this.tokens.issuePair({ id: user.id, email: user.email, role: user.role }, ctx);

    await this.audit.record({
      actorUserId: user.id,
      action: "user.login",
      entityType: "User",
      entityId: user.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return {
      ...pair,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        emailVerifiedAt: user.emailVerifiedAt,
      },
    };
  }

  async refresh(token: string, ctx: RequestContext): Promise<TokenPair> {
    return this.tokens.rotate(token, ctx);
  }

  async logout(token: string): Promise<void> {
    await this.tokens.revoke(token);
  }

  async me(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        status: true,
        emailVerifiedAt: true,
        createdAt: true,
        profile: true,
        membership: {
          select: {
            memberNumber: true,
            tier: true,
            status: true,
            currentPeriodEnd: true,
          },
        },
      },
    });
  }
}
