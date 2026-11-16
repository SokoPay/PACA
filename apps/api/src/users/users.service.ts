import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, type OnModuleInit } from "@nestjs/common";
import { promises as fs } from "fs";
import * as path from "path";
import { UPLOAD_ROOT } from "../membership/documents.service";
import type { UserRole, UserStatus } from "@prisma/client";
import { PrismaService } from "../common/prisma.service";
import { AuditService } from "../common/audit.service";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";
import { TIER_FORMS } from "../membership/tier-forms";

/** Fields a SUPERADMIN may correct on a member's account and profile. */
export interface AdminUserUpdate {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string | null;
  profile?: {
    gender?: "MALE" | "FEMALE" | "UNSPECIFIED";
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    stateProvince?: string | null;
    postalCode?: string | null;
    country?: string | null;
    highestQualification?: string | null;
    yearOfGraduation?: number | null;
    occupation?: string | null;
    employer?: string | null;
    institution?: string | null;
    institutionLevel?: string | null;
    programOfStudy?: string | null;
    linkedinUrl?: string | null;
    bio?: string | null;
  };
}

/** Mirrors RolesGuard's hierarchy. */
const RANK: Record<UserRole, number> = { MEMBER: 0, REVIEWER: 1, ADMIN: 2, SUPERADMIN: 3 };

export interface ListUsersQuery {
  query?: string;
  role?: UserRole;
  status?: UserStatus;
  page: number;
  pageSize: number;
}

export interface RequestContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

