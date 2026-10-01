import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import conditionKinds from "../../../../content/regulatory/condition-kinds.json" with { type: "json" };
import { test } from "node:test";
import {
  animalClassesOf, DELIVERY_LEVEL, HUNTER_DIMENSIONS, hunterDimensionsOf, implementsOf, isProfiled,
  LEGAL_HOURS_JURISDICTIONS, legalHoursDelivery, profileFor, read, rendersScannableRow,
  resolves, undeclaredConditionKinds, type Dimension, type RuleShape,
} from "./dimension-matrix.ts";

const CONDITION_KINDS_FOR_TEST =
  (conditionKinds as { conditions: Record<string, { kind: string; scope: string }> }).conditions;

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

  /*
   * And over the real corpus, so the unit case cannot pass while the bundles
   * say otherwise. THE PIN MOVED, which is what it was for: Ontario's seasons
   * are now extracted from O. Reg. 670/98 into `ca-on-open-seasons-2026.json`,
   * where 96 of 125 deer rules carry a window and 29 state a closure.
   *
   * The CERTIFIED bundle the product reads still carries none, and that is the
   * remaining work rather than an oversight — the two are asserted separately
   * so "the instrument is read" can never be mistaken for "the answer is
   * served". §8 counts deliverable answers.
   */
  const deer = rulesFor("species:white-tailed-deer").filter((rule) => String(rule.sourceId ?? "").includes("ca-on"));
  assert.ok(deer.length > 0, "positive control: Ontario deer rules are in the corpus");

  /* THE PIN MOVED, which is what it was for. The certified bundle now carries
     O. Reg. 670/98's own windows, joined on (species, every unit in the group,
     residency, exact derived windows) — and the rules the join could not
     account for kept their prose and gained nothing, so they still answer only
     where the authority did. */
  const certified = deer.filter((rule) => String(rule.sourceId).includes("ca-on-deer"));
  const windowed = certified.filter((rule) => rule.windows || rule.window);
  assert.ok(windowed.length > 60, `only ${windowed.length} certified Ontario deer rules carry a window`);
  const resolved = certified.filter((rule) => resolves(rule, "DATES"));
  assert.equal(resolved.length, windowed.length + certified.filter((rule) => rule.declaredNoSeason === true).length,
    "every resolved date is either a joined window or a declared closure — nothing else may count");
  assert.ok(certified.some((rule) => !resolves(rule, "DATES")),
    "and the rules the join refused must still answer nothing; if none do, the refusal path stopped working");

  /*
   * And the extraction is NOT in this corpus, deliberately. It lives in
   * `content/regulatory/extracted/`, which these globs do not reach, because
   * putting it beside the certified bundles made the readiness report drop
   * RESOLVED dimensions for four species and claim elk as covered when nothing
   * serves it. An extraction is an encoded record; §8 counts deliverable
   * answers. It moves up a directory on the day it is wired in, and this
   * assertion is what notices.
   */
  const extracted = JSON.parse(readFileSync("content/regulatory/extracted/ca-on-open-seasons-2026.json", "utf8"));
  assert.ok(extracted.rules.length >= 160, "the extraction itself should be substantial");
  assert.equal(deer.some((rule) => String(rule.sourceId).includes("oreg-670")), false,
    "an extraction must not be counted as serving coverage until it is served");
});


