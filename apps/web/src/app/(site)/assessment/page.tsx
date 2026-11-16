"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ApiError,
  fetchActiveAssessment,
  restoreSession,
  shareAssessment,
  siteUrl,
  startAssessment,
  type AssessmentAttemptView,
  type AssessmentResultView,
} from "@/lib/api";
import { AttemptRunner } from "@/components/AttemptRunner";
import { ShareButtons } from "@/components/ShareButtons";

/** A congratulation that fits the score — every finish deserves one. */
function cheer(scoreBps: number): { headline: string; line: string } {
  if (scoreBps >= 9000) return { headline: "Outstanding! 🏆", line: "That's an exceptional result — you clearly know your Agile." };
  if (scoreBps >= 8000) return { headline: "Excellent work! 🎉", line: "A strong score. You're ready to aim for certification." };
  if (scoreBps >= 7000) return { headline: "Well done! 👏", line: "A solid result. Review the few you missed and you'll be exam-ready." };
  if (scoreBps >= 5000) return { headline: "Good effort! 💪", line: "You have good foundations. The answers below show exactly what to study next." };
  return { headline: "Thanks for taking the test! 🌱", line: "Every expert started here. Go through the answers below — that's how you learn fastest." };
}

export default function FreeTestPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [attempt, setAttempt] = useState<AssessmentAttemptView | null>(null);
  const [result, setResult] = useState<AssessmentResultView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    (async () => {
      const session = await restoreSession();
      if (!session) {
        router.replace("/login?next=/assessment");
        return;
      }
      setChecking(false);
      try {
        const active = await fetchActiveAssessment();
        if (active) setAttempt(active);
      } catch {
        // No active attempt — show the start screen.
      }
    })();
  }, [router]);

  async function start() {
    setStarting(true);
    setError(null);
    setResult(null);
    setShareUrl(null);
    try {
      setAttempt(await startAssessment());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not start the test.");
    } finally {
      setStarting(false);
    }
  }

  async function share() {
    if (!result) return;
    try {
      await shareAssessment(result.id);
      setShareUrl(siteUrl(`/score/${result.id}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create a share link.");
    }
  }

  if (checking) {
    return <main className="flex min-h-[50vh] items-center justify-center text-sm" style={{ color: "var(--text-muted)" }}>Loading…</main>;
  }

  if (attempt && !result) {
    return (
      <AttemptRunner
        attempt={attempt}
        title="Free competency test"
        onFinished={(r) => {
          setResult(r);
          setAttempt(null);
          window.scrollTo({ top: 0 });
        }}
      />
    );
  }

  // ---------------------------------------------------------------- result
  if (result) {
    const pct = Math.round((result.scoreBps ?? 0) / 100);
    const { headline, line } = cheer(result.scoreBps ?? 0);
    const wrong = result.review.filter((q) => !q.isCorrect);
    const shown = showAll ? result.review : wrong;

    return (
      <main className="mx-auto max-w-3xl px-5 py-12">
        <section className="relative overflow-hidden rounded-3xl p-8 text-center text-white shadow-xl paca-gradient">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
            {result.status === "EXPIRED" ? "Time's up — here's how you did" : "Your result"}
          </p>
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">{headline}</h1>
          <p className="mx-auto mt-2 max-w-md text-white/90">{line}</p>
          <div className="mx-auto mt-6 flex h-36 w-36 flex-col items-center justify-center rounded-full bg-white/15 ring-4 ring-white/30 backdrop-blur">
            <span className="text-5xl font-extrabold">{pct}%</span>
            <span className="text-xs text-white/80">
              {result.correctCount} of {result.questionCount} correct
            </span>
          </div>
          <p className="mt-5 inline-block rounded-full bg-white/20 px-4 py-1.5 text-sm font-semibold">
            Competency level: {result.competency.level}
          </p>
        </section>

        <div className="mt-6 rounded-2xl border p-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <h2 className="font-semibold">Share your score</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            Let your network know. The shared page shows your first name, initial, score and level — never your answers.
          </p>
          <div className="mt-4">
            {shareUrl ? (
              <ShareButtons url={shareUrl} text={`I scored ${pct}% on the PACA Agile competency test (${result.competency.level} level)!`} />
            ) : (
              <button onClick={() => void share()} className="rounded-xl bg-paca-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-paca-600">
                Create share link
              </button>
            )}
          </div>
        </div>

        <section className="mt-6 grid gap-5 sm:grid-cols-2">
          <div className="rounded-2xl border p-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <h2 className="font-semibold">What this means</h2>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
              {result.competency.advice}
            </p>
            <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
              This free test is for practice and has no certificate. PACA certificates are earned by paid members who pass the
              certification exam for their membership type.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/membership" className="rounded-lg bg-paca-500 px-4 py-2 text-sm font-semibold text-white hover:bg-paca-600">
                Get certified
              </Link>
              <button onClick={() => void start()} className="rounded-lg border px-4 py-2 text-sm font-semibold hover:border-paca-500" style={{ borderColor: "var(--border)" }}>
                Try again
              </button>
            </div>
          </div>
          <div className="rounded-2xl border p-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <h2 className="font-semibold">Score by topic</h2>
            <div className="mt-3 space-y-3">
              {result.topics.map((t) => {
                const p = Math.round((t.correct / t.total) * 100);
                return (
                  <div key={t.topic}>
                    <div className="flex justify-between text-xs">
                      <span>{t.topic}</span>
                      <span style={{ color: "var(--text-muted)" }}>{t.correct}/{t.total}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full" style={{ background: "var(--border)" }}>
                      <div className="h-full rounded-full" style={{ width: `${p}%`, background: p >= 70 ? "var(--color-paca-500)" : "#e3a008" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">{showAll ? "All questions" : wrong.length ? `Questions to review (${wrong.length})` : "You got every question right!"}</h2>
              <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
                Your answer is marked, the correct answer is highlighted in green, with an explanation where we have one.
              </p>
            </div>
            <button onClick={() => setShowAll((v) => !v)} className="text-sm font-semibold text-paca-500 hover:underline">
              {showAll ? "Show only the ones I missed" : "Show all questions"}
            </button>
          </div>

          <div className="mt-5 space-y-4">
            {shown.map((q, i) => {
              const correct = new Set(q.correctOptionIds ?? []);
              return (
                <div
                  key={i}
                  className="rounded-2xl border p-5"
                  style={{ borderColor: q.isCorrect ? "#2e9e5b" : "#e5484d", background: "var(--surface)" }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium leading-relaxed">{q.stem}</p>
                    <span
                      className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      style={q.isCorrect ? { background: "#d4f5e2", color: "#146c3b" } : { background: "#fde2e2", color: "#b42318" }}
                    >
                      {q.isCorrect ? "Correct" : q.selectedOptionIds.length ? "Incorrect" : "Not answered"}
                    </span>
                  </div>
                  <ul className="mt-3 space-y-2">
                    {q.options.map((o) => {
                      const mine = q.selectedOptionIds.includes(o.id);
                      const right = correct.has(o.id);
                      return (
                        <li
                          key={o.id}
                          className="flex items-start gap-2 rounded-lg px-3 py-2 text-sm"
                          style={{
                            background: right ? "#d4f5e2" : mine ? "#fde2e2" : "transparent",
                            color: right ? "#0f5132" : mine ? "#842029" : "var(--text-muted)",
                          }}
                        >
                          <span aria-hidden>{right ? "✓" : mine ? "✗" : "•"}</span>
                          <span className="flex-1">{o.text}</span>
                          {mine && <span className="text-xs font-semibold">Your answer</span>}
                          {right && !mine && <span className="text-xs font-semibold">Correct answer</span>}
                        </li>
                      );
                    })}
                  </ul>
                  {q.explanation && (
                    <p className="mt-3 rounded-lg px-3 py-2 text-sm leading-relaxed" style={{ background: "var(--bg)", color: "var(--text-muted)" }}>
                      <strong style={{ color: "var(--text)" }}>Why: </strong>
                      {q.explanation}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>
    );
  }

  // ---------------------------------------------------------------- start
  return (
    <main className="mx-auto max-w-3xl px-5 py-16">
      <section className="relative overflow-hidden rounded-3xl p-10 text-center text-white shadow-xl paca-gradient">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">Free for every registered member</p>
        <h1 className="mt-3 text-4xl font-bold">Free competency test</h1>
        <p className="mx-auto mt-4 max-w-xl leading-relaxed text-white/90">
          Find out where you stand in Agile. 20 questions, 30 minutes. You&rsquo;ll get your score, a competency level, a
          breakdown by topic — and every question you missed with the correct answer, so you learn as you go.
        </p>
        {error && (
          <p role="alert" className="mx-auto mt-6 max-w-md rounded-lg bg-white/90 px-4 py-3 text-sm" style={{ color: "#b42318" }}>
            {error}
          </p>
        )}
        <button
          onClick={() => void start()}
          disabled={starting}
          className="mt-8 rounded-xl bg-white px-8 py-3.5 text-sm font-bold text-paca-600 shadow-lg transition hover:scale-[1.02] disabled:opacity-60"
        >
          {starting ? "Starting…" : "Start the test"}
        </button>
        <p className="mt-4 text-xs text-white/70">No certificate is issued for this practice test.</p>
      </section>
    </main>
  );
}
