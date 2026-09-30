import assert from "node:assert/strict";
import test from "node:test";
import { catalogueSpecies } from "../intelligence/species-catalogue.ts";
import {
  NEWFOUNDLAND_BUNDLE, NEWFOUNDLAND_SPECIES, NEWFOUNDLAND_VOCABULARY,
  evaluateNewfoundland, newfoundlandCoverageReport,
} from "./newfoundland.ts";
import { NEWFOUNDLAND_ISLAND_ZONE_IDS, newfoundlandLegalTime } from "./newfoundland-legal-time.ts";
import type { IsoDate } from "../../content-contract/index.ts";

const zone = (id: string, name: string, latitude: number, longitude: number) => ({
  zoneId: id, zoneName: name, latitude, longitude, overlays: new Set<string>(),
});

/* Real points inside real areas, for the two clocks the province keeps. */
const CORNER_BROOK = zone("management_zone:ca-nl-mma-006", "Moose Management Area 006", 48.95, -57.95);
const GOOSE_BAY = zone("management_zone:ca-nl-mma-090", "Moose Management Area 090", 53.30, -60.42);

/**
 * Ask the ENGINE, not the bundle, and insist on a result.
 *
 * Nova Scotia's eleven tests all read the bundle, so none of them could fail
 * when the bundle and the engine turned out not to be connected at all. Every
 * status assertion below therefore goes through this, and it throws rather than
 * returning undefined: a missing result is a failure to answer, not a status.
 */
function ask(speciesId: string, speciesName: string, place: ReturnType<typeof zone>, date: string, method?: string) {
  const evaluation = evaluateNewfoundland({
    speciesId, speciesName, date, place,
    answers: method ? { HUNT_METHOD: method } : {},
  });
  assert.ok(evaluation.result, `no result for ${speciesId} in ${place.zoneId} on ${date}`);
  return { completeness: evaluation.completeness, result: evaluation.result };
}

const ruleById = (suffix: string) =>
  NEWFOUNDLAND_BUNDLE.rules.find((rule) => rule.id === `regulatory_rule:ca-nl-2026-${suffix}`);

test("the province defines no licence year, and none is invented", () => {
  /* §41A forbids manufacturing a generic period. Newfoundland and Labrador
     defines four things instead, and they are not equivalent to a year: two of
     them expire on an event. */
  assert.equal(NEWFOUNDLAND_BUNDLE.licenceYear, null);
  const why = (NEWFOUNDLAND_BUNDLE as unknown as { whyThereIsNoLicenceYear: Record<string, unknown> }).whyThereIsNoLicenceYear;
  assert.match(String(why.negativeControl), /zero times/);
  /* The positive control: the search that found no "licence year" DID find
     "open season" 48 times, so the zero is a fact about the corpus rather than
     about a failed search. */
  assert.match(String(why.negativeControl), /48 times/);
  const bases = why.whatTheAuthorityDefinesInstead as string[];
  assert.equal(bases.length, 4);
  assert.ok(bases.some((basis) => /Event-based/.test(basis)), "the kill ends the licence, which no year models");
});

test("silence means CLOSED on the Order's own words, and three provisions say so", () => {
  const absence = NEWFOUNDLAND_BUNDLE.absence;
  assert.equal(absence.meaning, "CLOSED");
  assert.equal(absence.words?.owner, "AUTHORITY", "the quotation is the Order's, not ours");
  assert.match(String(absence.words?.citation), /NLR 43\/26, s\. 3/);
  assert.match(String(absence.words?.text), /during the open season prescribed in this Order for the species and the area/);
  /* s. 89 is the species-level provision and s. 3(c) the area-level one. Both are
     cited, because an unnamed AREA and an unnamed SPECIES are different silences
     and only one of them is what s. 89 speaks to. */
  assert.match(String(absence.section), /s\. 3/);
  assert.match(String(absence.section), /89/);
  const limit = (absence as unknown as { theStandingLimitOnEveryClosedClaim: Record<string, string> })
    .theStandingLimitOnEveryClosedClaim;
  assert.match(limit.statedAs, /close, alter or vary an open season/);
});

