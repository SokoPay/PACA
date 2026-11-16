"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, TIER_LABEL, fetchNetwork, restoreSession, type NetworkMember } from "@/lib/api";
import { badgeFor } from "@/lib/brand";
import { MemberGate } from "@/components/MemberGate";

export default function NetworkPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(false);
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<NetworkMember[] | null>(null);

  useEffect(() => {
    (async () => {
      if (!(await restoreSession())) {
        router.replace("/login?next=/dashboard/network");
        return;
      }
      setReady(true);
    })();
  }, [router]);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      fetchNetwork(q.trim() || undefined)
        .then(setPeople)
        .catch((err) => {
          if (err instanceof ApiError && err.status === 403) setLocked(true);
        });
    }, 250);
    return () => clearTimeout(t);
  }, [ready, q]);

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <Link href="/dashboard" className="text-sm text-paca-500 hover:underline">&larr; Dashboard</Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Professional network</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
            Connect with PACA members across Africa. Only paid members who chose to be listed appear here.
          </p>
        </div>
        <Link href="/dashboard/profile" className="rounded-xl border px-4 py-2 text-sm font-semibold hover:border-paca-500" style={{ borderColor: "var(--border)" }}>
          Edit my listing
        </Link>
      </div>

      {locked ? (
        <div className="mt-8"><MemberGate feature="The professional network" /></div>
      ) : (
        <>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name"
            className="mt-6 w-full rounded-xl border px-4 py-2.5 text-sm outline-none focus:border-paca-500"
            style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
          />
          {!people && <p className="mt-8 text-sm" style={{ color: "var(--text-muted)" }}>Loading…</p>}
          {people?.length === 0 && (
            <p className="mt-8 rounded-2xl border p-8 text-center text-sm" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
              No members listed yet. Be the first — turn on &ldquo;List me in the professional network&rdquo; in your profile.
            </p>
          )}
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {people?.map((p) => {
              const badge = p.tier ? badgeFor(p.tier) : undefined;
              return (
                <div key={`${p.memberNumber}-${p.name}`} className="flex flex-col rounded-2xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                  <div className="flex items-center gap-3">
                    {badge ? (
                      <Image src={badge.image} alt="" width={56} height={47} className="h-[47px] w-14 rounded-lg object-contain" />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-paca-500 font-bold text-white">{p.name.charAt(0)}</div>
                    )}
                    <div className="min-w-0">
                      <h2 className="truncate font-semibold">{p.name}</h2>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>{p.tier ? TIER_LABEL[p.tier] : "Member"}</p>
                    </div>
                  </div>
                  {(p.occupation || p.employer) && (
                    <p className="mt-3 text-sm">{[p.occupation, p.employer].filter(Boolean).join(" at ")}</p>
                  )}
                  {(p.city || p.country) && (
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{[p.city, p.country].filter(Boolean).join(", ")}</p>
                  )}
                  {p.bio && <p className="mt-2 line-clamp-3 text-sm" style={{ color: "var(--text-muted)" }}>{p.bio}</p>}
                  <div className="mt-auto flex gap-3 pt-4 text-sm font-semibold">
                    {p.linkedinUrl && (
                      <a href={p.linkedinUrl} target="_blank" rel="noreferrer" className="text-paca-500 hover:underline">LinkedIn &#8599;</a>
                    )}
                    {p.memberNumber && (
                      <Link href={`/members/${p.memberNumber}`} className="text-paca-500 hover:underline">Badge</Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
