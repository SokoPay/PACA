import type { EventItem } from "@/lib/api";

const month = (d: Date) => d.toLocaleDateString("en-GB", { month: "short" }).toUpperCase();

function when(e: EventItem): string {
  const s = new Date(e.startsAt);
  const date = s.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
  const time = s.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time}`;
}

/**
 * An event, with a calendar tile. `variant="member"` shows the discount code
 * (passed only to paid members); the public card shows just the percentage.
 */
export function EventCard({ event, compact = false }: { event: EventItem; compact?: boolean }) {
  const start = new Date(event.startsAt);
  return (
    <article
      className="group flex h-full flex-col overflow-hidden rounded-3xl border transition hover:-translate-y-1 hover:shadow-xl"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <div className="paca-gradient relative flex items-end justify-between px-5 pb-4 pt-5 text-white">
        <div className="rounded-2xl bg-white/95 px-3 py-2 text-center text-paca-700 shadow-lg">
          <div className="text-[11px] font-bold tracking-widest">{month(start)}</div>
          <div className="text-3xl font-extrabold leading-none">{start.getDate()}</div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur">
            {event.isOnline ? "🌐 Online" : `📍 ${event.location ?? "In person"}`}
          </span>
          {event.memberDiscountPercent ? (
            <span className="rounded-full bg-[#f2b134] px-3 py-1 text-xs font-bold text-[#3a2600]">
              Members save {event.memberDiscountPercent}%
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-bold leading-snug group-hover:text-paca-600">{event.title}</h3>
        <p className="mt-1 text-xs font-medium text-paca-600">{when(event)}</p>
        <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
          {event.summary}
        </p>
        {!compact && event.description && (
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
            {event.description}
          </p>
        )}

        {event.memberDiscountCode && (
          <div className="mt-4 rounded-xl border-2 border-dashed p-3 text-center" style={{ borderColor: "#2e9e5b", background: "#effbf3" }}>
            <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#146c3b" }}>Your member code</p>
            <p className="font-mono text-lg font-extrabold tracking-wider" style={{ color: "#0f5132" }}>{event.memberDiscountCode}</p>
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-3 pt-5">
          <span className="text-sm font-semibold">{event.priceText ?? ""}</span>
          {event.registerUrl ? (
            <a href={event.registerUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-paca-500 px-4 py-2 text-sm font-semibold text-white hover:bg-paca-600">
              Register ↗
            </a>
          ) : (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Registration opens soon</span>
          )}
        </div>
      </div>
    </article>
  );
}
