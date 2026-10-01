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
