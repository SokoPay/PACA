import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { LEGAL_SLUGS } from "@/content/legal";
import { PARTNER_COURSES, PARTNER_INFO } from "@/lib/catalog";

/** Rebuilt hourly so new pages reach Google without a deploy. */
export const revalidate = 3600;

const TIERS = ["student", "professional", "executive", "fellow", "retired"];

/** /sitemap.xml — every public, indexable page. Submit it in Google Search Console. */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const page = (path: string, priority: number, changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] = "monthly") => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  });

  return [
    page("/", 1, "weekly"),
    page("/what-is-paca", 0.9),
    page("/membership", 0.9),
    ...TIERS.map((t) => page(`/membership/${t}`, 0.8)),
    page("/getting-started", 0.8),
    page("/events", 0.8, "weekly"),
    page("/courses", 0.7),
    ...PARTNER_INFO.map((p) => page(`/courses/partners/${p.slug}`, 0.6)),
    ...PARTNER_COURSES.map((c) => page(`/courses/partners/${c.partner}/${c.slug}`, 0.5)),
    page("/partners", 0.6),
    page("/community", 0.6),
    page("/directory", 0.5, "weekly"),
    page("/library", 0.5),
    page("/faq", 0.7),
    page("/assessment", 0.8),
    page("/register", 0.6),
    ...LEGAL_SLUGS.map((s) => page(`/legal/${s}`, 0.3, "yearly")),
  ];
}
