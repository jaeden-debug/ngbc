import assert from "node:assert/strict";
import test from "node:test";
import {
  addDaysIso, addMonths, compareIso, daysInMonth, formatDateInput, isLeapYear, isoParts,
  isoToDisplay, isValidIso, isValidYmd, jurisdictionTodayIso, parseDateInput, readableIso,
  todayIso, weekdayOf,
} from "./date.ts";

/* ── Fast numeric entry ──────────────────────────────────────────────────── */

test("typing eight digits normalises to the canonical display format", () => {
  assert.equal(formatDateInput("20260808"), "2026/08/08");
  assert.equal(parseDateInput("20260808").iso, "2026-08-08");
});

test("progressive formatting inserts separators as the digits arrive", () => {
  const steps = ["2", "20", "202", "2026", "20260", "202608", "2026080", "20260808"];
  const shown = steps.map(formatDateInput);
  assert.deepEqual(shown, [
    "2", "20", "202", "2026", "2026/0", "2026/08", "2026/08/0", "2026/08/08",
  ]);
  // Only the last step is a date; the rest must not raise an error at the typist.
  assert.deepEqual(
    steps.slice(0, -1).map((step) => parseDateInput(step).status),
    Array(7).fill("INCOMPLETE"),
  );
});

test("an already-separated value is accepted unchanged", () => {
  assert.equal(formatDateInput("2026/08/08"), "2026/08/08");
  assert.equal(parseDateInput("2026/08/08").iso, "2026-08-08");
});

test("a pasted ISO value is normalised to the display format", () => {
  assert.equal(formatDateInput("2026-08-08"), "2026/08/08");
  assert.equal(parseDateInput("2026-08-08").iso, "2026-08-08");
});

test("pasted values with stray characters still normalise", () => {
  assert.equal(formatDateInput(" 2026 . 08 . 08 "), "2026/08/08");
  assert.equal(parseDateInput("2026.08.08").iso, "2026-08-08");
});

test("input longer than a date is truncated rather than corrupting the day", () => {
  assert.equal(formatDateInput("2026080899"), "2026/08/08");
});

/* ── Validation ──────────────────────────────────────────────────────────── */

test("February 29 is rejected in a common year and accepted in a leap year", () => {
  const common = parseDateInput("20260229");
  assert.equal(common.status, "INVALID");
  assert.match(common.message!, /February 2026 has 28 days/);

  assert.equal(parseDateInput("20280229").iso, "2028-02-29");
});

test("an impossible month is rejected", () => {
  const result = parseDateInput("20261301");
  assert.equal(result.status, "INVALID");
  assert.match(result.message!, /no month 13/);
});

test("an impossible day is rejected", () => {
  assert.equal(parseDateInput("20261232").status, "INVALID");
  assert.equal(parseDateInput("20260231").status, "INVALID");
  assert.equal(parseDateInput("20260800").status, "INVALID");
});

test("an invalid date never yields an ISO value", () => {
  for (const raw of ["20260229", "20261301", "20261232", "20260231", "18000101"]) {
    assert.equal(parseDateInput(raw).iso, undefined, raw);
  }
});

test("empty and partial input are distinguished from invalid input", () => {
  assert.equal(parseDateInput("").status, "EMPTY");
  assert.equal(parseDateInput("   ").status, "EMPTY");
  assert.equal(parseDateInput("2026").status, "INCOMPLETE");
  assert.equal(parseDateInput("20260").status, "INCOMPLETE");
  assert.equal(parseDateInput("2026/08").status, "INCOMPLETE");
});

test("leap-year and month-length arithmetic is correct", () => {
  assert.equal(isLeapYear(2026), false);
  assert.equal(isLeapYear(2028), true);
  assert.equal(isLeapYear(2100), false);
  assert.equal(isLeapYear(2000), true);
  assert.equal(daysInMonth(2026, 2), 28);
  assert.equal(daysInMonth(2028, 2), 29);
  assert.equal(daysInMonth(2026, 9), 30);
  assert.equal(daysInMonth(2026, 12), 31);
  assert.equal(isValidYmd(2026, 2, 31), false);
  assert.equal(isValidYmd(2026, 8, 8), true);
});

/* ── Round trips between the two controls ───────────────────────────────── */

test("calendar selection and text entry agree on the same day", () => {
  // Calendar → text.
  assert.equal(isoToDisplay("2026-08-08"), "2026/08/08");
  // Text → calendar.
  const parsed = parseDateInput("20260808");
  assert.deepEqual(isoParts(parsed.iso!), { year: 2026, month: 8, day: 8 });
});

