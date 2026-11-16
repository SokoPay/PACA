import { Module } from "@nestjs/common";
import { PublicContentService } from "./public-content.service";
import {
  CoursesController,
  DirectoryController,
  FaqController,
  PartnersController,
  ResourcesController,
} from "./public-content.controller";

@Module({
  controllers: [CoursesController, PartnersController, ResourcesController, FaqController, DirectoryController],
  providers: [PublicContentService],
})
export class ContentModule {}
