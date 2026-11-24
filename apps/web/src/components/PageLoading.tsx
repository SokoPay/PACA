/** Shown while a page's data loads: a spinner plus skeleton blocks in the page's shape. */
export function PageLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-5" aria-busy="true" aria-live="polite">
      <div className="flex items-center gap-3 text-sm" style={{ color: "var(--text-muted)" }}>
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-paca-500 border-t-transparent" aria-hidden />
        {label}
      </div>
      <div className="mt-6 animate-pulse space-y-4" aria-hidden>
        <div className="h-32 rounded-3xl" style={{ background: "var(--border)" }} />
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="h-24 rounded-2xl" style={{ background: "var(--border)" }} />
          <div className="h-24 rounded-2xl" style={{ background: "var(--border)" }} />
          <div className="h-24 rounded-2xl" style={{ background: "var(--border)" }} />
        </div>
        <div className="h-48 rounded-2xl" style={{ background: "var(--border)" }} />
      </div>
    </main>
  );
}
