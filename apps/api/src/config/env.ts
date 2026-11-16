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
  /**
   * Shared store for rate-limit counters, so limits survive restarts and hold
   * across API instances. Unset = in-memory counters (fine for local dev).
   */
  REDIS_URL: z.string().url().optional(),
  /**
   * clamd for upload virus scanning. Optional: unset = uploads are stored
   * unscanned (PENDING). Set it to turn scanning on (e.g. on a larger server).
   */
  CLAMAV_HOST: z.string().optional(),
  CLAMAV_PORT: z.coerce.number().int().positive().default(3310),

  JWT_ACCESS_SECRET: z.string().min(MIN_SECRET_LENGTH, `must be at least ${MIN_SECRET_LENGTH} characters`),
  JWT_REFRESH_SECRET: z.string().min(MIN_SECRET_LENGTH, `must be at least ${MIN_SECRET_LENGTH} characters`),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("30d"),
  COOKIE_DOMAIN: z.string().default("127.0.0.1"),

  /** Where application documents are written. Point at a persistent volume in deployment. */
  UPLOAD_DIR: z.string().optional(),

  PAYSTACK_SECRET_KEY: z.string().optional(),
  /** Charge currency. Mobile money needs the account's local currency (GHS in Ghana). */
  PAYSTACK_CURRENCY: z.string().length(3).toUpperCase().default("GHS"),
  /** Local currency units per 1 USD — tier prices are stored in USD. Required unless charging in USD. */
  PAYSTACK_USD_RATE: z.coerce.number().positive().optional(),
  /** Payment methods offered in the popup; Paystack hides any the account/currency doesn't support. */
  PAYSTACK_CHANNELS: z.string().default("card,mobile_money,bank,bank_transfer"),
  /**
   * Email for verification codes — SMTP (e.g. Brevo's smtp-relay.brevo.com:2525)
   * or the Brevo HTTP API key. Neither set = codes are printed to the API log
   * instead of emailed (local development only).
   */
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(2525),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  BREVO_API_KEY: z.string().optional(),
  /** Must be a sender (or domain) verified in the Brevo account. SMTP_FROM is accepted as an alias. */
  MAIL_FROM_EMAIL: z.string().email().optional(),
  MAIL_FROM_NAME: z.string().default("PACA"),
  ANTHROPIC_API_KEY: z.string().optional(),
  /** Claude model used to classify crawled job postings (needs ANTHROPIC_API_KEY). */
  AI_MODEL: z.string().default("claude-opus-5-5"),
  /** Hours between job-board crawls. 0 turns the scheduled crawl off. */
  JOBS_CRAWL_HOURS: z.coerce.number().min(0).max(168).default(12),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached) return cached;

  // docker compose passes an unset `${VAR:-}` as "" — treat that as absent, not as
  // a value (z.coerce.number would otherwise read "" as 0 and fail the boot).
  const cleaned: Record<string, string | undefined> = Object.fromEntries(
    Object.entries(source).filter(([, v]) => v !== ""),
  );
  // Accept SMTP_FROM (the name other SokoPay apps use) for MAIL_FROM_EMAIL.
  cleaned.MAIL_FROM_EMAIL ??= cleaned.SMTP_FROM;
  const parsed = schema.safeParse(cleaned);

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
    if (parsed.data.JWT_ACCESS_SECRET.includes("CHANGE_ME") || parsed.data.JWT_REFRESH_SECRET.includes("CHANGE_ME")) {
      throw new Error("Refusing to start in production with placeholder JWT secrets");
    }
  }

  if (parsed.data.PAYSTACK_SECRET_KEY && parsed.data.PAYSTACK_CURRENCY !== "USD" && !parsed.data.PAYSTACK_USD_RATE) {
    throw new Error(`PAYSTACK_USD_RATE is required when PAYSTACK_CURRENCY is ${parsed.data.PAYSTACK_CURRENCY}`);
  }
  if (parsed.data.NODE_ENV === "production" && parsed.data.PAYSTACK_SECRET_KEY?.startsWith("sk_test_")) {
    // Allowed — the droplet is a test environment — but make it impossible to miss.
    console.warn("WARNING: running in production mode with a Paystack TEST key; no real money will move.");
  }

  const mailConfigured = Boolean(parsed.data.BREVO_API_KEY || parsed.data.SMTP_HOST);
  if (mailConfigured && !parsed.data.MAIL_FROM_EMAIL) {
    throw new Error("MAIL_FROM_EMAIL (or SMTP_FROM) is required when email is configured — a sender verified in Brevo");
  }
  if (parsed.data.NODE_ENV === "production" && !mailConfigured) {
    console.warn("WARNING: no SMTP_HOST or BREVO_API_KEY — verification codes are written to the API log, not emailed.");
  }

  // Scanning is optional (ClamAV needs ~1.5GB RAM, too much for the shared test
  // droplet). Uploads are still type-checked by file signature; they are stored
  // as PENDING ("Not scanned"). Say so loudly rather than silently.
  if (parsed.data.NODE_ENV === "production" && !parsed.data.CLAMAV_HOST) {
    console.warn("WARNING: CLAMAV_HOST is not set — uploaded documents are NOT virus-scanned.");
  }

  cached = parsed.data;
  return cached;
}

/** Test helper — clears the memoised config. */
export function resetEnvCache(): void {
  cached = null;
}