test("the island and Labrador are two answers, and the split is disjoint and complete", () => {
  /* The owner's "NL is not one answer" warning, enforced. A bundle that merged
     them would give a Labrador hunter an island season ending ten weeks early. */
  const island = ruleById("moose-island");
  const labrador = ruleById("moose-labrador");
  assert.ok(island && labrador);
  assert.equal(island.windows[0].closesIso, "2026-12-31");
  assert.equal(labrador.windows[0].closesIso, "2027-03-14");
  assert.equal(island.windows[0].opensIso, labrador.windows[0].opensIso, "both open the same day; only the close differs");

  const islandZones = new Set(island.geography!.include.ghas);
  const labradorZones = new Set(labrador.geography!.include.ghas);
  /* `ghas` holds the authority's own designations, because that is what
     `areaOf` resolves a point to. Zone ids here is the defect that made Nova
     Scotia answer CLOSED everywhere; see `engine-answers-somewhere.test.ts`. */
  for (const id of [...islandZones, ...labradorZones]) assert.match(id, /^\d{3}[A-Z]?$/, `${id} must be a designation`);
  for (const id of islandZones) assert.ok(!labradorZones.has(id), `${id} cannot be in both`);
  assert.equal(islandZones.size, 50);
  assert.equal(labradorZones.size, 24);
  assert.equal(islandZones.size + labradorZones.size, 74, "exactly the areas the certification run parity-checked");

  /* Area 51 is the trap. The Order calls it "Baikie Lake" in Labrador; the
     province's own map service calls the same area "Grand Falls", which reads as
     an island town. Taking the map's name for the Order's would have moved it. */
  assert.ok(labradorZones.has("051"), "area 51 is Labrador, on the Order's words");
});

test("a Labrador moose hunter is told the Labrador close date, not the island's", () => {
  const answer = ask("species:moose", "Moose", GOOSE_BAY, "2027-02-01", "FIREARM");
  assert.equal(answer.completeness, "RESOLVED");
  assert.equal(answer.result.status, "CONDITIONAL", `status was ${answer.result.status}`);
  /* 1 February is closed on the island and open in Labrador. If the split ever
     collapses, this is the test that fails. */
  const islandAnswer = ask("species:moose", "Moose", CORNER_BROOK, "2027-02-01", "FIREARM");
  assert.equal(islandAnswer.result.status, "CLOSED", `island status was ${islandAnswer.result.status}`);
});

test("the pre-season is for bows and excludes crossbows", () => {
  /* The Order says "by long bow or compound bow and arrow" and the department
     says "does not include cross bows" three times. Lumping the two as archery
     would hand a crossbow hunter two weeks of season they do not have. */
  const preSeasons = NEWFOUNDLAND_BUNDLE.rules.filter((rule) => rule.windows.some((window) => window.opensIso === "2026-08-29"));
  assert.ok(preSeasons.length >= 4, `expected a pre-season per species-region, found ${preSeasons.length}`);
  for (const rule of preSeasons) {
    assert.deepEqual(rule.appliesWhen.permittedImplements, ["BOW"], `${rule.id} must be bow-only`);
    assert.ok(rule.conditionIds.includes("ca-nl-no-crossbow-in-preseason"), `${rule.id} must carry the crossbow exclusion`);
  }
  const answer = ask("species:moose", "Moose", CORNER_BROOK, "2026-09-01", "CROSSBOW");
  assert.equal(answer.result.status, "CLOSED", "a crossbow hunter has the general season only");
  const bow = ask("species:moose", "Moose", CORNER_BROOK, "2026-09-01", "BOW");
  assert.equal(bow.result.status, "CONDITIONAL", "a bow hunter has the pre-season");
});

test("six caribou areas are closed, not three, and each is a declared closure", () => {
  /* The department's guide says "Zones 63, 65, and 69 are Closed" and never
     mentions 73, 74 or 75 — which the Order equally does not name. A hunter
     reading the guide's closed list would infer three open areas that are not. */
  const closed = ruleById("caribou-closed");
  assert.ok(closed);
  assert.equal(closed.declaredNoSeason, true);
  assert.deepEqual([...closed.geography!.include.ghas].sort(), ["063", "065", "069", "073", "074", "075"]);
  const answer = ask("species:caribou", "Caribou",
    zone("management_zone:ca-nl-cma-074", "Caribou Management Area 074", 47.1, -55.3), "2026-10-01");
  assert.equal(answer.result.status, "CLOSED", "an area the Order does not name is closed, not unknown");
});

test("three caribou areas have no pre-season, because s. 9(3) excludes them by name", () => {
  const withBow = NEWFOUNDLAND_BUNDLE.rules
    .filter((rule) => rule.speciesId === "species:caribou" && rule.windows.some((w) => w.opensIso === "2026-08-29"))
    .flatMap((rule) => rule.geography!.include.ghas);
  for (const excluded of ["070", "071", "072"]) {
    assert.ok(!withBow.includes(excluded), `area ${excluded} has no pre-season`);
  }
  assert.equal(withBow.length, 10, "the ten areas s. 9(2) lists and s. 9(3) does not exclude");
});

