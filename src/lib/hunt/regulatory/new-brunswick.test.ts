import assert from "node:assert/strict";
import test from "node:test";
import { catalogueSpecies } from "../intelligence/species-catalogue.ts";
import {
  NEW_BRUNSWICK_BUNDLE, NEW_BRUNSWICK_SPECIES, NEW_BRUNSWICK_VOCABULARY,
  evaluateNewBrunswick, newBrunswickCoverageReport,
} from "./new-brunswick.ts";
import type { IsoDate } from "../../content-contract/index.ts";

const zone = (designation: string, latitude = 46.09, longitude = -64.79) => ({
  zoneId: `management_zone:ca-nb-wmz-${designation}`,
  zoneName: designation,
  latitude, longitude,
  overlays: new Set<string>(),
});

/** Ask the ENGINE and insist on a result; see `engine-answers-somewhere.test.ts`. */
function ask(speciesId: string, designation: string, date: string, method?: string) {
  const evaluation = evaluateNewBrunswick({
    speciesId, speciesName: speciesId.replace("species:", ""), date,
    place: zone(designation),
    answers: method ? { HUNT_METHOD: method } : {},
  });
  assert.ok(evaluation.result, `no result for ${speciesId} in zone ${designation} on ${date}`);
  return evaluation.result;
}

const ruleById = (suffix: string) =>
  NEW_BRUNSWICK_BUNDLE.rules.find((rule) => rule.id === `regulatory_rule:ca-nb-2026-${suffix}`);

test("the dates are derived from the ordinal rule, and the moose season matches the province's own", () => {
  /* The positive control on the whole derivation. New Brunswick publishes its
     moose season as the last full week of September, Tuesday to Saturday; for
     2026 that is 22 to 26 September, and the first Monday in October is the 5th.
     If the arithmetic ever moves, this is the line that fails. */
  const derived = (NEW_BRUNSWICK_BUNDLE.relativeDateRules as { derived: Record<string, unknown> }).derived;
  assert.equal(derived.firstMondayInOctober2026, "2026-10-05");
  assert.deepEqual(derived.mooseSeason2026, { opensIso: "2026-09-22", closesIso: "2026-09-26" });
  assert.deepEqual(derived.deerEightWeeks, { opensIso: "2026-10-05", closesIso: "2026-11-29" });
  assert.deepEqual(derived.deerFiveWeeks, { opensIso: "2026-10-05", closesIso: "2026-11-08" });
  assert.deepEqual(derived.bowOrCrossbowOnlyFirstThreeWeeks, { opensIso: "2026-10-05", closesIso: "2026-10-25" });
  assert.deepEqual(derived.muzzleLoaderWeek, { opensIso: "2026-11-23", closesIso: "2026-11-29" });
  assert.deepEqual(derived.bearAutumn2026, { opensIso: "2026-09-01", closesIso: "2026-11-07" });
  assert.deepEqual(derived.bearSpring2027, { opensIso: "2027-04-19", closesIso: "2027-06-26" });
  /* 2027 is not a leap year, which the derivation must get from the calendar
     rather than from a constant. */
  assert.deepEqual(derived.octoberToEndOfFebruary, { opensIso: "2026-10-01", closesIso: "2027-02-28" });

  /* And the ambiguity that was actually checked rather than assumed away. */
  const rules = NEW_BRUNSWICK_BUNDLE.relativeDateRules as Record<string, string>;
  assert.match(rules.theAmbiguityThatWasCHECKED, /BOTH conventions/);
  assert.match(rules.theAmbiguityThatWasCHECKED, /throws if/);
});

test("every rule keeps the ordinal rule as well as its derived dates", () => {
  /* Storing only the ISO dates would lose the rule and answer the next year
     wrongly; storing only the rule would make the bundle uncheckable. */
  for (const rule of NEW_BRUNSWICK_BUNDLE.rules) {
    if (rule.declaredNoSeason) continue;
    assert.ok(rule.seasonPhrase.length > 20, `${rule.id} has no stated rule`);
    for (const window of rule.windows) {
      assert.ok(window.statedAs, `${rule.id} window ${window.opensIso} has no stated rule`);
      assert.match(window.opensIso, /^\d{4}-\d{2}-\d{2}$/);
    }
  }
});

