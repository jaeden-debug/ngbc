import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  anchorWindow, cellText, coversOnlyWeekdays, expandWmuSpec, parseFootnotes, parseSeasonCell, parseTables,
  regulatoryContent, withoutSundays,
} from "./alberta-source.mjs";

/**
 * Alberta's summary, read strictly.
 *
 * The first half tests the reading on the shapes the 2026 guide actually prints.
 * The second half asserts certified facts against the committed bundle, so a
 * rebuild that changes an answer fails here with the fact named, not only as a
 * diff someone has to notice.
 */

const bundle = JSON.parse(readFileSync(new URL("../content/regulatory/ca-ab-2026.json", import.meta.url), "utf8"));
const crosscheck = JSON.parse(readFileSync(
  new URL("../content/regulatory/sources/ca-ab-hunting-guide-2026-crosscheck.json", import.meta.url), "utf8",
));
const OFFICIAL = bundle.officialIdentifiers;

/* ── Reading ─────────────────────────────────────────────────────────────── */

test("a dash includes every published unit between its ends, not every integer", () => {
  const { identifiers } = expandWmuSpec("404-410, 841, 936", OFFICIAL);
  assert.deepEqual(identifiers, ["404", "406", "408", "410", "841", "936"]);
  // 102-160 has gaps (no 114, 120, 122 ...): only units the layer publishes.
  const prairie = expandWmuSpec("102-160", OFFICIAL).identifiers;
  assert.ok(!prairie.includes("114") && prairie.includes("119") && prairie.includes("160"));
});

test("a footnote fused to a unit is separated from it, never read as a unit", () => {
  const cell = cellText('<span>936</span><span class="textsuperscript">1</span>');
  assert.equal(cell, "936^1");
  const expanded = expandWmuSpec(cell, OFFICIAL);
  assert.deepEqual(expanded.identifiers, ["936"]);
  assert.deepEqual(expanded.footnotes, [1]);
});

test("place names and grouping parentheses are kept apart from the units", () => {
  const expanded = expandWmuSpec("728, 730 (CFB Wainwright)", OFFICIAL);
  assert.deepEqual(expanded.identifiers, ["728", "730"]);
  assert.deepEqual(expanded.names, ["CFB Wainwright"]);
  assert.deepEqual(expandWmuSpec("110,(132, 136, 138)", OFFICIAL).identifiers, ["110", "132", "136", "138"]);
});

test("an unknown unit or token stops the build", () => {
  assert.throws(() => expandWmuSpec("102, 999", OFFICIAL), /999 .* not a published unit/);
  assert.throws(() => expandWmuSpec("102-999", OFFICIAL), /does not run between two published units/);
  assert.throws(() => expandWmuSpec("102, WMU X", OFFICIAL), /Unrecognised WMU token/);
});

test("dates anchor to the licence year the guide covers", () => {
  assert.deepEqual(anchorWindow("S1 - J15", 2026), { opensIso: "2026-09-01", closesIso: "2027-01-15", statedAs: "S1 - J15" });
  assert.deepEqual(anchorWindow("J1 - J31, 2027", 2026), { opensIso: "2027-01-01", closesIso: "2027-01-31", statedAs: "J1 - J31, 2027" });
  assert.equal(anchorWindow("A25 - S16", 2026).opensIso, "2026-08-25");
});

test("a spring date with no year is refused rather than guessed", () => {
  assert.throws(() => anchorWindow("M15 - Ju15", 2026), /refusing to guess which spring/);
  assert.throws(() => anchorWindow("F30 - M2, 2027", 2026), /not a calendar date/);
  assert.throws(() => anchorWindow("S1 - J15, 2028", 2026), /outside the 2026-2027 licence year/);
});

test("a special-licence mark belongs to the cell it is printed in", () => {
  const general = parseSeasonCell("■(Wed - Sat only)\nN4 - N7\nN11 - N14\nN18 - N21\nN25 - N28", 2026);
  assert.equal(general.special, true);
  assert.equal(general.windows.length, 4);
  assert.equal(parseSeasonCell("S1 - N3", 2026).special, false);
  assert.equal(parseSeasonCell("■ S1 - S30\n■ O1 - O24", 2026).special, true);
  assert.throws(() => parseSeasonCell("■ S1 - S30\nO1 - O24\nN1 - N5", 2026), /marks only some of its windows/);
});

