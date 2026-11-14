import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { UserRole } from "@prisma/client";
import { PrismaService } from "../common/prisma.service";
import { loadEnv } from "../config/env";

/** See rotate(): a reuse this soon after rotation is a client race, not theft. */
const REUSE_GRACE_MS = 20_000;

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

/** Refresh tokens are opaque random strings; only their hash is stored. */
function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function parseDuration(spec: string): number {
  const m = spec.match(/^(\d+)([smhd])$/);
  if (!m) throw new Error(`Invalid duration: ${spec}`);
  const n = Number(m[1]);
  const unit = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2]]!;
  return n * unit;
}

@Injectable()
export class TokensService {
  private readonly logger = new Logger(TokensService.name);
  private readonly env = loadEnv();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async issuePair(
    user: { id: string; email: string; role: UserRole },
    context: { ipAddress?: string | null; userAgent?: string | null },
    /** Continue an existing rotation family, or start a new one. */
    family: string = randomUUID(),
  ): Promise<TokenPair> {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, role: user.role } satisfies AccessTokenPayload,
      // `expiresIn` is typed as a literal duration union; ours comes from validated
      // config, so the cast is safe and keeps the TTL configurable.
      { secret: this.env.JWT_ACCESS_SECRET, expiresIn: this.env.JWT_ACCESS_TTL as `${number}${"s" | "m" | "h" | "d"}` },
    );

    const refreshToken = randomBytes(48).toString("base64url");
    const expiresAt = new Date(Date.now() + parseDuration(this.env.JWT_REFRESH_TTL));

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(refreshToken),
        family,
        expiresAt,
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null,
      },
    });

    return { accessToken, refreshToken, expiresAt };
  }

  /**
   * Rotate a refresh token.
   *
   * Reuse detection: presenting a token that has already been revoked means it was
   * captured and replayed, so the ENTIRE family is revoked. That logs out the
   * attacker and the legitimate user together — which is correct, because we cannot
   * tell which of the two is presenting it.
   */
  async rotate(
    presentedToken: string,
    context: { ipAddress?: string | null; userAgent?: string | null },
  ): Promise<TokenPair> {
    const tokenHash = sha256(presentedToken);

    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, email: true, role: true, status: true, deletedAt: true } } },
    });

    if (!existing) throw new UnauthorizedException("Invalid refresh token");

    // Grace window: two tabs (or a double-fired request) refreshing the same token
    // within seconds is the browser racing itself, not theft. Refuse the late one
    // without revoking the family — the client re-reads the successor and retries.
    if (existing.revokedAt && Date.now() - existing.revokedAt.getTime() < REUSE_GRACE_MS) {
      throw new UnauthorizedException("Refresh token already rotated");
    }

    if (existing.revokedAt) {
      this.logger.warn(
        `Refresh token reuse detected for user=${existing.userId} family=${existing.family}; revoking family`,
      );
      await this.prisma.refreshToken.updateMany({
        where: { family: existing.family, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException("Refresh token reuse detected; all sessions revoked");
    }

    if (existing.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException("Refresh token expired");
    }

    if (existing.user.deletedAt || existing.user.status === "SUSPENDED" || existing.user.status === "DELETED") {
      throw new UnauthorizedException("Account is not active");
    }

    // Revoke the presented token, then mint its successor in the same family. The
    // conditional update is the atomic claim: two concurrent rotations of the same
    // token cannot both see revokedAt = null and each mint a live successor.
    const claimed = await this.prisma.refreshToken.updateMany({
      where: { id: existing.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (claimed.count === 0) {
      throw new UnauthorizedException("Refresh token already rotated");
    }

    return this.issuePair(existing.user, context, existing.family);
  }

  /** Revoke a single session (logout). Silent if the token is unknown. */
  async revoke(presentedToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(presentedToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Revoke every session for a user (password change, admin action). */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    try {
      return await this.jwt.verifyAsync<AccessTokenPayload>(token, { secret: this.env.JWT_ACCESS_SECRET });
    } catch {
      throw new UnauthorizedException("Invalid or expired access token");
    }
  }
}