const LIST_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(q: ListUsersQuery) {
    const where = {
      ...(q.role ? { role: q.role } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.query
        ? {
            OR: [
              { email: { contains: q.query, mode: "insensitive" as const } },
              { firstName: { contains: q.query, mode: "insensitive" as const } },
              { lastName: { contains: q.query, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: LIST_SELECT,
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  async getOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        ...LIST_SELECT,
        phone: true,
        emailVerifiedAt: true,
        profile: true,
        membership: {
          select: { memberNumber: true, tier: true, status: true, activatedAt: true, currentPeriodEnd: true },
        },
        applications: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            tier: true,
            status: true,
            answers: true,
            submittedAt: true,
            reviewedAt: true,
            decisionReason: true,
            documents: {
              select: { id: true, kind: true, originalName: true, mimeType: true, sizeBytes: true, scanStatus: true, uploadedAt: true },
              orderBy: { uploadedAt: "asc" },
            },
          },
        },
      },
    });
    if (!user) throw new NotFoundException("User not found");
    return { ...user, applications: user.applications.map((a) => ({ ...a, form: TIER_FORMS[a.tier] })) };
  }

  /** SUPERADMIN correction of a member's name, contact details and profile. Every change is audited. */
  async update(id: string, input: AdminUserUpdate, actorId: string, ctx: RequestContext) {
    const before = await this.prisma.user.findUnique({ where: { id }, select: { email: true, deletedAt: true } });
    if (!before || before.deletedAt) throw new NotFoundException("User not found");

    const email = input.email?.trim().toLowerCase();
    if (email && email !== before.email) {
      const taken = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (taken) throw new ConflictException("Another account already uses this email address");
    }

    const userData = {
      ...(input.firstName !== undefined ? { firstName: input.firstName.trim() } : {}),
      ...(input.lastName !== undefined ? { lastName: input.lastName.trim() } : {}),
      ...(email ? { email } : {}),
      ...(input.phone !== undefined ? { phone: input.phone?.trim() || null } : {}),
    };
    const profileData = Object.fromEntries(
      Object.entries(input.profile ?? {}).map(([k, v]) => [k, typeof v === "string" ? v.trim() || null : v]),
    );

    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(userData).length) await tx.user.update({ where: { id }, data: userData });
      if (Object.keys(profileData).length) {
        await tx.profile.upsert({ where: { userId: id }, update: profileData, create: { userId: id, ...profileData } });
      }
    });

    await this.audit.record({
      actorUserId: actorId,
      action: "user.updated_by_admin",
      entityType: "User",
      entityId: id,
      // Field names only — the audit log must not become a second copy of the PII.
      metadata: { fields: [...Object.keys(userData), ...Object.keys(profileData).map((k) => `profile.${k}`)] },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return this.getOne(id);
  }

  async setRole(id: string, role: UserRole, actorId: string, ctx: RequestContext) {
    // Self-service role changes are the classic lockout footgun — a SUPERADMIN
    // demoting themselves with no one else around to undo it.
    if (id === actorId) throw new ForbiddenException("You cannot change your own role");

    const before = await this.prisma.user.findUnique({ where: { id }, select: { role: true } });
    if (!before) throw new NotFoundException("User not found");

    const user = await this.prisma.user.update({ where: { id }, data: { role }, select: LIST_SELECT });

    await this.audit.record({
      actorUserId: actorId,
      action: "user.role_changed",
      entityType: "User",
      entityId: id,
      metadata: { from: before.role, to: role },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return user;
  }

  async setStatus(id: string, status: "ACTIVE" | "SUSPENDED", actor: AuthenticatedUser, ctx: RequestContext) {
    const actorId = actor.id;
    if (id === actorId) throw new ForbiddenException("You cannot change your own account status");

    const before = await this.prisma.user.findUnique({ where: { id }, select: { status: true, role: true } });
    if (!before) throw new NotFoundException("User not found");

    // An ADMIN must not be able to suspend another ADMIN or a SUPERADMIN — that
    // would let a single compromised ADMIN account lock out everyone above it.
    if (actor.role !== "SUPERADMIN" && RANK[before.role] >= RANK[actor.role]) {
      throw new ForbiddenException("You can only change the status of accounts below your own role");
    }

    const user = await this.prisma.user.update({ where: { id }, data: { status }, select: LIST_SELECT });

    await this.audit.record({
      actorUserId: actorId,
      action: status === "SUSPENDED" ? "user.suspended" : "user.reactivated",
      entityType: "User",
      entityId: id,
      metadata: { from: before.status, to: status },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return user;
  }

  /**
   * Permanent delete. The user row and everything that belongs to it — profile,
   * membership, applications, payments, exam attempts, certificates,
   * notifications, sessions — is removed by the database (ON DELETE CASCADE),
   * and their uploaded documents are deleted from disk. Rows they merely
   * touched (questions they reviewed, other people's applications they
   * decided) keep their content with the link to the person cleared.
   * The activity log keeps only "an account was deleted", never their details.
   */
  async deletePermanently(id: string, actorId: string | null, ctx: RequestContext) {
    if (actorId && id === actorId) throw new ForbiddenException("You cannot delete your own account");

    const before = await this.prisma.user.findUnique({
      where: { id },
      select: { role: true, applications: { select: { id: true } } },
    });
    if (!before) throw new NotFoundException("User not found");

    await this.prisma.user.delete({ where: { id } });

    for (const a of before.applications) {
      // Application IDs are cuids, so this always stays inside UPLOAD_ROOT.
      await fs.rm(path.join(UPLOAD_ROOT, path.basename(a.id)), { recursive: true, force: true }).catch(() => {});
    }

    await this.audit.record({
      actorUserId: actorId,
      action: "user.deleted",
      entityType: "User",
      entityId: id,
      metadata: { role: before.role, permanent: true },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    return { deleted: true };
  }

  /** Accounts deleted before deletion became permanent are wiped on start-up. */
  async onModuleInit() {
    try {
      const old = await this.prisma.user.findMany({
        where: { OR: [{ deletedAt: { not: null } }, { status: "DELETED" }] },
        select: { id: true },
      });
      for (const u of old) await this.deletePermanently(u.id, null, {});
      if (old.length) this.logger.log(`Permanently removed ${old.length} previously deleted account(s)`);
    } catch (err) {
      this.logger.error(`Could not purge previously deleted accounts: ${(err as Error).message}`);
    }
  }
}
