import { fetchJobs } from "@/lib/api";

export const metadata = {
  title: "Jobs",
  description: "Agile, Scrum and product roles aggregated for the PACA community.",
};

export default async function JobsPage() {
  const jobs = await fetchJobs().catch(() => []);

  return (
    <main className="mx-auto max-w-3xl px-5 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Jobs</h1>
      <p className="mt-4 leading-relaxed" style={{ color: "var(--text-muted)" }}>
        Agile, Scrum, product and coaching roles aggregated from public sources.
      </p>

      {jobs.length === 0 ? (
        <p className="mt-10 text-sm" style={{ color: "var(--text-muted)" }}>
          No jobs are listed yet.
        </p>
      ) : (
        <div className="mt-8 space-y-4">
          {jobs.map((j) => (
            <a
              key={j.id}
              href={j.applyUrl}
              target="_blank"
              rel="noreferrer"
              className="block rounded-xl border p-5 transition hover:border-paca-500"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex items-start justify-between gap-4">
                <h2 className="font-semibold">{j.title}</h2>
                {j.seniority && (
                  <span className="shrink-0 text-xs" style={{ color: "var(--text-muted)" }}>
                    {j.seniority}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
                {j.company}
                {j.location ? ` · ${j.location}` : ""}
                {j.isRemote ? " · Remote" : ""}
              </p>
            </a>
          ))}
        </div>
      )}
    </main>
  );
}
