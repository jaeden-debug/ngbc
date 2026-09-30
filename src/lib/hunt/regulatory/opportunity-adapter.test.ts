import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { absenceOf, opportunityRowsFrom } from "./opportunity-adapter.ts";
import { availableChoices, matchingOpportunities } from "./opportunity-row.ts";
import type { RuleShape } from "./dimension-matrix.ts";

/**
 * The adapter is proved against THREE bundles that keep the same fact in three
 * different places, because proving it against one would prove only that one.
 *
 *   Québec   implements and classes at the top level
 *   Ontario  implements under `appliesWhen`, classes at the top level
 *   Alberta  BOTH under `appliesWhen`
 *
 * If a surface ever needs changing to add a jurisdiction, the variation was in
 * presentation code where it does not belong. These tests are what notices.
 */

function bundleRules(file: string, speciesId: string): RuleShape[] {
  const bundle = JSON.parse(readFileSync(new URL(`../../../../content/regulatory/${file}`, import.meta.url), "utf8")) as {
    rules?: RuleShape[];
  };
  return (bundle.rules ?? []).filter((rule) => rule.speciesId === speciesId);
}

const DEER = "species:white-tailed-deer";
/**
 * The two bundles that hold a COMPLETE tuple, and they keep their facts in
 * different places — which is what makes them a proof rather than one example.
 *
 * Ontario is deliberately not here. It has classes and implements and **no
 * structured dates at all**: zero of its 135 major-game rules contain an ISO
 * date, and the season is prose — "September 19 to December 15", without even a
 * year. `ontarioYieldsNothing` below asserts that state with its reason, so the
 * day its dates land the test says so rather than staying quietly green.
 */
const COMPLETE = [
  { name: "Québec", file: "ca-qc-2026.json" },
  { name: "Alberta", file: "ca-ab-2026.json" },
] as const;
const JURISDICTIONS = COMPLETE;

test("every bundle yields rows, and each keeps its facts somewhere different", () => {
  /* A positive control. Every assertion below passes over an empty row list, so
     an adapter that silently produced nothing would turn this file green. */
  for (const { name, file } of JURISDICTIONS) {
    const rules = bundleRules(file, DEER);
    assert.ok(rules.length > 10, `${name}: expected a real corpus, found ${rules.length} rules`);
    const rows = opportunityRowsFrom({ speciesId: DEER, rules });
    assert.ok(rows.length > 0, `${name}: the adapter produced no rows at all`);
  }
});

test("the class is read wherever the bundle keeps it — not only Québec's home", () => {
  /*
   * THE DEFECT THIS WOULD HAVE HIDDEN. `resolves()` read animal class from the
   * top level ONLY, while `implementsOf` had always read both homes. Alberta
   * keeps class under `appliesWhen` as `ANIMAL_CLASS:ANTLER_CLASS`, so twenty
   * Alberta deer rules that DO state a class counted as unresolved and the
   * coverage metric reported Alberta at exactly zero.
   */
  const stated = (file: string) =>
    opportunityRowsFrom({ speciesId: DEER, rules: bundleRules(file, DEER) })
      .filter((row) => row.animalClass.state === "STATED").length;

  assert.ok(stated("ca-qc-2026.json") > 0, "Québec keeps classes at the top level");
  assert.ok(stated("ca-ab-2026.json") > 0, "Alberta keeps them under appliesWhen — the one that was being missed");
});

test("the implement is read wherever the bundle keeps it", () => {
  for (const { name, file } of JURISDICTIONS) {
    const rows = opportunityRowsFrom({ speciesId: DEER, rules: bundleRules(file, DEER) });
    assert.ok(
      rows.some((row) => row.implements.state === "STATED"),
      `${name}: no row states an implement, so the adapter is not reading this bundle's shape`,
    );
  }
});

test("an absent dimension is UNRESOLVED for big game and NOT_APPLICABLE for small", () => {
  /*
   * THE CHOICE THAT MUST NOT BE A GUESS. It is read from the species profile —
   * a declaration about the world — rather than from whether a field happens to
   * be present. Big game has antler classes, so an absent one is a gap. Small
   * game does not, so an absent one is the authority not using the dimension.
   */
  assert.deepEqual(absenceOf(DEER, "ANIMAL_CLASS"), { state: "UNRESOLVED" });
  assert.deepEqual(absenceOf("species:ruffed-grouse", "ANIMAL_CLASS"), { state: "NOT_APPLICABLE" });
  /* POSSIBLE is NOT a licence for NOT_APPLICABLE: it means the dimension exists
     for this species somewhere, so its absence here is exactly unestablished. */
  assert.deepEqual(absenceOf(DEER, "HUNTER_CLASS"), { state: "UNRESOLVED" });
  /* Implements can decide legality for every profiled species, so an absent
     implement is never read as "all methods". */
  assert.deepEqual(absenceOf("species:ruffed-grouse", "IMPLEMENT"), { state: "UNRESOLVED" });
});

test("no row is emitted for a closure, or for a season with no dates", () => {
  /* A closure is a status, not an opportunity, and status is the engine's to
     give. A window missing an end would put a date on screen the authority
     never published. */
  const rules: RuleShape[] = [
    { speciesId: DEER, declaredNoSeason: true, windows: [{ opensIso: "2026-10-01", closesIso: "2026-10-14" }] } as RuleShape,
    { speciesId: DEER, windows: [{ opensIso: "2026-10-01" }] } as RuleShape,
    { speciesId: DEER, windows: [] } as RuleShape,
  ];
  assert.deepEqual(opportunityRowsFrom({ speciesId: DEER, rules }), []);
});

