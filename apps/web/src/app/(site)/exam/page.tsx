"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ApiError,
  fetchExamStatus,
  restoreSession,
  startExam,
  viewCertificatePdf,
  type AssessmentAttemptView,
  type AssessmentResultView,
  type ExamStatus,
} from "@/lib/api";
import { AttemptRunner } from "@/components/AttemptRunner";
import { badgeFor } from "@/lib/brand";

export default function ExamPage() {
  const router = useRouter();
  const [status, setStatus] = useState<ExamStatus | null>(null);
  const [attempt, setAttempt] = useState<AssessmentAttemptView | null>(null);
  const [result, setResult] = useState<AssessmentResultView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  async function load() {
    const s = await fetchExamStatus();
    setStatus(s);
    if (s.activeAttempt) setAttempt(s.activeAttempt);
  }

  useEffect(() => {
    (async () => {
      const session = await restoreSession();
      if (!session) {
        router.replace("/login?next=/exam");
        return;
      }
      await load().catch(() => setError("Could not load your exam status."));
    })();
  }, [router]);

  async function begin() {
    if (!window.confirm("Start your certification exam now? This uses one of your chances and the timer starts immediately.")) return;
    setStarting(true);
    setError(null);
    try {
      setAttempt(await startExam());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not start the exam.");
    } finally {
      setStarting(false);
    }
  }

  if (attempt && !result) {
    return (
      <AttemptRunner
        attempt={attempt}
        title={`${status?.tierName ?? "PACA"} certification exam`}
        kind="exam"
        onFinished={(r) => {
          setResult(r);
          setAttempt(null);
          window.scrollTo({ top: 0 });
          void load().catch(() => {});
        }}
      />
    );
  }

  const badge = status?.tier ? badgeFor(status.tier) : undefined;

  if (result) {
    const pct = Math.round((result.scoreBps ?? 0) / 100);
    return (
      <main className="mx-auto max-w-2xl px-5 py-14">
        <section className={`rounded-3xl p-8 text-center shadow-xl ${result.passed ? "paca-gradient text-white" : ""}`} style={result.passed ? {} : { background: "var(--surface)", border: "1px solid var(--border)" }}>
          {result.passed && badge && <Image src={badge.image} alt="" width={160} height={135} className="mx-auto h-[135px] w-auto rounded-xl bg-white/90 p-2" />}
          <h1 className="mt-4 text-3xl font-bold">{result.passed ? "Congratulations — you're certified! 🎉" : "Not this time"}</h1>
          <p className={`mt-2 ${result.passed ? "text-white/90" : ""}`} style={result.passed ? {} : { color: "var(--text-muted)" }}>
            You scored {pct}% ({result.correctCount}/{result.questionCount}). Pass mark {Math.round(result.passMarkBps / 100)}%.
          </p>
          {result.passed && result.certificate ? (
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button onClick={() => void viewCertificatePdf(result.certificate!.id)} className="rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-paca-600">
                View certificate
              </button>
              <Link href="/dashboard" className="rounded-xl border border-white/60 px-5 py-2.5 text-sm font-semibold text-white">
                Share your badge
              </Link>
            </div>
          ) : (
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/dashboard/library" className="rounded-xl bg-paca-500 px-5 py-2.5 text-sm font-semibold text-white">
                Study in the member library
              </Link>
              <Link href="/assessment" className="rounded-xl border px-5 py-2.5 text-sm font-semibold" style={{ borderColor: "var(--border)" }}>
                Practise with the free test
              </Link>
            </div>
          )}
        </section>
        <p className="mt-6 text-center text-xs" style={{ color: "var(--text-muted)" }}>
          To keep the certification fair, exam answers are not shown. Chances left: {status?.attemptsRemaining ?? "—"} of {status?.attemptsTotal ?? 3}.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-14">
      <section className="overflow-hidden rounded-3xl border shadow-sm" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <div className="paca-gradient flex flex-col items-center gap-4 px-8 py-10 text-center text-white sm:flex-row sm:text-left">
          {badge && <Image src={badge.image} alt="" width={130} height={110} className="h-[110px] w-auto rounded-xl bg-white/90 p-2" />}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">Your main exam · paid members only</p>
            <h1 className="mt-2 text-3xl font-bold">{status?.tierName ? `${status.tierName} certification exam` : "PACA certification exam"}</h1>
            <p className="mt-2 text-white/90">
              This is the official exam for your membership. Pass it to earn your PACA certificate and verified credential.
              {status ? ` You have ${status.attemptsTotal} chances in total.` : ""}
            </p>
          </div>
        </div>

        <div className="p-8">
          {!status && !error && <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading…</p>}
          {error && (
            <p role="alert" className="mb-4 rounded-lg px-4 py-3 text-sm" style={{ background: "#c0392b1a", color: "#c0392b" }}>
              {error}
            </p>
          )}

          {status && (
            <>
              <div className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl p-5" style={{ background: "var(--bg)" }}>
                <div className="flex gap-2" aria-label={`${status.attemptsRemaining} of ${status.attemptsTotal} chances left`}>
                  {Array.from({ length: status.attemptsTotal }).map((_, i) => {
                    const used = i >= status.attemptsRemaining;
                    return (
                      <span
                        key={i}
                        className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold"
                        style={used ? { background: "var(--border)", color: "var(--text-muted)" } : { background: "var(--color-paca-500)", color: "white" }}
                      >
                        {used ? "✕" : i + 1}
                      </span>
                    );
                  })}
                </div>
                <div>
                  <p className="font-semibold">
                    {status.attemptsRemaining} of {status.attemptsTotal} chance{status.attemptsTotal === 1 ? "" : "s"} left
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Each time you start the exam uses one chance. Practise first with the free competency test — it&rsquo;s unlimited.
                  </p>
                </div>
              </div>

              {status.questionCount && (
                <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {[
                    ["Questions", String(status.questionCount)],
                    ["Time", `${status.durationMins} min`],
                    ["Pass mark", `${(status.passMarkBps ?? 0) / 100}%`],
                    ["Format", "Batches of 10"],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-xl p-4 text-center" style={{ background: "var(--bg)" }}>
                      <dt className="text-xs" style={{ color: "var(--text-muted)" }}>{k}</dt>
                      <dd className="mt-1 text-xl font-bold">{v}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {status.certificate ? (
                <div className="mt-6 rounded-xl p-5" style={{ background: "#d4f5e2", color: "#0f5132" }}>
                  <p className="font-semibold">You are certified ✓</p>
                  <p className="mt-1 text-sm">Credential ID {status.certificate.credentialId}</p>
                  <button onClick={() => void viewCertificatePdf(status.certificate!.id)} className="mt-3 text-sm font-semibold underline">
                    View certificate
                  </button>
                </div>
              ) : status.eligible ? (
                <>
                  <ul className="mt-6 space-y-2 text-sm" style={{ color: "var(--text-muted)" }}>
                    <li>• The timer starts as soon as you begin and can&rsquo;t be paused.</li>
                    <li>• Your answers save as you go; the exam submits itself when time runs out.</li>
                    <li>• Questions come in batches of 10 — you can go back to any batch and change answers before you submit.</li>
                    <li>• Starting uses one of your chances. Exam answers are not revealed afterwards.</li>
                  </ul>
                  <button
                    onClick={() => void begin()}
                    disabled={starting}
                    className="mt-6 rounded-xl bg-paca-500 px-7 py-3 text-sm font-bold text-white shadow-lg shadow-paca-500/25 hover:bg-paca-600 disabled:opacity-60"
                  >
                    {starting ? "Starting…" : `Start my certification exam (chance ${status.attemptsTotal - status.attemptsRemaining + 1} of ${status.attemptsTotal})`}
                  </button>
                </>
              ) : (
                <div className="mt-6 rounded-xl p-5" style={{ background: "var(--bg)" }}>
                  <p className="font-semibold">{status.reason}</p>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm">
                    <Link href="/dashboard" className="font-semibold text-paca-500 hover:underline">Go to my dashboard</Link>
                    <Link href="/assessment" className="font-semibold text-paca-500 hover:underline">Practise with the free test</Link>
                  </div>
                </div>
              )}

              {status.lastAttempt && !status.certificate && (
                <p className="mt-6 text-xs" style={{ color: "var(--text-muted)" }}>
                  Last attempt: {Math.round((status.lastAttempt.scoreBps ?? 0) / 100)}% — {status.lastAttempt.passed ? "passed" : "not passed"}.
                </p>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
