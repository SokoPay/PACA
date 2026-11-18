"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { beginExamSession } from "@/lib/activity";
import {
  ApiError,
  answerAssessmentQuestion,
  fetchAssessment,
  submitAssessment,
  type AssessmentAttemptView,
  type AssessmentResultView,
} from "@/lib/api";

const PAGE_SIZE = 10;

/**
 * The question view shared by the free competency test and the certification
 * exam. Questions come in batches of 10; members move forward and back to change
 * answers, jump to any question from the navigator, and finish on the last batch.
 * Every answer saves as it is chosen. The server owns the clock.
 */
export function AttemptRunner({
  attempt,
  title,
  kind,
  onFinished,
}: {
  attempt: AssessmentAttemptView;
  title: string;
  kind: "free" | "exam";
  onFinished: (result: AssessmentResultView) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(attempt.questions.map((q) => [q.questionId, q.selectedOptionIds])),
  );
  const [page, setPage] = useState(0);
  const [remainingMs, setRemainingMs] = useState(0);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finishing = useRef(false);
  const topRef = useRef<HTMLDivElement>(null);

  const pages = Math.max(1, Math.ceil(attempt.questions.length / PAGE_SIZE));
  const isLast = page === pages - 1;
  const pageQuestions = attempt.questions.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const finishFromServer = useCallback(async () => {
    if (finishing.current) return;
    finishing.current = true;
    try {
      const updated = await fetchAssessment(attempt.id);
      if (updated.status !== "IN_PROGRESS") onFinished(updated as AssessmentResultView);
      else finishing.current = false;
    } catch {
      finishing.current = false;
    }
  }, [attempt.id, onFinished]);

  // An open exam or test is never cut short by the idle sign-out.
  useEffect(() => beginExamSession(), []);

  useEffect(() => {
    const tick = () => {
      const ms = new Date(attempt.expiresAt).getTime() - Date.now();
      setRemainingMs(Math.max(0, ms));
      if (ms <= 0) void finishFromServer();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [attempt.expiresAt, finishFromServer]);

  const goTo = (p: number) => {
    setPage(Math.min(Math.max(p, 0), pages - 1));
    setConfirming(false);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const choose = useCallback(
    (questionId: string, optionId: string, qKind: "SINGLE_CHOICE" | "MULTI_CHOICE") => {
      setAnswers((prev) => {
        const current = prev[questionId] ?? [];
        const next =
          qKind === "SINGLE_CHOICE"
            ? [optionId]
            : current.includes(optionId)
              ? current.filter((id) => id !== optionId)
              : [...current, optionId];
        void answerAssessmentQuestion(attempt.id, questionId, next).catch(() =>
          setError("An answer didn't save — check your connection. It will save again when you change it."),
        );
        return { ...prev, [questionId]: next };
      });
    },
    [attempt.id],
  );

  const answeredCount = useMemo(() => Object.values(answers).filter((v) => v.length > 0).length, [answers]);
  const unanswered = attempt.questions
    .map((q, i) => ({ n: i + 1, answered: (answers[q.questionId] ?? []).length > 0 }))
    .filter((q) => !q.answered);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      onFinished(await submitAssessment(attempt.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit.");
      setBusy(false);
    }
  }

  const totalSec = Math.floor(remainingMs / 1000);
  const timeLabel = `${Math.floor(totalSec / 60)}:${String(totalSec % 60).padStart(2, "0")}`;
  const progress = Math.round((answeredCount / Math.max(1, attempt.questionCount)) * 100);
  const lowTime = remainingMs < 60_000;

  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <div ref={topRef} className="scroll-mt-24" />
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* ---------------------------------------------------------- questions */}
        <section>
          <div className="paca-gradient overflow-hidden rounded-3xl px-6 py-5 text-white shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/75">
                  {kind === "exam" ? "Certification exam" : "Free competency test"}
                </p>
                <h1 className="mt-1 text-xl font-bold">{title}</h1>
              </div>
              <div className="text-right">
                <p className="text-xs text-white/75">Batch {page + 1} of {pages}</p>
                <p className="text-sm font-semibold">
                  Questions {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, attempt.questions.length)}
                </p>
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-white transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>

          {error && (
            <p role="alert" className="mt-4 rounded-xl px-4 py-3 text-sm" style={{ background: "#c0392b1a", color: "#c0392b" }}>
              {error}
            </p>
          )}

          <div className="mt-6 space-y-5">
            {pageQuestions.map((q, i) => {
              const number = page * PAGE_SIZE + i + 1;
              const picked = answers[q.questionId] ?? [];
              return (
                <div
                  key={q.questionId}
                  id={`q-${number}`}
                  className="rounded-2xl border p-6 shadow-sm transition"
                  style={{ borderColor: picked.length ? "color-mix(in srgb, var(--color-paca-500) 45%, var(--border))" : "var(--border)", background: "var(--surface)" }}
                >
                  <div className="flex items-start gap-4">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold"
                      style={picked.length ? { background: "var(--color-paca-500)", color: "white" } : { background: "var(--bg)", color: "var(--text-muted)" }}
                    >
                      {number}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium leading-relaxed">{q.stem}</p>
                      {q.kind === "MULTI_CHOICE" && (
                        <p className="mt-1 text-xs font-semibold text-paca-500">Choose all that apply</p>
                      )}
                      <div className="mt-4 space-y-2">
                        {q.options.map((o, oi) => {
                          const checked = picked.includes(o.id);
                          return (
                            <label
                              key={o.id}
                              className="flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm transition hover:border-paca-400"
                              style={{
                                borderColor: checked ? "var(--color-paca-500)" : "var(--border)",
                                background: checked ? "color-mix(in srgb, var(--color-paca-500) 9%, transparent)" : "transparent",
                              }}
                            >
                              <input
                                type={q.kind === "SINGLE_CHOICE" ? "radio" : "checkbox"}
                                name={q.questionId}
                                checked={checked}
                                onChange={() => choose(q.questionId, o.id, q.kind)}
                                className="sr-only"
                              />
                              <span
                                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold"
                                style={
                                  checked
                                    ? { background: "var(--color-paca-500)", borderColor: "var(--color-paca-500)", color: "white" }
                                    : { borderColor: "var(--border)", color: "var(--text-muted)" }
                                }
                              >
                                {String.fromCharCode(65 + oi)}
                              </span>
                              <span className="pt-0.5">{o.text}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ---------------------------------------------------------- pager */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => goTo(page - 1)}
              disabled={page === 0}
              className="rounded-xl border px-5 py-3 text-sm font-semibold transition hover:border-paca-500 disabled:opacity-40"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            >
              &larr; Previous batch
            </button>
            {isLast ? (
              <button
                onClick={() => setConfirming(true)}
                className="rounded-xl bg-paca-500 px-7 py-3 text-sm font-bold text-white shadow-lg shadow-paca-500/30 hover:bg-paca-600"
              >
                Finish &amp; submit
              </button>
            ) : (
              <button
                onClick={() => goTo(page + 1)}
                className="rounded-xl bg-paca-500 px-7 py-3 text-sm font-bold text-white shadow-lg shadow-paca-500/30 hover:bg-paca-600"
              >
                Next batch &rarr;
              </button>
            )}
          </div>

          {confirming && (
            <div className="mt-5 rounded-2xl border p-5" style={{ borderColor: "var(--color-paca-500)", background: "var(--surface)" }}>
              <h2 className="font-semibold">Ready to submit?</h2>
              {unanswered.length > 0 ? (
                <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
                  You haven&rsquo;t answered {unanswered.length} question{unanswered.length === 1 ? "" : "s"}:{" "}
                  {unanswered.slice(0, 12).map((u, i) => (
                    <button key={u.n} onClick={() => goTo(Math.floor((u.n - 1) / PAGE_SIZE))} className="font-semibold text-paca-500 hover:underline">
                      {u.n}
                      {i < Math.min(unanswered.length, 12) - 1 ? ", " : ""}
                    </button>
                  ))}
                  {unanswered.length > 12 ? "…" : ""}. Go back and answer them, or submit as it is.
                </p>
              ) : (
                <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
                  All {attempt.questionCount} questions answered. You can still go back to check any batch.
                </p>
              )}
              {kind === "exam" && (
                <p className="mt-2 text-xs font-semibold" style={{ color: "#b45309" }}>
                  Submitting ends this exam attempt — it can&rsquo;t be reopened.
                </p>
              )}
              <div className="mt-4 flex gap-3">
                <button onClick={() => void submit()} disabled={busy} className="rounded-xl bg-paca-500 px-6 py-2.5 text-sm font-bold text-white hover:bg-paca-600 disabled:opacity-60">
                  {busy ? "Submitting…" : "Submit now"}
                </button>
                <button onClick={() => setConfirming(false)} className="rounded-xl border px-6 py-2.5 text-sm font-semibold" style={{ borderColor: "var(--border)" }}>
                  Keep reviewing
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ---------------------------------------------------------- side panel */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border p-5 shadow-sm" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Time left</p>
            <p className="mt-1 font-mono text-4xl font-extrabold" style={{ color: lowTime ? "#c0392b" : "var(--text)" }}>
              {timeLabel}
            </p>
            <p className="mt-3 text-sm">
              <strong>{answeredCount}</strong> of {attempt.questionCount} answered
            </p>

            <p className="mt-5 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Questions</p>
            <div className="mt-2 grid grid-cols-5 gap-1.5">
              {attempt.questions.map((q, i) => {
                const done = (answers[q.questionId] ?? []).length > 0;
                const onPage = Math.floor(i / PAGE_SIZE) === page;
                return (
                  <button
                    key={q.questionId}
                    onClick={() => {
                      const target = Math.floor(i / PAGE_SIZE);
                      if (target !== page) goTo(target);
                      setTimeout(() => document.getElementById(`q-${i + 1}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
                    }}
                    className="h-9 rounded-lg text-xs font-bold transition hover:scale-105"
                    style={{
                      background: done ? "var(--color-paca-500)" : "var(--bg)",
                      color: done ? "white" : "var(--text-muted)",
                      outline: onPage ? "2px solid var(--color-paca-300)" : "none",
                      outlineOffset: 1,
                    }}
                    aria-label={`Question ${i + 1}${done ? ", answered" : ""}`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex gap-4 text-[11px]" style={{ color: "var(--text-muted)" }}>
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-paca-500" /> Answered</span>
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded" style={{ background: "var(--bg)", border: "1px solid var(--border)" }} /> Not yet</span>
            </div>
            <p className="mt-4 text-xs" style={{ color: "var(--text-muted)" }}>Answers save automatically. Go back to any batch to change them.</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
