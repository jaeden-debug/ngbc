import assert from "node:assert/strict";
import { test } from "node:test";
import type { IsoDate } from "../../content-contract/index.ts";
import { daylightSavingInEffect, ontarioStatutoryClock } from "./statutory-time.ts";

const on = (value: string) => value as IsoDate;

/*
 * The boundary weekdays were checked against an independent calendar, not
 * derived from the code under test: 2026-03-08 Sunday (second in March),
 * 2026-11-01 Sunday (first in November), 2027-03-14 and 2027-11-07 Sundays.
 */

test("daylight saving runs from the second Sunday in March to the first in November", () => {
  assert.equal(daylightSavingInEffect(on("2026-03-07")), false, "the Saturday before");
  assert.equal(daylightSavingInEffect(on("2026-03-08")), true, "the second Sunday in March");
  assert.equal(daylightSavingInEffect(on("2026-10-31")), true, "the Saturday before the first Sunday");
  assert.equal(daylightSavingInEffect(on("2026-11-01")), false, "the first Sunday in November ends it");
  /* A different year moves both boundaries. */
  assert.equal(daylightSavingInEffect(on("2027-03-13")), false);
  assert.equal(daylightSavingInEffect(on("2027-03-14")), true);
});

test("the meridian of 90° W. divides the standard offset, as s. 2 states", () => {
  /* Toronto, well east: five hours behind Greenwich in winter. */
  const east = ontarioStatutoryClock({ longitude: -79.4 }, on("2026-01-15"));
  assert.equal(east.status, "RESOLVED");
  assert.equal(east.status === "RESOLVED" && east.offsetMinutes, -300);
  assert.equal(east.status === "RESOLVED" && east.section, "Time Act, R.S.O. 1990, c. T.9, s. 2 (1)");

  /* Kenora, well west: six hours behind in winter. */
  const west = ontarioStatutoryClock({ longitude: -94.5 }, on("2026-01-15"));
  assert.equal(west.status === "RESOLVED" && west.offsetMinutes, -360);
  assert.equal(west.status === "RESOLVED" && west.section, "Time Act, R.S.O. 1990, c. T.9, s. 2 (2)");
});

test("daylight saving moves both sides by exactly one hour", () => {
  const east = ontarioStatutoryClock({ longitude: -79.4 }, on("2026-07-15"));
  assert.equal(east.status === "RESOLVED" && east.offsetMinutes, -240);
  const west = ontarioStatutoryClock({ longitude: -94.5 }, on("2026-07-15"));
  assert.equal(west.status === "RESOLVED" && west.offsetMinutes, -300);
});

test("a point on the meridian is not given a side", () => {
  /*
   * The Act draws a line of longitude and a consumer fix is not a survey
   * (§41). The cost of refusing is a check with the authority; the cost of
   * choosing is an hour of the wrong clock.
   */
  const onLine = ontarioStatutoryClock({ longitude: -90 }, on("2026-07-15"));
  assert.equal(onLine.status, "NOT_CERTIFIED");
  assert.match(onLine.status === "NOT_CERTIFIED" ? onLine.reason : "", /90° W/);

  /* And just off it, the answer returns rather than staying refused. */
  assert.equal(ontarioStatutoryClock({ longitude: -90.01 }, on("2026-07-15")).status, "RESOLVED");
});

test("the offset is carried by a fixed-offset zone, never a regional one", () => {
  /*
   * A named regional zone imports a database's daylight-saving policy; the
   * policy here is the Act's. `America/Atikokan` in particular encodes observed
   * local practice the statute does not provide for.
   */
  const west = ontarioStatutoryClock({ longitude: -94.5 }, on("2026-01-15"));
  assert.equal(west.status === "RESOLVED" && west.zone, "Etc/GMT+6");
  const east = ontarioStatutoryClock({ longitude: -79.4 }, on("2026-07-15"));
  assert.equal(east.status === "RESOLVED" && east.zone, "Etc/GMT+4");
  assert.ok(west.status === "RESOLVED" && !west.zone.startsWith("America/"));
});

test("west of the meridian records that observed clocks may differ, with why", () => {
  /*
   * Atikokan and Pickle Lake keep Eastern time all year and NO INSTRUMENT
   * backs it: s. 2 (5) is the only mechanism, it was exercised once, and that
   * regulation was revoked in 2010. So the legal clock is the statutory one
   * while a hunter's phone there may show another — recorded as a fact, not as
   * a boundary North Ground does not hold.
   */
  const west = ontarioStatutoryClock({ longitude: -91.6 }, on("2026-11-15"));
  assert.ok(west.status === "RESOLVED" && west.divergence, "a divergence must be recorded west of the meridian");
  assert.match(west.status === "RESOLVED" ? west.divergence!.statedAs : "", /O\. Reg\. 111\/06, which was revoked/);

  /* East of it there is no such practice to record. */
  const east = ontarioStatutoryClock({ longitude: -79.4 }, on("2026-11-15"));
  assert.equal(east.status === "RESOLVED" && east.divergence, undefined);
});
