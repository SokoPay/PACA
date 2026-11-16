import Link from "next/link";
import { fetchTiers, formatUsd, type TierInfo } from "@/lib/api";

export const metadata = {
  title: "Getting started with PACA",
  description: "How to join PACA: application, review, subscription fees and certification.",
};

export const dynamic = "force-dynamic";

const STEPS: Array<[string, string]> = [
  ["Create an account", "Free, and takes a minute. You can take the free competency test straight away."],
  ["Choose your membership type", "Each type has its own eligibility criteria and application form."],
  ["Complete the application", "Fill in the form and upload your supporting documents. Progress saves as you go."],
  ["Board review", "Your application is reviewed. We email you as soon as there is a decision."],
  ["Pay your subscription", "Once approved, pay to unlock your benefits. There is no deadline to pay."],
  ["Sit the assessment", "Earn your certificate and member badge. Certificates are emailed to you on passing."],
];

export default async function GettingStartedPage() {
  let tiers: TierInfo[] = [];
  try {
    tiers = await fetchTiers();
  } catch {
    // The fee table is omitted if the API is briefly unavailable.
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Getting started with PACA</h1>
      <p className="mt-4 leading-relaxed" style={{ color: "var(--text-muted)" }}>
        Applications are submitted to the General Manager in the form the Board prescribes. The Board considers every
        application impartially, regardless of race, gender or language background, and all correspondence is in
        English.
      </p>

      <section className="mt-12">
        <h2 className="text-lg font-semibold">Annual subscriptions</h2>
        <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
          Fees are set by the Board and fall due on 1 January each year. A member who has not paid may not exercise the
          rights of membership or use PACA certifications until payment is complete.
        </p>

        {tiers.length > 0 && (
          <table className="mt-5 w-full text-sm">
            <thead>
              <tr className="border-b text-left" style={{ borderColor: "var(--border)" }}>
                <th className="pb-2 font-semibold">Membership</th>
                <th className="pb-2 text-right font-semibold">Annual fee</th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((t) => (
                <tr key={t.tier} className="border-b" style={{ borderColor: "var(--border)" }}>
                  <td className="py-2.5">
                    <Link href={`/membership/${t.tier.toLowerCase()}`} className="hover:text-paca-500">
                      {t.displayName}
                    </Link>
                  </td>
                  <td className="py-2.5 text-right font-medium">{formatUsd(t.priceUsdCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold">The steps</h2>
        <ol className="mt-4 space-y-5">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="flex gap-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-paca-500 text-xs font-bold text-white">
                {i + 1}
              </span>
              <div>
                <h3 className="text-sm font-semibold">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-12 flex flex-wrap gap-3">
        <Link
          href="/membership"
          className="rounded-lg bg-paca-500 px-6 py-3 text-sm font-semibold text-white hover:bg-paca-600"
        >
          Choose a membership type
        </Link>
        <Link
          href="/register"
          className="rounded-lg border px-6 py-3 text-sm font-semibold hover:border-paca-500"
          style={{ borderColor: "var(--border)" }}
        >
          Create a free account
        </Link>
      </div>
    </main>
  );
}
