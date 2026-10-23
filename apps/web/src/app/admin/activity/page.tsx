"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, fetchActivity, fetchActivityActions, type ActivityItem } from "@/lib/api";

const PAGE_SIZE = 50;

export default function ActivityLogPage() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [actions, setActions] = useState<string[]>([]);
  const [actionFilter, setActionFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchActivityActions()
      .then(setActions)
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchActivity({ action: actionFilter || undefined, page, pageSize: PAGE_SIZE });
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load the activity log.");
    } finally {
      setLoading(false);
    }
  }, [actionFilter, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="mx-auto flex h-full max-w-5xl flex-col px-6 py-8">
      <header className="flex shrink-0 flex-wrap items-center gap-4">
        <h1 className="text-lg font-semibold">Activity log</h1>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {total} record{total === 1 ? "" : "s"}
        </span>
        <select
          value={actionFilter}
          onChange={(e) => {
            setPage(1);
            setActionFilter(e.target.value);
          }}
          className="ml-auto rounded border px-2 py-1 text-xs"
          style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }}
        >
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </header>

      {error && (
        <p role="alert" className="mt-4 shrink-0 rounded-lg px-4 py-2 text-sm" style={{ background: "#c0392b1a", color: "#c0392b" }}>
          {error}
        </p>
      )}

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0" style={{ background: "var(--bg)" }}>
            <tr className="border-b text-xs uppercase tracking-wide" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
              <th className="py-2 pr-3">When</th>
              <th className="py-2 pr-3">Actor</th>
              <th className="py-2 pr-3">Action</th>
              <th className="py-2 pr-3">Entity</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id} className="border-b align-top" style={{ borderColor: "var(--border)" }}>
                <td className="py-2 pr-3 text-xs" style={{ color: "var(--text-muted)" }}>
                  {new Date(a.createdAt).toLocaleString()}
                </td>
                <td className="py-2 pr-3">
                  {a.actor ? (
                    <>
                      {a.actor.firstName} {a.actor.lastName}
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {a.actor.role}
                      </div>
                    </>
                  ) : (
                    <span style={{ color: "var(--text-muted)" }}>System</span>
                  )}
                </td>
                <td className="py-2 pr-3 font-mono text-xs">{a.action}</td>
                <td className="py-2 pr-3 text-xs" style={{ color: "var(--text-muted)" }}>
                  {a.entityType}
                  {a.entityId ? ` · ${a.entityId.slice(0, 10)}…` : ""}
                </td>
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr>
                <td colSpan={4} className="py-8 text-center" style={{ color: "var(--text-muted)" }}>
                  No activity recorded yet.
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