test("deer is three answers by zone, and the zone changes the season's length", () => {
  /* The first Canadian bundle where the ZONE changes how LONG a season is. */
  const eight = ruleById("deer-archery-eight-week");
  const five = ruleById("deer-archery-five-week");
  const none = ruleById("deer-no-antlered");
  assert.ok(eight && five && none);
  assert.deepEqual([...five.geography!.include.ghas].sort(), ["1", "2", "3"]);
  assert.deepEqual([...none.geography!.include.ghas].sort(), ["4", "5", "9"]);
  assert.equal(none.declaredNoSeason, true);
  /* Disjoint and complete across the 27 the province publishes. */
  const covered = new Set([...eight.geography!.include.ghas, ...five.geography!.include.ghas, ...none.geography!.include.ghas]);
  assert.equal(covered.size, 27);
  assert.equal(eight.geography!.include.ghas.length, 21);

  /* And it shows in an answer: 20 November is inside the eight-week season and
     twelve days past the five-week one. */
  assert.equal(ask("species:white-tailed-deer", "10", "2026-11-20", "BOW").status, "CONDITIONAL");
  assert.equal(ask("species:white-tailed-deer", "2", "2026-11-20", "BOW").status, "CLOSED");
  assert.equal(ask("species:white-tailed-deer", "5", "2026-10-20", "BOW").status, "CLOSED");
});

test("the closure in zones 4, 5 and 9 says ANTLERED, and gives no antlerless answer either way", () => {
  /* §8 in both directions. s. 11.1(1) closes those zones to antlered deer only,
     and whether antlerless may be hunted there turns on a ministerial quota
     published nowhere — so claiming the zone closed outright would be a
     restriction stricter than the source, and claiming it open would be looser. */
  const none = ruleById("deer-no-antlered");
  assert.equal(none!.closureSummary, "closed to antlered deer");
  const notes = none!.notes.map((note) => (typeof note === "string" ? note : "text" in note ? note.text : ""));
  assert.ok(notes.some((note) => /ANTLERED deer only/.test(note)));
  assert.ok(notes.some((note) => /in either direction/.test(note)));
  const gaps = (NEW_BRUNSWICK_BUNDLE as unknown as { deliberatelyNotEncoded: Array<{ what: string; detail: string }> })
    .deliberatelyNotEncoded;
  const antlerless = gaps.find((gap) => /Antlerless deer/.test(gap.what));
  assert.ok(antlerless && /quota of ZERO/.test(antlerless.detail));
});

test("the first three weeks are bow OR CROSSBOW, which is the opposite of Newfoundland", () => {
  /* Newfoundland's pre-season is a long bow or compound bow and expressly not a
     crossbow. New Brunswick's s. 11.2 excepts "a bow or crossbow". Anyone who
     assumes archery means one thing across provinces encodes one of them wrongly. */
  const archery = ruleById("deer-archery-eight-week");
  const firearm = ruleById("deer-firearm-eight-week");
  assert.deepEqual(archery!.appliesWhen.permittedImplements, ["BOW", "CROSSBOW"]);
  assert.deepEqual(firearm!.appliesWhen.permittedImplements, ["FIREARM", "MUZZLELOADER"]);
  assert.equal(archery!.windows[0].opensIso, "2026-10-05");
  assert.equal(firearm!.windows[0].opensIso, "2026-10-26", "a firearm season opens in week four");

  /* 10 October is inside the archery weeks and before any firearm season. */
  assert.equal(ask("species:white-tailed-deer", "10", "2026-10-10", "CROSSBOW").status, "CONDITIONAL");
  assert.equal(ask("species:white-tailed-deer", "10", "2026-10-10", "FIREARM").status, "CLOSED");
  assert.equal(ask("species:white-tailed-deer", "10", "2026-11-01", "FIREARM").status, "CONDITIONAL");
});

