"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  approveApplication,
  declineApplication,
  fetchApplication,
  fetchApplications,
  restoreSession,
  type AdminApplicationDetail,
  type AdminApplicationListItem,
  type AdminApplicationStatus,
  type MembershipTierValue,
  type ProfileView,
  type SessionUser,
} from "@/lib/api";
import { Modal } from "@/components/Modal";
import { DocumentViewer } from "@/components/DocumentViewer";
import { ApplicationAnswers, StatusPill, documentLabels } from "@/components/ApplicationAnswers";
import { MembershipPaymentPanel } from "../MembershipPaymentPanel";

const STATUS_TABS: Array<{ value: AdminApplicationStatus | ""; label: string }> = [
  { value: "SUBMITTED", label: "Awaiting review" },
  { value: "UNDER_REVIEW", label: "Under review" },
  { value: "DECLINED", label: "Changes requested" },
  { value: "APPROVED", label: "Approved" },
  { value: "DRAFT", label: "Drafts (not submitted)" },
  { value: "WITHDRAWN", label: "Withdrawn" },
  { value: "", label: "All" },
];
const TIERS: MembershipTierValue[] = ["STUDENT", "PROFESSIONAL", "EXECUTIVE", "FELLOW", "RETIRED"];
const DECIDABLE = new Set<AdminApplicationStatus>(["SUBMITTED", "UNDER_REVIEW"]);
const PAGE_SIZE = 25;
const fmtDate = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");

