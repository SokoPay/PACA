import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";

export const metadata: Metadata = {
  title: "Page not found",
  description: "The page you were looking for does not exist or has moved.",
  robots: { index: false, follow: true },
};

/** Custom 404: keeps the site's header and footer and offers the most useful next steps. */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-5 py-20">
        <div className="max-w-xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-paca-500">Error 404</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">We couldn&rsquo;t find that page</h1>
          <p className="mt-4 leading-relaxed" style={{ color: "var(--text-muted)" }}>
            The link may be old, or the page may have moved. These are the places most people are looking for:
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {[
              ["Membership types and prices", "/membership"],
              ["Free competency test", "/assessment"],
              ["Agile jobs", "/jobs"],
              ["Questions & answers", "/faq"],
            ].map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className="rounded-xl border px-4 py-3 text-sm font-semibold transition hover:border-paca-500 hover:text-paca-600"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              >
                {label} &rarr;
              </Link>
            ))}
          </div>
          <Link href="/" className="mt-8 inline-block rounded-xl bg-paca-500 px-6 py-3 text-sm font-semibold text-white hover:bg-paca-600">
            Back to the home page
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
