import Link from "next/link";
import { fetchTiers, formatUsd, type TierInfo } from "@/lib/api";

export const metadata = {
  title: "PACA — Professional Agile Certification, Africa",
  description:
    "PACA sets benchmark standards for the Agile profession in Africa, certifying practitioners in Agile, Scrum, Kanban and DevOps.",
};

/** Rendered per request so tier prices always match the database. */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  let tiers: TierInfo[] = [];
  try {
    tiers = await fetchTiers();
  } catch {
    // The marketing page must still render if the API is briefly unavailable.
  }

  return (
    <main>
      {/* hero */}
      <section className="mx-auto max-w-6xl px-5 pb-16 pt-20">
        <p className="text-sm font-semibold uppercase tracking-widest text-paca-500">
          Professional Agile Certification &mdash; Africa
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          Benchmark standards for the Agile profession in Africa.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed" style={{ color: "var(--text-muted)" }}>
          PACA provides professional, educational and representational support across the Agile, Scrum, DevOps and
          Kanban community &mdash; issuing certifications, maintaining a register of members, and advancing the
          profession across the continent.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/membership"
            className="rounded-lg bg-paca-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-paca-600"
          >
            Secure your membership
          </Link>
          <Link
            href="/assessment"
            className="rounded-lg border px-6 py-3 text-sm font-semibold transition hover:border-paca-500 hover:text-paca-500"
            style={{ borderColor: "var(--border)" }}
          >
            Try the free assessment
          </Link>
        </div>
      </section>

      {/* what PACA does */}
      <section className="border-y" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <div className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="text-2xl font-bold tracking-tight">What PACA does</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Benchmark standards", "Sets and maintains the standard for Agile certification, so a PACA credential means something to employers."],
              ["Research", "Conducts research to build, grow and enhance the Agile, Scrum and Kanban profession."],
              ["Education", "Influences the education and development of Agile practitioners across Africa."],
              ["Certification", "Issues certificates for professional designations gained and maintained."],
              ["Member register", "Maintains and publishes a register of members in good standing."],
              ["Career pathways", "Communicates the career paths available within the community."],
            ].map(([title, body]) => (
              <div key={title} className="rounded-xl border p-5" style={{ borderColor: "var(--border)" }}>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* membership tiers */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Membership</h2>
            <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
              Annual subscription, due 1 January. Register free and pay when you are ready.
            </p>
          </div>
          <Link href="/membership" className="text-sm font-semibold text-paca-500 hover:underline">
            Compare all types &rarr;
          </Link>
        </div>

        {tiers.length > 0 ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tiers.map((t) => (
              <Link
                key={t.tier}
                href={`/membership/${t.tier.toLowerCase()}`}
                className="rounded-xl border p-5 transition hover:border-paca-500"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              >
                <div className="flex items-baseline justify-between">
                  <h3 className="font-semibold">{t.displayName}</h3>
                  <span className="text-lg font-bold text-paca-500">{formatUsd(t.priceUsdCents)}</span>
                </div>
                <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
                  {t.requiresPanel
                    ? "Assessed by a panel of academic and industry leaders"
                    : t.requiresExam
                      ? `${t.examQuestionCount} questions · ${t.examDurationMins} minutes · ${(t.passMarkBps ?? 0) / 100}% to pass`
                      : "Retains the credential held before retirement"}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-8 text-sm" style={{ color: "var(--text-muted)" }}>
            Membership details are temporarily unavailable. Please try again shortly.
          </p>
        )}
      </section>
    </main>
  );
}
