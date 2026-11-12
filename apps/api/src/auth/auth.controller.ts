import { Body, Controller, Get, HttpCode, Post, Req, UnauthorizedException } from "@nestjs/common";
import { RouteConfig } from "@nestjs/platform-fastify";
import { z } from "zod";
import { AuthService } from "./auth.service";
import { Public } from "../common/decorators/public.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

/**
 * Password policy: length beats composition rules. NIST guidance is explicit that
 * forced symbol/digit mixes produce predictable passwords ("Password1!") without
 * meaningfully raising entropy.
 */
const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .max(200, "Password must be at most 200 characters");

const registerSchema = z.object({
  email: z.string().email().max(320),
  password: passwordSchema,
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().max(40).optional(),
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: "You must accept the Terms and Privacy Policy to register" }),
  }),
  // Deliberately separate from acceptedTerms — bundling the two is not valid consent.
  marketingOptIn: z.boolean().default(false),
});

const loginSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(200),
});

const refreshSchema = z.object({ refreshToken: z.string().min(1) });

/**
 * Per-IP limits for the unauthenticated credential endpoints, far tighter than
 * the global 300/min. Account lockout alone stops guessing against one account
 * but not password spraying across many, and register would otherwise be an
 * unbounded account-creation endpoint.
 */
const STRICT_LIMIT = { rateLimit: { max: 10, timeWindow: "1 minute" } };
const REFRESH_LIMIT = { rateLimit: { max: 30, timeWindow: "1 minute" } };

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @RouteConfig(STRICT_LIMIT)
  @Post("register")
  register(
    @Body(new ZodValidationPipe(registerSchema)) body: z.infer<typeof registerSchema>,
    @Req() req: { ip?: string; headers: Record<string, string | undefined> },
  ) {
    return this.auth.register(body, context(req));
  }

  @Public()
  @RouteConfig(STRICT_LIMIT)
  @Post("login")
  @HttpCode(200)
  login(
    @Body(new ZodValidationPipe(loginSchema)) body: z.infer<typeof loginSchema>,
    @Req() req: { ip?: string; headers: Record<string, string | undefined> },
  ) {
    return this.auth.login(body.email, body.password, context(req));
  }

  @Public()
  @RouteConfig(REFRESH_LIMIT)
  @Post("refresh")
  @HttpCode(200)
  refresh(
    @Body(new ZodValidationPipe(refreshSchema)) body: z.infer<typeof refreshSchema>,
    @Req() req: { ip?: string; headers: Record<string, string | undefined> },
  ) {
    return this.auth.refresh(body.refreshToken, context(req));
  }

  @Public()
  @Post("logout")
  @HttpCode(204)
  async logout(@Body(new ZodValidationPipe(refreshSchema)) body: z.infer<typeof refreshSchema>) {
    await this.auth.logout(body.refreshToken);
  }

  @Get("me")
  async me(@CurrentUser() user: AuthenticatedUser) {
    const found = await this.auth.me(user.id);
    if (!found) throw new UnauthorizedException("Account not found");
    return found;
  }
}

function context(req: { ip?: string; headers: Record<string, string | undefined> }) {
  return { ipAddress: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null };
}
