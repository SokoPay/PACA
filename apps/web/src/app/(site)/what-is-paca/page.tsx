import Link from "next/link";
import Image, { type StaticImageData } from "next/image";
import iconStandards from "@/images/icon-benchmark-standards.jpeg";
import iconSupport from "@/images/icon-comprehensive-support.jpeg";
import iconRocket from "@/images/icon-growth-rocket.jpeg";
import iconTrainers from "@/images/icon-experienced-trainers.jpeg";
import iconCommunity from "@/images/icon-community-network.jpeg";
import { PageHero } from "@/components/PageHero";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta("What is PACA?", "What PACA is, why Africa needs its own Agile standard, and how membership, certification and the PACA community work.", "/what-is-paca");

const OBJECTIVES = [
  "Set benchmark standards for the Agile profession",
  "Conduct research to build, grow and enhance the Agile, Scrum and Kanban profession",
  "Influence the education and development of Agile, Scrum and Kanban professionals",
  "Issue certificates for professional designations gained and maintained",
  "Maintain and update a register of its members",
  "Communicate with the public on the career paths available within the community",
];

const DIFFERENTIATORS: Array<[string, string, StaticImageData]> = [
  ["Benchmark standards", "High standards for Agile certification, ensuring credibility and recognition across the industry.", iconStandards],
  ["Comprehensive support", "A digital library, educational materials and a professional community.", iconSupport],
  ["Tailored learning paths", "Programmes for different levels of expertise and career stages.", iconRocket],
  ["Experienced trainers", "Courses led by seasoned professionals with real-world experience.", iconTrainers],
  ["Community focus", "A collaborative environment to network, share experience and grow.", iconCommunity],
  ["Continual improvement", "Continuous learning so members stay ahead in a fast-moving field.", iconStandards],
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
          {DIFFERENTIATORS.map(([title, body, icon]) => (
            <div
              key={title}
              className="flex gap-4 rounded-2xl border p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            >
              <Image src={icon} alt={`${title} icon`} width={72} height={72} className="h-[72px] w-[72px] shrink-0 rounded-full bg-white object-contain" />
              <div>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {body}
                </p>
              </div>
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
