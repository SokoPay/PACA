import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { loadEnv } from "../config/env";

export interface MailMessage {
  to: { email: string; name?: string };
  subject: string;
  html: string;
  text: string;
}

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";

/**
 * Transactional email through Brevo's HTTP API (no SMTP port needed — DigitalOcean
 * blocks outbound SMTP on new droplets).
 *
 * Without BREVO_API_KEY the message is logged instead of sent, so local
 * development works with no account. Never enable that fallback in production:
 * loadEnv warns loudly when the key is missing there.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly env = loadEnv();

  get enabled(): boolean {
    return Boolean(this.env.BREVO_API_KEY);
  }

  async send(msg: MailMessage): Promise<void> {
    if (!this.env.BREVO_API_KEY) {
      this.logger.warn(`[mail disabled] to=${msg.to.email} subject="${msg.subject}"\n${msg.text}`);
      return;
    }

    let res: Response;
    try {
      res = await fetch(BREVO_URL, {
        method: "POST",
        headers: {
          "api-key": this.env.BREVO_API_KEY,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          sender: { email: this.env.MAIL_FROM_EMAIL, name: this.env.MAIL_FROM_NAME },
          to: [{ email: msg.to.email, ...(msg.to.name ? { name: msg.to.name } : {}) }],
          subject: msg.subject,
          htmlContent: msg.html,
          textContent: msg.text,
        }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      this.logger.error(`Brevo request failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException("We could not send the email right now. Please try again shortly.");
    }

    if (!res.ok) {
      // Brevo's error body names the problem (unverified sender, bad key, etc.)
      // and never echoes the API key, so it is safe to log.
      const body = await res.text().catch(() => "");
      this.logger.error(`Brevo rejected the email (${res.status}): ${body.slice(0, 500)}`);
      throw new ServiceUnavailableException("We could not send the email right now. Please try again shortly.");
    }
  }
}