test("a rule stating two classes is one season, not two", () => {
  /* ["ANTLERED","ANTLERLESS"] is one season in which either may be taken.
     Splitting it into two rows would invent a season the authority never
     published, which is the same failure as merging two it did. */
  const rows = opportunityRowsFrom({
    speciesId: DEER,
    rules: [{ speciesId: DEER, animalClasses: ["ANTLERED", "ANTLERLESS"], permittedImplements: ["RIFLE"], windows: [{ opensIso: "2026-10-01", closesIso: "2026-10-14" }] } as RuleShape],
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].animalClass.state, "STATED");
});

test("a filter over real Alberta rules admits only what is established", () => {
  /*
   * THE OWNER'S CASE, END TO END OVER CERTIFIED DATA rather than over fixtures.
   * Alberta's archery-only rules state BOW; its general seasons state a wider
   * set. A CROSSBOW filter must return the rules that state crossbow and must
   * NOT return an archery-only rule, and must never return a rule whose
   * implements nobody has established.
   */
  const rows = opportunityRowsFrom({ speciesId: DEER, rules: bundleRules("ca-ab-2026.json", DEER) });
  const choices = availableChoices(rows);
  assert.ok(choices.implements.includes("BOW"), "Alberta states BOW");
  assert.ok(choices.implements.includes("CROSSBOW"), "and CROSSBOW on its general seasons");

  const crossbow = matchingOpportunities(rows, { implement: "CROSSBOW" });
  assert.ok(crossbow.length > 0, "positive control: some Alberta rule permits a crossbow");
  for (const row of crossbow) {
    assert.notEqual(row.implements.state, "UNRESOLVED", "an unestablished implement cannot satisfy a filter");
    if (row.implements.state === "STATED") {
      assert.ok(row.implements.value.includes("CROSSBOW"), `row ${row.ruleId} matched without stating CROSSBOW`);
    }
  }
  const archeryOnly = rows.filter((row) => row.implements.state === "STATED" && row.implements.value.join() === "BOW");
  assert.ok(archeryOnly.length > 0, "positive control: Alberta has archery-only seasons");
  for (const row of archeryOnly) assert.ok(!crossbow.includes(row), "an archery-only season is not a crossbow season");
});

test("a filter offers no choice that no rule in context supports", () => {
  for (const { name, file } of JURISDICTIONS) {
    const rows = opportunityRowsFrom({ speciesId: DEER, rules: bundleRules(file, DEER) });
    const { animalClasses, implements: methods } = availableChoices(rows);
    for (const method of methods) {
      assert.ok(
        matchingOpportunities(rows, { implement: method }).length > 0,
        `${name}: offers ${method} but no rule supports it`,
      );
    }
    for (const animalClass of animalClasses) {
      assert.ok(
        matchingOpportunities(rows, { animalClass }).length > 0,
        `${name}: offers ${animalClass} but no rule supports it`,
      );
    }
  }
});

test("Ontario yields no rows, and the reason is its dates rather than this adapter", () => {
  /*
   * A CORRECTION TO A NUMBER THIS PRODUCT REPORTED. The coverage metric read
   * Ontario at 76% of its big game "date + class + implement" complete. It is
   * 11%, and the 11% is closures. Ontario has classes and implements and no
   * structured season at all — `resolves(rule, "DATES")` was counting
   * `declaredNoSeason: false` as a resolved date, because `filled` rejects only
   * undefined, null and the empty string and accepts `false`.
   *
   * So the adapter emitting nothing for Ontario is CORRECT: there is no window
   * to put on a card, and inventing one from "September 19 to December 15" —
   * which carries no year — would put a date on screen the ministry never
   * published in a form anyone certified.
   *
   * This asserts the zero WITH its reason. The day Ontario's dates are
   * extracted, this fails and someone is told to move Ontario into COMPLETE
   * rather than discovering the rows appeared.
   */
  const rules = bundleRules("ca-on-major-game-2026.json", DEER);
  assert.ok(rules.length > 50, `positive control: Ontario's deer corpus is present (${rules.length} rules)`);
  assert.ok(rules.some((rule) => (rule.animalClasses as string[] | undefined)?.length), "and it does state classes");

  const withDates = rules.filter((rule) => rule.windows || rule.window).length;
  assert.equal(withDates, 0, "Ontario states no structured season window; if this changes, move it into COMPLETE");
  assert.deepEqual(opportunityRowsFrom({ speciesId: DEER, rules }), [], "so there is no opportunity row to draw");
});

test("adding a jurisdiction needs no change here — the two already differ", () => {
  /*
   * The property the whole contract exists for, asserted rather than hoped: one
   * call, three bundles that keep their facts in three different places, and
   * rows out of all three. Ontario's classes landed after this adapter was
   * written and needed nothing beyond reading its own home for the class.
   */
  const perJurisdiction = JURISDICTIONS.map(({ name, file }) => {
    const rows = opportunityRowsFrom({ speciesId: DEER, rules: bundleRules(file, DEER) });
    return { name, rows: rows.length, withClass: rows.filter((r) => r.animalClass.state === "STATED").length };
  });
  for (const { name, rows, withClass } of perJurisdiction) {
    assert.ok(rows > 0 && withClass > 0, `${name}: ${rows} rows, ${withClass} with a stated class`);
  }
});
