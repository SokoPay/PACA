/**
 * Shared activity state for the 30-minute idle sign-out.
 *
 * - The last-activity time is kept in localStorage so activity in ANY open tab
 *   keeps the member signed in everywhere.
 * - While an exam or test is open on screen, the member is never treated as idle.
 */
export const IDLE_LIMIT_MS = 30 * 60_000;
export const IDLE_WARNING_MS = 2 * 60_000;
const LAST_ACTIVE_KEY = "paca.lastActive";

let examsOpen = 0;

/** Call when an exam or test attempt is shown; returns the function to call when it closes. */
export function beginExamSession(): () => void {
  examsOpen++;
  markActive(true);
  let ended = false;
  return () => {
    if (ended) return;
    ended = true;
    examsOpen = Math.max(0, examsOpen - 1);
    markActive(true);
  };
}

export function examInProgress(): boolean {
  return examsOpen > 0;
}

let lastWrite = 0;

export function markActive(force = false): void {
  const now = Date.now();
  if (!force && now - lastWrite < 10_000) return; // throttle storage writes
  lastWrite = now;
  try {
    localStorage.setItem(LAST_ACTIVE_KEY, String(now));
  } catch {
    // storage blocked — fall back to this tab's memory
  }
  memoryLastActive = now;
}

let memoryLastActive = Date.now();

export function lastActiveAt(): number {
  try {
    const v = Number(localStorage.getItem(LAST_ACTIVE_KEY));
    if (Number.isFinite(v) && v > 0) return Math.max(v, memoryLastActive);
  } catch {
    // ignore
  }
  return memoryLastActive;
}
