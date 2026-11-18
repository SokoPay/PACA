"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { getCurrentUser, hasSession, keepSessionAlive, logout, subscribeSession } from "@/lib/api";
import { IDLE_LIMIT_MS, IDLE_WARNING_MS, examInProgress, lastActiveAt, markActive } from "@/lib/activity";

const EVENTS = ["pointerdown", "keydown", "scroll", "touchstart", "mousemove", "wheel"] as const;

/**
 * Signs a member out after 30 minutes without activity (any open tab counts),
 * with a two-minute warning first. Never fires while an exam or test is open.
 * The API enforces the same limit server-side, so an abandoned session cannot
 * be revived even if this page is closed.
 */
export function IdleLogout() {
  const pathname = usePathname();
  const [signedIn, setSignedIn] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  useEffect(() => {
    const update = () => setSignedIn(Boolean(getCurrentUser()) || hasSession());
    update();
    return subscribeSession(update);
  }, []);

  // Pages restored from the browser's back/forward cache after sign-out are reloaded,
  // so private pages are not shown again from memory.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted && !hasSession()) window.location.reload();
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  useEffect(() => {
    if (!signedIn) {
      setSecondsLeft(null);
      return;
    }
    markActive(true);
    const onActivity = () => {
      markActive();
      void keepSessionAlive();
    };
    for (const e of EVENTS) window.addEventListener(e, onActivity, { passive: true });

    const check = () => {
      if (!hasSession()) return;
      if (examInProgress()) {
        markActive();
        void keepSessionAlive();
        setSecondsLeft(null);
        return;
      }
      const idle = Date.now() - lastActiveAt();
      if (idle >= IDLE_LIMIT_MS) {
        const here = pathRef.current ?? "/";
        void logout().finally(() => {
          window.location.assign(`/login?reason=idle&next=${encodeURIComponent(here)}`);
        });
      } else if (idle >= IDLE_LIMIT_MS - IDLE_WARNING_MS) {
        setSecondsLeft(Math.ceil((IDLE_LIMIT_MS - idle) / 1000));
      } else {
        setSecondsLeft(null);
      }
    };
    check();
    const id = window.setInterval(check, 1000);
    return () => {
      window.clearInterval(id);
      for (const e of EVENTS) window.removeEventListener(e, onActivity);
    };
  }, [signedIn]);

  if (secondsLeft === null) return null;
  const mm = Math.floor(secondsLeft / 60);
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="idle-title" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl p-6 text-center shadow-2xl" style={{ background: "var(--surface)", color: "var(--text)" }}>
        <div className="text-4xl" aria-hidden>⏳</div>
        <h2 id="idle-title" className="mt-2 text-lg font-bold">Are you still there?</h2>
        <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
          For your security you will be signed out in <strong>{mm}:{ss}</strong> because there has been no activity for a while.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            autoFocus
            onClick={() => {
              markActive(true);
              void keepSessionAlive();
              setSecondsLeft(null);
            }}
            className="rounded-xl bg-paca-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-paca-600"
          >
            Stay signed in
          </button>
          <button
            onClick={() => void logout().finally(() => window.location.assign("/login"))}
            className="rounded-xl border px-5 py-2.5 text-sm font-semibold"
            style={{ borderColor: "var(--border)" }}
          >
            Sign out now
          </button>
        </div>
      </div>
    </div>
  );
}
