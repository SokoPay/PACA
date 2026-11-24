import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

/** /robots.txt — public pages are crawlable; private and account areas are not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/dashboard",
          "/exam",
          "/apply",
          "/certificates",
          "/notifications",
          "/thank-you",
          "/login",
          "/forgot-password",
          "/reset-password",
          "/verify-email",
          "/api/",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
