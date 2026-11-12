import { Module } from "@nestjs/common";
import { AdminPaymentsController, PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { PaystackClient } from "./paystack.client";

@Module({
  controllers: [PaymentsController, AdminPaymentsController],
  providers: [PaymentsService, PaystackClient],
})
export class PaymentsModule {}
