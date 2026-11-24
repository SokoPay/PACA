"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { restoreSession, type SessionUser } from "@/lib/api";
import { AdminSessionContext } from "./AdminSessionContext";
import { AdminSidebar } from "./AdminSidebar";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    restoreSession().then((session) => {
      if (!session || session.role === "MEMBER") {
        router.replace(session ? "/dashboard" : "/login");
        return;
      }
      setUser(session);
      setChecking(false);
    });
  }, [router]);

  if (checking || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm" style={{ color: "var(--text-muted)" }}>
        Loading…
      </main>
    );
  }

  return (
    <AdminSessionContext.Provider value={user}>
      <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg)" }}>
        <AdminSidebar user={user} />
        <div className="min-w-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </AdminSessionContext.Provider>
  );
}
