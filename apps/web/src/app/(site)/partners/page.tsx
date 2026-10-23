import { fetchPartners } from "@/lib/api";

export const metadata = {
  title: "Partners",
  description: "Organisations PACA partners with for training, tooling and discounts.",
};

export default async function PartnersPage() {
  const partners = await fetchPartners().catch(() => []);

  return (
    <main className="mx-auto max-w-3xl px-5 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Partners</h1>
      <p className="mt-4 leading-relaxed" style={{ color: "var(--text-muted)" }}>
        Organisations PACA works with on training, tooling and member discounts.
      </p>

      {partners.length === 0 ? (
        <p className="mt-10 text-sm" style={{ color: "var(--text-muted)" }}>
          No partners are listed yet.
        </p>
      ) : (
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
    </main>
  );
}
