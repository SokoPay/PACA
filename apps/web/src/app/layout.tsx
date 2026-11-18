import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { IdleLogout } from "@/components/IdleLogout";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });

export const metadata: Metadata = {
  // Absolute base for Open Graph images, so shared links show their preview card.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://pac-a.org"),
  title: {
    default: "PACA — Professional Agile Certification, Africa",
    template: "%s · PACA",
  },
  description:
    "PACA sets benchmark standards for the Agile profession in Africa: certification, membership, study resources, jobs and a professional network.",
  openGraph: { siteName: "PACA — Professional Agile Certification, Africa", type: "website" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body>
        {children}
        <IdleLogout />
      </body>
    </html>
  );
}
