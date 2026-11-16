import Link from "next/link";
import Image from "next/image";
import { fetchEvents, fetchTiers, formatUsd, type EventItem, type TierInfo } from "@/lib/api";
import { EventCard } from "@/components/EventCard";
import { BADGES, PARTNERS } from "@/lib/brand";
import { PARTNER_COURSES } from "@/lib/catalog";
import banner from "@/images/banner-hero.jpg";

export const metadata = {
  title: { absolute: "PACA — Professional Agile Certification, Africa" },
  description:
    "PACA sets benchmark standards for the Agile profession in Africa, certifying practitioners in Agile, Scrum, Kanban and DevOps.",
};

/** Rendered per request so tier prices always match the database. */
export const dynamic = "force-dynamic";

const BENEFITS = [
  { icon: "🎓", title: "Recognised certification", body: "Sit the exam for your level and earn a verifiable PACA certificate." },
  { icon: "🏅", title: "Shareable digital badge", body: "Add it to LinkedIn and share it anywhere — employers can verify it online." },
  { icon: "📚", title: "Study library", body: "PDF books and guides chosen for your membership type." },
  { icon: "💼", title: "Agile job board", body: "Scrum Master, Product Owner and coaching roles, screened and updated daily." },
  { icon: "🏷️", title: "Course & event discounts", body: "Member pricing on Scrum.org, ProKanban.org and Scrum Alliance courses." },
  { icon: "🤝", title: "Professional network", body: "Meet Agile practitioners across Africa and grow your career together." },
];

