import { Module } from "@nestjs/common";
import { PublicContentService } from "./public-content.service";
import {
  CoursesController,
  DirectoryController,
  FaqController,
  JobsController,
  PartnersController,
  ResourcesController,
} from "./public-content.controller";

@Module({
  controllers: [CoursesController, PartnersController, ResourcesController, FaqController, JobsController, DirectoryController],
  providers: [PublicContentService],
})
export class ContentModule {}
