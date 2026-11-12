"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, fetchAdminPayments, formatMoney, formatUsd, type AdminPaymentItem } from "@/lib/api";

const PAGE_SIZE = 20;
const STATUSES = ["SUCCESS", "PENDING", "INITIALIZED", "FAILED", "ABANDONED", "REFUNDED"];
const CHANNEL: Record<string, string> = {
  card: "Card",
  mobile_money: "Mobile money",
  bank: "Bank",
  bank_transfer: "Bank transfer",
};

export default function AdminPaymentsPage() {
  const [items, setItems] = useState<AdminPaymentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAdminPayments({ status: statusFilter || undefined, page });
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load payments.");
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
        <h1 className="text-lg font-semibold">Payments</h1>
        <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
          Membership payments through Paystack. A payment only shows as Paid once it has been verified with Paystack.
        </p>
      </header>

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
              <th className="py-2 pr-3">Amount</th>
              <th className="py-2 pr-3">Method</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Reference</th>
              <th className="py-2 pr-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} className="border-b" style={{ borderColor: "var(--border)" }}>
                <td className="py-2 pr-3">
                  <div className="font-medium">
                    {p.user.firstName} {p.user.lastName}
                  </div>
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {p.user.email}
                  </div>
                </td>
                <td className="py-2 pr-3">
                  {formatMoney(p.amount, p.currency)}
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {formatUsd(p.amountUsdCents)}
                  </div>
                </td>
                <td className="py-2 pr-3">{p.channel ? (CHANNEL[p.channel] ?? p.channel) : "—"}</td>
                <td className="py-2 pr-3">
                  <span style={{ color: p.status === "SUCCESS" ? "var(--color-paca-500)" : p.status === "FAILED" ? "#c0392b" : undefined }}>
                    {p.status}
                  </span>
                </td>
                <td className="py-2 pr-3 font-mono text-xs">{p.reference}</td>
                <td className="py-2 pr-3 text-xs" style={{ color: "var(--text-muted)" }}>
                  {new Date(p.paidAt ?? p.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="py-8 text-center" style={{ color: "var(--text-muted)" }}>
                  No payments yet.
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
