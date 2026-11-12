"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ApiError,
  answerAssessmentQuestion,
  fetchActiveAssessment,
  fetchAssessment,
  restoreSession,
  startAssessment,
  submitAssessment,
  viewCertificatePdf,
  type AssessmentAttemptView,
  type AssessmentResultView,
} from "@/lib/api";

function isResult(v: AssessmentAttemptView | AssessmentResultView | null): v is AssessmentResultView {
  return !!v && v.status !== "IN_PROGRESS";
}

export default function AssessmentPage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [attempt, setAttempt] = useState<AssessmentAttemptView | null>(null);
  const [result, setResult] = useState<AssessmentResultView | null>(null);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);

  // ---------------------------------------------------------------- session + initial load
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
        if (active) {
          setAttempt(active);
          setAnswers(Object.fromEntries(active.questions.map((q) => [q.questionId, q.selectedOptionIds])));
        }
      } catch {
        // No active attempt — the start screen is the correct fallback.
      }
    })();
  }, [router]);

  // ---------------------------------------------------------------- countdown
  useEffect(() => {
    if (!attempt) return;
    const tick = () => {
      const ms = new Date(attempt.expiresAt).getTime() - Date.now();
      setRemainingMs(Math.max(0, ms));
      if (ms <= 0) void handleTimeUp();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt?.id]);

  async function handleTimeUp() {
    if (!attempt) return;
    try {
      const updated = await fetchAssessment(attempt.id);
      if (isResult(updated)) {
        setResult(updated);
        setAttempt(null);
      }
    } catch {
      // best effort — the server is authoritative regardless of what the client shows
    }
  }

  async function handleStart() {
    setLoading(true);
    setError(null);
    try {
      const started = await startAssessment();
      setAttempt(started);
      setAnswers(Object.fromEntries(started.questions.map((q) => [q.questionId, q.selectedOptionIds])));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not start the assessment.");
    } finally {
      setLoading(false);
    }
  }

  const setAnswer = useCallback(
    (questionId: string, optionId: string, kind: "SINGLE_CHOICE" | "MULTI_CHOICE") => {
      setAnswers((prev) => {
        const current = prev[questionId] ?? [];
        const next =
          kind === "SINGLE_CHOICE"
            ? [optionId]
            : current.includes(optionId)
              ? current.filter((id) => id !== optionId)
              : [...current, optionId];
        if (attempt) void answerAssessmentQuestion(attempt.id, questionId, next).catch(() => {});
        return { ...prev, [questionId]: next };
      });
    },
    [attempt],
  );

  async function handleSubmit() {
    if (!attempt) return;
    setLoading(true);
    setError(null);
    try {
      const finished = await submitAssessment(attempt.id);
      setResult(finished);
      setAttempt(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit.");
    } finally {
      setLoading(false);
    }
  }

  const answeredCount = useMemo(() => Object.values(answers).filter((v) => v.length > 0).length, [answers]);

  const timeLabel = useMemo(() => {
    const totalSec = Math.floor(remainingMs / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }, [remainingMs]);

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm" style={{ color: "var(--text-muted)" }}>
        Loading…
      </main>
    );
  }

  // ---------------------------------------------------------------- result view
  if (result) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-16">
        <div
          className="rounded-xl border p-6 text-center"
          style={{ borderColor: result.passed ? "var(--color-paca-500)" : "#c0392b", background: "var(--surface)" }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            {result.status === "EXPIRED" ? "Time expired" : "Submitted"}
          </p>
          <h1 className="mt-2 text-3xl font-bold" style={{ color: result.passed ? "var(--color-paca-500)" : "#c0392b" }}>
            {Math.round(result.scoreBps / 100)}%
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
            {result.correctCount} of {result.questionCount} correct · pass mark {Math.round(result.passMarkBps / 100)}% ·{" "}
            {result.passed ? "Passed" : "Not passed"}
          </p>
          {result.certificate ? (
            <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
              This is a free open-practice assessment, not a formal PACA certification — but you've earned a
              certificate of completion.
            </p>
          ) : (
            <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
              This is a free open-practice assessment. Score {Math.round(result.passMarkBps / 100)}% or higher to
              earn a certificate of completion.
            </p>
          )}
        </div>

        {result.certificate && (
          <div
            className="mt-6 flex items-center justify-between rounded-xl border p-5"
            style={{ borderColor: "var(--color-paca-500)", background: "var(--color-paca-50)" }}
          >
            <div>
              <p className="text-sm font-semibold">Certificate earned 🎉</p>
              <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                Credential ID: {result.certificate.credentialId}
              </p>
            </div>
            <button
              onClick={() => void viewCertificatePdf(result.certificate!.id)}
              className="rounded-lg bg-paca-500 px-4 py-2 text-sm font-semibold text-white hover:bg-paca-600"
            >
              View certificate
            </button>
          </div>
        )}

        <div className="mt-10 flex items-center gap-3">
          <button
            onClick={handleStart}
            className="rounded-lg bg-paca-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-paca-600"
          >
            Try again
          </button>
          <Link href="/dashboard" className="text-sm text-paca-500 hover:underline">
            Back to dashboard
          </Link>
          <Link href="/certificates" className="text-sm text-paca-500 hover:underline">
            My certificates
          </Link>
        </div>

        <h2 className="mt-12 text-lg font-semibold">Your answers</h2>
        <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
          Correct answers are not shown, so the assessment stays a fair test for everyone who sits it.
        </p>
        <div className="mt-4 space-y-5">
          {result.review.map((q, i) => (
            <div
              key={i}
              className="rounded-xl border p-4"
              style={{ borderColor: q.isCorrect ? "var(--color-paca-500)" : "#c0392b" }}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium">{q.stem}</p>
                <span
                  className="shrink-0 text-xs font-semibold"
                  style={{ color: q.isCorrect ? "var(--color-paca-500)" : "#c0392b" }}
                >
                  {q.isCorrect ? "Correct" : "Incorrect"}
                </span>
              </div>
              <ul className="mt-3 space-y-1.5">
                {q.options.map((o) => {
                  const wasSelected = q.selectedOptionIds.includes(o.id);
                  return (
                    <li
                      key={o.id}
                      className="flex items-center gap-2 text-sm"
                      style={{ color: wasSelected ? "inherit" : "var(--text-muted)" }}
                    >
                      <span>{wasSelected ? "●" : "○"}</span>
                      <span>{o.text}</span>
                    </li>
                  );
                })}
              </ul>
              {q.selectedOptionIds.length === 0 && (
                <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
                  Not answered
                </p>
              )}
            </div>
          ))}
        </div>
      </main>
    );
  }

  // ---------------------------------------------------------------- start screen
  if (!attempt) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-20 text-center">
        <h1 className="text-3xl font-bold tracking-tight">PACA open assessment</h1>
        <p className="mt-4 leading-relaxed" style={{ color: "var(--text-muted)" }}>
          A free practice assessment drawn from the PACA question bank — 20 questions, 30 minutes, open to every
          member. Score 70% or higher to earn a certificate of completion.
        </p>
        {error && (
          <p role="alert" className="mt-6 rounded-lg px-4 py-3 text-sm" style={{ background: "#c0392b1a", color: "#c0392b" }}>
            {error}
          </p>
        )}
        <button
          onClick={handleStart}
          disabled={loading}
          className="mt-8 rounded-lg bg-paca-500 px-6 py-3 text-sm font-semibold text-white hover:bg-paca-600 disabled:opacity-60"
        >
          {loading ? "Starting…" : "Start assessment"}
        </button>
      </main>
    );
  }

  // ---------------------------------------------------------------- in-progress
  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <div
        className="sticky top-0 z-10 -mx-5 flex items-center justify-between border-b px-5 py-3"
        style={{ background: "var(--bg)", borderColor: "var(--border)" }}
      >
        <span className="text-sm font-semibold">
          {answeredCount} / {attempt.questionCount} answered
        </span>
        <span className="text-sm font-semibold" style={{ color: remainingMs < 60_000 ? "#c0392b" : "var(--text)" }}>
          {timeLabel}
        </span>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg px-4 py-3 text-sm" style={{ background: "#c0392b1a", color: "#c0392b" }}>
          {error}
        </p>
      )}

      <div className="mt-6 space-y-8">
        {attempt.questions.map((q, i) => (
          <div key={q.questionId} className="rounded-xl border p-4" style={{ borderColor: "var(--border)" }}>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Question {i + 1} of {attempt.questionCount}
            </p>
            <p className="mt-1.5 text-sm font-medium">{q.stem}</p>
            <div className="mt-3 space-y-2">
              {q.options.map((o) => {
                const checked = (answers[q.questionId] ?? []).includes(o.id);
                return (
                  <label
                    key={o.id}
                    className="flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm"
                    style={{ borderColor: checked ? "var(--color-paca-500)" : "var(--border)" }}
                  >
                    <input
                      type={q.kind === "SINGLE_CHOICE" ? "radio" : "checkbox"}
                      name={q.questionId}
                      checked={checked}
                      onChange={() => setAnswer(q.questionId, o.id, q.kind)}
                      className="mt-0.5"
                    />
                    <span>{o.text}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex justify-end">
        <button
          onClick={() => void handleSubmit()}
          disabled={loading}
          className="rounded-lg bg-paca-500 px-6 py-3 text-sm font-semibold text-white hover:bg-paca-600 disabled:opacity-60"
        >
          {loading ? "Submitting…" : "Submit assessment"}
        </button>
      </div>
    </main>
  );
}
