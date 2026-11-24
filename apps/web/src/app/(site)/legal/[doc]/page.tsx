import Link from "next/link";
import { notFound } from "next/navigation";
import { LEGAL_DOCS, LEGAL_SLUGS } from "@/content/legal";
import { pageMeta } from "@/lib/seo";

export function generateStaticParams() {
  return LEGAL_SLUGS.map((doc) => ({ doc }));
}

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const found = LEGAL_DOCS[doc];
  return found ? pageMeta(found.title, found.summary, `/legal/${doc}`) : {};
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const legal = LEGAL_DOCS[doc];
  if (!legal) notFound();

  return (
    <main className="mx-auto max-w-3xl px-5 py-16">
      {/* Remove this notice once the documents have been through legal review. */}
      <p className="mb-6 rounded-lg px-4 py-3 text-xs" style={{ background: "#b7791f1a", color: "#b7791f" }}>
        Draft — pending legal review. Not yet in force.
      </p>

      <h1 className="text-3xl font-bold tracking-tight">{legal.title}</h1>
      <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
        {legal.summary}
      </p>
      <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
        Effective from {new Date(legal.effectiveFrom).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
      </p>

      <div className="mt-10 space-y-10">
        {legal.sections.map((s) => (
          <section key={s.heading}>
            <h2 className="text-lg font-semibold">{s.heading}</h2>
            {s.paragraphs.map((p, i) => (
              <p key={i} className="mt-3 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {p}
              </p>
            ))}
            {s.bullets && (
              <ul className="mt-3 space-y-2">
                {s.bullets.map((b, i) => (
                  <li key={i} className="flex gap-3 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                    <span className="text-paca-500">&bull;</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <nav className="mt-14 flex flex-wrap gap-4 border-t pt-6 text-sm" style={{ borderColor: "var(--border)" }}>
        {LEGAL_SLUGS.filter((s) => s !== doc).map((s) => (
          <Link key={s} href={`/legal/${s}`} className="text-paca-500 hover:underline">
            {LEGAL_DOCS[s].title}
          </Link>
        ))}
      </nav>
    </main>
  );
}
