import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { opportunityRowsFrom } from "./opportunity-adapter.ts";
import { NOT_APPLICABLE, stated, UNRESOLVED, type ResolvedOpportunity } from "./opportunity-row.ts";
import {
  ANIMAL_CLASS_LABELS, FORBIDDEN_GUESSES, IMPLEMENT_LABELS, opportunityCard,
  presentAnimalClass, presentImplements,
} from "./opportunity-presentation.ts";
import type { RuleShape } from "./dimension-matrix.ts";

const DEER = "species:white-tailed-deer";

function bundleRules(file: string, speciesId = DEER): RuleShape[] {
  const bundle = JSON.parse(readFileSync(new URL(`../../../../content/regulatory/${file}`, import.meta.url), "utf8")) as {
    rules?: RuleShape[];
  };
  return (bundle.rules ?? []).filter((rule) => rule.speciesId === speciesId);
}

const row = (over: Partial<ResolvedOpportunity> = {}): ResolvedOpportunity => ({
  ruleId: "regulatory_rule:test",
  speciesId: DEER,
  animalClass: stated("ANTLERED"),
  criterion: null,
  implements: stated(["RIFLE", "BOW"]),
  windows: [{ opens: "2026-10-01", closes: "2026-10-14", datesInclusive: true }],
  conditionIds: [],
  ...over,
});

test("every token the corpus uses has an interface label", () => {
  /*
   * A token with no label renders as `MUZZLELOADER` — a database value on a
   * hunter's screen. The universe is read from the committed bundles rather
   * than from this file's own map, so a jurisdiction introducing a token nobody
   * has labelled fails here instead of shipping.
   */
  const implementTokens = new Set<string>();
  const classTokens = new Set<string>();
  for (const file of readdirSync(new URL("../../../../content/regulatory", import.meta.url).pathname)) {
    if (!file.endsWith(".json")) continue;
    let bundle: { rules?: Array<Record<string, unknown>> };
    try {
      bundle = JSON.parse(readFileSync(new URL(`../../../../content/regulatory/${file}`, import.meta.url), "utf8"));
    } catch { continue; }
    for (const rule of bundle.rules ?? []) {
      const applies = (rule.appliesWhen ?? {}) as Record<string, unknown>;
      for (const source of [rule.permittedImplements, applies.permittedImplements]) {
        if (Array.isArray(source)) for (const token of source) implementTokens.add(String(token));
      }
      if (Array.isArray(rule.animalClasses)) for (const token of rule.animalClasses) classTokens.add(String(token));
      for (const [key, value] of Object.entries(applies)) {
        if (key.startsWith("ANIMAL_CLASS:") && typeof value === "string") classTokens.add(value);
      }
    }
  }
  assert.ok(implementTokens.size >= 5, `positive control: found only ${implementTokens.size} implement tokens`);
  assert.ok(classTokens.size >= 2, `positive control: found only ${classTokens.size} class tokens`);

  assert.deepEqual(
    [...implementTokens].filter((token) => !IMPLEMENT_LABELS[token]).sort(), [],
    "these implement tokens would render as raw enum values",
  );
  assert.deepEqual(
    [...classTokens].filter((token) => !ANIMAL_CLASS_LABELS[token]).sort(), [],
    "these class tokens would render as raw enum values",
  );
});

test("a missing dimension is never guessed into a permission", () => {
  /*
   * THE FOUR SENTENCES, each a legal claim North Ground has no evidence for and
   * each one a hunter would act on. The type no longer offers a renderer the
   * value it would have guessed from, so this asserts the output rather than
   * the input: nothing an unresolved row produces may read as permission.
   */
  const unknown = opportunityCard(row({ animalClass: UNRESOLVED, implements: UNRESOLVED }));
  const rendered = JSON.stringify(unknown);
  for (const phrase of FORBIDDEN_GUESSES) {
    assert.ok(!rendered.includes(phrase), `an unresolved row rendered "${phrase}"`);
  }
  assert.equal(unknown.animalClass.kind, "UNKNOWN");
  assert.equal(unknown.implements.kind, "UNKNOWN");
  assert.equal(unknown.implements.chips, undefined, "no chips are offered for methods nobody established");
});

