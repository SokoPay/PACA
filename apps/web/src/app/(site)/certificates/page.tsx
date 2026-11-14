"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchMyCertificates, restoreSession, viewCertificatePdf, type CertificateItem } from "@/lib/api";

const STATUS_LABEL: Record<CertificateItem["status"], string> = {
  VALID: "Valid",
  SUSPENDED: "Suspended",
  REVOKED: "Revoked",
};

export default function CertificatesPage() {
  const router = useRouter();
  const [certificates, setCertificates] = useState<CertificateItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const session = await restoreSession();
      if (!session) {
        router.replace("/login?next=/certificates");
        return;
      }
      try {
        setCertificates(await fetchMyCertificates());
      } catch {
        setError("Could not load your certificates.");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function handleView(id: string) {
    setError(null);
    try {
      await viewCertificatePdf(id);
    } catch {
      setError("Could not open that certificate.");
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-[50vh] items-center justify-center text-sm" style={{ color: "var(--text-muted)" }}>
        Loading…
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <Link href="/dashboard" className="text-sm text-paca-500 hover:underline">
        ← Back to dashboard
      </Link>
      <h1 className="mt-4 text-2xl font-bold">My certificates</h1>

      {error && (
        <p role="alert" className="mt-6 rounded-lg px-4 py-3 text-sm" style={{ background: "#c0392b1a", color: "#c0392b" }}>
          {error}
        </p>
      )}

      {certificates.length === 0 ? (
        <p className="mt-8 text-sm" style={{ color: "var(--text-muted)" }}>
          You have no certificates yet.{" "}
          <Link href="/assessment" className="text-paca-500 hover:underline">
            Sit the open assessment
          </Link>{" "}
          to earn one.
        </p>
      ) : (
        <ul className="mt-8 space-y-4">
          {certificates.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border p-5"
              style={{ borderColor: "var(--border)" }}
            >
              <div>
                <p className="text-sm font-semibold">
                  {c.tier ? `${c.tier} certification` : "PACA Open Assessment"} · {STATUS_LABEL[c.status]}
                </p>
                <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                  Credential ID {c.credentialId} · issued{" "}
                  {new Date(c.issuedAt).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}
                  {c.scoreBps !== null && ` · ${Math.round(c.scoreBps / 100)}%`}
                </p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Link href={`/verify/${c.credentialId}`} className="text-paca-500 hover:underline">
                  Public link
                </Link>
                <button
                  onClick={() => void handleView(c.id)}
                  className="rounded-lg bg-paca-500 px-4 py-2 font-semibold text-white hover:bg-paca-600"
                >
                  View PDF
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
