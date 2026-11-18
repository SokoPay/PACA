"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError, resendVerificationCode, restoreSession, verifyEmail, type SessionUser } from "@/lib/api";

function VerifyEmailForm() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : "/dashboard";

  const [user, setUser] = useState<SessionUser | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(60);

  useEffect(() => {
    (async () => {
      const session = await restoreSession();
      if (!session) {
        router.replace(`/login?next=${encodeURIComponent("/verify-email")}`);
        return;
      }
      if (session.emailVerifiedAt) {
        router.replace(safeNext);
        return;
      }
      setUser(session);
    })();
  }, [router, safeNext]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await verifyEmail(code.trim());
      router.replace(safeNext);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not verify the code. Please try again.");
      setBusy(false);
    }
  }

  async function onResend() {
    setError(null);
    setNotice(null);
    try {
      const { sentTo } = await resendVerificationCode();
      setNotice(`A new code is on its way to ${sentTo}.`);
      setCode("");
      setCooldown(60);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send a new code. Please try again.");
    }
  }

  if (!user) return <div className="text-sm">Loading…</div>;

  return (
    <div className="w-full max-w-md rounded-xl border p-8" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <Link href="/" className="text-2xl font-bold tracking-tight text-paca-500">
        PACA
      </Link>
      <h1 className="mt-1 text-lg font-semibold">Verify your email</h1>
      <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
        We sent a 6-digit code to <strong style={{ color: "var(--text)" }}>{user.email}</strong>. Enter it below. The code
        expires in 15 minutes. Check your spam folder if you can&rsquo;t see it.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="code" className="mb-1 block text-sm font-medium">
            Verification code
          </label>
          <input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="w-full rounded-lg border px-3 py-3 text-center font-mono text-2xl tracking-[0.5em] outline-none focus:border-paca-500"
            style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }}
            placeholder="••••••"
          />
        </div>

        {error && (
          <p role="alert" className="rounded-lg px-3 py-2 text-sm" style={{ background: "#c0392b1a", color: "#c0392b" }}>
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="rounded-lg px-3 py-2 text-sm" style={{ background: "var(--color-paca-50)", color: "var(--color-paca-800)" }}>
            {notice}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || code.length !== 6}
          className="w-full rounded-lg bg-paca-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-paca-600 disabled:opacity-60"
        >
          {busy ? "Verifying…" : "Verify email"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm" style={{ color: "var(--text-muted)" }}>
        Didn&rsquo;t get it?{" "}
        <button onClick={onResend} disabled={cooldown > 0} className="text-paca-500 hover:underline disabled:no-underline disabled:opacity-60">
          {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        </button>
      </p>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <Suspense fallback={<div className="text-sm">Loading…</div>}>
        <VerifyEmailForm />
      </Suspense>
    </main>
  );
}