test("the Grey Islands answer once for both 71A and 71B, and the map's CLOSED tag is not law", () => {
  /* The Order divides the geography into 71A (Bell Island) and 71B (Groais
     Island); the province's service carries one area 071 whose two parts its own
     `cma_island` field names Bell Island and Groais Island. Both halves carry
     identical dates and both are excluded from the pre-season, which is the
     reason one answer serves — not an assumption that they are the same. */
  const grey = ruleById("caribou-grey-islands");
  assert.ok(grey);
  assert.deepEqual(grey.geography!.include.ghas, ["071"]);
  assert.equal(grey.windows[0].closesIso, "2026-11-30");
  const notes = grey.notes.map((note) => (typeof note === "string" ? note : "text" in note ? note.text : ""));
  assert.ok(notes.some((note) => /71A \(Bell Island\) and 71B \(Groais Island\)/.test(note)));
  assert.ok(notes.some((note) => /stale metadata rather than law/.test(note)),
    "a GIS attribute must never be allowed to override a filed regulation");
});

test("black bear area 200 answers for Labrador, and is not called an area the Order never created", () => {
  const labrador = ruleById("bear-labrador");
  const island = ruleById("bear-island-fall");
  assert.ok(labrador && island);
  assert.deepEqual(labrador.geography!.include.ghas, ["200"]);
  assert.equal(labrador.windows[0].opensIso, "2026-08-10", "Labrador opens a month before the island");
  assert.equal(island.windows[0].opensIso, "2026-09-12");
  /* Both have a spring window, and the years differ from the department's guide. */
  assert.equal(labrador.windows[1].opensIso, "2027-04-01");
  assert.equal(island.windows[1].opensIso, "2027-05-01");
  const finding = (NEWFOUNDLAND_BUNDLE as unknown as { theBearAreaThatIsNotInAnyOrder: Record<string, string> })
    .theBearAreaThatIsNotInAnyOrder;
  assert.match(finding.whatItIsNot, /not a black bear management area in law/);
});

test("every guide disagreement is recorded and resolved in favour of the Order", () => {
  /* Two of them matter to a hunter: the guide prints the Labrador black bear
     spring season as 2026, which would read as already past, and the Labrador
     moose pre-season as 2025. Neither is silently corrected. */
  const cross = (NEWFOUNDLAND_BUNDLE as unknown as {
    guideCrossCheck: { disagreements: Array<{ where: string; guide: string; order: string; resolution: string }> };
  }).guideCrossCheck;
  assert.ok(cross.disagreements.length >= 5);
  const spring = cross.disagreements.find((entry) => /black bear spring/.test(entry.where));
  assert.ok(spring, "the spring-season year disagreement must be recorded");
  assert.match(spring.guide, /2026/);
  assert.match(spring.order, /2027/);
  for (const entry of cross.disagreements) {
    assert.ok(entry.resolution.length > 20, `${entry.where} needs a stated resolution`);
  }
  assert.equal(newfoundlandCoverageReport().guideDisputes, cross.disagreements.length);
});

test("the one zone-scoped condition is the white moose of area 43", () => {
  const conditions = NEWFOUNDLAND_BUNDLE.sources.flatMap((source) => source.conditions ?? []);
  for (const condition of conditions) {
    const scope = (condition as unknown as { scope?: string }).scope;
    assert.ok(scope === "JURISDICTION" || scope === "ZONE", `${condition.id} must declare its scope`);
  }
  const zoneScoped = conditions.filter((condition) => (condition as unknown as { scope: string }).scope === "ZONE");
  assert.equal(zoneScoped.length, 1);
  assert.equal(zoneScoped[0].id, "ca-nl-moose-white-mma-43");
  assert.deepEqual(zoneScoped[0].zoneIds, ["management_zone:ca-nl-mma-043"]);
});

test("legal hours are computed on the island and declined in Labrador", () => {
  /* The RULE is province-wide and certain. The CLOCK is not: Labrador keeps two
     of them and North Ground has not certified where the line runs, so an
     island answer gets a window and a Labrador answer gets the rule. Showing the
     wrong clock would be thirty minutes wrong at both ends, and the direction
     that matters is a hunter shooting before it was lawful. */
  const island = newfoundlandLegalTime({ ...CORNER_BROOK, scope: "POINT" }, "2026-10-01" as IsoDate);
  assert.equal(island?.status, "RESOLVED", `island status was ${island?.status}`);
  assert.ok(island && "window" in island, "a resolved island answer carries a wall-clock window");
  const win = (island as { window: { opensAt: string; closesAt: string } }).window;
  assert.match(win.opensAt, /^\d\d:\d\d$/);
  assert.match(win.closesAt, /^\d\d:\d\d$/);
  assert.equal((island as { timezone: string }).timezone, "America/St_Johns");
  /* The margin is applied inward on both ends, so a computed value that is off
     can never authorise a minute outside the legal window. */
  assert.equal((island as { precision: { appliedInward: boolean } }).precision.appliedInward, true);

  const labrador = newfoundlandLegalTime({ ...GOOSE_BAY, scope: "POINT" }, "2026-10-01" as IsoDate);
  assert.equal(labrador, undefined, "Labrador must fall back rather than pick a timezone");

  /* And the fallback says why, in words, rather than going quiet. */
  const fallback = NEWFOUNDLAND_VOCABULARY.legalTime;
  assert.match(JSON.stringify(fallback), /Atlantic Time/);
  assert.match(JSON.stringify(fallback), /half an hour after sunset/);

  /* A whole-zone question has no point, so it gets no window either. */
  assert.equal(newfoundlandLegalTime({ ...CORNER_BROOK, scope: "ZONE" }, "2026-10-01" as IsoDate), undefined);
});

