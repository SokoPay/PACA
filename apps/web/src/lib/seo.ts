import type { Metadata } from "next";

/** Public origin used for canonical URLs, the sitemap and social cards. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://pac-a.org").replace(/\/$/, "");
export const SITE_NAME = "PACA — Professional Agile Certification, Africa";

/** The default 1200×630 social card (app/opengraph-image.tsx). */
const OG_IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: SITE_NAME };

/**
 * Per-page metadata: a unique title and description, a canonical URL (so Google
 * indexes one address per page) and matching Open Graph / Twitter text.
 * Private pages (dashboard, admin, exams, sign-in) pass `noindex`.
 */
export function pageMeta(
  title: string,
  description: string,
  path: string,
  opts: { noindex?: boolean; absoluteTitle?: boolean } = {},
): Metadata {
  return {
    title: opts.absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, siteName: SITE_NAME, type: "website", images: [OG_IMAGE] },
    twitter: { card: "summary_large_image", title, description, images: [OG_IMAGE.url] },
    ...(opts.noindex ? { robots: { index: false, follow: false, nocache: true } } : {}),
  };
}

/** Private, signed-in or one-off pages: unique title, but never in search results. */
export const privateMeta = (title: string, description: string, path: string): Metadata =>
  pageMeta(title, description, path, { noindex: true });
