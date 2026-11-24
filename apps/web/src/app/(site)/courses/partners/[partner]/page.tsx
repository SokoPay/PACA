import Link from "next/link";
import { JourneyCta } from "@/components/JourneyCta";
import Image from "next/image";
import { notFound } from "next/navigation";
import { fetchPartnerOffers } from "@/lib/api";
import { coursesFor, partnerInfo, type PartnerCourse } from "@/lib/catalog";
import { partnerBrand } from "@/lib/brand";
import { CourseCard } from "@/components/CourseCard";
import { pageMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ partner: string }> }) {
  const slug = (await params).partner;
  const info = partnerInfo(slug);
  if (!info) return { title: "Courses" };
  return pageMeta(
    `${info.name} courses`,
    `${info.name} courses for Agile practitioners: ${info.tagline} PACA members get partner discounts.`.slice(0, 300),
    `/courses/partners/${slug}`,
  );
}

export default async function PartnerCoursesPage({ params }: { params: Promise<{ partner: string }> }) {
  const info = partnerInfo((await params).partner);
  if (!info) notFound();

  const brand = partnerBrand(info.slug);
  const courses = coursesFor(info.slug);
  const offers = await fetchPartnerOffers().catch(() => []);
  const pct = offers.find((o) => o.slug === info.slug)?.discountPercent ?? null;
  // ProKanban numbers its courses 01–05; keep that.
  const numbered = info.slug === "prokanban";

  const groups = info.groups
    .map((g) => ({ name: g, items: courses.filter((c) => c.group === g) }))
    .filter((g) => g.items.length > 0);
  let n = 0;

  return (
    <main>
      <section className="border-b" style={{ borderColor: "var(--border)" }}>
        <div className="mx-auto max-w-6xl px-5 pb-10 pt-10">
          <Link href="/courses" className="text-sm text-paca-500 hover:underline">
            &larr; All courses
          </Link>
          <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-center">
            {brand && (
              <div className="flex h-28 w-40 shrink-0 items-center justify-center rounded-2xl border bg-white p-3" style={{ borderColor: "var(--border)" }}>
                <Image src={brand.logo} alt={info.name} className="max-h-full w-auto object-contain" />
              </div>
            )}
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{info.name} courses</h1>
              <p className="mt-2 max-w-2xl leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {info.about}
              </p>
            </div>
          </div>

          <div
            className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-5"
            style={{ borderColor: pct ? "#2e9e5b" : "var(--border)", background: pct ? "#effbf3" : "var(--surface)" }}
          >
            <div>
              <p className="font-semibold" style={{ color: pct ? "#146c3b" : "var(--text)" }}>
                {pct ? `PACA members save ${pct}% on ${info.name} courses` : "PACA member discount coming soon"}
              </p>
              <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
                {pct
                  ? "Open any course to get your member discount code. You need an active (paid) PACA membership."
                  : `We are agreeing a discount for PACA members with ${info.name}. You can still view and take every course.`}
              </p>
            </div>
            <JourneyCta
              labels={{ guest: "Become a member", member: null, staff: null }}
              className="rounded-lg bg-paca-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-paca-600"
            />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-5 py-12">
        {groups.length > 1 && (
          <nav className="mb-8 flex flex-wrap gap-2 text-sm">
            {groups.map((g) => (
              <a key={g.name} href={`#${anchor(g.name)}`} className="rounded-full border px-3 py-1.5 hover:border-paca-500 hover:text-paca-500" style={{ borderColor: "var(--border)" }}>
                {g.name} <span style={{ color: "var(--text-muted)" }}>({g.items.length})</span>
              </a>
            ))}
          </nav>
        )}

        {groups.map((g) => (
          <section key={g.name} id={anchor(g.name)} className="mb-12 scroll-mt-24">
            <h2 className="text-xl font-bold tracking-tight">{g.name}</h2>
            <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {g.items.map((c: PartnerCourse) => (
                <CourseCard key={c.slug} course={c} discountPercent={pct} number={numbered ? ++n : undefined} />
              ))}
            </div>
          </section>
        ))}

        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Course details are summarised from{" "}
          <a href={info.catalogueUrl} target="_blank" rel="noreferrer" className="text-paca-500 hover:underline">
            {info.name}&rsquo;s course catalogue
          </a>
          . Dates, prices and the latest details are on the partner&rsquo;s site.
        </p>
      </div>
    </main>
  );
}

function anchor(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
