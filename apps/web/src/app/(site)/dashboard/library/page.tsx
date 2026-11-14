"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ApiError,
  fetchMemberLibrary,
  openLibraryBook,
  restoreSession,
  TIER_LABEL,
  type LibraryBook,
  type MembershipTierValue,
} from "@/lib/api";

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

export default function MemberLibraryPage() {
  const router = useRouter();
  const [data, setData] = useState<{ unlocked: boolean; tier: MembershipTierValue | null; items: LibraryBook[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const session = await restoreSession();
      if (!session) {
        router.replace("/login?next=/dashboard/library");
        return;
      }
      try {
        setData(await fetchMemberLibrary());
      } catch {
        setError("Could not load the library.");
      }
    })();
  }, [router]);

  async function open(id: string) {
    setError(null);
    setOpening(id);
    try {
      await openLibraryBook(id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not open the book.");
    } finally {
      setOpening(null);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-5 py-12">
      <Link href="/dashboard" className="text-sm text-paca-500 hover:underline">
        &larr; Dashboard
      </Link>
      <h1 className="mt-3 text-2xl font-bold">Member library</h1>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
        Study books and guides for your membership type
        {data?.tier ? ` (${TIER_LABEL[data.tier]})` : ""}. Read them before you sit the certification exam.
      </p>

      {data && !data.unlocked && (
        <section className="mt-6 rounded-xl border p-5" style={{ borderColor: "var(--color-paca-500)", background: "var(--color-paca-50)" }}>
          <h2 className="font-semibold" style={{ color: "var(--color-paca-700)" }}>
            &#128274; Unlocks after payment
          </h2>
          <p className="mt-1 text-sm" style={{ color: "var(--color-paca-800)" }}>
            {data.tier
              ? "These books open as soon as your membership payment is complete."
              : "Apply for a membership type and pay your subscription to read the books for your type."}
          </p>
          <Link
            href="/dashboard"
            className="mt-3 inline-block rounded-lg bg-paca-500 px-5 py-2 text-sm font-semibold text-white hover:bg-paca-600"
          >
            {data.tier ? "Go to payment" : "Choose a membership type"}
          </Link>
        </section>
      )}

      {error && (
        <p role="alert" className="mt-6 rounded-lg px-4 py-3 text-sm" style={{ background: "#c0392b1a", color: "#c0392b" }}>
          {error}
        </p>
      )}

      {!data && !error && (
        <p className="mt-10 text-sm" style={{ color: "var(--text-muted)" }}>
          Loading…
        </p>
      )}

      {data && data.items.length === 0 && (
        <p className="mt-10 text-sm" style={{ color: "var(--text-muted)" }}>
          No books have been added for your membership type yet. Check back soon.
        </p>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {data?.items.map((b) => (
          <div
            key={b.id}
            className="flex flex-col rounded-xl border p-5"
            style={{ borderColor: "var(--border)", background: "var(--surface)", opacity: b.locked ? 0.7 : 1 }}
          >
            <div className="flex items-start gap-3">
              <span aria-hidden className="text-2xl">
                {b.locked ? "\u{1F512}" : "\u{1F4D8}"}
              </span>
              <div className="min-w-0">
                <h2 className="font-semibold leading-snug">{b.title}</h2>
                <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
                  PDF {formatSize(b.fileSizeBytes) && `· ${formatSize(b.fileSizeBytes)}`}
                  {b.tiers.length > 0 ? ` · ${b.tiers.map((t) => TIER_LABEL[t]).join(", ")}` : " · All members"}
                </p>
              </div>
            </div>
            {b.description && (
              <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {b.description}
              </p>
            )}
            <div className="mt-auto pt-4">
              <button
                onClick={() => void open(b.id)}
                disabled={b.locked || opening === b.id}
                className="rounded-lg bg-paca-500 px-4 py-2 text-sm font-semibold text-white hover:bg-paca-600 disabled:opacity-50"
              >
                {b.locked ? "Locked" : opening === b.id ? "Opening…" : "Read"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
