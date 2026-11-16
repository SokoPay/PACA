import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { CommonModule } from "./common/common.module";
import { AuthModule } from "./auth/auth.module";
import { QuestionsModule } from "./questions/questions.module";
import { MembershipModule } from "./membership/membership.module";
import { UsersModule } from "./users/users.module";
import { ContentModule } from "./content/content.module";
import { AssessmentModule } from "./assessment/assessment.module";
import { ActivityModule } from "./activity/activity.module";
import { CertificateModule } from "./certificates/certificate.module";
import { PaymentsModule } from "./payments/payments.module";
import { LibraryModule } from "./library/library.module";
import { PartnersModule } from "./partners/partners.module";
import { EngagementModule } from "./engagement/engagement.module";
import { JobsModule } from "./jobs/jobs.module";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { HealthController } from "./health.controller";

/**
 * Both guards are registered globally, in order: authenticate, then authorise.
 *
 * This makes every endpoint protected by default. A new controller is secure
 * unless someone explicitly marks it @Public() — the opposite default is how
 * endpoints get shipped wide open.
 */
@Module({
  imports: [
    CommonModule,
    AuthModule,
    QuestionsModule,
    MembershipModule,
    UsersModule,
    ContentModule,
    AssessmentModule,
    ActivityModule,
    CertificateModule,
    PaymentsModule,
    LibraryModule,
    PartnersModule,
    EngagementModule,
    JobsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
