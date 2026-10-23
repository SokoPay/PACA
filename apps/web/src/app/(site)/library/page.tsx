import { fetchResources } from "@/lib/api";

export const metadata = {
  title: "Digital library",
  description: "Guides, templates and reference material for Agile, Scrum and Kanban practitioners.",
};

export default async function LibraryPage() {
  const resources = await fetchResources().catch(() => []);

  return (
    <main className="mx-auto max-w-3xl px-5 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Digital library</h1>
      <p className="mt-4 leading-relaxed" style={{ color: "var(--text-muted)" }}>
        Guides, templates and reference material. Items marked with a membership tier are unlocked once you hold that
        membership or higher.
      </p>

      {resources.length === 0 ? (
        <p className="mt-10 text-sm" style={{ color: "var(--text-muted)" }}>
          No resources are published yet.
        </p>
      ) : (
        <div className="mt-8 space-y-4">
          {resources.map((r) => (
            <div key={r.id} className="rounded-xl border p-5" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-start justify-between gap-4">
                <h2 className="font-semibold">{r.title}</h2>
                <span className="shrink-0 text-xs" style={{ color: "var(--text-muted)" }}>
                  {r.kind}
                  {r.minTier ? ` · ${r.minTier}+` : ""}
                </span>
              </div>
              {r.description && (
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {r.description}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
                {r.topic && <span>{r.topic.name}</span>}
                {r.externalUrl && (
                  <a href={r.externalUrl} className="text-paca-500 hover:underline" target="_blank" rel="noreferrer">
                    Open &rarr;
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
