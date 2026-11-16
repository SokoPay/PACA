import Link from "next/link";
import Image, { type StaticImageData } from "next/image";
import { HeaderAuth } from "./HeaderAuth";
import { MobileNav, type NavItem } from "./MobileNav";
import { badgeFor, PARTNERS } from "@/lib/brand";

type NavChild = { label: string; href: string; note?: string; image?: StaticImageData; external?: boolean };

/**
 * Navigation mirrors the pac-a.org menu: Discover PACA / Explore Courses / PACA
 * Membership / Learning Resources / Events / Community. External links open in a new tab.
 */
const NAV: Array<{ label: string; href: string; children?: NavChild[] }> = [
  {
    label: "Discover PACA",
    href: "/what-is-paca",
    children: [
      { label: "What is PACA", href: "/what-is-paca", note: "Our mission and standards" },
      { label: "Getting started", href: "/getting-started", note: "From registration to certification" },
      { label: "Our partners", href: "/partners", note: "Scrum.org, ProKanban.org, Scrum Alliance" },
    ],
  },
  {
    label: "Explore courses",
    href: "/courses",
    children: [
      { label: "All courses", href: "/courses", note: "Partner and PACA courses" },
      { label: "Scrum.org courses", href: "/courses/partners/scrum-org" },
      { label: "ProKanban.org courses", href: "/courses/partners/prokanban" },
      { label: "Scrum Alliance courses", href: "/courses/partners/scrum-alliance" },
      { label: "PACA courses", href: "/courses#paca", note: "Coming soon" },
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
      { label: "Free competency test", href: "/assessment", note: "Unlimited, answers explained" },
      { label: "Certification exam", href: "/exam", note: "Paid members · 3 chances" },
      { label: "Free PSM I assessment", href: "https://www.scrum.org/open-assessments/scrum-open", note: "Scrum Open, on Scrum.org", external: true },
      {
        label: "Free PK I assessment",
        href: "https://www.thescrummaster.co.uk/quizzes/free-kanban-i-pk-i-practice-assessment/",
        note: "Kanban practice, on TheScrumMaster.co.uk",
        external: true,
      },
      { label: "Digital library", href: "/library", note: "Guides, templates and member books" },
    ],
  },
  { label: "Events", href: "/events" },
  {
    label: "Community",
    href: "/community",
    children: [
      { label: "Professional database", href: "/directory", note: "Members in good standing" },
      { label: "Professional network", href: "/dashboard/network", note: "Paid members" },
      { label: "Questions & answers", href: "/faq" },
    ],
  },
];

function ChildLink({ c }: { c: NavChild }) {
  const inner = (
    <>
      {c.image ? (
        <Image src={c.image} alt="" width={40} height={34} className="h-[34px] w-10 shrink-0 rounded object-contain" />
      ) : null}
      <span className="min-w-0">
        <span className="flex items-center gap-1 font-medium">
          {c.label}
          {c.external && <span aria-hidden className="text-xs opacity-60">↗</span>}
        </span>
        {c.note && <span className="block text-xs" style={{ color: "var(--text-muted)" }}>{c.note}</span>}
      </span>
    </>
  );
  const cls = "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition hover:bg-paca-50 hover:text-paca-600";
  return c.external ? (
    <a href={c.href} target="_blank" rel="noopener noreferrer" className={cls}>
      {inner}
    </a>
  ) : (
    <Link href={c.href} className={cls}>
      {inner}
    </Link>
  );
}

