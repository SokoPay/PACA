"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ApiError,
  fetchMembershipStatus,
  fetchMyApplications,
  reopenApplication,
  restoreSession,
  type ApplicationRecord,
  type MembershipStatus,
} from "@/lib/api";
import { DocumentViewer } from "@/components/DocumentViewer";
import { ApplicationAnswers, StatusPill, documentLabels } from "@/components/ApplicationAnswers";

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—";
const tierName = (t: string) => t.charAt(0) + t.slice(1).toLowerCase();

export default function MyApplicationsPage() {
  const router = useRouter();
  const [apps, setApps] = useState<ApplicationRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [membership, setMembership] = useState<MembershipStatus["membership"] | undefined>(undefined);

  useEffect(() => {
    (async () => {
      if (!(await restoreSession())) {
        router.replace("/login?next=/dashboard/applications");
        return;
      }
      try {
        const [list, status] = await Promise.all([fetchMyApplications(), fetchMembershipStatus().catch(() => null)]);
        setApps(list);
        setMembership(status?.membership ?? null);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Could not load your applications.");
      }
    })();
  }, [router]);

  async function edit(a: ApplicationRecord) {
    if (a.status === "SUBMITTED" || a.status === "UNDER_REVIEW") {
      const ok = window.confirm(
        "Editing takes your application out of the review queue until you submit it again. Continue?",
      );
      if (!ok) return;
      setBusyId(a.id);
      try {
        await reopenApplication(a.id);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Could not open your application for editing.");
        setBusyId(null);
        return;
      }
    }
    router.push(`/apply/${a.tier.toLowerCase()}`);
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <Link href="/dashboard" className="text-sm text-paca-500 hover:underline">
        &larr; Dashboard
      </Link>
      <h1 className="mt-3 text-2xl font-bold tracking-tight">My applications</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
        Everything you submitted to PACA, including your uploaded files. You can edit an application until it is approved.
      </p>

      {error && (
        <p role="alert" className="mt-5 rounded-lg px-4 py-3 text-sm" style={{ background: "#c0392b1a", color: "#c0392b" }}>
          {error}
        </p>
      )}
      {!apps && !error && <p className="mt-8 text-sm" style={{ color: "var(--text-muted)" }}>Loading…</p>}

      {apps && apps.length === 0 && (
        <div className="mt-8 rounded-2xl border p-8 text-center" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <p className="font-semibold">You have not applied for a membership yet.</p>
          <Link href="/membership" className="mt-4 inline-block rounded-xl bg-paca-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-paca-600">
            Choose a membership type
          </Link>
        </div>
      )}

      <div className="mt-6 space-y-6">
        {apps?.map((a, i) => {
          // Only the newest approved application speaks for the current membership.
          const currentApproved = a.status === "APPROVED" && apps.find((x) => x.status === "APPROVED")?.id === a.id;
          const editable = ["DRAFT", "DECLINED", "SUBMITTED", "UNDER_REVIEW"].includes(a.status);
          const missing = a.form.documents.filter((r) => r.required && !a.documents.some((d) => d.kind === r.kind));
          return (
            <article
              key={a.id}
              className="overflow-hidden rounded-2xl border"
              style={{ borderColor: a.status === "DECLINED" ? "#f3b4ae" : "var(--border)", background: "var(--surface)" }}
            >
              <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4" style={{ borderColor: "var(--border)" }}>
                <div>
                  <h2 className="text-lg font-bold">{tierName(a.tier)} membership application</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                    <StatusPill status={a.status} />
                    <span>{a.submittedAt ? `Submitted ${fmtDate(a.submittedAt)}` : "Not submitted yet"}</span>
                    {a.reviewedAt && <span>· Reviewed {fmtDate(a.reviewedAt)}</span>}
                  </div>
                </div>
                {editable && (
                  <button
                    disabled={busyId === a.id}
                    onClick={() => void edit(a)}
                    className="rounded-xl bg-paca-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-paca-600 disabled:opacity-50"
                  >
                    {busyId === a.id ? "Opening…" : a.status === "DECLINED" ? "✎ Fix and resubmit" : a.status === "DRAFT" ? "✎ Continue application" : "✎ Edit application"}
                  </button>
                )}
              </header>

              <div className="space-y-6 p-5">
                {a.decisionReason && (a.status === "DECLINED" || a.status === "DRAFT") && (
                  <div className="rounded-xl border-l-4 px-4 py-3 text-sm" style={{ borderColor: "#c0392b", background: "#fdecea", color: "#7a1d14" }}>
                    <div className="font-bold">What the review panel asked you to change</div>
                    <p className="mt-1 whitespace-pre-wrap">{a.decisionReason}</p>
                    <p className="mt-2 text-xs">Update your details or documents, then submit again. Your answers and files are kept.</p>
                  </div>
                )}
                {a.status === "DRAFT" && !a.decisionReason && (
                  <p className="rounded-xl px-4 py-3 text-sm" style={{ background: "#fdf2d0", color: "#8a6100" }}>
                    This application has not been submitted. The review panel only sees it after you press Submit.
                  </p>
                )}
                {currentApproved && membership !== undefined && <PaymentState membership={membership} />}

                <details open={i === 0}>
                  <summary className="cursor-pointer text-sm font-bold">Your answers</summary>
                  <div className="mt-4">
                    <ApplicationAnswers form={a.form} answers={a.answers} />
                  </div>
                </details>

                <div>
                  <h3 className="mb-3 text-sm font-bold">Your uploaded documents ({a.documents.length})</h3>
                  <DocumentViewer scope="member" applicationId={a.id} documents={a.documents} labels={documentLabels(a.form)} />
                  {missing.length > 0 && editable && (
                    <p className="mt-2 text-sm text-[#b42318]">Still needed: {missing.map((m) => m.label).join(", ")}</p>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}

/**
 * What an approved application means right now. Approval alone does not make a
 * membership active: it becomes active only once payment is confirmed (online by
 * Paystack, or by a PACA administrator for cash / direct transfer).
 */
function PaymentState({ membership }: { membership: MembershipStatus["membership"] }) {
  if (membership?.status === "ACTIVE") {
    return (
      <p className="rounded-xl px-4 py-3 text-sm" style={{ background: "#d4f5e2", color: "#146c3b" }}>
        <strong>Approved and paid.</strong> Your membership {membership.memberNumber} is active
        {membership.currentPeriodEnd ? ` until ${fmtDate(membership.currentPeriodEnd)}` : ""}.
      </p>
    );
  }
  if (membership?.status === "LAPSED") {
    return (
      <p className="rounded-xl px-4 py-3 text-sm" style={{ background: "#fdf2d0", color: "#8a6100" }}>
        Your membership has expired. Renew it from your{" "}
        <Link href="/dashboard" className="font-semibold underline">dashboard</Link> to restore your benefits.
      </p>
    );
  }
  if (membership?.status === "PENDING_PAYMENT") {
    return (
      <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "#fdf2d0", color: "#8a6100" }}>
        <p>
          <strong>Approved, but not active yet: payment not confirmed.</strong> Pay online from your{" "}
          <Link href="/dashboard" className="font-semibold underline">dashboard</Link>, or pay PACA in cash or by transfer and an
          administrator will confirm it.
        </p>
        <p className="mt-1 text-xs">Until payment is confirmed you cannot sit the exam or download badges.</p>
      </div>
    );
  }
  return (
    <p className="rounded-xl px-4 py-3 text-sm" style={{ background: "#d4f5e2", color: "#146c3b" }}>
      Approved.
    </p>
  );
}
