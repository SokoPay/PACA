import { fetchDirectory } from "@/lib/api";

export const metadata = {
  title: "Professional database",
  description: "PACA members who have opted in to appear in the public professional directory.",
};

export default async function DirectoryPage() {
  const people = await fetchDirectory().catch(() => []);

  return (
    <main className="mx-auto max-w-3xl px-5 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Professional database</h1>
      <p className="mt-4 leading-relaxed" style={{ color: "var(--text-muted)" }}>
        Members who have opted in to appear here. Sign in and update your profile to be listed.
      </p>

      {people.length === 0 ? (
        <p className="mt-10 text-sm" style={{ color: "var(--text-muted)" }}>
          No members have opted in to the public directory yet.
        </p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {people.map((p, i) => (
            <div key={i} className="rounded-xl border p-5" style={{ borderColor: "var(--border)" }}>
              <h2 className="font-semibold">
                {p.user.firstName} {p.user.lastName}
              </h2>
              <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
                {[p.occupation, p.employer].filter(Boolean).join(" at ") || p.institution || ""}
                {p.country ? ` · ${p.country}` : ""}
              </p>
              {p.bio && (
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {p.bio}
                </p>
              )}
              {p.linkedinUrl && (
                <a
                  href={p.linkedinUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-sm text-paca-500 hover:underline"
                >
                  LinkedIn &rarr;
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
