"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem {
  label: string;
  href: string;
  children?: Array<{ label: string; href: string }>;
}

/** The site menu on phones, where the desktop dropdowns are hidden. */
export function MobileNav({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-lg border"
        style={{ borderColor: "var(--border)" }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>

      {open && (
        <nav
          className="absolute inset-x-0 top-full max-h-[75vh] overflow-y-auto border-b px-5 py-3 shadow-lg"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          {items.map((item) => (
            <div key={item.label} className="py-2">
              <Link href={item.href} className="block py-1 text-sm font-semibold">
                {item.label}
              </Link>
              {item.children?.map((c) => (
                <Link key={c.href} href={c.href} className="block py-1 pl-3 text-sm" style={{ color: "var(--text-muted)" }}>
                  {c.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
      )}
    </div>
  );
}