test("ISO validation matches the parser", () => {
  assert.equal(isValidIso("2026-08-08"), true);
  assert.equal(isValidIso("2026-02-29"), false);
  assert.equal(isValidIso("2026-8-8"), false);
  assert.equal(isValidIso("20260808"), false);
  assert.equal(isValidIso(null), false);
});

/* ── Time-zone safety ────────────────────────────────────────────────────── */

test("a hunt date never shifts a day through a time zone", () => {
  // The classic failure: `new Date("2026-08-08")` is the 7th west of Greenwich.
  assert.equal(readableIso("2026-08-08"), "Sat, Aug 8, 2026");
  assert.equal(isoToDisplay("2026-01-01"), "2026/01/01");
  assert.equal(addDaysIso("2026-12-31", 1), "2027-01-01");
  assert.equal(addDaysIso("2026-03-01", -1), "2026-02-28");
  assert.equal(addDaysIso("2028-03-01", -1), "2028-02-29");
});

test("today is read from the viewer's local calendar, not from UTC", () => {
  // A local clock late on the 19th is still the 19th, although UTC has rolled over.
  const lateEvening = new Date(2026, 8, 19, 22, 30, 0);
  assert.equal(todayIso(lateEvening), "2026-09-19");
  const earlyMorning = new Date(2026, 0, 1, 0, 5, 0);
  assert.equal(todayIso(earlyMorning), "2026-01-01");
});

test("month navigation crosses year boundaries in both directions", () => {
  assert.deepEqual(addMonths(2026, 12, 1), { year: 2027, month: 1 });
  assert.deepEqual(addMonths(2026, 1, -1), { year: 2025, month: 12 });
  assert.deepEqual(addMonths(2026, 8, 5), { year: 2027, month: 1 });
});

test("weekday calculation is stable", () => {
  assert.equal(weekdayOf(2026, 8, 8), 6);  // Saturday
  assert.equal(weekdayOf(2026, 9, 20), 0); // Sunday
});

test("dates order lexically, which is why they are stored as ISO", () => {
  assert.equal(compareIso("2026-08-08", "2026-09-01"), -1);
  assert.equal(compareIso("2026-09-01", "2026-08-08"), 1);
  assert.equal(compareIso("2026-08-08", "2026-08-08"), 0);
});


/**
 * The evening a server and a browser disagree about what day it is.
 *
 * This was live: at 21:53 in Ontario the server rendered 2026/09/21 and the
 * browser rendered 2026/09/20, which broke hydration and — the part that
 * actually matters — served every crawler a Hunt page dated tomorrow for four
 * hours a night. It is invisible for the other twenty.
 */
test("the jurisdiction's day is the jurisdiction's, not the server's", () => {
  // 01:53 UTC on the 21st is 21:53 on the 20th in Ontario.
  const evening = new Date("2026-09-21T01:53:00Z");
  assert.equal(jurisdictionTodayIso("America/Toronto", evening), "2026-09-20");
  assert.equal(jurisdictionTodayIso("UTC", evening), "2026-09-21");
});

test("it is computed identically whatever the process time zone", () => {
  // The server runs in UTC and a developer's machine does not. Both must agree,
  // because this value is what hydration compares.
  const instant = new Date("2026-09-21T01:53:00Z");
  assert.equal(jurisdictionTodayIso("America/Toronto", instant), "2026-09-20");
  assert.equal(jurisdictionTodayIso("America/Vancouver", instant), "2026-09-20");
  assert.equal(jurisdictionTodayIso("Australia/Sydney", instant), "2026-09-21");
});

test("it stays on the calendar across a month and year boundary", () => {
  assert.equal(jurisdictionTodayIso("America/Toronto", new Date("2027-01-01T04:30:00Z")), "2026-12-31");
  assert.equal(jurisdictionTodayIso("America/Toronto", new Date("2026-10-01T03:00:00Z")), "2026-09-30");
});

test("it survives the daylight-saving change that makes Ontario UTC-5", () => {
  // After the November change Ontario is UTC-5, so the boundary moves an hour.
  assert.equal(jurisdictionTodayIso("America/Toronto", new Date("2026-11-10T04:30:00Z")), "2026-11-09");
  assert.equal(jurisdictionTodayIso("America/Toronto", new Date("2026-11-10T05:30:00Z")), "2026-11-10");
});
