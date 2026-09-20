import assert from "node:assert/strict";
import test from "node:test";
import {
  certifiedSpan, crossesYear, evaluateSeason, parseSeasonPhrase, resolveWindow,
  type SeasonWindow,
} from "./season.ts";

/** "September 15 to December 31" — inside one licence year. */
const SEP15_DEC31: SeasonWindow[] = [{ opens: { month: 9, day: 15 }, closes: { month: 12, day: 31 } }];
/** "September 15 to March 31" — crosses the year end. */
const SEP15_MAR31: SeasonWindow[] = [{ opens: { month: 9, day: 15 }, closes: { month: 3, day: 31 } }];
/** "September 25 to the last day of February" — crosses, and moves in leap years. */
const SEP25_LASTFEB: SeasonWindow[] = [{ opens: { month: 9, day: 25 }, closes: { month: 2, lastDay: true } }];

/* ── Window resolution ───────────────────────────────────────────────────── */

test("a window inside one year resolves inside that year", () => {
  const window = resolveWindow(SEP15_DEC31[0], 2026);
  assert.equal(window.opensIso, "2026-09-15");
  assert.equal(window.closesIso, "2026-12-31");
  assert.equal(window.crossesYear, false);
});

test("a window whose close precedes its open closes in the following year", () => {
  const window = resolveWindow(SEP15_MAR31[0], 2026);
  assert.equal(window.opensIso, "2026-09-15");
  assert.equal(window.closesIso, "2027-03-31");
  assert.equal(window.crossesYear, true);
  assert.equal(crossesYear(SEP15_MAR31[0]), true);
  assert.equal(crossesYear(SEP15_DEC31[0]), false);
});

test("the last day of February follows the leap cycle instead of being pinned to 28", () => {
  // 2026 season closes in 2027, a common year.
  assert.equal(resolveWindow(SEP25_LASTFEB[0], 2026).closesIso, "2027-02-28");
  // 2027 season closes in 2028, a leap year.
  assert.equal(resolveWindow(SEP25_LASTFEB[0], 2027).closesIso, "2028-02-29");
  // 2099 closes in 2100, which is NOT a leap year despite being divisible by four.
  // That century case is the one a naive `year % 4` implementation gets wrong;
  // the year-2400 case lies beyond the date module's deliberate 1900-2200 bound
  // on hunt dates, so it is not asserted here.
  assert.equal(resolveWindow(SEP25_LASTFEB[0], 2099).closesIso, "2100-02-28");
});

/* ── The Sep 15 - Dec 31 date matrix ─────────────────────────────────────── */

test("a same-year season opens and closes on the exact stated days", () => {
  const cases: Array<[string, string]> = [
    ["2026-09-14", "OUT_OF_SEASON"],           // day before opening
    ["2026-09-15", "IN_SEASON"],               // opening day
    ["2026-11-01", "IN_SEASON"],               // mid-season
    ["2026-12-31", "IN_SEASON"],               // closing day
    ["2027-01-01", "OUTSIDE_CERTIFIED_PERIOD"], // day after closing, next year
  ];
  for (const [date, expected] of cases) {
    assert.equal(evaluateSeason(SEP15_DEC31, 2026, date).verdict, expected, date);
  }
});

test("a same-year season reports the rest of its own licence year as closed", () => {
  // The summary describes this whole calendar year, so a July date is genuinely
  // closed rather than merely uncertified.
  assert.equal(evaluateSeason(SEP15_DEC31, 2026, "2026-07-01").verdict, "OUT_OF_SEASON");
  assert.equal(evaluateSeason(SEP15_DEC31, 2026, "2026-01-01").verdict, "OUT_OF_SEASON");
  const span = certifiedSpan(SEP15_DEC31, 2026);
  assert.deepEqual(span, { from: "2026-01-01", to: "2026-12-31" });
});

/* ── The cross-year date matrix ──────────────────────────────────────────── */

test("a crossing season stays open across the calendar-year boundary", () => {
  const cases: Array<[string, string]> = [
    ["2026-09-14", "OUTSIDE_CERTIFIED_PERIOD"], // day before opening
    ["2026-09-15", "IN_SEASON"],                // opening day
    ["2026-12-31", "IN_SEASON"],                // last day of the source year
    ["2027-01-01", "IN_SEASON"],                // first day of the next year
    ["2027-02-14", "IN_SEASON"],                // deep into the next year
    ["2027-03-31", "IN_SEASON"],                // closing day
    ["2027-04-01", "OUTSIDE_CERTIFIED_PERIOD"], // day after closing
  ];
  for (const [date, expected] of cases) {
    assert.equal(evaluateSeason(SEP15_MAR31, 2026, date).verdict, expected, date);
  }
});

test("a crossing season does not claim the part of its year that belongs to the previous summary", () => {
  // January to mid-September 2026 was covered by the 2025 summary, which North
  // Ground has not certified. Reporting CLOSED there would assert something this
  // source does not say.
  const evaluation = evaluateSeason(SEP15_MAR31, 2026, "2026-02-01");
  assert.equal(evaluation.verdict, "OUTSIDE_CERTIFIED_PERIOD");
  assert.deepEqual(certifiedSpan(SEP15_MAR31, 2026), { from: "2026-09-15", to: "2027-03-31" });
});

