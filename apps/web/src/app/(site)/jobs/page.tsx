import Link from "next/link";
import { AGILE_ROLE_LABEL, fetchJobTeaser } from "@/lib/api";

export const metadata = {
  title: "Agile jobs",
  description: "Scrum Master, Product Owner and Agile roles screened for PACA members.",
};

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const teaser = await fetchJobTeaser().catch(() => ({ total: 0, latest: [] }));

  return (
    <main className="mx-auto max-w-4xl px-5 py-16">
      <section className="paca-gradient rounded-3xl px-8 py-12 text-center text-white shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">Paid-member benefit</p>
        <h1 className="mt-3 text-4xl font-bold">The PACA Agile job board</h1>
        <p className="mx-auto mt-4 max-w-xl text-white/90">
          Scrum Master, Product Owner, Agile coach and delivery roles gathered from job boards, screened by AI so only real
          Agile jobs make the list, and refreshed twice a day.
        </p>
        <p className="mt-6 text-5xl font-extrabold">{teaser.total}</p>
        <p className="text-sm text-white/80">open roles right now</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/dashboard/jobs" className="rounded-xl bg-white px-6 py-3 text-sm font-bold text-paca-600">Browse jobs</Link>
          <Link href="/membership" className="rounded-xl border border-white/60 px-6 py-3 text-sm font-semibold text-white">Become a member</Link>
        </div>
      </section>

      {teaser.latest.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Recently added</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {teaser.latest.map((j) => (
              <div key={j.id} className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                <p className="font-semibold">{j.title}</p>
                <p className="mt-0.5 text-sm" style={{ color: "var(--text-muted)" }}>
                  {j.company}
                  {j.location ? ` · ${j.location}` : ""}
                  {j.isRemote ? " · Remote" : ""}
                </p>
                <p className="mt-2 text-xs font-semibold text-paca-600">
                  {j.agileRole ? AGILE_ROLE_LABEL[j.agileRole] : "Agile role"} · 🔒 apply link for members
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
