"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ApiError, checkPasswordReset, resetPassword } from "@/lib/api";
import { PasswordInput } from "@/components/PasswordInput";

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<"checking" | "invalid" | "ready" | "done">("checking");
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setState("invalid");
      return;
    }
    checkPasswordReset(token).then((r) => {
      setMaskedEmail(r.email ?? null);
      setState(r.valid ? "ready" : "invalid");
    });
  }, [token]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 12) return setError("Use at least 12 characters.");
    if (password !== confirm) return setError("The two passwords do not match.");
    setError(null);
    setBusy(true);
    try {
      await resetPassword(token, password);
      setState("done");
    } catch (err) {
      setError(err instanceof ApiError ? (err.fieldErrors[0]?.message ?? err.message) : "Could not reset your password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-sm rounded-xl border p-8" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <Link href="/" className="text-2xl font-bold tracking-tight text-paca-500">
        PACA
      </Link>

      {state === "checking" && <p className="mt-4 text-sm" style={{ color: "var(--text-muted)" }}>Checking your link…</p>}

      {state === "invalid" && (
        <div className="mt-4">
          <h1 className="text-lg font-semibold">This link has expired</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
            Reset links work once and expire after 30 minutes. Ask for a new one below.
          </p>
          <Link href="/forgot-password" className="mt-5 block rounded-lg bg-paca-500 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-paca-600">
            Send me a new link
          </Link>
        </div>
      )}

      {state === "ready" && (
        <>
          <h1 className="mt-1 text-lg font-semibold">Choose a new password</h1>
          {maskedEmail && (
            <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
              For the account {maskedEmail}
            </p>
          )}
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium">
                New password
              </label>
              <PasswordInput id="password" required minLength={12} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>At least 12 characters. A short phrase is easy to remember.</p>
            </div>
            <div>
              <label htmlFor="confirm" className="mb-1 block text-sm font-medium">
                Confirm new password
              </label>
              <PasswordInput id="confirm" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
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
              {busy ? "Saving…" : "Save new password"}
            </button>
          </form>
        </>
      )}

      {state === "done" && (
        <div className="mt-4">
          <div className="text-4xl">✅</div>
          <h1 className="mt-3 text-lg font-semibold">Password changed</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
            You have been signed out everywhere for safety. Sign in with your new password.
          </p>
          <Link href="/login" className="mt-5 block rounded-lg bg-paca-500 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-paca-600">
            Sign in
          </Link>
        </div>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Suspense fallback={<div className="text-sm">Loading…</div>}>
        <ResetForm />
      </Suspense>
    </main>
  );
}
