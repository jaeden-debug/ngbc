import { legalTimeNotCertified } from "./legal-time.ts";
import { parseRelativeWindow } from "./relative-date.ts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { IsoDate } from "../../content-contract/index.ts";
import type { RegulatoryResult } from "../types.ts";
import {
  composeFederalWithProvincial, evaluateFederal, federalSpeciesIds, isFederalMigratoryBird,
} from "./federal.ts";

const on = (value: string) => value as IsoDate;

const provincialUnknown: RegulatoryResult = {
  next: { kind: "NOT_CERTIFIED" },
  status: "UNKNOWN",
  summary: "not certified",
  legalTime: legalTimeNotCertified("", "test authority"),
  requirements: [], limitations: [], sourceIds: [], verifiedAt: "2026-09-23T00:00:00Z",
};

test("wave 1 makes migratory species answerable, and grouse are not among them", () => {
  const ids = federalSpeciesIds();
  assert.ok(ids.includes("species:mallard"));
  assert.ok(ids.includes("species:canada-goose"));
  assert.ok(ids.includes("species:wilsons-snipe"));
  /* Ptarmigan and grouse are provincial upland game, not federal migratory
     birds, however much they look like the same kind of hunting. */
  assert.equal(isFederalMigratoryBird("species:ruffed-grouse"), false);
  assert.equal(isFederalMigratoryBird("species:rock-ptarmigan"), false);
});

test("Prince Edward Island: snipe inside the season is CONDITIONAL with its own dates", () => {
  /* Schedule 3 Part 2: Snipe, October 1 to December 31, daily 10, possession 20. */
  const answer = evaluateFederal("species:wilsons-snipe", "jurisdiction:ca-pe", { latitude: 46.24 }, on("2026-11-05"));
  assert.equal(answer.status, "CONDITIONAL");
  assert.equal(answer.season?.opens, "10-01");
  assert.equal(answer.season?.closes, "12-31");
  assert.equal(answer.sharedLimit?.daily, 10);
  assert.equal(answer.sharedLimit?.possession, 20);
});

test("a date outside every federal season is CLOSED, not UNKNOWN", () => {
  const answer = evaluateFederal("species:wilsons-snipe", "jurisdiction:ca-pe", { latitude: 46.24 }, on("2026-07-04"));
  assert.equal(answer.status, "CLOSED");
});

test("a season that crosses the new year is inside on both sides of it", () => {
  /* PEI ducks run October 1 to January 15. */
  for (const date of ["2026-10-02", "2026-12-31", "2027-01-14"]) {
    const answer = evaluateFederal("species:mallard", "jurisdiction:ca-pe", { latitude: 46.24 }, on(date));
    assert.equal(answer.status, "CONDITIONAL", date);
  }
  const outside = evaluateFederal("species:mallard", "jurisdiction:ca-pe", { latitude: 46.24 }, on("2026-09-15"));
  assert.equal(outside.status, "CLOSED");
});

test("a point on a stated latitude does not get a federal season", () => {
  const answer = evaluateFederal("species:mallard", "jurisdiction:ca-yt", { latitude: 66 }, on("2026-09-20"));
  assert.equal(answer.status, "NEEDS_VERIFICATION");
  assert.equal(answer.season, undefined);
});

test("federal requirements ride with every answer, including a CLOSED one", () => {
  const closed = evaluateFederal("species:wilsons-snipe", "jurisdiction:ca-pe", { latitude: 46.24 }, on("2026-07-04"));
  assert.ok(closed.requirements.some((line) => /Migratory Game Bird Hunting Permit/.test(line)));
  assert.ok(closed.requirements.some((line) => /Habitat Conservation Stamp/i.test(line)));
});

/* ── The limit is the group's, never the species' ────────────────────────── */

test("a shared limit always names what it is shared with", () => {
  const answer = evaluateFederal("species:mallard", "jurisdiction:ca-pe", { latitude: 46.24 }, on("2026-11-05"));
  assert.ok(answer.sharedLimit, "a duck answer carries a limit");
  assert.match(answer.sharedLimit!.sharedWith, /Ducks/);
  assert.match(answer.sharedLimit!.sharedWith, /combined/);
});

