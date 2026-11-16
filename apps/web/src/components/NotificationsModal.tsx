"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchAnnouncements,
  fetchNotifications,
  markAllNotificationsRead,
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
  SYSTEM: "✨",
};

function ago(d: string): string {
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.floor(h / 24);
  return days < 7 ? `${days} d ago` : new Date(d).toLocaleDateString();
}

function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          // visible anyway
        }
      }}
      className="mt-2 inline-flex items-center gap-2 rounded-lg border-2 border-dashed px-3 py-1.5 font-mono text-sm font-bold"
      style={{ borderColor: "#2e9e5b", color: "#146c3b", background: "#effbf3" }}
    >
      {code}
      <span className="font-sans text-[11px] font-semibold">{copied ? "Copied!" : "Copy"}</span>
    </button>
  );
}

/** The notifications pop-up: personal updates and announcements, marked read on open. */
export function NotificationsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<"you" | "news">("you");
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [news, setNews] = useState<AnnouncementItem[]>([]);
  const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      const [n, a] = await Promise.all([fetchNotifications().catch(() => null), fetchAnnouncements().catch(() => [])]);
      if (!alive) return;
      setItems(n?.items ?? []);
      setNews(a);
      setUnreadIds(new Set((n?.items ?? []).filter((i) => !i.readAt).map((i) => i.id)));
      if (n && n.unread > 0) {
        await markAllNotificationsRead().catch(() => {});
        notifyNotificationsChanged();
      }
    })();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      alive = false;
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Notifications">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-[#031a45]/55 backdrop-blur-sm" />
      <div
        className="relative mt-14 w-full max-w-lg overflow-hidden rounded-3xl shadow-2xl sm:mt-0"
        style={{ background: "var(--surface)", animation: "paca-pop .22s ease-out" }}
      >
        <div className="paca-gradient px-6 pb-4 pt-5 text-white">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Notifications</h2>
            <button onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 hover:bg-white/25">
              ✕
            </button>
          </div>
          <div className="mt-4 flex gap-2 text-sm">
            {(
              [
                ["you", `For you${unreadIds.size ? ` · ${unreadIds.size} new` : ""}`],
                ["news", `Announcements${news.length ? ` · ${news.length}` : ""}`],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className="rounded-full px-4 py-1.5 font-semibold transition"
                style={tab === k ? { background: "white", color: "#0060cc" } : { background: "rgba(255,255,255,.15)" }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {tab === "you" ? (
            !items ? (
              <p className="p-6 text-sm" style={{ color: "var(--text-muted)" }}>Loading…</p>
            ) : items.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-4xl">🔔</p>
                <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>You&rsquo;re all caught up.</p>
              </div>
            ) : (
              <ul>
                {items.map((n) => {
                  const content = (
                    <div className="flex gap-3 px-5 py-4 transition hover:bg-paca-50/50" style={unreadIds.has(n.id) ? { background: "color-mix(in srgb, var(--color-paca-500) 7%, transparent)" } : {}}>
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-paca-50 text-lg" aria-hidden>{ICON[n.kind] ?? "🔔"}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold leading-snug">{n.title}</p>
                          {unreadIds.has(n.id) && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-paca-500" />}
                        </div>
                        <p className="mt-0.5 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{n.body}</p>
                        <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>{ago(n.createdAt)}</p>
                      </div>
                    </div>
                  );
                  return (
                    <li key={n.id} className="border-b last:border-0" style={{ borderColor: "var(--border)" }}>
                      {n.link ? (
                        <Link href={n.link} onClick={onClose}>{content}</Link>
                      ) : (
                        content
                      )}
                    </li>
                  );
                })}
              </ul>
            )
          ) : news.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-4xl">📣</p>
              <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>No announcements right now.</p>
            </div>
          ) : (
            <ul>
              {news.map((a) => (
                <li key={a.id} className="border-b px-5 py-4 last:border-0" style={{ borderColor: "var(--border)" }}>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{a.title}</p>
                    {a.pinned && <span className="rounded-full bg-paca-50 px-2 py-0.5 text-[10px] font-bold text-paca-700">PINNED</span>}
                  </div>
                  <p className="mt-1 whitespace-pre-line text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{a.body}</p>
                  {a.discountCode && <CopyCode code={a.discountCode} />}
                  {a.publishedAt && <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>{ago(a.publishedAt)}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between border-t px-5 py-3 text-sm" style={{ borderColor: "var(--border)" }}>
          <Link href="/notifications" onClick={onClose} className="font-semibold text-paca-500 hover:underline">
            Open full page
          </Link>
          <button onClick={onClose} className="rounded-lg bg-paca-500 px-4 py-1.5 font-semibold text-white hover:bg-paca-600">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
