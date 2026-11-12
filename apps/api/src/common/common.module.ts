import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { AuditService } from "./audit.service";
import { VirusScanService } from "./virus-scan.service";

/** Global so every feature module gets Prisma, the audit trail and the virus scanner without re-importing. */
@Global()
@Module({
  providers: [PrismaService, AuditService, VirusScanService],
  exports: [PrismaService, AuditService, VirusScanService],
})
export class CommonModule {}
