import { Controller, Get, Param, Res } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { CertificateService } from "./certificate.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

/** The signed-in member's own certificates. */
@Controller("certificates")
export class CertificateController {
  constructor(private readonly certificates: CertificateService) {}

  @Get("mine")
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.certificates.listForUser(user.id);
  }

  @Get(":id/pdf")
  async pdf(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser, @Res() res: FastifyReply) {
    const cert = await this.certificates.getOwned(user.id, id);
    const doc = this.certificates.renderPdf(cert);
    res.header("Content-Type", "application/pdf");
    // Browsers' built-in PDF viewers can refuse to render under a strict CSP.
    res.removeHeader("content-security-policy");
    res.header("Content-Disposition", `inline; filename="${cert.credentialId}.pdf"`);
    res.send(doc);
  }
}
