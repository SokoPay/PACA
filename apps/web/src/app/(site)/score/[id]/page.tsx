import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchPublicScore } from "@/lib/api";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const score = await fetchPublicScore((await params).id).catch(() => null);
  if (!score) return { title: "Shared score" };
  const pct = Math.round(score.scoreBps / 100);
  const title = `${score.name} scored ${pct}% on the PACA Agile competency test`;
  return {
    title,
    description: `Competency level: ${score.level}. Take the free PACA Agile competency test and see where you stand.`,
    openGraph: { title, description: `Competency level: ${score.level}`, type: "website" },
    twitter: { card: "summary_large_image", title },
    robots: { index: false, follow: true },
  };
}

export default async function SharedScorePage({ params }: { params: Params }) {
  const score = await fetchPublicScore((await params).id).catch(() => null);
  if (!score) notFound();
  const pct = Math.round(score.scoreBps / 100);

  return (
    <main className="mx-auto max-w-2xl px-5 py-16">
      <section className="paca-gradient rounded-3xl p-10 text-center text-white shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">PACA Agile competency test</p>
        <h1 className="mt-3 text-3xl font-bold">{score.name}</h1>
        <div className="mx-auto mt-6 flex h-40 w-40 flex-col items-center justify-center rounded-full bg-white/15 ring-4 ring-white/30">
          <span className="text-6xl font-extrabold">{pct}%</span>
          <span className="text-xs text-white/80">
            {score.correctCount} / {score.questionCount} correct
          </span>
        </div>
        <p className="mt-6 inline-block rounded-full bg-white/20 px-5 py-2 font-semibold">{score.level} level</p>
        <p className="mt-4 text-sm text-white/80">
          Taken {new Date(score.takenAt).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}
        </p>
      </section>

      <section className="mt-8 rounded-2xl border p-6 text-center" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <h2 className="text-lg font-semibold">How would you score?</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          The PACA competency test is free: 20 questions, 30 minutes, with every answer explained afterwards.
        </p>
        <div className="mt-4 flex justify-center gap-3">
          <Link href="/register?next=/assessment" className="rounded-xl bg-paca-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-paca-600">
            Take the free test
          </Link>
          <Link href="/membership" className="rounded-xl border px-5 py-2.5 text-sm font-semibold" style={{ borderColor: "var(--border)" }}>
            About PACA certification
          </Link>
        </div>
      </section>
    </main>
  );
}
