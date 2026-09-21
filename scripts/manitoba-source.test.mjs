import assert from "node:assert/strict";
import test from "node:test";
import {
  cellText, compareAreas, consolidationVersion, cwdAreasFromPage, expandAreaList, mentionedAreas, parseBirdLimit,
  parseEquipment, parseGeography, parseSeasonCell, requireProvision, scheduleParts, scheduleTable, section10_3,
} from "./manitoba-source.mjs";

/**
 * The Manitoba parser, against fixtures shaped like the King's Printer's
 * markup. Nothing here touches the network. Most of these tests are about
 * refusal: a builder that skips what it cannot read publishes a narrower law
 * than the one in force.
 */

const AREAS = [
  "1", "2", "2A", "3", "3A", "4", "5", "6", "6A", "7", "7A", "8", "9", "9A", "10", "11", "12", "13", "13A", "14", "14A",
  "15", "15A", "16", "17", "17A", "17B", "18", "18A", "18B", "18C", "19", "19A", "19B", "20", "21", "21A", "22", "23",
  "23A", "24", "25", "25A", "25B", "26", "27", "28", "29", "29A", "30", "31", "31A", "32", "33", "34", "34A", "34B", "34C",
  "35", "35A", "36", "38",
];

test("a range covers every area between its ends in the authority's order, and says which it reached by reading", () => {
  const { areas, interpretive } = expandAreaList(["5-7", "8"], AREAS);
  assert.deepEqual(areas, ["5", "6", "6A", "7", "8"]);
  // 6A is reached only because the range is read in order; 7A sorts after 7.
  assert.deepEqual(interpretive, [{ area: "6A", range: "5-7" }]);
  assert.deepEqual(expandAreaList(["12-14", "14A"], AREAS).areas, ["12", "13", "13A", "14", "14A"]);
});

test("an area the regulation does not define, a descending range or a repeat stops the build", () => {
  assert.throws(() => expandAreaList(["37"], AREAS), /not defined in M\.R\. 220\/86/);
  assert.throws(() => expandAreaList(["9-5"], AREAS), /does not ascend/);
  assert.throws(() => expandAreaList(["5-7", "6A"], AREAS), /names an area twice/);
  assert.throws(() => expandAreaList(["Areas near Brandon"], AREAS), /Unrecognised area token/);
});

test("the authority's order puts lettered areas after their number", () => {
  assert.deepEqual(["35", "34C", "34", "2A", "2"].sort(compareAreas), ["2", "2A", "34", "34C", "35"]);
});

test("game bird zones, GHA lists and named exclusions each become an explicit geography", () => {
  const zones = parseGeography("GBHZ 3 & 4\n(excluding GHA 19, 19B, 22-24, 27-33, CFB Shilo and Oak Hammock Waterfowl Control Area)", AREAS);
  assert.deepEqual(zones.include.gbhz, [3, 4]);
  assert.deepEqual(zones.exclude.ghas, ["19", "19B", "22", "23", "23A", "24", "27", "28", "29", "29A", "30", "31", "31A", "32", "33"]);
  assert.deepEqual(zones.exclude.special, [
    "special_geography:ca-mb-cfb-shilo", "special_geography:ca-mb-oak-hammock-waterfowl-control-area",
  ]);

  const macdonald = parseGeography("Area 33, those parts of Area 38 found within the R.M. of Macdonald", AREAS);
  assert.deepEqual(macdonald.include.ghas, ["33"]);
  assert.deepEqual(macdonald.include.special, ["special_geography:ca-mb-gha-38-rm-of-macdonald"]);
  // GHA 38 itself is NOT included: only the part of it in the municipality.
  assert.ok(!macdonald.include.ghas.includes("38"));
});

test("an exclusion the builder has no geography for stops the build", () => {
  assert.throws(
    () => parseGeography("Areas 26, 36 (excluding the Pinawa townsite)", AREAS),
    /Unrecognised exclusion "the Pinawa townsite"/,
  );
});