export default async function HomePage() {
  let tiers: TierInfo[] = [];
  let events: EventItem[] = [];
  try {
    [tiers, events] = await Promise.all([fetchTiers(), fetchEvents().catch(() => [])]);
  } catch {
    // The marketing page must still render if the API is briefly unavailable.
  }

  return (
    <main>
      {/* ------------------------------------------------------------ hero */}
      <section className="relative isolate overflow-hidden bg-[#031a45] text-white">
        {/* Photo, blended into the brand colours: navy behind the copy, the people clear on the right. */}
        <Image
          src={banner}
          alt=""
          fill
          priority
          sizes="100vw"
          className="hero-photo -z-30 object-cover object-[70%_center]"
        />
        <div className="hero-tint absolute inset-0 -z-20" aria-hidden />
        <div className="hero-fade absolute inset-0 -z-20" aria-hidden />
        <div className="aurora opacity-70" aria-hidden>
          <span />
          <span />
          <span />
        </div>

        <div className="mx-auto flex min-h-[600px] max-w-6xl items-center px-5 pb-20 pt-20 lg:min-h-[660px] lg:pt-24">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-white/90 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-[#f2b134]" /> Professional Agile Certification &mdash; Africa
            </p>
            <h1 className="mt-6 text-4xl font-extrabold leading-[1.08] tracking-tight drop-shadow-lg sm:text-6xl">
              The standard for <span className="text-gradient">Agile professionals</span> in Africa.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/90 drop-shadow">
              Get certified, earn a badge employers trust, and grow with a community of Scrum Masters, Product Owners and
              Agile leaders across the continent.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/register"
                className="rounded-xl bg-white px-7 py-3.5 text-sm font-bold text-paca-700 shadow-xl shadow-black/30 transition hover:-translate-y-0.5"
              >
                Join PACA — it&rsquo;s free to register
              </Link>
              <Link
                href="/assessment"
                className="rounded-xl border border-white/40 bg-white/10 px-7 py-3.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
              >
                Take the free competency test
              </Link>
            </div>

            {/* badges in a glass strip */}
            <div className="mt-10 inline-flex flex-wrap items-center gap-3 rounded-2xl border border-white/20 bg-white/10 p-3 pr-5 backdrop-blur-md">
              <div className="flex -space-x-3">
                {BADGES.map((b, i) => (
                  <Link
                    key={b.tier}
                    href={`/membership/${b.slug}`}
                    className="bob block rounded-xl bg-white p-1 shadow-lg ring-2 ring-white/60 transition hover:z-10 hover:scale-110"
                    style={{ ["--tilt" as string]: `${[-5, 3, -2, 4][i]}deg`, animationDelay: `${i * -1.4}s` }}
                    title={b.name}
                  >
                    <Image src={b.image} alt={`${b.name} badge`} width={64} height={54} className="h-[54px] w-16 rounded-lg object-contain" />
                  </Link>
                ))}
              </div>
              <div className="text-sm leading-tight">
                <p className="font-semibold">4 certification badges</p>
                <p className="text-white/75">Student · Professional · Executive · Fellow</p>
              </div>
            </div>
          </div>
        </div>

        {/* stat strip */}
        <div className="border-t border-white/15 bg-black/10 backdrop-blur">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-5 py-7 text-center md:grid-cols-4">
            {[
              [String(tiers.length || 5), "membership types"],
              [`${PARTNER_COURSES.length}+`, "partner courses"],
              ["3", "global training partners"],
              ["100%", "online & verifiable"],
            ].map(([n, label]) => (
              <div key={label}>
                <div className="text-3xl font-extrabold">{n}</div>
                <div className="mt-1 text-xs uppercase tracking-wider text-white/70">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ badges */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-paca-500">Certification badges</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">A badge for every stage of your career</h2>
          <p className="mt-4 leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Earn your PACA badge, show it on LinkedIn and your CV, and let employers verify it online in seconds.
          </p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {BADGES.map((b) => (
            <Link
              key={b.tier}
              href={`/membership/${b.slug}`}
              className="group flex flex-col items-center rounded-3xl border p-6 text-center transition hover:-translate-y-1 hover:border-paca-400 hover:shadow-xl"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            >
              <div className="rounded-2xl bg-gradient-to-b from-paca-50 to-transparent p-3">
                <Image src={b.image} alt={`${b.name} badge`} width={180} height={152} className="h-[152px] w-auto rounded-xl transition group-hover:scale-105" />
              </div>
              <h3 className="mt-4 font-bold">{b.name}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{b.summary}</p>
              <span className="mt-auto pt-4 text-sm font-semibold text-paca-500">How to earn it &rarr;</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------ benefits */}
      <section className="border-y" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-widest text-paca-500">Membership benefits</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Everything you need to grow in Agile</h2>
            </div>
            <Link href="/membership" className="text-sm font-semibold text-paca-500 hover:underline">Compare membership types &rarr;</Link>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((b) => (
              <div key={b.title} className="rounded-2xl border p-6 transition hover:border-paca-300 hover:shadow-lg" style={{ borderColor: "var(--border)", background: "var(--bg)" }}>
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-paca-50 text-2xl" aria-hidden>{b.icon}</span>
                <h3 className="mt-4 font-bold">{b.title}</h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{b.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ events */}
      <section className="mx-auto max-w-6xl px-5 pt-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-widest text-paca-500">Events</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Upcoming events</h2>
            <p className="mt-3 leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Meetups, webinars and conferences. PACA members get exclusive discount codes.
            </p>
          </div>
          <Link href="/events" className="text-sm font-semibold text-paca-500 hover:underline">See all events &rarr;</Link>
        </div>
        {events.length > 0 ? (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {events.slice(0, 3).map((e) => (
              <EventCard key={e.id} event={e} compact />
            ))}
          </div>
        ) : (
          <div className="mt-10 flex flex-col items-center gap-3 rounded-3xl border p-10 text-center sm:flex-row sm:text-left" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <span className="text-5xl" aria-hidden>🗓️</span>
            <div className="flex-1">
              <h3 className="text-lg font-bold">New events are coming soon</h3>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>Join PACA and you&rsquo;ll be the first to know — with your member discount code.</p>
            </div>
            <Link href="/register" className="rounded-xl bg-paca-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-paca-600">Join PACA</Link>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------ how it works */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">How it works</h2>
        <div className="mt-12 grid gap-6 md:grid-cols-4">
          {[
            ["1", "Register free", "Create your account and verify your email."],
            ["2", "Test yourself", "Take the free competency test to find your level."],
            ["3", "Apply & pay", "Choose your membership type, apply, and pay once approved."],
            ["4", "Get certified", "Study, pass your exam and share your badge."],
          ].map(([n, title, body]) => (
            <div key={n} className="relative rounded-2xl border p-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <span className="paca-gradient flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-white">{n}</span>
              <h3 className="mt-4 font-bold">{title}</h3>
              <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------ membership tiers */}
      <section className="border-t" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Membership</h2>
              <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>Annual subscription, due 1 January. Register free and pay when you are ready.</p>
            </div>
            <Link href="/membership" className="text-sm font-semibold text-paca-500 hover:underline">Compare all types &rarr;</Link>
          </div>

          {tiers.length > 0 ? (
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {tiers.map((t) => (
                <Link
                  key={t.tier}
                  href={`/membership/${t.tier.toLowerCase()}`}
                  className="flex flex-col rounded-2xl border p-5 transition hover:-translate-y-0.5 hover:border-paca-500 hover:shadow-lg"
                  style={{ borderColor: "var(--border)", background: "var(--bg)" }}
                >
                  <h3 className="font-bold">{t.displayName}</h3>
                  <span className="mt-2 text-2xl font-extrabold text-paca-600">
                    {formatUsd(t.priceUsdCents)}
                    <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}> /year</span>
                  </span>
                  <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                    {t.requiresPanel
                      ? "Assessed by a panel of academic and industry leaders"
                      : t.requiresExam
                        ? `${t.examQuestionCount} questions · ${t.examDurationMins} min · ${(t.passMarkBps ?? 0) / 100}% to pass`
                        : "Retains the credential held before retirement"}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-8 text-sm" style={{ color: "var(--text-muted)" }}>Membership details are temporarily unavailable. Please try again shortly.</p>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------ partners */}
      <section className="mx-auto max-w-6xl px-5 py-20 text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-paca-500">Training partners</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight">Learn with the world&rsquo;s leading Agile bodies</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm" style={{ color: "var(--text-muted)" }}>
          Members get discounts on partner courses from Scrum.org, ProKanban.org and Scrum Alliance.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-6">
          {PARTNERS.map((p) => (
            <Link
              key={p.name}
              href={`/courses/partners/${p.slug}`}
              className="flex h-32 w-48 items-center justify-center rounded-2xl border bg-white p-4 transition hover:-translate-y-1 hover:border-paca-500 hover:shadow-lg"
              style={{ borderColor: "var(--border)" }}
            >
              <Image src={p.logo} alt={p.name} className="max-h-full w-auto object-contain" />
            </Link>
          ))}
        </div>
        <Link href="/courses" className="mt-8 inline-block text-sm font-semibold text-paca-500 hover:underline">Explore partner courses &rarr;</Link>
      </section>

      {/* ------------------------------------------------------------ final CTA */}
      <section className="mx-auto max-w-6xl px-5 pb-8">
        <div className="paca-gradient grain relative overflow-hidden rounded-3xl px-8 py-14 text-center text-white shadow-2xl">
          <div className="aurora" aria-hidden>
            <span />
            <span />
            <span />
          </div>
          <h2 className="text-3xl font-extrabold sm:text-4xl">Ready to prove your Agile expertise?</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/85">Start with the free competency test — it takes 30 minutes and shows you exactly where you stand.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/register" className="rounded-xl bg-white px-7 py-3.5 text-sm font-bold text-paca-700 shadow-xl">Join PACA</Link>
            <Link href="/assessment" className="rounded-xl border border-white/40 px-7 py-3.5 text-sm font-semibold text-white">Take the free test</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
