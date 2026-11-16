import Link from "next/link";
import Image from "next/image";
import { fetchTiers, formatUsd, type TierInfo } from "@/lib/api";
import { badgeFor } from "@/lib/brand";
import { PageHero } from "@/components/PageHero";

export const metadata = {
  title: "PACA Membership",
  description: "Compare PACA Student, Professional, Executive, Fellow and Retired membership.",
};

export const dynamic = "force-dynamic";

function assessmentSummary(t: TierInfo): string {
  if (t.requiresPanel) return "Panel assessed";
  if (!t.requiresExam) return "No exam required";
  return `${t.examQuestionCount} questions in ${t.examDurationMins} min`;
}

export default async function MembershipPage() {
  let tiers: TierInfo[] = [];
  let failed = false;
  try {
    tiers = await fetchTiers();
  } catch {
    failed = true;
  }

  return (
    <main>
      <PageHero eyebrow={"Membership"} title={"Choose the membership that fits your career"} lead={"Five membership types, from students starting out to Fellows shaping the profession. Register free, pay when you're approved."} />
      <div className="mx-auto max-w-6xl px-5 py-14">
      <p className="mt-3 max-w-2xl leading-relaxed" style={{ color: "var(--text-muted)" }}>
        Each membership type has its own requirements and application form. Subscriptions run annually and fall due on
        1 January. You can register now and pay later &mdash; your certificate and member badge unlock once payment
        clears.
      </p>

      {failed && (
        <p className="mt-8 rounded-lg px-4 py-3 text-sm" style={{ background: "#c0392b1a", color: "#c0392b" }}>
          Membership details are temporarily unavailable. Please try again shortly.
        </p>
      )}

      <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {tiers.map((t) => (
          <div
            key={t.tier}
            className="flex flex-col rounded-xl border p-6"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            {badgeFor(t.tier) && (
              <Image
                src={badgeFor(t.tier)!.image}
                alt={`${t.displayName} badge`}
                width={140}
                height={118}
                className="mb-4 h-[118px] w-auto self-center rounded-lg object-contain"
              />
            )}
            <h2 className="text-lg font-semibold">{t.displayName}</h2>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-3xl font-bold text-paca-500">{formatUsd(t.priceUsdCents)}</span>
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                / year
              </span>
            </div>

            <dl className="mt-5 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt style={{ color: "var(--text-muted)" }}>Assessment</dt>
                <dd className="text-right font-medium">{assessmentSummary(t)}</dd>
              </div>
              {t.requiresExam && (
                <>
                  <div className="flex justify-between gap-3">
                    <dt style={{ color: "var(--text-muted)" }}>Pass mark</dt>
                    <dd className="font-medium">{(t.passMarkBps ?? 0) / 100}%</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt style={{ color: "var(--text-muted)" }}>Attempts included</dt>
                    <dd className="font-medium">{t.attemptsPerEntitlement}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt style={{ color: "var(--text-muted)" }}>Further attempts</dt>
                    <dd className="font-medium">{formatUsd(t.resitPriceUsdCents ?? 0)}</dd>
                  </div>
                </>
              )}
              <div className="flex justify-between gap-3">
                <dt style={{ color: "var(--text-muted)" }}>Documents</dt>
                <dd className="font-medium">{t.form.documents.filter((d) => d.required).length} required</dd>
              </div>
            </dl>

            <Link
              href={`/membership/${t.tier.toLowerCase()}`}
              className="mt-6 rounded-lg bg-paca-500 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-paca-600"
            >
              Requirements &amp; apply
            </Link>
          </div>
        ))}
      </div>

      <section className="mt-14 rounded-xl border p-6" style={{ borderColor: "var(--border)" }}>
        <h2 className="font-semibold">How membership works</h2>
        <ol className="mt-4 space-y-3 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
          <li>
            <strong style={{ color: "var(--text)" }}>1. Register.</strong> Create an account. This is free and takes a
            minute.
          </li>
          <li>
            <strong style={{ color: "var(--text)" }}>2. Apply.</strong> Complete the form for your membership type and
            upload the supporting documents.
          </li>
          <li>
            <strong style={{ color: "var(--text)" }}>3. Review.</strong> The board considers every application
            impartially, without regard to race, gender or language.
          </li>
          <li>
            <strong style={{ color: "var(--text)" }}>4. Pay.</strong> Once approved, pay your subscription to unlock
            your benefits. There is no deadline &mdash; pay whenever you are ready.
          </li>
          <li>
            <strong style={{ color: "var(--text)" }}>5. Certify.</strong> Sit the certification exam (3 chances), and on passing receive
            your certificate by email plus a badge you can share on LinkedIn.
          </li>
        </ol>
      </section>
      </div>
    </main>
  );
}
