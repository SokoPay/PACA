import { fetchResources, TIER_LABEL } from "@/lib/api";
import { PageHero } from "@/components/PageHero";

export const metadata = {
  title: "Digital library",
  description: "Guides, templates and reference material for Agile, Scrum and Kanban practitioners.",
};

export default async function LibraryPage() {
  const resources = await fetchResources().catch(() => []);

  return (
    <main>
      <PageHero eyebrow={"Learning resources"} title={"Digital library"} lead={"Guides, templates and study books for every stage of your Agile journey."} />
      <div className="mx-auto max-w-3xl px-5 py-14">
      <p className="mt-4 leading-relaxed" style={{ color: "var(--text-muted)" }}>
        Guides, templates and reference material. Books marked &ldquo;Members&rdquo; are in the member library: paid
        members read them from their dashboard, and each membership type has its own books.
      </p>
      <a
        href="/dashboard/library"
        className="mt-4 inline-block rounded-lg bg-paca-500 px-5 py-2 text-sm font-semibold text-white hover:bg-paca-600"
      >
        Open the member library
      </a>

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
                  {r.memberOnly
                    ? ` · Members${r.tiers.length ? `: ${r.tiers.map((t) => TIER_LABEL[t]).join(", ")}` : ""}`
                    : ""}
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
      </div>
    </main>
  );
}
