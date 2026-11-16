"use client";

import { useEffect, useState } from "react";
import { ApiError, createEvent, deleteEvent, fetchAdminEvents, publishEvent, type AdminEvent } from "@/lib/api";

const EMPTY = {
  title: "",
  summary: "",
  description: "",
  startsAt: "",
  endsAt: "",
  location: "",
  isOnline: false,
  registerUrl: "",
  priceText: "",
  pct: "",
  code: "",
};

export default function AdminEventsPage() {
  const [list, setList] = useState<AdminEvent[] | null>(null);
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = () => fetchAdminEvents().then(setList).catch(() => setList([]));
  useEffect(() => {
    void load();
  }, []);

  const set = (k: keyof typeof EMPTY, v: string | boolean) => setF((cur) => ({ ...cur, [k]: v }));

  async function submit(publish: boolean) {
    setMsg(null);
    if (!f.startsAt) return setMsg({ ok: false, text: "Choose the start date and time." });
    setBusy(true);
    try {
      await createEvent({
        title: f.title.trim(),
        summary: f.summary.trim(),
        description: f.description.trim() || null,
        startsAt: new Date(f.startsAt).toISOString(),
        endsAt: f.endsAt ? new Date(f.endsAt).toISOString() : null,
        location: f.isOnline ? "Online" : f.location.trim() || null,
        isOnline: f.isOnline,
        registerUrl: f.registerUrl.trim() || null,
        priceText: f.priceText.trim() || null,
        memberDiscountPercent: f.pct ? Number(f.pct) : null,
        memberDiscountCode: f.code.trim() || null,
        publish,
      });
      setMsg({
        ok: true,
        text: publish ? "Published — it's on the home page, and every paid member was notified with their code on the dashboard." : "Saved as draft.",
      });
      setF(EMPTY);
      await load();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? (err.fieldErrors[0]?.message ?? err.message) : "Could not save." });
    } finally {
      setBusy(false);
    }
  }

  const field = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-paca-500";
  const style = { background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" };
  const label = "mb-1 block text-sm font-medium";

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold">Events &amp; member discounts</h1>
      <p className="mt-1 max-w-2xl text-sm" style={{ color: "var(--text-muted)" }}>
        Publish an event to show it on the home page and the Events page, and push it to every paid member. The discount
        percentage is public; the discount code is shown only to paid members on their dashboard. For a discount that
        isn&rsquo;t an event, use Announcements with a discount code.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(true);
        }}
        className="mt-6 max-w-3xl space-y-4 rounded-xl border p-5"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <div>
          <label className={label} htmlFor="e-title">Event title</label>
          <input id="e-title" required minLength={3} maxLength={160} value={f.title} onChange={(e) => set("title", e.target.value)} className={field} style={style} placeholder="e.g. Agile Africa Summit 2027" />
        </div>
        <div>
          <label className={label} htmlFor="e-summary">One-line summary</label>
          <input id="e-summary" required minLength={3} maxLength={300} value={f.summary} onChange={(e) => set("summary", e.target.value)} className={field} style={style} />
        </div>
        <div>
          <label className={label} htmlFor="e-desc">Details <span style={{ color: "var(--text-muted)" }}>(optional)</span></label>
          <textarea id="e-desc" rows={3} maxLength={4000} value={f.description} onChange={(e) => set("description", e.target.value)} className={field} style={style} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="e-start">Starts</label>
            <input id="e-start" type="datetime-local" required value={f.startsAt} onChange={(e) => set("startsAt", e.target.value)} className={field} style={style} />
          </div>
          <div>
            <label className={label} htmlFor="e-end">Ends <span style={{ color: "var(--text-muted)" }}>(optional)</span></label>
            <input id="e-end" type="datetime-local" value={f.endsAt} onChange={(e) => set("endsAt", e.target.value)} className={field} style={style} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <div>
            <label className={label} htmlFor="e-loc">Venue / city</label>
            <input id="e-loc" disabled={f.isOnline} maxLength={160} value={f.isOnline ? "Online" : f.location} onChange={(e) => set("location", e.target.value)} className={field} style={style} placeholder="e.g. Accra, Ghana" />
          </div>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input type="checkbox" checked={f.isOnline} onChange={(e) => set("isOnline", e.target.checked)} /> Online event
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="e-url">Registration link</label>
            <input id="e-url" type="url" value={f.registerUrl} onChange={(e) => set("registerUrl", e.target.value)} className={field} style={style} placeholder="https://…" />
          </div>
          <div>
            <label className={label} htmlFor="e-price">Price</label>
            <input id="e-price" maxLength={60} value={f.priceText} onChange={(e) => set("priceText", e.target.value)} className={field} style={style} placeholder="e.g. GHS 500 or Free" />
          </div>
        </div>
        <div className="grid gap-4 rounded-xl p-4 sm:grid-cols-[140px_1fr]" style={{ background: "var(--bg)" }}>
          <div>
            <label className={label} htmlFor="e-pct">Member discount %</label>
            <input id="e-pct" inputMode="numeric" value={f.pct} onChange={(e) => set("pct", e.target.value.replace(/\D/g, "").slice(0, 3))} className={field} style={{ ...style, background: "var(--surface)" }} placeholder="e.g. 20" />
          </div>
          <div>
            <label className={label} htmlFor="e-code">Member discount code <span style={{ color: "var(--text-muted)" }}>(paid members only)</span></label>
            <input id="e-code" maxLength={60} value={f.code} onChange={(e) => set("code", e.target.value)} className={field} style={{ ...style, background: "var(--surface)" }} placeholder="e.g. PACA20" />
          </div>
        </div>
        {msg && <p className="text-sm" style={{ color: msg.ok ? "#146c3b" : "#c0392b" }}>{msg.text}</p>}
        <div className="flex gap-3">
          <button type="submit" disabled={busy} className="rounded-lg bg-paca-500 px-5 py-2 text-sm font-semibold text-white hover:bg-paca-600 disabled:opacity-60">
            {busy ? "Saving…" : "Publish & notify members"}
          </button>
          <button type="button" disabled={busy} onClick={() => void submit(false)} className="rounded-lg border px-5 py-2 text-sm font-semibold" style={{ borderColor: "var(--border)" }}>
            Save draft
          </button>
        </div>
      </form>

      <h2 className="mt-10 font-semibold">All events</h2>
      <div className="mt-3 max-w-3xl space-y-3">
        {list?.length === 0 && <p className="text-sm" style={{ color: "var(--text-muted)" }}>No events yet.</p>}
        {list?.map((e) => (
          <div key={e.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <div className="min-w-0">
              <p className="font-semibold">{e.title}</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {new Date(e.startsAt).toLocaleString()} · {e.location ?? "—"} · {e.status === "PUBLISHED" ? "Published" : "Draft"}
                {e.memberDiscountPercent ? ` · ${e.memberDiscountPercent}% off` : ""}
                {e.memberDiscountCode ? ` · code ${e.memberDiscountCode}` : ""}
              </p>
            </div>
            <div className="flex gap-3 text-sm font-semibold">
              {e.status !== "PUBLISHED" && (
                <button onClick={() => void publishEvent(e.id).then(load)} className="text-paca-500 hover:underline">Publish</button>
              )}
              <button
                onClick={() => {
                  if (window.confirm("Delete this event?")) void deleteEvent(e.id).then(load);
                }}
                className="hover:underline"
                style={{ color: "#c0392b" }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
