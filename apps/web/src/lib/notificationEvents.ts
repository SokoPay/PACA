/** Small event bus between the notification bell/modal and the pages that affect them. */
const CHANGED = "paca:notifications-changed";
const OPEN = "paca:notifications-open";

export function notifyNotificationsChanged(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGED));
}

export function onNotificationsChanged(fn: () => void): () => void {
  window.addEventListener(CHANGED, fn);
  return () => window.removeEventListener(CHANGED, fn);
}

/** Open the notifications pop-up from anywhere (e.g. the dashboard on first visit). */
export function openNotifications(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(OPEN));
}

export function onOpenNotifications(fn: () => void): () => void {
  window.addEventListener(OPEN, fn);
  return () => window.removeEventListener(OPEN, fn);
}
