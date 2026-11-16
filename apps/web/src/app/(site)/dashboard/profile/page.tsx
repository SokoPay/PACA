"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, fetchMyProfile, restoreSession, updateMyProfile, type MemberProfile } from "@/lib/api";

export default function ProfilePage() {
  const router = useRouter();
  const [p, setP] = useState<MemberProfile | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (!(await restoreSession())) {
        router.replace("/login?next=/dashboard/profile");
        return;
      }
      setP(await fetchMyProfile());
    })();
  }, [router]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!p) return;
    setBusy(true);
    setMsg(null);
    try {
      setP(await updateMyProfile({ linkedinUrl: p.linkedinUrl, bio: p.bio, isPublicInDirectory: p.isPublicInDirectory }));
      setMsg({ ok: true, text: "Profile saved." });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? (err.fieldErrors[0]?.message ?? err.message) : "Could not save." });
    } finally {
      setBusy(false);
    }
  }

  const set = (k: keyof MemberProfile, v: string | boolean) => setP((cur) => (cur ? { ...cur, [k]: v } : cur));
  const field = "w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-paca-500";
  const style = { background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" };

  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <Link href="/dashboard" className="text-sm text-paca-500 hover:underline">&larr; Dashboard</Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">My profile</h1>
      <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
        What other members see about you in the professional network.
      </p>

      {!p ? (
        <p className="mt-8 text-sm" style={{ color: "var(--text-muted)" }}>Loading…</p>
      ) : (
        <form onSubmit={save} className="mt-6 space-y-4 rounded-2xl border p-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div className="rounded-xl p-4 text-sm" style={{ background: "var(--bg)" }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">From your membership application</p>
              <Link href="/dashboard/applications" className="text-xs font-semibold text-paca-500 hover:underline">
                Change in My applications →
              </Link>
            </div>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              {[
                ["Job title", p.occupation],
                ["Employer", p.employer],
                ["City", p.city],
                ["Country", p.country],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs" style={{ color: "var(--text-muted)" }}>{k}</dt>
                  <dd className="mt-0.5 font-medium">{v || "—"}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
              These come from your application, so you never have to type them twice.
            </p>
          </div>
          <div>
            <label htmlFor="linkedin" className="mb-1 block text-sm font-medium">LinkedIn profile</label>
            <input id="linkedin" type="url" value={p.linkedinUrl ?? ""} onChange={(e) => set("linkedinUrl", e.target.value)} className={field} style={style} placeholder="https://www.linkedin.com/in/your-name" />
          </div>
          <div>
            <label htmlFor="bio" className="mb-1 block text-sm font-medium">Short bio</label>
            <textarea id="bio" rows={3} value={p.bio ?? ""} onChange={(e) => set("bio", e.target.value)} maxLength={600} className={field} style={style} />
          </div>
          <label className="flex gap-3 rounded-xl p-3 text-sm" style={{ background: "var(--bg)" }}>
            <input type="checkbox" checked={p.isPublicInDirectory} onChange={(e) => set("isPublicInDirectory", e.target.checked)} className="mt-0.5" />
            <span>
              <strong>List me in the professional network.</strong>{" "}
              <span style={{ color: "var(--text-muted)" }}>
                Paid members can see your name, title, location, bio and LinkedIn link. Your email and phone are never shown.
              </span>
            </span>
          </label>
          {msg && <p className="text-sm" style={{ color: msg.ok ? "#146c3b" : "#c0392b" }}>{msg.text}</p>}
          <button type="submit" disabled={busy} className="rounded-xl bg-paca-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-paca-600 disabled:opacity-60">
            {busy ? "Saving…" : "Save profile"}
          </button>
        </form>
      )}
    </main>
  );
}
