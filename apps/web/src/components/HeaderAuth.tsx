"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logout } from "@/lib/api";
import { useSession } from "@/lib/useSession";

/** Right-hand side of the site header: Sign in / Join, or the member's profile menu. */
export function HeaderAuth() {
  const user = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on navigation, outside click and Escape.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (user === undefined) return <div className="h-9 w-24" aria-hidden />;

  if (!user) {
    return (
      <>
        <Link href="/login" className="hidden rounded-lg px-3 py-2 text-sm font-medium hover:text-paca-500 sm:inline-block">
          Sign in
        </Link>
        <Link
          href="/register"
          className="rounded-lg bg-paca-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-paca-600"
        >
          Join PACA
        </Link>
      </>
    );
  }

  const initials = `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();
  const isStaff = user.role !== "MEMBER";
  const needsVerify = user.role === "MEMBER" && !user.emailVerifiedAt;

  const item = "block rounded-md px-3 py-2 text-sm transition hover:bg-paca-50 hover:text-paca-600";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm font-medium transition hover:border-paca-500"
        style={{ borderColor: "var(--border)" }}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-paca-500 text-xs font-bold text-white">
          {initials || "?"}
        </span>
        <span className="hidden max-w-[8rem] truncate sm:inline">{user.firstName}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-64 rounded-xl border p-1 shadow-lg"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="border-b px-3 py-2.5" style={{ borderColor: "var(--border)" }}>
            <div className="truncate text-sm font-semibold">
              {user.firstName} {user.lastName}
            </div>
            <div className="truncate text-xs" style={{ color: "var(--text-muted)" }}>
              {user.email}
            </div>
          </div>
          {needsVerify && (
            <Link href="/verify-email" role="menuitem" className={item} style={{ color: "#b9770e" }}>
              Verify your email
            </Link>
          )}
          <Link href="/dashboard" role="menuitem" className={item}>
            My dashboard
          </Link>
          <Link href="/dashboard/library" role="menuitem" className={item}>
            Member library
          </Link>
          <Link href="/certificates" role="menuitem" className={item}>
            My certificates
          </Link>
          <Link href="/assessment" role="menuitem" className={item}>
            Free competency test
          </Link>
          {isStaff && (
            <Link href="/admin" role="menuitem" className={item}>
              Admin panel
            </Link>
          )}
          <div className="my-1 border-t" style={{ borderColor: "var(--border)" }} />
          <button
            role="menuitem"
            onClick={async () => {
              setOpen(false);
              await logout();
              router.push("/");
            }}
            className={`${item} w-full text-left`}
            style={{ color: "#c0392b" }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
