import Link from "next/link";
import { PageHero } from "@/components/PageHero";

export const metadata = {
  title: "What is PACA?",
  description: "PACA sets benchmark standards for the Agile profession across Africa.",
};

const OBJECTIVES = [
  "Set benchmark standards for the Agile profession",
  "Conduct research to build, grow and enhance the Agile, Scrum and Kanban profession",
  "Influence the education and development of Agile, Scrum and Kanban professionals",
  "Issue certificates for professional designations gained and maintained",
  "Maintain and update a register of its members",
  "Communicate with the public on the career paths available within the community",
];

const DIFFERENTIATORS: Array<[string, string]> = [
  ["Benchmark standards", "High standards for Agile certification, ensuring credibility and recognition across the industry."],
  ["Comprehensive support", "A digital library, educational materials and a professional community."],
  ["Tailored learning paths", "Programmes for different levels of expertise and career stages."],
  ["Experienced trainers", "Courses led by seasoned professionals with real-world experience."],
  ["Community focus", "A collaborative environment to network, share experience and grow."],
  ["Continual improvement", "Continuous learning so members stay ahead in a fast-moving field."],
];

export default function WhatIsPacaPage() {
  return (
    <main>
      <PageHero eyebrow={"Discover PACA"} title={"What is PACA?"} lead={"The professional body setting benchmark standards for Agile practice in Africa."} />
      <div className="mx-auto max-w-3xl px-5 py-14">
      <p className="mt-4 text-lg leading-relaxed" style={{ color: "var(--text-muted)" }}>
        PACA is committed to providing professional, educational and representational support in the Agile, Scrum,
        DevOps and Kanban community, and to promoting educational development programmes that advance its members.
      </p>
      <p className="mt-4 leading-relaxed" style={{ color: "var(--text-muted)" }}>
        The professional body serves the interests of its members, the public and the national interest.
      </p>

      <section className="mt-12">
        <h2 className="text-lg font-semibold">Specifically, PACA exists to</h2>
        <ul className="mt-4 space-y-3">
          {OBJECTIVES.map((item) => (
            <li key={item} className="flex gap-3 text-sm leading-relaxed">
              <span className="text-paca-500">&#10003;</span>
              <span style={{ color: "var(--text-muted)" }}>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold">What makes PACA different</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {DIFFERENTIATORS.map(([title, body]) => (
            <div key={title} className="rounded-xl border p-4" style={{ borderColor: "var(--border)" }}>
              <h3 className="text-sm font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-12">
        <Link
          href="/membership"
          className="rounded-lg bg-paca-500 px-6 py-3 text-sm font-semibold text-white hover:bg-paca-600"
        >
          Explore membership
        </Link>
      </div>
      </div>
    </main>
  );
}
