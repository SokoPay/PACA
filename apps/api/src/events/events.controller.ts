import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req } from "@nestjs/common";
import { z } from "zod";
import { EventsService } from "./events.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Public } from "../common/decorators/public.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

type Req_ = { ip?: string; headers: Record<string, string | undefined> };
const ctx = (req: Req_) => ({ ipAddress: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null });

const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => v || null);

const eventSchema = z
  .object({
    title: z.string().trim().min(3).max(160),
    summary: z.string().trim().min(3).max(300),
    description: opt(4000),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date().nullable().optional(),
    location: opt(160),
    isOnline: z.boolean().default(false),
    registerUrl: z
      .string()
      .trim()
      .url("Registration link must be a full URL (https://…)")
      .max(500)
      .nullable()
      .optional()
      .or(z.literal("").transform(() => null)),
    priceText: opt(60),
    memberDiscountPercent: z.number().int().min(1).max(100).nullable().optional(),
    memberDiscountCode: opt(60),
    publish: z.boolean().default(true),
  })
  .refine((e) => !e.endsAt || e.endsAt >= e.startsAt, { message: "The end must be after the start", path: ["endsAt"] });

@Public()
@Controller("events")
export class PublicEventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  list() {
    return this.events.upcoming();
  }
}

@Controller("member-events")
export class MemberEventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.events.forMember(user);
  }
}

@Roles("ADMIN")
@Controller("admin/events")
export class AdminEventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  list() {
    return this.events.adminList();
  }

  @Post()
  create(@Body(new ZodValidationPipe(eventSchema)) body: z.infer<typeof eventSchema>, @CurrentUser() actor: AuthenticatedUser, @Req() req: Req_) {
    return this.events.create(actor, { ...body, registerUrl: body.registerUrl ?? null }, ctx(req));
  }

  @Post(":id/publish")
  @HttpCode(200)
  publish(@Param("id") id: string, @CurrentUser() actor: AuthenticatedUser, @Req() req: Req_) {
    return this.events.publish(actor, id, ctx(req));
  }

  @Delete(":id")
  @HttpCode(204)
  async remove(@Param("id") id: string, @CurrentUser() actor: AuthenticatedUser, @Req() req: Req_) {
    await this.events.remove(actor, id, ctx(req));
  }
}
