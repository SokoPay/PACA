import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { UserRole } from "@prisma/client";
import { ROLES_KEY } from "../decorators/roles.decorator";
import type { AuthenticatedUser } from "./jwt-auth.guard";

/**
 * Role hierarchy. A higher role satisfies any requirement met by a lower one, so
 * @Roles("REVIEWER") admits ADMIN and SUPERADMIN without listing them everywhere —
 * the kind of omission that otherwise locks admins out of their own tooling.
 */
const RANK: Record<UserRole, number> = {
  MEMBER: 0,
  REVIEWER: 1,
  ADMIN: 2,
  SUPERADMIN: 3,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required?.length) return true;

    const user: AuthenticatedUser | undefined = context.switchToHttp().getRequest().user;
    if (!user) throw new ForbiddenException("Not authenticated");

    const needed = Math.min(...required.map((r) => RANK[r]));
    if (RANK[user.role] < needed) {
      throw new ForbiddenException("Insufficient permissions");
    }

    return true;
  }
}
