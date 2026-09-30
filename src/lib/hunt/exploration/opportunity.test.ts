import assert from "node:assert/strict";
import test from "node:test";
import { MAX_ENGINE_RUNS, opportunityOf, outcomeIsOpen, type ZoneOpportunity } from "./opportunity.ts";
import type { RegulatoryOutcome } from "../regulatory/registry.ts";
import type { HuntDimensionAnswers, RequiredDimension } from "../regulatory/dimensions.ts";
import type { RegulatoryResult, RegulatoryStatus } from "../types.ts";
import { legalTimeNotCertified } from "../regulatory/legal-time.ts";
import type { RegulatoryCondition } from "../regulatory/condition.ts";
import type { CanonicalId } from "../../content-contract/index.ts";

/**
 * The map's one legality question, tested against a FAKE ENGINE.
 *
 * Deliberately fake: what is under test is the walk of the answer tree and the
 * conclusions drawn from its leaves, not Ontario's moose tables. A real bundle
 * here would make every assertion turn on a season date, so a bundle edit in
 * another province could turn this suite red for a reason that has nothing to
 * do with what it guards — and a passing run would prove the bundle, not the
 * walk. The engine's own rules have their own suites.
 *
 * The fake answers exactly what a `RegulatoryEntry` answers, so a change to
 * that contract breaks compilation here rather than passing silently.
 */

const SOURCE = "source:test" as CanonicalId<"source">;

function regulation(status: RegulatoryStatus, conditions?: RegulatoryCondition[]): RegulatoryResult {
  return {
    status,
    summary: "test",
    next: { kind: "NOT_CERTIFIED" },
    legalTime: legalTimeNotCertified("test", "Test"),
    requirements: [],
    limitations: [],
    sourceIds: [],
    verifiedAt: "2026-09-29T00:00:00.000Z",
    ...(conditions ? { conditions } : {}),
  };
}

const resolved = (status: RegulatoryStatus, conditions?: RegulatoryCondition[]): RegulatoryOutcome =>
  ({ completeness: "RESOLVED", dimensions: [], regulation: regulation(status, conditions) });

const needsInput = (required: RequiredDimension): RegulatoryOutcome =>
  ({ completeness: "NEEDS_INPUT", required, dimensions: [required], regulation: regulation("NEEDS_VERIFICATION") });

function dimension(id: RequiredDimension["id"], values: string[]): RequiredDimension {
  return {
    id,
    question: `Which ${id}?`,
    reason: "The published tables differ by it.",
    options: values.map((value) => ({ value, label: `${value} label` })),
    multiple: false,
    allowsUnsure: false,
    sourceId: SOURCE,
  };
}

const TAG = dimension("TAG_TYPE", ["GUN", "BOW"]);
const RESIDENCY = dimension("RESIDENCY", ["RESIDENT", "NON_RESIDENT"]);

/** An engine that asks `TAG_TYPE` and opens only for the values listed. */
function tagEngine(openFor: string[], closedStatus: RegulatoryStatus = "CLOSED") {
  const runs: HuntDimensionAnswers[] = [];
  return {
    runs,
    async evaluate(answers: HuntDimensionAnswers): Promise<RegulatoryOutcome> {
      runs.push(answers);
      if (!answers.TAG_TYPE) return needsInput(TAG);
      return openFor.includes(answers.TAG_TYPE) ? resolved("CONDITIONAL") : resolved(closedStatus);
    },
  };
}

/* ── The defect this file exists for ───────────────────────────────────── */

test("a season reached only through a question the engine asked is a legal opportunity", async () => {
  const engine = tagEngine(["GUN"]);
  const result = await opportunityOf(await engine.evaluate({}), engine.evaluate);

  // The production defect: this was false, so Ontario moose drew no green.
  assert.equal(result.hasCurrentLegalOpportunity, true);
  assert.equal(result.coverage, "OPEN");
  assert.equal(result.hasMaterialConditions, true);
  assert.equal(result.exhaustive, true);
});

