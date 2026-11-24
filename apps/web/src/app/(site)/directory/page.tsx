import Image from "next/image";
import Link from "next/link";
import { TIER_LABEL, fetchDirectory } from "@/lib/api";
import { badgeFor } from "@/lib/brand";
import { PageHero } from "@/components/PageHero";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta("Professional database", "PACA members in good standing who chose to be listed.", "/directory");

export const dynamic = "force-dynamic";

export default async function DirectoryPage() {
  const people = await fetchDirectory().catch(() => []);

  return (
    <main>
      <PageHero eyebrow={"Community"} title={"Professional database"} lead={"Verified PACA members in good standing across Africa."} />
      <div className="mx-auto max-w-5xl px-5 py-14">
      <p className="mt-3 max-w-2xl leading-relaxed" style={{ color: "var(--text-muted)" }}>
        PACA members in good standing who chose to be listed. Each badge links to the member&rsquo;s verified badge page.
        Paid members can see full profiles and LinkedIn links in the{" "}
        <Link href="/dashboard/network" className="font-semibold text-paca-500 hover:underline">professional network</Link>.
      </p>

      {people.length === 0 ? (
        <p className="mt-10 text-sm" style={{ color: "var(--text-muted)" }}>No members are listed yet.</p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {people.map((p, i) => {
            const tier = p.user.membership?.tier;
            const badge = tier ? badgeFor(tier) : undefined;
            const card = (
              <div className="flex h-full items-center gap-4 rounded-2xl border p-4 transition hover:border-paca-500" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                {badge ? (
                  <Image src={badge.image} alt={`${badge.name} badge`} width={64} height={54} className="h-[54px] w-16 shrink-0 rounded-lg object-contain" />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-paca-500 font-bold text-white">{p.user.firstName.charAt(0)}</div>
                )}
                <div className="min-w-0">
                  <h2 className="truncate font-semibold">{p.user.firstName} {p.user.lastName}</h2>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {[tier ? TIER_LABEL[tier] : null, p.occupation, p.country].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </div>
            );
            return p.user.membership ? (
              <Link key={i} href={`/members/${p.user.membership.memberNumber}`}>{card}</Link>
            ) : (
              <div key={i}>{card}</div>
            );
          })}
        </div>
      )}
      </div>
    </main>
  );
}
