import { Body, Controller, Get, Headers, HttpCode, Param, Post, Query, Req, UnauthorizedException, type RawBodyRequest } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { z } from "zod";
import { PaymentsService } from "./payments.service";
import { Public } from "../common/decorators/public.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

const referenceSchema = z.string().regex(/^PACA-[0-9A-F]{20}$/, "Invalid payment reference");

const statuses = ["INITIALIZED", "PENDING", "SUCCESS", "FAILED", "ABANDONED", "REFUNDED"] as const;
const adminListSchema = z.object({
  status: z.enum(statuses).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

@Controller("payments")
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /** Starts a Paystack transaction for the member's approved (or lapsed) membership. */
  @Post("membership/initialize")
  initialize(@CurrentUser() user: AuthenticatedUser, @Req() req: FastifyRequest) {
    return this.payments.initializeMembershipPayment(user.id, context(req));
  }

  /** After the popup closes with success: re-checks the transaction with Paystack. */
  @Post(":reference/verify")
  @HttpCode(200)
  verify(
    @Param("reference", new ZodValidationPipe(referenceSchema)) reference: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: FastifyRequest,
  ) {
    return this.payments.confirm(user.id, reference, context(req));
  }

  @Get("mine")
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.payments.listMine(user.id);
  }

  /**
   * Paystack → us. Public, but authenticated by the HMAC signature over the raw
   * body. Set the webhook URL in the Paystack dashboard to
   * {API_PUBLIC_URL}/api/v1/payments/paystack/webhook.
   */
  @Public()
  @Post("paystack/webhook")
  @HttpCode(200)
  async webhook(
    @Req() req: RawBodyRequest<FastifyRequest>,
    @Headers("x-paystack-signature") signature: string | undefined,
    @Body() body: unknown,
  ) {
    const result = await this.payments.handleWebhook(req.rawBody, signature, body);
    if (!result.ok) throw new UnauthorizedException("Invalid signature");
    return { received: true };
  }
}

const offlineSchema = z.object({
  method: z.enum(["CASH", "BANK_TRANSFER", "MOBILE_MONEY"]),
  receivedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date format YYYY-MM-DD").optional(),
  note: z.string().trim().max(500).optional(),
});

@Controller("admin/payments")
@Roles("ADMIN")
export class AdminPaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /**
   * Confirm a payment made in cash or directly to PACA. SUPERADMIN only: this is
   * the step that turns an approved (unpaid) membership into an active one.
   */
  @Roles("SUPERADMIN")
  @Post("offline/:userId")
  @HttpCode(200)
  confirmOffline(
    @Param("userId") userId: string,
    @Body(new ZodValidationPipe(offlineSchema)) body: z.infer<typeof offlineSchema>,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: FastifyRequest,
  ) {
    return this.payments.confirmOfflinePayment(userId, user.id, body, context(req));
  }

  @Get()
  list(@Query(new ZodValidationPipe(adminListSchema)) query: z.infer<typeof adminListSchema>) {
    return this.payments.listAll(query);
  }
}

function context(req: FastifyRequest) {
  const ua = req.headers["user-agent"];
  return { ipAddress: req.ip ?? null, userAgent: (Array.isArray(ua) ? ua[0] : ua) ?? null };
}
