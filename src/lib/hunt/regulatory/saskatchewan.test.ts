import assert from "node:assert/strict";
import test from "node:test";
import { catalogueSpecies } from "../intelligence/species-catalogue.ts";
import {
  SASKATCHEWAN_BUNDLE, SASKATCHEWAN_HOURS, SASKATCHEWAN_LICENCE_CLASSES, SASKATCHEWAN_SPECIES,
  SASKATCHEWAN_VOCABULARY, evaluateSaskatchewan, saskatchewanCoverageReport,
} from "./saskatchewan.ts";
import { GAME_BIRD_MANAGEMENT_UNITS, gameBirdDistrictOf, zonesWithNoGameBirdDistrict } from "./saskatchewan-geography.ts";
import { envelopeContains } from "./saskatchewan-methods.ts";

/**
 * These tests ask the ENGINE, not the bundle.
 *
 * Nova Scotia shipped eleven passing tests and answered CLOSED at every point in
 * the province, because every one of them read the bundle and none of them asked
 * the engine a question. A Saskatchewan test that only inspects
 * `SASKATCHEWAN_BUNDLE` proves nothing about what a hunter is told.
 */

const zone = (designation: string, latitude = 52.13, longitude = -106.67) => ({
  zoneId: `management_zone:ca-sk-wmz-${designation.toLowerCase()}`,
  zoneName: designation,
  latitude, longitude,
  overlays: new Set<string>(),
});

function ask(speciesId: string, designation: string, date: string, answers: Record<string, string> = {}) {
  const evaluation = evaluateSaskatchewan({
    speciesId, speciesName: speciesId.replace("species:", ""), date,
    place: zone(designation), answers,
  });
  assert.ok(evaluation.result, `no result for ${speciesId} in zone ${designation} on ${date}`);
  return evaluation.result;
}

/* The one licence that reaches zone 29 for deer, named exactly as the regulation
   names it. Saskatchewan writes every season for a licence class, so an answer
   without one is NEEDS_INPUT rather than a status — which is correct, and is why
   every evaluation below supplies one. */
const SK_RESIDENT_DEER = "First Saskatchewan Resident White-tailed Deer Licence";

test("a hunter standing in a Saskatchewan zone is told a season, not a closure", () => {
  /* The Nova Scotia regression, asked directly: there, `units` was a bare string
     array and the geography held zone ids, so `areaOf` returned null at every
     point in the province and all eleven rules were silently inapplicable —
     CLOSED everywhere, in production, with eleven passing tests. Deer archery
     runs 15 September to 14 October in zone 29 (OSGR s. 92). */
  const deer = ask("species:white-tailed-deer", "29", "2026-09-15",
    { LICENCE_TYPE: SK_RESIDENT_DEER, HUNT_METHOD: "BOW" });
  assert.equal(deer.status, "CONDITIONAL");
  assert.ok(deer.sourceIds.length > 0);
});

test("asking for a licence is the answer, not a missing one", () => {
  /* Saskatchewan's seasons differ by licence class in both zones and dates, so
     the engine asks before it answers. A status produced without the class would
     be a guess about which hunter is standing there. */
  const evaluation = evaluateSaskatchewan({
    speciesId: "species:white-tailed-deer", speciesName: "white-tailed deer", date: "2026-09-15",
    place: zone("29"), answers: {},
  });
  assert.equal(evaluation.completeness, "NEEDS_INPUT");
  assert.deepEqual(evaluation.dimensions.map(({ id }) => id), ["LICENCE_TYPE"]);
  /* And the classes offered are the ones that reach THIS zone, not all 41. */
  const offered = evaluation.dimensions[0]?.options?.map(({ value }) => value) ?? [];
  assert.ok(offered.includes(SK_RESIDENT_DEER));
  assert.ok(offered.length < SASKATCHEWAN_LICENCE_CLASSES.length, "the whole catalogue was offered for one zone");
});