test("the condition names the answer that opens the season, from the dimension's own option labels", async () => {
  const engine = tagEngine(["GUN"]);
  const result = await opportunityOf(await engine.evaluate({}), engine.evaluate);

  assert.equal(result.conditions.length, 1);
  const [condition] = result.conditions;
  assert.equal(condition.kind, "ASKED_DIMENSION");
  assert.equal(condition.dimension, "TAG_TYPE");
  assert.equal(condition.owner, "NORTH_GROUND");
  // The label the authority's own dimension carries — and ONLY the opening one.
  assert.match(condition.text, /GUN label/);
  assert.doesNotMatch(condition.text, /BOW label/);
});

test("a question every answer opens is listed, and is NOT material", async () => {
  /*
   * Reversed 2026-09-30 (owner): "if there's no specific condition then no
   * exclamation mark". Where every tag, every residency, every weapon reaches
   * an open season, the question changes which dates apply — the card says so
   * — and nothing about whether a hunt exists. Marking it put a `!` on the same
   * decision-tree branch in every zone of a province, which is the marker that
   * says nothing.
   */
  const engine = tagEngine(["GUN", "BOW"]);
  const result = await opportunityOf(await engine.evaluate({}), engine.evaluate);

  assert.equal(result.hasCurrentLegalOpportunity, true);
  assert.equal(result.hasMaterialConditions, false);
  assert.equal(result.conditions.length, 1, "still listed, so the card can say the dates turn on it");
  assert.equal(result.conditions[0].material, false);
  /* Listing every option says only "you have a tag", which is not a fact a
     hunter can act on; what the card says is that the dates turn on it. */
  assert.match(result.conditions[0].text, /^Turns on which tag you hold$/);
});

test("a question some hunter is refused by is material, and names who is not", async () => {
  const engine = tagEngine(["GUN"]);
  const result = await opportunityOf(await engine.evaluate({}), engine.evaluate);
  assert.equal(result.hasMaterialConditions, true);
  assert.equal(result.conditions[0].material, true);
});

test("an undecided leaf gates the answer: nothing established it is open to everyone", async () => {
  /* A hunter whose branch North Ground could not decide has not been shown to
     have a hunt, so the question that separates them is material. */
  const engine = tagEngine(["GUN"], "UNKNOWN");
  const result = await opportunityOf(await engine.evaluate({}), engine.evaluate);
  assert.equal(result.hasMaterialConditions, true);
});

/* ── Stated conditions: declared kind and scope decide, never the prose ── */

const stated = (id: string, kind?: RegulatoryCondition["kind"], scope?: RegulatoryCondition["scope"]): RegulatoryCondition => ({
  id, text: id, lang: "en-CA", owner: "NORTH_GROUND", sourceSection: "p. 1", sourceId: SOURCE,
  ...(kind ? { kind } : {}), ...(scope ? { scope } : {}),
});

test("open with only the ordinary licence: green, and no marker", async () => {
  const result = await opportunityOf(resolved("CONDITIONAL", [stated("licence", "LICENCE", "JURISDICTION")]), async () => resolved("CONDITIONAL"));
  assert.equal(result.hasCurrentLegalOpportunity, true);
  assert.equal(result.hasMaterialConditions, false);
  assert.equal(result.conditions.length, 1, "the licence is still on the card");
});

test("open with a draw tag: green, and a marker, however many zones share it", async () => {
  const result = await opportunityOf(resolved("CONDITIONAL", [stated("tag", "TAG_OR_DRAW", "JURISDICTION")]), async () => resolved("CONDITIONAL"));
  assert.equal(result.hasMaterialConditions, true);
});

test("a standing rule marks only the zones it is declared for", async () => {
  const everywhere = await opportunityOf(resolved("CONDITIONAL", [stated("orange", "HUNTER_ORANGE", "JURISDICTION")]), async () => resolved("CONDITIONAL"));
  const here = await opportunityOf(resolved("CONDITIONAL", [stated("orange", "HUNTER_ORANGE", "ZONE")]), async () => resolved("CONDITIONAL"));
  assert.equal(everywhere.hasMaterialConditions, false);
  assert.equal(here.hasMaterialConditions, true);
});

