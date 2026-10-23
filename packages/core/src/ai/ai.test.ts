import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { validateDraftQuestion, triageBatch, type DraftQuestion } from "./validate.ts";
import { buildPrompt, parseGeneratedJson, generateQuestions, StubProvider, type GenerationProvider } from "./generator.ts";

const good: DraftQuestion = {
  topicSlug: "scrum-events",
  difficulty: "INTERMEDIATE",
  stem: "During a Sprint, who has the authority to cancel it before the timebox expires?",
  explanation:
    "Only the Product Owner may cancel a Sprint, and would do so if the Sprint Goal became obsolete. The Scrum Master facilitates but holds no such authority.",
  sourceRef: "Scrum Guide 2020, The Sprint",
  options: [
    { text: "The Product Owner", isCorrect: true },
    { text: "The Scrum Master", isCorrect: false },
    { text: "The Developers", isCorrect: false },
    { text: "The sponsoring stakeholder", isCorrect: false },
  ],
};

const draft = (overrides: Partial<DraftQuestion>): DraftQuestion => ({ ...good, ...overrides });

describe("validateDraftQuestion", () => {
  test("accepts a well-formed item", () => {
    const r = validateDraftQuestion(good);
    assert.equal(r.ok, true);
    assert.deepEqual(r.errors, []);
  });

  test("rejects positional options, which break under option shuffling", () => {
    for (const bad of ["All of the above", "None of the above", "Both A and C"]) {
      const r = validateDraftQuestion(
        draft({
          options: [
            { text: "The Product Owner", isCorrect: true },
            { text: "The Scrum Master", isCorrect: false },
            { text: "The Developers", isCorrect: false },
            { text: bad, isCorrect: false },
          ],
        }),
      );
      assert.equal(r.ok, false, `"${bad}" should be rejected`);
      assert.ok(r.errors.some((e) => e.code === "positional_option"));
    }
  });

  test("rejects an item with no correct option", () => {
    const r = validateDraftQuestion(draft({ options: good.options.map((o) => ({ ...o, isCorrect: false })) }));
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => e.code === "no_correct_option"));
  });

  test("rejects an item where every option is correct", () => {
    const r = validateDraftQuestion(draft({ options: good.options.map((o) => ({ ...o, isCorrect: true })) }));
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => e.code === "all_options_correct"));
  });

  test("rejects duplicate options regardless of case and punctuation", () => {
    const r = validateDraftQuestion(
      draft({
        options: [
          { text: "The Product Owner", isCorrect: true },
          { text: "the product owner.", isCorrect: false },
          { text: "The Developers", isCorrect: false },
          { text: "A stakeholder", isCorrect: false },
        ],
      }),
    );
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => e.code === "option_duplicate"));
  });

  test("rejects a missing sourceRef — the reviewer cannot verify without it", () => {
    const r = validateDraftQuestion(draft({ sourceRef: "  " }));
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => e.code === "source_missing"));
  });

  test("rejects a too-short explanation", () => {
    const r = validateDraftQuestion(draft({ explanation: "Because." }));
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => e.code === "explanation_too_short"));
  });

  test("rejects an invalid difficulty and a wrong option count", () => {
    const bad = validateDraftQuestion(
      draft({
        difficulty: "IMPOSSIBLE" as DraftQuestion["difficulty"],
        options: [{ text: "Only one option here", isCorrect: true }],
      }),
    );
    assert.equal(bad.ok, false);
    assert.ok(bad.errors.some((e) => e.code === "difficulty_invalid"));
    assert.ok(bad.errors.some((e) => e.code === "option_count"));
  });

  test("warns when the correct option is conspicuously longer", () => {
    const r = validateDraftQuestion(
      draft({
        options: [
          {
            text: "The Product Owner, because they are accountable for maximising product value and for the Product Backlog contents throughout",
            isCorrect: true,
          },
          { text: "The Scrum Master", isCorrect: false },
          { text: "The Developers", isCorrect: false },
          { text: "A stakeholder", isCorrect: false },
        ],
      }),
    );
    assert.equal(r.ok, true, "length bias is a warning, not a rejection");
    assert.ok(r.warnings.some((w) => w.code === "length_bias"));
  });

  test("warns on absolute qualifiers in distractors", () => {
    const r = validateDraftQuestion(
      draft({
        options: [
          { text: "The Product Owner", isCorrect: true },
          { text: "The Scrum Master, who must never delegate", isCorrect: false },
          { text: "The Developers", isCorrect: false },
          { text: "A stakeholder", isCorrect: false },
        ],
      }),
    );
    assert.ok(r.warnings.some((w) => w.code === "absolute_qualifier"));
  });

  test("warns when the answer appears verbatim in the stem", () => {
    const r = validateDraftQuestion(
      draft({
        stem: "Which accountability is the Product Owner, the person who maximises product value?",
        options: [
          { text: "The Product Owner, the person who maximises product value", isCorrect: true },
          { text: "The Scrum Master", isCorrect: false },
          { text: "The Developers", isCorrect: false },
          { text: "A stakeholder", isCorrect: false },
        ],
      }),
    );
    assert.ok(r.warnings.some((w) => w.code === "answer_in_stem"));
  });
});