test("the island zone set is derived from the bundle's groups, not typed out", () => {
  /* So a zone added to a Labrador group cannot arrive in the island set by
     being listed in two places. */
  assert.equal(NEWFOUNDLAND_ISLAND_ZONE_IDS.size, 50 + 19 + 6, "50 island moose areas, 19 caribou, 6 island bear");
  assert.ok(!NEWFOUNDLAND_ISLAND_ZONE_IDS.has("management_zone:ca-nl-bma-200"), "bear area 200 is Labrador");
  assert.ok(!NEWFOUNDLAND_ISLAND_ZONE_IDS.has("management_zone:ca-nl-mma-090"), "moose area 90 is Labrador");
  assert.ok(NEWFOUNDLAND_ISLAND_ZONE_IDS.has("management_zone:ca-nl-cma-071"), "the Grey Islands are island geography");
});

test("each species is measured against its own areas, not against all 100", () => {
  /* Newfoundland and Labrador is the first jurisdiction where one unit count is
     wrong for every species: 100 polygons cover the same ground as 74 moose, 19
     caribou and 7 bear areas. A single denominator reported moose CLOSED in 26
     units that are caribou and bear areas — closures no hunter could ever be
     shown, which §8 forbids counting. */
  const coverage = newfoundlandCoverageReport().species;
  const expected: Record<string, number> = {
    "species:moose": 74, "species:caribou": 19, "species:american-black-bear": 7,
  };
  for (const entry of coverage) {
    assert.equal(entry.unitsReached, expected[entry.speciesId], `${entry.speciesId} reach`);
    assert.equal(entry.unitsClosedByAbsence, 0, `${entry.speciesId} must claim no unreachable closure`);
    assert.equal(entry.unitsUnknown, 0, `${entry.speciesId} must claim no unreachable unknown`);
  }
  assert.equal(newfoundlandCoverageReport().officialUnits, 100, "the province's own total is still 100");
});

test("every encoded species is in the catalogue, so no rule is silently unanswerable", () => {
  const known = new Set(catalogueSpecies().map((species) => species.speciesId));
  for (const speciesId of NEWFOUNDLAND_SPECIES) {
    assert.ok(known.has(speciesId), `${speciesId} is encoded but not canonical`);
  }
  assert.deepEqual([...NEWFOUNDLAND_SPECIES],
    ["species:american-black-bear", "species:caribou", "species:moose"]);
});

test("the certified period is the Order's own span, not a calendar year", () => {
  const period = NEWFOUNDLAND_BUNDLE.certifiedPeriod;
  assert.equal(period.from, "2026-08-10", "the earliest window the Order opens — Labrador black bear");
  assert.equal(period.to, "2027-07-15", "the latest it closes — island black bear");
  const opens = NEWFOUNDLAND_BUNDLE.rules.flatMap((rule) => rule.windows.map((window) => window.opensIso));
  const closes = NEWFOUNDLAND_BUNDLE.rules.flatMap((rule) => rule.windows.map((window) => window.closesIso));
  assert.equal([...opens].sort()[0], period.from, "no window may open before the certified period");
  assert.equal([...closes].sort().at(-1), period.to, "no window may close after it");
});

test("what is not encoded says why, and the highway corridors are named as unserviceable", () => {
  const gaps = (NEWFOUNDLAND_BUNDLE as unknown as {
    deliberatelyNotEncoded: Array<{ what: string; reason: string; detail: string }>;
  }).deliberatelyNotEncoded;
  assert.ok(gaps.length >= 8);
  for (const gap of gaps) assert.ok(gap.reason && gap.detail.length > 40, `${gap.what} needs a reason and a detail`);
  const mrz = gaps.find((gap) => /100 and 101/.test(gap.what));
  assert.ok(mrz, "the Moose Reduction Zones must be recorded rather than dropped");
  assert.match(mrz.detail, /OVERLAP/, "they overlap the numbered areas, which is why the numbered answer is still right");
  const parks = gaps.find((gap) => /National Park/.test(gap.what));
  assert.ok(parks && /never report moose as closed there/.test(parks.detail),
    "a park with its own federal hunt must never be answered as closed");
});
