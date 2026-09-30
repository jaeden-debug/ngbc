import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { implementsOf, isProfiled, profileFor, resolves, type Dimension, type RuleShape } from "./dimension-matrix.ts";

function rulesFor(speciesId: string): RuleShape[] {
  const out: RuleShape[] = [];
  for (const file of readdirSync("content/regulatory").filter((name) => name.endsWith(".json"))) {
    let bundle: { rules?: RuleShape[] };
    try { bundle = JSON.parse(readFileSync(`content/regulatory/${file}`, "utf8")); } catch { continue; }
    for (const rule of bundle.rules ?? []) if (rule.speciesId === speciesId) out.push(rule);
  }
  return out;
}

test("dates alone do not certify a class-sensitive species", () => {
  /*
   * The gate the owner asked for, and the failure it names: a bundle that has
   * every date and no animal class looks complete by rule count and cannot
   * tell a hunter whether the deer in front of them is legal. Antlered with a
   * bow in October and either-sex with a rifle in November are different
   * opportunities; "deer season: Oct 1 – Nov 20" is not an answer.
   */
  const profile = profileFor("species:white-tailed-deer")!;
  assert.equal(profile.ANIMAL_CLASS, "MATERIAL", "deer legality turns on the animal class");

  const dateOnly: RuleShape = { speciesId: "species:white-tailed-deer", windows: [{ from: "2026-11-04", to: "2026-11-17" }] };
  assert.equal(resolves(dateOnly, "DATES"), true);
  assert.equal(resolves(dateOnly, "ANIMAL_CLASS"), false, "a date range must not satisfy a material class dimension");
});

test("a fact that exists only as a display string is not resolved", () => {
  /*
   * Québec's antler threshold is the legal test and lives in `classLabel` as
   * "Cerf de Virginie avec bois (7 cm ou plus)" — French prose, unqueryable.
   * Accepting it would make a display string stand in for coverage: it reads
   * as resolved and computes as nothing, so no filter, comparison or unit
   * conversion can reach it.
   */
  const proseOnly: RuleShape = { classLabel: "Cerf de Virginie avec bois (7 cm ou plus)" };
  assert.equal(resolves(proseOnly, "ANIMAL_CLASS"), false);
  assert.equal(resolves(proseOnly, "PHYSICAL_CRITERIA"), false);

  const proseImplements: RuleShape = { equipmentStatedAs: "rifle, shotgun or bow" };
  assert.equal(implementsOf(proseImplements).length, 0, "the authority's words are not a structured implement list");
});

test("implements are read from whichever shape a bundle uses", () => {
  /* Three bundles keep the same fact in three places. Normalising here is the
     point: a crossbow question cannot be answered across jurisdictions while
     one fact lives in three shapes. */
  assert.deepEqual(implementsOf({ permittedImplements: ["BOW", "CROSSBOW"] }), ["BOW", "CROSSBOW"]);
  assert.deepEqual(implementsOf({ appliesWhen: { permittedImplements: ["RIFLE"] } }), ["RIFLE"]);
});

test("an unprofiled species does not inherit big game's dimensions", () => {
  /* NOT_RESEARCHED must never arrive dressed as an answer. A species nobody
     has profiled is not thereby known to be class-insensitive. */
  assert.equal(isProfiled("species:white-tailed-deer"), true);
  assert.equal(isProfiled("species:american-crow"), false);
  assert.equal(profileFor("not-a-species"), null);
});

test("white-tailed deer: the measured gap is visible and does not silently close", () => {
  /*
   * The standing measurement. It is asserted as a FLOOR rather than pinned to
   * today's number, so landing class data makes it pass and losing class data
   * makes it fail. The gap itself is reported by `report:canada`, not hidden
   * behind a green test.
   */
  const rules = rulesFor("species:white-tailed-deer");
  assert.ok(rules.length > 200, `expected the certified deer corpus; found ${rules.length}`);

  const withClass = rules.filter((rule) => resolves(rule, "ANIMAL_CLASS")).length;
  const withImplement = rules.filter((rule) => resolves(rule, "IMPLEMENT")).length;

  assert.ok(withClass >= 44, `animal class regressed: ${withClass} of ${rules.length}`);
  assert.ok(withImplement >= 251, `implements regressed: ${withImplement} of ${rules.length}`);
  assert.ok(withClass < rules.length, "when this fails, deer class coverage is complete — raise the floor and say so");
});
