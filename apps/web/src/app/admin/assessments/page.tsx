"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  fetchAdminAssessmentStats,
  fetchAdminAssessments,
  type AdminAttemptItem,
  type AttemptCategory,
  type AttemptCategoryStats,
} from "@/lib/api";

const PAGE_SIZE = 20;
const STATUS_LABEL: Record<string, string> = {
  IN_PROGRESS: "In progress",
  SUBMITTED: "Submitted",
  EXPIRED: "Time ran out",
  ABANDONED: "Abandoned",
  VOIDED: "Voided",
};

/** One look per category so staff can tell the free test from each membership exam at a glance. */
const CATEGORY_STYLE: Record<AttemptCategory, { label: string; short: string; icon: string; bg: string; fg: string }> = {
  FREE: { label: "Free competency test", short: "Free test", icon: "📝", bg: "#e7f6ee", fg: "#146c3b" },
  STUDENT: { label: "Student exam", short: "Student", icon: "🎓", bg: "#e6f0ff", fg: "#0050b3" },
  PROFESSIONAL: { label: "Professional exam", short: "Professional", icon: "💼", bg: "#f1e8ff", fg: "#5b2bb5" },
  EXECUTIVE: { label: "Executive exam", short: "Executive", icon: "🏛️", bg: "#fdf2d0", fg: "#8a6100" },
};
const CATEGORIES = Object.keys(CATEGORY_STYLE) as AttemptCategory[];

function categoryOf(a: AdminAttemptItem): AttemptCategory | null {
  if (a.type === "FREE_OPEN") return "FREE";
  if (a.tier === "STUDENT" || a.tier === "PROFESSIONAL" || a.tier === "EXECUTIVE") return a.tier;
  return null;
}

const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—");

