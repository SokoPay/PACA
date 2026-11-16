"use client";

import { useEffect, useState } from "react";
import {
  ApiError,
  TIER_LABEL,
  createAnnouncement,
  deleteAnnouncement,
  fetchAdminAnnouncements,
  publishAnnouncement,
  type AdminAnnouncement,
  type MembershipTierValue,
} from "@/lib/api";

const AUDIENCE_LABEL: Record<string, string> = {
  ALL_USERS: "Everyone registered",
  ALL_MEMBERS: "Paid members",
  BY_TIER: "Paid members of chosen types",
  SPECIFIC_USERS: "Specific users",
};

export default function AdminAnnouncementsPage() {
  const [list, setList] = useState<AdminAnnouncement[] | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<"ALL_USERS" | "ALL_MEMBERS" | "BY_TIER">("ALL_USERS");
  const [tiers, setTiers] = useState<MembershipTierValue[]>([]);
  const [pinDays, setPinDays] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = () => fetchAdminAnnouncements().then(setList).catch(() => setList([]));
  useEffect(() => {
    void load();
  }, []);

  async function submit(publish: boolean) {
    setMsg(null);
    if (audience === "BY_TIER" && tiers.length === 0) return setMsg({ ok: false, text: "Choose at least one membership type." });
    setBusy(true);
    try {
      await createAnnouncement({ title: title.trim(), body: body.trim(), audience, tiers, publish, pinDays: pinDays ? Number(pinDays) : null, discountCode: code.trim() || null });
      setMsg({ ok: true, text: publish ? "Published — it's on every recipient's dashboard and in their notifications." : "Saved as draft." });
      setTitle("");
      setBody("");
      setTiers([]);
      setPinDays("");
      setCode("");
      await load();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? (err.fieldErrors[0]?.message ?? err.message) : "Could not save." });
    } finally {
      setBusy(false);
    }
  }

  const field = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-paca-500";
  const style = { background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" };

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold">Announcements</h1>
      <p className="mt-1 max-w-2xl text-sm" style={{ color: "var(--text-muted)" }}>
        News, events and event discounts. A published announcement shows on the dashboards of everyone in its audience
        and lands in their notification bell.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(true);
        }}
        className="mt-6 max-w-2xl space-y-4 rounded-xl border p-5"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <div>
          <label htmlFor="a-title" className="mb-1 block text-sm font-medium">Title</label>
          <input id="a-title" required minLength={3} maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} className={field} style={style} />
        </div>
        <div>
          <label htmlFor="a-body" className="mb-1 block text-sm font-medium">Message</label>
          <textarea id="a-body" required minLength={3} maxLength={4000} rows={5} value={body} onChange={(e) => setBody(e.target.value)} className={field} style={style} />
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
          <div>
            <label htmlFor="a-aud" className="mb-1 block text-sm font-medium">Who sees it</label>
            <select id="a-aud" value={audience} onChange={(e) => setAudience(e.target.value as typeof audience)} className={field} style={style}>
              <option value="ALL_USERS">Everyone registered</option>
              <option value="ALL_MEMBERS">Paid members only</option>
              <option value="BY_TIER">Paid members of chosen types</option>
            </select>
          </div>
          <div>
            <label htmlFor="a-pin" className="mb-1 block text-sm font-medium">Pin for (days)</label>
            <input id="a-pin" inputMode="numeric" value={pinDays} onChange={(e) => setPinDays(e.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="optional" className={field} style={style} />
          </div>
        </div>
        <div>
          <label htmlFor="a-code" className="mb-1 block text-sm font-medium">
            Discount code <span style={{ color: "var(--text-muted)" }}>(optional — shown with a copy button)</span>
          </label>
          <input id="a-code" maxLength={60} value={code} onChange={(e) => setCode(e.target.value)} className={field} style={style} placeholder="e.g. PACA-WEBINAR-25" />
          {code && audience === "ALL_USERS" && (
            <p className="mt-1 text-xs" style={{ color: "#b45309" }}>Everyone registered will see this code. Choose “Paid members” to keep it members-only.</p>
          )}
        </div>
        {audience === "BY_TIER" && (
          <div className="flex flex-wrap gap-2">
            {(Object.keys(TIER_LABEL) as MembershipTierValue[]).map((t) => {
              const on = tiers.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTiers(on ? tiers.filter((x) => x !== t) : [...tiers, t])}
                  className="rounded-full border px-3 py-1 text-xs font-medium"
                  style={{ borderColor: on ? "var(--color-paca-500)" : "var(--border)", background: on ? "var(--color-paca-50)" : "transparent" }}
                >
                  {TIER_LABEL[t]}
                </button>
              );
            })}
          </div>
        )}
        {msg && <p className="text-sm" style={{ color: msg.ok ? "#146c3b" : "#c0392b" }}>{msg.text}</p>}
        <div className="flex gap-3">
          <button type="submit" disabled={busy} className="rounded-lg bg-paca-500 px-5 py-2 text-sm font-semibold text-white hover:bg-paca-600 disabled:opacity-60">
            {busy ? "Saving…" : "Publish now"}
          </button>
          <button type="button" disabled={busy} onClick={() => void submit(false)} className="rounded-lg border px-5 py-2 text-sm font-semibold" style={{ borderColor: "var(--border)" }}>
            Save draft
          </button>
        </div>
      </form>

      <h2 className="mt-10 font-semibold">All announcements</h2>
      <div className="mt-3 max-w-3xl space-y-3">
        {list?.length === 0 && <p className="text-sm" style={{ color: "var(--text-muted)" }}>None yet.</p>}
        {list?.map((a) => (
          <div key={a.id} className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">{a.title}</p>
                <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
                  {a.status === "PUBLISHED" ? `Published ${a.publishedAt ? new Date(a.publishedAt).toLocaleDateString() : ""}` : "Draft"} ·{" "}
                  {AUDIENCE_LABEL[a.audience]}
                  {a.audience === "BY_TIER" ? ` (${a.visibleToTiers.map((t) => TIER_LABEL[t]).join(", ")})` : ""}
                  {a.pinnedUntil && new Date(a.pinnedUntil) > new Date() ? " · pinned" : ""}
                </p>
              </div>
              <div className="flex gap-3 text-sm">
                {a.status !== "PUBLISHED" && (
                  <button onClick={() => void publishAnnouncement(a.id).then(load)} className="font-semibold text-paca-500 hover:underline">Publish</button>
                )}
                <button
                  onClick={() => {
                    if (window.confirm("Delete this announcement? Notifications already sent stay in members' bells.")) void deleteAnnouncement(a.id).then(load);
                  }}
                  className="hover:underline"
                  style={{ color: "#c0392b" }}
                >
                  Delete
                </button>
              </div>
            </div>
            <p className="mt-2 line-clamp-3 whitespace-pre-line text-sm" style={{ color: "var(--text-muted)" }}>{a.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
