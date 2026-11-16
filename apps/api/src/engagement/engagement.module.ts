import { Module } from "@nestjs/common";
import {
  AdminAnnouncementsController,
  AnnouncementsController,
  NetworkController,
  NotificationsController,
  ProfileController,
  PublicMembersController,
} from "./engagement.controller";
import { EngagementService } from "./engagement.service";

@Module({
  controllers: [
    NotificationsController,
    AnnouncementsController,
    AdminAnnouncementsController,
    ProfileController,
    NetworkController,
    PublicMembersController,
  ],
  providers: [EngagementService],
})
export class EngagementModule {}