test("a class named without a link to its definition is unresolved, not satisfied", () => {
  /*
   * The word is a filter; it is not an identity. Québec's « avec bois (norme
   * RTLB) » and « avec bois (7 cm ou plus) » both flatten to ANTLERED, as does
   * Ontario's 7.5 cm class and Alberta's 10.2 cm one. Matching on the word
   * handed eight zone 6 nord / 6 sud rules the 7 cm threshold from a standard
   * they do not apply.
   */
  const bundle = {
    legalAnimalClasses: [
      {
        id: "legal_animal_class:x-antlered", statedAs: "antlered", statedLanguage: "en" as const,
        appliesToSpecies: ["species:white-tailed-deer"], criterionStatus: "STATED" as const,
        criterion: {
          measure: "ANTLER_LENGTH" as const, comparator: "AT_LEAST" as const,
          published: [{ value: 7.5, unit: "cm" as const }], aggregation: "ANY_SIDE" as const,
          statedAs: "at least 1 antler of at least 7.5 centimetres long", statedLanguage: "en" as const,
          sourceId: "source:x",
        },
        sourceId: "source:x",
      },
    ],
  };
  const named = { speciesId: "species:white-tailed-deer", animalClasses: ["ANTLERED"] };
  assert.equal(resolves(named, "PHYSICAL_CRITERIA", bundle), false, "named, unlinked: we hold no test for it");
  assert.equal(
    resolves({ ...named, legalAnimalClassIds: ["legal_animal_class:x-antlered"] }, "PHYSICAL_CRITERIA", bundle),
    true,
  );
  assert.equal(
    resolves({ ...named, legalAnimalClassIds: ["legal_animal_class:x-rtlb"] }, "PHYSICAL_CRITERIA", bundle),
    false,
    "a link to a class nothing defines is a gap, not a pass",
  );
  /* A rule naming no class has no membership test to state. Not a gap. */
  assert.equal(resolves({ speciesId: "species:white-tailed-deer" }, "PHYSICAL_CRITERIA", bundle), true);
});

/* ── Three dimensions that read 0% while shipping ────────────────────────── */

test("hunter class is read from the engine's own declared dimensions", () => {
  /*
   * `resolves` returned a flat `false` for HUNTER_CLASS, AUTHORIZATION and
   * LEGAL_HOURS, and its own comment predicted what went wrong: "the day the
   * data lands they would still read UNRESOLVED, and nobody would know whether
   * that was the data or this function." The data landed — 248 of 466 big-game
   * rules are scoped by a hunter dimension — and the report still said none.
   *
   * §8 forbids understating a capability as firmly as overstating one, and this
   * is the understating direction, which nobody complains about.
   */
  assert.deepEqual(hunterDimensionsOf({ appliesWhen: { RESIDENCY: "RESIDENT" } }), ["RESIDENCY"]);
  assert.deepEqual(hunterDimensionsOf({ appliesWhen: { RESIDENCY: "RESIDENT", HUNTER_AGE: "UNDER_18" } }),
    ["RESIDENCY", "HUNTER_AGE"]);
  assert.equal(resolves({ appliesWhen: { RESIDENCY: "NON_RESIDENT" } }, "HUNTER_CLASS"), true);

  /* An implement is not a hunter, and the list comes from `dimensions.ts`'s own
     vocabulary rather than a regex over key names — a key matching /HUNTER/ is
     a field shape, and which dimensions describe a hunter is already declared. */
  assert.deepEqual(hunterDimensionsOf({ appliesWhen: { permittedImplements: ["BOW"] } }), []);
  assert.deepEqual(hunterDimensionsOf({ appliesWhen: { "ANIMAL_CLASS:ANTLER_CLASS": "ANTLERED" } }), []);
  assert.equal(resolves({ appliesWhen: {} }, "HUNTER_CLASS"), false);
});

test("authorization is resolved by a condition's DECLARED kind, never its name", () => {
  /* `condition-kinds.json` declares a kind per condition id — the same table
     §41A's `!` marker reads — so a rule linking a LICENCE or TAG_OR_DRAW has
     settled that an authorization is required, as structured data with
     provenance. Which licence is a different question, answered in the
     condition's text and in Ready to Hunt. */
  const licence = Object.entries(CONDITION_KINDS_FOR_TEST).find(([, value]) => value.kind === "LICENCE")?.[0];
  assert.ok(licence, "positive control: some condition is declared a LICENCE");
  assert.equal(resolves({ conditionIds: [licence] }, "AUTHORIZATION"), true);

  const method = Object.entries(CONDITION_KINDS_FOR_TEST).find(([, value]) => value.kind === "METHOD")?.[0];
  assert.ok(method);
  assert.equal(resolves({ conditionIds: [method] }, "AUTHORIZATION"), false, "a method rule is not an authorization");

  /* An id with no declared kind counts for nothing and is its own reported gap
     — reading the kind off the id's spelling is the field-shape defect again. */
  assert.equal(resolves({ conditionIds: ["something-licence-shaped"] }, "AUTHORIZATION"), false);
  assert.deepEqual(undeclaredConditionKinds({ conditionIds: ["something-licence-shaped", licence!] }),
    ["something-licence-shaped"]);
});