test("season cells read every window, and 'of the following year' is kept", () => {
  const windows = parseSeasonCell("Aug. 31 – Sept. 20\nOct. 12 – Nov. 8");
  assert.deepEqual(windows.map((window) => [window.opens, window.closes]), [
    [{ month: 8, day: 31 }, { month: 9, day: 20 }],
    [{ month: 10, day: 12 }, { month: 11, day: 8 }],
  ]);
  const ptarmigan = parseSeasonCell("Sept. 1 – The last day of February of the following year");
  assert.deepEqual(ptarmigan[0].closes, { month: 2, lastDay: true });
  assert.equal(ptarmigan[0].followingYear, true);
  assert.throws(() => parseSeasonCell("Sept. 1 – until further notice"), /Unreadable season anchor/);
  assert.throws(() => parseSeasonCell("Opens after harvest"), /Unreadable season/);
});

test("equipment words mean what the regulation defines, and crossbow is its own method", () => {
  assert.deepEqual(parseEquipment("Archery").methods, ["BOW"]);
  assert.deepEqual(parseEquipment("All equipment").methods, ["RIFLE", "SHOTGUN", "MUZZLELOADER", "CROSSBOW", "BOW"]);
  assert.deepEqual(parseEquipment("Muzzleloader and Crossbow").methods, ["MUZZLELOADER", "CROSSBOW"]);
  assert.throws(() => parseEquipment("Air gun"), /Unrecognised equipment/);
});

test("a bird limit must read exactly as the schedule prints it", () => {
  assert.deepEqual(parseBirdLimit(" 6 (Possession 12)"), { daily: 6, possession: 12, statedAs: "6 (Possession 12)" });
  assert.throws(() => parseBirdLimit("6 daily"), /Unreadable bag limit/);
});

const TABLE = `
<h2 class="sch" id="SchB">SCHEDULE B</h2>
<table>
  <tr><td class="center b">COLUMN&nbsp;1</td><td class="center b">COLUMN&nbsp;2</td><td class="center b">COLUMN&nbsp;3</td></tr>
  <tr><td class="center">Hunting Areas</td><td class="center">Equipment</td><td class="center">Season Date</td></tr>
  <tr><td></td><td></td><td></td></tr>
  <tr><td class="full b" colspan="3">A.&nbsp;&nbsp;MANITOBA RESIDENT GENERAL WHITE-TAILED DEER LICENCE</td></tr>
  <tr><td class="left" rowspan="2">Areas 5-7, 8</td><td class="center">Archery</td><td class="center">Aug.&nbsp;31 – Sept.&nbsp;20<br>Oct.&nbsp;12 – Nov.&nbsp;8</td></tr>
  <tr><td class="center">Muzzleloader and Crossbow<sup>1</sup></td><td class="center">Oct.&nbsp;12 – Nov.&nbsp;8</td></tr>
  <tr><td class="left"><sup>1</sup>&#8239;Under age&nbsp;18 only.</td><td class="center"></td><td class="center"></td></tr>
</table>`;

test("a schedule table carries its row spans down and keeps footnotes with their part", () => {
  const parts = scheduleParts(scheduleTable(TABLE, "SchB"), 3);
  assert.equal(parts.length, 1);
  assert.equal(parts[0].letter, "A");
  assert.equal(parts[0].rows.length, 2);
  assert.equal(parts[0].rows[1][0].text, "Areas 5-7, 8");
  assert.deepEqual(parts[0].rows[1][1].footnotes, ["1"]);
  assert.equal(parts[0].footnotes["1"], "Under age 18 only.");
  assert.equal(parts[0].rows[0][2].text, "Aug. 31 – Sept. 20\nOct. 12 – Nov. 8");
});