test("the last-day-of-February date matrix holds in common and leap years", () => {
  // 2025 season closes 2026-02-28 (common year).
  assert.equal(evaluateSeason(SEP25_LASTFEB, 2025, "2026-02-28").verdict, "IN_SEASON");
  assert.equal(evaluateSeason(SEP25_LASTFEB, 2025, "2026-03-01").verdict, "OUTSIDE_CERTIFIED_PERIOD");

  // 2027 season closes 2028-02-29 (leap year): the 29th is a legal hunting day.
  assert.equal(evaluateSeason(SEP25_LASTFEB, 2027, "2028-02-28").verdict, "IN_SEASON");
  assert.equal(evaluateSeason(SEP25_LASTFEB, 2027, "2028-02-29").verdict, "IN_SEASON");
  assert.equal(evaluateSeason(SEP25_LASTFEB, 2027, "2028-03-01").verdict, "OUTSIDE_CERTIFIED_PERIOD");
});

test("the containing window is reported, so a result can show the dates it used", () => {
  const evaluation = evaluateSeason(SEP15_MAR31, 2026, "2027-01-10");
  assert.equal(evaluation.verdict, "IN_SEASON");
  assert.equal(evaluation.window?.opensIso, "2026-09-15");
  assert.equal(evaluation.window?.closesIso, "2027-03-31");
});

test("split seasons leave a genuine closed gap between them", () => {
  const split: SeasonWindow[] = [
    { opens: { month: 5, day: 1 }, closes: { month: 5, day: 31 } },
    { opens: { month: 10, day: 1 }, closes: { month: 10, day: 31 } },
  ];
  assert.equal(evaluateSeason(split, 2026, "2026-05-15").verdict, "IN_SEASON");
  assert.equal(evaluateSeason(split, 2026, "2026-07-15").verdict, "OUT_OF_SEASON");
  assert.equal(evaluateSeason(split, 2026, "2026-10-15").verdict, "IN_SEASON");
  assert.equal(evaluateSeason(split, 2026, "2026-12-15").verdict, "OUT_OF_SEASON");
});

test("a window that does not describe real days is refused rather than rounded", () => {
  assert.throws(() => resolveWindow({ opens: { month: 2, day: 30 }, closes: { month: 3, day: 1 } }, 2026));
  assert.throws(() => certifiedSpan([], 2026));
});

/* ── Parsing the authority's wording ─────────────────────────────────────── */

test("published season phrases parse into the windows they describe", () => {
  assert.deepEqual(parseSeasonPhrase("September 15 to December 31"), SEP15_DEC31);
  assert.deepEqual(parseSeasonPhrase("September 15 to March 31"), SEP15_MAR31);
  assert.deepEqual(parseSeasonPhrase("September 25 to the last day of February"), SEP25_LASTFEB);
  assert.deepEqual(parseSeasonPhrase("  October  5  to  January  31 "), [
    { opens: { month: 10, day: 5 }, closes: { month: 1, day: 31 } },
  ]);
});

test("an unrecognised phrase is refused rather than guessed at", () => {
  // "All year" is a real Ontario phrase for some furbearers. It is not a date
  // range, and inventing one would be inventing a legal season.
  assert.equal(parseSeasonPhrase("All year"), null);
  assert.equal(parseSeasonPhrase("September 15 to the second Monday of March"), null);
  assert.equal(parseSeasonPhrase("Septembre 15 to December 31"), null);
  assert.equal(parseSeasonPhrase(""), null);
  assert.equal(parseSeasonPhrase("September 15"), null);
});

/* ── Split seasons as the page concatenates them ─────────────────────────── */

test("two ranges run together in one cell parse as two windows", () => {
  // Ontario's deer tables emit split seasons with no separator at all.
  assert.deepEqual(parseSeasonPhrase("November 16 to November 22November 30 to December 6"), [
    { opens: { month: 11, day: 16 }, closes: { month: 11, day: 22 } },
    { opens: { month: 11, day: 30 }, closes: { month: 12, day: 6 } },
  ]);
  assert.deepEqual(parseSeasonPhrase("September 1 to October 9November 16 to November 30"), [
    { opens: { month: 9, day: 1 }, closes: { month: 10, day: 9 } },
    { opens: { month: 11, day: 16 }, closes: { month: 11, day: 30 } },
  ]);
});

test("a split season is closed in the gap between its windows", () => {
  const windows = parseSeasonPhrase("September 1 to October 9November 16 to November 30")!;
  assert.equal(evaluateSeason(windows, 2026, "2026-09-15").verdict, "IN_SEASON");
  assert.equal(evaluateSeason(windows, 2026, "2026-10-09").verdict, "IN_SEASON");
  assert.equal(evaluateSeason(windows, 2026, "2026-10-10").verdict, "OUT_OF_SEASON");
  assert.equal(evaluateSeason(windows, 2026, "2026-11-15").verdict, "OUT_OF_SEASON");
  assert.equal(evaluateSeason(windows, 2026, "2026-11-16").verdict, "IN_SEASON");
  assert.equal(evaluateSeason(windows, 2026, "2026-11-30").verdict, "IN_SEASON");
  assert.equal(evaluateSeason(windows, 2026, "2026-12-01").verdict, "OUT_OF_SEASON");
});

test("a phrase carrying a qualification beyond its dates is refused", () => {
  // Truncating this to its dates would drop the condition that changes its meaning.
  assert.equal(parseSeasonPhrase("September 15 to December 31 except in controlled hunt areas"), null);
  assert.equal(parseSeasonPhrase("None"), null);
});
