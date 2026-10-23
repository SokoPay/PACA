import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  computeVerdict,
  parseAnswerResponse,
  parseCritiqueResponse,
  buildAnswerPrompt,
  buildCritiquePrompt,
  autoReview,
  autoReviewBatch,
  StubReviewProvider,
  type ReviewProvider,
  type Critique,
} from "./review.ts";
import type { DraftQuestion } from "./validate.ts";

const item: DraftQuestion = {
  topicSlug: "scrum-events",
  difficulty: "INTERMEDIATE",
  stem: "Who has the authority to cancel a Sprint before its timebox expires?",
  explanation:
    "Only the Product Owner may cancel a Sprint, and would do so when the Sprint Goal becomes obsolete. The Scrum Master facilitates but holds no such authority.",
  sourceRef: "Scrum Guide 2020, The Sprint",
  options: [
    { text: "The Product Owner", isCorrect: true },
    { text: "The Scrum Master", isCorrect: false },
    { text: "The Developers", isCorrect: false },
    { text: "The sponsoring stakeholder", isCorrect: false },
  ],
};

const clean: Critique = { ambiguityRisk: 0.1, factualConfidence: 0.95, issues: [], notes: "" };

describe("buildAnswerPrompt", () => {
  test("never reveals which option is keyed", () => {
    const p = buildAnswerPrompt(item);
    assert.ok(!p.includes("keyed"), "the answering prompt must not leak the key");
    assert.ok(!p.includes(item.explanation), "the author's explanation would give the answer away");
    assert.match(p, /0: The Product Owner/);
  });
});

describe("buildCritiquePrompt", () => {
  test("does show the key, since critique is a different job", () => {
    const p = buildCritiquePrompt(item);
    assert.match(p, /keyed correct/);
    assert.match(p, /Scrum Guide 2020, The Sprint/);
  });
});

describe("parseAnswerResponse", () => {
  test("parses a clean object", () => {
    assert.equal(parseAnswerResponse('{"answerIndex":2,"reasoning":"x"}', 4), 2);
  });
  test("strips fences", () => {
    assert.equal(parseAnswerResponse('```json\n{"answerIndex":1}\n```', 4), 1);
  });
  test("returns null for an out-of-range index", () => {
    assert.equal(parseAnswerResponse('{"answerIndex":9}', 4), null);
    assert.equal(parseAnswerResponse('{"answerIndex":-1}', 4), null);
  });
  test("returns null for unparseable output", () => {
    assert.equal(parseAnswerResponse("I'm not sure about this one.", 4), null);
    assert.equal(parseAnswerResponse('{"answerIndex":"two"}', 4), null);
  });
});

describe("parseCritiqueResponse", () => {
  test("parses and clamps values", () => {
    const c = parseCritiqueResponse('{"ambiguityRisk":1.7,"factualConfidence":-3,"issues":["a"],"notes":"n"}');
    assert.equal(c.ambiguityRisk, 1);
    assert.equal(c.factualConfidence, 0);
    assert.deepEqual(c.issues, ["a"]);
  });

  test("falls back to cautious midpoints when unparseable", () => {
    const c = parseCritiqueResponse("the model rambled");
    assert.equal(c.ambiguityRisk, 0.5);
    assert.equal(c.factualConfidence, 0.5);
    assert.equal(c.issues.length, 1);
  });
});

