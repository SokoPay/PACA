/**
 * PACA's own exam question bank, written for one audience each:
 *  - Student exam (FOUNDATION): core knowledge — what things are and why they exist.
 *  - Professional exam (INTERMEDIATE): realistic team situations a practitioner faces.
 *  - Executive exam (ADVANCED): leadership, organisation, value and scaling decisions.
 *
 * Licensing: every question is PACA's original wording. Facts come from the
 * Scrum Guide 2020 and the Kanban Guide (both CC BY-SA 4.0), the Agile Manifesto,
 * the Evidence-Based Management Guide and well-established Agile practice. No
 * guide text is reproduced and no question is copied from any published exam or
 * practice test.
 *
 * Tuple: [topicSlug, stem, correct answer, three wrong answers, explanation, source].
 * The correct answer is listed first here only for authoring — options are
 * shuffled for every exam sitting.
 *
 * Source shorthand (expanded on import): "SG:" Scrum Guide 2020, "KG:" Kanban
 * Guide, "AM:" Agile Manifesto, "EBM:" Evidence-Based Management Guide,
 * "P:" established Agile practice.
 */
export type BankQuestion = [
  topicSlug: string,
  stem: string,
  correct: string,
  wrong: [string, string, string],
  explanation: string,
  source: string,
];
