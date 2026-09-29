import assert from "node:assert/strict";
import test from "node:test";
import { count, designationOf, isSuppressed, partitionLargerAreas, zoneIdOf } from "./ontario-harvest.mjs";
import { DATASETS, buildBundle } from "./build-ontario-species-harvest.mjs";

/**
 * The three rules that put a wrong number on a map if they are got wrong, and
 * one that keeps two species from being given each other's figures.
 */

test("a cell the authority withheld is no-data, and never zero", () => {
  /* Ontario writes an ellipsis where it suppresses a figure, and uses BOTH the
     three-dot ASCII form and the single ellipsis character — sometimes in
     adjacent rows of the same file. Reading either as zero publishes "nothing
     was taken here" over data the authority declined to release: a fabricated
     fact, in the direction that looks like a finding. */
  assert.equal(isSuppressed("..."), true);
  assert.equal(isSuppressed("…"), true);
  assert.equal(isSuppressed(" .. "), true);
  assert.equal(isSuppressed("0"), false);
  assert.equal(count("...", 2), null, "withheld");
  assert.equal(count("0", 2), 0, "a real zero is a real measurement and is kept");
  assert.throws(() => count("-1", 2), /Invalid count/);
  assert.throws(() => count("3.5", 2), /Invalid count/);
});

test("a unit id is minted from the layer's designation, not the table's padding", () => {
  /* The harvest tables zero-pad where the Wildlife Management Unit layer, and
     O. Reg. 663/98 Part 6 behind it, do not. Minting from the padded form
     produces zones that exist in no layer, so the map shows gaps exactly where
     the authority reports harvest. */
  assert.equal(designationOf("01C"), "1C");
  assert.equal(designationOf("09A"), "9A");
  assert.equal(designationOf("60"), "60");
  assert.equal(designationOf("69A-1"), "69A-1");
  assert.equal(zoneIdOf("01C"), "management_zone:ca-on-wmu-1c");
});

test("a figure reported for a larger area is kept, never apportioned, never ranked", () => {
  const current = [
    { wmu: "76", figures: { totalHarvest: 400, activeHunters: 100 } },
    { wmu: "57", figures: { totalHarvest: 10, activeHunters: 5 } },
  ];
  const { mapped, larger } = partitionLargerAreas(current, "source:test", 2025);
  assert.deepEqual(mapped.map(({ wmu }) => wmu), ["57"], "only units the layer publishes are ranked");
  assert.equal(larger.length, 1);
  assert.equal(larger[0].reportedAs, "76");
  assert.ok(larger[0].coversZoneIds.length > 1, "it names the units it covers");
  assert.equal(larger[0].totalHarvest, 400, "the authority's own figure is kept intact");
  assert.match(larger[0].limitation, /not apportioned/);
  /* The whole figure must not appear against any single sub-unit: that is what
     apportioning would do, and the authority never said how it divides. */
  for (const zoneId of larger[0].coversZoneIds) {
    assert.ok(!mapped.some((row) => zoneIdOf(row.wmu) === zoneId));
  }
});

test("no rate is derived where the authority published no denominator", () => {
  /* Wild turkey is the case: Ontario publishes harvest and no hunter count.
     The honest name for the number that remains is a total, and inventing a
     denominator to produce a rate is the single most common way a hunting map
     says something false. */
  const turkey = DATASETS.find(({ slug }) => slug === "wild-turkey");
  assert.ok(turkey);
  assert.ok(!turkey.columns.includes("Active Hunters"));

  const bundle = buildBundle(turkey, [
    "WMU,Year,Spring Harvest,Fall Harvest,Total Harvest",
    "57,2025,40,…,40",
    "58,2025,10,...,10",
  ].join("\n"));
  const metrics = new Set(bundle.evidence.map(({ metric }) => metric));
  assert.deepEqual([...metrics], ["HARVEST_TOTAL"], "harvest volume only");
  assert.ok(!bundle.evidence.some(({ notes }) => /success/i.test(notes)));
  assert.equal(bundle.evidence.find(({ geographyId }) => geographyId.endsWith("-57")).rawValue, 40);
  assert.ok(bundle.limitations.some((line) => /no rate is derived/.test(line)));
});

test("hunter counts are ingested as effort, labelled as effort", () => {
  const moose = DATASETS.find(({ slug }) => slug === "moose");
  const bundle = buildBundle(moose, [
    "WMU,Year,Active Hunters,Bull Harvest,Cow Harvest,Calf Harvest,Total Harvest",
    "57,2025,300,10,5,2,17",
    "58,2025,50,20,10,4,34",
  ].join("\n"));
  const effort = bundle.evidence.filter(({ metric }) => metric === "HUNTER_COUNT");
  assert.equal(effort.length, 2);
  for (const record of effort) assert.match(record.notes, /hunting pressure, not animals/);
  /* The unit that had the most hunters is not the unit with the most harvest —
     which is the whole reason the two must not be averaged together. */
  const byZone = (metric, zone) => bundle.evidence.find((r) => r.metric === metric && r.geographyId.endsWith(zone)).normalizedValue;
  assert.ok(byZone("HUNTER_COUNT", "-57") > byZone("HUNTER_COUNT", "-58"));
  assert.ok(byZone("HARVEST_TOTAL", "-57") < byZone("HARVEST_TOTAL", "-58"));
});

test("a renamed column stops the build rather than shifting every figure left", () => {
  const bear = DATASETS.find(({ slug }) => slug === "american-black-bear");
  assert.throws(
    () => buildBundle(bear, "WMU,Year,Hunters,Harvest\n57,2025,10,3"),
    /Unexpected american-black-bear columns/,
  );
});

test("moose harvest parts must sum, or the authority changed something", () => {
  const moose = DATASETS.find(({ slug }) => slug === "moose");
  assert.throws(
    () => buildBundle(moose, "WMU,Year,Active Hunters,Bull Harvest,Cow Harvest,Calf Harvest,Total Harvest\n57,2025,300,10,5,2,99"),
    /parts do not sum/,
  );
});

test("Ontario's wolf and coyote harvest is deliberately not here", () => {
  /* Ontario publishes ONE combined harvest column for wolf and coyote. Both
     species would be wrong: attributing the figure to either overstates it, and
     splitting it publishes two numbers the authority never released. It is held
     back for species attribution, NOT for a licence — the licence is the same
     Open Government Licence every other Ontario dataset here uses.

     Asserted so that a later pass adding species does not quietly pick it up. */
  assert.ok(!DATASETS.some(({ speciesId }) => /gray-wolf|coyote/.test(speciesId)));
});
