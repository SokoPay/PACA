import Link from "next/link";

export const metadata = {
  title: "Community",
  description: "Connect with other PACA members: the professional database, Q&A and jobs board.",
};

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
    <main className="mx-auto max-w-3xl px-5 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Community</h1>
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
    </main>
  );
}
