import Image from "next/image";
import { fetchPartners } from "@/lib/api";
import { PARTNERS } from "@/lib/brand";
import { PageHero } from "@/components/PageHero";

export const metadata = {
  title: "Partners",
  description: "Organisations PACA partners with for training, tooling and discounts.",
};

export default async function PartnersPage() {
  const known = new Set(PARTNERS.map((p) => p.name.toLowerCase()));
  // Partners added in the database that don't have a logo here are listed below the logo cards.
  const partners = (await fetchPartners().catch(() => [])).filter((p) => !known.has(p.name.toLowerCase()));

  return (
    <main>
      <PageHero eyebrow={"Partners"} title={"Our training partners"} lead={"PACA works with the world's leading Agile bodies so members can learn for less."} />
      <div className="mx-auto max-w-5xl px-5 py-14">
      <p className="mt-4 leading-relaxed" style={{ color: "var(--text-muted)" }}>
        Organisations PACA works with on training, tooling and member discounts.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PARTNERS.map((p) => (
          <a
            key={p.name}
            href={`/courses/partners/${p.slug}`}
            className="flex flex-col rounded-xl border p-5 transition hover:border-paca-500 hover:shadow-md"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <div className="flex h-28 items-center justify-center rounded-lg bg-white p-3">
              <Image src={p.logo} alt={p.name} className="max-h-full w-auto object-contain" />
            </div>
            <h2 className="mt-4 font-semibold">{p.name}</h2>
            <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
              {p.description}
            </p>
            <span className="mt-3 text-sm font-semibold text-paca-500">View courses &amp; member discount &rarr;</span>
          </a>
        ))}
      </div>

      {partners.length > 0 && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {partners.map((p) => (
            <div key={p.id} className="rounded-xl border p-5" style={{ borderColor: "var(--border)" }}>
              <h2 className="font-semibold">{p.name}</h2>
              {p.description && (
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {p.description}
                </p>
              )}
              {p.websiteUrl && (
                <a
                  href={p.websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block text-sm text-paca-500 hover:underline"
                >
                  Visit website &rarr;
                </a>
              )}
            </div>
          ))}
        </div>
      )}
      </div>
    </main>
  );
}
