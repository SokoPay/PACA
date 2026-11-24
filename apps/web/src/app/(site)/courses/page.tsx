import Link from "next/link";
import Image from "next/image";
import { fetchPartnerOffers, type PartnerOffer } from "@/lib/api";
import { PACA_COURSES, PARTNER_INFO, coursesFor } from "@/lib/catalog";
import { partnerBrand } from "@/lib/brand";
import { discountLabel } from "@/components/CourseCard";
import { PageHero } from "@/components/PageHero";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta("Explore courses", "Courses from PACA's training partners Scrum.org, ProKanban.org and Scrum Alliance, with discounts for PACA members.", "/courses");

export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  const offers: PartnerOffer[] = await fetchPartnerOffers().catch(() => []);
  const pct = (slug: string) => offers.find((o) => o.slug === slug)?.discountPercent ?? null;

  return (
    <main>
      <PageHero
        eyebrow="Explore courses"
        title="Train with the world’s leading Agile bodies, for less."
        lead="Pick a partner, choose a course, and take it with your PACA membership. Members with an active membership get an agreed discount on partner courses."
      >
        <div className="flex flex-wrap gap-3 text-sm">
          {[
            ["1", "Choose a partner course"],
            ["2", "Use your PACA member discount"],
            ["3", "Get certified and grow your career"],
          ].map(([n, t]) => (
            <span key={n} className="flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 backdrop-blur">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-bold text-paca-600">{n}</span>
              {t}
            </span>
          ))}
        </div>
      </PageHero>

      <section id="partners" className="mx-auto max-w-6xl px-5 py-14">
        <h2 className="text-2xl font-bold tracking-tight">Partner courses</h2>
        <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
          Select a partner to see all of their courses.
        </p>

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {PARTNER_INFO.map((p) => {
            const brand = partnerBrand(p.slug);
            const count = coursesFor(p.slug).length;
            const d = pct(p.slug);
            return (
              <Link
                key={p.slug}
                href={`/courses/partners/${p.slug}`}
                className="group flex flex-col overflow-hidden rounded-2xl border transition hover:-translate-y-1 hover:border-paca-500 hover:shadow-xl"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              >
                <div className="flex h-40 items-center justify-center bg-white p-6">
                  {brand && <Image src={brand.logo} alt={p.name} className="max-h-full w-auto object-contain transition group-hover:scale-105" />}
                </div>
                <div className="flex flex-1 flex-col border-t p-5" style={{ borderColor: "var(--border)" }}>
                  <h3 className="text-lg font-semibold">{p.name}</h3>
                  <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
                    {p.tagline}
                  </p>
                  <div className="mt-auto flex items-center justify-between pt-5 text-sm">
                    <span className="font-medium">{count} courses</span>
                    <span
                      className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                      style={d ? { background: "#d4f5e2", color: "#146c3b" } : { background: "var(--bg)", color: "var(--text-muted)" }}
                    >
                      {discountLabel(d)}
                    </span>
                  </div>
                  <span className="mt-4 text-sm font-semibold text-paca-500">Browse courses &rarr;</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section id="paca" className="border-t" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <div className="mx-auto max-w-6xl px-5 py-14">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">PACA courses</h2>
              <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
                Courses PACA will offer directly. Dates and enrolment open soon.
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PACA_COURSES.map((c) => (
              <div key={c.title} className="flex flex-col rounded-2xl border p-5" style={{ borderColor: "var(--border)", background: "var(--bg)" }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-paca-500">{c.category}</span>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "#fdf2d0", color: "#8a6100" }}>
                    Coming soon
                  </span>
                </div>
                <h3 className="mt-3 font-semibold leading-snug">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {c.summary}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
