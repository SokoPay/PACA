/**
 * Environment validation.
 *
 * Parsed once at boot and the process refuses to start on anything invalid. A
 * missing JWT secret should crash the container immediately, not surface later as
 * tokens signed with `undefined`.
 */
import { z } from "zod";

const MIN_SECRET_LENGTH = 32;

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  API_PUBLIC_URL: z.string().url(),
  WEB_PUBLIC_URL: z.string().url(),
  /**
   * Comma-separated allowed browser origins. Defaults to WEB_PUBLIC_URL.
   * In development this needs both `localhost` and `127.0.0.1` — they are distinct
   * origins, and Next dev and the browser disagree about which one to use.
   */
  CORS_ORIGINS: z.string().optional(),

  DATABASE_URL: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(MIN_SECRET_LENGTH, `must be at least ${MIN_SECRET_LENGTH} characters`),
  JWT_REFRESH_SECRET: z.string().min(MIN_SECRET_LENGTH, `must be at least ${MIN_SECRET_LENGTH} characters`),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("30d"),
  COOKIE_DOMAIN: z.string().default("127.0.0.1"),

  PAYSTACK_SECRET_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default("claude-sonnet-5"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached) return cached;

  const parsed = schema.safeParse(source);

  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  // The two JWT secrets must differ. If they match, a refresh token is a valid
  // access token — a full privilege escalation from a single leaked cookie.
  if (parsed.data.JWT_ACCESS_SECRET === parsed.data.JWT_REFRESH_SECRET) {
    throw new Error("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different values");
  }

  if (parsed.data.NODE_ENV === "production") {
    if (parsed.data.JWT_ACCESS_SECRET.includes("CHANGE_ME")) {
      throw new Error("Refusing to start in production with placeholder JWT secrets");
    }
  }

  cached = parsed.data;
  return cached;
}

/** Test helper — clears the memoised config. */
export function resetEnvCache(): void {
  cached = null;
}
