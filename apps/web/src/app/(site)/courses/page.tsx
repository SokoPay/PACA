import { fetchCourses, formatUsd } from "@/lib/api";

export const metadata = {
  title: "Courses",
  description: "PACA and partner courses for Agile, Scrum, Kanban and Lean practitioners.",
};

export default async function CoursesPage() {
  const courses = await fetchCourses().catch(() => []);

  return (
    <main className="mx-auto max-w-3xl px-5 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Courses</h1>
      <p className="mt-4 leading-relaxed" style={{ color: "var(--text-muted)" }}>
        Courses run by PACA and our training partners.
      </p>

      {courses.length === 0 ? (
        <p className="mt-10 text-sm" style={{ color: "var(--text-muted)" }}>
          No courses are published yet — check back soon.
        </p>
      ) : (
        <div className="mt-8 space-y-4">
          {courses.map((c) => (
            <div key={c.id} className="rounded-xl border p-5" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-start justify-between gap-4">
                <h2 className="font-semibold">{c.title}</h2>
                <span className="shrink-0 text-sm font-semibold text-paca-500">
                  {c.isFree ? "Free" : formatUsd(c.priceUsdCents)}
                </span>
              </div>
              {c.summary && (
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {c.summary}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
                {c.partner && <span>By {c.partner.name}</span>}
                {c.durationMins && <span>{c.durationMins} mins</span>}
                {c.externalUrl && (
                  <a href={c.externalUrl} className="text-paca-500 hover:underline" target="_blank" rel="noreferrer">
                    View course &rarr;
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
