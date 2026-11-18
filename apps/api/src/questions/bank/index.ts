import type { Difficulty } from "@prisma/client";
import type { BankQuestion } from "./types";
import { STUDENT_1 } from "./student-1";
import { STUDENT_2 } from "./student-2";
import { PROFESSIONAL_1 } from "./professional-1";
import { PROFESSIONAL_2 } from "./professional-2";
import { EXECUTIVE_1 } from "./executive-1";
import { EXECUTIVE_2 } from "./executive-2";
import { EXECUTIVE_3, PROFESSIONAL_3 } from "./extra";

/** Each exam's bank. The level maps 1:1 to a membership type's exam. */
export const QUESTION_BANK: Array<{ difficulty: Difficulty; label: string; questions: BankQuestion[] }> = [
  { difficulty: "FOUNDATION", label: "Student exam", questions: [...STUDENT_1, ...STUDENT_2] },
  { difficulty: "INTERMEDIATE", label: "Professional exam", questions: [...PROFESSIONAL_1, ...PROFESSIONAL_2, ...PROFESSIONAL_3] },
  { difficulty: "ADVANCED", label: "Executive exam", questions: [...EXECUTIVE_1, ...EXECUTIVE_2, ...EXECUTIVE_3] },
];

const SOURCE_PREFIX: Record<string, string> = {
  "SG:": "Scrum Guide 2020 —",
  "KG:": "Kanban Guide —",
  "AM:": "Agile Manifesto —",
  "EBM:": "Evidence-Based Management Guide —",
  "P:": "Agile practice —",
};

export function expandSource(s: string): string {
  for (const [k, v] of Object.entries(SOURCE_PREFIX)) if (s.startsWith(k)) return `${v} ${s.slice(k.length).trim()}`;
  return s;
}

export const normaliseStem = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Structural checks every bank question must pass before it is filed for review. Returns problems found. */
export function checkQuestion(q: BankQuestion): string[] {
  const [topic, stem, correct, wrong, explanation, source] = q;
  const problems: string[] = [];
  if (!topic) problems.push("no topic");
  if (stem.length < 20 || stem.length > 700) problems.push("stem length");
  if (!correct.trim()) problems.push("no correct answer");
  if (wrong.length !== 3 || wrong.some((w) => !w.trim())) problems.push("needs three wrong answers");
  const all = [correct, ...wrong].map((o) => o.trim().toLowerCase());
  if (new Set(all).size !== all.length) problems.push("duplicate options");
  if ([correct, ...wrong].some((o) => o.length > 500)) problems.push("option too long");
  if (/all of the above|none of the above/i.test(all.join("|"))) problems.push("all/none of the above");
  if (explanation.trim().length < 10) problems.push("explanation missing");
  if (!source.trim()) problems.push("source missing");
  return problems;
}
