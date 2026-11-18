import { Controller, Get, Param, Res } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { CertificateService } from "./certificate.service";
import { Public } from "../common/decorators/public.decorator";

/**
 * Public certificate verification — no auth, matching how a real employer
 * would check a credential without a PACA account. Only what's printed on the
 * certificate itself is exposed; never the holder's email or account details.
 */
@Public()
@Controller("verify")
export class VerifyController {
  constructor(private readonly certificates: CertificateService) {}

  @Get(":credentialId")
  verify(@Param("credentialId") credentialId: string) {
    return this.certificates.verify(credentialId);
  }

  @Get(":credentialId/pdf")
  async pdf(@Param("credentialId") credentialId: string, @Res() res: FastifyReply) {
    const cert = await this.certificates.getByCredentialId(credentialId);
    const doc = this.certificates.renderPdf(cert);
    res.header("Content-Type", "application/pdf");
    // Browsers' built-in PDF viewers can refuse to render under a strict CSP.
    res.removeHeader("content-security-policy");
    res.header("Content-Disposition", `inline; filename="${cert.credentialId}.pdf"`);
    res.send(doc);
  }
}
