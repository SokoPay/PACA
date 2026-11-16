import { Injectable } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";

@Injectable()
export class PublicContentService {
  constructor(private readonly prisma: PrismaService) {}

  courses() {
    return this.prisma.course.findMany({
      where: { status: "PUBLISHED", showOnPublicSite: true },
      orderBy: { publishedAt: "desc" },
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
        provider: true,
        isFree: true,
        priceUsdCents: true,
        durationMins: true,
        externalUrl: true,
        partner: { select: { name: true, slug: true } },
      },
    });
  }

  partners() {
    return this.prisma.partner.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, slug: true, name: true, description: true, websiteUrl: true },
    });
  }

  /**
   * Public "Digital library" listing. Member books (uploaded PDFs) appear by title
   * only — the file itself is served by /library/:id/file to paid members — and a
   * gated item's external link is withheld.
   */
  async resources() {
    const rows = await this.prisma.resource.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        kind: true,
        externalUrl: true,
        minTier: true,
        tiers: true,
        storageKey: true,
        topic: { select: { name: true } },
      },
    });
    return rows.map(({ storageKey, ...r }) => {
      const gated = Boolean(storageKey) || r.tiers.length > 0 || r.minTier !== null;
      return { ...r, memberOnly: gated, externalUrl: gated ? null : r.externalUrl };
    });
  }

  faq() {
    return this.prisma.faqItem.findMany({
      where: { status: "PUBLISHED" },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
      select: { id: true, question: true, answer: true, category: true },
    });
  }

  /**
   * Public teaser for the members-only job board: the count and a few recent
   * titles, without apply links (those are a paid-member benefit).
   */
  async jobs() {
    const [total, latest] = await Promise.all([
      this.prisma.jobListing.count({ where: { status: "PUBLISHED" } }),
      this.prisma.jobListing.findMany({
        where: { status: "PUBLISHED" },
        orderBy: { fetchedAt: "desc" },
        take: 6,
        select: { id: true, title: true, company: true, location: true, isRemote: true, agileRole: true, seniority: true },
      }),
    ]);
    return { total, latest };
  }

  /**
   * Public professional database: paid members in good standing who opted in.
   * Name, role, country and badge only; bio and LinkedIn are for paid members
   * (the members-only network), as the profile page tells the member.
   */
  async directory() {
    const rows = await this.prisma.profile.findMany({
      where: { isPublicInDirectory: true, user: { deletedAt: null, membership: { status: "ACTIVE" } } },
      take: 300,
      select: {
        occupation: true,
        country: true,
        user: { select: { firstName: true, lastName: true, membership: { select: { tier: true, status: true, memberNumber: true } } } },
      },
    });
    return rows.map((r) => ({ ...r, employer: null, institution: null, linkedinUrl: null, bio: null }));
  }

}
