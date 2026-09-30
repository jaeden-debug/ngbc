import assert from "node:assert/strict";
import test from "node:test";
import type { IsoDate } from "../../content-contract/index.ts";
import { pointTimeZone } from "../time-zone.ts";
import { legalTimeFor, type LegalTimeRule } from "./legal-time.ts";

const SOURCE = "source:us-wa-wac-220-416-020" as never;
const SEATTLE = { latitude: 47.6062, longitude: -122.3321 };
const PACIFIC = pointTimeZone("America/Los_Angeles", "SINGLE_ZONE_JURISDICTION");

/**
 * Washington's table as WAC 220-416-020 prints it, for the season beginning on
 * a Sunday — three rows, both of the authority's areas, including the single
 * daylight-saving transition row.
 *
 * Absolute dates are what make one shape serve Washington's seven weekday
 * variants: choosing the table is finding the row that contains the date.
 */
const WASHINGTON: LegalTimeRule = {
  basis: "AUTHORITY_TABLE",
  area: "Western Washington",
  rows: [
    { from: "2025-09-01" as IsoDate, to: "2025-09-08" as IsoDate, area: "Western Washington", opensAt: "06:00", closesAt: "20:15" },
    { from: "2025-09-01" as IsoDate, to: "2025-09-08" as IsoDate, area: "Eastern Washington", opensAt: "05:45", closesAt: "20:00" },
    { from: "2025-10-14" as IsoDate, to: "2025-10-20" as IsoDate, area: "Western Washington", opensAt: "07:00", closesAt: "18:50" },
    { from: "2025-11-03" as IsoDate, to: "2025-11-03" as IsoDate, area: "Western Washington", opensAt: "06:20", closesAt: "17:25" },
  ],
  statedAs: "The following tables show the lawful hunting hours (1/2 hour before sunrise to 1/2 hour after sunset) for big game animals, rabbits, hares, fox, and forest grouse (ruffed, blue, spruce) during established seasons.",
  section: "WAC 220-416-020(1)",
  sourceId: SOURCE,
};

test("a published table is read, not recomputed from the sun", () => {
  const answer = legalTimeFor(WASHINGTON, SEATTLE, "2025-09-05" as IsoDate, PACIFIC);
  assert.equal(answer.status, "RESOLVED");
  if (answer.status !== "RESOLVED") return;
  assert.equal(answer.basis, "AUTHORITY_TABLE");
  /* The authority's own printed pair, to the minute. */
  assert.deepEqual(answer.window, { opensAt: "06:00", closesAt: "20:15" });
  /* And no astronomy was done, so no inward margin is claimed for arithmetic
     that did not happen. A margin here would be a statement about our solar
     algorithm's error in an answer our solar algorithm never touched. */
  assert.deepEqual(answer.precision, { marginMinutes: 0, appliedInward: true, algorithm: "none" });
  assert.equal(answer.section, "WAC 220-416-020(1)");
});

test("the parenthetical principle is not the rule, and would give a different answer", async () => {
  /* WAC 220-416-020 opens by describing its tables as "1/2 hour before sunrise
     to 1/2 hour after sunset". Reading that as a formula is the trap: it is a
     description of how the table was built, and our astronomy does not
     reproduce the printed numbers. This test exists to pin the DISAGREEMENT, so
     nobody later "simplifies" Washington into an offset rule. */
  const { sunriseSunset, wallClock } = await import("./solar.ts");
  const solar = sunriseSunset(SEATTLE.latitude, SEATTLE.longitude, { year: 2025, month: 9, day: 5 });
  assert.ok("sunrise" in solar, "Seattle in September has a sunrise");
  if (!("sunrise" in solar)) return;
  const computedOpen = wallClock(solar.sunrise, "America/Los_Angeles");
  const table = legalTimeFor(WASHINGTON, SEATTLE, "2025-09-05" as IsoDate, PACIFIC);
  assert.equal(table.status, "RESOLVED");
  if (table.status !== "RESOLVED") return;
  /* Half an hour before this date's computed sunrise is NOT 06:00 on Washington's
     table. Whichever way the gap runs, the table is the one with legal force. */
  const minutes = Number(computedOpen.slice(0, 2)) * 60 + Number(computedOpen.slice(3, 5)) - 30;
  const offsetOpen = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  assert.notEqual(offsetOpen, table.window.opensAt,
    "if these ever agree, this test is no longer proving anything — check the fixture before deleting it");
});

test("the authority's own area selects the row, and the other area's row is not returned", () => {
  const eastern: LegalTimeRule = { ...WASHINGTON, area: "Eastern Washington" };
  const answer = legalTimeFor(eastern, SEATTLE, "2025-09-05" as IsoDate, PACIFIC);
  assert.equal(answer.status, "RESOLVED");
  if (answer.status !== "RESOLVED") return;
  /* Eastern Washington's printed times, even though the POINT is in Seattle:
     the area is resolved from the authority's published band geometry before
     the rule is built, and this branch must not second-guess it from a
     longitude. Getting this backwards would silently answer the wrong half of
     the state. */
  assert.deepEqual(answer.window, { opensAt: "05:45", closesAt: "20:00" });
});

test("a date the table does not cover is refused, never calculated", () => {
  /* The date is mid-season and perfectly ordinary — the table simply has no row
     for it here. §8: "could not find a row" is not "there is no rule", and it
     is certainly not permission to substitute our own arithmetic. */
  const answer = legalTimeFor(WASHINGTON, SEATTLE, "2025-09-20" as IsoDate, PACIFIC);
  assert.equal(answer.status, "NOT_CERTIFIED");
  if (answer.status !== "NOT_CERTIFIED") return;
  assert.match(answer.reason, /published table/);
  assert.match(answer.reason, /2025-09-20/);
  assert.match(answer.reason, /no window is computed from sunrise and sunset/i);
  /* Absent, not "NORTH_GROUND": this module documents an absent `reasonOwner`
     as meaning North Ground's own English, and the refusal is our sentence. A
     declared owner here would be the claim that an authority wrote it. */
  assert.equal(answer.reasonOwner, undefined);
  assert.equal(answer.authority, "North Ground");
  assert.equal(answer.sourceId, SOURCE);
});

test("a licence year whose table has not been read has no rows, and says so", () => {
  /* Pennsylvania re-enacts § 141.4 every licence year (amended 29 May 2026,
     effective 1 July 2026 to 30 June 2027). An unread year must refuse rather
     than reuse last year's printed clock, which would be a wrong legal claim
     that looks exactly like a right one. */
  const unread: LegalTimeRule = { ...WASHINGTON, rows: [] };
  const answer = legalTimeFor(unread, SEATTLE, "2025-09-05" as IsoDate, PACIFIC);
  assert.equal(answer.status, "NOT_CERTIFIED");
});

test("a table-based rule still refuses without a timezone, because a clock needs one", () => {
  const answer = legalTimeFor(WASHINGTON, SEATTLE, "2025-09-05" as IsoDate, undefined);
  assert.equal(answer.status, "NOT_CERTIFIED");
  if (answer.status !== "NOT_CERTIFIED") return;
  assert.match(answer.reason, /timezone/);
});
