import { Module } from "@nestjs/common";
import { AdminLibraryController, LibraryController } from "./library.controller";
import { LibraryService } from "./library.service";

@Module({
  controllers: [LibraryController, AdminLibraryController],
  providers: [LibraryService],
})
export class LibraryModule {}
