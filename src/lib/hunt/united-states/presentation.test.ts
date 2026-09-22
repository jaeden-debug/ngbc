import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { layerById, zoneIdFor } from "../zone-layers.ts";
import { presentZone, presentZoneById, ZONE_LOCALES, ZONE_PRESENTATION_PROFILES } from "../zone-presentation.ts";
import { US_ZONE_LAYERS } from "./layers.ts";

/**
 * U.S. zones are named in each state's own terms. The served-layer check in
 * zone-presentation.test.ts only reaches layers that are serving; these layers
 * are not yet, so they are held to the same contract here, against every
 * designation the state's own service returned at certification.
 */

function certifiedDesignations(layerId: string): string[] {
  const fixture = JSON.parse(readFileSync(new URL(`../../../../fixtures/hunt/${layerId.slice(6)}-live-parity.json`, import.meta.url), "utf8")) as {
    results: Array<{ geometry: string[]; official: string[]; production: string[] }>;
  };
  return [...new Set(fixture.results.flatMap((result) => [...result.geometry, ...result.official, ...result.production]))].sort();
}

const PROFILED = ["layer:us-id-gmu", "layer:us-mt-deer-elk-hd", "layer:us-co-gmu", "layer:us-wy-elk-area"];
const WORDED = ["layer:us-mt-upland"];

test("each profiled U.S. layer has exactly one profile that mirrors it", () => {
  for (const layerId of PROFILED) {
    const layer = layerById(layerId)!;
    const profiles = ZONE_PRESENTATION_PROFILES.filter((profile) => profile.layerId === layerId);
    assert.equal(profiles.length, 1, layerId);
    assert.equal(profiles[0].jurisdictionId, layer.jurisdictionId);
    assert.equal(profiles[0].zoneIdPrefix, layer.zoneIdPrefix);
    assert.equal(profiles[0].officialNamePrefix, layer.officialNamePrefix);
    assert.equal(profiles[0].term["en-CA"]?.short, layer.officialTermShort);
  }
  // Every U.S. layer has a profile: coded or worded.
  assert.deepEqual(US_ZONE_LAYERS.map((layer) => layer.id).filter((id) => !PROFILED.includes(id)), WORDED);
  for (const layerId of WORDED) assert.equal(ZONE_PRESENTATION_PROFILES.filter((profile) => profile.layerId === layerId).length, 1, layerId);
});

test("every designation a state returned at certification is presented, round-trips by id, and keeps its identity", () => {
  for (const layerId of PROFILED) {
    const layer = layerById(layerId)!;
    const designations = certifiedDesignations(layerId);
    assert.ok(designations.length > 0, layerId);
    for (const designation of designations) {
      const zoneId = zoneIdFor(layer, designation);
      for (const locale of ZONE_LOCALES) {
        const presented = presentZone({ designation, layerId, zoneId }, locale);
        assert.equal(presented.status, "PRESENTED", `${layerId} ${designation}`);
        assert.equal(presented.fullLabel, `${layer.officialTermShort} ${designation}`);
        assert.equal(presented.localized, locale === "en-CA", "a state publishes no French term, so none is invented");
        const fromId = presentZoneById(zoneId, locale, `${layer.officialNamePrefix}${designation}`);
        assert.equal(fromId.sourceDesignation, designation);
        assert.equal(fromId.zoneId, zoneId);
      }
    }
  }
});

test("labels read as each state writes them", () => {
  assert.equal(presentZone({ designation: "10A", layerId: "layer:us-id-gmu" }).fullLabel, "Unit 10A");
  assert.equal(presentZone({ designation: "10A", layerId: "layer:us-id-gmu" }).accessibleLabel, "Unit 10A, Idaho");
  assert.equal(presentZone({ designation: "310", layerId: "layer:us-mt-deer-elk-hd" }).accessibleLabel, "Deer and Elk Hunting District 310, Montana");
  assert.equal(presentZone({ designation: "12", layerId: "layer:us-co-gmu" }).fullLabel, "GMU 12");
  assert.equal(presentZone({ designation: "7", layerId: "layer:us-wy-elk-area" }).fullLabel, "Elk Area 7");
  // Idaho's quarantined Yellowstone record is not a unit and is never named as one.
  assert.equal(presentZone({ designation: "YNP", layerId: "layer:us-id-gmu" }).status, "UNRECOGNIZED_DESIGNATION");
});

test("Montana's worded upland districts are shown as FWP writes them, never prefixed or renamed", () => {
  for (const designation of certifiedDesignations("layer:us-mt-upland")) {
    const zoneId = zoneIdFor(layerById("layer:us-mt-upland")!, designation);
    for (const locale of ZONE_LOCALES) {
      const presented = presentZoneById(zoneId, locale, designation);
      assert.equal(presented.status, "PRESENTED");
      assert.equal(presented.fullLabel, designation);
      assert.equal(presented.accessibleLabel, `${designation}, Montana`);
      assert.equal(presented.sourceDesignation, designation);
    }
  }
  // Nothing else is read as a district name.
  assert.equal(presentZone({ designation: "North of the Divide", layerId: "layer:us-mt-upland" }).status, "UNRECOGNIZED_DESIGNATION");
});

test("a worded designation is labelled as the authority writes it, with no term in front", async () => {
  const { zoneDisplayLabel } = await import("../zone-layers.ts");
  assert.equal(zoneDisplayLabel(layerById("layer:us-mt-upland")!, "East of the Continental Divide"), "East of the Continental Divide");
  // A coded designation without a profile keeps the established fallback.
  assert.equal(zoneDisplayLabel({ jurisdictionId: "jurisdiction:us-nm" as never, officialTermShort: "GMU" }, "12"), "GMU 12");
});