test("a Wed - Sat note is checked against the calendar, not trusted", () => {
  // 4-7 November 2026 is Wednesday to Saturday.
  assert.ok(coversOnlyWeekdays(anchorWindow("N4 - N7", 2026), [3, 4, 5, 6]));
  assert.throws(() => parseSeasonCell("(Wed - Sat only)\nN4 - N8", 2026), /covers other days/);
  assert.throws(() => parseSeasonCell("(Monday to Friday only)\nN1 - N10", 2026), /does not model/);
});

test("removing Sundays splits a window into the days that are actually open", () => {
  // 1 September 2026 is a Tuesday; Sundays are 6, 13, 20 and 27 September.
  const runs = withoutSundays(anchorWindow("S1 - S30", 2026));
  assert.deepEqual(runs.map(({ opensIso, closesIso }) => [opensIso, closesIso]), [
    ["2026-09-01", "2026-09-05"], ["2026-09-07", "2026-09-12"], ["2026-09-14", "2026-09-19"],
    ["2026-09-21", "2026-09-26"], ["2026-09-28", "2026-09-30"],
  ]);
});

test("tables expand rowspans so every row reads as printed", () => {
  const html = `<table><tr><td rowspan="2">White-tailed deer</td><td>Antlered</td><td>S1 - N3</td></tr>
    <tr><td>Antlerless</td><td>&#9632; N1 - N30</td></tr></table>
    <p class="paragraph11">(1) Hunters (including bowhunters) require a permit.</p>`;
  assert.deepEqual(parseTables(html)[0], [
    ["White-tailed deer", "Antlered", "S1 - N3"],
    ["White-tailed deer", "Antlerless", "■ N1 - N30"],
  ]);
  assert.equal(parseFootnotes(html).get(1), "Hunters (including bowhunters) require a permit.");
});

test("an advertisement swap is not a regulatory change; a changed cell or footnote is", () => {
  const page = (ad, cell, note) => `<div><img src="images/ads/${ad}.jpg"/></div>
    <table><tr><td>White-tailed deer</td><td>${cell}</td></tr></table><p class="paragraph11">(1) ${note}</p>`;
  const base = regulatoryContent(page("aca", "S1 - N3", "Permit required."));
  assert.equal(regulatoryContent(page("other-ad", "S1 - N3", "Permit required.")), base);
  assert.notEqual(regulatoryContent(page("aca", "S1 - N4", "Permit required.")), base);
  assert.notEqual(regulatoryContent(page("aca", "S1 - N3", "Permit no longer required.")), base);
});

/* ── Certified facts in the committed bundle ─────────────────────────────── */

const groups = new Map(bundle.groups.map((group) => [group.id, group]));
const rulesAt = (speciesId, unit) =>
  bundle.rules.filter((rule) => rule.speciesId === speciesId && groups.get(rule.regulatoryGroupId).officialIdentifiers.includes(unit));
const openOn = (rule, date) => rule.windows.some(({ opensIso, closesIso }) => opensIso <= date && date <= closesIso);

test("every rule was confirmed against the government PDF, and the PDF is pinned", () => {
  assert.equal(crosscheck.disagreements, 0);
  assert.equal(bundle.sources[0].sourceHashes.pdf, crosscheck.pdf.sha256);
  assert.ok(bundle.rules.every((rule) => rule.disputes.length === 0));
  assert.equal(bundle.absence.meaning, "UNKNOWN");
  assert.deepEqual(bundle.certifiedPeriod, { from: "2026-04-01", to: "2027-03-31" });
});

test("ruffed grouse: 1 September to 15 January, later in the mountains, three days at CFB Wainwright", () => {
  const [wmu102] = rulesAt("species:ruffed-grouse", "102");
  assert.deepEqual(wmu102.windows.map(({ opensIso, closesIso }) => [opensIso, closesIso]), [["2026-09-01", "2027-01-15"]]);
  assert.equal(rulesAt("species:ruffed-grouse", "404")[0].windows[0].opensIso, "2026-09-08");
  const [wainwright] = rulesAt("species:ruffed-grouse", "728");
  assert.deepEqual([wainwright.windows[0].opensIso, wainwright.windows[0].closesIso], ["2026-09-05", "2026-09-07"]);
  assert.ok(wainwright.conditionIds.includes("ab-cfb-wainwright"));
  assert.deepEqual(wmu102.limits, { daily: 5, possession: 15, combined: false, statedAs: "5 daily, 15 in possession" });
  // Grouse asks nothing: no rule carries a dimension.
  assert.ok(bundle.rules.filter(({ speciesId }) => speciesId.endsWith("grouse")).every(({ appliesWhen }) => !Object.keys(appliesWhen).length));
});

