import { randomBytes } from "node:crypto";
import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Prisma, type MembershipTier, type Payment, type PaymentStatus } from "@prisma/client";
import { PrismaService } from "../common/prisma.service";
import { AuditService } from "../common/audit.service";
import { loadEnv } from "../config/env";
import { PaystackClient, type VerifiedTransaction } from "./paystack.client";
import { requireVerifiedEmail } from "../common/require-verified-email";
import { NotificationsService } from "../common/notifications.service";
import { MailService } from "../common/mail.service";
import { brandedEmail } from "../common/branded-email";

export interface RequestContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

/** A payment in one of these states can still become SUCCESS (e.g. a delayed mobile-money approval). */
const OPEN_STATUSES: PaymentStatus[] = ["INITIALIZED", "PENDING", "FAILED", "ABANDONED"];

/**
 * A membership lasts one full year from the day it is paid: paid 16 Nov 2026 →
 * valid until 16 Nov 2027 (not 31 December). A 29 February start ends on
 * 28 February the following year.
 */
export function oneYearFrom(from: Date): Date {
  const y = from.getUTCFullYear() + 1;
  const m = from.getUTCMonth();
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(y, m, Math.min(from.getUTCDate(), lastDay), from.getUTCHours(), from.getUTCMinutes(), from.getUTCSeconds(), from.getUTCMilliseconds()),
  );
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly env = loadEnv();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly paystack: PaystackClient,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
  ) {}

  /**
   * A SUPERADMIN confirms a payment made outside Paystack (cash, bank transfer,
   * mobile money to PACA directly). Approval alone never activates a membership:
   * it stays PENDING_PAYMENT until either Paystack confirms an online payment or
   * a SUPERADMIN confirms an offline one here. The offline payment is recorded as
   * a MANUAL payment and goes through exactly the same activation as an online
   * one (one-year period, exam attempts, badge, library).
   */
  async confirmOfflinePayment(
    userId: string,
    actorId: string,
    input: { method: "CASH" | "BANK_TRANSFER" | "MOBILE_MONEY"; receivedOn?: string; note?: string },
    ctx: RequestContext,
  ) {
    const membership = await this.prisma.membership.findUnique({
      where: { userId },
      include: { user: { select: { email: true, firstName: true, deletedAt: true } } },
    });
    if (!membership || membership.user.deletedAt) {
      throw new BadRequestException("This person has no approved membership yet. Approve their application first.");
    }
    if (membership.status === "ACTIVE") throw new ConflictException("This membership is already active and paid");
    if (membership.status !== "PENDING_PAYMENT" && membership.status !== "LAPSED") {
      throw new BadRequestException(`A ${membership.status.toLowerCase()} membership cannot be activated by payment`);
    }
    const tier = await this.prisma.tierConfig.findUnique({ where: { tier: membership.tier } });
    if (!tier) throw new BadRequestException("This membership tier is not configured");

    const paidAt = input.receivedOn ? new Date(`${input.receivedOn}T12:00:00Z`) : new Date();
    if (Number.isNaN(paidAt.getTime()) || paidAt.getTime() > Date.now() + 86_400_000) {
      throw new BadRequestException("The payment date is not valid");
    }
    const channel = input.method.toLowerCase();
    const purpose = membership.status === "LAPSED" ? "MEMBERSHIP_RENEWAL" : "MEMBERSHIP_SUBSCRIPTION";
    const reference = `PACA-MANUAL-${randomBytes(8).toString("hex").toUpperCase()}`;
    const payment = await this.prisma.payment.create({
      data: {
        userId,
        provider: "MANUAL",
        providerRef: reference,
        purpose,
        status: "INITIALIZED",
        amount: tier.priceUsdCents,
        currency: "USD",
        amountUsdCents: tier.priceUsdCents,
        fxRate: new Prisma.Decimal(1),
        metadata: { membershipId: membership.id, tier: membership.tier, confirmedBy: actorId, method: input.method, note: input.note ?? null },
      },
    });

    await this.applyTransaction(
      payment,
      { reference, status: "success", amount: tier.priceUsdCents, currency: "USD", channel, paidAt: paidAt.toISOString() },
      "manual",
      ctx,
    );

    await this.audit.record({
      actorUserId: actorId,
      action: "payment.confirmed_offline",
      entityType: "Payment",
      entityId: payment.id,
      metadata: { userId, method: input.method, amountUsdCents: tier.priceUsdCents, reference, note: input.note ?? null },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    const updated = await this.prisma.membership.findUniqueOrThrow({ where: { userId } });
    try {
      const until = updated.currentPeriodEnd
        ? updated.currentPeriodEnd.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
        : "one year from today";
      const { html, text } = brandedEmail({
        firstName: membership.user.firstName,
        heading: "Payment confirmed: your membership is active",
        paragraphs: [
          `PACA has confirmed your ${tier.displayName} membership payment. Your membership is now active until ${until}.`,
          "You can now download your member badge, sit the certification exam, read the study library and use your member discounts.",
        ],
        note: { label: "Member ID", text: updated.memberNumber },
        cta: { label: "Go to my dashboard", url: `${this.env.WEB_PUBLIC_URL.replace(/\/$/, "")}/dashboard` },
      });
      await this.mail.send({ to: { email: membership.user.email, name: membership.user.firstName }, subject: "Your PACA membership is active", html, text });
    } catch (err) {
      this.logger.error(`Could not email payment confirmation to ${userId}: ${(err as Error).message}`);
    }

    return {
      status: updated.status,
      memberNumber: updated.memberNumber,
      currentPeriodStart: updated.currentPeriodStart,
      currentPeriodEnd: updated.currentPeriodEnd,
      paymentReference: reference,
    };
  }

  /**
   * Starts a membership payment. The amount comes from TierConfig on the server —
   * never from the client — and is converted to the Paystack charge currency.
   * Returns the access code the Paystack popup needs; nothing else secret.
   */
  async initializeMembershipPayment(userId: string, ctx: RequestContext) {
    await requireVerifiedEmail(this.prisma, userId);
    const membership = await this.prisma.membership.findUnique({
      where: { userId },
      include: { user: { select: { email: true } } },
    });
    if (!membership) throw new BadRequestException("You have no approved membership to pay for yet");

    let purpose: "MEMBERSHIP_SUBSCRIPTION" | "MEMBERSHIP_RENEWAL";
    if (membership.status === "PENDING_PAYMENT") purpose = "MEMBERSHIP_SUBSCRIPTION";
    else if (membership.status === "LAPSED") purpose = "MEMBERSHIP_RENEWAL";
    else if (membership.status === "ACTIVE") throw new ConflictException("Your membership is already active");
    else throw new BadRequestException(`A ${membership.status.toLowerCase()} membership cannot be paid for online`);

    const tier = await this.prisma.tierConfig.findUnique({ where: { tier: membership.tier } });
    if (!tier) throw new BadRequestException("This membership tier is not configured");
    if (tier.priceUsdCents <= 0) throw new BadRequestException("This membership tier has no fee to pay");

    const { currency, rate, amount } = this.convert(tier.priceUsdCents);
    const reference = `PACA-${randomBytes(10).toString("hex").toUpperCase()}`;

    const payment = await this.prisma.payment.create({
      data: {
        userId,
        provider: "PAYSTACK",
        providerRef: reference,
        purpose,
        status: "INITIALIZED",
        amount,
        currency,
        amountUsdCents: tier.priceUsdCents,
        fxRate: new Prisma.Decimal(rate),
        metadata: { membershipId: membership.id, tier: membership.tier },
      },
    });

    let accessCode: string;
    try {
      ({ accessCode } = await this.paystack.initialize({
        email: membership.user.email,
        amount,
        currency,
        reference,
        channels: this.env.PAYSTACK_CHANNELS.split(",").map((c) => c.trim()).filter(Boolean),
        metadata: {
          paymentId: payment.id,
          userId,
          purpose,
          custom_fields: [
            { display_name: "Member number", variable_name: "member_number", value: membership.memberNumber },
            { display_name: "Tier", variable_name: "tier", value: tier.displayName },
          ],
        },
      }));
    } catch (err) {
      await this.prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
      throw err;
    }

    await this.audit.record({
      actorUserId: userId,
      action: "payment.initialized",
      entityType: "Payment",
      entityId: payment.id,
      metadata: { purpose, reference, amount, currency, amountUsdCents: tier.priceUsdCents },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return { reference, accessCode, amount, currency, amountUsdCents: tier.priceUsdCents, purpose };
  }

  /** USD price -> minor units of the charge currency, at the configured rate. */
  private convert(priceUsdCents: number): { currency: string; rate: number; amount: number } {
    const currency = this.env.PAYSTACK_CURRENCY;
    const rate = currency === "USD" ? 1 : this.env.PAYSTACK_USD_RATE;
    if (!rate) {
      throw new BadRequestException(`PAYSTACK_USD_RATE must be set to charge in ${currency}`);
    }
    // Both sides are hundredths (cents -> pesewas/kobo), so the rate applies directly.
    return { currency, rate, amount: Math.round(priceUsdCents * rate) };
  }

  /**
   * Called by the browser after the popup reports success. The popup's word is
   * not trusted: the transaction is re-fetched from Paystack server-to-server, and
   * only that result can activate anything.
   */
  async confirm(userId: string, reference: string, ctx: RequestContext) {
    const payment = await this.prisma.payment.findUnique({ where: { providerRef: reference } });
    if (!payment || payment.userId !== userId) throw new NotFoundException("Payment not found");

    if (payment.status !== "SUCCESS") {
      const tx = await this.paystack.verify(reference);
      await this.applyTransaction(payment, tx, "verify", ctx);
    }

    const updated = await this.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    return this.toView(updated);
  }

  /**
   * Paystack webhook. The signature over the raw body is the authentication;
   * events are stored once (idempotency key = event + transaction id) and a
   * redelivery of an already-processed event is acknowledged without effect.
   */
  async handleWebhook(rawBody: Buffer | undefined, signature: string | undefined, body: unknown) {
    if (!rawBody || !this.paystack.isValidSignature(rawBody, signature)) {
      this.logger.warn("Rejected Paystack webhook with an invalid signature");
      return { ok: false as const };
    }

    const event = body as { event?: string; data?: Record<string, unknown> };
    const data = event.data ?? {};
    const eventType = String(event.event ?? "unknown");
    const providerEventId = `${eventType}:${String(data.id ?? data.reference ?? "")}`;

    const existing = await this.prisma.webhookEvent.findUnique({
      where: { provider_providerEventId: { provider: "PAYSTACK", providerEventId } },
    });
    if (existing?.processedAt) return { ok: true as const };

    const record =
      existing ??
      (await this.prisma.webhookEvent.create({
        data: {
          provider: "PAYSTACK",
          providerEventId,
          eventType,
          signatureValid: true,
          payload: body as Prisma.InputJsonValue,
        },
      }));

    try {
      if (eventType === "charge.success" && typeof data.reference === "string") {
        const payment = await this.prisma.payment.findUnique({ where: { providerRef: data.reference } });
        if (!payment) {
          await this.prisma.webhookEvent.update({
            where: { id: record.id },
            data: { processedAt: new Date(), error: "No payment with this reference" },
          });
          return { ok: true as const };
        }
        await this.applyTransaction(
          payment,
          {
            reference: data.reference,
            status: String(data.status ?? "success"),
            amount: Number(data.amount),
            currency: String(data.currency),
            channel: typeof data.channel === "string" ? data.channel : null,
            paidAt: typeof data.paid_at === "string" ? data.paid_at : null,
          },
          "webhook",
          {},
        );
      }
      await this.prisma.webhookEvent.update({ where: { id: record.id }, data: { processedAt: new Date(), error: null } });
    } catch (err) {
      // Left unprocessed so Paystack's retry gets another go.
      await this.prisma.webhookEvent.update({
        where: { id: record.id },
        data: { error: err instanceof Error ? err.message : String(err) },
      });
      throw err;
    }

    return { ok: true as const };
  }

  /**
   * The single place a payment changes state. Idempotent and race-safe: the
   * status flip to SUCCESS is a conditional update inside the same transaction as
   * the activation, so the verify call and the webhook arriving together activate
   * the membership exactly once.
   */
  private async applyTransaction(
    payment: Payment,
    tx: VerifiedTransaction,
    source: "verify" | "webhook" | "manual",
    ctx: RequestContext,
  ) {
    if (tx.status !== "success") {
      const status: PaymentStatus =
        tx.status === "failed" ? "FAILED" : tx.status === "abandoned" ? "ABANDONED" : "PENDING";
      await this.prisma.payment.updateMany({
        where: { id: payment.id, status: { in: OPEN_STATUSES } },
        data: { status },
      });
      return;
    }

    // A success for a different amount or currency is not a valid payment for this order.
    if (tx.amount !== payment.amount || tx.currency !== payment.currency) {
      this.logger.error(
        `Payment ${payment.id} amount mismatch: expected ${payment.amount} ${payment.currency}, got ${tx.amount} ${tx.currency}`,
      );
      await this.prisma.payment.updateMany({
        where: { id: payment.id, status: { in: OPEN_STATUSES } },
        data: { status: "FAILED", metadata: { ...(payment.metadata as object), mismatch: { amount: tx.amount, currency: tx.currency } } },
      });
      await this.audit.record({
        actorUserId: payment.userId,
        action: "payment.amount_mismatch",
        entityType: "Payment",
        entityId: payment.id,
        metadata: { expected: payment.amount, got: tx.amount, currency: tx.currency, source },
      });
      return;
    }

    const paidAt = tx.paidAt ? new Date(tx.paidAt) : new Date();

    const activated = await this.prisma.$transaction(async (db) => {
      const claimed = await db.payment.updateMany({
        where: { id: payment.id, status: { in: OPEN_STATUSES } },
        data: { status: "SUCCESS", paidAt, channel: tx.channel },
      });
      if (claimed.count === 0) return null; // already applied by the other path

      if (payment.purpose !== "MEMBERSHIP_SUBSCRIPTION" && payment.purpose !== "MEMBERSHIP_RENEWAL") return null;

      const membership = await db.membership.findUniqueOrThrow({ where: { userId: payment.userId } });
      const tier = ((payment.metadata as { tier?: MembershipTier } | null)?.tier ?? membership.tier) as MembershipTier;
      const tierConfig = await db.tierConfig.findUniqueOrThrow({ where: { tier } });

      const periodStart = paidAt;
      const periodEnd = oneYearFrom(paidAt);

      await db.membership.update({
        where: { id: membership.id },
        data: {
          status: "ACTIVE",
          tier,
          activatedAt: membership.activatedAt ?? paidAt,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          lapsedAt: null,
        },
      });

      await db.membershipPeriod.create({
        data: {
          membershipId: membership.id,
          tier,
          periodStart,
          periodEnd,
          amountUsdCents: payment.amountUsdCents,
          paymentId: payment.id,
        },
      });

      // The subscription includes the first block of certification attempts.
      if (tierConfig.requiresExam) {
        await db.examEntitlement.create({
          data: {
            userId: payment.userId,
            tier,
            source: "SUBSCRIPTION",
            attemptsGranted: tierConfig.attemptsPerEntitlement,
            paymentId: payment.id,
            expiresAt: periodEnd,
          },
        });
      }

      return { membershipId: membership.id, tier, periodEnd };
    });

    if (activated) {
      await this.notifications.notify(payment.userId, {
        kind: "PAYMENT",
        title: "Payment received — your membership is active",
        body: "Your member badge, study library, certification exam and member discounts are now unlocked.",
        link: "/dashboard",
      });
      await this.audit.record({
        actorUserId: payment.userId,
        action: "membership.activated",
        entityType: "Membership",
        entityId: activated.membershipId,
        metadata: {
          paymentId: payment.id,
          reference: payment.providerRef,
          channel: tx.channel,
          tier: activated.tier,
          periodEnd: activated.periodEnd.toISOString(),
          source,
        },
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
    }
  }

  async listMine(userId: string) {
    const payments = await this.prisma.payment.findMany({
      where: { userId, status: { not: "INITIALIZED" } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return payments.map((p) => this.toView(p));
  }

  async listAll(q: { status?: PaymentStatus; page: number; pageSize: number }) {
    const where = q.status ? { status: q.status } : {};
    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
      }),
      this.prisma.payment.count({ where }),
    ]);
    return {
      items: items.map((p) => ({ ...this.toView(p), user: p.user })),
      total,
      page: q.page,
      pageSize: q.pageSize,
    };
  }

  private toView(p: Payment) {
    return {
      id: p.id,
      reference: p.providerRef,
      purpose: p.purpose,
      status: p.status,
      amount: p.amount,
      currency: p.currency,
      amountUsdCents: p.amountUsdCents,
      channel: p.channel,
      paidAt: p.paidAt,
      createdAt: p.createdAt,
    };
  }
}
