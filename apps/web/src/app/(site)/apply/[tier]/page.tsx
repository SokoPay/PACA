"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ApiError,
  deleteApplicationDocument,
  fetchTiers,
  formatUsd,
  restoreSession,
  saveApplicationDraft,
  submitApplication,
  uploadApplicationDocument,
  viewApplicationDocument,
  type ApplicationDocumentView,
  type FieldDef,
  type TierInfo,
} from "@/lib/api";

type Answers = Record<string, string>;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ApplyPage({ params }: { params: Promise<{ tier: string }> }) {
  const { tier: slug } = use(params);
  const tierKey = slug.toUpperCase();
  const router = useRouter();

  const [tier, setTier] = useState<TierInfo | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [documents, setDocuments] = useState<ApplicationDocumentView[]>([]);
  const [uploadingKind, setUploadingKind] = useState<string | null>(null);
  const [docError, setDocError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    (async () => {
      const session = await restoreSession();
      if (!session) {
        // Preserve intent so the applicant lands back here after signing in.
        router.replace(`/login?next=${encodeURIComponent(`/apply/${slug}`)}`);
        return;
      }
      try {
        const tiers = await fetchTiers();
        const found = tiers.find((t) => t.tier === tierKey) ?? null;
        if (!found) {
          setError("That membership type does not exist.");
        } else {
          setTier(found);
        }
      } catch {
        setError("Could not load the application form. Please try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, [router, slug, tierKey]);

  const setField = useCallback((name: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  /** Client-side check mirroring the server's required rules, for fast feedback. */
  function validateStep(fields: FieldDef[]): boolean {
    const errs: Record<string, string> = {};
    for (const f of fields) {
      const v = (answers[f.name] ?? "").trim();
      if (f.required && !v) errs[f.name] = `${f.label} is required`;
      else if (v && f.type === "number") {
        const n = Number(v);
        if (!Number.isFinite(n)) errs[f.name] = "Enter a number";
        else if (f.min !== undefined && n < f.min) errs[f.name] = `Must be ${f.min} or more`;
        else if (f.max !== undefined && n > f.max) errs[f.name] = `Must be ${f.max} or less`;
      } else if (v && f.type === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) {
        errs[f.name] = "Enter a valid email address";
      }
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function saveAndAdvance() {
    if (!tier) return;
    const section = tier.form.sections[step];
    if (!validateStep(section.fields)) return;

    setSaving(true);
    setError(null);
    try {
      const draft = await saveApplicationDraft(tier.tier, answers);
      setApplicationId(draft.id);
      setDocuments(draft.documents);
      setStep((s) => Math.min(s + 1, tier.form.sections.length));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save your progress.");
    } finally {
      setSaving(false);
    }
  }

  async function doSubmit() {
    if (!tier || !applicationId) return;
    setSaving(true);
    setError(null);
    setFieldErrors({});
    try {
      await submitApplication(applicationId);
      setSubmitted(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        // Server-side field errors take precedence — they are authoritative.
        const mapped: Record<string, string> = {};
        for (const fe of err.fieldErrors) mapped[fe.field] = fe.message;
        setFieldErrors(mapped);
      } else {
        setError("Could not submit your application.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(kind: string, file: File) {
    if (!applicationId) return;
    setUploadingKind(kind);
    setDocError(null);
    try {
      const doc = await uploadApplicationDocument(applicationId, kind, file);
      setDocuments((prev) => [...prev.filter((d) => d.kind !== kind), doc]);
      setFieldErrors((prev) => {
        if (!prev.documents) return prev;
        const next = { ...prev };
        delete next.documents;
        return next;
      });
    } catch (err) {
      setDocError(err instanceof ApiError ? err.message : "Could not upload this file.");
    } finally {
      setUploadingKind(null);
    }
  }

  async function handleRemoveDocument(doc: ApplicationDocumentView) {
    if (!applicationId) return;
    setUploadingKind(doc.kind);
    setDocError(null);
    try {
      await deleteApplicationDocument(applicationId, doc.id);
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (err) {
      setDocError(err instanceof ApiError ? err.message : "Could not remove this file.");
    } finally {
      setUploadingKind(null);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-[50vh] items-center justify-center text-sm" style={{ color: "var(--text-muted)" }}>
        Loading…
      </main>
    );
  }

  if (!tier) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-20">
        <p className="rounded-lg px-4 py-3 text-sm" style={{ background: "#c0392b1a", color: "#c0392b" }}>
          {error ?? "That membership type does not exist."}
        </p>
        <Link href="/membership" className="mt-4 inline-block text-sm text-paca-500 hover:underline">
          &larr; Back to membership
        </Link>
      </main>
    );
  }

  if (submitted) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-20 text-center">
        <div className="text-5xl">&#10003;</div>
        <h1 className="mt-4 text-2xl font-bold">Application submitted</h1>
        <p className="mt-3 leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Your {tier.displayName} application is with the review panel. We will email you when there is a decision.
          You will only be asked to pay the {formatUsd(tier.priceUsdCents)} subscription once you are approved.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-block rounded-lg bg-paca-500 px-6 py-3 text-sm font-semibold text-white hover:bg-paca-600"
        >
          Go to your dashboard
        </Link>
      </main>
    );
  }

  const totalSteps = tier.form.sections.length + 1; // + documents/review step
  const onReviewStep = step >= tier.form.sections.length;
  const section = onReviewStep ? null : tier.form.sections[step];

  return (
    <main className="mx-auto max-w-2xl px-5 py-14">
      <Link href={`/membership/${slug}`} className="text-sm text-paca-500 hover:underline">
        &larr; {tier.displayName}
      </Link>

      <h1 className="mt-3 text-2xl font-bold tracking-tight">Apply for {tier.displayName}</h1>

      {/* progress */}
      <div className="mt-6 flex gap-1.5" aria-label={`Step ${step + 1} of ${totalSteps}`}>
        {Array.from({ length: totalSteps }, (_, i) => (
          <div
            key={i}
            className="h-1.5 flex-1 rounded-full"
            style={{ background: i <= step ? "var(--color-paca-500)" : "var(--border)" }}
          />
        ))}
      </div>
      <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
        Step {step + 1} of {totalSteps}
        {section ? ` · ${section.title}` : " · Documents and review"}
      </p>

      {error && (
        <p role="alert" className="mt-6 rounded-lg px-4 py-3 text-sm" style={{ background: "#c0392b1a", color: "#c0392b" }}>
          {error}
        </p>
      )}

      {section ? (
        <form
          className="mt-8 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            void saveAndAdvance();
          }}
        >
          {section.fields.map((f) => (
            <Field key={f.name} field={f} value={answers[f.name] ?? ""} error={fieldErrors[f.name]} onChange={setField} />
          ))}

          <div className="flex items-center gap-3 pt-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="rounded-lg border px-4 py-2.5 text-sm font-semibold"
                style={{ borderColor: "var(--border)" }}
              >
                Back
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-paca-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-paca-600 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save and continue"}
            </button>
          </div>
        </form>
      ) : (
        <section className="mt-8">
          <h2 className="font-semibold">Supporting documents</h2>
          <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
            Your application needs the following. Uploads are stored privately and shared only with the review panel.
          </p>

          {docError && (
            <p role="alert" className="mt-3 rounded-lg px-3 py-2 text-sm" style={{ background: "#c0392b1a", color: "#c0392b" }}>
              {docError}
            </p>
          )}

          <ul className="mt-4 space-y-2">
            {tier.form.documents.map((d) => {
              const uploaded = documents.find((doc) => doc.kind === d.kind);
              const busy = uploadingKind === d.kind;
              return (
                <li
                  key={d.kind}
                  className="rounded-lg border px-4 py-3 text-sm"
                  style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">
                      {d.label}
                      {d.required && <span className="text-paca-500"> *</span>}
                    </span>

                    {uploaded ? (
                      <div className="flex items-center gap-3 text-xs">
                        <button
                          type="button"
                          onClick={() => void viewApplicationDocument(applicationId!, uploaded.id)}
                          className="text-paca-500 hover:underline"
                        >
                          {uploaded.originalName} ({formatBytes(uploaded.sizeBytes)})
                        </button>
                        <label className="cursor-pointer underline underline-offset-2" style={{ color: "var(--text-muted)" }}>
                          {busy ? "Uploading…" : "Replace"}
                          <input
                            type="file"
                            accept="application/pdf,image/jpeg,image/png"
                            className="hidden"
                            disabled={busy}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) void handleUpload(d.kind, file);
                              e.target.value = "";
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleRemoveDocument(uploaded)}
                          className="underline underline-offset-2"
                          style={{ color: "#c0392b" }}
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <label
                        className="cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-semibold"
                        style={{ borderColor: "var(--color-paca-500)", color: "var(--color-paca-500)" }}
                      >
                        {busy ? "Uploading…" : "Upload"}
                        <input
                          type="file"
                          accept="application/pdf,image/jpeg,image/png"
                          className="hidden"
                          disabled={busy}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void handleUpload(d.kind, file);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    )}
                  </div>
                  {d.help && (
                    <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                      {d.help}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>

          {fieldErrors.documents && (
            <p className="mt-3 text-sm" style={{ color: "#c0392b" }}>
              {fieldErrors.documents}
            </p>
          )}

          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="rounded-lg border px-4 py-2.5 text-sm font-semibold"
              style={{ borderColor: "var(--border)" }}
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => void doSubmit()}
              disabled={saving || !applicationId}
              className="rounded-lg bg-paca-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-paca-600 disabled:opacity-60"
            >
              {saving ? "Submitting…" : "Submit application"}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}

function Field({
  field,
  value,
  error,
  onChange,
}: {
  field: FieldDef;
  value: string;
  error?: string;
  onChange: (name: string, value: string) => void;
}) {
  const base = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-paca-500";
  const style = {
    background: "var(--bg)",
    borderColor: error ? "#c0392b" : "var(--border)",
    color: "var(--text)",
  };

  return (
    <div>
      <label htmlFor={field.name} className="mb-1 block text-sm font-medium">
        {field.label}
        {field.required && <span className="text-paca-500"> *</span>}
      </label>

      {field.type === "textarea" ? (
        <textarea
          id={field.name}
          rows={4}
          maxLength={field.maxLength}
          value={value}
          onChange={(e) => onChange(field.name, e.target.value)}
          className={base}
          style={style}
        />
      ) : field.type === "select" ? (
        <select
          id={field.name}
          value={value}
          onChange={(e) => onChange(field.name, e.target.value)}
          className={base}
          style={style}
        >
          <option value="">Select…</option>
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={field.name}
          type={field.type === "number" ? "number" : field.type === "email" ? "email" : "text"}
          maxLength={field.maxLength}
          min={field.min}
          max={field.max}
          value={value}
          onChange={(e) => onChange(field.name, e.target.value)}
          className={base}
          style={style}
        />
      )}

      {field.help && !error && (
        <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
          {field.help}
        </p>
      )}
      {error && (
        <p className="mt-1 text-xs" style={{ color: "#c0392b" }}>
          {error}
        </p>
      )}
    </div>
  );
}