test("bag limits, reporting and context never mark, even where they are zone-specific", async () => {
  for (const kind of ["HARVEST_LIMIT", "REPORTING", "INFORMATION"] as const) {
    const result = await opportunityOf(resolved("CONDITIONAL", [stated(kind, kind, "ZONE")]), async () => resolved("CONDITIONAL"));
    assert.equal(result.hasMaterialConditions, false, kind);
  }
});

test("material conditions are listed first, in the order the answer gave them", async () => {
  const result = await opportunityOf(resolved("CONDITIONAL", [
    stated("licence", "LICENCE", "JURISDICTION"),
    stated("permit", "ADDITIONAL_PERMIT", "ZONE"),
    stated("limit", "HARVEST_LIMIT"),
    stated("tag", "TAG_OR_DRAW", "JURISDICTION"),
  ]), async () => resolved("CONDITIONAL"));
  assert.deepEqual(result.conditions.map((c) => c.id), ["permit", "tag", "licence", "limit"]);
});

test("closed and unknown answers carry no conditions and no marker", async () => {
  for (const status of ["CLOSED", "UNKNOWN"] as const) {
    const result = await opportunityOf(resolved(status, [stated("tag", "TAG_OR_DRAW", "ZONE")]), async () => resolved(status));
    assert.equal(result.hasCurrentLegalOpportunity, false);
    assert.equal(result.hasMaterialConditions, false);
    assert.deepEqual(result.conditions, []);
  }
});

test("a question no answer opens is not an opportunity, and is reported closed only when the engine closed it", async () => {
  const closed = tagEngine([], "CLOSED");
  const closedResult = await opportunityOf(await closed.evaluate({}), closed.evaluate);
  assert.equal(closedResult.hasCurrentLegalOpportunity, false);
  assert.equal(closedResult.coverage, "CLOSED");

  // The same shape of tree, with the engine declining to answer rather than closing.
  const unknown = tagEngine([], "UNKNOWN");
  const unknownResult = await opportunityOf(await unknown.evaluate({}), unknown.evaluate);
  assert.equal(unknownResult.hasCurrentLegalOpportunity, false);
  // UNKNOWN IS NEVER CLOSED. The whole product exists to avoid this one.
  assert.equal(unknownResult.coverage, "UNKNOWN");
});

test("one undecided branch is never averaged away by decided ones", async () => {
  const engine = {
    async evaluate(answers: HuntDimensionAnswers): Promise<RegulatoryOutcome> {
      if (!answers.TAG_TYPE) return needsInput(TAG);
      return answers.TAG_TYPE === "GUN" ? resolved("CLOSED") : resolved("CONFLICT");
    },
  };
  const result = await opportunityOf(await engine.evaluate({}), engine.evaluate);
  assert.equal(result.hasCurrentLegalOpportunity, false);
  assert.equal(result.coverage, "CONFLICT");
});

/* ── Resolved answers ──────────────────────────────────────────────────── */

test("a season open without a question is green and wears no indicator", async () => {
  const result = await opportunityOf(resolved("CONDITIONAL"), async () => resolved("CONDITIONAL"));
  assert.equal(result.hasCurrentLegalOpportunity, true);
  assert.equal(result.hasMaterialConditions, false);
  assert.deepEqual(result.conditions, []);
});

test("a resolved answer's conditions come from the structured rows, with their provenance kept", async () => {
  const condition: RegulatoryCondition = {
    id: "condition:abc",
    text: "« Permis de petit gibier »",
    lang: "fr-CA",
    owner: "AUTHORITY",
    sourceSection: "s. 9(3)",
    sourceId: SOURCE,
  };
  const result = await opportunityOf(resolved("CONDITIONAL", [condition]), async () => resolved("CONDITIONAL"));
  assert.equal(result.hasMaterialConditions, true);
  assert.equal(result.conditions.length, 1);
  // The language and the authorship survive the crossing. A translation layer
  // downstream needs both, and neither may be re-guessed from the text.
  assert.equal(result.conditions[0].lang, "fr-CA");
  assert.equal(result.conditions[0].owner, "AUTHORITY");
  assert.equal(result.conditions[0].sourceSection, "s. 9(3)");
  assert.equal(result.conditions[0].kind, "STATED_CONDITION");
});

