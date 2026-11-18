"use client";

import { useState } from "react";
import { ApiError, confirmOfflinePayment, type OfflinePaymentMethod } from "@/lib/api";

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";

const METHODS: Array<{ value: OfflinePaymentMethod; label: string }> = [
  { value: "CASH", label: "Cash" },
  { value: "BANK_TRANSFER", label: "Bank transfer to PACA" },
  { value: "MOBILE_MONEY", label: "Mobile money to PACA" },
];

/**
 * Approved ≠ active. Shows whether an approved member's payment is confirmed
 * and lets a SUPERADMIN confirm a payment made in cash or directly to PACA,
 * which activates the membership for one year from the payment date.
 */
export function MembershipPaymentPanel({
  userId,
  membership,
  canConfirm,
  onConfirmed,
}: {
  userId: string;
  membership: { memberNumber: string; status: string; currentPeriodEnd: string | null } | null;
  canConfirm: boolean;
  onConfirmed: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<OfflinePaymentMethod>("CASH");
  const [receivedOn, setReceivedOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!membership) return null;
  const paid = membership.status === "ACTIVE";
  const payable = membership.status === "PENDING_PAYMENT" || membership.status === "LAPSED";

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const r = await confirmOfflinePayment(userId, { method, receivedOn, note: note.trim() || undefined });
      onConfirmed(`Payment confirmed. Membership ${r.memberNumber} is active until ${fmtDate(r.currentPeriodEnd)}.`);
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? (err.fieldErrors[0]?.message ?? err.message) : "Could not confirm the payment.");
    } finally {
      setBusy(false);
    }
  }

  const input = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-paca-500";
  const inputStyle = { background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" };

  return (
    <section
      className="rounded-xl border p-4"
      style={{ borderColor: paid ? "#9bd8b5" : "#f0d48a", background: paid ? "#effbf3" : "#fffaf0" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold" style={{ color: paid ? "#146c3b" : "#8a6100" }}>
            {paid ? "✓ Payment confirmed: membership active" : membership.status === "LAPSED" ? "Membership expired: renewal not paid" : "Approved: payment NOT confirmed"}
          </h3>
          <p className="mt-0.5 text-xs" style={{ color: paid ? "#146c3b" : "#8a6100" }}>
            {paid
              ? `Member ${membership.memberNumber} · valid until ${fmtDate(membership.currentPeriodEnd)}`
              : "Not active until payment is confirmed: no exam, no member badge, no exam badge, no library."}
          </p>
        </div>
        {payable && canConfirm && !open && (
          <button
            onClick={() => setOpen(true)}
            className="shrink-0 rounded-lg bg-[#1f9d55] px-4 py-2 text-sm font-semibold text-white hover:bg-[#178a49]"
          >
            ✓ Confirm payment received
          </button>
        )}
      </div>
      {payable && !canConfirm && (
        <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
          Online payments are confirmed automatically. Cash or direct payments are confirmed by a super admin.
        </p>
      )}

      {open && (
        <div className="mt-4 space-y-3 border-t pt-4" style={{ borderColor: "#f0d48a" }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs" style={{ color: "var(--text-muted)" }}>
              How was it paid?
              <select value={method} onChange={(e) => setMethod(e.target.value as OfflinePaymentMethod)} className={`${input} mt-1`} style={inputStyle}>
                {METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </label>
            <label className="text-xs" style={{ color: "var(--text-muted)" }}>
              Date received
              <input type="date" value={receivedOn} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setReceivedOn(e.target.value)} className={`${input} mt-1`} style={inputStyle} />
            </label>
            <label className="text-xs sm:col-span-2" style={{ color: "var(--text-muted)" }}>
              Note (optional: receipt number, who received it)
              <input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} className={`${input} mt-1`} style={inputStyle} />
            </label>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-1" />
            <span>I confirm PACA has received the full membership fee from this member.</span>
          </label>
          {error && <p className="text-sm text-[#c0392b]">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              disabled={!checked || busy || !receivedOn}
              onClick={() => void confirm()}
              className="rounded-lg bg-[#1f9d55] px-4 py-2 text-sm font-semibold text-white hover:bg-[#178a49] disabled:opacity-50"
            >
              {busy ? "Confirming…" : "Confirm payment and activate"}
            </button>
            <button onClick={() => setOpen(false)} className="rounded-lg border px-4 py-2 text-sm font-semibold" style={{ borderColor: "var(--border)" }}>
              Cancel
            </button>
          </div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            The membership runs for one year from the date received. The member is emailed, and this is recorded in the activity log.
          </p>
        </div>
      )}
    </section>
  );
}