test("composing states the limit as SHARED, in words, not as a number beside the species", () => {
  const answer = evaluateFederal("species:mallard", "jurisdiction:ca-pe", { latitude: 46.24 }, on("2026-11-05"));
  const composed = composeFederalWithProvincial(answer, provincialUnknown, "Prince Edward Island");
  const shared = composed.limitations.find((line) => /SHARED/.test(line.text));
  assert.ok(shared, "the shared-limit sentence is present");
  assert.match(shared!.text, /not per species/);
  assert.match(shared!.text, /Ducks/);
});

/* ── Composition is conjunction ──────────────────────────────────────────── */

test("an uncertified province is said out loud, never implied away", () => {
  const answer = evaluateFederal("species:mallard", "jurisdiction:ca-pe", { latitude: 46.24 }, on("2026-11-05"));
  const composed = composeFederalWithProvincial(answer, provincialUnknown, "Prince Edward Island");
  assert.equal(composed.status, "CONDITIONAL");
  assert.ok(
    composed.limitations.some((line) => /also apply, and North Ground has not certified them/.test(line.text)),
    "the province's own half is named as uncertified",
  );
  assert.ok(composed.sourceIds.includes("source:ca-federal-migratory-birds-regulations"));
});

test("a province that has certified a restriction can only bind harder, never looser", () => {
  const federal = evaluateFederal("species:mallard", "jurisdiction:ca-pe", { latitude: 46.24 }, on("2026-11-05"));
  for (const provincialStatus of ["CLOSED", "CONFLICT", "NEEDS_VERIFICATION"] as const) {
    const composed = composeFederalWithProvincial(
      federal, { ...provincialUnknown, status: provincialStatus }, "Prince Edward Island",
    );
    assert.equal(composed.status, provincialStatus, provincialStatus);
    assert.equal(composed.season, undefined, `${provincialStatus} shows no season`);
  }
});

test("both authorities' requirements survive composition", () => {
  const federal = evaluateFederal("species:mallard", "jurisdiction:ca-pe", { latitude: 46.24 }, on("2026-11-05"));
  const composed = composeFederalWithProvincial(
    federal,
    { ...provincialUnknown, status: "CONDITIONAL", requirements: ["A provincial small game licence"] },
    "Prince Edward Island",
  );
  assert.ok(composed.requirements.some((line) => /Migratory Game Bird Hunting Permit/.test(line)));
  assert.ok(composed.requirements.some((line) => /provincial small game licence/.test(line)));
});

/* ── A refused row still covers real dates ───────────────────────────────── */

test("a date inside a season this build REFUSED answers UNKNOWN, never CLOSED", () => {
  /*
   * Schedule 3 Part 12: Central Yukon ducks are open "(i) August 15 to August
   * 31, for residents of Yukon only". That row is refused because the season
   * varies by residency — so North Ground does not know whether THIS hunter
   * may hunt, which is different from knowing they may not.
   *
   * Telling a Yukon resident CLOSED on August 20 would state a restriction
   * stricter than the law. That is a false regulatory claim, and a quiet one:
   * nobody complains about being wrongly told no.
   */
  const answer = evaluateFederal("species:mallard", "jurisdiction:ca-yt", { latitude: 64 }, on("2026-08-20"));
  assert.equal(answer.status, "UNKNOWN");
  assert.notEqual(answer.status, "CLOSED");
  assert.ok(
    answer.limitations.some((line) => /residency/.test(line) && /August 15 to August 31/.test(line)),
    "the refused season is quoted so a hunter can read what was not encoded",
  );
});

test("a date outside every season, encoded or refused, is still CLOSED", () => {
  /* Southern Yukon ducks run September 1 to October 31 with no August row at
     all, so December really is closed rather than unknown. */
  const answer = evaluateFederal("species:mallard", "jurisdiction:ca-yt", { latitude: 60.5 }, on("2026-12-10"));
  assert.equal(answer.status, "CLOSED");
});

