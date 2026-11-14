import Link from "next/link";
import type { PartnerCourse } from "@/lib/catalog";

const LEVEL_DOTS: Record<NonNullable<PartnerCourse["level"]>, number> = {
  Foundational: 1,
  Advanced: 2,
  Professional: 3,
};

export function discountLabel(pct: number | null | undefined): string {
  return pct ? `PACA members save ${pct}%` : "Member discount coming soon";
}

/** One partner course. The whole card opens the course page on PACA. */
export function CourseCard({
  course,
  number,
  discountPercent,
}: {
  course: PartnerCourse;
  number?: number;
  discountPercent: number | null;
}) {
  const facts: Array<[string, string | undefined]> = [
    ["Duration", course.duration],
    ["Format", course.format],
    ["Audience", course.audience],
    ["Prerequisites", course.prerequisites],
    ["Certification", course.certification],
  ];
  const shown = facts.filter(([, v]) => v);

  return (
    <Link
      href={`/courses/partners/${course.partner}/${course.slug}`}
      className="group flex flex-col rounded-2xl border p-5 transition hover:-translate-y-0.5 hover:border-paca-500 hover:shadow-lg"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {number !== undefined && (
            <span className="font-mono text-xs font-bold" style={{ color: "var(--text-muted)" }}>
              {String(number).padStart(2, "0")}
            </span>
          )}
          {course.level && (
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              <span className="flex gap-0.5" aria-hidden>
                {[1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className="h-2 w-2 rounded-full"
                    style={{ background: i <= LEVEL_DOTS[course.level!] ? "var(--color-paca-500)" : "var(--border)" }}
                  />
                ))}
              </span>
              {course.level}
            </span>
          )}
        </div>
        {course.acronym && (
          <span className="rounded-md bg-paca-50 px-2 py-0.5 font-mono text-xs font-bold text-paca-600">{course.acronym}</span>
        )}
      </div>

      <h3 className="mt-3 font-semibold leading-snug group-hover:text-paca-600">{course.title}</h3>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
        {course.summary}
      </p>

      {shown.length > 0 && (
        <dl className="mt-4 space-y-1 text-xs">
          {shown.map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <dt className="w-24 shrink-0" style={{ color: "var(--text-muted)" }}>
                {k}
              </dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-auto flex items-center justify-between gap-3 pt-5">
        <span
          className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
          style={
            discountPercent
              ? { background: "#d4f5e2", color: "#146c3b" }
              : { background: "var(--bg)", color: "var(--text-muted)" }
          }
        >
          {discountPercent ? `Members save ${discountPercent}%` : "Member discount coming soon"}
        </span>
        <span className="text-sm font-semibold text-paca-500">View course &rarr;</span>
      </div>
    </Link>
  );
}