test("a dimension the authority does not use is omitted, not marked unknown", () => {
  /*
   * Two different rows, and the difference is whether the hunter should be told
   * anything. A grouse has no antler class, so a "Not established" line there
   * would be the warning that fires everywhere and is read nowhere (§41A). A
   * deer does, so its silence is a gap worth naming.
   */
  assert.equal(presentAnimalClass(row({ animalClass: NOT_APPLICABLE })).kind, "OMITTED");
  assert.equal(presentAnimalClass(row({ animalClass: UNRESOLVED })).kind, "UNKNOWN");
});

test("methods render as interface labels; the ministry's heading never becomes a chip", () => {
  const presented = presentImplements(row({ implements: stated(["CROSSBOW", "MUZZLELOADER"]) }));
  assert.deepEqual(presented.chips, ["Crossbow", "Muzzleloader"]);
  assert.equal(presented.kind, "VALUE");
  /* Three things kept apart: the computational value, the interface label, and
     the authority's own words. A chip is never the third. */
  const rendered = JSON.stringify(presented);
  assert.ok(!rendered.includes("CROSSBOW"), "the normalized value is not what a reader sees");
  assert.ok(!/arbal|armes à feu/i.test(rendered), "the ministry's French heading never reaches a chip");
});

test("two classes on one rule read as one season, both labelled", () => {
  const presented = presentAnimalClass(row({ animalClass: stated("ANTLERED or ANTLERLESS") }));
  assert.deepEqual(presented, { kind: "VALUE", text: "Antlered or Antlerless" });
});

test("cards from Québec and Alberta both render, through one path", () => {
  /*
   * The two shapes, end to end: rules in, cards out, with no jurisdiction named
   * anywhere between. If a surface ever needs changing to add a jurisdiction,
   * the variation was in presentation code where it does not belong.
   */
  for (const [name, file] of [["Québec", "ca-qc-2026.json"], ["Alberta", "ca-ab-2026.json"]] as const) {
    const cards = opportunityRowsFrom({ speciesId: DEER, rules: bundleRules(file) }).map(opportunityCard);
    assert.ok(cards.length > 0, `${name}: no cards`);

    const withClass = cards.filter((card) => card.animalClass.kind === "VALUE");
    const withMethods = cards.filter((card) => card.implements.kind === "VALUE");
    assert.ok(withClass.length > 0, `${name}: no card states a legal animal`);
    assert.ok(withMethods.length > 0, `${name}: no card states a method`);

    for (const card of cards) {
      /* No raw enum reaches a reader, from any bundle. */
      const text = JSON.stringify(card);
      for (const token of Object.keys(IMPLEMENT_LABELS)) {
        assert.ok(!text.includes(`"${token}"`), `${name}: card ${card.ruleId} carries the raw token ${token}`);
      }
      for (const phrase of FORBIDDEN_GUESSES) {
        assert.ok(!text.includes(phrase), `${name}: card ${card.ruleId} rendered "${phrase}"`);
      }
      /* Every card has dates, because a row without them was never emitted. */
      assert.ok(card.windows.length > 0, `${name}: card ${card.ruleId} has no window`);
    }
  }
});

test("a small-game card omits the class line the species does not have", () => {
  /* Read through the adapter rather than constructed, so the profile decides it
     and this cannot pass while the adapter disagrees. */
  const cards = opportunityRowsFrom({
    speciesId: "species:ruffed-grouse",
    rules: [{ speciesId: "species:ruffed-grouse", permittedImplements: ["SHOTGUN"], windows: [{ opensIso: "2026-09-19", closesIso: "2026-12-15" }] } as unknown as RuleShape],
  }).map(opportunityCard);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].animalClass.kind, "OMITTED", "a grouse has no antler class, so the line is not there at all");
  assert.deepEqual(cards[0].implements.chips, ["Shotgun"]);
});
