import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseAreas, parseSeasonCell } from "./build-ontario-open-seasons.mjs";

/**
 * ONTARIO'S OPEN SEASONS, READ FROM O. REG. 670/98 RATHER THAN FROM THE GUIDE.
 *
 * The tables prescribe rules "in any year" and print no dates. This artifact
 * stores both forms — the authority's rule and the date it produces for a
 * stated year — so next year is a re-derivation rather than a re-extraction.
 *
 * What these assert is not "the parser parses": it is that the FOUR
 * ASYMMETRIES between the tables survive, because each one is a fact, and a
 * uniform reading of five differently-shaped tables would be wrong in four
 * places at once.
 */

const bundle = JSON.parse(readFileSync("content/regulatory/extracted/ca-on-open-seasons-2026.json", "utf8"));
const official = (() => {
  const units = JSON.parse(readFileSync("content/regulatory/ca-on-certified-units.json", "utf8"));
  return new Set([...(units.certifiedUnits ?? []), ...(units.uncertifiedUnits ?? [])].map(String));
})();

test("every designation emitted is one the official layer can draw", () => {
  /* §8 counts deliverable answers, not encoded records. A rule naming a
     designation no layer holds is a season a hunter could never be given, and
     an earlier pass emitted four such rules because the check was a shape test
     ("looks like a WMU") rather than a lookup. */
  const used = [...new Set(bundle.rules.flatMap((rule) => rule.designations))];
  assert.ok(used.length > 100, `only ${used.length} designations — the extraction thinned`);
  for (const designation of used) {
    assert.ok(official.has(designation), `${designation} is in no certified Ontario layer`);
  }
});

test("residency is never merged, and a non-resident closure is a real CLOSED", () => {
  /* Deer and moose state the two in separate columns, and "Closed season"
     appears in one while the other is open. Merging them would hand a
     non-resident the resident's answer for WMUs 76A–81B archery. */
  const residencies = new Set(bundle.rules.map((rule) => rule.appliesWhen.RESIDENCY));
  assert.deepEqual([...residencies].sort(), ["NON_RESIDENT", "RESIDENT", "RESIDENT_AND_NON_RESIDENT"]);

  const closed = bundle.rules.filter((rule) => rule.declaredNoSeason);
  assert.ok(closed.length > 20, `only ${closed.length} stated closures`);
  assert.ok(
    closed.every((rule) => rule.appliesWhen.RESIDENCY === "NON_RESIDENT"),
    "every stated closure in these tables is a non-resident one; if that changes, read the table again",
  );
  /* And the pair exists: the same row open for one and closed for the other. */
  const pairs = new Map();
  for (const rule of bundle.rules) pairs.set(`${rule.table}#${rule.item}#${rule.appliesWhen.RESIDENCY}`, rule);
  const openResidentClosedNonResident = bundle.rules.filter((rule) =>
    rule.appliesWhen.RESIDENCY === "NON_RESIDENT" && rule.declaredNoSeason
    && pairs.get(`${rule.table}#${rule.item}#RESIDENT`)?.windows.length > 0);
  assert.ok(openResidentClosedNonResident.length > 20, "the asymmetry itself should be common in these tables");
});

test("the class of firearm is a NUMBER resolved through s. 69, not a typed list", () => {
  const classed = bundle.rules.filter((rule) => rule.firearm.basis === "CLASS_OF_FIREARM");
  assert.ok(classed.length > 130);
  for (const rule of classed) {
    const declared = bundle.firearmClasses.find((entry) => entry.classNumber === rule.firearm.classNumber);
    assert.ok(declared, `class ${rule.firearm.classNumber} is not declared`);
    assert.deepEqual(rule.firearm.permittedImplements, declared.permittedImplements);
    assert.equal(rule.firearm.sourceSection, "s. 69, Table");
  }
  /* Class 1 is "Bow", and s. 82 makes a bow for big game a crossbow or a
     long-bow — so the expansion is in the class definition, once, and not
     typed at 146 rows. */
  const one = bundle.firearmClasses.find((entry) => entry.classNumber === 1);
  assert.equal(one.statedAs, "Bow");
  assert.deepEqual(one.permittedImplements, ["BOW", "CROSSBOW"]);
  /* Class 4 has no bow, and must not acquire one from the expansion above. */
  const four = bundle.firearmClasses.find((entry) => entry.classNumber === 4);
  assert.ok(!four.permittedImplements.includes("CROSSBOW"));
  assert.ok(!four.permittedImplements.includes("BOW"));
});

