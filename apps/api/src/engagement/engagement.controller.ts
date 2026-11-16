import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { z } from "zod";
import { EngagementService } from "./engagement.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Public } from "../common/decorators/public.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

type Req_ = { ip?: string; headers: Record<string, string | undefined> };
const ctx = (req: Req_) => ({ ipAddress: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null });

const TIERS = ["STUDENT", "PROFESSIONAL", "EXECUTIVE", "FELLOW", "RETIRED"] as const;

const announcementSchema = z.object({
  title: z.string().trim().min(3).max(160),
  body: z.string().trim().min(3).max(4000),
  audience: z.enum(["ALL_USERS", "ALL_MEMBERS", "BY_TIER"]),
  tiers: z.array(z.enum(TIERS)).default([]),
  publish: z.boolean().default(true),
  pinDays: z.number().int().min(1).max(90).nullable().optional(),
  discountCode: z.string().trim().max(60).nullable().optional(),
});

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v === undefined ? undefined : v || null));

// Work, location, education and address come from the membership application
// (copied on submit), so the profile only takes what the application does not ask.
const profileSchema = z.object({
  linkedinUrl: z
    .string()
    .trim()
    .max(300)
    .nullable()
    .optional()
    .refine((v) => !v || /^https:\/\/([a-z]{2,3}\.)?linkedin\.com\//i.test(v), "Use your LinkedIn profile link (https://www.linkedin.com/in/…)")
    .transform((v) => (v === undefined ? undefined : v || null)),
  bio: optionalText(600),
  isPublicInDirectory: z.boolean().optional(),
});

@Controller("notifications")
export class NotificationsController {
  constructor(private readonly svc: EngagementService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.svc.myNotifications(user.id);
  }

  @Post("read-all")
  @HttpCode(200)
  readAll(@CurrentUser() user: AuthenticatedUser) {
    return this.svc.markRead(user.id);
  }

  @Post(":id/read")
  @HttpCode(200)
  read(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.svc.markRead(user.id, id);
  }
}

@Controller("announcements")
export class AnnouncementsController {
  constructor(private readonly svc: EngagementService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.svc.announcementsFor(user);
  }
}

@Roles("ADMIN")
@Controller("admin/announcements")
export class AdminAnnouncementsController {
  constructor(private readonly svc: EngagementService) {}

  @Get()
  list() {
    return this.svc.adminAnnouncements();
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(announcementSchema)) body: z.infer<typeof announcementSchema>,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Req_,
  ) {
    return this.svc.createAnnouncement(actor, body, ctx(req));
  }

  @Post(":id/publish")
  @HttpCode(200)
  publish(@Param("id") id: string, @CurrentUser() actor: AuthenticatedUser, @Req() req: Req_) {
    return this.svc.publishAnnouncement(actor, id, ctx(req));
  }

  @Delete(":id")
  @HttpCode(204)
  async remove(@Param("id") id: string, @CurrentUser() actor: AuthenticatedUser, @Req() req: Req_) {
    await this.svc.deleteAnnouncement(actor, id, ctx(req));
  }
}

@Controller("me/profile")
export class ProfileController {
  constructor(private readonly svc: EngagementService) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedUser) {
    return this.svc.myProfile(user.id);
  }

  @Patch()
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(profileSchema)) body: z.infer<typeof profileSchema>,
  ) {
    const patch = Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined));
    return this.svc.updateProfile(user.id, patch);
  }
}

@Controller("network")
export class NetworkController {
  constructor(private readonly svc: EngagementService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query("q") q?: string) {
    return this.svc.network(user, q?.trim().slice(0, 80) || undefined);
  }
}

@Public()
@Controller("public/members")
export class PublicMembersController {
  constructor(private readonly svc: EngagementService) {}

  @Get(":memberNumber")
  get(@Param("memberNumber") memberNumber: string) {
    return this.svc.publicMember(memberNumber.toUpperCase());
  }
}
