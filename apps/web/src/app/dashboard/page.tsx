"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  fetchMembershipStatus,
  formatUsd,
  logout,
  restoreSession,
  type MembershipStatus,
  type SessionUser,
} from "@/lib/api";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  APPROVED: "Approved",
  DECLINED: "Declined",
  WITHDRAWN: "Withdrawn",
  PENDING_PAYMENT: "Awaiting payment",
  ACTIVE: "Active",
  LAPSED: "Lapsed",
  SUSPENDED: "Suspended",
  CANCELLED: "Cancelled",
};

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [status, setStatus] = useState<MembershipStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const session = await restoreSession();
      if (!session) {
        router.replace("/login?next=/dashboard");
        return;
      }
      setUser(session);
      try {
        setStatus(await fetchMembershipStatus());
      } catch {
        setError("Could not load your membership status.");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm" style={{ color: "var(--text-muted)" }}>
        Loading…
      </main>
    );
  }

  const action = status?.nextAction;

  return (
    <main className="mx-auto max-w-4xl px-5 py-12">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/" className="text-xl font-bold tracking-tight text-paca-500">
            PACA
          </Link>
          <h1 className="mt-1 text-2xl font-bold">Welcome, {user?.firstName}</h1>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {user && user.role !== "MEMBER" && (
            <Link href="/admin/queue" className="text-paca-500 hover:underline">
              Review queue
            </Link>
          )}
          {user && (user.role === "ADMIN" || user.role === "SUPERADMIN") && (
            <>
              <Link href="/admin/users" className="text-paca-500 hover:underline">
                Users
              </Link>
              <Link href="/admin/applications" className="text-paca-500 hover:underline">
                Applications
              </Link>
            </>
          )}
          <button
            onClick={async () => {
              await logout();
              router.replace("/login");
            }}
            className="hover:underline"
            style={{ color: "var(--text-muted)" }}
          >
            Sign out
          </button>
        </div>
      </header>

      {error && (
        <p className="mt-6 rounded-lg px-4 py-3 text-sm" style={{ background: "#c0392b1a", color: "#c0392b" }}>
          {error}
        </p>
      )}

      {/*
        The "unlock your benefits" prompt. It appears for every state short of an
        active membership, and always says what the next step actually is.
      */}
      {action && action.kind !== "NONE" && (
        <section
          className="mt-8 rounded-xl border p-6"
          style={{
            borderColor: action.kind === "PAY" ? "var(--color-paca-500)" : "var(--border)",
            background: action.kind === "PAY" ? "var(--color-paca-50)" : "var(--surface)",
          }}
        >
          <h2 className="font-semibold" style={{ color: action.kind === "PAY" ? "var(--color-paca-700)" : "var(--text)" }}>
            {action.kind === "PAY" ? "Unlock your PACA benefits" : "Your next step"}
          </h2>
          <p
            className="mt-2 text-sm leading-relaxed"
            style={{ color: action.kind === "PAY" ? "var(--color-paca-800)" : "var(--text-muted)" }}
          >
            {action.message}
          </p>

          <div className="mt-4">
            {action.kind === "PAY" && (
              <button
                className="rounded-lg bg-paca-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-paca-600 disabled:opacity-60"
                disabled
                title="Payment provider not yet connected"
              >
                Pay {formatUsd(action.amountUsdCents)} — coming soon
              </button>
            )}
            {action.kind === "APPLY" && (
              <Link
                href="/membership"
                className="inline-block rounded-lg bg-paca-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-paca-600"
              >
                Choose a membership type
              </Link>
            )}
            {action.kind === "COMPLETE_DRAFT" && status?.latestApplication && (
              <Link
                href={`/apply/${status.latestApplication.tier.toLowerCase()}`}
                className="inline-block rounded-lg bg-paca-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-paca-600"
              >
                Continue your application
              </Link>
            )}
            {action.kind === "SIT_EXAM" && (
              <Link
                href="/assessment"
                className="inline-block rounded-lg bg-paca-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-paca-600"
              >
                Start the assessment
              </Link>
            )}
          </div>
        </section>
      )}

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        <section className="rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            Membership
          </h2>
          {status?.membership ? (
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Member number" value={status.membership.memberNumber} />
              <Row label="Type" value={status.membership.tier} />
              <Row label="Status" value={STATUS_LABEL[status.membership.status] ?? status.membership.status} />
              {status.membership.currentPeriodEnd && (
                <Row label="Renews" value={new Date(status.membership.currentPeriodEnd).toLocaleDateString()} />
              )}
            </dl>
          ) : (
            <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>
              You do not hold a PACA membership yet.
            </p>
          )}
        </section>

        <section className="rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            Application
          </h2>
          {status?.latestApplication ? (
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Type" value={status.latestApplication.tier} />
              <Row
                label="Status"
                value={STATUS_LABEL[status.latestApplication.status] ?? status.latestApplication.status}
              />
              {status.latestApplication.submittedAt && (
                <Row
                  label="Submitted"
                  value={new Date(status.latestApplication.submittedAt).toLocaleDateString()}
                />
              )}
              {status.latestApplication.decisionReason && (
                <div className="pt-2">
                  <dt className="text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    Reason
                  </dt>
                  <dd className="mt-1 leading-relaxed">{status.latestApplication.decisionReason}</dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>
              No application yet.
            </p>
          )}
        </section>
      </div>

      {/* Benefits, greyed until payment clears. */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          Your benefits
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Certification exam", "Sit the assessment and earn your certificate"],
            ["Digital certificate", "Emailed to you on passing"],
            ["Member badge", "Share on LinkedIn and other networks"],
            ["Partner discounts", "Discount codes on partner courses"],
          ].map(([title, body]) => (
            <div
              key={title}
              className="rounded-xl border p-4"
              style={{
                borderColor: "var(--border)",
                opacity: status?.benefitsLocked ? 0.55 : 1,
              }}
            >
              <div className="flex items-center gap-2">
                {status?.benefitsLocked && <span aria-hidden>&#128274;</span>}
                <h3 className="text-sm font-semibold">{title}</h3>
              </div>
              <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                {body}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt style={{ color: "var(--text-muted)" }}>{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
