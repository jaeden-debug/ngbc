import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateHunt } from "./evaluate.ts";
import { isFederalMigratoryBird } from "./regulatory/federal.ts";
import { regulatoryEntryFor, REGULATORY_REGISTRY } from "./regulatory/registry.ts";
import type { HuntInput, ZoneResolution } from "./types.ts";
import { ZONE_LAYERS, layerForResolution, zoneCoverage } from "./zone-layers.ts";

/**
 * A layer can be drawn long before its rules are certified, and while it is,
 * it must claim nothing.
 *
 * Written against the STATE rather than against whichever province happens to
 * be waiting. British Columbia stood here until its rules were certified;
 * before it, New Brunswick. Naming a province in these tests means they have
 * to be rewritten every time one is promoted, and a test rewritten under time
 * pressure is a test that stops pinning what it was written to pin.
 */

const BOUNDARY_ONLY = ZONE_LAYERS.filter((layer) => layer.serving && layer.rulesServing !== true);

test("some layer is drawn without certified rules, or these tests are vacuous", () => {
  assert.ok(BOUNDARY_ONLY.length > 0, "no layer is boundary-only; this file needs deleting, not passing");
});

test("a boundary-only layer is drawn and named, and answers no rule", async () => {
  const { SUPPORTED_SPECIES_IDS, COVERAGE_SUMMARY } = await import("./coverage.ts");
  for (const layer of BOUNDARY_ONLY) {
    assert.equal(regulatoryEntryFor(layer.jurisdictionId), undefined, layer.id);
    assert.doesNotMatch(COVERAGE_SUMMARY, new RegExp(layer.jurisdictionName), layer.id);

    const zone: ZoneResolution = {
      status: "RESOLVED",
      jurisdictionId: layer.jurisdictionId as ZoneResolution["jurisdictionId"],
      officialName: "",
      boundaryDistanceMeters: 5_000,
      nearBoundary: false,
      message: "",
    };
    /* The zone is still presented: the map may draw it and name it. */
    assert.equal(layerForResolution(zone).kind, "SERVING", layer.id);

    /*
     * Every species answers UNKNOWN, and no rule of this jurisdiction is cited.
     *
     * Migratory game birds are excluded, and the exclusion is the point rather
     * than an exemption: their season is FEDERAL. A province drawn without
     * certified rules of its own may still sit inside a federal area with a
     * certified federal season, and answering that is composition working, not
     * the boundary-only claim leaking. What must stay true is that no rule of
     * THIS jurisdiction is cited, which is asserted for every species below.
     */
    const jurisdictionKey = layer.jurisdictionId.replace("jurisdiction:", "");
    for (const speciesId of SUPPORTED_SPECIES_IDS) {
      if (isFederalMigratoryBird(speciesId)) continue;
      const result = await evaluateHunt(
        {
          latitude: (layer.bounds.minLatitude + layer.bounds.maxLatitude) / 2,
          longitude: (layer.bounds.minLongitude + layer.bounds.maxLongitude) / 2,
          date: "2026-10-01" as HuntInput["date"],
          speciesId: speciesId as HuntInput["speciesId"],
        },
        {
          resolveZone: async () => zone,
          weather: async (_la: number, _lo: number, date: string) => ({ status: "UNAVAILABLE" as const, summary: "", date: date as HuntInput["date"], sourceId: "source:open-meteo" as const }),
          fetch: (async () => { throw new Error("no request expected"); }) as typeof fetch,
          now: () => new Date("2026-09-23T12:00:00Z"),
        },
      );
      assert.equal(result.regulation.status, "UNKNOWN", `${layer.id} ${speciesId}`);
      assert.ok(
        result.sources.every((source) => !source.id.startsWith(`source:${jurisdictionKey}-hunting-regulation`)),
        `${layer.id} ${speciesId} cited a rule it does not hold`,
      );
    }
  }
});

test("certified boundaries never report themselves as certified rules", () => {
  /*
   * The zones list writes "Certified rules" for a VERIFIED zone and "Boundary
   * only" otherwise, and the map styles by the same field. A boundary-only
   * layer's units are parity-certified GEOMETRY, so every one must read as
   * boundary only — including any unit an unserved bundle happens to name,
   * which is exactly the trap.
   */
  for (const layer of BOUNDARY_ONLY) {
    for (const designation of layer.certifiedDesignations ?? []) {
      assert.equal(zoneCoverage(layer, designation), "IN_DEVELOPMENT", `${layer.id} ${designation}`);
    }
  }
});

test("a layer whose rules serve does report its certified units", () => {
  /* The other side of the same switch, so a bug that made everything
     IN_DEVELOPMENT could not pass this file. */
  const serving = ZONE_LAYERS.filter((layer) => layer.rulesServing === true && layer.certifiedDesignations?.size);
  assert.ok(serving.length > 0, "no layer serves rules");
  for (const layer of serving) {
    const designation = [...layer.certifiedDesignations!][0];
    assert.equal(zoneCoverage(layer, designation), "VERIFIED", `${layer.id} ${designation}`);
    assert.ok(REGULATORY_REGISTRY.some((entry) => entry.jurisdictionId === layer.jurisdictionId), layer.id);
  }
});

test("a boundary-only province cites no rule of its own even where a federal season applies", async () => {
  /*
   * The claim that must survive: Prince Edward Island has no certified
   * provincial rules, and a duck answer there comes from the Migratory Birds
   * Regulations. The federal source may be cited; a Prince Edward Island rule
   * may not, and the answer must say the province's own half is uncertified.
   */
  const layer = BOUNDARY_ONLY.find((candidate) => candidate.jurisdictionId === "jurisdiction:ca-pe");
  if (!layer) return;
  const zone: ZoneResolution = {
    status: "RESOLVED",
    jurisdictionId: "jurisdiction:ca-pe" as ZoneResolution["jurisdictionId"],
    officialName: "Prince Edward Island",
    boundaryDistanceMeters: 12_000,
    nearBoundary: false,
    message: "",
  };
  const result = await evaluateHunt(
    { latitude: 46.5, longitude: -63.6, date: "2026-11-05" as HuntInput["date"], speciesId: "species:mallard" as HuntInput["speciesId"] },
    {
      resolveZone: async () => zone,
      weather: async (_la: number, _lo: number, date: string) => ({ status: "UNAVAILABLE" as const, summary: "", date: date as HuntInput["date"], sourceId: "source:open-meteo" as const }),
      fetch: (async () => { throw new Error("no request expected"); }) as typeof fetch,
      now: () => new Date("2026-09-23T12:00:00Z"),
    },
  );
  assert.ok(result.sources.every((source) => !source.id.startsWith("source:ca-pe-hunting-regulation")));
});
