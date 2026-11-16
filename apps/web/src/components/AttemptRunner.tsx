"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ApiError,
  answerAssessmentQuestion,
  fetchAssessment,
  submitAssessment,
  type AssessmentAttemptView,
  type AssessmentResultView,
} from "@/lib/api";

/**
 * The in-progress view shared by the free competency test and the certification
 * exam: questions, saved answers, a countdown, and submit. The server is the
 * source of truth for time; this clock is a convenience.
 */
export function AttemptRunner({
  attempt,
  title,
  onFinished,
}: {
  attempt: AssessmentAttemptView;
  title: string;
  onFinished: (result: AssessmentResultView) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(attempt.questions.map((q) => [q.questionId, q.selectedOptionIds])),
  );
  const [remainingMs, setRemainingMs] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finishing = useRef(false);

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

  const choose = useCallback(
    (questionId: string, optionId: string, kind: "SINGLE_CHOICE" | "MULTI_CHOICE") => {
      setAnswers((prev) => {
        const current = prev[questionId] ?? [];
        const next =
          kind === "SINGLE_CHOICE"
            ? [optionId]
            : current.includes(optionId)
              ? current.filter((id) => id !== optionId)
              : [...current, optionId];
        void answerAssessmentQuestion(attempt.id, questionId, next).catch(() => {});
        return { ...prev, [questionId]: next };
      });
    },
    [attempt.id],
  );

  async function submit() {
    const unanswered = attempt.questionCount - answeredCount;
    if (unanswered > 0 && !window.confirm(`You have ${unanswered} unanswered question${unanswered === 1 ? "" : "s"}. Submit anyway?`)) return;
    setBusy(true);
    setError(null);
    try {
      onFinished(await submitAssessment(attempt.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit.");
      setBusy(false);
    }
  }

  const answeredCount = useMemo(() => Object.values(answers).filter((v) => v.length > 0).length, [answers]);
  const totalSec = Math.floor(remainingMs / 1000);
  const timeLabel = `${Math.floor(totalSec / 60)}:${String(totalSec % 60).padStart(2, "0")}`;
  const progress = Math.round((answeredCount / Math.max(1, attempt.questionCount)) * 100);

  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <div
        className="sticky top-[57px] z-10 -mx-5 border-b px-5 py-3 backdrop-blur"
        style={{ background: "color-mix(in srgb, var(--bg) 90%, transparent)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">{title}</span>
          <span
            className="rounded-full px-3 py-1 font-mono text-sm font-bold"
            style={{
              background: remainingMs < 60_000 ? "#c0392b1a" : "var(--surface)",
              color: remainingMs < 60_000 ? "#c0392b" : "var(--text)",
            }}
          >
            {timeLabel}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: "var(--border)" }}>
            <div className="h-full rounded-full bg-paca-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {answeredCount}/{attempt.questionCount}
          </span>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg px-4 py-3 text-sm" style={{ background: "#c0392b1a", color: "#c0392b" }}>
          {error}
        </p>
      )}

      <div className="mt-6 space-y-6">
        {attempt.questions.map((q, i) => (
          <div key={q.questionId} className="rounded-2xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <p className="text-xs font-semibold uppercase tracking-wide text-paca-500">
              Question {i + 1} of {attempt.questionCount}
              {q.kind === "MULTI_CHOICE" && <span style={{ color: "var(--text-muted)" }}> · choose all that apply</span>}
            </p>
            <p className="mt-2 font-medium leading-relaxed">{q.stem}</p>
            <div className="mt-4 space-y-2">
              {q.options.map((o) => {
                const checked = (answers[q.questionId] ?? []).includes(o.id);
                return (
                  <label
                    key={o.id}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm transition hover:border-paca-400"
                    style={{
                      borderColor: checked ? "var(--color-paca-500)" : "var(--border)",
                      background: checked ? "color-mix(in srgb, var(--color-paca-500) 8%, transparent)" : "transparent",
                    }}
                  >
                    <input
                      type={q.kind === "SINGLE_CHOICE" ? "radio" : "checkbox"}
                      name={q.questionId}
                      checked={checked}
                      onChange={() => choose(q.questionId, o.id, q.kind)}
                      className="mt-0.5 accent-[var(--color-paca-500)]"
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
          onClick={() => void submit()}
          disabled={busy}
          className="rounded-xl bg-paca-500 px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-paca-500/25 hover:bg-paca-600 disabled:opacity-60"
        >
          {busy ? "Submitting…" : "Submit answers"}
        </button>
      </div>
    </main>
  );
}
