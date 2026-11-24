import Link from "next/link";
import { privateMeta } from "@/lib/seo";
import { ConversionEvent } from "./ConversionEvent";

export const metadata = privateMeta("Thank you", "Thank you for taking the next step with PACA.", "/thank-you");

const VARIANTS = {
  application: {
    icon: "✓",
    title: "Application submitted: thank you!",
    body: "Your application is with the PACA review panel. We will email you as soon as there is a decision. You only pay once you are approved.",
    next: [
      ["View my application", "/dashboard/applications"],
      ["Take the free competency test", "/assessment"],
    ],
    event: "application_submitted",
  },
  payment: {
    icon: "🎉",
    title: "Payment received: welcome to PACA!",
    body: "Your membership is now active for one full year. Your member badge, study library, certification exam and member discounts are unlocked.",
    next: [
      ["Go to my dashboard", "/dashboard"],
      ["Sit the certification exam", "/exam"],
    ],
    event: "membership_paid",
  },
  registration: {
    icon: "✉️",
    title: "Thanks for joining PACA",
    body: "Check your inbox for the 6-digit code to verify your email address, then choose a membership type.",
    next: [
      ["Verify my email", "/verify-email"],
      ["See membership types", "/membership"],
    ],
    event: "sign_up",
  },
} as const;

type Kind = keyof typeof VARIANTS;

export default async function ThankYouPage({ searchParams }: { searchParams: Promise<{ for?: string }> }) {
  const kind = ((await searchParams).for ?? "application") as Kind;
  const v = VARIANTS[kind] ?? VARIANTS.application;
  return (
    <main className="mx-auto max-w-2xl px-5 py-20 text-center">
      <ConversionEvent name={v.event} />
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-paca-50 text-3xl text-paca-600" aria-hidden>
        {v.icon}
      </div>
      <h1 className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl">{v.title}</h1>
      <p className="mx-auto mt-3 max-w-lg leading-relaxed" style={{ color: "var(--text-muted)" }}>
        {v.body}
      </p>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        {v.next.map(([label, href], i) => (
          <Link
            key={href}
            href={href}
            className={
              i === 0
                ? "rounded-xl bg-paca-500 px-6 py-3 text-sm font-semibold text-white hover:bg-paca-600"
                : "rounded-xl border px-6 py-3 text-sm font-semibold hover:border-paca-500"
            }
            style={i === 0 ? undefined : { borderColor: "var(--border)" }}
          >
            {label}
          </Link>
        ))}
      </div>
    </main>
  );
}
