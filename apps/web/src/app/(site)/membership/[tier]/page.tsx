import Link from "next/link";
import { notFound } from "next/navigation";
import Image from "next/image";
import { fetchTiers, formatUsd, type TierInfo } from "@/lib/api";
import { badgeFor } from "@/lib/brand";

export const dynamic = "force-dynamic";

const ELIGIBILITY: Record<string, { summary: string; criteria: string[] }> = {
  STUDENT: {
    summary:
      "For individuals enrolled full time in a degree programme at a university or college, with a genuine interest in Agile practice.",
    criteria: [
      "Enrolled full time at a recognised private or public university or college",
      "Demonstrated interest in Agile, Scrum, Kanban, Lean, Design Thinking or XP",
      "Participation in the Agile on Campus initiative",
      "Valid student ID and a recommendation from your head of department or a senior lecturer",
    ],
  },
  PROFESSIONAL: {
    summary:
      "For practising professionals with relevant qualifications and demonstrable experience delivering with Agile methods.",
    criteria: [
      "A certification, diploma or degree in a relevant field",
      "Demonstrated professional experience in Agile delivery or governance",
      "A current CV naming two contactable referees",
      "Supporting professional or educational certificate",
    ],
  },
  EXECUTIVE: {
    summary:
      "For senior practitioners carrying leadership, governance or organisational decision-making responsibility.",
    criteria: [
      "Advanced educational qualifications",
      "Significant professional experience at a senior level",
      "Specialised knowledge of governance, financial oversight or organisational leadership",
      "Demonstrated authority for decisions in complex environments",
    ],
  },
  FELLOW: {
    summary:
      "The highest PACA distinction, reserved for those who have shaped thinking in the Agile field. Assessed by a panel of academic and industry leaders.",
    criteria: [
      "Ten or more years of exceptional achievement in the Agile field",
      "Published books, articles, papers or sustained public contribution",
      "Recognised as a thought leader shaping current practice",
      "Assessed by panel — there is no written examination for this tier",
    ],
  },
  RETIRED: {
    summary:
      "For members previously in good standing who have retired from active employment and wish to stay involved in the profession.",
    criteria: [
      "Previously a PACA member in good standing for five years or more",
      "Retired from active employment",
      "Retains the full rights of the membership previously held",
      "No re-examination required",
    ],
  },
};

export default async function TierPage({ params }: { params: Promise<{ tier: string }> }) {
  const { tier: slug } = await params;
  const tierKey = slug.toUpperCase();

  let tiers: TierInfo[] = [];
  try {
    tiers = await fetchTiers();
  } catch {
    // fall through to notFound below
  }

  const tier = tiers.find((t) => t.tier === tierKey);
  if (!tier) notFound();

  const info = ELIGIBILITY[tier.tier];
  const requiredFields = tier.form.sections.reduce((n, s) => n + s.fields.filter((f) => f.required).length, 0);

  return (
    <main className="mx-auto max-w-4xl px-5 py-16">
      <Link href="/membership" className="text-sm text-paca-500 hover:underline">
        &larr; All membership types
      </Link>

      {badgeFor(tier.tier) && (
        <Image
          src={badgeFor(tier.tier)!.image}
          alt={`${tier.displayName} badge`}
          width={200}
          height={169}
          priority
          className="mt-6 h-[169px] w-auto rounded-lg object-contain"
        />
      )}

      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">{tier.displayName}</h1>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-paca-500">{formatUsd(tier.priceUsdCents)}</span>
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>
            / year
          </span>
        </div>
      </div>

      <p className="mt-4 leading-relaxed" style={{ color: "var(--text-muted)" }}>
        {info.summary}
      </p>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Eligibility</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {info.criteria.map((c) => (
            <li key={c} className="flex gap-3">
              <span className="text-paca-500">&#10003;</span>
              <span style={{ color: "var(--text-muted)" }}>{c}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Assessment</h2>
        {tier.requiresPanel ? (
          <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Fellowship is assessed by a panel of academic and industry leaders who review your contribution to the
            field. There is no written examination.
          </p>
        ) : tier.requiresExam ? (
          <div
            className="mt-3 grid gap-4 rounded-xl border p-5 text-sm sm:grid-cols-4"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            {[
              ["Questions", String(tier.examQuestionCount)],
              ["Time limit", `${tier.examDurationMins} min`],
              ["Pass mark", `${(tier.passMarkBps ?? 0) / 100}%`],
              ["Attempts", String(tier.attemptsPerEntitlement)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                  {label}
                </dt>
                <dd className="mt-1 text-lg font-semibold">{value}</dd>
              </div>
            ))}
            <p className="sm:col-span-4" style={{ color: "var(--text-muted)" }}>
              Questions are drawn at random and never repeat within a day. If you do not pass within{" "}
              {tier.attemptsPerEntitlement} attempts, a further block of attempts costs{" "}
              {formatUsd(tier.resitPriceUsdCents ?? 0)}.
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
            No examination is required for this membership type.
          </p>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">What the application asks for</h2>
        <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
          {requiredFields} required fields across {tier.form.sections.length} sections, plus supporting documents.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {tier.form.sections.map((s) => (
            <div key={s.title} className="rounded-xl border p-4" style={{ borderColor: "var(--border)" }}>
              <h3 className="text-sm font-semibold">{s.title}</h3>
              <ul className="mt-2 space-y-1 text-xs" style={{ color: "var(--text-muted)" }}>
                {s.fields.map((f) => (
                  <li key={f.name}>
                    {f.label}
                    {f.required && <span className="text-paca-500"> *</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)" }}>
            <h3 className="text-sm font-semibold">Documents to upload</h3>
            <ul className="mt-2 space-y-1 text-xs" style={{ color: "var(--text-muted)" }}>
              {tier.form.documents.map((d) => (
                <li key={d.kind}>
                  {d.label}
                  {d.required && <span className="text-paca-500"> *</span>}
                  {d.help && <span className="block opacity-75">{d.help}</span>}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href={`/apply/${tier.tier.toLowerCase()}`}
          className="rounded-lg bg-paca-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-paca-600"
        >
          Apply for {tier.displayName}
        </Link>
        <Link
          href="/getting-started"
          className="rounded-lg border px-6 py-3 text-sm font-semibold transition hover:border-paca-500"
          style={{ borderColor: "var(--border)" }}
        >
          How membership works
        </Link>
      </div>

      <p className="mt-4 text-xs" style={{ color: "var(--text-muted)" }}>
        Registering is free. You will only be asked to pay once your application has been approved.
      </p>
    </main>
  );
}