test("Alberta ducks are UNKNOWN rather than CLOSED, because their row varies by residency", () => {
  const answer = evaluateFederal("species:mallard", "jurisdiction:ca-ab", { latitude: 53.5 }, on("2026-10-01"), "200");
  assert.equal(answer.status, "UNKNOWN");
});

test("Alberta geese, whose row does not vary by residency, do answer", () => {
  /* Zone No. 1: Canada Geese, Cackling Geese and White-fronted Geese,
     September 1 to December 16, daily 8. */
  const answer = evaluateFederal("species:canada-goose", "jurisdiction:ca-ab", { latitude: 53.5 }, on("2026-10-01"), "200");
  assert.equal(answer.status, "CONDITIONAL");
  assert.equal(answer.sharedLimit?.daily, 8);
  assert.match(answer.sharedLimit!.sharedWith, /Canada Geese, Cackling Geese and White-fronted Geese/);
});

test("Alberta Zone No. 2 opens a week later than Zone No. 1, and the map knows which unit is which", () => {
  /* Zone 1: September 1 to December 16. Zone 2: September 8 to December 23. */
  const zone2Unit = "102";
  assert.equal(evaluateFederal("species:canada-goose", "jurisdiction:ca-ab", { latitude: 53 }, on("2026-09-03"), zone2Unit).status, "CLOSED");
  assert.equal(evaluateFederal("species:canada-goose", "jurisdiction:ca-ab", { latitude: 53 }, on("2026-09-03"), "200").status, "CONDITIONAL");
  assert.equal(evaluateFederal("species:canada-goose", "jurisdiction:ca-ab", { latitude: 53 }, on("2026-12-20"), zone2Unit).status, "CONDITIONAL");
});

test("Northern Yukon sandhill crane is a DECLARED closure", () => {
  const answer = evaluateFederal("species:sandhill-crane", "jurisdiction:ca-yt", { latitude: 67.5 }, on("2026-09-20"));
  assert.equal(answer.status, "CLOSED");
  assert.match(answer.summary, /declare no open season/);
});

/*
 * ── Seasons the regulation writes as a rule rather than as days ──
 *
 * Schedule 3 Part 10 gives British Columbia's District No. 2 duck season as
 * "The Saturday after the first Monday in October to the first Sunday after
 * January 19". Environment and Climate Change Canada's own published summary
 * for British Columbia states that same season, for August 2026 to July 2027,
 * as OCTOBER 10 TO JANUARY 24. These cases are written from the authority's
 * published days, not from what the code computes.
 */
test("a relative season opens on the day the authority published", () => {
  const open = evaluateFederal("species:mallard", "jurisdiction:ca-bc", { latitude: 49.2 }, on("2026-10-10"), "2-10");
  assert.equal(open.status, "CONDITIONAL");
  assert.equal(open.season?.opens, "10-10");
  assert.equal(open.season?.closes, "01-24");
});

test("a relative season is not open the day before it opens", () => {
  const before = evaluateFederal("species:mallard", "jurisdiction:ca-bc", { latitude: 49.2 }, on("2026-10-09"), "2-10");
  assert.notEqual(before.status, "CONDITIONAL");
});

test("both ends of a computed season are inclusive", () => {
  const last = evaluateFederal("species:mallard", "jurisdiction:ca-bc", { latitude: 49.2 }, on("2027-01-24"), "2-10");
  assert.equal(last.status, "CONDITIONAL");
  const after = evaluateFederal("species:mallard", "jurisdiction:ca-bc", { latitude: 49.2 }, on("2027-01-25"), "2-10");
  assert.notEqual(after.status, "CONDITIONAL");
});

test("the season moves with the year, because the rule does", () => {
  /*
   * The whole reason the rule is stored instead of the days. The first Monday
   * in October 2027 is the 4th, so this season opens on the 9th — a day that
   * is NOT open in 2026. A build that computed the days once and stored them
   * would answer October 10 here and be wrong by a day, in the direction that
   * tells a hunter the season is closed when it is open.
   */
  const opensLater = evaluateFederal("species:mallard", "jurisdiction:ca-bc", { latitude: 49.2 }, on("2027-10-08"), "2-10");
  assert.notEqual(opensLater.status, "CONDITIONAL");
  const opensNow = evaluateFederal("species:mallard", "jurisdiction:ca-bc", { latitude: 49.2 }, on("2027-10-09"), "2-10");
  assert.equal(opensNow.status, "CONDITIONAL");
  assert.equal(opensNow.season?.opens, "10-09");
});

