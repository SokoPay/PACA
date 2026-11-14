/**
 * Set a registered user's role from the server shell.
 *
 *   npm run db:promote -- someone@example.com SUPERADMIN
 *
 * This is the only way to create the first SUPERADMIN: registration always
 * creates MEMBERs, and the role-change endpoint itself requires a SUPERADMIN.
 */
import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const [emailArg, roleArg = "SUPERADMIN"] = process.argv.slice(2);
  if (!emailArg) {
    console.error("Usage: npm run db:promote -- <email> [MEMBER|REVIEWER|ADMIN|SUPERADMIN]");
    process.exit(1);
  }

  const role = roleArg.toUpperCase() as UserRole;
  if (!Object.values(UserRole).includes(role)) {
    console.error(`Unknown role "${roleArg}". Expected one of: ${Object.values(UserRole).join(", ")}`);
    process.exit(1);
  }

  const email = emailArg.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true, emailVerifiedAt: true } });
  if (!user) {
    console.error(`No user registered with ${email}. Register through the website first.`);
    process.exit(1);
  }

  await prisma.$transaction([
    // Staff accounts are set up by someone with shell access, which is proof
    // enough of the address — mark it verified so they are never locked out.
    prisma.user.update({
      where: { id: user.id },
      data: { role, ...(user.emailVerifiedAt ? {} : { emailVerifiedAt: new Date(), status: "ACTIVE" as const }) },
    }),
    prisma.auditLog.create({
      data: {
        actorUserId: null,
        action: "user.role_changed",
        entityType: "User",
        entityId: user.id,
        metadata: { from: user.role, to: role, via: "cli" },
      },
    }),
  ]);

  console.log(`${email}: ${user.role} -> ${role}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