test("a closed season is neither green nor conditional, whatever the date's next opening says", async () => {
  const future: RegulatoryOutcome = {
    completeness: "RESOLVED",
    dimensions: [],
    regulation: { ...regulation("CLOSED"), next: { kind: "SEASON", opens: "2026-11-07", closes: "2026-12-15" } },
  };
  const result = await opportunityOf(future, async () => future);
  assert.equal(result.hasCurrentLegalOpportunity, false);
  assert.equal(result.hasMaterialConditions, false);
  assert.equal(result.coverage, "CLOSED");
});

test("a season running across the zone except inside published areas is an opportunity", () => {
  const outcome: RegulatoryOutcome = {
    completeness: "RESOLVED",
    dimensions: [],
    regulation: regulation("NEEDS_VERIFICATION"),
    exceptInside: ["Delta Marsh Wildlife Management Area"],
  };
  assert.equal(outcomeIsOpen(outcome), true);
  // The same status WITHOUT the named areas is the engine declining, not a season.
  assert.equal(outcomeIsOpen({ completeness: "RESOLVED", dimensions: [], regulation: regulation("NEEDS_VERIFICATION") }), false);
});

test("a pending question is never open on its own", () => {
  assert.equal(outcomeIsOpen(needsInput(TAG)), false);
});

/* ── Bounds ────────────────────────────────────────────────────────────── */

test("nested questions compose, and the conditions arrive in the order the rules asked", async () => {
  const engine = {
    async evaluate(answers: HuntDimensionAnswers): Promise<RegulatoryOutcome> {
      if (!answers.RESIDENCY) return needsInput(RESIDENCY);
      if (answers.RESIDENCY === "NON_RESIDENT") return resolved("CLOSED");
      if (!answers.TAG_TYPE) return needsInput(TAG);
      return answers.TAG_TYPE === "GUN" ? resolved("CONDITIONAL") : resolved("CLOSED");
    },
  };
  const result = await opportunityOf(await engine.evaluate({}), engine.evaluate);
  assert.equal(result.hasCurrentLegalOpportunity, true);
  assert.deepEqual(result.conditions.map((row) => row.dimension), ["RESIDENCY", "TAG_TYPE"]);
});

test("two gates never print as one recipe", async () => {
  /* The opening values are a union over the open paths, so naming them beside
     each other would assert a combination nobody published: here RESIDENT
     opens only with a GUN tag and NON_RESIDENT only with a BOW tag, and
     "Residency: Ontario resident" above "Tag: Bow tag" reads as a hunt that is
     closed. With more than one gate the fact is named and the answers are not. */
  /* Three tags, and a third that opens for nobody, so the opening set is a
     strict subset and the "name the answers" branch is genuinely reachable. */
  const tags = dimension("TAG_TYPE", ["GUN", "BOW", "CROSSBOW"]);
  const engine = {
    async evaluate(answers: HuntDimensionAnswers): Promise<RegulatoryOutcome> {
      if (!answers.RESIDENCY) return needsInput(RESIDENCY);
      if (!answers.TAG_TYPE) return needsInput(tags);
      if (answers.TAG_TYPE === "CROSSBOW") return resolved("CLOSED");
      const legal = (answers.RESIDENCY === "RESIDENT") === (answers.TAG_TYPE === "GUN");
      return legal ? resolved("CONDITIONAL") : resolved("CLOSED");
    },
  };
  const result = await opportunityOf(await engine.evaluate({}), engine.evaluate);
  assert.equal(result.hasCurrentLegalOpportunity, true);
  for (const condition of result.conditions) {
    assert.doesNotMatch(condition.text, / label/, `named an answer while two facts gate: ${condition.text}`);
    assert.match(condition.text, /^Turns on /);
  }
});