test("a date inside the tail of a season that opened last year is open", () => {
  /*
   * January 3 belongs to the season that opened in October, not to one that
   * has not started. A resolver that only ever tried the date's own year
   * would answer CLOSED for every January day of every crossing season.
   */
  const january = evaluateFederal("species:mallard", "jurisdiction:ca-bc", { latitude: 49.2 }, on("2027-01-03"), "2-10");
  assert.equal(january.status, "CONDITIONAL");
  assert.equal(january.season?.opens, "10-10");
});

/* ── Saskatchewan: the inventory read live, and the zone left out ── */

test("Saskatchewan answers in both districts, including a zone the regulation names in words", () => {
  /* Schedule 3 Part 8: ducks, September 1 to December 16, daily 8, possession
     24, in both District No. 1 (North) and District No. 2 (South). */
  const north = evaluateFederal("species:mallard", "jurisdiction:ca-sk", { latitude: 54.5 }, on("2026-10-01"), "55");
  assert.equal(north.status, "CONDITIONAL");
  assert.equal(north.area?.name, "District No. 1 (North)");
  assert.equal(north.sharedLimit?.daily, 8);

  const south = evaluateFederal("species:mallard", "jurisdiction:ca-sk", { latitude: 50.4 }, on("2026-10-01"), "10");
  assert.equal(south.status, "CONDITIONAL");
  assert.equal(south.area?.name, "District No. 2 (South)");

  /* "the Saskatoon and Regina-Moose Jaw Provincial Wildlife Management Zones"
     — named in words, matched to the ministry's own name for the zone. */
  const saskatoon = evaluateFederal("species:mallard", "jurisdiction:ca-sk", { latitude: 52.1 }, on("2026-10-01"), "SWMZ");
  assert.equal(saskatoon.status, "CONDITIONAL");
  assert.equal(saskatoon.area?.name, "District No. 2 (South)");
});

test("Prince Albert WMZ is in no federal district, and says so", () => {
  /*
   * Schedule 3 Part 8 names the Saskatoon and Regina-Moose Jaw zones and NOT
   * Prince Albert. The province publishes three urban zones; the regulation
   * places two. A build that assumed the third into the district around it
   * would invent a federal season for a real place.
   */
  const answer = evaluateFederal("species:mallard", "jurisdiction:ca-sk", { latitude: 53.2 }, on("2026-10-01"), "PWMZ");
  assert.equal(answer.status, "UNKNOWN");
});

test("every encoded rule names an area the bundle actually derived", () => {
  /*
   * 67 of 194 rules once named an area that did not exist — conjunctions
   * ("Districts C and D") stored whole, and rows for districts whose
   * definitions were refused. None of them published a wrong season, because
   * an unmatched area already answers UNKNOWN. What they did was inflate the
   * encoded count by more than a third, so the build reported coverage the
   * engine could not deliver. This is the assertion that keeps the count
   * honest, and it is about the BUNDLE, not about any one jurisdiction.
   */
  const bundle = JSON.parse(readFileSync("content/regulatory/ca-federal-2026.json", "utf8")) as {
    areas: { name: string }[];
    rules: { area: string }[];
  };
  const derived = new Set(bundle.areas.map((area) => area.name));
  const orphaned = bundle.rules.filter((rule) => !derived.has(rule.area)).map((rule) => rule.area);
  assert.deepEqual([...new Set(orphaned)], [], "every rule must name a derived federal area");
});

/* ── A refusal reason is a claim, and it can be wrong while the refusal is right ── */