test("legal hours is delivered per jurisdiction and point, not per rule", () => {
  /*
   * A legal window is a wall-clock time at a POINT on a DATE: `legalTimeFor`
   * takes the jurisdiction's rule, the coordinates and the timezone. So no rule
   * carries it, a per-rule count can only be 0, and that 0 read as "North
   * Ground has no legal hours anywhere" while the interface was rendering
   * windows for eight jurisdictions.
   */
  assert.equal(DELIVERY_LEVEL.LEGAL_HOURS, "PER_JURISDICTION_AND_POINT");
  assert.equal(DELIVERY_LEVEL.DATES, "PER_RULE");
  assert.equal(resolves({ jurisdictionId: "jurisdiction:ca-on" }, "LEGAL_HOURS"), false,
    "a rule still does not carry it; the fix is the unit, not the answer");

  /*
   * TWO NECESSARY CONDITIONS, and the first version of this checked one.
   * It asked only whether a module exists and reported 453 of 466 rules
   * delivered. A window is a wall-clock time, so `legalTimeFor` refuses without
   * a point timezone — and Ontario, Québec, British Columbia, Newfoundland and
   * Idaho each genuinely span zones with no licensed point dataset. The true
   * figure is three jurisdictions and 107 rules.
   *
   * The correction to a 0% became an overstatement inside the same work: the
   * failure direction flipped and the shape did not, which is a capability
   * measured by one of the things it needs.
   */
  assert.equal(legalHoursDelivery({ jurisdictionId: "jurisdiction:ca-mb" }), "DELIVERED",
    "Manitoba: module and a single-zone clock");
  assert.equal(legalHoursDelivery({ jurisdictionId: "jurisdiction:ca-on" }), "RULE_READ_NO_POINT_TIMEZONE",
    "Ontario's rule is read; its clock cannot be computed, which is a different queue");
  assert.equal(legalHoursDelivery({ jurisdictionId: "jurisdiction:ca-ns" }), "NOT_CERTIFIED");
  /* Most bundles state the jurisdiction once at the top and only Ontario
     repeats it per rule. Reading the rule alone reported UNKNOWN_JURISDICTION
     for 331 of 466 — the same measurement defect a third time in one file. */
  assert.equal(legalHoursDelivery({}), "UNKNOWN_JURISDICTION");
  assert.equal(legalHoursDelivery({}, { jurisdictionId: "jurisdiction:ca-ab" }), "DELIVERED");
});

test("the legal-hours list is checked against capability, not against filenames", () => {
  /*
   * THE CONTROL THAT WAS WRONG BECAUSE IT SHARED THE CLAIM'S PROXY.
   *
   * It asserted this list against the `*-legal-time.ts` files on disk. New
   * Brunswick and Saskatchewan both keep their hours rule inline in their own
   * vocabulary and both return a resolved window — neither has a file, so both
   * were reported NOT_CERTIFIED while shipping, and the control passed because
   * it was measuring the same proxy the claim was wrong about.
   *
   * What it checks now is the fact: a jurisdiction on this list must have a
   * point timezone, because without one no window can be computed whatever rule
   * it holds. That is the half of the capability this module can see from here,
   * and it is the half that was wrong the first time.
   */
  assert.ok(LEGAL_HOURS_JURISDICTIONS.length >= 10, `only ${LEGAL_HOURS_JURISDICTIONS.length} jurisdictions listed`);
  assert.deepEqual([...LEGAL_HOURS_JURISDICTIONS].sort(), [...LEGAL_HOURS_JURISDICTIONS],
    "kept sorted, so a diff to this list is readable");
  assert.equal(new Set(LEGAL_HOURS_JURISDICTIONS).size, LEGAL_HOURS_JURISDICTIONS.length, "no duplicates");

  /* The two that had no file and were therefore missing. Named, so removing
     them silently fails rather than quietly reverting the correction. */
  assert.ok(LEGAL_HOURS_JURISDICTIONS.includes("jurisdiction:ca-nb"),
    "New Brunswick keeps its rule inline and delivers a window");
  assert.ok(LEGAL_HOURS_JURISDICTIONS.includes("jurisdiction:ca-sk"),
    "Saskatchewan keeps its rule inline and delivers a window");

  /* And a jurisdiction NOT listed must be genuinely unable: Nova Scotia has no
     hours rule at all, which is why its rules read NOT_CERTIFIED. */
  assert.ok(!LEGAL_HOURS_JURISDICTIONS.includes("jurisdiction:ca-ns"));
  assert.equal(legalHoursDelivery({ jurisdictionId: "jurisdiction:ca-ns" }), "NOT_CERTIFIED");
});

