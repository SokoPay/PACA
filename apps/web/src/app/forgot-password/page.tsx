"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ApiError, requestPasswordReset } from "@/lib/api";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function ForgotForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!EMAIL_RE.test(clean)) {
      setError("Enter the full email address you registered with, e.g. name@example.com");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await requestPasswordReset(clean);
      setSentTo(clean);
    } catch (err) {
      setError(err instanceof ApiError ? (err.fieldErrors[0]?.message ?? err.message) : "Could not send the email. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-sm rounded-xl border p-8" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <Link href="/" className="text-2xl font-bold tracking-tight text-paca-500">
        PACA
      </Link>

      {sentTo ? (
        <div className="mt-4">
          <div className="text-4xl">📬</div>
          <h1 className="mt-3 text-lg font-semibold">Check your email</h1>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
            If <strong style={{ color: "var(--text)" }}>{sentTo}</strong> has a PACA account, we have sent it a link to
            reset your password. The link expires in 30 minutes.
          </p>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-xs" style={{ color: "var(--text-muted)" }}>
            <li>Look in your spam or promotions folder if it is not in your inbox.</li>
            <li>Make sure this is the email you registered with.</li>
            <li>You can ask for a new link after one minute.</li>
          </ul>
          <button
            onClick={() => setSentTo(null)}
            className="mt-5 w-full rounded-lg border px-4 py-2 text-sm font-semibold"
            style={{ borderColor: "var(--border)" }}
          >
            Use a different email
          </button>
        </div>
      ) : (
        <>
          <h1 className="mt-1 text-lg font-semibold">Forgot your password?</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            Enter the email you registered with and we will send you a link to choose a new password.
          </p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-paca-500"
                style={{ background: "var(--bg)", borderColor: error ? "#c0392b" : "var(--border)", color: "var(--text)" }}
              />
            </div>
            {error && (
              <p role="alert" className="rounded-lg px-3 py-2 text-sm" style={{ background: "#c0392b1a", color: "#c0392b" }}>
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-paca-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-paca-600 disabled:opacity-60"
            >
              {busy ? "Sending…" : "Send reset link"}
            </button>
          </form>
        </>
      )}

      <p className="mt-5 text-center text-sm" style={{ color: "var(--text-muted)" }}>
        Remembered it?{" "}
        <Link href="/login" className="text-paca-500 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Suspense fallback={<div className="text-sm">Loading…</div>}>
        <ForgotForm />
      </Suspense>
    </main>
  );
}