test("no row is filed as a date problem when its dates actually read", () => {
  /*
   * The defect this pins: `/\(in Provincial/i` matched Alberta's wording and
   * missed British Columbia's "(ONLY in Provincial Management Units …)", so 19
   * rows blocked by SCOPE were stamped "a relative-date phrasing this build
   * does not recognise". The bucket reported a missing CAPABILITY that did not
   * exist — and refusal buckets are what work gets prioritised from, so the
   * wrong reason sent effort at the wrong thing.
   *
   * The assertion is self-checking rather than a list of known rows: for every
   * refusal whose reason blames the DATES, the dates must genuinely fail to
   * read. A future detector that misses another jurisdiction's wording lands
   * its rows here and fails this test, instead of quietly renaming the bucket.
   */
  const bundle = JSON.parse(readFileSync("content/regulatory/ca-federal-2026.json", "utf8")) as {
    notEncoded: { reason: string; statedAs?: string; where?: string }[];
  };

  const blamesTheDates = /relative-date phrasing|not a plain calendar window/;
  const plainWindow = /^([A-Z][a-z]+)\s+(\d{1,2})\s+to\s+([A-Z][a-z]+)\s+(\d{1,2})$/;

  const misfiled = bundle.notEncoded
    .filter((entry) => blamesTheDates.test(entry.reason))
    .map((entry) => (entry.statedAs ?? "").split(" | ")[0].replace(/^\((?:[a-z]+|[ivx]+|[A-Z])\)\s*/, "").trim())
    .filter((season) => season && (plainWindow.test(season) || parseRelativeWindow(season) !== null));

  assert.deepEqual(misfiled, [], "these rows' dates read fine; they are refused for something else");
});

test("no season in Schedule 3 is refused for its dates at all", () => {
  /*
   * This replaces a test that asserted "the four unreadable windows are the
   * leap-year form". It failed the moment that form was read — which is what it
   * was written to do: demand deletion rather than pass vacuously on zero rows.
   * Recording the succession here because a test whose premise expires is easy
   * to delete quietly and pretend it never constrained anything.
   *
   * What replaces it is stronger. Every season date this build meets is now
   * either read or refused for a reason that is not about dates — plain
   * windows, relative dates, and the leap-year branches between them.
   *
   * So a date-blamed refusal reappearing is never a pass-by-default. It is one
   * of exactly two things, and both need a person: a genuinely new phrasing the
   * authority has started using, or a detector that has stopped matching one it
   * already used. The companion test above then says which.
   */
  const bundle = JSON.parse(readFileSync("content/regulatory/ca-federal-2026.json", "utf8")) as {
    notEncoded: { reason: string; statedAs?: string; where?: string }[];
  };
  const blamed = bundle.notEncoded
    .filter((entry) => /relative-date phrasing|not a plain calendar window/.test(entry.reason))
    .map((entry) => `${entry.where}: ${entry.statedAs}`);
  assert.deepEqual(blamed, [], "a season refused for its dates is a new phrasing or a broken detector; read it");
});

/* ── A season narrowed to named units inside a federal district ── */

test("a narrowed season ADDS a window; it does not replace the district-wide one", () => {
  /*
   * Schedule 3 Part 10, British Columbia District No. 6, ducks:
   *   (i)   September 1 to September 30 (only in Units 6-1, 6-2, 6-4 to 6-10
   *         and 6-15 to 6-30)
   *   (ii)  October 1 to November 30                      — the whole district
   *   (iii) December 1 to January 15 (only in Units 6-3 and 6-11 to 6-14)
   *
   * Read from the regulation rather than assumed. Treating a narrowed entry as
   * an override would have closed (ii) for everyone; treating it as unscoped
   * would open September in units the regulation excludes.
   */
  const duck = (unit: string, date: string) =>
    evaluateFederal("species:mallard", "jurisdiction:ca-bc", { latitude: 49 }, on(date), unit);

  assert.equal(duck("6-1", "2026-09-15").season?.opens, "09-01", "6-1 is in the September sub-list");
  assert.notEqual(duck("6-3", "2026-09-15").status, "CONDITIONAL", "6-3 is not");

  /* The district-wide entry reaches both. */
  assert.equal(duck("6-1", "2026-10-15").season?.opens, "10-01");
  assert.equal(duck("6-3", "2026-10-15").season?.opens, "10-01");

  assert.equal(duck("6-3", "2026-12-15").season?.opens, "12-01", "6-3 is in the December sub-list");
  assert.notEqual(duck("6-1", "2026-12-15").status, "CONDITIONAL", "6-1 is not");
});

