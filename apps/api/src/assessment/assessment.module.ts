import { Module } from "@nestjs/common";
import { AssessmentController } from "./assessment.controller";
import { AssessmentService } from "./assessment.service";
import { AdminAssessmentsController } from "./admin-assessments.controller";
import { CertificateModule } from "../certificates/certificate.module";

@Module({
  imports: [CertificateModule],
  controllers: [AssessmentController, AdminAssessmentsController],
  providers: [AssessmentService],
})
export class AssessmentModule {}
