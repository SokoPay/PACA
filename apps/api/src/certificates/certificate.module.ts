import { Module } from "@nestjs/common";
import { CertificateController } from "./certificate.controller";
import { VerifyController } from "./verify.controller";
import { CertificateService } from "./certificate.service";

@Module({
  controllers: [CertificateController, VerifyController],
  providers: [CertificateService],
  exports: [CertificateService],
})
export class CertificateModule {}