test("the method envelope nests, so a bow hunter is answered inside a shotgun season", () => {
  /* The finding a heading-driven build would have destroyed. The regulation's
     seasons are written as "by any means other than a bow and arrow, crossbow,
     muzzle-loading firearm or shotgun" — which PERMITS those four, rather than
     excluding them. A bow hunter inside the muzzleloader window is in season. */
  assert.ok(envelopeContains("white-tailed deer shotgun", "white-tailed deer archery"));
  assert.ok(envelopeContains("white-tailed deer muzzle-loading firearm", "white-tailed deer crossbow"));
  assert.equal(envelopeContains("white-tailed deer archery", "white-tailed deer shotgun"), false);

  /* 1 to 14 October in zone 29 is the muzzle-loading season (s. 112), whose
     envelope permits a bow and a crossbow as well. A build that read the section
     HEADING would have closed those two weeks to a bow hunter. */
  const bow = ask("species:white-tailed-deer", "29", "2026-10-05",
    { LICENCE_TYPE: SK_RESIDENT_DEER, HUNT_METHOD: "BOW" });
  assert.equal(bow.status, "CONDITIONAL", "a bow hunter inside a wider envelope must be in season");
});

test("a cross-year window is still open after New Year", () => {
  /* The builder emitted `2026-10-15..2026-03-15` for wolf before this was
     checked — a window closing five months before it opens. The engine's
     `containing()` is a plain inclusive comparison and does not wrap, so that
     window matched no date in the year and answered CLOSED every day of a season
     the regulation holds open for five months. The wolf season runs 15 October
     to 15 March (OSGR s. 29.22) and zone 1 is inside it. */
  const wolf = ask("species:gray-wolf", "1", "2027-02-01",
    { LICENCE_TYPE: "Saskatchewan Resident Wolf Licence", HUNT_METHOD: "RIFLE" });
  assert.equal(wolf.status, "CONDITIONAL");

  /* Resolved windows are anchored to a licence year and so never wrap; a season
     that spans the turn of the year is `2026-10-15..2027-03-15` with
     `crossesYear` true. `crossesYearAgreesWithTheBundle` in
     `engine-answers-somewhere.test.ts` pins that across every bundle. */
  for (const rule of SASKATCHEWAN_BUNDLE.rules) {
    for (const window of rule.windows ?? []) {
      assert.ok(window.opensIso <= window.closesIso, `${rule.id} closes before it opens`);
      assert.equal(window.crossesYear, window.opensIso.slice(0, 4) !== window.closesIso.slice(0, 4), rule.id);
    }
  }
});

/**
 * An answer for a zone, with whatever licence that zone's own rules offer.
 *
 * Used where the test is about the answer's shape rather than a species: picking
 * a licence by hand would pin the test to one amendment of one schedule.
 */
function anyAnswerIn(designation: string, date: string) {
  for (const speciesId of SASKATCHEWAN_SPECIES) {
    const first = evaluateSaskatchewan({
      speciesId, speciesName: speciesId.replace("species:", ""), date,
      place: zone(designation), answers: {},
    });
    if (first.result) return first.result;
    const licence = first.dimensions.find(({ id }) => id === "LICENCE_TYPE")?.options?.[0]?.value;
    if (!licence) continue;
    const answered = evaluateSaskatchewan({
      speciesId, speciesName: speciesId.replace("species:", ""), date,
      place: zone(designation), answers: { LICENCE_TYPE: licence, HUNT_METHOD: "RIFLE" },
    });
    if (answered.result) return answered.result;
  }
  throw new Error(`no species produced an answer in zone ${designation} on ${date}`);
}

test("the answer can reach every instrument it makes a claim from", () => {
  /* Each rule cites the Open Seasons Game Regulations, because that is where the
     seasons are. But the standing limitations state the law from the Act
     (landowner consent, Treaty rights), from The Wildlife Regulations, 1981
     (legal hours, clothing) and from the boundaries regulation — and the engine
     does not fold a legal-time rule's own source into the answer. Without the
     standing sources a hunter is shown a claim about consent with only the
     season table to check it against. */
  const result = anyAnswerIn("68", "2026-11-01");
  for (const required of [
    "source:ca-sk-wildlife-act",
    "source:ca-sk-wildlife-regulations",
    "source:ca-sk-wmz-boundaries-regulations",
  ]) assert.ok(result.sourceIds.includes(required as never), `${required} is unreachable from the answer`);
  /* And the guide is deliberately absent: it is a summary, used for the
     cross-check and relied on for nothing here. */
  assert.equal(result.sourceIds.includes("source:ca-sk-hunters-guide-2026-27" as never), false);
});

