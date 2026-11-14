"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  fetchMembershipStatus,
  fetchMyPayments,
  formatMoney,
  restoreSession,
  type MembershipStatus,
  type PaymentView,
  type SessionUser,
} from "@/lib/api";
import { PayMembershipButton } from "@/components/PayMembershipButton";

const PAYMENT_STATUS: Record<PaymentView["status"], string> = {
  INITIALIZED: "Started",
  PENDING: "Processing",
  SUCCESS: "Paid",
  FAILED: "Failed",
  ABANDONED: "Not completed",
  REFUNDED: "Refunded",
};

const CHANNEL: Record<string, string> = {
  card: "Card",
  mobile_money: "Mobile money",
  bank: "Bank",
  bank_transfer: "Bank transfer",
};

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
  const [payments, setPayments] = useState<PaymentView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [justPaid, setJustPaid] = useState(false);

  async function loadStatus() {
    try {
      const [s, p] = await Promise.all([fetchMembershipStatus(), fetchMyPayments().catch(() => [])]);
      setStatus(s);
      setPayments(p);
    } catch {
      setError("Could not load your membership status.");
    }
  }

  useEffect(() => {
    (async () => {
      const session = await restoreSession();
      if (!session) {
        router.replace("/login?next=/dashboard");
        return;
      }
      if (session.role === "MEMBER" && !session.emailVerifiedAt) {
        router.replace("/verify-email?next=/dashboard");
        return;
      }
      setUser(session);
      await loadStatus();
      setLoading(false);
    })();
  }, [router]);

  if (loading) {
    return (
      <main className="flex min-h-[50vh] items-center justify-center text-sm" style={{ color: "var(--text-muted)" }}>
        Loading…
      </main>
    );
  }

  const action = status?.nextAction;

  return (
    <main className="mx-auto max-w-4xl px-5 py-12">
      <header>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          My dashboard
        </p>
        <h1 className="mt-1 text-2xl font-bold">Welcome, {user?.firstName}</h1>
      </header>

      {error && (
        <p className="mt-6 rounded-lg px-4 py-3 text-sm" style={{ background: "#c0392b1a", color: "#c0392b" }}>
          {error}
        </p>
      )}

      {justPaid && status?.membership?.status === "ACTIVE" && (
        <p
          role="status"
          className="mt-6 rounded-lg px-4 py-3 text-sm font-medium"
          style={{ background: "var(--color-paca-50)", color: "var(--color-paca-800)" }}
        >
          Payment received — welcome to PACA! Your membership is now active.
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
              <PayMembershipButton
                amountUsdCents={action.amountUsdCents}
                chargeAmount={action.chargeAmount}
                chargeCurrency={action.chargeCurrency}
                onPaid={() => {
                  setJustPaid(true);
                  void loadStatus();
                }}
              />
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

      {/* Free for every registered member — paid or not. */}
      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        <section className="flex flex-col rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <p className="text-xs font-semibold uppercase tracking-wide text-paca-500">Free</p>
          <h2 className="mt-1 font-semibold">Competency test</h2>
          <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
            20 questions, 30 minutes. See your Agile competency level and which topics to study. No payment needed.
          </p>
          <div className="mt-auto pt-4">
            <Link
              href="/assessment"
              className="inline-block rounded-lg bg-paca-500 px-5 py-2 text-sm font-semibold text-white hover:bg-paca-600"
            >
              Take the free test
            </Link>
          </div>
        </section>

        <section className="flex flex-col rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            {status?.membership?.status === "ACTIVE" ? "Unlocked" : "\u{1F512} After payment"}
          </p>
          <h2 className="mt-1 font-semibold">Member library</h2>
          <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
            PDF study books for your membership type, to read before the certification exam.
          </p>
          <div className="mt-auto pt-4">
            <Link
              href="/dashboard/library"
              className="inline-block rounded-lg border px-5 py-2 text-sm font-semibold text-paca-500 hover:bg-paca-50"
              style={{ borderColor: "var(--color-paca-500)" }}
            >
              {status?.membership?.status === "ACTIVE" ? "Open the library" : "See what\u2019s included"}
            </Link>
          </div>
        </section>
      </div>

      {/* Benefits, greyed until payment clears. */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          Your benefits
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Certification exam", "Sit the assessment and earn your certificate"],
            ["Study library", "PDF books for your membership type"],
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

      {payments.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            Payments
          </h2>
          <div className="mt-3 overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
            <table className="w-full text-left text-sm">
              <thead style={{ color: "var(--text-muted)" }}>
                <tr>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Amount</th>
                  <th className="px-4 py-2 font-medium">Method</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Reference</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                    <td className="px-4 py-2">{new Date(p.paidAt ?? p.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-2">{formatMoney(p.amount, p.currency)}</td>
                    <td className="px-4 py-2">{p.channel ? (CHANNEL[p.channel] ?? p.channel) : "—"}</td>
                    <td className="px-4 py-2">{PAYMENT_STATUS[p.status]}</td>
                    <td className="px-4 py-2 font-mono text-xs">{p.reference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
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
