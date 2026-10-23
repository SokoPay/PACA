"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  approveQuestion,
  bulkApprove,
  fetchQueue,
  fetchStats,
  rejectQuestion,
  restoreSession,
  ApiError,
  type Difficulty,
  type QueueItem,
  type ReviewStats,
  type SessionUser,
  type Verdict,
} from "@/lib/api";

const VERDICTS: Verdict[] = ["REJECT", "FLAG", "APPROVE"];
const DIFFICULTIES: Difficulty[] = ["FOUNDATION", "INTERMEDIATE", "ADVANCED", "EXPERT"];

const PANEL: React.CSSProperties = { background: "var(--surface)", borderColor: "var(--border)" };

const VERDICT_HEADING: Record<string, string> = {
  REJECT: "Why this was rejected",
  FLAG: "Why this was flagged",
  APPROVE: "Review notes",
  UNREVIEWED: "Notes",
};

export default function ReviewQueuePage() {
  const router = useRouter();

  const [user, setUser] = useState<SessionUser | null>(null);
  const [checking, setChecking] = useState(true);

  const [items, setItems] = useState<QueueItem[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [verdict, setVerdict] = useState<Verdict | "">("");
  const [difficulty, setDifficulty] = useState<Difficulty | "">("");

  const [cursor, setCursor] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rejecting, setRejecting] = useState<QueueItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showHelp, setShowHelp] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const current = items[cursor];

  // ---------------------------------------------------------------- session
  useEffect(() => {
    restoreSession().then((session) => {
      if (!session || session.role === "MEMBER") {
        router.replace("/login");
        return;
      }
      setUser(session);
      setChecking(false);
    });
  }, [router]);

  // ---------------------------------------------------------------- data
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [queue, s] = await Promise.all([
        fetchQueue({
          verdict: verdict || undefined,
          difficulty: difficulty || undefined,
          pageSize: 50,
        }),
        fetchStats(),
      ]);
      setItems(queue.items);
      setTotal(queue.total);
      setStats(s);
      setCursor((c) => Math.min(c, Math.max(0, queue.items.length - 1)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load the queue.");
    } finally {
      setLoading(false);
    }
  }, [verdict, difficulty]);

  useEffect(() => {
    if (!checking && user) void load();
  }, [checking, user, load]);

  function flash(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2600);
  }

  /** Drop an item locally so the queue does not jump while working through it. */
  function removeLocal(id: string) {
    let removedVerdict: string | null = null;

    setItems((prev) => {
      removedVerdict = prev.find((i) => i.id === id)?.autoReviewVerdict ?? "UNREVIEWED";
      const next = prev.filter((i) => i.id !== id);
      setCursor((c) => Math.min(c, Math.max(0, next.length - 1)));
      return next;
    });

    setTotal((t) => Math.max(0, t - 1));
    setSelected((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

    setStats((s) => {
      if (!s) return s;
      const key = removedVerdict ?? "UNREVIEWED";
      return {
        ...s,
        pending: Math.max(0, s.pending - 1),
        byVerdict: { ...s.byVerdict, [key]: Math.max(0, (s.byVerdict[key] ?? 0) - 1) },
      };
    });
  }

  // ---------------------------------------------------------------- actions
  const doApprove = useCallback(
    async (item: QueueItem) => {
      try {
        await approveQuestion(item.id);
        removeLocal(item.id);
        setStats((s) => (s ? { ...s, published: s.published + 1 } : s));
        flash("Published");
      } catch (err) {
        // The publication guard lives on the server; surface its reason verbatim.
        setError(err instanceof ApiError ? err.message : "Could not approve.");
      }
    },
    [],
  );

  const doReject = useCallback(async () => {
    if (!rejecting) return;
    if (rejectReason.trim().length < 3) return;
    try {
      await rejectQuestion(rejecting.id, rejectReason.trim());
      removeLocal(rejecting.id);
      setRejecting(null);
      setRejectReason("");
      flash("Rejected");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reject.");
    }
  }, [rejecting, rejectReason]);

  const doBulkApprove = useCallback(async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    try {
      const result = await bulkApprove(ids);
      for (const id of result.approved) removeLocal(id);
      setSelected(new Set());
      const skippedNote = result.skipped.length ? `, ${result.skipped.length} skipped` : "";
      flash(`Published ${result.approvedCount}${skippedNote}`);
      if (result.skipped.length) setError(result.skipped.map((s) => s.reason).join(" · "));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Bulk approve failed.");
    }
  }, [selected]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ---------------------------------------------------------------- keyboard
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName);

      if (rejecting) {
        if (e.key === "Escape") {
          setRejecting(null);
          setRejectReason("");
        }
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void doReject();
        return;
      }

      if (typing) return;

      switch (e.key) {
        case "j":
        case "ArrowDown":
          e.preventDefault();
          setCursor((c) => Math.min(c + 1, items.length - 1));
          break;
        case "k":
        case "ArrowUp":
          e.preventDefault();
          setCursor((c) => Math.max(c - 1, 0));
          break;
        case "a":
          e.preventDefault();
          if (current) void doApprove(current);
          break;
        case "r":
          // Without preventDefault the same keypress lands in the modal's
          // autofocused textarea, seeding the rejection reason with "r".
          e.preventDefault();
          if (current) setRejecting(current);
          break;
        case "x":
          e.preventDefault();
          if (current) toggleSelect(current.id);
          break;
        case "?":
          e.preventDefault();
          setShowHelp((v) => !v);
          break;
        case "Escape":
          setShowHelp(false);
          setError(null);
          break;
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items.length, current, doApprove, rejecting, doReject]);

  // Keep the highlighted row in view as the cursor moves.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${cursor}"]`)?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const selectableCount = useMemo(
    () => items.filter((i) => i.autoReviewVerdict === "APPROVE").length,
    [items],
  );

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm" style={{ color: "var(--text-muted)" }}>
        Loading…
      </main>
    );
  }

  return (
    <main className="mx-auto flex h-full max-w-[1600px] flex-col">
      {/* ---------------------------------------------------------- header */}
      <header
        className="flex shrink-0 items-center gap-6 border-b px-6 py-3"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <h1 className="text-sm font-semibold">Question review</h1>

        {stats && (
          <div className="flex items-center gap-4 text-xs" style={{ color: "var(--text-muted)" }}>
            <span>
              <strong style={{ color: "var(--text)" }}>{stats.pending}</strong> awaiting review
            </span>
            <span>
              <strong style={{ color: "var(--text)" }}>{stats.published}</strong> published
            </span>
            {VERDICTS.map((v) => (
              <span key={v} className={`verdict-${v} rounded px-2 py-0.5`} style={{ background: "var(--verdict-bg)", color: "var(--verdict)" }}>
                {v} {stats.byVerdict[v] ?? 0}
              </span>
            ))}
          </div>
        )}

        <div className="ml-auto flex items-center gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
          <button onClick={() => setShowHelp((v) => !v)} className="underline underline-offset-2">
            shortcuts <kbd>?</kbd>
          </button>
        </div>
      </header>

      {/* ---------------------------------------------------------- filters */}
      <div
        className="flex shrink-0 items-center gap-3 border-b px-6 py-2 text-xs"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <select
          value={verdict}
          onChange={(e) => setVerdict(e.target.value as Verdict | "")}
          className="rounded border px-2 py-1"
          style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }}
        >
          <option value="">All verdicts</option>
          {VERDICTS.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>

        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as Difficulty | "")}
          className="rounded border px-2 py-1"
          style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }}
        >
          <option value="">All difficulties</option>
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

        <span style={{ color: "var(--text-muted)" }}>
          {loading ? "Loading…" : `${total} item${total === 1 ? "" : "s"}`}
        </span>

        {selected.size > 0 && (
          <button
            onClick={() => void doBulkApprove()}
            className="ml-auto rounded bg-paca-500 px-3 py-1 font-semibold text-white hover:bg-paca-600"
          >
            Publish {selected.size} selected
          </button>
        )}
        {selected.size === 0 && selectableCount > 0 && (
          <button
            onClick={() => setSelected(new Set(items.filter((i) => i.autoReviewVerdict === "APPROVE").map((i) => i.id)))}
            className="ml-auto underline underline-offset-2"
            style={{ color: "var(--text-muted)" }}
          >
            Select all {selectableCount} APPROVE items
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="shrink-0 px-6 py-2 text-sm" style={{ background: "#c0392b1a", color: "#c0392b" }}>
          {error}
          <button onClick={() => setError(null)} className="ml-3 underline underline-offset-2">
            dismiss
          </button>
        </div>
      )}

      {/* ---------------------------------------------------------- body */}
      <div className="flex min-h-0 flex-1">
        {/* list */}
        <div ref={listRef} className="w-[38%] shrink-0 overflow-y-auto border-r" style={{ borderColor: "var(--border)" }}>
          {items.length === 0 && !loading && (
            <p className="p-6 text-sm" style={{ color: "var(--text-muted)" }}>
              Nothing awaiting review. Run a drafting job to fill the queue.
            </p>
          )}

          {items.map((item, i) => {
            const v = item.autoReviewVerdict ?? "UNREVIEWED";
            return (
              <div
                key={item.id}
                data-index={i}
                onClick={() => setCursor(i)}
                className={`verdict-${v} cursor-pointer border-b px-4 py-3`}
                style={{
                  borderColor: "var(--border)",
                  background: i === cursor ? "var(--verdict-bg)" : "transparent",
                  borderLeft: i === cursor ? "3px solid var(--verdict)" : "3px solid transparent",
                }}
              >
                <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold tracking-wide">
                  <input
                    type="checkbox"
                    checked={selected.has(item.id)}
                    onChange={() => toggleSelect(item.id)}
                    onClick={(e) => e.stopPropagation()}
                    disabled={item.autoReviewVerdict !== "APPROVE"}
                    title={item.autoReviewVerdict !== "APPROVE" ? "Only APPROVE items can be bulk-published" : ""}
                  />
                  <span style={{ color: "var(--verdict)" }}>{v}</span>
                  {item.autoReviewConfidence && (
                    <span style={{ color: "var(--text-muted)" }}>{Number(item.autoReviewConfidence).toFixed(2)}</span>
                  )}
                  <span style={{ color: "var(--text-muted)" }}>· {item.difficulty}</span>
                  <span className="ml-auto" style={{ color: "var(--text-muted)" }}>
                    {item.topic.slug}
                  </span>
                </div>
                <div className="line-clamp-2 text-xs leading-snug">{item.stem}</div>
              </div>
            );
          })}
        </div>

        {/* detail */}
        <div className="flex-1 overflow-y-auto">
          {current ? (
            <QuestionDetail
              item={current}
              onApprove={() => void doApprove(current)}
              onReject={() => setRejecting(current)}
            />
          ) : (
            <p className="p-8 text-sm" style={{ color: "var(--text-muted)" }}>
              Select a question.
            </p>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------- reject modal */}
      {rejecting && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-xl border p-6" style={PANEL}>
            <h2 className="text-sm font-semibold">Reject this question</h2>
            <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
              The reason is recorded against the item and feeds back into the drafting prompt.
            </p>
            <textarea
              autoFocus
              rows={4}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Keyed answer is wrong — only the Product Owner may cancel a Sprint."
              className="mt-3 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-paca-500"
              style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }}
            />
            <div className="mt-4 flex items-center justify-end gap-2 text-sm">
              <button
                onClick={() => {
                  setRejecting(null);
                  setRejectReason("");
                }}
                className="rounded-lg px-3 py-1.5"
                style={{ color: "var(--text-muted)" }}
              >
                Cancel <kbd>esc</kbd>
              </button>
              <button
                onClick={() => void doReject()}
                disabled={rejectReason.trim().length < 3}
                className="rounded-lg px-3 py-1.5 font-semibold text-white disabled:opacity-50"
                style={{ background: "#c0392b" }}
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {showHelp && <ShortcutHelp onClose={() => setShowHelp(false)} />}

      {toast && (
        <div
          className="fixed bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-lg px-4 py-2 text-sm font-medium text-white"
          style={{ background: "#146b2e" }}
        >
          {toast}
        </div>
      )}
    </main>
  );
}