test("a row of the wrong shape, or an unrecognised full-width row, stops the build", () => {
  const extraCell = TABLE.replace("<td class=\"center\">Archery</td>", "<td class=\"center\">Archery</td><td>stray</td>");
  assert.throws(() => scheduleParts(scheduleTable(extraCell, "SchB"), 3), /expected 3/);
  const strange = TABLE.replace("A.&nbsp;&nbsp;MANITOBA", "Note: MANITOBA");
  assert.throws(() => scheduleParts(scheduleTable(strange, "SchB"), 3), /Unrecognised full-width row/);
});

test("the consolidation's own version statement is read, and the daily 'as of' line is not", () => {
  const page = `<meta name="TitleEn" content="Hunting Seasons and Bag Limits Regulation, M.R. 165/91">
    As of September 20, 2026, this is the most current version available.
    It has been in effect since June 16, 2026. Last amendment included: M.R. 46/2026`;
  assert.deepEqual(consolidationVersion(page), {
    title: "Hunting Seasons and Bag Limits Regulation, M.R. 165/91", inEffectSince: "2026-06-16", lastAmendment: "M.R. 46/2026",
  });
  assert.throws(() => consolidationVersion("<p>Regulation</p>"), /no longer states its version/);
});

test("an encoded provision that no longer reads as encoded stops the build", () => {
  const body = "2 All dates and all references to areas by means of numbers in this regulation are inclusive.";
  assert.equal(requireProvision(body, "2 All dates and all references", "s. 2").section, "s. 2");
  assert.throws(() => requireProvision(body, "2 All dates are exclusive", "s. 2"), /no longer reads/);
});

test("section 10.3 is read for its areas, and refused if it is reworded", () => {
  const text = "(a) in areas 5, 6, 6A, 7, 8, 10, 11, 15 and 15A during a moose season, unless the person holds a valid Manitoba resident draw general moose licence for that area with an unused tag; and (b) in areas 13 and 18 during an elk season, unless the person holds a valid Manitoba resident draw archery elk licence for that area with an unused tag.";
  assert.deepEqual(section10_3(text), { moose: ["5", "6", "6A", "7", "8", "10", "11", "15", "15A"], elk: ["13", "18"] });
  assert.throws(() => section10_3(text.replace("draw general moose", "general moose")), /no longer reads as encoded/);
});

test("a moose or elk row keeps its exclusions attached to the area they qualify", () => {
  const row = mentionedAreas("Areas 2A, 4, 6A, 7, 9, 9A (excluding those portions of the Cross Lake Registered Trapline Section defined in the Director of Surveys Plan No. 20703), 11", AREAS);
  assert.deepEqual(row.areas, ["2A", "4", "6A", "7", "9", "9A", "11"]);
  assert.deepEqual(row.caveats.map((caveat) => caveat.area), ["9A"]);
  const partial = mentionedAreas("Areas 13, 13A, and that part of Area 14 west of the Swan-Pelican Provincial Forest and south of Dawson Bay on Lake Winnipegosis", AREAS);
  assert.deepEqual(partial.areas, ["13", "13A"]);
  assert.deepEqual(partial.partial, ["14"]);
});

test("the CWD page's list of mandatory areas is read exactly or not at all", () => {
  const page = "<p>By law, licenced hunters are required to submit biological samples mule deer and elk harvested in the mandatory surveillance zone .</p><p>This includes the areas of Game Hunting Areas (GHAs) 5, 6, 6A, and 35A</p>";
  assert.deepEqual(cwdAreasFromPage(page).areas, ["5", "6", "6A", "35A"]);
  assert.throws(() => cwdAreasFromPage("<p>See the map.</p>"), /no longer lists/);
});

test("cell text keeps line breaks and drops markup", () => {
  assert.deepEqual(cellText("GBHZ&nbsp;3 &amp;&nbsp;4<br>(excluding CFB Shilo)"), { text: "GBHZ 3 & 4\n(excluding CFB Shilo)", footnotes: [] });
});
