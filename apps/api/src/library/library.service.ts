import { promises as fs } from "fs";
import * as path from "path";
import { randomBytes, randomUUID } from "crypto";
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { MembershipTier, Prisma } from "@prisma/client";
import { PrismaService } from "../common/prisma.service";
import { AuditService } from "../common/audit.service";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

export interface RequestContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

/** Books are bigger than application documents. Keep in step with deploy/Caddyfile. */
export const MAX_BOOK_BYTES = 50 * 1024 * 1024;

const LIBRARY_ROOT = path.join(path.resolve(process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads")), "library");

const STAFF = new Set(["ADMIN", "SUPERADMIN"]);

const itemSelect = {
  id: true,
  title: true,
  description: true,
  tiers: true,
  fileName: true,
  fileSizeBytes: true,
  status: true,
  publishedAt: true,
  downloadCount: true,
  createdAt: true,
} satisfies Prisma.ResourceSelect;

function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "book"}-${randomBytes(3).toString("hex")}`;
}

/**
 * The member library: PDF books and study guides that admins upload and assign to
 * membership types. Only members with an ACTIVE (paid) membership can open them,
 * and only the ones assigned to their type — Student material differs from
 * Executive material. A resource with no types assigned is open to every active member.
 */
@Injectable()
export class LibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ------------------------------------------------------------------ members

  private async accessFor(user: AuthenticatedUser) {
    if (STAFF.has(user.role)) return { active: true, tier: null as MembershipTier | null, staff: true };
    const membership = await this.prisma.membership.findUnique({
      where: { userId: user.id },
      select: { tier: true, status: true, currentPeriodEnd: true },
    });
    const active =
      membership?.status === "ACTIVE" &&
      (!membership.currentPeriodEnd || membership.currentPeriodEnd.getTime() > Date.now());
    return { active: Boolean(active), tier: membership?.tier ?? null, staff: false };
  }

  private visibleTo(tier: MembershipTier | null): Prisma.ResourceWhereInput {
    const base: Prisma.ResourceWhereInput = { status: "PUBLISHED", kind: "PDF", storageKey: { not: null } };
    if (!tier) return base;
    return { ...base, OR: [{ tiers: { isEmpty: true } }, { tiers: { has: tier } }] };
  }

  /**
   * Members without a paid membership still see the titles (locked), so they know
   * what payment unlocks. Staff see everything.
   */
  async listForMember(user: AuthenticatedUser) {
    const access = await this.accessFor(user);
    const items = await this.prisma.resource.findMany({
      where: this.visibleTo(access.staff ? null : access.tier),
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      select: { id: true, title: true, description: true, tiers: true, fileName: true, fileSizeBytes: true, publishedAt: true },
    });
    return {
      unlocked: access.active,
      tier: access.tier,
      items: items.map((i) => ({ ...i, locked: !access.active })),
    };
  }

  async openForMember(user: AuthenticatedUser, id: string) {
    const access = await this.accessFor(user);
    if (!access.active) {
      throw new ForbiddenException("The member library unlocks once your membership payment is complete.");
    }
    const resource = await this.prisma.resource.findFirst({
      where: { id, ...this.visibleTo(access.staff ? null : access.tier) },
      select: { id: true, storageKey: true, fileName: true },
    });
    if (!resource?.storageKey) throw new NotFoundException("Book not found");

    await this.prisma.resource.update({ where: { id }, data: { downloadCount: { increment: 1 } } });
    return { absolutePath: this.absolutePath(resource.storageKey), fileName: resource.fileName ?? "book.pdf" };
  }

  // ------------------------------------------------------------------ admin

  adminList() {
    return this.prisma.resource.findMany({
      where: { kind: "PDF", storageKey: { not: null } },
      orderBy: { createdAt: "desc" },
      select: itemSelect,
    });
  }

  async adminUpload(
    actor: AuthenticatedUser,
    input: { title: string; description: string | null; tiers: MembershipTier[] },
    file: { filename: string; buffer: Buffer },
    ctx: RequestContext,
  ) {
    if (file.buffer.length === 0) throw new BadRequestException("The file is empty");
    if (file.buffer.length > MAX_BOOK_BYTES) throw new BadRequestException("Books must be 50MB or smaller");
    // Sniff the real type — the browser-declared mimetype is attacker-controlled.
    if (file.buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
      throw new BadRequestException("Only PDF files can be added to the library");
    }

    const storageKey = `library/${randomUUID()}.pdf`;
    await fs.mkdir(LIBRARY_ROOT, { recursive: true });
    await fs.writeFile(this.absolutePath(storageKey), file.buffer, { mode: 0o640 });

    const fileName = path.basename(file.filename || "book.pdf").replace(/[^\w.\- ()]/g, "_").slice(0, 200);
    const resource = await this.prisma.resource.create({
      data: {
        slug: slugify(input.title),
        title: input.title,
        description: input.description,
        kind: "PDF",
        storageKey,
        fileName,
        fileSizeBytes: file.buffer.length,
        tiers: input.tiers,
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
      select: itemSelect,
    });

    await this.audit.record({
      actorUserId: actor.id,
      action: "library.book_uploaded",
      entityType: "Resource",
      entityId: resource.id,
      metadata: { title: input.title, tiers: input.tiers, sizeBytes: file.buffer.length },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    return resource;
  }

  async adminUpdate(
    actor: AuthenticatedUser,
    id: string,
    patch: { title?: string; description?: string | null; tiers?: MembershipTier[]; published?: boolean },
    ctx: RequestContext,
  ) {
    const existing = await this.prisma.resource.findUnique({ where: { id }, select: { id: true, publishedAt: true } });
    if (!existing) throw new NotFoundException("Book not found");

    const updated = await this.prisma.resource.update({
      where: { id },
      data: {
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.tiers !== undefined ? { tiers: patch.tiers } : {}),
        ...(patch.published !== undefined
          ? { status: patch.published ? "PUBLISHED" : "DRAFT", publishedAt: patch.published ? (existing.publishedAt ?? new Date()) : existing.publishedAt }
          : {}),
      },
      select: itemSelect,
    });

    await this.audit.record({
      actorUserId: actor.id,
      action: "library.book_updated",
      entityType: "Resource",
      entityId: id,
      metadata: patch as Record<string, unknown>,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    return updated;
  }

  async adminDelete(actor: AuthenticatedUser, id: string, ctx: RequestContext) {
    const existing = await this.prisma.resource.findUnique({ where: { id }, select: { storageKey: true, title: true } });
    if (!existing) throw new NotFoundException("Book not found");

    await this.prisma.resource.delete({ where: { id } });
    if (existing.storageKey) await fs.rm(this.absolutePath(existing.storageKey), { force: true });

    await this.audit.record({
      actorUserId: actor.id,
      action: "library.book_deleted",
      entityType: "Resource",
      entityId: id,
      metadata: { title: existing.title },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
  }

  /** storageKey is always generated server-side; still refuse anything that escapes the library root. */
  private absolutePath(storageKey: string): string {
    const resolved = path.resolve(LIBRARY_ROOT, path.basename(storageKey));
    if (!resolved.startsWith(LIBRARY_ROOT + path.sep)) throw new NotFoundException("Book not found");
    return resolved;
  }
}
