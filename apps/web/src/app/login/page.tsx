"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { login, ApiError } from "@/lib/api";
import { PasswordInput } from "@/components/PasswordInput";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const user = await login(email, password);

      // Only ever follow a same-site path, never an absolute URL — an open
      // redirect here would be a ready-made phishing vector.
      const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
      if (user.role === "MEMBER" && !user.emailVerifiedAt) {
        router.push(`/verify-email${safeNext ? `?next=${encodeURIComponent(safeNext)}` : ""}`);
        return;
      }
      router.push(safeNext ?? (user.role === "MEMBER" ? "/dashboard" : "/admin/queue"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sign in. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div
      className="w-full max-w-sm rounded-xl border p-8"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="mb-6">
        <Link href="/" className="text-2xl font-bold tracking-tight text-paca-500">
          PACA
        </Link>
        <h1 className="mt-1 text-lg font-semibold">Sign in</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          Access your membership, exams and benefits
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-paca-500"
            style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }}
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium">
            Password
          </label>
          <PasswordInput
            id="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm" style={{ color: "var(--text-muted)" }}>
        New to PACA?{" "}
        <Link href="/register" className="text-paca-500 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      {/* useSearchParams requires a Suspense boundary in the App Router. */}
      <Suspense fallback={<div className="text-sm">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
