import { Module } from "@nestjs/common";
import { MembershipController } from "./membership.controller";
import { ApplicationsService } from "./applications.service";
import { AdminApplicationsController } from "./admin-applications.controller";
import { AdminApplicationsService } from "./admin-applications.service";
import { DocumentsController } from "./documents.controller";
import { DocumentsService } from "./documents.service";

@Module({
  controllers: [MembershipController, AdminApplicationsController, DocumentsController],
  providers: [ApplicationsService, AdminApplicationsService, DocumentsService],
})
export class MembershipModule {}
