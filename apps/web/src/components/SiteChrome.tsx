import Link from "next/link";
import Image, { type StaticImageData } from "next/image";
import { HeaderAuth } from "./HeaderAuth";
import { MobileNav } from "./MobileNav";
import { badgeFor, PARTNERS } from "@/lib/brand";

/**
 * Navigation mirrors the existing pac-a.org menu so nothing is lost in the
 * replacement: Discover PACA / Explore Courses / PACA Membership /
 * Learning Resources / Community.
 */
const NAV: Array<{ label: string; href: string; children?: Array<{ label: string; href: string; image?: StaticImageData }> }> = [
  {
    label: "Discover PACA",
    href: "/what-is-paca",
    children: [
      { label: "What is PACA", href: "/what-is-paca" },
      { label: "Getting started", href: "/getting-started" },
    ],
  },
  {
    label: "Explore courses",
    href: "/courses",
    children: [
      { label: "PACA courses", href: "/courses" },
      { label: "Partners", href: "/partners" },
    ],
  },
  {
    label: "Membership",
    href: "/membership",
    children: [
      { label: "PACA Student", href: "/membership/student", image: badgeFor("student")?.image },
      { label: "PACA Professional", href: "/membership/professional", image: badgeFor("professional")?.image },
      { label: "PACA Executive", href: "/membership/executive", image: badgeFor("executive")?.image },
      { label: "PACA Fellow", href: "/membership/fellow", image: badgeFor("fellow")?.image },
      { label: "PACA Retired", href: "/membership/retired" },
    ],
  },
  {
    label: "Learning resources",
    href: "/assessment",
    children: [
      { label: "PACA open assessment", href: "/assessment" },
      { label: "Digital library", href: "/library" },
    ],
  },
  {
    label: "Community",
    href: "/community",
    children: [
      { label: "Professional database", href: "/directory" },
      { label: "Questions & answers", href: "/faq" },
      { label: "Jobs", href: "/jobs" },
    ],
  },
];

export function SiteHeader() {
  return (
    <header
      className="sticky top-0 z-30 border-b backdrop-blur"
      style={{ background: "color-mix(in srgb, var(--surface) 92%, transparent)", borderColor: "var(--border)" }}
    >
      <div className="relative mx-auto flex max-w-6xl items-center gap-6 px-5 py-3">
        <Link href="/" className="text-xl font-bold tracking-tight text-paca-500">
          PACA
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <div key={item.label} className="group relative">
              <Link
                href={item.href}
                className="rounded-lg px-3 py-2 text-sm font-medium transition hover:text-paca-500"
              >
                {item.label}
              </Link>
              {item.children && (
                <div
                  className="invisible absolute left-0 top-full w-56 rounded-lg border p-1 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100"
                  style={{ background: "var(--surface)", borderColor: "var(--border)" }}
                >
                  {item.children.map((c) => (
                    <Link
                      key={c.href}
                      href={c.href}
                      className="flex items-center gap-3 rounded-md px-3 py-2 text-sm transition hover:bg-paca-50 hover:text-paca-600"
                    >
                      {c.image && (
                        <Image src={c.image} alt="" width={40} height={34} className="h-[34px] w-10 rounded object-contain" />
                      )}
                      {c.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <HeaderAuth />
          <MobileNav items={NAV.map(({ label, href, children }) => ({ label, href, children: children?.map(({ label, href }) => ({ label, href })) }))} />
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t" style={{ borderColor: "var(--border)" }}>
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:grid-cols-2 md:grid-cols-4">
        <div>
          <div className="text-lg font-bold text-paca-500">PACA</div>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Professional Agile Certification &mdash; Africa. Setting benchmark standards for the Agile profession.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold">Membership</h3>
          <ul className="mt-2 space-y-1.5 text-sm" style={{ color: "var(--text-muted)" }}>
            <li><Link href="/membership" className="hover:text-paca-500">All membership types</Link></li>
            <li><Link href="/getting-started" className="hover:text-paca-500">Getting started</Link></li>
            <li><Link href="/directory" className="hover:text-paca-500">Professional database</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold">Learning</h3>
          <ul className="mt-2 space-y-1.5 text-sm" style={{ color: "var(--text-muted)" }}>
            <li><Link href="/assessment" className="hover:text-paca-500">Open assessment</Link></li>
            <li><Link href="/library" className="hover:text-paca-500">Digital library</Link></li>
            <li><Link href="/partners" className="hover:text-paca-500">Partners</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold">Legal</h3>
          <ul className="mt-2 space-y-1.5 text-sm" style={{ color: "var(--text-muted)" }}>
            <li><Link href="/legal/privacy" className="hover:text-paca-500">Privacy policy</Link></li>
            <li><Link href="/legal/terms" className="hover:text-paca-500">Terms &amp; conditions</Link></li>
            <li><Link href="/legal/data-protection" className="hover:text-paca-500">Data protection</Link></li>
            <li><Link href="/legal/data-usage" className="hover:text-paca-500">Data usage</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t" style={{ borderColor: "var(--border)" }}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-4 px-5 py-6">
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            Our partners
          </span>
          {PARTNERS.map((p) => (
            <a key={p.name} href={p.url} target="_blank" rel="noreferrer" title={p.name} className="opacity-80 transition hover:opacity-100">
              <Image src={p.small} alt={p.name} height={32} className="h-8 w-auto rounded bg-white object-contain" />
            </a>
          ))}
        </div>
      </div>

      <div
        className="border-t px-5 py-5 text-center text-xs"
        style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
      >
        &copy; {new Date().getFullYear()} Professional Agile Certification &mdash; Africa. All rights reserved.
      </div>
    </footer>
  );
}
