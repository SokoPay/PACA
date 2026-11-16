"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logout, type SessionUser } from "@/lib/api";

const NAV: Array<{ href: string; label: string; minRole?: "ADMIN" }> = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/applications", label: "Applications", minRole: "ADMIN" },
  { href: "/admin/users", label: "Users", minRole: "ADMIN" },
  { href: "/admin/payments", label: "Payments", minRole: "ADMIN" },
  { href: "/admin/library", label: "Member library", minRole: "ADMIN" },
  { href: "/admin/partners", label: "Partner discounts", minRole: "ADMIN" },
  { href: "/admin/announcements", label: "Announcements", minRole: "ADMIN" },
  { href: "/admin/events", label: "Events & discounts", minRole: "ADMIN" },
  { href: "/admin/jobs", label: "Job board", minRole: "ADMIN" },
  { href: "/admin/question-bank", label: "Exam question bank", minRole: "ADMIN" },
  { href: "/admin/queue", label: "Review queue" },
  { href: "/admin/questions", label: "All questions" },
  { href: "/admin/assessments", label: "Exam performance", minRole: "ADMIN" },
  { href: "/admin/activity", label: "Activity log", minRole: "ADMIN" },
];

export function AdminSidebar({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const canSeeAdminOnly = user.role === "ADMIN" || user.role === "SUPERADMIN";

  return (
    <aside
      className="flex w-56 shrink-0 flex-col border-r"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="border-b px-4 py-4" style={{ borderColor: "var(--border)" }}>
        <Link href="/admin" className="text-lg font-bold tracking-tight text-paca-500">
          PACA Admin
        </Link>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2 text-sm">
        {NAV.filter((item) => !item.minRole || canSeeAdminOnly).map((item) => {
          const active = item.href === "/admin" ? pathname === "/admin" : pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-lg px-3 py-2 font-medium"
              style={{
                background: active ? "var(--verdict-bg)" : "transparent",
                color: active ? "var(--paca-500)" : "var(--text)",
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-3 text-xs" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
        <div className="truncate font-medium" style={{ color: "var(--text)" }}>
          {user.firstName} {user.lastName}
        </div>
        <div>{user.role}</div>
        <button
          onClick={async () => {
            await logout();
            router.replace("/login");
          }}
          className="mt-2 underline underline-offset-2"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
