import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AuthenticatedUser } from "../guards/jwt-auth.guard";

/** Injects the authenticated user attached by JwtAuthGuard. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
  return ctx.switchToHttp().getRequest().user;
});
