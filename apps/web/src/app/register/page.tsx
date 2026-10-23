"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError, login, register } from "@/lib/api";

function RegisterForm() {
  const router = useRouter();
  const next = useSearchParams().get("next");

  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", password: "" });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  function set(name: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    if (!acceptedTerms) {
      setFieldErrors({ acceptedTerms: "You must accept the Terms and Privacy Policy to register" });
      return;
    }

    setBusy(true);
    try {
      await register({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        password: form.password,
        acceptedTerms: true,
        marketingOptIn,
      });

      // Sign the new member straight in — an extra login step here loses people.
      await login(form.email.trim(), form.password);
      const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
      router.push(safeNext ?? "/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        const mapped: Record<string, string> = {};
        for (const fe of err.fieldErrors) mapped[fe.field] = fe.message;
        setFieldErrors(mapped);
      } else {
        setError("Could not create your account. Please try again.");
      }
      setBusy(false);
    }
  }

  const input = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-paca-500";
  const inputStyle = { background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" };

  return (
    <div
      className="w-full max-w-md rounded-xl border p-8"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <Link href="/" className="text-2xl font-bold tracking-tight text-paca-500">
        PACA
      </Link>
      <h1 className="mt-1 text-lg font-semibold">Create your account</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
        Registration is free. You only pay once your membership application is approved.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="firstName" className="mb-1 block text-sm font-medium">
              First name
            </label>
            <input id="firstName" required value={form.firstName} onChange={(e) => set("firstName", e.target.value)} className={input} style={inputStyle} />
          </div>
          <div>
            <label htmlFor="lastName" className="mb-1 block text-sm font-medium">
              Last name
            </label>
            <input id="lastName" required value={form.lastName} onChange={(e) => set("lastName", e.target.value)} className={input} style={inputStyle} />
          </div>
        </div>

        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium">
            Email
          </label>
          <input id="email" type="email" required autoComplete="username" value={form.email} onChange={(e) => set("email", e.target.value)} className={input} style={inputStyle} />
          {fieldErrors.email && <p className="mt-1 text-xs" style={{ color: "#c0392b" }}>{fieldErrors.email}</p>}
        </div>

        <div>
          <label htmlFor="phone" className="mb-1 block text-sm font-medium">
            Phone <span style={{ color: "var(--text-muted)" }}>(optional)</span>
          </label>
          <input id="phone" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} className={input} style={inputStyle} />
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium">
            Password
          </label>
          <input id="password" type="password" required autoComplete="new-password" minLength={12} value={form.password} onChange={(e) => set("password", e.target.value)} className={input} style={inputStyle} />
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            At least 12 characters. Length matters more than symbols.
          </p>
          {fieldErrors.password && <p className="mt-1 text-xs" style={{ color: "#c0392b" }}>{fieldErrors.password}</p>}
        </div>

        {/*
          Two separate consents. Bundling marketing into the Terms checkbox is not
          freely-given consent under GDPR, and PACA handles CVs and ID documents.
        */}
        <label className="flex gap-2.5 text-sm">
          <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} className="mt-0.5" />
          <span>
            I accept the{" "}
            <Link href="/legal/terms" className="text-paca-500 hover:underline" target="_blank">
              Terms &amp; Conditions
            </Link>{" "}
            and{" "}
            <Link href="/legal/privacy" className="text-paca-500 hover:underline" target="_blank">
              Privacy Policy
            </Link>
          </span>
        </label>
        {fieldErrors.acceptedTerms && <p className="text-xs" style={{ color: "#c0392b" }}>{fieldErrors.acceptedTerms}</p>}

        <label className="flex gap-2.5 text-sm">
          <input type="checkbox" checked={marketingOptIn} onChange={(e) => setMarketingOptIn(e.target.checked)} className="mt-0.5" />
          <span style={{ color: "var(--text-muted)" }}>
            Email me about PACA courses, events and partner offers. Optional, and you can withdraw at any time.
          </span>
        </label>

        {error && (
          <p role="alert" className="rounded-lg px-3 py-2 text-sm" style={{ background: "#c0392b1a", color: "#c0392b" }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-paca-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-paca-600 disabled:opacity-60"
        >
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm" style={{ color: "var(--text-muted)" }}>
        Already registered?{" "}
        <Link href="/login" className="text-paca-500 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <Suspense fallback={<div className="text-sm">Loading…</div>}>
        <RegisterForm />
      </Suspense>
    </main>
  );
}
