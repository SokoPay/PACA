import Link from "next/link";
import { fetchFaqItems } from "@/lib/api";
import { BUILT_IN_FAQ, FAQ_CATEGORIES } from "@/lib/faq";
import { PageHero } from "@/components/PageHero";
import { FaqAccordion } from "@/components/FaqAccordion";

export const metadata = {
  title: "Questions & answers",
  description: "Frequently asked questions about PACA membership, payment, exams, badges and your account.",
};

export default async function FaqPage() {
  // Questions published by PACA staff are shown alongside the built-in ones.
  const fetched = await fetchFaqItems().catch(() => []);
  const published = Array.isArray(fetched) ? fetched.filter((p) => p?.question && p?.answer) : [];
  const seen = new Set(BUILT_IN_FAQ.map((f) => f.question.trim().toLowerCase()));
  const extra = published
    .filter((p) => !seen.has(p.question.trim().toLowerCase()))
    .map((p) => ({ category: p.category ?? "More questions", question: p.question, answer: p.answer }));

  const all = [...BUILT_IN_FAQ, ...extra].map((f, i) => ({ ...f, id: `q-${i + 1}` }));
  const categories = [...FAQ_CATEGORIES, ...new Set(extra.map((e) => e.category))].filter(
    (c, i, arr) => arr.indexOf(c) === i && all.some((f) => f.category === c),
  );

  return (
    <main>
      <PageHero
        eyebrow="Help"
        title="Questions & answers"
        lead="Tap a question to see the answer. Everything you need to know about PACA membership, payment, exams and your account."
      />
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-5 sm:py-14">
        <FaqAccordion items={all} categories={categories} />

        <div className="mt-14 rounded-2xl border p-6 text-center" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <p className="font-semibold">Still have a question?</p>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            We are happy to help with anything not covered here.
          </p>
          <Link href="/getting-started" className="mt-4 inline-block rounded-xl bg-paca-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-paca-600">
            Getting started guide
          </Link>
        </div>
      </div>
    </main>
  );
}
