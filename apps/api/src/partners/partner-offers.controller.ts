import { Body, Controller, Get, NotFoundException, Param, Put, Req } from "@nestjs/common";
import { z } from "zod";
import { KNOWN_PARTNERS, PartnerOffersService } from "./partner-offers.service";
import { Public } from "../common/decorators/public.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

const setSchema = z.object({
  discountPercent: z.number().int().min(1).max(100).nullable(),
  code: z.string().trim().max(100).nullable().transform((v) => v || null),
  note: z.string().trim().max(500).nullable().transform((v) => v || null),
});

function assertKnown(slug: string) {
  if (!(slug in KNOWN_PARTNERS)) throw new NotFoundException("Unknown partner");
}

@Controller("partner-offers")
export class PartnerOffersController {
  constructor(private readonly offers: PartnerOffersService) {}

  @Public()
  @Get()
  list() {
    return this.offers.publicOffers();
  }

  @Get(":slug/mine")
  mine(@Param("slug") slug: string, @CurrentUser() user: AuthenticatedUser) {
    assertKnown(slug);
    return this.offers.memberOffer(user, slug);
  }
}

@Roles("ADMIN")
@Controller("admin/partner-offers")
export class AdminPartnerOffersController {
  constructor(private readonly offers: PartnerOffersService) {}

  @Get()
  list() {
    return this.offers.adminList();
  }

  @Put(":slug")
  set(
    @Param("slug") slug: string,
    @Body(new ZodValidationPipe(setSchema)) body: z.infer<typeof setSchema>,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: { ip?: string; headers: Record<string, string | undefined> },
  ) {
    assertKnown(slug);
    return this.offers.adminSet(actor, slug, body, { ipAddress: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null });
  }
}
