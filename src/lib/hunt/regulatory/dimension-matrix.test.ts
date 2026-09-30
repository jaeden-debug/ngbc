import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { implementsOf, isProfiled, profileFor, read, rendersScannableRow, resolves, type Dimension, type RuleShape } from "./dimension-matrix.ts";

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

test("coverage is measured over the row the interface renders, not per dimension", () => {
  /*
   * The flaw this closes, found by measuring instead of describing. Across the
   * big-game corpus: dates 100%, implements 82%, animal class 20% — which
   * reads as "most places are partly scannable". They are not. Every rule
   * where all three hold is Québec's; outside Québec the joint figure is zero.
   *
   * §8 requires capability reporting to measure deliverable answers, and a
   * per-dimension number cannot tell 88-in-one-province from 88-spread-
   * nationally.
   */
  const deer = rulesFor("species:white-tailed-deer");
  const scannable = deer.filter((rule) => rendersScannableRow(rule, "species:white-tailed-deer"));

  assert.ok(scannable.length > 0, "some rules should render the row");
  assert.ok(scannable.length < deer.length,
    "when this fails, every deer rule renders the scannable row — raise the floor and say so");

  /*
   * THE PROPERTY, not which dimension happens to be scarcest.
   *
   * This asserted that class was the binding dimension and that the joint count
   * equalled it. Two corrections changed which dimension binds: reading class
   * from `appliesWhen` as well as the top level added Alberta's twenty, and
   * refusing `declaredNoSeason: false` as a resolved date removed Ontario's
   * hundred. Class is no longer scarcest — DATES is — and an assertion naming
   * the scarcest dimension fails every time the data improves in one place.
   *
   * What must always hold is the inequality: a row needs every dimension, so
   * the joint count can never exceed the weakest single one. That catches the
   * original defect — a joint figure inflated past what any dimension supports
   * — without pinning which one is weakest this week.
   */
  for (const dimension of ["DATES", "ANIMAL_CLASS", "IMPLEMENT"] as const) {
    const single = deer.filter((rule) => resolves(rule, dimension)).length;
    assert.ok(scannable.length <= single,
      `the joint count (${scannable.length}) exceeds ${dimension} alone (${single}), which is impossible`);
  }
});

test("an explicit null is ABSENT, never quietly NOT_APPLICABLE", () => {
  /* 92 Québec rules carry `animalClasses: null`. That is either "the authority
     states no class restriction" or "nobody extracted it", and nothing in the
     data says which. Reporting the second as the first is the failure §9
     names, so the reading is explicit and the prose case is its own answer. */
  assert.equal(read({ animalClasses: null }, "ANIMAL_CLASS"), "ABSENT");
  assert.equal(read({ animalClasses: ["ANTLERED"] }, "ANIMAL_CLASS"), "PRESENT");
  assert.equal(read({ classLabel: "avec bois (7 cm ou plus)" }, "ANIMAL_CLASS"), "PROSE_ONLY",
    "the authority's words are a finding, not a resolution and not an absence");
  assert.equal(read({ equipmentStatedAs: "rifle or bow" }, "IMPLEMENT"), "PROSE_ONLY");
});

test("a rule that is merely NOT closed has not thereby stated its dates", () => {
  /*
   * THE DEFECT THIS EXISTS FOR, and it inflated the metric this file computes.
   * `declaredNoSeason` is a boolean and `filled` rejects only undefined, null
   * and the empty string — so `false` passed, and every rule carrying it
   * counted as having resolved dates.
   *
   * It reached the number the product reports: 86 of Ontario's 100 white-tailed
   * deer rules have NO `windows` and state their season as prose — "September
   * 19 to December 15", without a year — and all of them counted. Big-game
   * joint coverage read 208 of 450 and is 122.
   *
   * A DECLARED closure is a real resolution: the authority said there is no
   * season. `false` says only that nobody declared one, which is not a date.
   */
  assert.equal(resolves({ declaredNoSeason: false } as RuleShape, "DATES"), false, "not-closed is not a date");
  assert.equal(resolves({ declaredNoSeason: true } as RuleShape, "DATES"), true, "a declared closure IS an answer");
  assert.equal(resolves({ windows: [{ opensIso: "2026-10-01", closesIso: "2026-10-14" }] } as unknown as RuleShape, "DATES"), true);
  assert.equal(resolves({} as RuleShape, "DATES"), false);

  /* And over the real corpus, so the unit case cannot pass while the bundles
     say otherwise: Ontario states no structured season for deer. */
  const ontario = rulesFor("species:white-tailed-deer").filter((rule) => String(rule.sourceId ?? "").includes("ca-on"));
  assert.ok(ontario.length > 0, "positive control: Ontario deer rules are in the corpus");
  assert.equal(ontario.filter((rule) => rule.windows || rule.window).length, 0,
    "Ontario states no structured season WINDOW; if this changes it can render the scannable row");
  /* What does resolve for Ontario is its declared closures, and only those —
     which is a real answer and still not an opportunity, so the adapter emits
     no row for them. Pinned, so the day a season is extracted this moves. */
  const resolved = ontario.filter((rule) => resolves(rule, "DATES"));
  assert.equal(resolved.length, 14, "Ontario's only resolved dates are its declared closures");
  assert.ok(resolved.every((rule) => rule.declaredNoSeason === true), "and every one of them is a closure, not a season");
});

