"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  fetchQueue,
  fetchStats,
  DIFFICULTY_LABEL,
  type Difficulty,
  type QueueItem,
  type QuestionOriginValue,
  type QuestionStatusValue,
  type ReviewStats,
} from "@/lib/api";

const STATUSES: QuestionStatusValue[] = ["DRAFT", "IN_REVIEW", "PUBLISHED", "REJECTED", "RETIRED"];
const ORIGINS: QuestionOriginValue[] = ["HUMAN", "AI_GENERATED", "IMPORTED"];
const DIFFICULTIES: Difficulty[] = ["FOUNDATION", "INTERMEDIATE", "ADVANCED", "EXPERT"];
const PAGE_SIZE = 25;

export default function AllQuestionsPage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [stats, setStats] = useState<ReviewStats | null>(null);

  const [statusFilter, setStatusFilter] = useState<QuestionStatusValue | "">("PUBLISHED");
  const [originFilter, setOriginFilter] = useState<QuestionOriginValue | "">("");
  const [difficultyFilter, setDifficultyFilter] = useState<Difficulty | "">("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats()
      .then(setStats)
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchQueue({
        status: statusFilter || undefined,
        origin: originFilter || undefined,
        difficulty: difficultyFilter || undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load questions.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, originFilter, difficultyFilter, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="mx-auto flex h-full max-w-6xl flex-col px-6 py-8">
      <header className="flex shrink-0 flex-wrap items-center gap-4">
        <h1 className="text-lg font-semibold">All questions</h1>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {total} question{total === 1 ? "" : "s"}
        </span>
        {stats && (
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {stats.byOrigin.AI_GENERATED} AI-generated · {stats.byOrigin.HUMAN} human-authored
          </span>
        )}
      </header>

      <div className="mt-4 flex shrink-0 flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => {
            setPage(1);
            setStatusFilter(e.target.value as QuestionStatusValue | "");
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
        <select
          value={originFilter}
          onChange={(e) => {
            setPage(1);
            setOriginFilter(e.target.value as QuestionOriginValue | "");
          }}
          className="rounded border px-2 py-1 text-xs"
          style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }}
        >
          <option value="">All origins</option>
          {ORIGINS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <select
          value={difficultyFilter}
          onChange={(e) => {
            setPage(1);
            setDifficultyFilter(e.target.value as Difficulty | "");
          }}
          className="rounded border px-2 py-1 text-xs"
          style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }}
        >
          <option value="">All exams (every membership type)</option>
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d}>
              {DIFFICULTY_LABEL[d]}
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
              <th className="py-2 pr-3">Stem</th>
              <th className="py-2 pr-3">Topic</th>
              <th className="py-2 pr-3">Exam</th>
              <th className="py-2 pr-3">Origin</th>
              <th className="py-2 pr-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((q) => (
              <tr key={q.id} className="border-b align-top" style={{ borderColor: "var(--border)" }}>
                <td className="max-w-md py-2 pr-3">{q.stem}</td>
                <td className="py-2 pr-3 text-xs" style={{ color: "var(--text-muted)" }}>
                  {q.topic.name}
                </td>
                <td className="py-2 pr-3 text-xs">{DIFFICULTY_LABEL[q.difficulty] ?? q.difficulty}</td>
                <td className="py-2 pr-3 text-xs">
                  <span
                    className="rounded px-1.5 py-0.5"
                    style={{
                      background: q.origin === "AI_GENERATED" ? "var(--verdict-bg)" : "transparent",
                      color: q.origin === "AI_GENERATED" ? "var(--paca-500)" : "var(--text-muted)",
                    }}
                  >
                    {q.origin}
                  </span>
                </td>
                <td className="py-2 pr-3 text-xs">{q.status}</td>
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="py-8 text-center" style={{ color: "var(--text-muted)" }}>
                  No questions match these filters.
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
