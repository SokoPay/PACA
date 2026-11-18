"use client";

import { useEffect, useMemo, useState } from "react";
import type { FaqEntry } from "@/lib/faq";

type Item = FaqEntry & { id: string };

/**
 * Questions only, grouped by topic. Clicking a question (or its arrow) opens the
 * answer below it; clicking again closes it. A search box and topic buttons keep
 * long lists easy to scan. Links like /faq#q-12 open that answer directly.
 */
export function FaqAccordion({ items, categories }: { items: Item[]; categories: string[] }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<string>("All");

  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id && items.some((i) => i.id === id)) {
      setOpen(new Set([id]));
      requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "center" }));
    }
  }, [items]);

  const q = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      items.filter(
        (i) =>
          (topic === "All" || i.category === topic) &&
          (!q || i.question.toLowerCase().includes(q) || i.answer.toLowerCase().includes(q)),
      ),
    [items, topic, q],
  );
  const groups = categories
    .map((c) => ({ category: c, items: visible.filter((i) => i.category === c) }))
    .filter((g) => g.items.length > 0);

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allOpen = visible.length > 0 && visible.every((i) => open.has(i.id));

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Search questions</span>
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm" aria-hidden style={{ color: "var(--text-muted)" }}>
            🔍
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search questions, e.g. payment, badge, exam"
            className="w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm outline-none focus:border-paca-500"
            style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
          />
        </label>
        <button
          onClick={() => setOpen(allOpen ? new Set() : new Set(visible.map((i) => i.id)))}
          className="shrink-0 rounded-xl border px-4 py-2.5 text-sm font-semibold hover:border-paca-500"
          style={{ borderColor: "var(--border)" }}
        >
          {allOpen ? "Close all answers" : "Open all answers"}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Topics">
        {["All", ...categories].map((c) => {
          const active = topic === c;
          return (
            <button
              key={c}
              role="tab"
              aria-selected={active}
              onClick={() => setTopic(c)}
              className="rounded-full border px-3.5 py-1.5 text-xs font-semibold transition"
              style={
                active
                  ? { background: "var(--color-paca-500)", borderColor: "var(--color-paca-500)", color: "white" }
                  : { borderColor: "var(--border)", color: "var(--text-muted)", background: "var(--surface)" }
              }
            >
              {c}
            </button>
          );
        })}
      </div>

      {groups.length === 0 && (
        <p className="mt-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>
          No questions match &ldquo;{query}&rdquo;. Try another word, or contact PACA.
        </p>
      )}

      {groups.map((g) => (
        <section key={g.category} className="mt-10">
          <h2 className="text-sm font-bold uppercase tracking-wide text-paca-500">{g.category}</h2>
          <ul className="mt-3 space-y-3">
            {g.items.map((item) => {
              const isOpen = open.has(item.id);
              return (
                <li
                  key={item.id}
                  id={item.id}
                  className="overflow-hidden rounded-2xl border transition"
                  style={{ borderColor: isOpen ? "var(--color-paca-500)" : "var(--border)", background: "var(--surface)" }}
                >
                  <h3>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={`${item.id}-answer`}
                      onClick={() => toggle(item.id)}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-semibold hover:text-paca-600"
                    >
                      <span>{item.question}</span>
                      <span
                        aria-hidden
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-transform duration-300"
                        style={{
                          background: isOpen ? "var(--color-paca-500)" : "var(--color-paca-50)",
                          color: isOpen ? "white" : "var(--color-paca-600)",
                          transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                        }}
                      >
                        <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M7.5 4.5 13 10l-5.5 5.5" />
                        </svg>
                      </span>
                    </button>
                  </h3>
                  <div
                    id={`${item.id}-answer`}
                    role="region"
                    className="grid transition-[grid-template-rows] duration-300 ease-out"
                    style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
                  >
                    <div className="overflow-hidden">
                      <p className="whitespace-pre-line px-5 pb-5 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                        {item.answer}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
