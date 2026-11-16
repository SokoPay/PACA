/** Lets the notifications page tell the header bell to refresh its unread count. */
const EVENT = "paca:notifications-changed";

export function notifyNotificationsChanged(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

export function onNotificationsChanged(fn: () => void): () => void {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}
