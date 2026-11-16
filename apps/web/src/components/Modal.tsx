"use client";

import { useEffect, type ReactNode } from "react";

/** Full-screen overlay dialog. Closes on Esc or the backdrop; locks page scroll while open. */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = "xl",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "xl";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-stretch justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-[#001b44]/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`paca-pop relative flex max-h-full w-full flex-col overflow-hidden shadow-2xl sm:max-h-[92vh] sm:rounded-2xl ${
          size === "xl" ? "max-w-6xl" : "max-w-xl"
        }`}
        style={{ background: "var(--surface)", color: "var(--text)" }}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b px-5 py-4 sm:px-6" style={{ borderColor: "var(--border)" }}>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold">{title}</h2>
            {subtitle && (
              <div className="mt-0.5 text-sm" style={{ color: "var(--text-muted)" }}>
                {subtitle}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg px-2.5 py-1 text-xl leading-none hover:bg-black/5"
            style={{ color: "var(--text-muted)" }}
          >
            ×
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && (
          <footer className="shrink-0 border-t px-5 py-4 sm:px-6" style={{ borderColor: "var(--border)", background: "var(--bg)" }}>
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
