import { ForbiddenException } from "@nestjs/common";
import type { MembershipTier } from "@prisma/client";
import type { PrismaService } from "./prisma.service";

const STAFF = new Set(["ADMIN", "SUPERADMIN"]);

export interface PaidAccess {
  active: boolean;
  staff: boolean;
  tier: MembershipTier | null;
  memberNumber: string | null;
}

/** Whether a user holds an active (paid, in-period) membership. Staff count as active. */
export async function paidAccess(prisma: PrismaService, user: { id: string; role: string }): Promise<PaidAccess> {
  const m = await prisma.membership.findUnique({
    where: { userId: user.id },
    select: { status: true, tier: true, currentPeriodEnd: true, memberNumber: true },
  });
  const active =
    m?.status === "ACTIVE" && (!m.currentPeriodEnd || m.currentPeriodEnd.getTime() > Date.now());
  const staff = STAFF.has(user.role);
  return { active: Boolean(active) || staff, staff, tier: m?.tier ?? null, memberNumber: m?.memberNumber ?? null };
}

/** Throws unless the user is a paid member (or staff). */
export async function requirePaidMember(prisma: PrismaService, user: { id: string; role: string }): Promise<PaidAccess> {
  const access = await paidAccess(prisma, user);
  if (!access.active) {
    throw new ForbiddenException("This is a paid-member benefit. It unlocks once your membership payment is complete.");
  }
  return access;
}