test("black bear has no class column, and the absence is itself the fact", () => {
  /* s. 69 prescribes classes for deer, elk and moose only. A blanket "the class
     number decides the implements" rule would be wrong for bear, and what says
     so is that Table 2 has no such column. */
  const bear = bundle.rules.filter((rule) => rule.speciesId === "species:american-black-bear");
  assert.ok(bear.length > 0);
  for (const rule of bear) {
    assert.equal(rule.firearm.basis, "NO_CLASS_COLUMN_IN_TABLE");
    assert.equal(rule.firearm.permittedImplements, null, "no implement may be inferred for bear from a class");
    assert.match(rule.firearm.note, /s\. 69 prescribes classes only for deer, elk and moose/);
    assert.equal(rule.appliesWhen.permittedImplements, undefined);
  }
  for (const entry of bundle.firearmClasses) {
    assert.ok(!entry.appliesToSpecies.includes("bear"), "s. 69's classes never reach bear");
  }
});

test("wild turkey states TYPES in words, which are kept as words", () => {
  const turkey = bundle.rules.filter((rule) => rule.speciesId === "species:wild-turkey");
  assert.ok(turkey.length > 0);
  for (const rule of turkey) {
    assert.equal(rule.firearm.basis, "TYPE_OF_FIREARM_STATED_IN_WORDS");
    assert.equal(rule.firearm.permittedImplements, null, "mapping prose to implements would be our reading, not the fact");
    assert.ok(rule.firearm.statedAs.length > 3);
    /* And only turkey carries the Time Limits column. */
    assert.ok(rule.timeLimitsStatedAs, "the time-limits column is part of turkey's row");
  }
  assert.ok(turkey.some((rule) => /½ hour before sunrise/.test(rule.timeLimitsStatedAs)));
  for (const rule of bundle.rules.filter((r) => r.speciesId !== "species:wild-turkey")) {
    assert.equal(rule.timeLimitsStatedAs, undefined);
  }
});

test("s. 4 expansion is recorded, never silent", () => {
  /* "53" means 53A and 53B by O. Reg. 670/98 s. 4. Expanding without recording
     it would leave the artifact claiming the authority wrote designations it
     did not. */
  const expansions = bundle.rules.flatMap((rule) => rule.designationsStatedAs ?? []);
  const bySection = expansions.filter((entry) => entry.basis === "O_REG_670_98_S_4");
  assert.ok(bySection.length > 50, `only ${bySection.length} recorded s. 4 expansions`);
  for (const entry of bySection) {
    assert.match(entry.stated, /^\d+$/, "s. 4 reaches whole numbers only");
    assert.ok(entry.resolvedTo.length > 1);
    for (const child of entry.resolvedTo) assert.ok(child.startsWith(entry.stated) && official.has(child));
  }
  const variants = expansions.filter((entry) => entry.basis === "SPELLING_VARIANT");
  assert.ok(variants.length > 0);
  for (const entry of variants) assert.deepEqual(entry.resolvedTo, [entry.stated.replace(/(\d)$/, "-$1")]);
});

