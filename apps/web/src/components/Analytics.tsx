"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { getConsent, onConsentChange, type Consent } from "@/lib/consent";

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Google Analytics 4, loaded ONLY after the visitor accepts analytics cookies,
 * and only when NEXT_PUBLIC_GA_MEASUREMENT_ID is set. Private areas (admin,
 * dashboard, exams) are never tracked. Withdrawing consent switches it off.
 */
export function Analytics() {
  const pathname = usePathname() ?? "/";
  const [consent, setConsentState] = useState<Consent | null>(null);

  useEffect(() => {
    setConsentState(getConsent());
    return onConsentChange((c) => {
      setConsentState(c);
      window.gtag?.("consent", "update", { analytics_storage: c === "all" ? "granted" : "denied" });
    });
  }, []);

  const privateArea = /^\/(admin|dashboard|exam|assessment|apply|certificates|notifications|reset-password|verify-email)(\/|$)/.test(pathname);

  // Page views on client-side navigation.
  useEffect(() => {
    if (!GA_ID || consent !== "all" || privateArea || !window.gtag) return;
    window.gtag("event", "page_view", { page_path: pathname, page_location: window.location.href, page_title: document.title });
  }, [pathname, consent, privateArea]);

  if (!GA_ID || consent !== "all") return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
gtag('js', new Date());
gtag('config', '${GA_ID}', { send_page_view: false, anonymize_ip: true });
if (!/^\\/(admin|dashboard|exam|assessment|apply|certificates|notifications|reset-password|verify-email)(\\/|$)/.test(location.pathname)) {
  gtag('event', 'page_view', { page_path: location.pathname, page_location: location.href, page_title: document.title });
}`}
      </Script>
    </>
  );
}

/** Fire a GA4 event (e.g. a conversion on the thank-you page) when analytics is on. */
export function trackEvent(name: string, params: Record<string, unknown> = {}): void {
  if (typeof window !== "undefined" && window.gtag && getConsent() === "all") window.gtag("event", name, params);
}
