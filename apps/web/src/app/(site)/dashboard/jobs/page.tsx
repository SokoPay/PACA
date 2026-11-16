"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AGILE_ROLE_LABEL, ApiError, SENIORITY_LABEL, fetchMemberJobs, restoreSession, type MemberJob } from "@/lib/api";
import { MemberGate } from "@/components/MemberGate";

function ago(d: string | null): string {
  if (!d) return "";
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
}

export default function MemberJobsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(false);
  const [role, setRole] = useState("");
  const [remote, setRemote] = useState(false);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ total: number; pageSize: number; items: MemberJob[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await fetchMemberJobs({ role: role || undefined, remote, q: q.trim() || undefined, page }));
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setLocked(true);
      else setError("Could not load jobs.");
    }
  }, [role, remote, q, page]);

  useEffect(() => {
    (async () => {
      if (!(await restoreSession())) {
        router.replace("/login?next=/dashboard/jobs");
        return;
      }
      setReady(true);
    })();
  }, [router]);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [ready, load]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const field = "rounded-xl border px-3 py-2 text-sm outline-none focus:border-paca-500";
  const fieldStyle = { background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" };

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <Link href="/dashboard" className="text-sm text-paca-500 hover:underline">&larr; Dashboard</Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">Agile jobs</h1>
      <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
        Scrum Master, Product Owner, Agile coach and delivery roles gathered from job boards and screened for you. Updated
        twice a day.
      </p>

      {locked ? (
        <div className="mt-8"><MemberGate feature="The Agile job board" /></div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap gap-3">
            <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search title, company or location" className={`${field} min-w-[220px] flex-1`} style={fieldStyle} />
            <select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} className={field} style={fieldStyle}>
              <option value="">All roles</option>
              {Object.entries(AGILE_ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <label className={`${field} flex cursor-pointer items-center gap-2`} style={fieldStyle}>
              <input type="checkbox" checked={remote} onChange={(e) => { setRemote(e.target.checked); setPage(1); }} /> Remote only
            </label>
          </div>

          {error && <p className="mt-6 text-sm" style={{ color: "#c0392b" }}>{error}</p>}
          {!data && !error && <p className="mt-8 text-sm" style={{ color: "var(--text-muted)" }}>Loading…</p>}
          {data && (
            <p className="mt-6 text-xs" style={{ color: "var(--text-muted)" }}>{data.total} job{data.total === 1 ? "" : "s"}</p>
          )}
          {data?.items.length === 0 && (
            <p className="mt-6 rounded-2xl border p-8 text-center text-sm" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
              No jobs match yet. New roles are added twice a day.
            </p>
          )}

          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {data?.items.map((j) => (
              <article key={j.id} className="flex flex-col rounded-2xl border p-5 transition hover:border-paca-500 hover:shadow-md" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                <div className="flex items-start gap-3">
                  {j.companyLogoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={j.companyLogoUrl} alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-lg bg-white object-contain" loading="lazy" />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-paca-50 font-bold text-paca-600">{j.company.charAt(0)}</div>
                  )}
                  <div className="min-w-0">
                    <h2 className="font-semibold leading-snug">{j.title}</h2>
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>{j.company}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-semibold">
                  {j.agileRole && <span className="rounded-full bg-paca-50 px-2.5 py-1 text-paca-700">{AGILE_ROLE_LABEL[j.agileRole] ?? j.agileRole}</span>}
                  {j.seniority && <span className="rounded-full px-2.5 py-1" style={{ background: "var(--bg)" }}>{SENIORITY_LABEL[j.seniority] ?? j.seniority}</span>}
                  {j.isRemote && <span className="rounded-full px-2.5 py-1" style={{ background: "#d4f5e2", color: "#146c3b" }}>Remote</span>}
                  {j.location && <span className="rounded-full px-2.5 py-1" style={{ background: "var(--bg)" }}>{j.location}</span>}
                </div>
                {j.summary && <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{j.summary}</p>}
                <div className="mt-auto flex items-center justify-between pt-4 text-xs" style={{ color: "var(--text-muted)" }}>
                  <span>via {j.source.name} · {ago(j.postedAt)}</span>
                  <a href={j.applyUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-paca-500 px-4 py-2 text-sm font-semibold text-white hover:bg-paca-600">
                    View &amp; apply &#8599;
                  </a>
                </div>
              </article>
            ))}
          </div>

          {pages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-3 text-sm">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40" style={{ borderColor: "var(--border)" }}>Previous</button>
              <span>Page {page} of {pages}</span>
              <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40" style={{ borderColor: "var(--border)" }}>Next</button>
            </div>
          )}
          <p className="mt-8 text-xs" style={{ color: "var(--text-muted)" }}>
            Jobs come from public job boards including Jobicy and Arbeitnow; you apply on the original posting.
          </p>
        </>
      )}
    </main>
  );
}
