import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { fetchPartnerOffers } from "@/lib/api";
import { coursesFor, findCourse, partnerInfo } from "@/lib/catalog";
import { partnerBrand } from "@/lib/brand";
import { CourseCard } from "@/components/CourseCard";
import { MemberOffer } from "@/components/MemberOffer";

export const dynamic = "force-dynamic";

type Params = Promise<{ partner: string; course: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { partner, course } = await params;
  const c = findCourse(partner, course);
  return { title: c ? `${c.title} — ${partnerInfo(partner)?.name}` : "Course" };
}

export default async function PartnerCoursePage({ params }: { params: Params }) {
  const { partner, course: slug } = await params;
  const info = partnerInfo(partner);
  const course = findCourse(partner, slug);
  if (!info || !course) notFound();

  const brand = partnerBrand(info.slug);
  const offers = await fetchPartnerOffers().catch(() => []);
  const pct = offers.find((o) => o.slug === info.slug)?.discountPercent ?? null;

  const facts: Array<[string, string | undefined]> = [
    ["Level", course.level],
    ["Duration", course.duration],
    ["Format", course.format],
    ["Who it's for", course.audience],
    ["Prerequisites", course.prerequisites],
    ["Certification", course.certification],
    ["Track", course.group],
  ];

  const related = coursesFor(info.slug)
    .filter((c) => c.slug !== course.slug && c.group === course.group)
    .slice(0, 3);

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <nav className="text-sm" style={{ color: "var(--text-muted)" }}>
        <Link href="/courses" className="text-paca-500 hover:underline">
          Courses
        </Link>{" "}
        /{" "}
        <Link href={`/courses/partners/${info.slug}`} className="text-paca-500 hover:underline">
          {info.name}
        </Link>{" "}
        / {course.acronym ?? course.title}
      </nav>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_340px]">
        <div>
          <div className="flex items-center gap-4">
            {brand && (
              <div className="flex h-16 w-20 shrink-0 items-center justify-center rounded-xl border bg-white p-2" style={{ borderColor: "var(--border)" }}>
                <Image src={brand.logo} alt={info.name} className="max-h-full w-auto object-contain" />
              </div>
            )}
            <div>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                {info.name}
              </p>
              {course.acronym && <span className="font-mono text-sm font-bold text-paca-600">{course.acronym}</span>}
            </div>
          </div>

          <h1 className="mt-5 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{course.title}</h1>
          <p className="mt-4 text-lg leading-relaxed" style={{ color: "var(--text-muted)" }}>
            {course.summary}
          </p>

          <dl className="mt-8 grid gap-px overflow-hidden rounded-2xl border sm:grid-cols-2" style={{ borderColor: "var(--border)", background: "var(--border)" }}>
            {facts
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="p-4" style={{ background: "var(--surface)" }}>
                  <dt className="text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    {k}
                  </dt>
                  <dd className="mt-1 font-medium">{v}</dd>
                </div>
              ))}
          </dl>

          <section className="mt-10">
            <h2 className="text-lg font-semibold">How to take this course with PACA</h2>
            <ol className="mt-4 space-y-3 text-sm leading-relaxed">
              {[
                "Hold an active PACA membership: register free, apply for your membership type and pay your subscription.",
                "Open this page while signed in to see your member discount code.",
                `Book the course on ${info.name}'s site and apply your code (or follow the redemption steps shown).`,
                "Complete the course and add the certification to your PACA profile.",
              ].map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-paca-500 text-xs font-bold text-white">{i + 1}</span>
                  <span style={{ color: "var(--text-muted)" }}>{step}</span>
                </li>
              ))}
            </ol>
          </section>

          <div className="mt-8 flex flex-wrap gap-4 text-sm">
            <a href={course.url} target="_blank" rel="noreferrer" className="font-semibold text-paca-500 hover:underline">
              Full course details on {info.name} &#8599;
            </a>
            {course.datesUrl && (
              <a href={course.datesUrl} target="_blank" rel="noreferrer" className="font-semibold text-paca-500 hover:underline">
                Find a date &#8599;
              </a>
            )}
          </div>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <MemberOffer partnerSlug={info.slug} partnerName={info.name} publicPercent={pct} courseUrl={course.url} />
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="text-xl font-bold tracking-tight">More in {course.group}</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((c) => (
              <CourseCard key={c.slug} course={c} discountPercent={pct} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
