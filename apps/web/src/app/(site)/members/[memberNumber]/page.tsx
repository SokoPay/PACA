import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchPublicMember, siteUrl } from "@/lib/api";
import { badgeFor } from "@/lib/brand";
import { ShareButtons } from "@/components/ShareButtons";

export const dynamic = "force-dynamic";

type Params = Promise<{ memberNumber: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const m = await fetchPublicMember((await params).memberNumber).catch(() => null);
  if (!m) return { title: "PACA member" };
  const title = `${m.name} — ${m.tierName}, PACA`;
  const description = `${m.name} is a ${m.inGoodStanding ? "member in good standing" : "member"} of Professional Agile Certification Africa (PACA). Member ${m.memberNumber}.`;
  return {
    title,
    description,
    alternates: { canonical: `/members/${m.memberNumber}` },
    openGraph: { title, description, type: "profile" },
    twitter: { card: "summary_large_image", title, description },
    robots: { index: false, follow: true },
  };
}

const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }) : "—");

export default async function MemberBadgePage({ params }: { params: Params }) {
  const { memberNumber } = await params;
  const m = await fetchPublicMember(memberNumber).catch(() => null);
  if (!m) notFound();
  const badge = badgeFor(m.tier);
  const url = siteUrl(`/members/${m.memberNumber}`);

  return (
    <main className="mx-auto max-w-3xl px-5 py-14">
      <section className="overflow-hidden rounded-3xl border shadow-xl" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <div className="paca-gradient flex flex-col items-center gap-6 px-8 py-10 text-white sm:flex-row">
          {badge && (
            <Image src={badge.image} alt={`${m.tierName} badge`} width={200} height={169} priority className="h-[169px] w-auto rounded-2xl bg-white p-2 shadow-lg" />
          )}
          <div className="text-center sm:text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">Verified PACA member</p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{m.name}</h1>
            <p className="mt-1 text-lg text-white/90">
              {m.tierName}
              {m.designation ? ` · ${m.designation}` : ""}
            </p>
            <span
              className="mt-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold"
              style={{ background: m.inGoodStanding ? "#d4f5e2" : "#fdf2d0", color: m.inGoodStanding ? "#146c3b" : "#8a6100" }}
            >
              {m.inGoodStanding ? "✓ In good standing" : "Membership not currently active"}
            </span>
          </div>
        </div>

        <dl className="grid gap-px sm:grid-cols-3" style={{ background: "var(--border)" }}>
          {[
            ["Member number", m.memberNumber],
            ["Member since", fmt(m.memberSince)],
            ["Valid until", fmt(m.validUntil)],
          ].map(([k, v]) => (
            <div key={k} className="p-5" style={{ background: "var(--surface)" }}>
              <dt className="text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{k}</dt>
              <dd className="mt-1 font-semibold">{v}</dd>
            </div>
          ))}
        </dl>

        {m.certificates.length > 0 && (
          <div className="border-t p-6" style={{ borderColor: "var(--border)" }}>
            <h2 className="font-semibold">Certifications</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {m.certificates.map((c) => (
                <li key={c.credentialId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3" style={{ background: "var(--bg)" }}>
                  <span>
                    {c.designation ?? c.tier} · issued {fmt(c.issuedAt)}
                  </span>
                  <Link href={`/verify/${c.credentialId}`} className="font-mono text-xs font-semibold text-paca-500 hover:underline">
                    Verify {c.credentialId} →
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="border-t p-6" style={{ borderColor: "var(--border)" }}>
          <p className="mb-3 text-sm font-semibold">Share</p>
          <ShareButtons url={url} text={`${m.name} is a ${m.tierName} of PACA — Professional Agile Certification Africa.`} />
        </div>
      </section>

      <p className="mt-6 text-center text-xs" style={{ color: "var(--text-muted)" }}>
        PACA keeps a public register of its members. This page shows only membership details — never contact information.
      </p>
    </main>
  );
}
