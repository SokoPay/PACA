import { Module } from "@nestjs/common";
import { AdminJobsController, MemberJobsController } from "./jobs.controller";
import { JobsService } from "./jobs.service";

@Module({
  controllers: [MemberJobsController, AdminJobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
