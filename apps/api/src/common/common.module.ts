import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { AuditService } from "./audit.service";
import { VirusScanService } from "./virus-scan.service";
import { MailService } from "./mail.service";
import { NotificationsService } from "./notifications.service";

/** Global so every feature module gets Prisma, the audit trail, the virus scanner and mail without re-importing. */
@Global()
@Module({
  providers: [PrismaService, AuditService, VirusScanService, MailService, NotificationsService],
  exports: [PrismaService, AuditService, VirusScanService, MailService, NotificationsService],
})
export class CommonModule {}
