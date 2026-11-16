import { fetchFaqItems } from "@/lib/api";
import { PageHero } from "@/components/PageHero";

export const metadata = {
  title: "Questions & answers",
  description: "Frequently asked questions about PACA membership and certification.",
};

export default async function FaqPage() {
  const items = await fetchFaqItems().catch(() => []);

  const groups = new Map<string, typeof items>();
  for (const item of items) {
    const key = item.category ?? "General";
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  return (
    <main>
      <PageHero eyebrow={"Help"} title={"Questions & answers"} lead={"Everything you need to know about PACA membership, exams and certificates."} />
      <div className="mx-auto max-w-3xl px-5 py-14">

      {items.length === 0 ? (
        <p className="mt-10 text-sm" style={{ color: "var(--text-muted)" }}>
          No questions have been published yet.
        </p>
      ) : (
        Array.from(groups.entries()).map(([category, group]) => (
          <section key={category} className="mt-10">
            <h2 className="text-lg font-semibold">{category}</h2>
            <dl className="mt-4 space-y-5">
              {group.map((item) => (
                <div key={item.id}>
                  <dt className="font-medium">{item.question}</dt>
                  <dd className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                    {item.answer}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))
      )}
      </div>
    </main>
  );
}
