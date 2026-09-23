import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseRelativeDate, parseRelativeWindow, resolveRelativeDate, resolveRelativeWindow,
} from "./relative-date.ts";

/** Parse and resolve in one step, so a case reads as the regulation writes it. */
const on = (text: string, year: number) => {
  const expression = parseRelativeDate(text);
  return expression ? resolveRelativeDate(expression, year) : null;
};

/*
 * Every weekday these cases turn on was checked against an independent
 * calendar, not derived from the code under test: 2026-09-01 Tuesday,
 * 2026-08-01 Saturday, 2026-09-30 Wednesday, 2026-10-05 Monday, 2026-10-10
 * Saturday, 2026-10-18 Sunday, 2026-10-30 Friday, 2027-10-09 Saturday,
 * 2028-10-07 Saturday.
 */

test("an nth weekday counts from the first of the month", () => {
  assert.equal(on("the first Saturday in September", 2026), "2026-09-05");
  assert.equal(on("the second Saturday in September", 2026), "2026-09-12");
  assert.equal(on("the third Saturday in September", 2026), "2026-09-19");
  assert.equal(on("the fourth Saturday in September", 2026), "2026-09-26");
});

test("a month that OPENS on the weekday counts that day as the first", () => {
  /* 2026-08-01 is itself a Saturday: the first Saturday is the 1st. */
  assert.equal(on("the first Saturday in August", 2026), "2026-08-01");
});

test("a last weekday walks back from the end of the month", () => {
  assert.equal(on("the last Saturday of September", 2026), "2026-09-26");
  assert.equal(on("the last Wednesday of September", 2026), "2026-09-30");
  /* A month with five of a weekday takes the fifth, not the fourth. */
  assert.equal(on("the last Friday of October", 2026), "2026-10-30");
});

test("'after' is STRICTLY after", () => {
  /* 2026-10-10 is a Saturday. Reading "after" as on-or-after would open this
     season a week early — the exact seven-day error the phrasing risks. */
  assert.equal(on("the first Saturday after October 10", 2026), "2026-10-17");
  assert.equal(on("the first Sunday after October 10", 2026), "2026-10-11");
});

test("a weekday can hang off an nth weekday", () => {
  /* The first Monday in October 2026 is the 5th. */
  assert.equal(on("the first Saturday after the first Monday in October", 2026), "2026-10-10");
  assert.equal(on("the Saturday after the first Monday in October", 2026), "2026-10-10");
  assert.equal(on("the Tuesday after the first Monday in October", 2026), "2026-10-06");
  /* The third Sunday in October 2026 is the 18th. */
  assert.equal(on("the Saturday before the third Sunday in October", 2026), "2026-10-17");
});

test("only operators the authority's published dates confirmed are accepted", () => {
  /* "of" and "in" both name a month and both appear in a verified window
     (Quebec's "the last Saturday OF September", Ontario's "the third Saturday
     IN December"), so both are read. */
  assert.equal(on("the last Saturday of September", 2026), "2026-09-26");
  assert.equal(on("the third Saturday in December", 2026), "2026-12-19");

  /* "following" is Ontario's word for "after" and almost certainly means the
     same thing — but every Schedule 3 row using it is refused for a unit list,
     so no published date ever confirmed that reading. Confidence is not
     verification, so it refuses. */
  assert.equal(parseRelativeDate("the Saturday following the fourth Saturday in September"), null);
});

test("it is a different day each year, which is why it is not stored as one", () => {
  assert.equal(on("the first Saturday after the first Monday in October", 2026), "2026-10-10");
  assert.equal(on("the first Saturday after the first Monday in October", 2027), "2027-10-09");
  assert.equal(on("the first Saturday after the first Monday in October", 2028), "2028-10-07");
});

test("a plain calendar date is carried so a window can mix the two", () => {
  assert.equal(on("January 19", 2027), "2027-01-19");
  /* A day the year does not have is null, never rolled into the next month. */
  assert.equal(on("February 29", 2027), null);
  assert.equal(on("February 29", 2028), "2028-02-29");
});

/*
 * REFUSALS. Each of these is a real phrasing from Schedule 3, or one word
 * changed from one, and each would land on a DIFFERENT DAY if it were nudged
 * into the nearest form it resembles.
 */
for (const [text, why] of [
  ["the first Sunday on or after January 19", "'on or after' is not 'after' — up to seven days apart"],
  ["the second Sunday after that Monday", "a back-reference to an anchor in the other half of the window"],
  ["the following Friday", "relative to the window's own start, not to a month"],
  ["the fifth Saturday in October", "no ordinal beyond fourth is used, and not every month has a fifth"],
  ["the Saturday nearest September 15", "'nearest' can fall either side"],
  ["the day after the first Monday in October", "'day' is not a weekday"],
  ["the first Saturday after Labour Day", "a named holiday is not a date this reads"],
  ["the first Saturday", "no month"],
  ["September", "no day"],
] as const) {
  test(`refuses "${text}" — ${why}`, () => {
    assert.equal(parseRelativeDate(text), null);
  });
}

test("a qualifier refuses the whole window, however readable its dates are", () => {
  /*
   * These rows' DATES are readable. Their SEASONS are not: each applies only
   * to some hunters, some land or some birds. The date becoming readable must
   * not make the row encodable — that would publish a season right for a few
   * and wrong for everyone else.
   */
  for (const text of [
    "the first Monday after January 6 to the first Sunday after January 19 (only in Provincial Management Units 1-3 and 1-8 to 1-15)",
    "September 1 to the first Friday after September 10 (only on farmland)",
    "The first Saturday after September 11 to the first Friday after September 24, only for residents of Canada and on farmland",
    "the first Saturday after September 11 to September 30, for Ducks other than Eiders and Long-tailed Ducks",
    "the fourth Saturday in September to the first Sunday after January 5 (excluding Sundays in municipalities where hunting with guns on Sundays is not permitted by provincial regulations)",
    "the last Saturday in September to October 31 (not an open season for Eiders or Long-tailed Ducks)",
    "The fourth Saturday in February to the following Friday (in Provincial Wildlife Management Units 69A, 70 to 73, 77 to 81 and 86 to 93)",
    "The Thursday after the first Monday of September to the second Sunday after that Monday",
  ]) {
    assert.equal(parseRelativeWindow(text), null, text);
  }
});

test("a window crossing the new year ends in the following year", () => {
  const window = parseRelativeWindow("the Saturday after the first Monday in October to the first Sunday after January 19");
  assert.ok(window);
  assert.equal(window.crossesYear, true);
  assert.deepEqual(resolveRelativeWindow(window, 2026), { from: "2026-10-10", to: "2027-01-24" });
});

test("a window inside one year stays in it", () => {
  const window = parseRelativeWindow("the first Saturday in September to the Tuesday after the second Saturday in September");
  assert.ok(window);
  assert.equal(window.crossesYear, false);
  assert.deepEqual(resolveRelativeWindow(window, 2026), { from: "2026-09-05", to: "2026-09-15" });
});
