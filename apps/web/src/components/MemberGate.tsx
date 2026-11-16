"use client";

import Link from "next/link";

/** Shown in place of a paid-member feature to signed-in users without an active membership. */
export function MemberGate({ feature, children }: { feature: string; children?: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-3xl border" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="paca-gradient px-8 py-10 text-center text-white">
        <p className="text-4xl" aria-hidden>
          &#128274;
        </p>
        <h2 className="mt-3 text-2xl font-bold">{feature} is a paid-member benefit</h2>
        <p className="mx-auto mt-2 max-w-md text-white/90">
          It unlocks as soon as your PACA membership payment is complete — together with your badge, certification exam,
          study library and member discounts.
        </p>
        <Link href="/dashboard" className="mt-6 inline-block rounded-xl bg-white px-6 py-3 text-sm font-bold text-paca-600">
          Complete my membership
        </Link>
      </div>
      {children && <div className="p-6">{children}</div>}
    </section>
  );
}
