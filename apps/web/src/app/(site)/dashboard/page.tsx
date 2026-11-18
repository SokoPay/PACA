"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  TIER_LABEL,
  AGILE_ROLE_LABEL,
  fetchAnnouncements,
  fetchMemberEvents,
  fetchMemberJobs,
  fetchMembershipStatus,
  fetchNotifications,
  fetchMyPayments,
  formatMoney,
  restoreSession,
  siteUrl,
  type AnnouncementItem,
  type EventItem,
  type MemberJob,
  type MembershipStatus,
  type MembershipTierValue,
  type PaymentView,
  type SessionUser,
} from "@/lib/api";
import { badgeFor } from "@/lib/brand";
import { PayMembershipButton } from "@/components/PayMembershipButton";
import { ShareButtons, addToLinkedInUrl } from "@/components/ShareButtons";
import { EventCard } from "@/components/EventCard";
import { openNotifications } from "@/lib/notificationEvents";

const PAYMENT_STATUS: Record<PaymentView["status"], string> = {
  INITIALIZED: "Started",
  PENDING: "Processing",
  SUCCESS: "Paid",
  FAILED: "Failed",
  ABANDONED: "Not completed",
  REFUNDED: "Refunded",
};

const CHANNEL: Record<string, string> = { card: "Card", mobile_money: "Mobile money", bank: "Bank", bank_transfer: "Bank transfer", cash: "Cash" };

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

