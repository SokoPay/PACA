"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchMembershipStatus, type MembershipStatus } from "@/lib/api";
import { useSession } from "@/lib/useSession";

/**
 * Where a visitor is on the PACA journey, so every call-to-action shows the
 * right next step instead of "Join PACA" to people who already joined.
 */
export type JourneyStage = "guest" | "unverified" | "registered" | "applied" | "approved" | "member" | "staff";

const statusCache = new Map<string, Promise<MembershipStatus | null>>();

export function useJourney(): { stage: JourneyStage | undefined; status: MembershipStatus | null } {
  const user = useSession();
  const [status, setStatus] = useState<MembershipStatus | null | undefined>(undefined);

  useEffect(() => {
    if (!user || user.role !== "MEMBER" || !user.emailVerifiedAt) {
      setStatus(null);
      return;
    }
    let p = statusCache.get(user.id);
    if (!p) {
      p = fetchMembershipStatus().catch(() => null);
      statusCache.set(user.id, p);
      // Re-check after a while so a fresh approval or payment shows up.
      setTimeout(() => statusCache.delete(user.id), 60_000);
    }
    let live = true;
    p.then((s) => live && setStatus(s));
    return () => {
      live = false;
    };
  }, [user]);

  if (user === undefined) return { stage: undefined, status: null };
  if (!user) return { stage: "guest", status: null };
  if (user.role !== "MEMBER") return { stage: "staff", status: null };
  if (!user.emailVerifiedAt) return { stage: "unverified", status: null };
  if (status === undefined) return { stage: undefined, status: null };
  const kind = status?.nextAction.kind;
  if (status?.membership?.status === "ACTIVE") return { stage: "member", status };
  if (kind === "PAY") return { stage: "approved", status };
  if (kind === "AWAIT_REVIEW" || kind === "COMPLETE_DRAFT") return { stage: "applied", status };
  return { stage: "registered", status };
}

type Cta = { label: string; href: string } | null;

function defaultCta(stage: JourneyStage, status: MembershipStatus | null): Cta {
  switch (stage) {
    case "guest":
      return { label: "Join PACA", href: "/register" };
    case "unverified":
      return { label: "Verify your email", href: "/verify-email" };
    case "registered":
      return { label: "Become a member", href: "/membership" };
    case "applied":
      return status?.nextAction.kind === "COMPLETE_DRAFT"
        ? { label: "Finish my application", href: "/dashboard/applications" }
        : { label: "View my application", href: "/dashboard/applications" };
    case "approved":
      return { label: "Pay my membership", href: "/dashboard" };
    case "member":
      return status?.nextAction.kind === "SIT_EXAM"
        ? { label: "Take assessment", href: "/exam" }
        : { label: "Go to my dashboard", href: "/dashboard" };
    case "staff":
      return { label: "Open admin panel", href: "/admin" };
  }
}

/**
 * The main call-to-action button, adapted to the visitor:
 * guest → Join PACA · verified, not a member → Become a member · member → Take assessment.
 * `labels` overrides the text per stage; `null` hides the button for that stage.
 */
export function JourneyCta({
  className,
  labels = {},
}: {
  className?: string;
  labels?: Partial<Record<JourneyStage, string | null>>;
}) {
  const { stage, status } = useJourney();
  if (!stage) {
    // Hold the space without flashing the wrong button while the session loads.
    return (
      <span className={`${className ?? ""} invisible`} aria-hidden>
        {labels.guest ?? "Join PACA"}
      </span>
    );
  }
  if (labels[stage] === null) return null;
  const cta = defaultCta(stage, status);
  if (!cta) return null;
  return (
    <Link href={cta.href} className={className}>
      {labels[stage] ?? cta.label}
    </Link>
  );
}