test("a narrowed season is never applied without the unit", () => {
  /*
   * Without a designation a narrowed rule cannot be shown to apply, so it does
   * not. Applying it across the district would be a season right in part of it
   * and wrong in the rest.
   */
  const noUnit = evaluateFederal("species:mallard", "jurisdiction:ca-bc", { latitude: 49 }, on("2026-09-15"));
  assert.notEqual(noUnit.status, "CONDITIONAL");
});

test("units covered by no season answer UNKNOWN, never CLOSED", () => {
  /*
   * District No. 2's Brant seasons are all narrowed to other units, so 2-10 is
   * covered by none. The partition is CHECKED at build time and the gap is
   * recorded; nothing is synthesised for it. CLOSED here would be a
   * restriction stricter than the source.
   */
  const answer = evaluateFederal("species:brant", "jurisdiction:ca-bc", { latitude: 49 }, on("2026-11-01"), "2-10");
  assert.equal(answer.status, "UNKNOWN");
});

test("a sub-list may never name a unit outside its own federal district", () => {
  /*
   * The build refuses such a row rather than widening the district: a sub-list
   * naming a unit the district does not contain is a misreading of the row, not
   * a narrowing of it. Asserted over the bundle so a future jurisdiction cannot
   * introduce one silently.
   */
  const bundle = JSON.parse(readFileSync("content/regulatory/ca-federal-2026.json", "utf8")) as {
    areas: { jurisdictionId: string; name: string; units?: string[] }[];
    rules: { jurisdictionId: string; area: string; units?: string[] }[];
  };
  const narrowed = bundle.rules.filter((rule) => rule.units);
  assert.ok(narrowed.length > 0, "this test needs deleting, not passing, if no rule is unit-scoped");
  for (const rule of narrowed) {
    const district = bundle.areas.find((a) => a.jurisdictionId === rule.jurisdictionId && a.name === rule.area);
    const outside = rule.units!.filter((unit) => !district?.units?.includes(unit));
    assert.deepEqual(outside, [], `${rule.area} has a season scoped to units it does not contain`);
  }
});

/* ── A season that depends on the length of February ── */

test("a leap-year season takes the branch the year actually is", () => {
  /*
   * Schedule 3 Part 10, British Columbia District No. 2, Canada and Cackling
   * Geese, stated as two branches of one season:
   *   "in a year that is not a leap year, February 10 to March 10"
   *   "in a leap year, February 11 to March 10"
   *
   * 2027 is not a leap year; 2028 is. February 10 is therefore open in 2027 and
   * CLOSED in 2028 — one day, opposite answers, decided by the branch. Storing
   * whichever branch applied when the bundle was built would be right for one
   * year and wrong for the next, exactly as with a relative date.
   *
   * The branch selection is verified against the authority in
   * scripts/certify-relative-dates.mjs, in both directions: for the season in
   * force its non-leap windows appear in ECCC's published summary and its
   * leap-only windows are absent from it.
   */
  const geese = (date: string) =>
    evaluateFederal("species:canada-goose", "jurisdiction:ca-bc", { latitude: 49 }, on(date), "2-10");

  assert.equal(geese("2027-02-10").status, "CONDITIONAL", "2027 is not a leap year: the season opens February 10");
  assert.equal(geese("2027-02-10").season?.opens, "02-10");

  assert.notEqual(geese("2028-02-10").status, "CONDITIONAL", "2028 IS a leap year: February 10 is before it opens");
  assert.equal(geese("2028-02-11").status, "CONDITIONAL");
  assert.equal(geese("2028-02-11").season?.opens, "02-11");

  /* Both branches close on the same day, which the regulation states outright. */
  assert.equal(geese("2027-03-10").status, "CONDITIONAL");
  assert.equal(geese("2028-03-10").status, "CONDITIONAL");
});

