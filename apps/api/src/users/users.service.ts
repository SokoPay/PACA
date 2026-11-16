import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
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
export class UsersService {
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
   * Soft delete only — flips status and stamps deletedAt, never a SQL DELETE.
   * Every other table (payments, attempts, audit_logs, ...) holds a foreign key
   * to this row; hard-deleting it would either cascade-destroy that history or
   * fail outright. auth.service.ts's login() and JwtAuthGuard already treat
   * deletedAt/DELETED as "cannot authenticate", so this alone fully revokes access.
   */
  async softDelete(id: string, actorId: string, ctx: RequestContext) {
    if (id === actorId) throw new ForbiddenException("You cannot delete your own account");

    const before = await this.prisma.user.findUnique({ where: { id }, select: { deletedAt: true } });
    if (!before) throw new NotFoundException("User not found");
    if (before.deletedAt) throw new ForbiddenException("Account is already deleted");

    const user = await this.prisma.user.update({
      where: { id },
      data: { status: "DELETED", deletedAt: new Date() },
      select: LIST_SELECT,
    });

    await this.audit.record({
      actorUserId: actorId,
      action: "user.deleted",
      entityType: "User",
      entityId: id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return user;
  }
}
