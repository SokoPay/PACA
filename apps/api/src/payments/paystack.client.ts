import { createHmac, timingSafeEqual } from "node:crypto";
import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { loadEnv } from "../config/env";

const BASE_URL = "https://api.paystack.co";

export interface InitializeInput {
  email: string;
  /** Minor units (pesewas, kobo, cents) of `currency`. */
  amount: number;
  currency: string;
  reference: string;
  channels: string[];
  metadata: Record<string, unknown>;
}

export interface VerifiedTransaction {
  reference: string;
  status: string; // "success" | "failed" | "abandoned" | "ongoing" | "pending" | ...
  amount: number;
  currency: string;
  channel: string | null;
  paidAt: string | null;
}

/**
 * Thin wrapper over the Paystack REST API. The secret key never leaves the
 * server; the browser only ever receives an access code for one transaction.
 */
@Injectable()
export class PaystackClient {
  private readonly logger = new Logger(PaystackClient.name);
  private readonly env = loadEnv();

  get isConfigured(): boolean {
    return Boolean(this.env.PAYSTACK_SECRET_KEY);
  }

  async initialize(input: InitializeInput): Promise<{ accessCode: string; authorizationUrl: string }> {
    const data = await this.request<{ access_code: string; authorization_url: string }>("POST", "/transaction/initialize", {
      email: input.email,
      amount: input.amount,
      currency: input.currency,
      reference: input.reference,
      channels: input.channels,
      metadata: input.metadata,
    });
    return { accessCode: data.access_code, authorizationUrl: data.authorization_url };
  }

  async verify(reference: string): Promise<VerifiedTransaction> {
    const data = await this.request<{
      reference: string;
      status: string;
      amount: number;
      currency: string;
      channel?: string | null;
      paid_at?: string | null;
    }>("GET", `/transaction/verify/${encodeURIComponent(reference)}`);
    return {
      reference: data.reference,
      status: data.status,
      amount: data.amount,
      currency: data.currency,
      channel: data.channel ?? null,
      paidAt: data.paid_at ?? null,
    };
  }

  /** Paystack signs the raw webhook body with HMAC-SHA512 using the secret key. */
  isValidSignature(rawBody: Buffer, signature: string | undefined): boolean {
    if (!this.env.PAYSTACK_SECRET_KEY || !signature) return false;
    const expected = createHmac("sha512", this.env.PAYSTACK_SECRET_KEY).update(rawBody).digest("hex");
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(signature, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private async request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    if (!this.env.PAYSTACK_SECRET_KEY) {
      throw new ServiceUnavailableException("Online payment is not configured yet");
    }

    let res: Response;
    try {
      res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${this.env.PAYSTACK_SECRET_KEY}`,
          ...(body ? { "content-type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      this.logger.error(`Paystack ${method} ${path} unreachable: ${err instanceof Error ? err.message : String(err)}`);
      throw new ServiceUnavailableException("The payment provider could not be reached. Please try again.");
    }

    const json = (await res.json().catch(() => null)) as { status?: boolean; message?: string; data?: T } | null;
    if (!res.ok || !json?.status || json.data === undefined) {
      this.logger.error(`Paystack ${method} ${path} failed (${res.status}): ${json?.message ?? "no message"}`);
      throw new ServiceUnavailableException(`Payment provider error: ${json?.message ?? `HTTP ${res.status}`}`);
    }
    return json.data;
  }
}
