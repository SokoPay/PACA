"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, fetchAdminAssessmentStats, fetchAdminAssessments, type AdminAttemptItem } from "@/lib/api";

const PAGE_SIZE = 20;
const STATUSES = ["IN_PROGRESS", "SUBMITTED", "EXPIRED", "ABANDONED", "VOIDED"];

export default function AdminAssessmentsPage() {
  const [items, setItems] = useState<AdminAttemptItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [stats, setStats] = useState<{ total: number; submitted: number; passed: number } | null>(null);
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
      const result = await fetchAdminAssessments({ status: statusFilter || undefined, page, pageSize: PAGE_SIZE });
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load exam attempts.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="mx-auto flex h-full max-w-5xl flex-col px-6 py-8">
      <header className="shrink-0">
        <h1 className="text-lg font-semibold">Exam performance</h1>
        <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
          Only the free open-practice assessment exists today — there is no certification exam or certificate
          issuance built yet.
        </p>
      </header>

      {stats && (
        <div className="mt-4 flex shrink-0 gap-4 text-sm">
          <span>
            <strong>{stats.total}</strong> attempts started
          </span>
          <span>
            <strong>{stats.submitted}</strong> completed
          </span>
          <span>
            <strong>{stats.passed}</strong> passed
          </span>
        </div>
      )}

      <div className="mt-4 flex shrink-0 items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => {
            setPage(1);
            setStatusFilter(e.target.value);
          }}
          className="rounded border px-2 py-1 text-xs"
          style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {loading && <span className="text-xs" style={{ color: "var(--text-muted)" }}>Loading…</span>}
      </div>

      {error && (
        <p role="alert" className="mt-4 shrink-0 rounded-lg px-4 py-2 text-sm" style={{ background: "#c0392b1a", color: "#c0392b" }}>
          {error}
        </p>
      )}

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0" style={{ background: "var(--bg)" }}>
            <tr className="border-b text-xs uppercase tracking-wide" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
              <th className="py-2 pr-3">Member</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Score</th>
              <th className="py-2 pr-3">Result</th>
              <th className="py-2 pr-3">Started</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id} className="border-b" style={{ borderColor: "var(--border)" }}>
                <td className="py-2 pr-3">
                  <div className="font-medium">
                    {a.user.firstName} {a.user.lastName}
                  </div>
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {a.user.email}
                  </div>
                </td>
                <td className="py-2 pr-3">{a.status}</td>
                <td className="py-2 pr-3">
                  {a.scoreBps !== null ? `${Math.round(a.scoreBps / 100)}% (${a.correctCount}/${a.questionCount})` : "—"}
                </td>
                <td className="py-2 pr-3">
                  {a.passed === null ? (
                    "—"
                  ) : (
                    <span style={{ color: a.passed ? "var(--color-paca-500)" : "#c0392b" }}>
                      {a.passed ? "Passed" : "Not passed"}
                    </span>
                  )}
                </td>
                <td className="py-2 pr-3 text-xs" style={{ color: "var(--text-muted)" }}>
                  {new Date(a.startedAt).toLocaleString()}
                </td>
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="py-8 text-center" style={{ color: "var(--text-muted)" }}>
                  No assessment attempts yet.
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