test("no deer rule claims the muzzle-loading week, because its zones are unpublished", () => {
  /* s. 3.11(1) reserves the eighth week to muzzle-loaders "in a wildlife
     management zone referred to in subsection 11.1(4)" — the antlerless zones,
     which depend on the quota. So the eight-week grant is certified to the 22nd,
     not the 29th, and the week is named as unresolved rather than claimed. */
  for (const rule of NEW_BRUNSWICK_BUNDLE.rules) {
    if (rule.speciesId !== "species:white-tailed-deer" || rule.declaredNoSeason) continue;
    for (const window of rule.windows) {
      assert.ok(window.closesIso <= "2026-11-22",
        `${rule.id} closes ${window.closesIso}, inside the muzzle-loading week`);
    }
  }
  assert.equal(ask("species:white-tailed-deer", "10", "2026-11-25", "MUZZLELOADER").status, "CLOSED");
  const gaps = (NEW_BRUNSWICK_BUNDLE as unknown as { deliberatelyNotEncoded: Array<{ what: string; detail: string }> })
    .deliberatelyNotEncoded;
  assert.ok(gaps.some((gap) => /muzzle-loading firearm week/.test(gap.what)));
});

test("bear has two windows, and hunter orange reaches only one of them", () => {
  const bear = ruleById("bear");
  assert.equal(bear!.windows.length, 2);
  assert.deepEqual(bear!.windows.map((w) => [w.opensIso, w.closesIso]),
    [["2026-09-01", "2026-11-07"], ["2027-04-19", "2027-06-26"]]);
  assert.equal(ask("species:american-black-bear", "10", "2026-10-01").status, "CONDITIONAL");
  assert.equal(ask("species:american-black-bear", "10", "2027-05-01").status, "CONDITIONAL");
  assert.equal(ask("species:american-black-bear", "10", "2027-08-01").status, "CLOSED");
  const notes = bear!.notes.map((note) => (typeof note === "string" ? note : "text" in note ? note.text : ""));
  assert.ok(notes.some((note) => /1 September to 31 December/.test(note)),
    "the orange regulation's own date limits are why the spring window is different");
});

test("hunter orange carries the law's actual minimum and its real exception", () => {
  /* §41A asks for the law's minimum, not that orange is required. */
  const orange = NEW_BRUNSWICK_BUNDLE.sources
    .flatMap((source) => source.conditions ?? [])
    .find((condition) => condition.id === "ca-nb-hunter-orange");
  assert.ok(orange);
  assert.match(orange.text, /2 580 cm²/);
  assert.match(orange.text, /solid hunter orange hat/);
  assert.match(orange.text, /tree stand or ground blind/);
  assert.match(orange.text, /1 September to 31 December/);
  assert.match(String((orange as unknown as { note: string }).note), /Judd units/);
  assert.equal(orange.sourceId, "source:ca-nb-hunter-orange-regulation");
  assert.match(orange.sourceSection, /Hunter Orange Regulation/);
});

test("silence means CLOSED on two provisions, with the search that makes the zero mean something", () => {
  const absence = NEW_BRUNSWICK_BUNDLE.absence;
  assert.equal(absence.meaning, "CLOSED");
  assert.equal(absence.words?.owner, "AUTHORITY");
  assert.match(String(absence.words?.citation), /s\. 34\(2\)\(a\)/);
  assert.match(String(absence.section), /s\. 11\(1\)/);
  const negative = (absence as unknown as { negativeControl: string }).negativeControl;
  assert.match(negative, /ZERO times/);
  /* The positive control: the search that found no general prohibition DID find
     twelve "closed season" occurrences, so the zero describes the corpus rather
     than a failed search. */
  assert.match(negative, /twelve/);
  const limit = (absence as unknown as { theStandingLimitOnEveryClosedClaim: Record<string, string> })
    .theStandingLimitOnEveryClosedClaim;
  assert.match(limit.statedAs, /may establish a quota of zero/);
});

