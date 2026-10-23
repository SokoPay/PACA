/**
 * Anthropic-backed generation and review provider.
 *
 * Deliberately uses fetch rather than an SDK — one less dependency in the path that
 * touches an API key, and the Messages API surface we need is small.
 *
 * Implements both GenerationProvider and ReviewProvider, but you should construct
 * TWO instances with different models where budget allows: a cheaper model drafts,
 * a stronger one reviews. The reviewer is the one protecting the credential.
 */
import type { GenerationProvider, GenerationRequest } from "./generator.ts";
import type { ReviewProvider } from "./review.ts";

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";

export interface AnthropicOptions {
  apiKey: string;
  /** e.g. "claude-sonnet-5" for drafting, "claude-opus-5" for review. */
  model?: string;
  maxTokens?: number;
  /** Low temperature for review; a little higher for drafting variety. */
  temperature?: number;
  maxRetries?: number;
  fetchImpl?: typeof fetch;
}

interface AnthropicContentBlock {
  type: string;
  text?: string;
}

interface AnthropicResponse {
  content?: AnthropicContentBlock[];
  stop_reason?: string;
}

export class AnthropicProvider implements GenerationProvider, ReviewProvider {
  readonly name: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly temperature: number;
  private readonly maxRetries: number;
  private readonly doFetch: typeof fetch;

  constructor(opts: AnthropicOptions) {
    if (!opts.apiKey) throw new Error("AnthropicProvider requires an apiKey");
    this.apiKey = opts.apiKey;
    this.model = opts.model ?? "claude-sonnet-5";
    this.maxTokens = opts.maxTokens ?? 8000;
    this.temperature = opts.temperature ?? 0.7;
    this.maxRetries = opts.maxRetries ?? 3;
    this.doFetch = opts.fetchImpl ?? globalThis.fetch;
    this.name = `anthropic:${this.model}`;
  }

  async complete(prompt: string): Promise<string> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const res = await this.doFetch(API_URL, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": this.apiKey,
            "anthropic-version": API_VERSION,
          },
          body: JSON.stringify({
            model: this.model,
            max_tokens: this.maxTokens,
            temperature: this.temperature,
            messages: [{ role: "user", content: prompt }],
          }),
        });

        // 429 and 5xx are worth retrying; 4xx is a bug in our request.
        if (res.status === 429 || res.status >= 500) {
          lastError = new Error(`Anthropic API ${res.status}: ${await safeText(res)}`);
          if (attempt < this.maxRetries) {
            await sleep(backoffMs(attempt, res.headers.get("retry-after")));
            continue;
          }
          throw lastError;
        }

        if (!res.ok) {
          throw new Error(`Anthropic API ${res.status}: ${await safeText(res)}`);
        }

        const body = (await res.json()) as AnthropicResponse;

        if (body.stop_reason === "max_tokens") {
          throw new Error(
            "Response hit the max_tokens limit and is truncated — reduce the batch size or raise maxTokens.",
          );
        }

        const text = (body.content ?? [])
          .filter((b) => b.type === "text" && typeof b.text === "string")
          .map((b) => b.text)
          .join("");

        if (!text.trim()) throw new Error("Anthropic returned an empty response");
        return text;
      } catch (err) {
        lastError = err;
        // Network-level failures are retryable too.
        if (attempt < this.maxRetries && isRetryable(err)) {
          await sleep(backoffMs(attempt, null));
          continue;
        }
        throw err;
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  /** GenerationProvider — the request is already baked into the prompt. */
  async generate(prompt: string, _request: GenerationRequest): Promise<string> {
    return this.complete(prompt);
  }
}

function isRetryable(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return /fetch failed|network|ECONNRESET|ETIMEDOUT|socket hang up|429|5\d\d/i.test(err.message);
}

/** Exponential backoff with jitter; honours Retry-After when the API sends one. */
function backoffMs(attempt: number, retryAfter: string | null): number {
  if (retryAfter) {
    const secs = Number(retryAfter);
    if (Number.isFinite(secs) && secs > 0) return Math.min(secs * 1000, 60_000);
  }
  const base = Math.min(1000 * 2 ** attempt, 30_000);
  return base + Math.random() * 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 400);
  } catch {
    return "<unreadable body>";
  }
}
