import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { AuditService } from "./audit.service";

/** Global so every feature module gets Prisma and the audit trail without re-importing. */
@Global()
@Module({
  providers: [PrismaService, AuditService],
  exports: [PrismaService, AuditService],
})
export class CommonModule {}
