import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { UserRole } from "@prisma/client";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { TokensService } from "../../auth/tokens.service";
import { PrismaService } from "../prisma.service";

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
}

/**
 * Applied globally — every route requires authentication unless marked @Public().
 *
 * Fail-closed by default: a new controller added without thinking about auth is
 * protected, not exposed. The reverse default is how endpoints leak.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokensService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const header: string | undefined = request.headers?.authorization;

    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token");
    }

    const payload = await this.tokens.verifyAccessToken(header.slice(7));

    // Re-read the user rather than trusting the token's claims. A role revoked or
    // an account suspended thirty seconds ago must take effect now, not in fifteen
    // minutes when the access token happens to expire.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, status: true, deletedAt: true },
    });

    // PENDING_VERIFICATION is a normal state for a new account and must pass —
    // auth.service.ts's login() already allows it through for the same reason.
    // Only a suspended or deleted account is actually blocked here.
    if (!user || user.deletedAt || user.status === "SUSPENDED" || user.status === "DELETED") {
      throw new UnauthorizedException("Account is not active");
    }

    request.user = { id: user.id, email: user.email, role: user.role } satisfies AuthenticatedUser;
    return true;
  }
}
