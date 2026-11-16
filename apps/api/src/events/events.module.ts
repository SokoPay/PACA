import { Module } from "@nestjs/common";
import { AdminEventsController, MemberEventsController, PublicEventsController } from "./events.controller";
import { EventsService } from "./events.service";

@Module({
  controllers: [PublicEventsController, MemberEventsController, AdminEventsController],
  providers: [EventsService],
})
export class EventsModule {}
