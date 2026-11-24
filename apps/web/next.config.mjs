/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV !== "production";
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4100/api/v1";
// Absolute API address in development; in production the API is same-origin (/api/v1).
const apiOrigin = /^https?:\/\//.test(apiUrl) ? new URL(apiUrl).origin : "";
// Paystack's checkout popup (card / mobile money / bank) is the only third-party code.
const paystack = "https://*.paystack.co https://*.paystack.com";
// Google Analytics 4 (loaded only after cookie consent).
const ga = "https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com";

/**
 * Browser protections for every page:
 * - Content-Security-Policy: scripts only from this site and Paystack, no plugins,
 *   no other site may frame PACA, forms only post back to PACA.
 * - Strict-Transport-Security: browsers always use HTTPS for a year.
 * - X-Frame-Options / frame-ancestors: blocks clickjacking.
 * - nosniff, a strict referrer policy and a Permissions-Policy that switches off
 *   camera, microphone, location and other device features PACA never uses.
 * 'unsafe-inline' scripts are required by Next.js's own inline bootstrapping.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval' " : ""}${paystack} https://www.googletagmanager.com`,
  `style-src 'self' 'unsafe-inline' ${paystack}`,
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${apiOrigin} ${paystack} ${ga}${isDev ? " ws: http://localhost:* http://127.0.0.1:*" : ""}`.replace(/\s+/g, " "),
  `frame-src 'self' blob: ${paystack}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), usb=(), serial=(), bluetooth=(), payment=(self), interest-cohort=()",
  },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Badge and partner images are small static JPEGs; serving them as-is avoids
  // running the image optimiser (and its memory use) on the shared droplet.
  images: { unoptimized: true },
  // The admin UI talks to the API directly; no server-side proxying needed yet.
  env: {
    NEXT_PUBLIC_API_URL: apiUrl,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? "https://pac-a.org",
    NEXT_PUBLIC_GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "",
    NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ?? "",
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Signed-in pages must not be kept in shared or back-button caches.
      {
        source: "/(dashboard|admin|exam|assessment|certificates|notifications|apply)/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};
export default nextConfig;
