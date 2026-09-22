import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { buildBundle, parseCsv, percentileRanks, sha256, designationOf, zoneIdOf } from "./build-ontario-harvest-evidence.mjs";
import certifiedZones from "../fixtures/hunt/ca-on-zone-certification.json" with { type: "json" };

const BUNDLE = new URL("../content/intelligence/ca-on-white-tailed-deer-harvest.json", import.meta.url);

test("CSV parser handles quoted values and CRLF", () => {
  assert.deepEqual(parseCsv('a,b\r\n"x,y",2\r\n'), [["a", "b"], ["x,y", "2"]]);
});

test("percentile normalisation preserves ties", () => {
  assert.deepEqual(percentileRanks([1, 2, 2, 4]), [0, 0.5, 0.5, 1]);
});

test("builder fails closed on a truncated or structurally different source", () => {
  assert.throws(() => buildBundle("WMU,Year,Active Hunters,Antlered Harvest,Antlerless Harvest,Total Harvest\n57,2025,100,5,5,10\n"), /2,001/);
  assert.throws(() => buildBundle("WMU,Year\n57,2025\n"), /Unexpected harvest columns/);
});

test("hash is stable and explicit", () => {
  assert.equal(sha256("north-ground"), "sha256:bafd0639265d57a8b7facbc9de2c9fe098cd8afadb64ed50a9989d9790c61f83");
});

test("a zero-padded reported unit mints the designation the authority's layer publishes", () => {
  assert.equal(designationOf("01C"), "1C");
  assert.equal(designationOf("09A"), "9A");
  assert.equal(designationOf("69A-1"), "69A-1");
  assert.equal(designationOf("100"), "100");
  assert.equal(zoneIdOf("07B"), "management_zone:ca-on-wmu-7b");
});

test("every evidence record names a unit the authority's own layer publishes", () => {
  const official = new Set(certifiedZones.officialIdentifiers);
  const bundle = JSON.parse(readFileSync(BUNDLE, "utf8"));
  for (const record of bundle.evidence) {
    const designation = record.geographyId.slice("management_zone:ca-on-wmu-".length).toUpperCase();
    assert.ok(official.has(designation), `${record.geographyId} is not published by the layer`);
  }
  // The five zero-padded codes join, rather than becoming zones that exist nowhere.
  const ids = new Set(bundle.evidence.map((record) => record.geographyId));
  for (const unit of ["1c", "7a", "7b", "9a", "9b"]) {
    assert.ok(ids.has(`management_zone:ca-on-wmu-${unit}`), `WMU ${unit} must carry its evidence`);
  }
});

test("harvest reported at a larger area is kept, never apportioned, never ranked", () => {
  const bundle = JSON.parse(readFileSync(BUNDLE, "utf8"));
  assert.equal(bundle.reportedAtLargerArea.length, 15);
  const ranked = new Set(bundle.evidence.map((record) => record.geographyId));
  for (const area of bundle.reportedAtLargerArea) {
    assert.ok(area.coversZoneIds.length > 0, `${area.reportedAs} must name the units it covers`);
    assert.ok(area.totalHarvest > 0 && area.activeHunters > 0, "the authority's figures are carried");
    assert.match(area.statedAs, /publish .* and no unit/);
    // Never apportioned: no sub-unit receives a ranked record from its parent.
    for (const zoneId of area.coversZoneIds) assert.ok(!ranked.has(zoneId), `${zoneId} must not be ranked from ${area.reportedAs}`);
  }
  // A unit the authority reports separately is excluded from its parent's cover.
  const seventySeven = bundle.reportedAtLargerArea.find((area) => area.reportedAs === "77");
  assert.deepEqual(seventySeven.excludesSeparatelyReported, ["management_zone:ca-on-wmu-77a"]);
  assert.ok(ranked.has("management_zone:ca-on-wmu-77a"), "77A keeps its own evidence");
});
