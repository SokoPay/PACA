import { Module } from "@nestjs/common";
import { AdminPartnerOffersController, PartnerOffersController } from "./partner-offers.controller";
import { PartnerOffersService } from "./partner-offers.service";

@Module({
  controllers: [PartnerOffersController, AdminPartnerOffersController],
  providers: [PartnerOffersService],
})
export class PartnersModule {}
