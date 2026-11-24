/**
 * Cookie consent. Essential storage (sign-in, consent itself) is always allowed;
 * analytics runs only after the visitor accepts it. The choice lives in
 * localStorage and every part of the page listens for changes.
 */
export type Consent = "all" | "essential";

const KEY = "paca.consent";
const EVENT = "paca:consent";
const OPEN_EVENT = "paca:consent-open";

export function getConsent(): Consent | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "all" || v === "essential" ? v : null;
  } catch {
    return null;
  }
}

export function setConsent(c: Consent): void {
  try {
    localStorage.setItem(KEY, c);
  } catch {
    // storage blocked: the choice lasts for this page only
  }
  window.dispatchEvent(new CustomEvent<Consent>(EVENT, { detail: c }));
}

export function onConsentChange(fn: (c: Consent) => void): () => void {
  const handler = (e: Event) => fn((e as CustomEvent<Consent>).detail);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

/** Re-open the banner (footer "Cookie settings"). */
export function openConsentSettings(): void {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function onConsentOpen(fn: () => void): () => void {
  window.addEventListener(OPEN_EVENT, fn);
  return () => window.removeEventListener(OPEN_EVENT, fn);
}
