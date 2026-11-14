"use client";

import { useEffect, useState } from "react";
import { ApiError, fetchAdminPartnerOffers, saveAdminPartnerOffer, type AdminPartnerOffer } from "@/lib/api";

function OfferForm({ initial, onSaved }: { initial: AdminPartnerOffer; onSaved: (o: AdminPartnerOffer) => void }) {
  const [percent, setPercent] = useState(initial.discountPercent?.toString() ?? "");
  const [code, setCode] = useState(initial.code ?? "");
  const [note, setNote] = useState(initial.note ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const n = percent.trim() ? Number(percent) : null;
    if (n !== null && (!Number.isInteger(n) || n < 1 || n > 100)) {
      setMsg({ ok: false, text: "Discount must be a whole number from 1 to 100, or empty." });
      return;
    }
    setBusy(true);
    try {
      const saved = await saveAdminPartnerOffer(initial.slug, { discountPercent: n, code: code.trim() || null, note: note.trim() || null });
      onSaved(saved);
      setMsg({ ok: true, text: "Saved." });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : "Could not save." });
    } finally {
      setBusy(false);
    }
  }

  const field = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-paca-500";
  const style = { background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" };

  return (
    <form onSubmit={save} className="rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{initial.name}</h2>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {initial.discountPercent ? `Live: ${initial.discountPercent}% off` : "Not set: shown as “coming soon”"}
        </span>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-[120px_1fr]">
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor={`${initial.slug}-pct`}>Discount %</label>
          <input id={`${initial.slug}-pct`} inputMode="numeric" value={percent} onChange={(e) => setPercent(e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="e.g. 15" className={field} style={style} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor={`${initial.slug}-code`}>Discount code <span style={{ color: "var(--text-muted)" }}>(paid members only)</span></label>
          <input id={`${initial.slug}-code`} value={code} onChange={(e) => setCode(e.target.value)} maxLength={100} placeholder="e.g. PACA15" className={field} style={style} />
        </div>
      </div>
      <div className="mt-4">
        <label className="mb-1 block text-sm font-medium" htmlFor={`${initial.slug}-note`}>How to redeem <span style={{ color: "var(--text-muted)" }}>(optional, paid members only)</span></label>
        <textarea id={`${initial.slug}-note`} rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="e.g. Enter the code at checkout, or email the trainer with your PACA member number." className={field} style={style} />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button type="submit" disabled={busy} className="rounded-lg bg-paca-500 px-5 py-2 text-sm font-semibold text-white hover:bg-paca-600 disabled:opacity-60">
          {busy ? "Saving…" : "Save"}
        </button>
        {msg && <span className="text-sm" style={{ color: msg.ok ? "#146c3b" : "#c0392b" }}>{msg.text}</span>}
      </div>
    </form>
  );
}

export default function AdminPartnersPage() {
  const [offers, setOffers] = useState<AdminPartnerOffer[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminPartnerOffers()
      .then(setOffers)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load partners."));
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold">Partner discounts</h1>
      <p className="mt-1 max-w-2xl text-sm" style={{ color: "var(--text-muted)" }}>
        Set the discount each partner has agreed for PACA members. The percentage shows publicly on the course pages; the
        code and redemption steps are shown only to members with an active (paid) membership. Leave the percentage empty
        while it is still being agreed.
      </p>
      {error && <p className="mt-4 text-sm" style={{ color: "#c0392b" }}>{error}</p>}
      {!offers && !error && <p className="mt-4 text-sm" style={{ color: "var(--text-muted)" }}>Loading…</p>}
      <div className="mt-6 max-w-2xl space-y-4">
        {offers?.map((o) => (
          <OfferForm key={o.slug} initial={o} onSaved={(s) => setOffers((list) => list?.map((x) => (x.slug === s.slug ? s : x)) ?? null)} />
        ))}
      </div>
    </div>
  );
}
