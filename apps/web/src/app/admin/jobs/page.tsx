"use client";

import { useEffect, useState } from "react";
import {
  AGILE_ROLE_LABEL,
  ApiError,
  SENIORITY_LABEL,
  addJobSource,
  fetchAdminJobListings,
  fetchJobSources,
  reviewJobListing,
  runJobCrawl,
  toggleJobSource,
  type AdminJobListing,
  type AdminJobSource,
} from "@/lib/api";

const TABS = [
  ["PENDING_REVIEW", "Needs review"],
  ["PUBLISHED", "Published"],
  ["REJECTED", "Rejected"],
] as const;

export default function AdminJobsPage() {
  const [sources, setSources] = useState<AdminJobSource[] | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("PENDING_REVIEW");
  const [listings, setListings] = useState<AdminJobListing[] | null>(null);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [kind, setKind] = useState<"GREENHOUSE" | "LEVER">("GREENHOUSE");
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");

  const loadSources = () => fetchJobSources().then(setSources).catch(() => setSources([]));
  const loadListings = (s = tab) => fetchAdminJobListings(s).then(setListings).catch(() => setListings([]));

  useEffect(() => {
    void loadSources();
  }, []);
  useEffect(() => {
    setListings(null);
    void loadListings(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function run() {
    setRunning(true);
    setMsg("Crawling job boards… this can take a minute or two.");
    try {
      const r = await runJobCrawl();
      if (!r.started) setMsg(r.message ?? "A crawl is already running.");
      else
        setMsg(
          `${r.ai ? "AI-classified" : "Classified by keywords (set ANTHROPIC_API_KEY for AI screening)"}: ` +
            (r.summary ?? []).map((s) => `${s.source} ${s.error ? `failed (${s.error})` : `+${s.added} new, ${s.published} published`}`).join(" · "),
        );
      await Promise.all([loadSources(), loadListings()]);
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Crawl failed.");
    } finally {
      setRunning(false);
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    try {
      await addJobSource({ kind, name: name.trim(), handle: handle.trim() });
      setName("");
      setHandle("");
      await loadSources();
    } catch (err) {
      setMsg(err instanceof ApiError ? (err.fieldErrors[0]?.message ?? err.message) : "Could not add source.");
    }
  }

  const field = "rounded-lg border px-3 py-2 text-sm outline-none focus:border-paca-500";
  const style = { background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" };

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Job board</h1>
          <p className="mt-1 max-w-2xl text-sm" style={{ color: "var(--text-muted)" }}>
            Jobs are crawled automatically every 12 hours. Titles that look Agile are screened by Claude; confident matches are
            published, uncertain ones wait here for review.
          </p>
        </div>
        <button onClick={() => void run()} disabled={running} className="rounded-lg bg-paca-500 px-5 py-2 text-sm font-semibold text-white hover:bg-paca-600 disabled:opacity-60">
          {running ? "Crawling…" : "Crawl now"}
        </button>
      </div>
      {msg && <p className="mt-3 rounded-lg px-3 py-2 text-sm" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>{msg}</p>}

      <h2 className="mt-8 font-semibold">Sources</h2>
      <div className="mt-3 overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <table className="w-full text-left text-sm">
          <thead style={{ color: "var(--text-muted)" }}>
            <tr>
              <th className="px-4 py-2 font-medium">Source</th>
              <th className="px-4 py-2 font-medium">Live jobs</th>
              <th className="px-4 py-2 font-medium">Last run</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {sources?.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-3" style={{ color: "var(--text-muted)" }}>Jobicy and Arbeitnow are added on the first crawl.</td></tr>
            )}
            {sources?.map((s) => (
              <tr key={s.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                <td className="px-4 py-2">
                  <span className="font-medium">{s.name}</span> <span className="text-xs" style={{ color: "var(--text-muted)" }}>{s.kind}</span>
                </td>
                <td className="px-4 py-2">{s._count.listings}</td>
                <td className="px-4 py-2 text-xs" style={{ color: s.lastRunStatus === "ERROR" ? "#c0392b" : "var(--text-muted)" }}>
                  {s.lastRunAt ? `${new Date(s.lastRunAt).toLocaleString()} — ${s.lastRunMessage ?? ""}` : "Never"}
                </td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => void toggleJobSource(s.id, !s.isActive).then(loadSources)} className="text-sm font-semibold text-paca-500 hover:underline">
                    {s.isActive ? "Pause" : "Resume"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={add} className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium">Company job board</label>
          <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className={field} style={style}>
            <option value="GREENHOUSE">Greenhouse</option>
            <option value="LEVER">Lever</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Company name</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className={field} style={style} placeholder="e.g. Andela" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">{kind === "GREENHOUSE" ? "Board token" : "Company handle"}</label>
          <input required value={handle} onChange={(e) => setHandle(e.target.value)} className={field} style={style} placeholder={kind === "GREENHOUSE" ? "boards.greenhouse.io/<token>" : "jobs.lever.co/<handle>"} />
        </div>
        <button type="submit" className="rounded-lg border px-4 py-2 text-sm font-semibold" style={{ borderColor: "var(--border)" }}>Add source</button>
      </form>

      <div className="mt-10 flex gap-2">
        {TABS.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className="rounded-full border px-4 py-1.5 text-sm font-medium"
            style={{ borderColor: tab === k ? "var(--color-paca-500)" : "var(--border)", background: tab === k ? "var(--color-paca-50)" : "transparent" }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mt-4 space-y-2">
        {!listings && <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading…</p>}
        {listings?.length === 0 && <p className="text-sm" style={{ color: "var(--text-muted)" }}>Nothing here.</p>}
        {listings?.map((j) => (
          <div key={j.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <div className="min-w-0 flex-1">
              <a href={j.applyUrl} target="_blank" rel="noreferrer" className="font-semibold hover:text-paca-500">{j.title}</a>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {j.company} · {j.location ?? "—"} · {j.agileRole ? AGILE_ROLE_LABEL[j.agileRole] : "?"} · {j.seniority ? SENIORITY_LABEL[j.seniority] : "?"} ·
                confidence {j.aiConfidence ? Math.round(Number(j.aiConfidence) * 100) : "—"}% · via {j.source.name}
              </p>
              {j.summary && <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>{j.summary}</p>}
            </div>
            <div className="flex gap-3 text-sm font-semibold">
              {j.status !== "PUBLISHED" && (
                <button onClick={() => void reviewJobListing(j.id, "PUBLISHED").then(() => loadListings())} className="text-paca-500 hover:underline">Publish</button>
              )}
              {j.status !== "REJECTED" && (
                <button onClick={() => void reviewJobListing(j.id, "REJECTED").then(() => loadListings())} className="hover:underline" style={{ color: "#c0392b" }}>Reject</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
