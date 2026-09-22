import assert from "node:assert/strict";
import { test } from "node:test";
import { containsVerbatim, expandUnits, parseBag, parseSeasons, partOneRows, windowsIn } from "./british-columbia-source.mjs";

const INVENTORY = ["3-12", "3-13", "3-14", "3-15", "3-16", "3-17", "3-18", "3-19", "3-20", "3-26", "3-30", "3-31", "3-44", "3-46", "4-1", "8-1", "8-9"];

test("a range is every published unit of the region within it, and nothing invented", () => {
  assert.deepEqual(expandUnits("3-12 to 3-20", INVENTORY).units, ["3-12", "3-13", "3-14", "3-15", "3-16", "3-17", "3-18", "3-19", "3-20"]);
  // 3-21 to 3-25 do not exist; the range skips them rather than inventing them.
  assert.deepEqual(expandUnits("3-20 to 3-26", INVENTORY).units, ["3-20", "3-26"]);
  assert.throws(() => expandUnits("3-21", INVENTORY), /not a Management Unit/);
  assert.throws(() => expandUnits("3-12 to 4-1", INVENTORY), /across regions/);
  assert.throws(() => expandUnits("Zone A of 3-17 as shown on map", INVENTORY), /Unreadable/);
});

test("a double asterisk restricts the whole entry after its last token, or one unit after an inner token", () => {
  assert.equal(expandUnits("3-12 to 3-20, 3-26**", INVENTORY).wholeRestricted, true);
  assert.deepEqual(expandUnits("3-30**, 3-31", INVENTORY).restrictedUnits, ["3-30"]);
  assert.equal(expandUnits("3-30**, 3-31", INVENTORY).wholeRestricted, false);
});

test("seasons are the regulation's own month and day ranges; anything else is refused", () => {
  assert.deepEqual(parseSeasons("Sept. 10 to Dec. 10 Apr. 1 to June 15").map((range) => [range.from, range.to]), [[[9, 10], [12, 10]], [[4, 1], [6, 15]]]);
  for (const text of ["No closed season", "Sept 1 to Oct 31", "The first Saturday after the first Monday in October to the first Sunday after January 19"]) {
    assert.throws(() => parseSeasons(text), /Unreadable open season/, text);
  }
});

test("a season crossing the new year is one window, placed in the certified period", () => {
  const period = { from: "2026-07-01", to: "2027-06-30" };
  assert.deepEqual(windowsIn(parseSeasons("Aug. 1 to Mar. 31")[0], period).map(({ opensIso, closesIso }) => [opensIso, closesIso]), [["2026-08-01", "2027-03-31"]]);
  assert.deepEqual(windowsIn(parseSeasons("Apr. 1 to June 15")[0], period).map(({ opensIso, closesIso }) => [opensIso, closesIso]), [["2027-04-01", "2027-06-15"]]);
});

test("bag limits read as the regulation defines them (ss. 8, 9)", () => {
  assert.deepEqual(parseBag("5(15)***"), { daily: 5, possession: 15, statedAs: "5(15)", partThree: true, partTwo: false });
  assert.equal(parseBag("10 per day").daily, 10);
  assert.equal(parseBag("2").bag, 2);
  assert.equal(parseBag("NBL").statedAs, "No bag limit");
  assert.throws(() => parseBag("two"), /Unreadable bag limit/);
});

test("Part 1 rows are read only from a table with the regulation's own header", () => {
  const html = "<table><tr><td>Item</td><td>Species</td><td>Management Units</td><td>Open Season</td><td>Bag Limit</td></tr>" +
    "<tr><td>28</td><td>RUFFED GROUSE</td><td>3-12 to 3-20</td><td>Sept. 10 to Nov. 30</td><td>5(15)</td></tr></table>";
  assert.deepEqual(partOneRows(html, 3), [{ schedule: 3, item: "28", species: "RUFFED GROUSE", units: "3-12 to 3-20", season: "Sept. 10 to Nov. 30", bag: "5(15)" }]);
  assert.throws(() => partOneRows(html.replace("Bag Limit", "Limit"), 3), /unexpected Part 1 header/);
});

test("a reviewed clause must appear verbatim, whitespace aside", () => {
  assert.ok(containsVerbatim("There is no  open season for black bear\nin those portions", "There is no open season for black bear in those portions"));
  assert.ok(!containsVerbatim("There is no open season for bear", "There is no open season for black bear"));
});
