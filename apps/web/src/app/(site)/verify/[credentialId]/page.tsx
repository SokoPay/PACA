import { certificatePdfUrl, verifyCertificate, type VerifyResult } from "@/lib/api";

export const metadata = {
  title: "Verify a certificate",
  description: "Check that a PACA certificate is genuine.",
};

const STATUS_LABEL: Record<VerifyResult["status"], string> = {
  VALID: "Valid",
  SUSPENDED: "Suspended",
  REVOKED: "Revoked",
};

/** Public page printed on every certificate PDF — no account needed to verify. */
export default async function VerifyPage({ params }: { params: Promise<{ credentialId: string }> }) {
  const { credentialId } = await params;
  const cert = await verifyCertificate(credentialId).catch(() => null);

  return (
    <main className="mx-auto max-w-3xl px-5 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Certificate verification</h1>

      {!cert ? (
        <p className="mt-6 leading-relaxed" style={{ color: "var(--text-muted)" }}>
          No certificate was found with the credential ID <strong>{credentialId}</strong>. Check the ID printed on
          the certificate and try again.
        </p>
      ) : (
        <div className="mt-8 rounded-xl border p-6" style={{ borderColor: "var(--border)" }}>
          <p className="text-sm font-semibold">{STATUS_LABEL[cert.status]}</p>
          <p className="mt-2 text-2xl font-bold">{cert.holderName}</p>
          <dl className="mt-4 space-y-1 text-sm" style={{ color: "var(--text-muted)" }}>
            <div>
              <dt className="inline">Credential ID: </dt>
              <dd className="inline">{cert.credentialId}</dd>
            </div>
            <div>
              <dt className="inline">Awarded for: </dt>
              <dd className="inline">{cert.tier ? `${cert.tier} certification exam` : "PACA completion certificate"}</dd>
            </div>
            {cert.scoreBps !== null && (
              <div>
                <dt className="inline">Score: </dt>
                <dd className="inline">{Math.round(cert.scoreBps / 100)}%</dd>
              </div>
            )}
            <div>
              <dt className="inline">Issued: </dt>
              <dd className="inline">
                {new Date(cert.issuedAt).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}
              </dd>
            </div>
            {cert.revokedReason && (
              <div>
                <dt className="inline">Reason: </dt>
                <dd className="inline">{cert.revokedReason}</dd>
              </div>
            )}
          </dl>
          {cert.status === "VALID" && (
            <a
              href={certificatePdfUrl(cert.credentialId)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-block text-sm font-semibold underline"
            >
              View certificate PDF
            </a>
          )}
        </div>
      )}
    </main>
  );
}