export default function AdminAssessmentsPage() {
  const [items, setItems] = useState<AdminAttemptItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState<AttemptCategory | "">("");
  const [statusFilter, setStatusFilter] = useState("");
  const [resultFilter, setResultFilter] = useState<"" | "true" | "false">("");
  const [stats, setStats] = useState<{ total: number; submitted: number; passed: number; categories?: AttemptCategoryStats[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminAssessmentStats()
      .then(setStats)
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAdminAssessments({
        category: category || undefined,
        status: statusFilter || undefined,
        passed: resultFilter === "" ? undefined : resultFilter === "true",
        page,
        pageSize: PAGE_SIZE,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load exam attempts.");
    } finally {
      setLoading(false);
    }
  }, [category, statusFilter, resultFilter, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const byKey = new Map((stats?.categories ?? []).map((c) => [c.key, c]));
  const select = "rounded-lg border px-2 py-1.5 text-xs";
  const selectStyle = { background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" };

  return (
    <main className="mx-auto flex h-full max-w-6xl flex-col px-4 py-6 sm:px-6 sm:py-8">
      <header className="shrink-0">
        <h1 className="text-lg font-semibold">Exam performance</h1>
        <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
          Results by category: the free competency test and the Student, Professional and Executive certification
          exams. Certificates are issued only for a passed certification exam.
        </p>
      </header>

      {/* summary per category; clicking a card filters the list */}
      <div className="mt-5 grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {CATEGORIES.map((key) => {
          const s = byKey.get(key);
          const st = CATEGORY_STYLE[key];
          const active = category === key;
          return (
            <button
              key={key}
              onClick={() => {
                setPage(1);
                setCategory(active ? "" : key);
              }}
              aria-pressed={active}
              className="rounded-2xl border p-4 text-left transition hover:shadow-md"
              style={{ borderColor: active ? st.fg : "var(--border)", background: active ? st.bg : "var(--surface)", boxShadow: active ? `0 0 0 1px ${st.fg}` : undefined }}
            >
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg text-base" style={{ background: st.bg }} aria-hidden>
                  {st.icon}
                </span>
                <span className="text-sm font-semibold" style={{ color: st.fg }}>{st.label}</span>
              </div>
              {s ? (
                <>
                  <div className="mt-3 flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold">{s.started}</span>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>attempts · {s.people} {s.people === 1 ? "person" : "people"}</span>
                  </div>
                  <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <dt style={{ color: "var(--text-muted)" }}>Completed</dt>
                      <dd className="font-semibold">{s.completed}</dd>
                    </div>
                    <div>
                      <dt style={{ color: "var(--text-muted)" }}>Pass rate</dt>
                      <dd className="font-semibold">{pct(s.passed, s.completed)}</dd>
                    </div>
                    <div>
                      <dt style={{ color: "var(--text-muted)" }}>Avg score</dt>
                      <dd className="font-semibold">{s.averageScoreBps === null ? "—" : `${Math.round(s.averageScoreBps / 100)}%`}</dd>
                    </div>
                  </dl>
                </>
              ) : (
                <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>Loading…</p>
              )}
            </button>
          );
        })}
      </div>

      {/* category tabs + filters */}
      <div className="mt-5 flex shrink-0 flex-wrap items-center gap-2">
        {(["", ...CATEGORIES] as const).map((key) => {
          const active = category === key;
          const label = key === "" ? `All (${stats?.total ?? "…"})` : `${CATEGORY_STYLE[key].short} (${byKey.get(key)?.started ?? "…"})`;
          return (
            <button
              key={key || "all"}
              onClick={() => {
                setPage(1);
                setCategory(key);
              }}
              className="rounded-full border px-3 py-1.5 text-xs font-semibold"
              style={
                active
                  ? { background: "var(--color-paca-500)", borderColor: "var(--color-paca-500)", color: "white" }
                  : { borderColor: "var(--border)", color: "var(--text-muted)" }
              }
            >
              {label}
            </button>
          );
        })}
        <span className="mx-1 hidden h-5 w-px sm:inline-block" style={{ background: "var(--border)" }} />
        <select
          value={statusFilter}
          onChange={(e) => {
            setPage(1);
            setStatusFilter(e.target.value);
          }}
          className={select}
          style={selectStyle}
          aria-label="Status"
        >
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select
          value={resultFilter}
          onChange={(e) => {
            setPage(1);
            setResultFilter(e.target.value as "" | "true" | "false");
          }}
          className={select}
          style={selectStyle}
          aria-label="Result"
        >
          <option value="">All results</option>
          <option value="true">Passed</option>
          <option value="false">Not passed</option>
        </select>
        {loading && <span className="text-xs" style={{ color: "var(--text-muted)" }}>Loading…</span>}
      </div>

      {error && (
        <p role="alert" className="mt-4 shrink-0 rounded-lg px-4 py-2 text-sm" style={{ background: "#c0392b1a", color: "#c0392b" }}>
          {error}
        </p>
      )}

      <div className="mt-4 min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="sticky top-0" style={{ background: "var(--bg)" }}>
            <tr className="border-b text-xs uppercase tracking-wide" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
              <th className="py-2 pr-3">Member</th>
              <th className="py-2 pr-3">Exam</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Score</th>
              <th className="py-2 pr-3">Result</th>
              <th className="py-2 pr-3">Started</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => {
              const cat = categoryOf(a);
              const st = cat ? CATEGORY_STYLE[cat] : null;
              return (
                <tr key={a.id} className="border-b" style={{ borderColor: "var(--border)" }}>
                  <td className="py-2 pr-3">
                    <div className="font-medium">
                      {a.user.firstName} {a.user.lastName}
                    </div>
                    <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {a.user.email}
                    </div>
                  </td>
                  <td className="py-2 pr-3">
                    {st ? (
                      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: st.bg, color: st.fg }}>
                        <span aria-hidden>{st.icon}</span> {st.short}
                      </span>
                    ) : (
                      <span className="text-xs">{a.tier ? `${a.tier.charAt(0)}${a.tier.slice(1).toLowerCase()} exam` : "—"}</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-xs">{STATUS_LABEL[a.status] ?? a.status}</td>
                  <td className="py-2 pr-3">
                    {a.scoreBps !== null ? `${Math.round(a.scoreBps / 100)}% (${a.correctCount}/${a.questionCount})` : "—"}
                  </td>
                  <td className="py-2 pr-3">
                    {a.passed === null ? (
                      "—"
                    ) : (
                      <span className="font-semibold" style={{ color: a.passed ? "#146c3b" : "#c0392b" }}>
                        {a.passed ? "Passed" : "Not passed"}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap py-2 pr-3 text-xs" style={{ color: "var(--text-muted)" }}>
                    {new Date(a.startedAt).toLocaleString()}
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="py-8 text-center" style={{ color: "var(--text-muted)" }}>
                  {category ? `No ${CATEGORY_STYLE[category].label.toLowerCase()} attempts match these filters.` : "No assessment attempts yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex shrink-0 items-center justify-end gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="underline underline-offset-2 disabled:opacity-40">
          Previous
        </button>
        <span>
          Page {page} of {pageCount}
        </span>
        <button
          disabled={page >= pageCount}
          onClick={() => setPage((p) => p + 1)}
          className="underline underline-offset-2 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </main>
  );
}
