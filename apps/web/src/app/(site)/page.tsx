import Link from "next/link";
import Image from "next/image";
import { fetchTiers, formatUsd, type TierInfo } from "@/lib/api";
import { BADGES, PARTNERS } from "@/lib/brand";

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

      {/* certification badges */}
      <section className="border-t" style={{ borderColor: "var(--border)" }}>
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-widest text-paca-500">Certification badges</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">A badge for every stage of your Agile career</h2>
            <p className="mt-3 leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Earn your PACA badge, show it on LinkedIn and your CV, and let employers verify it online with your
              credential ID.
            </p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {BADGES.map((b) => (
              <Link
                key={b.tier}
                href={`/membership/${b.slug}`}
                className="group flex flex-col items-center rounded-2xl border p-6 text-center transition hover:-translate-y-1 hover:border-paca-500 hover:shadow-lg"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              >
                <Image
                  src={b.image}
                  alt={`${b.name} badge`}
                  width={180}
                  height={152}
                  className="h-[152px] w-auto rounded-lg object-contain transition group-hover:scale-105"
                />
                <h3 className="mt-4 font-semibold">{b.name}</h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {b.summary}
                </p>
                <span className="mt-auto pt-4 text-sm font-semibold text-paca-500">How to earn it &rarr;</span>
              </Link>
            ))}
          </div>
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

      {/* partners */}
      <section className="border-t" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <div className="mx-auto max-w-6xl px-5 py-14 text-center">
          <h2 className="text-2xl font-bold tracking-tight">Our partners</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm" style={{ color: "var(--text-muted)" }}>
            We work with leading Agile organisations on training, standards and member benefits.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6">
            {PARTNERS.map((p) => (
              <Link
                key={p.name}
                href={`/courses/partners/${p.slug}`}
                className="flex h-32 w-44 items-center justify-center rounded-xl border bg-white p-3 transition hover:border-paca-500 hover:shadow-md"
                style={{ borderColor: "var(--border)" }}
              >
                <Image src={p.logo} alt={p.name} className="max-h-full w-auto object-contain" />
              </Link>
            ))}
          </div>
          <Link href="/courses" className="mt-6 inline-block text-sm font-semibold text-paca-500 hover:underline">
            Explore partner courses &rarr;
          </Link>
        </div>
      </section>
    </main>
  );
}