export function SiteHeader() {
  const mobileItems: NavItem[] = NAV.map(({ label, href, children }) => ({
    label,
    href,
    children: children?.map(({ label, href, external }) => ({ label, href, external })),
  }));

  return (
    <header
      className="sticky top-0 z-30 border-b backdrop-blur-xl"
      style={{ background: "color-mix(in srgb, var(--surface) 85%, transparent)", borderColor: "var(--border)" }}
    >
      <div className="relative mx-auto flex max-w-6xl items-center gap-6 px-5 py-3">
        <Link href="/" className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-paca-600" aria-label="PACA home">
          <PacaMark />
          PACA
        </Link>

        <nav className="hidden items-center gap-0.5 lg:flex">
          {NAV.map((item) => (
            <div key={item.label} className="group relative">
              <Link href={item.href} className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition hover:text-paca-500">
                {item.label}
                {item.children && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="opacity-50 transition group-hover:rotate-180" aria-hidden>
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                )}
              </Link>
              {item.children && (
                <div className="invisible absolute left-0 top-full pt-2 opacity-0 transition group-hover:visible group-hover:opacity-100">
                  <div className="w-72 rounded-2xl border p-2 shadow-2xl" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                    {item.children.map((c) => (
                      <ChildLink key={c.href} c={c} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <HeaderAuth />
          <MobileNav items={mobileItems} />
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="relative mt-24 overflow-hidden text-white" style={{ background: "linear-gradient(160deg, #031a45 0%, #062a66 60%, #0a3d91 100%)" }}>
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:grid-cols-2 md:grid-cols-5">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 text-xl font-extrabold">
            <PacaMark size={32} />
            PACA
          </div>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/70">
            Professional Agile Certification &mdash; Africa. Setting benchmark standards for the Agile profession, and
            helping practitioners across the continent grow.
          </p>
          <Link href="/register" className="mt-5 inline-block rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-paca-700 transition hover:-translate-y-0.5">
            Join PACA
          </Link>
        </div>

        {[
          {
            title: "Membership",
            links: [
              ["All membership types", "/membership"],
              ["Getting started", "/getting-started"],
              ["Certification exam", "/exam"],
              ["Professional database", "/directory"],
            ],
          },
          {
            title: "Learning",
            links: [
              ["Free competency test", "/assessment"],
              ["Partner courses", "/courses"],
              ["Events", "/events"],
              ["Digital library", "/library"],
            ],
          },
          {
            title: "Legal",
            links: [
              ["Privacy policy", "/legal/privacy"],
              ["Terms & conditions", "/legal/terms"],
              ["Data protection", "/legal/data-protection"],
              ["Data usage", "/legal/data-usage"],
            ],
          },
        ].map((col) => (
          <div key={col.title}>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white/90">{col.title}</h3>
            <ul className="mt-3 space-y-2 text-sm text-white/65">
              {col.links.map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="transition hover:text-white">{label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-4 px-5 py-6">
          <span className="text-xs font-semibold uppercase tracking-wider text-white/60">Our partners</span>
          {PARTNERS.map((p) => (
            <a key={p.name} href={p.url} target="_blank" rel="noreferrer" title={p.name} className="rounded-lg bg-white px-2 py-1 opacity-90 transition hover:opacity-100">
              <Image src={p.small} alt={p.name} height={28} className="h-7 w-auto object-contain" />
            </a>
          ))}
        </div>
      </div>

      <div className="border-t border-white/10 px-5 py-5 text-center text-xs text-white/55">
        &copy; {new Date().getFullYear()} Professional Agile Certification &mdash; Africa. All rights reserved.
      </div>
    </footer>
  );
}

/** The PACA "P" mark (same artwork as the favicon). */
export function PacaMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id="paca-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0a2a66" />
          <stop offset="0.55" stopColor="#0060cc" />
          <stop offset="1" stopColor="#2b9bff" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#paca-mark)" />
      <path d="M20 50V14h14.5c7.6 0 12.5 4.6 12.5 11.4S42.1 37 34.5 37H27.6v13H20zm7.6-19.6h6.2c3.4 0 5.5-1.9 5.5-5s-2.1-5-5.5-5h-6.2v10z" fill="#fff" />
      <circle cx="47" cy="47" r="5" fill="#f2b134" />
    </svg>
  );
}
