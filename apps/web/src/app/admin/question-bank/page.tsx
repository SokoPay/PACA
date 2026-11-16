"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, api } from "@/lib/api";

interface BankTier {
  tier: "STUDENT" | "PROFESSIONAL" | "EXECUTIVE" | "RETIRED";
  name: string;
  difficulty: string;
  perExam: number;
  published: number;
  inReview: number;
  recommended: number;
}

export default function QuestionBankPage() {
  const [data, setData] = useState<{ aiEnabled: boolean; tiers: BankTier[] } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [count, setCount] = useState(20);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = () => api<{ aiEnabled: boolean; tiers: BankTier[] }>("/admin/question-bank").then(setData).catch(() => setData({ aiEnabled: false, tiers: [] }));
  useEffect(() => {
    void load();
  }, []);

  async function generate(t: BankTier) {
    setBusy(t.tier);
    setMsg({ ok: true, text: `Drafting ${count} ${t.name} questions… this takes a minute or two.` });
    try {
      const r = await api<{ created: number; skipped: number }>("/admin/question-bank/generate", {
        method: "POST",
        body: JSON.stringify({ tier: t.tier, count }),
      });
      setMsg({ ok: true, text: `${r.created} new ${t.name} questions are waiting in the review queue${r.skipped ? ` (${r.skipped} duplicates or invalid skipped)` : ""}.` });
      await load();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : "Could not generate questions." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold">Exam question bank</h1>
      <p className="mt-1 max-w-3xl text-sm" style={{ color: "var(--text-muted)" }}>
        Each membership type has its own question pool — Student, Professional and Executive exams never share questions.
        Every exam sitting draws a fresh random set from its pool, in a random order with shuffled answers, so members
        sitting at the same time get different papers. Keep each pool well above the recommended size.
      </p>
      <p className="mt-2 max-w-3xl text-sm" style={{ color: "var(--text-muted)" }}>
        &ldquo;Draft with AI&rdquo; writes <strong>original</strong> questions grounded in the Scrum Guide and Kanban Guide (both
        openly licensed). Nothing reaches an exam until a reviewer approves it in the{" "}
        <Link href="/admin/queue" className="font-semibold text-paca-500 hover:underline">review queue</Link>.
      </p>

      {data && !data.aiEnabled && (
        <p className="mt-4 rounded-lg px-3 py-2 text-sm" style={{ background: "#fdf2d0", color: "#8a6100" }}>
          AI drafting is off: set ANTHROPIC_API_KEY in .env.production and restart the API. You can still add questions by hand.
        </p>
      )}
      {msg && (
        <p className="mt-4 rounded-lg px-3 py-2 text-sm" style={{ background: msg.ok ? "var(--color-paca-50)" : "#c0392b1a", color: msg.ok ? "var(--color-paca-800)" : "#c0392b" }}>
          {msg.text}
        </p>
      )}

      <div className="mt-4 flex items-center gap-2 text-sm">
        <label htmlFor="qcount">Questions per draft:</label>
        <select id="qcount" value={count} onChange={(e) => setCount(Number(e.target.value))} className="rounded-lg border px-2 py-1" style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }}>
          {[10, 20, 30].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      <div className="mt-6 grid max-w-4xl gap-4 md:grid-cols-2">
        {data?.tiers.map((t) => {
          const pct = Math.min(100, Math.round((t.published / Math.max(1, t.recommended)) * 100));
          const ready = t.published >= t.perExam;
          return (
            <div key={t.tier} className="rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{t.name}</h2>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{t.difficulty} pool · {t.perExam} questions per exam</p>
                </div>
                <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={ready ? { background: "#d4f5e2", color: "#146c3b" } : { background: "#fde2e2", color: "#b42318" }}>
                  {ready ? "Exam ready" : "Not enough questions"}
                </span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full" style={{ background: "var(--border)" }}>
                <div className="h-full rounded-full bg-paca-500" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-2 text-sm">
                <strong>{t.published}</strong> approved · {t.inReview} awaiting review · aim for {t.recommended}+
              </p>
              <button
                onClick={() => void generate(t)}
                disabled={!data.aiEnabled || busy !== null}
                className="mt-4 rounded-lg bg-paca-500 px-4 py-2 text-sm font-semibold text-white hover:bg-paca-600 disabled:opacity-50"
              >
                {busy === t.tier ? "Drafting…" : `Draft ${count} with AI`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
