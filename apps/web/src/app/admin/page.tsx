"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchAdminAssessmentStats,
  fetchApplications,
  fetchActivity,
  fetchStats,
  fetchUsers,
  type ActivityItem,
} from "@/lib/api";
import { useAdminSession } from "./AdminSessionContext";

interface Card {
  label: string;
  value: string;
  href: string;
}

export default function AdminOverviewPage() {
  const user = useAdminSession();
  const [cards, setCards] = useState<Card[]>([]);
  const [recent, setRecent] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const nextCards: Card[] = [];

      try {
        const apps = await fetchApplications({ status: "SUBMITTED", pageSize: 1 });
        nextCards.push({ label: "Applications awaiting review", value: String(apps.total), href: "/admin/applications" });
      } catch {
        // ADMIN-only — a REVIEWER simply won't see this card.
      }

      try {
        const qStats = await fetchStats();
        nextCards.push({ label: "Questions awaiting review", value: String(qStats.pending), href: "/admin/queue" });
        nextCards.push({ label: "Published questions", value: String(qStats.published), href: "/admin/questions" });
        nextCards.push({
          label: "AI-generated questions",
          value: String(qStats.byOrigin.AI_GENERATED),
          href: "/admin/questions",
        });
      } catch {
        // ignore
      }

      try {
        const users = await fetchUsers({ pageSize: 1 });
        nextCards.push({ label: "Total users", value: String(users.total), href: "/admin/users" });
      } catch {
        // ADMIN-only
      }

      try {
        const examStats = await fetchAdminAssessmentStats();
        nextCards.push({
          label: "Assessments passed",
          value: `${examStats.passed} / ${examStats.submitted}`,
          href: "/admin/assessments",
        });
      } catch {
        // ADMIN-only
      }

      setCards(nextCards);

      try {
        const activity = await fetchActivity({ pageSize: 8 });
        setRecent(activity.items);
      } catch {
        // ADMIN-only
      }

      setLoading(false);
    })();
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-xl font-bold">Welcome, {user.firstName}</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
        {user.role} overview
      </p>

      {loading && (
        <p className="mt-8 text-sm" style={{ color: "var(--text-muted)" }}>
          Loading…
        </p>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="rounded-xl border p-5 transition hover:border-paca-500"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <div className="text-2xl font-bold text-paca-500">{c.value}</div>
            <div className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
              {c.label}
            </div>
          </Link>
        ))}
      </div>

      {recent.length > 0 && (
        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Recent activity
            </h2>
            <Link href="/admin/activity" className="text-xs text-paca-500 hover:underline">
              View all &rarr;
            </Link>
          </div>
          <ul className="mt-3 space-y-2">
            {recent.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between rounded-lg border px-4 py-2.5 text-sm"
                style={{ borderColor: "var(--border)" }}
              >
                <span>
                  <span className="font-medium">{a.actor ? `${a.actor.firstName} ${a.actor.lastName}` : "System"}</span>{" "}
                  <span style={{ color: "var(--text-muted)" }}>{a.action}</span>
                </span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {new Date(a.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