test("legal hours are Central Standard Time year-round, and inverted from a prohibition", () => {
  const result = anyAnswerIn("68", "2026-11-01");
  assert.ok(result.legalTime, "no legal window");
  /*
   * PRESENCE IS NOT CORRECTNESS, and this test used to assert only presence.
   * `SASKATCHEWAN_HOURS` carried `beforeSunriseMinutes: -30` while
   * `legalTimeFor` shifts by `-before`, so the window opened half an hour AFTER
   * sunrise — an hour of lawful light denied to every hunter in the province,
   * every day, with this test green. `legal-hours-sign.test.ts` now holds the
   * encoded sign against the authority's own sentence across every rule; this
   * line is the local guard that the window opens before sunrise and not after.
   */
  if (result.legalTime.status === "RESOLVED") {
    assert.ok(result.legalTime.window.opensAt < result.legalTime.window.closesAt);
    assert.equal(SASKATCHEWAN_HOURS.basis, "SUNRISE_SUNSET_OFFSET");
    if (SASKATCHEWAN_HOURS.basis === "SUNRISE_SUNSET_OFFSET") {
      assert.ok(SASKATCHEWAN_HOURS.beforeSunriseMinutes > 0,
        "a POSITIVE value opens before sunrise; a negative one opens after it");
    }
  }
  /* s. 11(1) states the PROHIBITION — half an hour after sunset to half an hour
     before sunrise — so the permitted window is its inverse, and the section is
     kept rather than the inference. */
  const legalHours = (SASKATCHEWAN_BUNDLE as unknown as { legalHours: { section?: string } }).legalHours;
  assert.match(legalHours.section ?? "", /s\. 11\(1\)/);
});

test("the Prince Albert zone is closed to game birds, and that is a stated rule rather than a gap", () => {
  /* Recorded as UNRESOLVED on the first pass, which was an unnecessary refusal:
     the ministry states three times that the zone is closed to all game bird
     hunting. §8 is a two-directional obligation. */
  assert.equal(gameBirdDistrictOf("PWMZ"), null);
  /* Exactly one zone has no game bird district, and it is that one. The first
     pass recorded it UNRESOLVED; the ministry's guide states three times that
     the Prince Albert WMZ is closed to all game bird hunting. */
  assert.deepEqual(zonesWithNoGameBirdDistrict(), ["PWMZ"]);
  assert.equal(GAME_BIRD_MANAGEMENT_UNITS.length, 6);
});

test("every licence class the rules use is one the regulation names", () => {
  /* Derived from the rules rather than listed, so a class added by amendment
     arrives with the rule that uses it and cannot be offered without one. */
  assert.equal(SASKATCHEWAN_LICENCE_CLASSES.length, 41);
  const dimension = SASKATCHEWAN_VOCABULARY.dimensions.find(({ id }) => id === "LICENCE_TYPE");
  assert.equal(dimension?.valuesFrom, "PLACE");
  assert.equal(dimension?.options?.length, SASKATCHEWAN_LICENCE_CLASSES.length);
});

test("every species the bundle answers for is in the catalogue", () => {
  /* `takeEligibility` is read from the profile and never defaulted, so a species
     with a Saskatchewan season and no catalogue entry fails here rather than
     reaching a hunter as a surface with no biological record behind it. */
  const catalogued = new Map(catalogueSpecies().map((species) => [species.speciesId, species]));
  for (const speciesId of SASKATCHEWAN_SPECIES) {
    assert.ok(catalogued.has(speciesId), `${speciesId} has a Saskatchewan rule and no catalogue entry`);
  }
  assert.equal(SASKATCHEWAN_SPECIES.length, 13);
});

test("the coverage report counts what the bundle holds, and no unit is counted twice", () => {
  const report = saskatchewanCoverageReport();
  assert.equal(report.officialUnits, 83);
  assert.ok(report.species.length > 0);
  for (const species of report.species) {
    /* Every zone is accounted for exactly once: reached by a rule, declared
       closed by a rule, closed because no rule names it, or unknown. A sum over
       83 would mean a zone counted twice; a sum under it would mean a zone the
       report says nothing about. */
    const accounted = species.unitsReached + species.unitsClosedByAbsence
      + species.unitsDeclaredClosedByRule + species.unitsUnknown;
    assert.equal(accounted, report.officialUnits, `${species.speciesId} accounts for ${accounted} of ${report.officialUnits} zones`);
  }
});

/* ── The legal minimums, pinned by condition id ──────────────────────────── */

