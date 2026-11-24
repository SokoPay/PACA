"use client";

import { usePathname } from "next/navigation";
import { JourneyCta } from "./JourneyCta";

/** Pages where a floating call-to-action would get in the way of the task at hand. */
const HIDDEN = /^\/(dashboard|exam|assessment|apply|certificates|notifications|thank-you|login|register|forgot-password|reset-password|verify-email)(\/|$)/;

/**
 * A call-to-action pinned to the bottom of the screen on phones, so the next step
 * (Join PACA, Become a member, Take assessment…) is always one tap away. Hidden on
 * tablets and desktops, where the header and hero already show it.
 */
export function StickyMobileCta() {
  const pathname = usePathname() ?? "/";
  if (HIDDEN.test(pathname)) return null;
  return (
    <>
      {/* spacer so the bar never covers the end of the page */}
      <div className="h-20 sm:hidden" aria-hidden />
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t px-4 py-3 sm:hidden"
        style={{ background: "color-mix(in srgb, var(--surface) 94%, transparent)", borderColor: "var(--border)", backdropFilter: "blur(8px)" }}
      >
        <JourneyCta
          labels={{ staff: null }}
          className="block w-full rounded-xl bg-paca-500 px-5 py-3 text-center text-sm font-semibold text-white shadow-lg hover:bg-paca-600"
        />
      </div>
    </>
  );
}
