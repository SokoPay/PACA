import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { IdleLogout } from "@/components/IdleLogout";
import { CookieBanner } from "@/components/CookieBanner";
import { Analytics } from "@/components/Analytics";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });

const DESCRIPTION =
  "PACA sets benchmark standards for the Agile profession in Africa: certification, membership, study resources, jobs and a professional network.";

export const metadata: Metadata = {
  // Absolute base for canonical URLs and Open Graph images.
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: "%s · PACA" },
  description: DESCRIPTION,
  applicationName: "PACA",
  keywords: ["Agile certification Africa", "Scrum certification", "Kanban", "Agile membership", "Scrum Master", "Product Owner", "PACA"],
  // No canonical here: it would be inherited by every page. Pages set their own (lib/seo.ts pageMeta).
  openGraph: { siteName: SITE_NAME, type: "website", locale: "en_GB", title: SITE_NAME, description: DESCRIPTION },
  twitter: { card: "summary_large_image", title: SITE_NAME, description: DESCRIPTION },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  // Google Search Console ownership check (Settings → Ownership verification → HTML tag).
  ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION } }
    : {}),
};

export const viewport: Viewport = {
  themeColor: "#0060cc",
  width: "device-width",
  initialScale: 1,
};

/** Tells Google who PACA is and what the site is (rich results, knowledge panel). */
const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Professional Agile Certification, Africa (PACA)",
      alternateName: "PACA",
      url: SITE_URL,
      logo: `${SITE_URL}/icons/512`,
      description: DESCRIPTION,
      areaServed: "Africa",
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: "en",
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }} />
        {children}
        <IdleLogout />
        <CookieBanner />
        <Analytics />
      </body>
    </html>
  );
}