/** Everything a paid membership unlocks. `free` items work for every registered user. */
const PRIVILEGES: Array<{ title: string; body: string; href: string; icon: string; free?: boolean }> = [
  { title: "Certification exam", body: "Sit the exam for your membership type and earn your PACA certificate.", href: "/exam", icon: "🎓" },
  { title: "Digital badge", body: "A verified badge to share on LinkedIn and social media.", href: "#badge", icon: "🏅" },
  { title: "Study library", body: "PDF books and guides for your membership type.", href: "/dashboard/library", icon: "📚" },
  { title: "Agile job board", body: "Scrum, Product Owner and Agile roles screened for you, updated daily.", href: "/dashboard/jobs", icon: "💼" },
  { title: "Course discounts", body: "Member discounts on Scrum.org, ProKanban.org and Scrum Alliance courses.", href: "/courses", icon: "🏷️" },
  { title: "Event discounts", body: "Member discount codes for PACA and partner events.", href: "#events", icon: "🎟️" },
  { title: "Professional network", body: "Find and connect with PACA members across Africa.", href: "/dashboard/network", icon: "🤝" },
  { title: "Free competency test", body: "Check your level any time and learn from every answer.", href: "/assessment", icon: "📝", free: true },
];

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [status, setStatus] = useState<MembershipStatus | null>(null);
  const [payments, setPayments] = useState<PaymentView[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [jobs, setJobs] = useState<MemberJob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [justPaid, setJustPaid] = useState(false);

  async function loadStatus() {
    try {
      const [s, p, a] = await Promise.all([
        fetchMembershipStatus(),
        fetchMyPayments().catch(() => []),
        fetchAnnouncements().catch(() => []),
      ]);
      setStatus(s);
      setPayments(p);
      setAnnouncements(a);
      const ev = await fetchMemberEvents().catch(() => null);
      setEvents(ev?.items ?? []);
      if (s.membership?.status === "ACTIVE") {
        const j = await fetchMemberJobs({ page: 1 }).catch(() => null);
        setJobs(j?.items.slice(0, 4) ?? []);
      }
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
      // Pop the notifications up once per session when something new is waiting.
      try {
        const n = await fetchNotifications();
        if (n.unread > 0 && !sessionStorage.getItem("paca.notified")) {
          sessionStorage.setItem("paca.notified", "1");
          setTimeout(openNotifications, 600);
        }
      } catch {
        // non-critical
      }
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
  const membership = status?.membership;
  const active = membership?.status === "ACTIVE";
  const tier = membership?.tier as MembershipTierValue | undefined;
  const badge = tier ? badgeFor(tier) : undefined;
  const badgeUrl = membership ? siteUrl(`/members/${membership.memberNumber}`) : "";

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-5 sm:py-10">
      {/* greeting */}
      <section className="paca-gradient relative overflow-hidden rounded-3xl px-5 py-7 text-white shadow-xl sm:px-8 sm:py-9">
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="text-sm text-white/80">My dashboard</p>
            <h1 className="mt-1 break-words text-2xl font-bold sm:text-4xl">Welcome back, {user?.firstName} 👋</h1>
            <p className="mt-2 text-white/85">
              {active
                ? `${tier ? TIER_LABEL[tier] : ""} member · ${membership?.memberNumber}`
                : "Complete your membership to unlock every PACA benefit."}
            </p>
          </div>
          {active && badge && (
            <Image src={badge.image} alt={`${badge.name} badge`} width={150} height={127} className="h-[127px] w-auto rounded-2xl bg-white/95 p-2 shadow-lg" />
          )}
        </div>
      </section>

      {error && (
        <p className="mt-6 rounded-lg px-4 py-3 text-sm" style={{ background: "#c0392b1a", color: "#c0392b" }}>
          {error}
        </p>
      )}

      {justPaid && active && (
        <p role="status" className="mt-6 rounded-xl px-4 py-3 text-sm font-medium" style={{ background: "#d4f5e2", color: "#146c3b" }}>
          Payment received — welcome to PACA! Your membership is now active.
        </p>
      )}

      {/* announcements */}
      {announcements.length > 0 && (
        <section className="mt-6 space-y-3">
          {announcements.slice(0, 3).map((a) => (
            <article
              key={a.id}
              className="flex gap-3 rounded-2xl border p-4"
              style={{ borderColor: a.pinned ? "var(--color-paca-500)" : "var(--border)", background: "var(--surface)" }}
            >
              <span className="text-xl" aria-hidden>📣</span>
              <div className="min-w-0">
                <h2 className="font-semibold">{a.title}</h2>
                <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm" style={{ color: "var(--text-muted)" }}>{a.body}</p>
                {a.discountCode && (
                  <p className="mt-2 inline-block rounded-lg border-2 border-dashed px-3 py-1 font-mono text-sm font-bold" style={{ borderColor: "#2e9e5b", color: "#146c3b", background: "#effbf3" }}>
                    {a.discountCode}
                  </p>
                )}
              </div>
            </article>
          ))}
          {announcements.length > 3 && (
            <Link href="/notifications" className="text-sm font-semibold text-paca-500 hover:underline">All announcements &rarr;</Link>
          )}
        </section>
      )}

      {/* next step */}
      {action && action.kind !== "NONE" && (
        <section
          className="mt-6 rounded-2xl border p-6"
          style={{
            borderColor: action.kind === "PAY" ? "var(--color-paca-500)" : "var(--border)",
            background: action.kind === "PAY" ? "var(--color-paca-50)" : "var(--surface)",
          }}
        >
          <h2 className="font-semibold" style={{ color: action.kind === "PAY" ? "var(--color-paca-700)" : "var(--text)" }}>
            {action.kind === "PAY" ? "Unlock your PACA benefits" : "Your next step"}
          </h2>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: action.kind === "PAY" ? "var(--color-paca-800)" : "var(--text-muted)" }}>
            {action.message}
          </p>
          {action.kind === "PAY" && (
            <p className="mt-2 text-xs" style={{ color: "var(--color-paca-800)" }}>
              Paying in cash or by transfer directly to PACA? An administrator confirms it and your membership becomes active.
            </p>
          )}
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
              <Link href="/membership" className="inline-block rounded-xl bg-paca-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-paca-600">
                Choose a membership type
              </Link>
            )}
            {action.kind === "COMPLETE_DRAFT" && status?.latestApplication && (
              <Link
                href={`/apply/${status.latestApplication.tier.toLowerCase()}`}
                className="inline-block rounded-xl bg-paca-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-paca-600"
              >
                Continue your application
              </Link>
            )}
            {action.kind === "SIT_EXAM" && (
              <Link href="/exam" className="inline-block rounded-xl bg-paca-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-paca-600">
                Go to the certification exam
              </Link>
            )}
          </div>
        </section>
      )}

      {/* member badge */}
      {active && membership && badge && (
        <section id="badge" className="mt-6 scroll-mt-24 overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div className="grid gap-6 p-6 md:grid-cols-[200px_1fr] md:items-center">
            <Image src={badge.image} alt={`${badge.name} badge`} width={200} height={169} className="mx-auto h-[169px] w-auto rounded-xl" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-paca-500">Your member badge</p>
              <h2 className="mt-1 text-xl font-bold">{badge.name}</h2>
              <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
                Member {membership.memberNumber}
                {membership.currentPeriodEnd ? ` · valid until ${new Date(membership.currentPeriodEnd).toLocaleDateString()}` : ""}. Anyone can
                verify it on your public badge page.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href={addToLinkedInUrl({ name: badge.name, certUrl: badgeUrl, certId: membership.memberNumber, issued: new Date() })}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
                  style={{ background: "#0a66c2" }}
                >
                  Add to LinkedIn profile
                </a>
                <Link href={`/members/${membership.memberNumber}`} className="rounded-xl border px-4 py-2 text-sm font-semibold hover:border-paca-500" style={{ borderColor: "var(--border)" }}>
                  View public badge page
                </Link>
                <a href={`/members/${encodeURIComponent(membership.memberNumber)}/badge?download=1`} download={`${membership.memberNumber}-PACA-badge.png`} className="rounded-xl border px-4 py-2 text-sm font-semibold hover:border-paca-500" style={{ borderColor: "var(--border)" }}>
                  Download my badge
                </a>
              </div>
              <div className="mt-4">
                <ShareButtons url={badgeUrl} text={`I'm a ${badge.name} of PACA — Professional Agile Certification Africa!`} />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* privileges */}
      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-xl font-bold">{active ? "Your member benefits" : "Benefits waiting for you"}</h2>
          {!active && <span className="text-sm" style={{ color: "var(--text-muted)" }}>🔒 Unlock with a paid membership</span>}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {PRIVILEGES.map((p) => {
            const locked = !active && !p.free;
            return (
              <Link
                key={p.title}
                href={p.href}
                className="group flex min-w-0 flex-col rounded-2xl border p-3.5 transition sm:p-5 hover:-translate-y-0.5 hover:border-paca-500 hover:shadow-lg"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-paca-50 text-2xl" aria-hidden>{p.icon}</span>
                  {locked ? (
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>🔒 Paid</span>
                  ) : p.free ? (
                    <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: "#d4f5e2", color: "#146c3b" }}>Free</span>
                  ) : null}
                </div>
                <h3 className="mt-3 text-sm font-semibold group-hover:text-paca-600 sm:mt-4 sm:text-base">{p.title}</h3>
                <p className="mt-1 text-xs leading-relaxed sm:text-sm" style={{ color: "var(--text-muted)" }}>{p.body}</p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* latest jobs (paid members) */}
      {active && (
        <section className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-xl font-bold">Latest Agile jobs</h2>
            <Link href="/dashboard/jobs" className="text-sm font-semibold text-paca-500 hover:underline">All jobs &rarr;</Link>
          </div>
          {jobs.length === 0 ? (
            <p className="mt-3 rounded-2xl border p-6 text-sm" style={{ borderColor: "var(--border)", color: "var(--text-muted)", background: "var(--surface)" }}>
              New roles are added twice a day — they&rsquo;ll appear here and in your notifications.
            </p>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {jobs.map((j) => (
                <a
                  key={j.id}
                  href={j.applyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-w-0 items-start gap-3 rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:border-paca-500 hover:shadow-md"
                  style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-paca-50 font-bold text-paca-600">{j.company.charAt(0)}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{j.title}</span>
                    <span className="block truncate text-xs" style={{ color: "var(--text-muted)" }}>
                      {j.company} · {j.isRemote ? "Remote" : (j.location ?? "")} · {j.agileRole ? AGILE_ROLE_LABEL[j.agileRole] : ""}
                    </span>
                  </span>
                </a>
              ))}
            </div>
          )}
        </section>
      )}

      {/* events */}
      <section id="events" className="mt-10 scroll-mt-24">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-xl font-bold">Upcoming events</h2>
          <Link href="/events" className="text-sm font-semibold text-paca-500 hover:underline">All events &rarr;</Link>
        </div>
        {events.length === 0 ? (
          <p className="mt-3 rounded-2xl border p-6 text-sm" style={{ borderColor: "var(--border)", color: "var(--text-muted)", background: "var(--surface)" }}>
            No upcoming events yet. You&rsquo;ll be notified when one is announced{active ? ", with your member discount code" : ""}.
          </p>
        ) : (
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {events.slice(0, 3).map((e) => (
              <EventCard key={e.id} event={e} compact />
            ))}
          </div>
        )}
        {!active && events.some((e) => e.memberDiscountPercent) && (
          <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>🔒 Member discount codes unlock once your membership payment is complete.</p>
        )}
      </section>

      {/* membership + application */}
      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        <section className="rounded-2xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Membership</h2>
          {membership ? (
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Member number" value={membership.memberNumber} />
              <Row label="Type" value={tier ? TIER_LABEL[tier] : membership.tier} />
              <Row label="Status" value={STATUS_LABEL[membership.status] ?? membership.status} />
              {membership.currentPeriodEnd && <Row label="Renews" value={new Date(membership.currentPeriodEnd).toLocaleDateString()} />}
            </dl>
          ) : (
            <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>You do not hold a PACA membership yet.</p>
          )}
        </section>

        <section className="rounded-2xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Application</h2>
          {status?.latestApplication ? (
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Type" value={status.latestApplication.tier} />
              <Row label="Status" value={STATUS_LABEL[status.latestApplication.status] ?? status.latestApplication.status} />
              {status.latestApplication.submittedAt && (
                <Row label="Submitted" value={new Date(status.latestApplication.submittedAt).toLocaleDateString()} />
              )}
              {status.latestApplication.decisionReason && (
                <div className="pt-2">
                  <dt className="text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Reason</dt>
                  <dd className="mt-1 leading-relaxed">{status.latestApplication.decisionReason}</dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>No application yet.</p>
          )}
          {status?.latestApplication && (
            <Link href="/dashboard/applications" className="mt-4 inline-block rounded-xl border px-4 py-2 text-sm font-semibold hover:border-paca-500" style={{ borderColor: "var(--border)" }}>
              View or edit my application and documents
            </Link>
          )}
        </section>
      </div>

      {payments.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Payments</h2>
          <ul className="mt-3 space-y-2 sm:hidden">
            {payments.map((p) => (
              <li key={p.id} className="rounded-2xl border p-4 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{formatMoney(p.amount, p.currency)}</span>
                  <span className="text-xs font-semibold">{PAYMENT_STATUS[p.status]}</span>
                </div>
                <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                  {new Date(p.paidAt ?? p.createdAt).toLocaleDateString()} · {p.channel ? (CHANNEL[p.channel] ?? p.channel) : "—"}
                </div>
                <div className="mt-1 break-all font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>{p.reference}</div>
              </li>
            ))}
          </ul>
          <div className="mt-3 hidden overflow-x-auto rounded-2xl border sm:block" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
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