/**
 * A condition BY ITS STABLE ID, which is the only anchor that survives.
 *
 * A guard that searches the bundle's text for a figure reports the figure as
 * held while the copy the engine reads drifts: Saskatchewan quotes `15
 * centimetres` and `100 cm²` in `deliberatelyNotEncoded` and `guideDivergence`
 * as well as in the operative conditions, so a bundle-wide search for either
 * passes on the cross-check note alone. Those notes are good provenance AND a
 * second home for every figure they quote.
 */
function condition(id: string): { text: string; sourceSection: string; note?: string } {
  const found = SASKATCHEWAN_BUNDLE.sources
    .flatMap((source: { conditions?: Array<{ id: string; text: string; sourceSection: string; note?: string }> }) => source.conditions ?? [])
    .find((candidate) => candidate.id === id);
  assert.ok(found, `no condition ${id}`);
  return found!;
}

test("the legal minimums a hunter is judged against are pinned, not merely present", () => {
  /*
   * MEASURED, NOT ASSUMED. Five safety-relevant figures were changed in the
   * builder — the antler threshold, the moose age, both hunter-orange patch
   * limits, the CSA class and the legal-hours offset — the bundle was rebuilt,
   * and the ENTIRE suite stayed green. Each of these is a number a hunter can be
   * charged against, and nothing held any of them.
   *
   * A jurisdiction with a pinned minimum and one without look identical in the
   * data, so reading the bundle cannot find this; only changing a figure and
   * watching for a failure can.
   */

  /* s. 2(h): a bull elk is a male with an antler at least 15 cm on the outside
     curve. Not complementary with "antlerless" — a male over a year old with
     antlers under 15 cm is in neither class — which is why the figure itself
     has to be right rather than derivable. */
  const elk = condition("ca-sk-bull-elk-antler");
  assert.match(elk.text, /at least 15 centimetres long/);
  assert.match(elk.text, /outside curve from the skull to the tip/);
  assert.match(elk.sourceSection, /s\. 2\(h\)/);

  /* A bull moose is an AGE test, which the physical-criterion vocabulary cannot
     yet state — so the words are the fact and must not drift. */
  const moose = condition("ca-sk-bull-moose-age");
  assert.match(moose.text, /male moose at least one year old/);

  /*
   * Hunter orange. Saskatchewan is NOT a blaze-orange jurisdiction: four colours
   * or a CSA label satisfy it, the two colour lists differ by exactly one colour,
   * and white is lawful for the GARMENT and not for the CAP. Each of those is a
   * way to be lawfully dressed or unlawfully dressed, so each is pinned.
   */
  const orange = condition("ca-sk-hunter-clothing");
  assert.match(orange.text, /scarlet, bright yellow, blaze orange, WHITE/);
  assert.match(orange.text, /cap or toque in scarlet, bright yellow or blaze orange/);
  assert.match(orange.text, /White is lawful for the garment and NOT for the cap/);
  /* The guide says Class 2 vests AND Class 3 coveralls are lawful; s. 21(1)(a)(ii)
     names only Class 2, and the looser reading must never widen a permission. */
  assert.match(orange.text, /CAN\/CSA Z96 Class 2/);
  assert.doesNotMatch(orange.text, /Class 3/);
  /* "less than", not "not exceeding" — a different test from the guide's, and a
     different imperial conversion. Both limits are pinned because they differ. */
  assert.match(orange.text, /less than 100 cm² of the garment/);
  assert.match(orange.text, /less than 50 cm² of the cap/);
  assert.match(orange.sourceSection, /21\(1\)/);
});