describe("computeVerdict", () => {
  test("approves a clean item the model independently agrees with", () => {
    const v = computeVerdict({ keyedIndex: 0, independentAnswerIndex: 0, critique: clean, gateWarnings: [] });
    assert.equal(v.verdict, "APPROVE");
    assert.ok(v.confidence > 0.9, `expected high confidence, got ${v.confidence}`);
  });

  test("flags when the model independently picks a different option", () => {
    const v = computeVerdict({ keyedIndex: 0, independentAnswerIndex: 2, critique: clean, gateWarnings: [] });
    assert.equal(v.verdict, "FLAG");
    assert.ok(v.reasons.some((r) => /key may be wrong/i.test(r)));
  });

  test("rejects when disagreement AND low factual confidence coincide", () => {
    const v = computeVerdict({
      keyedIndex: 0,
      independentAnswerIndex: 2,
      critique: { ...clean, factualConfidence: 0.2 },
      gateWarnings: [],
    });
    assert.equal(v.verdict, "REJECT");
  });

  test("flags a high ambiguity risk even when the model agrees", () => {
    const v = computeVerdict({
      keyedIndex: 0,
      independentAnswerIndex: 0,
      critique: { ...clean, ambiguityRisk: 0.7 },
      gateWarnings: [],
    });
    assert.equal(v.verdict, "FLAG");
  });

  test("flags when the quality gate raised warnings", () => {
    const v = computeVerdict({
      keyedIndex: 0,
      independentAnswerIndex: 0,
      critique: clean,
      gateWarnings: [{ code: "length_bias", message: "correct option is much longer", severity: "warning" }],
    });
    assert.equal(v.verdict, "FLAG");
    assert.ok(v.reasons.some((r) => /longer/.test(r)));
  });

  test("treats an unusable answer as unverified rather than agreement", () => {
    const v = computeVerdict({ keyedIndex: 0, independentAnswerIndex: null, critique: clean, gateWarnings: [] });
    assert.equal(v.verdict, "FLAG");
    assert.ok(v.confidence < 0.9);
    assert.ok(v.reasons.some((r) => /unverified/i.test(r)));
  });

  test("priority orders REJECT before FLAG before APPROVE", () => {
    const reject = computeVerdict({
      keyedIndex: 0,
      independentAnswerIndex: 1,
      critique: { ...clean, factualConfidence: 0.1 },
      gateWarnings: [],
    });
    const flag = computeVerdict({ keyedIndex: 0, independentAnswerIndex: 1, critique: clean, gateWarnings: [] });
    const approve = computeVerdict({ keyedIndex: 0, independentAnswerIndex: 0, critique: clean, gateWarnings: [] });

    assert.ok(reject.reviewPriority < flag.reviewPriority, "rejects must surface first");
    assert.ok(flag.reviewPriority < approve.reviewPriority, "flags must precede approvals");
  });
});

describe("autoReview", () => {
  test("stub provider approves a sound item", async () => {
    const r = await autoReview(new StubReviewProvider(), item);
    assert.equal(r.verdict, "APPROVE");
    assert.equal(r.agreesWithKey, true);
    assert.equal(r.provider, "stub-review");
  });

  test("refuses an item with no correct option", async () => {
    await assert.rejects(
      () => autoReview(new StubReviewProvider(), { ...item, options: item.options.map((o) => ({ ...o, isCorrect: false })) }),
      /no correct option/,
    );
  });

  test("catches a wrongly-keyed item via independent disagreement", async () => {
    // Model confidently answers index 1; the item is keyed to index 0.
    const disagreeing: ReviewProvider = {
      name: "disagreeing",
      async complete(prompt) {
        return prompt.includes('"answerIndex"')
          ? JSON.stringify({ answerIndex: 1, reasoning: "The Scrum Master decides." })
          : JSON.stringify({ ambiguityRisk: 0.2, factualConfidence: 0.3, issues: ["Key looks wrong"], notes: "" });
      },
    };

    const r = await autoReview(disagreeing, item);
    assert.equal(r.verdict, "REJECT");
    assert.equal(r.agreesWithKey, false);
    assert.equal(r.independentAnswerIndex, 1);
  });
});

describe("autoReviewBatch", () => {
  test("sorts the queue so problem items reach the human first", async () => {
    const mixed: ReviewProvider = {
      name: "mixed",
      async complete(prompt) {
        // Disagree only on the item whose stem mentions Kanban.
        const isAnswer = prompt.includes('"answerIndex"');
        const isKanban = prompt.includes("Kanban");
        if (isAnswer) return JSON.stringify({ answerIndex: isKanban ? 2 : 0 });
        return JSON.stringify({
          ambiguityRisk: isKanban ? 0.8 : 0.1,
          factualConfidence: isKanban ? 0.2 : 0.95,
          issues: [],
          notes: "",
        });
      },
    };

    const kanbanItem: DraftQuestion = {
      ...item,
      stem: "In Kanban, which metric measures elapsed time for items still in progress?",
      options: [
        { text: "Work Item Age", isCorrect: true },
        { text: "Cycle Time", isCorrect: false },
        { text: "Throughput", isCorrect: false },
        { text: "WIP", isCorrect: false },
      ],
    };

    const sorted = await autoReviewBatch(mixed, [item, kanbanItem]);
    assert.equal(sorted.length, 2);
    assert.match(sorted[0].draft.stem, /Kanban/, "the problematic item must sort first");
    assert.equal(sorted[0].review.verdict, "REJECT");
    assert.equal(sorted[1].review.verdict, "APPROVE");
  });
});
