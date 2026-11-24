"use client";

import Link from "next/link";

/** Friendly error state if a page fails to render, with a retry instead of a blank screen. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-[60vh] items-center justify-center px-5 py-20">
      <div role="alert" className="max-w-md text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-[#c0392b]">Something went wrong</p>
        <h1 className="mt-3 text-2xl font-bold">This page could not load</h1>
        <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
          It may be a connection problem. Please try again; if it keeps happening, come back in a few minutes.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button onClick={reset} className="rounded-xl bg-paca-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-paca-600">
            Try again
          </button>
          <Link href="/" className="rounded-xl border px-5 py-2.5 text-sm font-semibold" style={{ borderColor: "var(--border)" }}>
            Home page
          </Link>
        </div>
      </div>
    </main>
  );
}
