"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  fetchAnnouncements,
  fetchNotifications,
  markAllNotificationsRead,
  restoreSession,
  type AnnouncementItem,
  type NotificationItem,
} from "@/lib/api";
import { notifyNotificationsChanged } from "@/lib/notificationEvents";

const ICON: Record<string, string> = {
  ANNOUNCEMENT: "📣",
  CERTIFICATE: "🎓",
  PAYMENT: "💳",
  MEMBERSHIP: "🪪",
  ASSESSMENT: "📝",
  COURSE: "📚",
  SYSTEM: "🔔",
};

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);

  useEffect(() => {
    (async () => {
      if (!(await restoreSession())) {
        router.replace("/login?next=/notifications");
        return;
      }
      const [n, a] = await Promise.all([fetchNotifications(), fetchAnnouncements().catch(() => [])]);
      setItems(n.items);
      setAnnouncements(a);
      if (n.unread > 0) {
        await markAllNotificationsRead().catch(() => {});
        notifyNotificationsChanged();
      }
    })();
  }, [router]);

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>

      {announcements.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Announcements</h2>
          <div className="mt-3 space-y-3">
            {announcements.map((a) => (
              <article key={a.id} className="rounded-2xl border p-5" style={{ borderColor: a.pinned ? "var(--color-paca-500)" : "var(--border)", background: "var(--surface)" }}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold">📣 {a.title}</h3>
                  {a.pinned && <span className="rounded-full bg-paca-50 px-2 py-0.5 text-[11px] font-semibold text-paca-700">Pinned</span>}
                </div>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{a.body}</p>
                {a.publishedAt && <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>{new Date(a.publishedAt).toLocaleDateString()}</p>}
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>For you</h2>
        {!items && <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>Loading…</p>}
        {items?.length === 0 && <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>Nothing yet. Updates about your membership, payments and certificates will appear here.</p>}
        <div className="mt-3 divide-y overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          {items?.map((n) => {
            const body = (
              <div className="flex gap-3 p-4" style={{ background: n.readAt ? "transparent" : "color-mix(in srgb, var(--color-paca-500) 6%, transparent)" }}>
                <span className="text-xl" aria-hidden>{ICON[n.kind] ?? "🔔"}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{n.title}</p>
                  <p className="mt-0.5 text-sm" style={{ color: "var(--text-muted)" }}>{n.body}</p>
                  <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>{new Date(n.createdAt).toLocaleString()}</p>
                </div>
              </div>
            );
            return n.link ? (
              <Link key={n.id} href={n.link} className="block hover:bg-paca-50/40" style={{ borderColor: "var(--border)" }}>{body}</Link>
            ) : (
              <div key={n.id} style={{ borderColor: "var(--border)" }}>{body}</div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
