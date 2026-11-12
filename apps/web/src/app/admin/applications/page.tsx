"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  approveApplication,
  declineApplication,
  fetchApplication,
  fetchApplications,
  restoreSession,
  viewApplicationDocument,
  type AdminApplicationDetail,
  type AdminApplicationListItem,
  type AdminApplicationStatus,
  type MembershipTierValue,
  type SessionUser,
} from "@/lib/api";

const STATUSES: AdminApplicationStatus[] = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "DECLINED", "WITHDRAWN"];
const TIERS: MembershipTierValue[] = ["STUDENT", "PROFESSIONAL", "EXECUTIVE", "FELLOW", "RETIRED"];
const DECIDABLE = new Set<AdminApplicationStatus>(["SUBMITTED", "UNDER_REVIEW"]);
const PAGE_SIZE = 20;
const SCAN_LABEL: Record<string, string> = {
  CLEAN: "Scanned · clean",
  PENDING: "Not scanned",
  INFECTED: "Infected",
  ERROR: "Scan error",
};

export default function AdminApplicationsPage() {
  const router = useRouter();

  const [me, setMe] = useState<SessionUser | null>(null);
  const [checking, setChecking] = useState(true);

  const [items, setItems] = useState<AdminApplicationListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<AdminApplicationStatus | "">("SUBMITTED");
  const [tierFilter, setTierFilter] = useState<MembershipTierValue | "">("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminApplicationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [decliningTarget, setDecliningTarget] = useState<{ id: string; email: string } | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [approveNotes, setApproveNotes] = useState("");

  // ---------------------------------------------------------------- session
  useEffect(() => {
    restoreSession().then((session) => {
      if (!session || session.role === "MEMBER" || session.role === "REVIEWER") {
        router.replace(session ? "/admin/queue" : "/login");
        return;
      }
      setMe(session);
      setChecking(false);
    });
  }, [router]);

  // ---------------------------------------------------------------- list
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchApplications({
        status: statusFilter || undefined,
        tier: tierFilter || undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load applications.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, tierFilter, page]);

  useEffect(() => {
    if (!checking && me) void load();
  }, [checking, me, load]);

  // ---------------------------------------------------------------- detail
  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setDetail(null);
    try {
      setDetail(await fetchApplication(id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load this application.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  function flash(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2600);
  }

  function removeFromList(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setTotal((t) => Math.max(0, t - 1));
    if (selectedId === id) {
      setSelectedId(null);
      setDetail(null);
    }
  }

  async function doApprove(id: string, tier: string, email: string, notes?: string) {
    setBusyId(id);
    setError(null);
    try {
      await approveApplication(id, notes);
      flash(`Approved — ${email} can now pay for ${tier}`);
      setApproveNotes("");
      removeFromList(id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not approve.");
    } finally {
      setBusyId(null);
    }
  }

  async function doDecline() {
    if (!decliningTarget || declineReason.trim().length < 3) return;
    setBusyId(decliningTarget.id);
    setError(null);
    try {
      await declineApplication(decliningTarget.id, declineReason.trim());
      flash("Declined");
      setDeclineReason("");
      removeFromList(decliningTarget.id);
      setDecliningTarget(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not decline.");
    } finally {
      setBusyId(null);
    }
  }

  /** The inline per-row dropdown — approve/decline without opening the detail pane. */
  function RowActions({ item }: { item: AdminApplicationListItem }) {
    if (!DECIDABLE.has(item.status)) return <span style={{ color: "var(--text-muted)" }}>—</span>;
    return (
      <select
        value=""
        disabled={busyId === item.id}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          const action = e.target.value;
          if (action === "APPROVE") void doApprove(item.id, item.tier, item.user.email);
          else if (action === "DECLINE") setDecliningTarget({ id: item.id, email: item.user.email });
        }}
        className="rounded border px-2 py-1 text-xs"
        style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }}
      >
        <option value="">{busyId === item.id ? "Working…" : "Actions ▾"}</option>
        <option value="APPROVE">Approve</option>
        <option value="DECLINE">Decline</option>
      </select>
    );
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (checking) {
    return (
      <main className="flex h-full items-center justify-center text-sm" style={{ color: "var(--text-muted)" }}>
        Loading…
      </main>
    );
  }

  return (
    <main className="mx-auto flex h-full max-w-[1700px] flex-col">
      {/* ---------------------------------------------------------- header */}
      <header
        className="flex shrink-0 flex-wrap items-center gap-6 border-b px-6 py-3"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <h1 className="text-sm font-semibold">Membership applications</h1>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {total} application{total === 1 ? "" : "s"}
        </span>
      </header>

      {/* ---------------------------------------------------------- filters */}
      <div
        className="flex shrink-0 flex-wrap items-center gap-3 border-b px-6 py-2 text-xs"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <select
          value={statusFilter}
          onChange={(e) => {
            setPage(1);
            setStatusFilter(e.target.value as AdminApplicationStatus | "");
          }}
          className="rounded border px-2 py-1"
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
          value={tierFilter}
          onChange={(e) => {
            setPage(1);
            setTierFilter(e.target.value as MembershipTierValue | "");
          }}
          className="rounded border px-2 py-1"
          style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }}
        >
          <option value="">All tiers</option>
          {TIERS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {loading && <span style={{ color: "var(--text-muted)" }}>Loading…</span>}
      </div>

      {error && (
        <div role="alert" className="shrink-0 px-6 py-2 text-sm" style={{ background: "#c0392b1a", color: "#c0392b" }}>
          {error}
          <button onClick={() => setError(null)} className="ml-3 underline underline-offset-2">
            dismiss
          </button>
        </div>
      )}

      {/* ---------------------------------------------------------- body */}
      <div className="flex min-h-0 flex-1">
        {/* table */}
        <div className="w-[55%] shrink-0 overflow-y-auto border-r" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0" style={{ background: "var(--surface)" }}>
              <tr className="border-b text-xs uppercase tracking-wide" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                <th className="py-2 pl-4 pr-3">Applicant</th>
                <th className="py-2 pr-3">Tier</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Submitted</th>
                <th className="py-2 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => setSelectedId(a.id)}
                  className="cursor-pointer border-b"
                  style={{
                    borderColor: "var(--border)",
                    background: a.id === selectedId ? "var(--verdict-bg)" : "transparent",
                  }}
                >
                  <td className="py-2 pl-4 pr-3">
                    <div className="font-medium">
                      {a.user.firstName} {a.user.lastName}
                    </div>
                    <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {a.user.email}
                    </div>
                  </td>
                  <td className="py-2 pr-3">{a.tier}</td>
                  <td className="py-2 pr-3">{a.status}</td>
                  <td className="py-2 pr-3 text-xs" style={{ color: "var(--text-muted)" }}>
                    {a.submittedAt ? new Date(a.submittedAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="py-2 pr-4">
                    <RowActions item={a} />
                  </td>
                </tr>
              ))}
              {items.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="py-8 text-center" style={{ color: "var(--text-muted)" }}>
                    No applications match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* detail */}
        <div className="flex-1 overflow-y-auto p-6">
          {detailLoading && <p style={{ color: "var(--text-muted)" }}>Loading…</p>}

          {!detailLoading && !detail && (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Select a row to see the full application, or use the Actions dropdown for a quick decision.
            </p>
          )}

          {!detailLoading && detail && (
            <article>
              <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded px-2 py-1 font-semibold" style={{ background: "var(--verdict-bg)", color: "var(--paca-500)" }}>
                  {detail.status}
                </span>
                <span style={{ color: "var(--text-muted)" }}>· {detail.tier}</span>
              </div>

              <h2 className="text-base font-semibold">
                {detail.user.firstName} {detail.user.lastName}
              </h2>
              <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
                {detail.user.email}
                {detail.user.phone ? ` · ${detail.user.phone}` : ""}
              </p>

              {detail.decisionReason && (
                <p className="mt-4 rounded-lg px-3 py-2 text-xs" style={{ background: "#c0392b1a", color: "#c0392b" }}>
                  Previous decision: {detail.decisionReason}
                </p>
              )}

              <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Application answers
              </h3>
              <dl className="mt-2 space-y-2 text-sm">
                {Object.entries(detail.answers).length === 0 && (
                  <p style={{ color: "var(--text-muted)" }}>No answers submitted.</p>
                )}
                {Object.entries(detail.answers).map(([key, value]) => (
                  <div key={key} className="flex justify-between gap-4 border-b pb-2" style={{ borderColor: "var(--border)" }}>
                    <dt style={{ color: "var(--text-muted)" }}>{key}</dt>
                    <dd className="text-right">{String(value)}</dd>
                  </div>
                ))}
              </dl>

              <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Documents
              </h3>
              {detail.documents.length === 0 ? (
                <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
                  None uploaded.
                </p>
              ) : (
                <ul className="mt-2 space-y-1.5 text-sm">
                  {detail.documents.map((d) => (
                    <li key={d.id} className="flex items-center justify-between">
                      <button
                        onClick={() => void viewApplicationDocument(detail.id, d.id)}
                        className="text-left text-paca-500 hover:underline"
                      >
                        {d.kind} — {d.originalName}
                      </button>
                      <span
                        className="text-xs"
                        style={{ color: d.scanStatus === "INFECTED" || d.scanStatus === "ERROR" ? "#c0392b" : "var(--text-muted)" }}
                      >
                        {SCAN_LABEL[d.scanStatus] ?? d.scanStatus}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {DECIDABLE.has(detail.status) && (
                <div className="mt-8 border-t pt-6" style={{ borderColor: "var(--border)" }}>
                  <label className="block text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    Reviewer notes (internal, optional)
                  </label>
                  <textarea
                    rows={2}
                    value={approveNotes}
                    onChange={(e) => setApproveNotes(e.target.value)}
                    className="mt-2 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-paca-500"
                    style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }}
                  />
                  <div className="mt-4 flex items-center gap-3">
                    <button
                      disabled={busyId === detail.id}
                      onClick={() => void doApprove(detail.id, detail.tier, detail.user.email, approveNotes.trim() || undefined)}
                      className="rounded-lg bg-paca-500 px-4 py-2 text-sm font-semibold text-white hover:bg-paca-600 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      disabled={busyId === detail.id}
                      onClick={() => setDecliningTarget({ id: detail.id, email: detail.user.email })}
                      className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50"
                      style={{ borderColor: "var(--border)", color: "#c0392b" }}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              )}
            </article>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------- pagination */}
      <div
        className="flex shrink-0 items-center justify-end gap-3 border-t px-6 py-2 text-xs"
        style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
      >
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

      {/* ---------------------------------------------------------- decline modal */}
      {decliningTarget && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-xl border p-6" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <h2 className="text-sm font-semibold">Decline this application</h2>
            <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
              This reason is shown to the applicant.
            </p>
            <textarea
              autoFocus
              rows={4}
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="e.g. Proof of enrollment does not match the student tier requirements."
              className="mt-3 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-paca-500"
              style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }}
            />
            <div className="mt-4 flex items-center justify-end gap-2 text-sm">
              <button
                onClick={() => {
                  setDecliningTarget(null);
                  setDeclineReason("");
                }}
                className="rounded-lg px-3 py-1.5"
                style={{ color: "var(--text-muted)" }}
              >
                Cancel
              </button>
              <button
                onClick={() => void doDecline()}
                disabled={declineReason.trim().length < 3 || busyId === decliningTarget.id}
                className="rounded-lg px-3 py-1.5 font-semibold text-white disabled:opacity-50"
                style={{ background: "#c0392b" }}
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          className="fixed bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-lg px-4 py-2 text-sm font-medium text-white"
          style={{ background: "#146b2e" }}
        >
          {toast}
        </div>
      )}
    </main>
  );
}
