import assert from "node:assert/strict";
import test from "node:test";
import { HUNT_DEFAULT_TIME_ZONE, jurisdictionTodayIso, readableCalendarDay, todayIso } from "./date.ts";
import { siteYear } from "../site.ts";

/**
 * The date the server renders and the date the browser renders must be the same.
 *
 * This is the guard for a defect that reached production: /hunt was
 * server-rendered on a Vercel function in UTC and hydrated in a browser in
 * Ontario, and for the four hours each evening those disagree, the served HTML
 * said tomorrow. It threw a React hydration error, and — the part that mattered
 * — it told every crawler and every reader without JavaScript that the hunt date
 * was a day later than it was.
 *
 * It was invisible for the other twenty hours, and invisible on a developer's
 * machine at any hour, because there the "server" runs in the same time zone as
 * the browser. So the check is: does anything here change answer when the
 * PROCESS time zone changes? Run under several zones by `npm run test:timezones`,
 * which is what makes these assertions mean something.
 */

/** The evening gap: 01:53 UTC on the 21st is 21:53 on the 20th in Ontario. */
const EVENING = new Date("2026-09-21T01:53:00Z");

test("the jurisdiction's day does not depend on the process time zone", () => {
  // Whatever TZ this process runs in, the answer is Ontario's calendar day.
  assert.equal(jurisdictionTodayIso(HUNT_DEFAULT_TIME_ZONE, EVENING), "2026-09-20");
});

test("it is the day a browser in that jurisdiction would report", () => {
  // `todayIso` reads the process clock, so under TZ=America/Toronto it stands in
  // for the browser. Under any other TZ this comparison is not meaningful, which
  // is exactly why the timezone matrix exists rather than a single run.
  if (process.env.TZ !== HUNT_DEFAULT_TIME_ZONE) return;
  assert.equal(jurisdictionTodayIso(HUNT_DEFAULT_TIME_ZONE, EVENING), todayIso(EVENING));
});

test("todayIso DOES depend on the process clock, which is why it is client-only", () => {
  // Stated as an assertion so the contract is visible: this is the function that
  // must never seed server-rendered state.
  const asServerWouldSeeIt = process.env.TZ === "UTC";
  if (asServerWouldSeeIt) {
    assert.equal(todayIso(EVENING), "2026-09-21", "a UTC server genuinely sees the next day");
    assert.notEqual(
      todayIso(EVENING),
      jurisdictionTodayIso(HUNT_DEFAULT_TIME_ZONE, EVENING),
      "if these ever match under UTC the evening gap has stopped being testable",
    );
  }
});

test("the gap exists in both directions across the date line", () => {
  // Ontario behind UTC, and a zone ahead of it, so the check is not accidentally
  // one-sided.
  assert.equal(jurisdictionTodayIso("America/Toronto", EVENING), "2026-09-20");
  assert.equal(jurisdictionTodayIso("Australia/Sydney", EVENING), "2026-09-21");
});

test("every hour of the evening gap resolves to Ontario's day, not UTC's", () => {
  // The whole window, not one sampled instant inside it.
  for (let hour = 0; hour < 4; hour += 1) {
    const instant = new Date(Date.UTC(2026, 8, 21, hour, 30));
    assert.equal(
      jurisdictionTodayIso(HUNT_DEFAULT_TIME_ZONE, instant),
      "2026-09-20",
      `${instant.toISOString()} is still the 20th in Ontario`,
    );
  }
  // And the hour the window closes.
  assert.equal(jurisdictionTodayIso(HUNT_DEFAULT_TIME_ZONE, new Date(Date.UTC(2026, 8, 21, 4, 30))), "2026-09-21");
});

/* ── Anything rendered on both sides must render the same on both sides ───── */

test("a provenance date reads the same in every time zone", () => {
  // `new Date("2026-09-20")` is midnight UTC, so an unpinned formatter shows the
  // 19th to everyone west of Greenwich. This was live on the Hunt result: the
  // "Record verified" line and every source's retrieved date read a day early
  // for every North American user, and disagreed with the server's HTML.
  assert.equal(readableCalendarDay("2026-09-20"), "Sep 20, 2026");
});

test("it reads a full instant in UTC too, rather than the viewer's clock", () => {
  // These values say when North Ground read a source. They are not statements
  // about where the reader is standing.
  assert.equal(readableCalendarDay("2026-09-20T23:30:00Z"), "Sep 20, 2026");
  assert.equal(readableCalendarDay("2026-09-20T00:30:00Z"), "Sep 20, 2026");
});

test("it refuses a value it cannot read instead of inventing one", () => {
  assert.equal(readableCalendarDay(undefined), null);
  assert.equal(readableCalendarDay(""), null);
  assert.equal(readableCalendarDay("not a date"), null);
});

test("the published year is the jurisdiction's, not the server's", () => {
  // 03:30 UTC on 1 January is still 31 December in Ontario, and the footer had
  // the server and the browser disagreeing about the copyright year for those
  // hours every year.
  const newYearEve = new Date("2027-01-01T03:30:00Z");
  assert.equal(siteYear(newYearEve), "2026");
  assert.equal(siteYear(new Date("2027-01-01T05:30:00Z")), "2027");
});
