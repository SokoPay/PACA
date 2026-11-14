import { ForbiddenException } from "@nestjs/common";
import type { PrismaService } from "./prisma.service";

/** Applying for membership and paying both need a confirmed email address. */
export async function requireVerifiedEmail(prisma: PrismaService, userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { emailVerifiedAt: true } });
  if (!user?.emailVerifiedAt) {
    throw new ForbiddenException("Please verify your email address first. We sent a 6-digit code to your inbox.");
  }
}