test("a unit no row names has no rule, and the bundle says that means UNKNOWN", () => {
  // WMU 718 (Writing-On-Stone Provincial Park) is named by no grouse or deer row.
  assert.deepEqual(rulesAt("species:ruffed-grouse", "718"), []);
  assert.deepEqual(rulesAt("species:white-tailed-deer", "718"), []);
});

test("white-tailed deer in WMU 102: archery for either licence, antlerless general by special licence only", () => {
  const rules = rulesAt("species:white-tailed-deer", "102");
  const archeryAntlered = rules.find((rule) => rule.seasonLabel === "Archery-only season" && rule.appliesWhen["ANIMAL_CLASS:ANTLER_CLASS"] === "ANTLERED");
  assert.deepEqual(archeryAntlered.appliesWhen.permittedImplements, ["BOW"]);
  assert.equal(archeryAntlered.appliesWhen.LICENCE_TYPE, undefined);
  const generalAntlerless = rules.find((rule) => rule.seasonLabel.startsWith("General") && rule.appliesWhen["ANIMAL_CLASS:ANTLER_CLASS"] === "ANTLERLESS");
  assert.equal(generalAntlerless.appliesWhen.LICENCE_TYPE, "SPECIAL");
  assert.ok(generalAntlerless.conditionIds.includes("ab-special-licence"));
  assert.deepEqual(generalAntlerless.appliesWhen.permittedImplements, ["RIFLE", "SHOTGUN", "MUZZLELOADER", "CROSSBOW", "BOW"]);
});

test("Sunday is closed to big game in WMU 102 and open in WMU 162, from the same printed row", () => {
  // 20 September 2026 is a Sunday, inside the printed archery window in both units.
  const sunday = "2026-09-20";
  const in102 = rulesAt("species:white-tailed-deer", "102").filter((rule) => rule.seasonLabel === "Archery-only season");
  assert.ok(in102.length && in102.every((rule) => !openOn(rule, sunday)));
  assert.ok(in102.every((rule) => rule.conditionIds.includes("ab-sunday-big-game")));
  assert.ok(in102.some((rule) => openOn(rule, "2026-09-19")));
  const in162 = rulesAt("species:white-tailed-deer", "162").filter((rule) => rule.seasonLabel === "Archery-only season");
  assert.ok(in162.some((rule) => openOn(rule, sunday)));
});

test("the prairie general season is only the Wednesday-to-Saturday blocks the guide prints", () => {
  const general = rulesAt("species:white-tailed-deer", "102").find((rule) => rule.seasonLabel === "General season" && rule.appliesWhen["ANIMAL_CLASS:ANTLER_CLASS"] === "ANTLERED");
  assert.ok(openOn(general, "2026-11-04"));
  assert.ok(!openOn(general, "2026-11-08"));
  assert.ok(!openOn(general, "2026-11-03"));
});

test("WMUs 212, 247 and 248 are archery-only; WMU 936 carries its discharge permit", () => {
  for (const unit of ["212", "247", "248"]) {
    const rules = rulesAt("species:white-tailed-deer", unit);
    assert.ok(rules.length && rules.every((rule) => JSON.stringify(rule.appliesWhen.permittedImplements) === '["BOW"]'), unit);
  }
  const rules936 = rulesAt("species:white-tailed-deer", "936");
  assert.ok(rules936.every((rule) => rule.conditionIds.includes("ab-wmu-936-discharge-permit")));
  // 936 is also a Sunday-prohibited unit.
  assert.ok(rules936.every((rule) => rule.conditionIds.includes("ab-sunday-big-game")));
});

test("WMUs 404-408: the general deer season is special-licence only, the archery season is not", () => {
  const rules = rulesAt("species:white-tailed-deer", "406");
  assert.equal(rules.find((rule) => rule.seasonLabel.startsWith("General")).appliesWhen.LICENCE_TYPE, "SPECIAL");
  assert.equal(rules.find((rule) => rule.seasonLabel === "Archery-only season").appliesWhen.LICENCE_TYPE, undefined);
});