test("legal hours are computed province-wide, because the table was repealed", () => {
  const result = NEW_BRUNSWICK_VOCABULARY.legalTimeAt?.(
    "species:white-tailed-deer",
    { ...zone("10"), scope: "POINT" },
    "2026-10-20" as IsoDate,
  );
  assert.equal(result?.status, "RESOLVED", `status was ${result?.status}`);
  assert.ok(result && "window" in result);
  assert.equal((result as { timezone: string }).timezone, "America/Moncton");
  assert.equal((result as { precision: { appliedInward: boolean } }).precision.appliedInward, true);

  /* A whole-zone question has no point, so it gets the rule and no clock. */
  assert.equal(
    NEW_BRUNSWICK_VOCABULARY.legalTimeAt?.("species:moose", { ...zone("10"), scope: "ZONE" }, "2026-10-20" as IsoDate),
    undefined);

  /* And the bundle records WHY computing is right here and wrong in Nova Scotia. */
  const hours = NEW_BRUNSWICK_BUNDLE as unknown as { legalHours: Record<string, string> };
  assert.match(hours.legalHours.theTableWasREPEALED, /repealed by 2021, c\.12, s\. 2/);
  assert.match(hours.legalHours.ourValueIsNotTheLegalProof, /Herzberg/);
});

test("licence fees are recorded with what is not yet established about them", () => {
  /* The first jurisdiction where §41A's two fee certifications both hold — and
     the reason they are still not shown is stated rather than left implicit. */
  const classes = (NEW_BRUNSWICK_BUNDLE as unknown as {
    licenceClasses: Array<{ class: string; feeCad: number | null; section: string }>;
  }).licenceClasses;
  assert.equal(classes.length, 6);
  assert.equal(classes.find((entry) => entry.class === "I")?.feeCad, 173);
  assert.equal(classes.find((entry) => entry.class === "III")?.feeCad, 29);
  for (const entry of classes) assert.match(entry.section, /s\. 3/);
  const why = (NEW_BRUNSWICK_BUNDLE as unknown as { whyTheFeesAreRecordedAndNotShown: string })
    .whyTheFeesAreRecordedAndNotShown;
  assert.match(why, /HST/);
  assert.match(why, /\$3\.00 vendor fee/);
});

test("no licence year is invented, and the two expiry bases are adjacent subsections", () => {
  assert.equal(NEW_BRUNSWICK_BUNDLE.licenceYear, null);
  const why = (NEW_BRUNSWICK_BUNDLE as unknown as { whyThereIsNoLicenceYear: Record<string, unknown> })
    .whyThereIsNoLicenceYear;
  assert.match(String(why.finding), /s\. 4\(1\)/);
  assert.match(String(why.finding), /s\. 4\(4\)/);
  assert.equal((why.whatTheAuthorityDefinesInstead as string[]).length, 4);
  assert.match(String(why.negativeControl), /ADJACENT SUBSECTIONS/);
});

test("every encoded species is in the catalogue, and the unresolved ones are named", () => {
  const known = new Set(catalogueSpecies().map((species) => species.speciesId));
  for (const speciesId of NEW_BRUNSWICK_SPECIES) {
    assert.ok(known.has(speciesId), `${speciesId} is encoded but not canonical`);
  }
  assert.equal(NEW_BRUNSWICK_SPECIES.length, 11);
  const gaps = (NEW_BRUNSWICK_BUNDLE as unknown as { deliberatelyNotEncoded: Array<{ what: string }> })
    .deliberatelyNotEncoded.map((gap) => gap.what);
  for (const named of ["Squirrel", "Cormorant", "Groundhog", "Wild turkey"]) {
    assert.ok(gaps.some((gap) => gap.includes(named)), `${named} must be named as a gap, not silently absent`);
  }
});

test("the coverage the report counts is the coverage the bundle holds", () => {
  const coverage = newBrunswickCoverageReport();
  assert.equal(coverage.officialUnits, 27);
  assert.equal(coverage.species.length, 11);
  for (const row of coverage.species) {
    assert.equal(row.unitsReached, 27, `${row.speciesId} must reach every zone`);
    assert.equal(row.unitsUnknown, 0, `${row.speciesId} leaves no zone unnamed`);
  }
  const deer = coverage.species.find((row) => row.speciesId === "species:white-tailed-deer")!;
  assert.equal(deer.unitsDeclaredClosedByRule, 3, "zones 4, 5 and 9 are closed to antlered deer by an explicit rule");
  assert.equal(deer.requiresInput, true, "the method changes the dates, so deer asks");
  const moose = coverage.species.find((row) => row.speciesId === "species:moose")!;
  assert.equal(moose.requiresInput, false, "one moose season for every method, so nothing is asked");
});
