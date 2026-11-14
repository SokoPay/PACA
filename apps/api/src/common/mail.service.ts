import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { createTransport, type Transporter } from "nodemailer";
import { loadEnv } from "../config/env";

export interface MailMessage {
  to: { email: string; name?: string };
  subject: string;
  html: string;
  text: string;
}

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";
const UNAVAILABLE = "We could not send the email right now. Please try again shortly.";

/**
 * Transactional email (verification codes). Two ways to send, both Brevo-friendly:
 *
 *  - SMTP (SMTP_HOST/PORT/USER/PASS) — e.g. smtp-relay.brevo.com on port 2525,
 *    which DigitalOcean does not block (it blocks 25, 465 and 587 by default).
 *  - Brevo HTTP API (BREVO_API_KEY) — used instead when set.
 *
 * With neither configured the message is logged, so local development works
 * without an account. loadEnv warns loudly if that happens in production.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly env = loadEnv();
  private smtp: Transporter | null = null;

  private get from() {
    return { email: this.env.MAIL_FROM_EMAIL ?? "", name: this.env.MAIL_FROM_NAME };
  }

  async send(msg: MailMessage): Promise<void> {
    if (this.env.BREVO_API_KEY) return this.sendViaApi(msg, this.env.BREVO_API_KEY);
    if (this.env.SMTP_HOST) return this.sendViaSmtp(msg);
    this.logger.warn(`[mail disabled] to=${msg.to.email} subject="${msg.subject}"\n${msg.text}`);
  }

  private async sendViaSmtp(msg: MailMessage): Promise<void> {
    this.smtp ??= createTransport({
      host: this.env.SMTP_HOST,
      port: this.env.SMTP_PORT,
      // 465 is implicit TLS; other ports (2525, 587) upgrade with STARTTLS.
      secure: this.env.SMTP_PORT === 465,
      requireTLS: this.env.SMTP_PORT !== 465,
      auth: this.env.SMTP_USER ? { user: this.env.SMTP_USER, pass: this.env.SMTP_PASS } : undefined,
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 20_000,
    });

    try {
      await this.smtp.sendMail({
        from: { address: this.from.email, name: this.from.name },
        to: { address: msg.to.email, name: msg.to.name ?? "" },
        subject: msg.subject,
        text: msg.text,
        html: msg.html,
      });
    } catch (err) {
      // nodemailer errors carry the SMTP response, never the password.
      this.logger.error(`SMTP send failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException(UNAVAILABLE);
    }
  }

  private async sendViaApi(msg: MailMessage, apiKey: string): Promise<void> {
    let res: Response;
    try {
      res = await fetch(BREVO_URL, {
        method: "POST",
        headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          sender: this.from,
          to: [{ email: msg.to.email, ...(msg.to.name ? { name: msg.to.name } : {}) }],
          subject: msg.subject,
          htmlContent: msg.html,
          textContent: msg.text,
        }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      this.logger.error(`Brevo request failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException(UNAVAILABLE);
    }

    if (!res.ok) {
      // Brevo's error body names the problem (unverified sender, bad key) and never echoes the key.
      const body = await res.text().catch(() => "");
      this.logger.error(`Brevo rejected the email (${res.status}): ${body.slice(0, 500)}`);
      throw new ServiceUnavailableException(UNAVAILABLE);
    }
  }
}