describe("triageBatch", () => {
  test("separates reviewable items from defective ones", () => {
    const { accepted, rejected } = triageBatch([good, draft({ sourceRef: "" }), draft({ explanation: "no" })]);
    assert.equal(accepted.length, 1);
    assert.equal(rejected.length, 2);
  });
});

describe("buildPrompt", () => {
  test("forbids positional options and demands a citation", () => {
    const p = buildPrompt({ topicSlug: "scrum", topicName: "Scrum", difficulty: "ADVANCED", count: 5 });
    assert.match(p, /All of the above/);
    assert.match(p, /sourceRef/);
    assert.match(p, /ADVANCED/);
  });

  test("includes existing stems so the model does not duplicate the bank", () => {
    const p = buildPrompt({
      topicSlug: "scrum",
      topicName: "Scrum",
      difficulty: "FOUNDATION",
      count: 3,
      existingStems: ["What is the timebox for the Daily Scrum?"],
    });
    assert.match(p, /do not duplicate/i);
    assert.match(p, /timebox for the Daily Scrum/);
  });
});

describe("parseGeneratedJson", () => {
  test("parses a bare array", () => {
    assert.deepEqual(parseGeneratedJson('[{"a":1}]'), [{ a: 1 }]);
  });

  test("strips markdown fences", () => {
    assert.deepEqual(parseGeneratedJson('```json\n[{"a":1}]\n```'), [{ a: 1 }]);
  });

  test("recovers from leading prose", () => {
    assert.deepEqual(parseGeneratedJson('Here are your questions:\n[{"a":1}]\nHope that helps!'), [{ a: 1 }]);
  });

  test("throws a useful error on unparseable output", () => {
    assert.throws(() => parseGeneratedJson("I cannot help with that."), /did not return valid JSON/);
  });

  test("throws when JSON is valid but not an array", () => {
    assert.throws(() => parseGeneratedJson('{"a":1}'), /not an array/);
  });
});

describe("generateQuestions", () => {
  test("stub provider produces structurally valid drafts", async () => {
    const r = await generateQuestions(new StubProvider(), {
      topicSlug: "scrum-events",
      topicName: "Scrum Events",
      difficulty: "FOUNDATION",
      count: 4,
    });
    assert.equal(r.accepted.length, 4);
    assert.equal(r.rejected.length, 0);
    assert.equal(r.malformed, 0);
    assert.equal(r.provider, "stub");
    for (const { draft: d } of r.accepted) assert.match(d.stem, /^\[STUB/, "stub content must be unmistakable");
  });

  test("defective model output is triaged, not written through", async () => {
    const badProvider: GenerationProvider = {
      name: "bad",
      async generate() {
        return JSON.stringify([
          // no correct option
          {
            stem: "A stem that is definitely long enough to pass the length check",
            explanation: "An explanation long enough to satisfy the minimum length rule.",
            sourceRef: "Scrum Guide 2020",
            options: [
              { text: "Alpha", isCorrect: false },
              { text: "Bravo", isCorrect: false },
              { text: "Charlie", isCorrect: false },
            ],
          },
          // not a question at all
          { nonsense: true },
        ]);
      },
    };

    const r = await generateQuestions(badProvider, {
      topicSlug: "scrum",
      topicName: "Scrum",
      difficulty: "FOUNDATION",
      count: 2,
    });
    assert.equal(r.accepted.length, 0);
    assert.equal(r.rejected.length, 1);
    assert.equal(r.malformed, 1);
  });

  test("rejects a non-positive count", async () => {
    await assert.rejects(
      () => generateQuestions(new StubProvider(), { topicSlug: "s", topicName: "S", difficulty: "FOUNDATION", count: 0 }),
      RangeError,
    );
  });
});
