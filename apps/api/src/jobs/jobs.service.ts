import { BadRequestException, Injectable, Logger, NotFoundException, OnApplicationShutdown, OnModuleInit } from "@nestjs/common";
import type { AgileRole, JobSourceKind, JobStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../common/prisma.service";
import { AuditService } from "../common/audit.service";
import { NotificationsService } from "../common/notifications.service";
import { requirePaidMember } from "../common/membership-access";
import { loadEnv } from "../config/env";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";
import { AGILE_TITLE, fetchArbeitnow, fetchGreenhouse, fetchJobicy, fetchLever, type RawJob } from "./job-feeds";
import { JobClassifier } from "./job-classifier";

const PUBLISH_CONFIDENCE = 0.7;
const EXPIRE_AFTER_DAYS = 45;

/** Built-in sources, created on first boot. Admins can pause them or add company boards. */
const DEFAULT_SOURCES: Array<{ name: string; kind: JobSourceKind; config: Prisma.InputJsonValue }> = [
  { name: "Jobicy", kind: "JOBICY", config: { tags: ["agile", "scrum", "product owner", "kanban", "agile coach"] } },
  { name: "Arbeitnow", kind: "ARBEITNOW", config: { pages: 3 } },
];

/**
 * Agile job board for paid members. Crawls public job APIs on a schedule,
 * keeps titles that look Agile, has Claude classify role/seniority/relevance,
 * and publishes confident matches; uncertain ones wait for an admin.
 */
@Injectable()
export class JobsService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(JobsService.name);
  private readonly env = loadEnv();
  private readonly classifier = new JobClassifier(this.env.ANTHROPIC_API_KEY, this.env.AI_MODEL);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit() {
    const hours = this.env.JOBS_CRAWL_HOURS;
    if (!hours || this.env.NODE_ENV === "test") return;
    // First run shortly after boot, then on the interval.
    this.timer = setTimeout(() => {
      void this.crawlAll("schedule");
      this.timer = setInterval(() => void this.crawlAll("schedule"), hours * 3_600_000);
    }, 90_000);
  }

  onApplicationShutdown() {
    if (this.timer) clearTimeout(this.timer);
  }

  private async ensureDefaultSources() {
    for (const s of DEFAULT_SOURCES) {
      const exists = await this.prisma.jobSource.findFirst({ where: { kind: s.kind }, select: { id: true } });
      if (!exists) await this.prisma.jobSource.create({ data: s });
    }
  }

  private fetchFor(kind: JobSourceKind, config: Record<string, unknown>): Promise<RawJob[]> {
    switch (kind) {
      case "JOBICY":
        return fetchJobicy(config as { tags?: string[] });
      case "ARBEITNOW":
        return fetchArbeitnow(config as { pages?: number });
      case "GREENHOUSE":
        return fetchGreenhouse(config as { boardToken?: string; company?: string });
      case "LEVER":
        return fetchLever(config as { company?: string; companyName?: string });
      default:
        return Promise.resolve([]);
    }
  }

  async crawlAll(trigger: "schedule" | "admin") {
    if (this.running) return { started: false, message: "A crawl is already running" };
    this.running = true;
    const summary: Array<{ source: string; fetched: number; added: number; published: number; error?: string }> = [];
    try {
      await this.ensureDefaultSources();
      const sources = await this.prisma.jobSource.findMany({ where: { isActive: true } });
      for (const source of sources) {
        try {
          const r = await this.crawlSource(source.id, source.kind, (source.config ?? {}) as Record<string, unknown>);
          summary.push({ source: source.name, ...r });
          await this.prisma.jobSource.update({
            where: { id: source.id },
            data: { lastRunAt: new Date(), lastRunStatus: "OK", lastRunMessage: `${r.fetched} fetched, ${r.added} new, ${r.published} published` },
          });
        } catch (err) {
          const message = (err as Error).message.slice(0, 300);
          summary.push({ source: source.name, fetched: 0, added: 0, published: 0, error: message });
          await this.prisma.jobSource.update({
            where: { id: source.id },
            data: { lastRunAt: new Date(), lastRunStatus: "ERROR", lastRunMessage: message },
          });
          this.logger.warn(`Job source ${source.name} failed: ${message}`);
        }
      }
      // Old postings are usually filled; hide them.
      await this.prisma.jobListing.updateMany({
        where: {
          status: { in: ["PUBLISHED", "PENDING_REVIEW"] },
          OR: [
            { postedAt: { lt: new Date(Date.now() - EXPIRE_AFTER_DAYS * 86_400_000) } },
            { postedAt: null, fetchedAt: { lt: new Date(Date.now() - EXPIRE_AFTER_DAYS * 86_400_000) } },
          ],
        },
        data: { status: "EXPIRED" },
      });
      this.logger.log(`Job crawl (${trigger}) done: ${JSON.stringify(summary)}`);

      // Jobs are a paid-member benefit: tell paid members when new ones arrive.
      const newlyPublished = summary.reduce((n, s) => n + s.published, 0);
      if (newlyPublished > 0) {
        const members = await this.prisma.membership.findMany({ where: { status: "ACTIVE" }, select: { userId: true } });
        await this.notifications.notifyMany(
          members.map((m) => m.userId),
          {
            kind: "SYSTEM",
            title: `${newlyPublished} new Agile job${newlyPublished === 1 ? "" : "s"}`,
            body: "Fresh Scrum Master, Product Owner and Agile roles were just added to your job board.",
            link: "/dashboard/jobs",
          },
        );
      }
      return { started: true, ai: this.classifier.usesAi, summary };
    } finally {
      this.running = false;
    }
  }

  private async crawlSource(sourceId: string, kind: JobSourceKind, config: Record<string, unknown>) {
    const raw = (await this.fetchFor(kind, config)).filter((j) => j.externalId && j.title && j.applyUrl);
    const candidates = raw.filter((j) => AGILE_TITLE.test(j.title));

    const known = new Set(
      (
        await this.prisma.jobListing.findMany({
          where: { sourceId, externalId: { in: candidates.map((c) => c.externalId) } },
          select: { externalId: true },
        })
      ).map((r) => r.externalId),
    );
    const fresh = candidates.filter((c) => !known.has(c.externalId));
    if (fresh.length === 0) return { fetched: raw.length, added: 0, published: 0 };

    const verdicts = await this.classifier.classify(
      fresh.map((j) => ({ id: j.externalId, title: j.title, company: j.company, description: j.description })),
    );

    let published = 0;
    for (const j of fresh) {
      const v = verdicts.get(j.externalId);
      if (!v) continue;
      const status: JobStatus = !v.relevant ? "REJECTED" : v.confidence >= PUBLISH_CONFIDENCE ? "PUBLISHED" : "PENDING_REVIEW";
      if (status === "PUBLISHED") published++;
      await this.prisma.jobListing.create({
        data: {
          sourceId,
          externalId: j.externalId,
          title: j.title.slice(0, 300),
          company: j.company.slice(0, 200),
          companyLogoUrl: j.companyLogoUrl ?? null,
          location: j.location?.slice(0, 200) ?? null,
          isRemote: j.isRemote,
          employmentType: j.employmentType?.slice(0, 100) ?? null,
          description: j.description.slice(0, 4000),
          summary: v.summary || null,
          applyUrl: j.applyUrl,
          agileRole: v.agileRole,
          seniority: v.seniority,
          aiConfidence: v.confidence,
          aiClassifiedAt: this.classifier.usesAi ? new Date() : null,
          status,
          postedAt: j.postedAt ?? null,
        },
      });
    }
    return { fetched: raw.length, added: fresh.length, published };
  }

  // ------------------------------------------------------------------ members

  async memberJobs(user: AuthenticatedUser, q: { role?: AgileRole; remote?: boolean; search?: string; page: number }) {
    await requirePaidMember(this.prisma, user);
    const where: Prisma.JobListingWhereInput = {
      status: "PUBLISHED",
      ...(q.role ? { agileRole: q.role } : {}),
      ...(q.remote ? { isRemote: true } : {}),
      ...(q.search
        ? {
            OR: [
              { title: { contains: q.search, mode: "insensitive" } },
              { company: { contains: q.search, mode: "insensitive" } },
              { location: { contains: q.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const pageSize = 24;
    const [total, items] = await Promise.all([
      this.prisma.jobListing.count({ where }),
      this.prisma.jobListing.findMany({
        where,
        orderBy: [{ postedAt: { sort: "desc", nulls: "last" } }, { fetchedAt: "desc" }],
        skip: (q.page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          title: true,
          company: true,
          companyLogoUrl: true,
          location: true,
          isRemote: true,
          employmentType: true,
          summary: true,
          applyUrl: true,
          agileRole: true,
          seniority: true,
          postedAt: true,
          source: { select: { name: true } },
        },
      }),
    ]);
    return { total, page: q.page, pageSize, items };
  }

  /** Unused publicly — jobs are visible to paid members only. */
  async teaser() {
    const [total, latest] = await Promise.all([
      this.prisma.jobListing.count({ where: { status: "PUBLISHED" } }),
      this.prisma.jobListing.findMany({
        where: { status: "PUBLISHED" },
        orderBy: { fetchedAt: "desc" },
        take: 6,
        select: { title: true, company: true, location: true, isRemote: true, agileRole: true },
      }),
    ]);
    return { total, latest };
  }

  // ------------------------------------------------------------------ admin

  sources() {
    return this.prisma.jobSource.findMany({
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { listings: { where: { status: "PUBLISHED" } } } } },
    });
  }

  async addSource(actor: AuthenticatedUser, input: { kind: "GREENHOUSE" | "LEVER"; name: string; handle: string }) {
    const config =
      input.kind === "GREENHOUSE"
        ? { boardToken: input.handle, company: input.name }
        : { company: input.handle, companyName: input.name };
    const created = await this.prisma.jobSource.create({ data: { name: input.name, kind: input.kind, config } });
    await this.audit.record({ actorUserId: actor.id, action: "jobs.source_added", entityType: "JobSource", entityId: created.id, metadata: config });
    return created;
  }

  async setSourceActive(actor: AuthenticatedUser, id: string, isActive: boolean) {
    const updated = await this.prisma.jobSource.update({ where: { id }, data: { isActive } }).catch(() => {
      throw new NotFoundException("Source not found");
    });
    await this.audit.record({ actorUserId: actor.id, action: "jobs.source_toggled", entityType: "JobSource", entityId: id, metadata: { isActive } });
    return updated;
  }

  listings(status: JobStatus, page: number) {
    return this.prisma.jobListing.findMany({
      where: { status },
      orderBy: { fetchedAt: "desc" },
      skip: (page - 1) * 50,
      take: 50,
      select: {
        id: true,
        title: true,
        company: true,
        location: true,
        isRemote: true,
        summary: true,
        applyUrl: true,
        agileRole: true,
        seniority: true,
        aiConfidence: true,
        status: true,
        fetchedAt: true,
        source: { select: { name: true } },
      },
    });
  }

  async setListingStatus(actor: AuthenticatedUser, id: string, status: JobStatus) {
    if (!["PUBLISHED", "REJECTED"].includes(status)) throw new BadRequestException("Status must be PUBLISHED or REJECTED");
    const updated = await this.prisma.jobListing.update({ where: { id }, data: { status } }).catch(() => {
      throw new NotFoundException("Job not found");
    });
    await this.audit.record({ actorUserId: actor.id, action: "jobs.listing_reviewed", entityType: "JobListing", entityId: id, metadata: { status } });
    return updated;
  }
}