test("where the guide is LOOSER than the regulation, the looser reading is pinned ABSENT", () => {
  /*
   * ASSERTING A NUMBER IS PRESENT IS THE EASY DIRECTION. The dangerous one is a
   * permission that must NOT be there: the ministry's guide restates s. 21 more
   * permissively than the section does, three times, and every one of those
   * readings would look like a reasonable correction to someone comparing the
   * two. §8 binds in both directions, and a restriction looser than the
   * authority is as false as one stricter.
   *
   * MEASURED, NOT ASSUMED. The bundle's own `guideDivergence.hunterClothing`
   * records all three. Before this test, adopting the guide's framing in the
   * builder — "Hunting big game WITH A RIFLE" — and rebuilding left the ENTIRE
   * suite green, which is to say North Ground would have told a bow hunter that
   * hunter orange was not required of them. That is the most dangerous single
   * drift available in this bundle and nothing held it.
   */
  const orange = condition("ca-sk-hunter-clothing");
  const divergence = (SASKATCHEWAN_BUNDLE as unknown as {
    guideDivergence: { hunterClothing: Array<{ where: string; guide: string; regulation: string }> };
  }).guideDivergence.hunterClothing;

  /* A new divergence recorded without a pin below fails here, so the set cannot
     grow silently past its guards. */
  assert.deepEqual(divergence.map(({ where }) => where), ["framing", "CSA class", "patch size"]);

  /*
   * 1. FRAMING. The guide triggers orange on hunting big game WITH A RIFLE;
   * s. 21(1) imposes it on every method and s. 21(2) then LIFTS it only where an
   * archery, muzzle-loading, crossbow or shotgun season exists. Encoding the
   * guide's framing would invert the default — the exception would become the
   * rule — and would lose s. 21(3), which reinstates the requirement for an
   * archery mule deer licence while the special rifle season runs concurrently.
   */
  assert.match(orange.text, /^Hunting big game, and accompanying or guiding someone who is,/,
    "the requirement is method-neutral; narrowing it to a weapon adopts the guide's looser framing");
  for (const weapon of [/with a rifle/i, /with a firearm/i, /rifle hunter/i]) {
    assert.doesNotMatch(orange.text, weapon,
      "s. 21(1) does not scope the orange requirement by weapon — the guide does");
  }
  /* The exception structure is the other half of the fact: drop 21(2) and 21(3)
     and the rule is stricter than the section, which is equally wrong. */
  assert.match(orange.sourceSection, /21\(2\)/);
  assert.match(orange.sourceSection, /21\(3\)/);
  assert.match(orange.note ?? "", /s\. 21\(2\) lifts it/);
  assert.match(orange.note ?? "", /s\. 21\(3\) reinstates it/);

  /* 2. CSA CLASS. The guide says Class 2 vests AND Class 3 coveralls are lawful;
     s. 21(1)(a)(ii) names only Class 2. */
  assert.doesNotMatch(orange.text, /Class 3/);

  /* 3. PATCH SIZE. "less than" and "not exceeding" are different tests — a patch
     of exactly 100 cm² is lawful under the guide and unlawful under s. 21(1.1) —
     and the guide also converts to a different imperial figure. */
  assert.doesNotMatch(orange.text, /not exceeding/);
  assert.match(orange.text, /less than 100 cm²/);
});

test("the hours rule has two homes, and they must agree", () => {
  /*
   * WHY THIS EXISTS: IT IS WHY THE MUTATION PASS HAD NO POSITIVE CONTROL.
   *
   * Changing the legal-hours sentence in the BUILDER and rebuilding left the
   * suite green, and that was not because the sentence is unpinned — it is
   * pinned, in `legal-hours-sign.test.ts`, which reads `SASKATCHEWAN_HOURS` from
   * this module. The builder writes a SECOND copy into the bundle's `legalHours`
   * block, and nothing compared them. So the mutation moved a copy no consumer
   * reads, and the control I thought I had was reading the other one.
   *
   * Two homes for one fact with no comparison between them is the same defect as
   * `crossesYear`, one file over. This is the comparison.
   */
  const bundleHours = (SASKATCHEWAN_BUNDLE as unknown as {
    legalHours: { basis: string; beforeSunriseMinutes: number; afterSunsetMinutes: number; statedAs: string; section: string };
  }).legalHours;
  assert.equal(SASKATCHEWAN_HOURS.basis, "SUNRISE_SUNSET_OFFSET");
  if (SASKATCHEWAN_HOURS.basis !== "SUNRISE_SUNSET_OFFSET") return;
  assert.equal(bundleHours.basis, SASKATCHEWAN_HOURS.basis);
  assert.equal(bundleHours.beforeSunriseMinutes, SASKATCHEWAN_HOURS.beforeSunriseMinutes);
  assert.equal(bundleHours.afterSunsetMinutes, SASKATCHEWAN_HOURS.afterSunsetMinutes);
  assert.equal(bundleHours.statedAs, SASKATCHEWAN_HOURS.statedAs,
    "the bundle and the module quote the authority differently, so one of them has drifted");
  assert.equal(bundleHours.section, SASKATCHEWAN_HOURS.section);
});