test("a tree larger than the ceiling reports UNRESOLVED rather than a closure it never established", async () => {
  /* Every option asks the same question again, so the tree never terminates.
     The walk has to stop, and what it must NOT do is call that "closed". */
  const endless: RequiredDimension = dimension("HUNT_CODE", ["A", "B", "C", "D"]);
  let runs = 0;
  const evaluate = async (): Promise<RegulatoryOutcome> => {
    runs += 1;
    return needsInput(endless);
  };
  const result = await opportunityOf(await evaluate(), evaluate);
  assert.equal(result.hasCurrentLegalOpportunity, false);
  assert.equal(result.coverage, "UNRESOLVED");
  assert.equal(result.exhaustive, false);
  assert.ok(runs <= MAX_ENGINE_RUNS + 1, `the walk must be bounded; it ran ${runs} times`);
});

test("an opportunity found before the ceiling survives the ceiling being hit", async () => {
  const wide: RequiredDimension = dimension("HUNT_CODE", ["A", "B", "C", "D"]);
  const evaluate = async (answers: HuntDimensionAnswers): Promise<RegulatoryOutcome> => {
    if (!answers.HUNT_CODE) return needsInput(wide);
    if (answers.HUNT_CODE === "A") return resolved("CONDITIONAL");
    return needsInput(dimension("LICENCE_TYPE", ["X", "Y"]));
  };
  const result = await opportunityOf(await evaluate({}), evaluate);
  assert.equal(result.hasCurrentLegalOpportunity, true);
  // One open leaf is one open leaf; the incomplete walk is reported, not hidden.
  assert.equal(result.exhaustive, false);
});

test("the walk never answers on the hunter's behalf with \"not sure\"", async () => {
  const unsure: RequiredDimension = { ...dimension("TAG_TYPE", ["GUN"]), allowsUnsure: true };
  unsure.options = [...unsure.options, { value: "UNSURE", label: "Not sure" }];
  const seen: Array<string | undefined> = [];
  const evaluate = async (answers: HuntDimensionAnswers): Promise<RegulatoryOutcome> => {
    seen.push(answers.TAG_TYPE);
    if (!answers.TAG_TYPE) return needsInput(unsure);
    return resolved("CONDITIONAL");
  };
  await opportunityOf(await evaluate({}), evaluate);
  assert.ok(!seen.includes("UNSURE"), "UNSURE must never be walked as an answer");
});

test("answers do not leak between sibling branches of the walk", async () => {
  const seen: HuntDimensionAnswers[] = [];
  const evaluate = async (answers: HuntDimensionAnswers): Promise<RegulatoryOutcome> => {
    seen.push({ ...answers });
    if (!answers.RESIDENCY) return needsInput(RESIDENCY);
    if (!answers.TAG_TYPE) return needsInput(TAG);
    return resolved("CLOSED");
  };
  await opportunityOf(await evaluate({}), evaluate);
  const leaves = seen.filter((row) => row.RESIDENCY && row.TAG_TYPE);
  assert.equal(leaves.length, 4);
  const combinations = new Set(leaves.map((row) => `${row.RESIDENCY}/${row.TAG_TYPE}`));
  assert.equal(combinations.size, 4, "each branch must carry only its own answers");
});

/* ── The contract the map depends on ───────────────────────────────────── */

test("conditions are only ever claimed alongside an opportunity", async () => {
  const cases: ZoneOpportunity[] = [
    await opportunityOf(resolved("CLOSED"), async () => resolved("CLOSED")),
    await opportunityOf(resolved("UNKNOWN"), async () => resolved("UNKNOWN")),
    await opportunityOf(resolved("CONFLICT"), async () => resolved("CONFLICT")),
  ];
  for (const result of cases) {
    assert.equal(result.hasMaterialConditions, false);
    assert.deepEqual(result.conditions, []);
  }
});