test("exactly one branch of a leap-year season can apply to a date", () => {
  /*
   * The two branches overlap on every day from the later opening onward, so a
   * build that failed to filter by year would find both and answer from
   * whichever came first. Asserted over the bundle rather than by example: no
   * date may match more than one branch of the same season.
   */
  const bundle = JSON.parse(readFileSync("content/regulatory/ca-federal-2026.json", "utf8")) as {
    rules: { area: string; groupId: string; leapYear?: boolean; units?: string[] }[];
  };
  const branches = bundle.rules.filter((rule) => rule.leapYear !== undefined);
  assert.ok(branches.length > 0, "this test needs deleting, not passing, if no season branches on leap years");

  const byScope = new Map<string, boolean[]>();
  for (const rule of branches) {
    const key = `${rule.area}|${rule.groupId}|${(rule.units ?? []).join(",")}`;
    byScope.set(key, [...(byScope.get(key) ?? []), rule.leapYear!]);
  }
  for (const [key, kinds] of byScope) {
    assert.deepEqual([...kinds].sort(), [false, true], `${key} must state both branches exactly once`);
  }
});

/* ── When a federal season next opens ── */

test("a federal season carries its next opening, and it moves with the year", () => {
  /*
   * FEDERAL SEASONS CARRY NO EXPIRY. The Migratory Birds Regulations are
   * standing law rather than an annual summary — the bundle declares no
   * certified period, and `insideWindow` already compares month and day with
   * no year bound. So the next OCCURRENCE is what the regulation says,
   * whatever year it falls in, and `NONE_IN_CERTIFIED_PERIOD` never applies.
   *
   * British Columbia's District No. 2 duck season is written relatively, so
   * its next opening is a different day each year — which is the stored-
   * expression design showing up two layers downstream.
   */
  const duck = (date: string) =>
    evaluateFederal("species:mallard", "jurisdiction:ca-bc", { latitude: 49 }, on(date), "2-10");

  assert.deepEqual(duck("2026-08-01").next, { kind: "SEASON", opens: "2026-10-10", closes: "2027-01-24" });
  /* Inside the season, "next" is the FOLLOWING one — never the current one. */
  assert.deepEqual(duck("2026-10-15").next, { kind: "SEASON", opens: "2027-10-09", closes: "2028-01-23" });
  assert.equal(duck("2026-10-15").status, "CONDITIONAL", "carrying a next opening must not change the status");
});

test("a leap-year branch is skipped in years it does not apply to", () => {
  /*
   * The next occurrence must respect the branch: a rule that only applies in
   * leap years cannot supply the opening for a common year.
   */
  const geese = evaluateFederal("species:canada-goose", "jurisdiction:ca-bc", { latitude: 49 }, on("2027-03-15"), "2-10");
  assert.equal(geese.next.kind, "SEASON");
  if (geese.next.kind === "SEASON") {
    const year = Number(geese.next.opens.slice(0, 4));
    assert.ok(year >= 2027, "a next opening is never in the past");
  }
});

test("a composed answer follows the status, and never passes a next through", () => {
  /*
   * `next` composes by the rule the STATUS already uses. Where the province has
   * certified nothing there is no constraint to intersect with and the federal
   * season is the whole of what North Ground knows. Where the province HAS
   * certified rules, the honest answer is the first date BOTH layers permit,
   * which cannot be had from two next-opening VALUES — a federal opening in
   * October while the province is shut until November is not a date anyone may
   * hunt, and neither side's own next says so.
   */
  const federal = evaluateFederal("species:mallard", "jurisdiction:ca-bc", { latitude: 49 }, on("2026-08-01"), "2-10");
  assert.equal(federal.next.kind, "SEASON");

  /* Province silent: the federal season governs, as the status already does. */
  const alone = composeFederalWithProvincial(federal, provincialUnknown, "British Columbia");
  assert.deepEqual(alone.next, federal.next);

  /* Province certified: refuse rather than pass either side's own through. */
  const certified: RegulatoryResult = { ...provincialUnknown, status: "CLOSED" };
  assert.deepEqual(composeFederalWithProvincial(federal, certified, "British Columbia").next, { kind: "NOT_CERTIFIED" });
});
