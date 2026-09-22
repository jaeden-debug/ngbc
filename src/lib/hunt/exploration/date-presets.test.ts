import assert from "node:assert/strict";
import test from "node:test";
import { dateChipLabel, longDayLabel, presetDate, presetOf, shortDayLabel } from "./date-presets.ts";

/* `todayIso` reads the device's local calendar, so these build `now` from local
   parts. They hold in every time zone the CI matrix runs (UTC, Toronto,
   Vancouver, Sydney, Kiritimati). */
const local = (year: number, month: number, day: number, hour = 12, minute = 0) => new Date(year, month - 1, day, hour, minute);

test("today is the device's own calendar day", () => {
  assert.equal(presetDate("today", local(2026, 9, 22, 21, 53)), "2026-09-22");
});

test("late evening is still today, whatever UTC says", () => {
  // 23:59 local is the next day in UTC for every zone west of Greenwich.
  assert.equal(presetDate("today", local(2026, 9, 22, 23, 59)), "2026-09-22");
});

test("the day the clocks change is one day, not 23 or 25 hours", () => {
  // November 1, 2026: daylight saving ends across Canada. March 8, 2026: it begins.
  assert.equal(presetDate("today", local(2026, 11, 1, 0, 30)), "2026-11-01");
  assert.equal(presetDate("today", local(2026, 11, 1, 23, 30)), "2026-11-01");
  assert.equal(presetDate("today", local(2026, 3, 8, 3, 30)), "2026-03-08");
});

test("today is the only preset: every other day is named by its date", () => {
  const now = local(2026, 9, 22);
  assert.equal(presetOf("2026-09-22", now), "today");
  assert.equal(dateChipLabel("2026-09-22", now), "Today");
  // Tomorrow is a day like any other (owner decision, 2026-09-22).
  assert.equal(presetOf("2026-09-23", now), null);
  assert.equal(dateChipLabel("2026-09-23", now), shortDayLabel("2026-09-23", now));
  assert.equal(presetOf("2026-09-21", now), null);
  assert.equal(dateChipLabel("2026-10-03", now), "Sat, Oct 3");
  assert.equal(dateChipLabel("2027-10-03", now), "Sun, Oct 3, 2027");
});

test("labels are read from the calendar, never through a timestamp", () => {
  assert.equal(shortDayLabel("2026-11-01", local(2026, 9, 22)), "Sun, Nov 1");
  assert.equal(longDayLabel("2026-09-22"), "September 22, 2026");
  assert.equal(longDayLabel("not-a-date"), "not-a-date");
});