test("every listed jurisdiction has an hours RULE that can be reached", async () => {
  /*
   * THE HALF THE PREVIOUS CONTROL COULD NOT SEE, named by the moderator lane
   * rather than discovered by me: it asserted that two jurisdictions WERE listed
   * and that Nova Scotia was not, which stops a specific regression and nothing
   * general. A jurisdiction could still be added here with no hours rule
   * anywhere, and the only thing contradicting it would be a by-name assertion
   * about a different province.
   *
   * So the universe is discovered, the same way `legal-time.test.ts` discovers
   * the rules it checks the sign of: every module in the directory is imported,
   * every exported rule carrying an offset basis is collected, and the
   * jurisdiction is read from the rule's own `sourceId` — which is where it
   * already lives, so nothing is inferred from a filename. Filenames are what
   * the previous control measured, and they are why New Brunswick and
   * Saskatchewan were missing: both keep their rule inline.
   *
   * BOTH directions are asserted. A listed jurisdiction with no reachable rule
   * claims a capability that does not exist; a reachable rule whose jurisdiction
   * is not listed is the understatement that started this whole thread.
   */
  const directory = new URL(".", import.meta.url);
  const modules = readdirSync(directory).filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"));
  assert.ok(modules.length > 10, `only ${modules.length} modules to scan`);

  const OFFSET_BASES = ["SUNRISE_SUNSET_OFFSET", "SUNRISE_OFFSET_TO_FIXED_CLOSE", "SUNRISE_TO_SUNSET", "FIXED_LOCAL_TIMES"];
  const reachable = new Map<string, string[]>();
  for (const file of modules) {
    let exported: Record<string, unknown>;
    try { exported = (await import(`./${file}`)) as Record<string, unknown>; } catch { continue; }
    for (const [name, value] of Object.entries(exported)) {
      if (!value || typeof value !== "object") continue;
      const rule = value as { basis?: string; sourceId?: string; statedAs?: string };
      if (!OFFSET_BASES.includes(rule.basis ?? "") || typeof rule.sourceId !== "string") continue;
      /* `source:ca-nb-fish-and-wildlife-act` → `jurisdiction:ca-nb`. The code is
         already in the id, so this reads a declared fact rather than a filename. */
      const code = /^source:((?:ca|us)-[a-z]{2})-/.exec(rule.sourceId)?.[1];
      assert.ok(code, `${file}:${name} has a sourceId this cannot attribute: ${rule.sourceId}`);
      const jurisdiction = `jurisdiction:${code}`;
      reachable.set(jurisdiction, [...(reachable.get(jurisdiction) ?? []), `${file}:${name}`]);
    }
  }

  assert.ok(reachable.size >= 11, `only ${reachable.size} jurisdictions have a reachable hours rule`);
  for (const jurisdiction of LEGAL_HOURS_JURISDICTIONS) {
    assert.ok(reachable.has(jurisdiction),
      `${jurisdiction} is listed as able to state a window and no hours rule for it could be found`);
  }
  for (const [jurisdiction, rules] of reachable) {
    assert.ok(LEGAL_HOURS_JURISDICTIONS.includes(jurisdiction),
      `${jurisdiction} has an hours rule (${rules.join(", ")}) and is not listed — the understatement this list already had twice`);
  }
});
