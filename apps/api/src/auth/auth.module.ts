import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { PasswordService } from "./password.service";
import { TokensService } from "./tokens.service";
import { EmailVerificationService } from "./email-verification.service";
import { PasswordResetService } from "./password-reset.service";

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, TokensService, EmailVerificationService, PasswordResetService],
  exports: [TokensService],
})
export class AuthModule {}