function QuestionDetail({
  item,
  onApprove,
  onReject,
}: {
  item: QueueItem;
  onApprove: () => void;
  onReject: () => void;
}) {
  const v = item.autoReviewVerdict ?? "UNREVIEWED";
  const disagreed = item.independentAnswerAgreed === false;

  return (
    <article className={`verdict-${v} p-6`}>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded px-2 py-1 font-semibold" style={{ background: "var(--verdict-bg)", color: "var(--verdict)" }}>
          {v}
        </span>
        {item.autoReviewConfidence && (
          <span style={{ color: "var(--text-muted)" }}>confidence {Number(item.autoReviewConfidence).toFixed(2)}</span>
        )}
        <span style={{ color: "var(--text-muted)" }}>· {item.difficulty}</span>
        <span style={{ color: "var(--text-muted)" }}>· {item.topic.name}</span>
        <span style={{ color: "var(--text-muted)" }}>· {item.origin}</span>
      </div>

      {disagreed && (
        <p className="mb-4 rounded-lg px-3 py-2 text-xs font-medium" style={{ background: "#c0392b1a", color: "#c0392b" }}>
          The reviewing model, answering without seeing the key, chose a different option. Check the keyed answer first.
        </p>
      )}

      <h2 className="text-base font-semibold leading-relaxed">{item.stem}</h2>

      <ul className="mt-4 space-y-2">
        {item.options.map((o) => (
          <li
            key={o.id}
            className="flex items-start gap-3 rounded-lg border px-3 py-2 text-sm"
            style={{
              borderColor: o.isCorrect ? "var(--verdict)" : "var(--border)",
              background: o.isCorrect ? "var(--verdict-bg)" : "transparent",
            }}
          >
            <span className="mt-0.5 shrink-0 text-xs" style={{ color: o.isCorrect ? "var(--verdict)" : "var(--text-muted)" }}>
              {o.isCorrect ? "●" : "○"}
            </span>
            <span className="flex-1">{o.text}</span>
            {o.isCorrect && (
              <span className="shrink-0 text-[10px] font-semibold uppercase" style={{ color: "var(--verdict)" }}>
                keyed
              </span>
            )}
          </li>
        ))}
      </ul>

      <dl className="mt-5 space-y-3 text-sm">
        {item.sourceRef && (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Source
            </dt>
            <dd className="mt-0.5">{item.sourceRef}</dd>
          </div>
        )}
        {item.explanation && (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Explanation
            </dt>
            <dd className="mt-0.5 leading-relaxed">{item.explanation}</dd>
          </div>
        )}
      </dl>

      {item.autoReviewIssues.length > 0 && (
        <section className="mt-5 rounded-lg border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            {VERDICT_HEADING[v]}
          </h3>
          <ul className="mt-2 space-y-1.5 text-sm">
            {item.autoReviewIssues.map((issue, i) => (
              <li key={i} className="flex gap-2">
                <span style={{ color: "var(--verdict)" }}>•</span>
                <span>{issue}</span>
              </li>
            ))}
          </ul>
          {item.autoReviewNotes && (
            <p className="mt-3 text-xs italic" style={{ color: "var(--text-muted)" }}>
              {item.autoReviewNotes}
            </p>
          )}
        </section>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={onApprove}
          className="rounded-lg bg-paca-500 px-4 py-2 text-sm font-semibold text-white hover:bg-paca-600"
        >
          Approve &amp; publish <kbd>a</kbd>
        </button>
        <button
          onClick={onReject}
          className="rounded-lg border px-4 py-2 text-sm font-semibold"
          style={{ borderColor: "var(--border)", color: "#c0392b" }}
        >
          Reject <kbd>r</kbd>
        </button>
      </div>
    </article>
  );
}

function ShortcutHelp({ onClose }: { onClose: () => void }) {
  const rows: Array<[string, string]> = [
    ["j / ↓", "Next question"],
    ["k / ↑", "Previous question"],
    ["a", "Approve and publish"],
    ["r", "Reject (asks for a reason)"],
    ["x", "Select for bulk publish"],
    ["⌘/Ctrl + Enter", "Confirm rejection"],
    ["?", "Toggle this help"],
    ["esc", "Close / dismiss"],
  ];

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl border p-6" style={PANEL} onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-3 text-sm font-semibold">Keyboard shortcuts</h2>
        <dl className="space-y-2 text-sm">
          {rows.map(([key, label]) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <dt>
                <kbd>{key}</kbd>
              </dt>
              <dd style={{ color: "var(--text-muted)" }}>{label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