export default function AdminApplicationsPage() {
  const router = useRouter();
  const [me, setMe] = useState<SessionUser | null>(null);

  const [items, setItems] = useState<AdminApplicationListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Partial<Record<AdminApplicationStatus, number>>>({});
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<AdminApplicationStatus | "">("SUBMITTED");
  const [tierFilter, setTierFilter] = useState<MembershipTierValue | "">("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");

  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    restoreSession().then((session) => {
      if (!session || session.role === "MEMBER" || session.role === "REVIEWER") {
        router.replace(session ? "/admin/queue" : "/login");
        return;
      }
      setMe(session);
    });
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetchApplications({
        status: statusFilter || undefined,
        tier: tierFilter || undefined,
        query: query || undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      setItems(r.items);
      setTotal(r.total);
      setCounts(r.counts ?? {});
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load applications.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, tierFilter, query, page]);

  useEffect(() => {
    if (me) void load();
  }, [me, load]);

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      setQuery(search.trim());
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  function flash(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 3500);
  }

  if (!me) {
    return (
      <main className="flex h-full items-center justify-center text-sm" style={{ color: "var(--text-muted)" }}>
        Loading…
      </main>
    );
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const allCount = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);

  return (
    <main className="mx-auto max-w-[1400px] p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Membership applications</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            Click an applicant to see all their details and documents, then approve or request changes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email…"
            className="w-60 rounded-lg border px-3 py-2 outline-none focus:border-paca-500"
            style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }}
          />
          <select
            value={tierFilter}
            onChange={(e) => {
              setPage(1);
              setTierFilter(e.target.value as MembershipTierValue | "");
            }}
            className="rounded-lg border px-3 py-2"
            style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }}
          >
            <option value="">All membership types</option>
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0) + t.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* status tabs with counts */}
      <div className="mt-5 flex flex-wrap gap-2">
        {STATUS_TABS.map((t) => {
          const active = statusFilter === t.value;
          const n = t.value ? (counts[t.value] ?? 0) : allCount;
          return (
            <button
              key={t.label}
              onClick={() => {
                setPage(1);
                setStatusFilter(t.value);
              }}
              className="rounded-full border px-3.5 py-1.5 text-sm font-semibold transition"
              style={
                active
                  ? { background: "var(--color-paca-500)", borderColor: "var(--color-paca-500)", color: "white" }
                  : { borderColor: "var(--border)", background: "var(--surface)" }
              }
            >
              {t.label} <span className={active ? "opacity-90" : "text-paca-500"}>{n}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <div role="alert" className="mt-4 rounded-lg px-4 py-2 text-sm" style={{ background: "#c0392b1a", color: "#c0392b" }}>
          {error}
        </div>
      )}
      {toast && (
        <div className="mt-4 rounded-lg px-4 py-2 text-sm font-medium" style={{ background: "#d4f5e2", color: "#146c3b" }}>
          {toast}
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b text-xs uppercase tracking-wide" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
              <th className="px-4 py-3">Applicant</th>
              <th className="px-4 py-3">Membership type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Documents</th>
              <th className="px-4 py-3">Submitted</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr
                key={a.id}
                onClick={() => setOpenId(a.id)}
                className="cursor-pointer border-b transition hover:bg-[var(--bg)]"
                style={{ borderColor: "var(--border)" }}
              >
                <td className="px-4 py-3">
                  <div className="font-semibold">
                    {a.user.firstName} {a.user.lastName}
                  </div>
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {a.user.email}
                  </div>
                </td>
                <td className="px-4 py-3">{a.tier.charAt(0) + a.tier.slice(1).toLowerCase()}</td>
                <td className="px-4 py-3">
                  <StatusPill status={a.status} />
                  {a.status === "APPROVED" && a.user.membership && (
                    <span
                      className="ml-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold"
                      style={
                        a.user.membership.status === "ACTIVE"
                          ? { background: "#d4f5e2", color: "#146c3b" }
                          : { background: "#fdf2d0", color: "#8a6100" }
                      }
                    >
                      {a.user.membership.status === "ACTIVE" ? "Paid · active" : "Awaiting payment"}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">{a.documentCount ?? "—"} file{a.documentCount === 1 ? "" : "s"}</td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>
                  {fmtDate(a.submittedAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-paca-500" style={{ borderColor: "var(--border)" }}>
                    {DECIDABLE.has(a.status) ? "Review" : "View"}
                  </span>
                </td>
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center" style={{ color: "var(--text-muted)" }}>
                  No applications here.
                </td>
              </tr>
            )}
            {loading && items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center" style={{ color: "var(--text-muted)" }}>
                  Loading…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="mt-4 flex items-center justify-end gap-3 text-sm">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40" style={{ borderColor: "var(--border)" }}>
            Previous
          </button>
          <span style={{ color: "var(--text-muted)" }}>
            Page {page} of {pageCount}
          </span>
          <button disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40" style={{ borderColor: "var(--border)" }}>
            Next
          </button>
        </div>
      )}

      {openId && (
        <ApplicationReviewModal
          canConfirmPayment={me?.role === "SUPERADMIN"}
          id={openId}
          onClose={() => setOpenId(null)}
          onDecided={(message) => {
            setOpenId(null);
            flash(message);
            void load();
          }}
        />
      )}
    </main>
  );
}

function ProfileFacts({ profile }: { profile: ProfileView | null }) {
  // Address, gender, education and work are in the application form below — not repeated here.
  if (!profile || (!profile.linkedinUrl && !profile.bio)) {
    return <p className="text-sm" style={{ color: "var(--text-muted)" }}>No LinkedIn link or bio added yet.</p>;
  }
  const rows: Array<[string, React.ReactNode]> = [
    [
      "LinkedIn",
      profile.linkedinUrl ? (
        <a href={profile.linkedinUrl} target="_blank" rel="noreferrer" className="break-all text-paca-500 hover:underline">
          {profile.linkedinUrl}
        </a>
      ) : (
        "—"
      ),
    ],
  ];
  return (
    <div>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs" style={{ color: "var(--text-muted)" }}>{k}</dt>
            <dd className="mt-0.5 text-sm font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      {profile.bio && (
        <div className="mt-3">
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>Bio</div>
          <p className="mt-0.5 whitespace-pre-wrap text-sm">{profile.bio}</p>
        </div>
      )}
    </div>
  );
}

function Card({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="rounded-xl border p-4 sm:p-5" style={{ borderColor: "var(--border)", background: "var(--bg)" }}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

function ApplicationReviewModal({
  id,
  canConfirmPayment,
  onClose,
  onDecided,
}: {
  id: string;
  canConfirmPayment: boolean;
  onClose: () => void;
  onDecided: (message: string) => void;
}) {
  const [detail, setDetail] = useState<AdminApplicationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState("");
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => {
    fetchApplication(id)
      .then(setDetail)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load this application."));
  }, [id]);

  async function approve() {
    if (!detail) return;
    setBusy(true);
    setError(null);
    try {
      await approveApplication(detail.id, notes.trim() || undefined);
      onDecided(
        `Approved ${detail.user.firstName} ${detail.user.lastName}. Not active until payment is confirmed: they have been emailed to pay online, or confirm a cash payment from the Approved tab.`,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not approve.");
      setBusy(false);
    }
  }

  async function decline() {
    if (!detail || reason.trim().length < 3) return;
    setBusy(true);
    setError(null);
    try {
      await declineApplication(detail.id, reason.trim());
      onDecided(`Changes requested from ${detail.user.firstName} ${detail.user.lastName}. They have been emailed the reason.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not decline.");
      setBusy(false);
    }
  }

  const decidable = detail ? DECIDABLE.has(detail.status) : false;
  const name = detail ? `${detail.user.firstName} ${detail.user.lastName}` : "Application";

  const footer = detail && decidable && (
    <div>
      {error && <p className="mb-3 text-sm text-[#c0392b]">{error}</p>}
      {declining ? (
        <div>
          <label className="text-sm font-semibold">What does the applicant need to change? (they will see this and get it by email)</label>
          <textarea
            rows={3}
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Your student ID is not readable — please upload a clearer photo of both sides."
            className="mt-2 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-paca-500"
            style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              disabled={busy || reason.trim().length < 3}
              onClick={() => void decline()}
              className="rounded-lg bg-[#c0392b] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Sending…" : "Send back for changes"}
            </button>
            <button onClick={() => setDeclining(false)} className="rounded-lg border px-4 py-2 text-sm font-semibold" style={{ borderColor: "var(--border)" }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Internal reviewer note (optional, never shown to the applicant)"
            className="min-w-[240px] flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:border-paca-500"
            style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
          />
          <button
            disabled={busy}
            onClick={() => void approve()}
            className="rounded-lg bg-[#1f9d55] px-5 py-2 text-sm font-semibold text-white hover:bg-[#178a49] disabled:opacity-50"
          >
            {busy ? "Approving…" : "✓ Approve"}
          </button>
          <button
            disabled={busy}
            onClick={() => setDeclining(true)}
            className="rounded-lg border border-[#c0392b] px-5 py-2 text-sm font-semibold text-[#c0392b] disabled:opacity-50"
          >
            Request changes / decline
          </button>
        </div>
      )}
    </div>
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={name}
      subtitle={
        detail && (
          <span className="flex flex-wrap items-center gap-2">
            <StatusPill status={detail.status} />
            <span>{detail.tier.charAt(0) + detail.tier.slice(1).toLowerCase()} application</span>
            <span>· submitted {fmtDate(detail.submittedAt)}</span>
          </span>
        )
      }
      footer={footer || undefined}
    >
      {!detail && !error && <p style={{ color: "var(--text-muted)" }}>Loading application…</p>}
      {!detail && error && <p className="text-[#c0392b]">{error}</p>}
      {detail && (
        <div className="space-y-5">
          {detail.decisionReason && (
            <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "#fdf2d0", color: "#8a6100" }}>
              <strong>{detail.status === "DECLINED" ? "Changes requested:" : "Previously sent back because:"}</strong> {detail.decisionReason}
            </div>
          )}

          {detail.status === "APPROVED" && (
            <MembershipPaymentPanel
              userId={detail.user.id}
              membership={detail.user.membership}
              canConfirm={canConfirmPayment}
              onConfirmed={(msg) => onDecided(`${detail.user.firstName} ${detail.user.lastName}: ${msg}`)}
            />
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Applicant">
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {[
                  ["Full name", name],
                  [
                    "Email",
                    <span key="e">
                      <a href={`mailto:${detail.user.email}`} className="break-all text-paca-500 hover:underline">
                        {detail.user.email}
                      </a>
                      {detail.user.emailVerifiedAt ? (
                        <span className="ml-1 text-xs text-[#146c3b]">✓ verified</span>
                      ) : (
                        <span className="ml-1 text-xs text-[#b42318]">not verified</span>
                      )}
                    </span>,
                  ],
                  ["Phone", detail.user.phone ?? "—"],
                  ["Account created", fmtDate(detail.user.createdAt)],
                  ["Member ID", detail.user.membership?.memberNumber ?? "Not a member yet"],
                  ["Membership status", detail.user.membership?.status.replace(/_/g, " ").toLowerCase() ?? "—"],
                ].map(([k, v]) => (
                  <div key={String(k)}>
                    <dt className="text-xs" style={{ color: "var(--text-muted)" }}>{k}</dt>
                    <dd className="mt-0.5 text-sm font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </Card>
            <Card title="LinkedIn and bio">
              <ProfileFacts profile={detail.user.profile} />
            </Card>
          </div>

          <Card title="Application form">
            <ApplicationAnswers form={detail.form} answers={detail.answers} />
          </Card>

          <Card title={`Uploaded documents (${detail.documents.length})`}>
            <DocumentViewer scope="admin" applicationId={detail.id} documents={detail.documents} labels={documentLabels(detail.form)} />
            {detail.form.documents
              .filter((r) => r.required && !detail.documents.some((d) => d.kind === r.kind))
              .map((r) => (
                <p key={r.kind} className="mt-2 text-sm text-[#b42318]">
                  Missing required document: {r.label}
                </p>
              ))}
          </Card>

          {(detail.history.length > 0 || detail.reviewerNotes || detail.reviewer) && (
            <Card title="History">
              {detail.reviewer && (
                <p className="text-sm">
                  Last decision by {detail.reviewer.firstName} {detail.reviewer.lastName}
                  {detail.reviewedAt ? ` on ${fmtDate(detail.reviewedAt)}` : ""}.
                </p>
              )}
              {detail.reviewerNotes && <p className="mt-1 text-sm">Internal note: {detail.reviewerNotes}</p>}
              {detail.history.length > 0 && (
                <ul className="mt-2 space-y-1.5 text-sm">
                  {detail.history.map((h) => (
                    <li key={h.id} className="flex flex-wrap items-center gap-2">
                      <StatusPill status={h.status} />
                      <span>{h.tier.charAt(0) + h.tier.slice(1).toLowerCase()} application · {fmtDate(h.submittedAt)}</span>
                      {h.decisionReason && <span style={{ color: "var(--text-muted)" }}>— {h.decisionReason}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {!decidable && (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {detail.status === "DRAFT"
                ? "This applicant has not submitted yet. You can approve or decline once they press Submit."
                : "No decision is needed on this application."}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
