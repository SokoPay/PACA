"use client";

import { useEffect, useState } from "react";
import {
  ApiError,
  fetchAdminUser,
  updateAdminUser,
  type AdminUserDetail,
  type AdminUserUpdate,
} from "@/lib/api";
import { Modal } from "@/components/Modal";
import { DocumentViewer } from "@/components/DocumentViewer";
import { ApplicationAnswers, StatusPill, documentLabels } from "@/components/ApplicationAnswers";
import { MembershipPaymentPanel } from "../MembershipPaymentPanel";

type ProfileKey = "linkedinUrl" | "bio";

/**
 * Only what the application does not collect. Address, gender, education and
 * work details are the member's application answers (shown below) — they are
 * not repeated or edited here.
 */
const PROFILE_FIELDS: Array<{ key: ProfileKey; label: string; wide?: boolean; textarea?: boolean }> = [
  { key: "linkedinUrl", label: "LinkedIn URL", wide: true },
  { key: "bio", label: "Bio", wide: true, textarea: true },
];

const fmtDate = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");

/** View a user's full record (account, profile, applications and documents). SUPERADMINs can edit it. */
export function UserProfileModal({
  userId,
  canEdit,
  onClose,
  onSaved,
}: {
  userId: string;
  canEdit: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchAdminUser(userId)
      .then(setUser)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load this user."));
  }, [userId]);

  function startEdit() {
    if (!user) return;
    const p = user.profile;
    setForm({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone ?? "",
      ...Object.fromEntries(PROFILE_FIELDS.map((f) => [f.key, (p?.[f.key] as string | null) ?? ""])),
    });
    setError(null);
    setEditing(true);
  }

  async function save() {
    if (!user) return;
    setSaving(true);
    setError(null);
    const body: AdminUserUpdate = {
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      phone: form.phone || null,
      profile: {
        ...Object.fromEntries(PROFILE_FIELDS.map((f) => [f.key, form[f.key] || null])),
      },
    };
    try {
      const updated = await updateAdminUser(user.id, body);
      setUser(updated);
      setEditing(false);
      onSaved(`Saved changes to ${updated.firstName} ${updated.lastName}`);
    } catch (err) {
      setError(err instanceof ApiError ? (err.fieldErrors[0]?.message ?? err.message) : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  const input = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-paca-500";
  const inputStyle = { background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" };
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const footer = user && canEdit && (
    <div className="flex flex-wrap items-center gap-3">
      {error && <span className="text-sm text-[#c0392b]">{error}</span>}
      <div className="ml-auto flex gap-2">
        {editing ? (
          <>
            <button onClick={() => setEditing(false)} className="rounded-lg border px-4 py-2 text-sm font-semibold" style={{ borderColor: "var(--border)" }}>
              Cancel
            </button>
            <button disabled={saving} onClick={() => void save()} className="rounded-lg bg-paca-500 px-5 py-2 text-sm font-semibold text-white hover:bg-paca-600 disabled:opacity-50">
              {saving ? "Saving…" : "Save changes"}
            </button>
          </>
        ) : (
          <button onClick={startEdit} className="rounded-lg bg-paca-500 px-5 py-2 text-sm font-semibold text-white hover:bg-paca-600">
            ✎ Edit profile
          </button>
        )}
      </div>
    </div>
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={user ? `${user.firstName} ${user.lastName}` : "User"}
      subtitle={user && `${user.email} · ${user.role} · ${user.status.replace(/_/g, " ").toLowerCase()}`}
      footer={footer || undefined}
    >
      {!user && !error && <p style={{ color: "var(--text-muted)" }}>Loading…</p>}
      {!user && error && <p className="text-[#c0392b]">{error}</p>}

      {user && editing && (
        <div className="space-y-5">
          <section>
            <h3 className="mb-3 text-sm font-bold">Account</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["firstName", "First name"],
                ["lastName", "Last name"],
                ["email", "Email"],
                ["phone", "Phone (with country code)"],
              ].map(([k, label]) => (
                <label key={k} className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {label}
                  <input value={form[k] ?? ""} onChange={set(k)} className={`${input} mt-1`} style={inputStyle} />
                </label>
              ))}
            </div>
          </section>
          <section>
            <h3 className="mb-3 text-sm font-bold">LinkedIn and bio</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {PROFILE_FIELDS.map((f) => (
                <label key={f.key} className={`text-xs ${f.wide ? "sm:col-span-2" : ""}`} style={{ color: "var(--text-muted)" }}>
                  {f.label}
                  {f.textarea ? (
                    <textarea rows={4} value={form[f.key] ?? ""} onChange={set(f.key)} className={`${input} mt-1`} style={inputStyle} />
                  ) : (
                    <input value={form[f.key] ?? ""} onChange={set(f.key)} className={`${input} mt-1`} style={inputStyle} />
                  )}
                </label>
              ))}
            </div>
          </section>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Changes are recorded in the activity log. Address, gender, education and work details are part of the
            member&apos;s application and are not repeated here — the member updates them through My applications.
          </p>
        </div>
      )}

      {user && !editing && (
        <div className="space-y-5">
          <MembershipPaymentPanel
            userId={user.id}
            membership={user.membership}
            canConfirm={canEdit}
            onConfirmed={(msg) => {
              onSaved(`${user.firstName} ${user.lastName}: ${msg}`);
              fetchAdminUser(userId).then(setUser).catch(() => undefined);
            }}
          />
          <section className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--bg)" }}>
            <h3 className="mb-3 text-sm font-bold">Account and membership</h3>
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              {[
                ["Phone", user.phone ?? "—"],
                ["Email verified", user.emailVerifiedAt ? fmtDate(user.emailVerifiedAt) : "Not yet"],
                ["Joined", fmtDate(user.createdAt)],
                ["Member ID", user.membership?.memberNumber ?? "—"],
                ["Membership", user.membership ? `${user.membership.tier} · ${user.membership.status.replace(/_/g, " ").toLowerCase()}` : "—"],
                ["Valid until", fmtDate(user.membership?.currentPeriodEnd)],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs" style={{ color: "var(--text-muted)" }}>{k}</dt>
                  <dd className="mt-0.5 font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--bg)" }}>
            <h3 className="mb-3 text-sm font-bold">LinkedIn and bio</h3>
            {user.profile ? (
              <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                {[
                  ...PROFILE_FIELDS.map((f) => [f.label, user.profile?.[f.key] || "—"]),
                  ["Listed in professional network", user.profile.isPublicInDirectory ? "Yes" : "No"],
                ].map(([k, v]) => (
                  <div key={String(k)} className={k === "Bio" ? "sm:col-span-2" : ""}>
                    <dt className="text-xs" style={{ color: "var(--text-muted)" }}>{k}</dt>
                    <dd className="mt-0.5 whitespace-pre-wrap break-words font-medium">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>No profile details saved yet.</p>
            )}
          </section>

          <section>
            <h3 className="mb-3 text-sm font-bold">Applications and documents ({user.applications.length})</h3>
            {user.applications.length === 0 && <p className="text-sm" style={{ color: "var(--text-muted)" }}>No applications.</p>}
            <div className="space-y-4">
              {user.applications.map((a) => (
                <details key={a.id} open={user.applications[0].id === a.id} className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--bg)" }}>
                  <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm font-semibold">
                    {a.tier.charAt(0) + a.tier.slice(1).toLowerCase()} application <StatusPill status={a.status} />
                    <span className="font-normal" style={{ color: "var(--text-muted)" }}>
                      submitted {fmtDate(a.submittedAt)}
                    </span>
                  </summary>
                  {a.decisionReason && (
                    <p className="mt-3 rounded-lg px-3 py-2 text-sm" style={{ background: "#fdf2d0", color: "#8a6100" }}>
                      Reviewer note to applicant: {a.decisionReason}
                    </p>
                  )}
                  <div className="mt-4">
                    <ApplicationAnswers form={a.form} answers={a.answers} />
                  </div>
                  <h4 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-paca-500">Documents</h4>
                  <DocumentViewer scope="admin" applicationId={a.id} documents={a.documents} labels={documentLabels(a.form)} />
                </details>
              ))}
            </div>
          </section>
        </div>
      )}
    </Modal>
  );
}
