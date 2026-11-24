"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getConsent, onConsentOpen, setConsent } from "@/lib/consent";

/**
 * Asks once whether analytics cookies may be used. Essential storage is always on;
 * analytics stays off until the visitor accepts. Reopened from "Cookie settings"
 * in the footer.
 */
export function CookieBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (getConsent() === null) setOpen(true);
    return onConsentOpen(() => setOpen(true));
  }, []);

  if (!open) return null;

  const choose = (c: "all" | "essential") => {
    setConsent(c);
    setOpen(false);
  };

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie choices"
      className="fixed inset-x-3 bottom-3 z-[90] mx-auto max-w-3xl rounded-2xl border p-4 shadow-2xl sm:inset-x-6 sm:bottom-6 sm:p-5"
      style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <p className="text-sm leading-relaxed">
          <strong>We use cookies.</strong> Essential ones keep you signed in safely. With your permission we also use
          analytics to see which pages help people most. No advertising cookies.{" "}
          <Link href="/legal/cookies" className="font-semibold text-paca-500 underline">
            Cookie policy
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => choose("essential")}
            className="flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold sm:flex-none"
            style={{ borderColor: "var(--border)" }}
          >
            Essential only
          </button>
          <button
            onClick={() => choose("all")}
            className="flex-1 rounded-xl bg-paca-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-paca-600 sm:flex-none"
          >
            Accept analytics
          </button>
        </div>
      </div>
    </div>
  );
}
