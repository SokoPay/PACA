import { Injectable } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { AuditService } from "../common/audit.service";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

const STAFF = new Set(["ADMIN", "SUPERADMIN"]);

/** The partner catalogue lives in the web app; these are the partners PACA lists. */
export const KNOWN_PARTNERS: Record<string, string> = {
  "scrum-org": "Scrum.org",
  prokanban: "ProKanban.org",
  "scrum-alliance": "Scrum Alliance",
};

/**
 * Member discounts on partner courses. The percentage is public ("PACA members
 * save 15%") so it can sell the membership; the code and redemption steps are
 * shown only to members whose membership is active (paid).
 */
@Injectable()
export class PartnerOffersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async publicOffers() {
    const rows = await this.prisma.partner.findMany({
      where: { slug: { in: Object.keys(KNOWN_PARTNERS) }, isActive: true },
      select: { slug: true, memberDiscountPercent: true },
    });
    return Object.keys(KNOWN_PARTNERS).map((slug) => ({
      slug,
      discountPercent: rows.find((r) => r.slug === slug)?.memberDiscountPercent ?? null,
    }));
  }

  async memberOffer(user: AuthenticatedUser, slug: string) {
    const partner = await this.prisma.partner.findUnique({
      where: { slug },
      select: { memberDiscountPercent: true, memberDiscountCode: true, memberDiscountNote: true, isActive: true },
    });
    const discountPercent = partner?.isActive ? partner.memberDiscountPercent : null;

    let eligible = STAFF.has(user.role);
    if (!eligible) {
      const m = await this.prisma.membership.findUnique({
        where: { userId: user.id },
        select: { status: true, currentPeriodEnd: true },
      });
      eligible = m?.status === "ACTIVE" && (!m.currentPeriodEnd || m.currentPeriodEnd.getTime() > Date.now());
    }

    return {
      eligible,
      discountPercent,
      code: eligible && discountPercent ? (partner?.memberDiscountCode ?? null) : null,
      note: eligible && discountPercent ? (partner?.memberDiscountNote ?? null) : null,
    };
  }

  async adminList() {
    const rows = await this.prisma.partner.findMany({
      where: { slug: { in: Object.keys(KNOWN_PARTNERS) } },
      select: { slug: true, memberDiscountPercent: true, memberDiscountCode: true, memberDiscountNote: true },
    });
    return Object.entries(KNOWN_PARTNERS).map(([slug, name]) => {
      const r = rows.find((x) => x.slug === slug);
      return {
        slug,
        name,
        discountPercent: r?.memberDiscountPercent ?? null,
        code: r?.memberDiscountCode ?? null,
        note: r?.memberDiscountNote ?? null,
      };
    });
  }

  async adminSet(
    actor: AuthenticatedUser,
    slug: string,
    input: { discountPercent: number | null; code: string | null; note: string | null },
    ctx: { ipAddress?: string | null; userAgent?: string | null },
  ) {
    const data = {
      memberDiscountPercent: input.discountPercent,
      memberDiscountCode: input.code,
      memberDiscountNote: input.note,
    };
    await this.prisma.partner.upsert({
      where: { slug },
      update: data,
      create: { slug, name: KNOWN_PARTNERS[slug], ...data },
    });
    await this.audit.record({
      actorUserId: actor.id,
      action: "partner.discount_updated",
      entityType: "Partner",
      entityId: slug,
      // The code itself is not written to the audit log.
      metadata: { discountPercent: input.discountPercent, hasCode: Boolean(input.code) },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    return (await this.adminList()).find((p) => p.slug === slug);
  }
}
