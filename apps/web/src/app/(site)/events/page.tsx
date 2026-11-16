import Link from "next/link";
import { fetchEvents } from "@/lib/api";
import { EventCard } from "@/components/EventCard";
import { PageHero } from "@/components/PageHero";
import { JourneyCta } from "@/components/JourneyCta";

export const metadata = {
  title: "Events",
  description: "PACA and partner events — meetups, webinars and conferences — with discounts for PACA members.",
};

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const events = await fetchEvents().catch(() => []);

  return (
    <main>
      <PageHero
        eyebrow="Events"
        title="Learn, meet and grow together"
        lead="Meetups, webinars and conferences from PACA and our partners. Paid members get exclusive discount codes on their dashboard."
      />
      <section className="mx-auto max-w-6xl px-5 py-14">
        {events.length === 0 ? (
          <div className="rounded-3xl border p-12 text-center" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <p className="text-5xl" aria-hidden>🗓️</p>
            <h2 className="mt-4 text-xl font-bold">New events are on the way</h2>
            <p className="mx-auto mt-2 max-w-md text-sm" style={{ color: "var(--text-muted)" }}>
              Members are notified the moment an event is announced, together with their discount code.
            </p>
            <div className="mt-6">
              <JourneyCta
                labels={{
                  guest: "Join PACA to be notified",
                  registered: "Become a member to get event discounts",
                  member: null,
                  staff: null,
                }}
                className="inline-block rounded-xl bg-paca-500 px-6 py-3 text-sm font-semibold text-white hover:bg-paca-600"
              />
            </div>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
