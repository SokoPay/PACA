"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchMyPartnerOffer, type MemberPartnerOffer } from "@/lib/api";
import { useSession } from "@/lib/useSession";

/**
 * The PACA member discount box on a partner course page. Visitors see the
 * public discount and how to unlock it; active members see their code.
 */
export function MemberOffer({
  partnerSlug,
  partnerName,
  publicPercent,
  courseUrl,
}: {
  partnerSlug: string;
  partnerName: string;
  publicPercent: number | null;
  courseUrl: string;
}) {
  const user = useSession();
  const [offer, setOffer] = useState<MemberPartnerOffer | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchMyPartnerOffer(partnerSlug).then(setOffer).catch(() => setOffer(null));
  }, [user, partnerSlug]);

  const pct = offer?.discountPercent ?? publicPercent;

  const takeButton = (
    <a
      href={courseUrl}
      target="_blank"
      rel="noreferrer"
      className="block w-full rounded-lg bg-paca-500 px-5 py-3 text-center text-sm font-semibold text-white hover:bg-paca-600"
    >
      Take this course on {partnerName} &#8599;
    </a>
  );

  return (
    <aside className="rounded-2xl border p-6" style={{ borderColor: pct ? "#2e9e5b" : "var(--border)", background: "var(--surface)" }}>
      <p className="text-xs font-semibold uppercase tracking-wider text-paca-500">PACA member offer</p>
      <p className="mt-2 text-2xl font-bold">{pct ? `${pct}% off` : "Discount coming soon"}</p>
      <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
        {pct
          ? `For PACA members with an active membership, on ${partnerName} courses.`
          : `We are agreeing a member discount with ${partnerName}. You can take the course now at the standard price.`}
      </p>

      <div className="mt-5 space-y-3">
        {user === undefined ? null : !user ? (
          <>
            {pct && (
              <p className="text-sm">
                <Link href="/register" className="font-semibold text-paca-500 hover:underline">
                  Join PACA
                </Link>{" "}
                or{" "}
                <Link href="/login" className="font-semibold text-paca-500 hover:underline">
                  sign in
                </Link>{" "}
                to get your discount code.
              </p>
            )}
            {takeButton}
          </>
        ) : offer && offer.eligible && pct ? (
          <>
            {offer.code ? (
              <div className="rounded-xl border-2 border-dashed p-4 text-center" style={{ borderColor: "#2e9e5b" }}>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Your discount code
                </p>
                <p className="mt-1 font-mono text-xl font-bold tracking-wider">{offer.code}</p>
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(offer.code!);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    } catch {
                      // Clipboard blocked — the code is visible to copy by hand.
                    }
                  }}
                  className="mt-2 text-xs font-semibold text-paca-500 hover:underline"
                >
                  {copied ? "Copied!" : "Copy code"}
                </button>
              </div>
            ) : null}
            {offer.note && (
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {offer.note}
              </p>
            )}
            {takeButton}
          </>
        ) : offer && !offer.eligible && pct ? (
          <>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Your discount code unlocks once your PACA membership is active (paid).
            </p>
            <Link
              href="/dashboard"
              className="block w-full rounded-lg border px-5 py-2.5 text-center text-sm font-semibold text-paca-500 hover:bg-paca-50"
              style={{ borderColor: "var(--color-paca-500)" }}
            >
              Complete my membership
            </Link>
            {takeButton}
          </>
        ) : (
          takeButton
        )}
      </div>
    </aside>
  );
}
