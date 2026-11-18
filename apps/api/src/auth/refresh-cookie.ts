/**
 * The refresh token lives ONLY in an httpOnly cookie:
 * - HttpOnly: page JavaScript can never read it, so an injected script cannot steal a session.
 * - SameSite=Strict: other sites cannot make the browser send it (blocks CSRF on refresh/logout).
 * - Secure on HTTPS: never sent over plain HTTP.
 * - Path=/api/v1/auth: only sent to the refresh and logout endpoints, not with every request.
 * The short-lived access token stays in page memory and is never stored.
 */
export const REFRESH_COOKIE = "paca_rt";
const COOKIE_PATH = "/api/v1/auth";

export function readCookie(header: string | string[] | undefined, name: string): string | null {
  const raw = Array.isArray(header) ? header.join("; ") : header;
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) {
      try {
        return decodeURIComponent(part.slice(i + 1).trim()) || null;
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function refreshCookie(token: string, expiresAt: Date, secure: boolean): string {
  const maxAge = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  return [
    `${REFRESH_COOKIE}=${encodeURIComponent(token)}`,
    `Path=${COOKIE_PATH}`,
    `Max-Age=${maxAge}`,
    "HttpOnly",
    "SameSite=Strict",
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}

export function clearRefreshCookie(secure: boolean): string {
  return [`${REFRESH_COOKIE}=`, `Path=${COOKIE_PATH}`, "Max-Age=0", "HttpOnly", "SameSite=Strict", ...(secure ? ["Secure"] : [])].join("; ");
}
