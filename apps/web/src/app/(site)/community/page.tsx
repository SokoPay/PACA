import Link from "next/link";
import { PageHero } from "@/components/PageHero";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta("Community", "Connect with other PACA members: the professional database, Q&A and jobs board.", "/community");

const LINKS: Array<{ href: string; title: string; body: string }> = [
  {
    href: "/directory",
    title: "Professional database",
    body: "Find members who have opted in to be publicly listed.",
  },
  {
    href: "/faq",
    title: "Questions & answers",
    body: "Answers to common questions about membership and certification.",
  },
  {
    href: "/jobs",
    title: "Jobs",
    body: "Agile, Scrum and product roles for the community.",
  },
];

export default function CommunityPage() {
  return (
    <main>
      <PageHero eyebrow={"Community"} title={"The PACA community"} lead={"Connect with Scrum Masters, Product Owners and Agile leaders across the continent."} />
      <div className="mx-auto max-w-3xl px-5 py-14">
      <p className="mt-4 leading-relaxed" style={{ color: "var(--text-muted)" }}>
        Connect with other Agile practitioners across Africa.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="block rounded-xl border p-5 transition hover:border-paca-500"
            style={{ borderColor: "var(--border)" }}
          >
            <h2 className="font-semibold">{l.title}</h2>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
              {l.body}
            </p>
          </Link>
        ))}
      </div>
      </div>
    </main>
  );
}