test("69A resolves only on recorded evidence, at its own declared tier", () => {
  /*
   * O. Reg. 663/98 Schedule 1 defines 69A-1, 69A-2 and 69A-3 and no bare 69A,
   * and O. Reg. 670/98 s. 4's exception reaches whole numbers only — so the
   * instrument names a unit its own schedule does not contain.
   *
   * It is resolved, and NOT by the analogy "s. 4 one level down", which would
   * be the inference §8 forbids. Two published sources agree: Table 2 uses 69A
   * in exactly two rows and both list it alongside 69B, and the ministry's own
   * summary gives those same two bear seasons for the whole number 69 — whose
   * s. 4 expansion is 69A-1, 69A-2, 69A-3 and 69B. The fall dates agree
   * independently: September 8 is the Tuesday next following Labour Day 2026.
   *
   * What this test protects is not the answer but its BASIS: 69A may never
   * resolve without a recorded tier and finding, so a later edit cannot quietly
   * promote it to the instrument's own authority.
   */
  const resolution = bundle.designationsResolvedBelowTheInstrument.find((entry) => entry.stated === "69A");
  assert.ok(resolution, "a resolution weaker than the instrument must be recorded as such");
  assert.equal(resolution.tier, "OFFICIAL_SUMMARY");
  assert.equal(resolution.basis, "GROUP_REFERENCE_CORROBORATED_BY_OFFICIAL_SUMMARY");
  assert.deepEqual(resolution.resolvedTo, ["69A-1", "69A-2", "69A-3"]);
  assert.match(resolution.finding, /no bare 69A/);
  assert.match(resolution.finding, /September 8 matching item 3's Tuesday-after-Labour-Day rule/);
  assert.equal(resolution.evidenceUrls.length, 2, "both sources it rests on");
  assert.deepEqual(resolution.usedBy, ["Table 2, items 1 and 3"]);

  /* Every rule that used it records the weaker basis on the rule itself, so a
     reader never has to consult the header to learn which tier carried it. */
  const users = bundle.rules.filter((rule) =>
    (rule.designationsStatedAs ?? []).some((entry) => entry.stated === "69A"));
  assert.ok(users.length > 0);
  for (const rule of users) {
    const entry = rule.designationsStatedAs.find((e) => e.stated === "69A");
    assert.equal(entry.tier, "OFFICIAL_SUMMARY");
    assert.equal(rule.speciesId, "species:american-black-bear", "only Table 2 uses it");
  }
  /* And nothing else in the corpus resolves below the instrument. */
  assert.equal(bundle.designationsResolvedBelowTheInstrument.length, 1);
  assert.ok(!bundle.rules.some((rule) => rule.designations.includes("69A")));
});

test("every window carries the rule it came from and the year it was derived for", () => {
  for (const rule of bundle.rules) {
    assert.equal(rule.derivedForYear, 2026);
    for (const window of rule.windows) {
      assert.match(window.opensIso, /^\d{4}-\d{2}-\d{2}$/);
      assert.match(window.closesIso, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(window.closesIso >= window.opensIso);
      /* The rule survives the year. A date without its rule is a date nobody
         can re-derive, and next year it is silently wrong. */
      assert.ok(window.statedAs.length > 5, `${rule.id} has a date with no rule`);
    }
    if (!rule.declaredNoSeason) assert.ok(rule.windows.length > 0, `${rule.id} is neither closed nor open`);
    else assert.equal(rule.windows.length, 0);
  }
});

test("an area cell with one non-WMU token refuses the whole row", () => {
  assert.deepEqual(parseAreas("28, 29, 31").units, ["28", "29", "31"]);
  assert.equal(parseAreas("83, the geographic townships of Keppel and Sarawak in WMU 82A").refused, "AREA_NOT_ONLY_WMUS");
  /* Encoding the readable half would publish a season for ground the authority
     described differently, and silently narrow one it described more widely. */
  /* 69A resolves to its group, on the recorded corroboration above — not as a
     spelling variant and not by s. 4, which reaches whole numbers only. */
  assert.deepEqual(parseAreas("69A").units, ["69A-1", "69A-2", "69A-3"]);
  /* A designation nothing accounts for still refuses the row. */
  assert.equal(parseAreas("77Z").refused, "AREA_DESIGNATION_UNRESOLVED");
  assert.deepEqual(parseAreas("53").units, ["53A", "53B"]);
  assert.deepEqual(parseAreas("69A1").units, ["69A-1"]);
});

test("a stated closure and an unreadable cell are different results", () => {
  assert.deepEqual(parseSeasonCell("Closed season").declaredNoSeason, true);
  assert.equal(parseSeasonCell("From October 1 to December 31, in any year.").windows.length, 1);
  /* Two windows in one cell, the second without the preposition the authority
     does not repeat after AND:. */
  const both = parseSeasonCell("From October 1 to October 31, in any year. AND: November 16 to November 30, in any year.");
  assert.equal(both.windows.length, 2);
  assert.equal(both.windows[1].opensIso, "2026-11-16");
  /* The alternating-weekly construct is not a window and is refused rather than
     guessed: a guess would put a hunter in the field on an off week. */
  assert.equal(
    parseSeasonCell("From the first Monday following the last Sunday in September, there shall be Monday to Sunday seasons every other week, in any year.").refused,
    "SEASON_UNPARSED",
  );
});
