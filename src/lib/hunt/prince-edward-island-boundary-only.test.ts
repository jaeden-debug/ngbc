import assert from "node:assert/strict";
import { test } from "node:test";
import { COVERED_JURISDICTIONS } from "./coverage.ts";
import { evaluateHunt } from "./evaluate.ts";
import { regulatoryEntryFor } from "./regulatory/registry.ts";
import type { HuntInput, ZoneResolution } from "./types.ts";
import { layersForBounds } from "./zone-geometry.ts";
import { ZONE_LAYERS, isJurisdictionGeography, layerForPoint, layerForResolution, zoneCoverage } from "./zone-layers.ts";
import { CANADA_JURISDICTIONS } from "./canada/registry.ts";

/**
 * Prince Edward Island is the first jurisdiction whose hunting geography IS the
 * jurisdiction. Its regulations name no zone, county or district, so the map
 * draws the province and a point resolves to the province WITHOUT a zone id.
 * No Prince Edward Island rule is certified, so every species there is UNKNOWN.
 */

const PE = ZONE_LAYERS.find((layer) => layer.jurisdictionId === "jurisdiction:ca-pe")!;

/* The answer for a point on the island: the province, and no unit. */
const PROVINCE: ZoneResolution = {
  status: "RESOLVED",
  jurisdictionId: "jurisdiction:ca-pe",
  officialName: "Prince Edward Island",
  boundaryDistanceMeters: 12_000,
  nearBoundary: false,
  sourceId: "source:ca-pe-provincial-boundary" as ZoneResolution["sourceId"],
  message: "",
};

test("the province is served for drawing, and its rules are not certified", () => {
  assert.equal(PE.serving, true);
  assert.notEqual(PE.rulesServing, true);
  assert.equal(regulatoryEntryFor("jurisdiction:ca-pe"), undefined);
  assert.equal(zoneCoverage(PE), "IN_DEVELOPMENT");
});

test("Prince Edward Island is not named as covered", () => {
  assert.doesNotMatch(COVERED_JURISDICTIONS, /Prince Edward Island/);
});

test("the province is drawn, and Charlottetown is inside a served extent", () => {
  const layers = layersForBounds({ west: -64.5, south: 45.9, east: -61.9, north: 47.1 });
  assert.ok(layers.some((layer) => layer.jurisdictionId === "jurisdiction:ca-pe"), "the province is drawn");
  /*
   * Charlottetown is served, which is all an extent decides. Which box it
   * lands in first decides nothing: Québec's extent reaches across the Gulf
   * and over the island, exactly as Ontario's reaches over Maniwaki. The
   * jurisdiction comes from the resolved geography, never from the box.
   */
  assert.ok(layerForPoint(46.2382, -63.1311), "Charlottetown is inside a served extent");
  const pe = ZONE_LAYERS.find((layer) => layer.id === "layer:ca-pe-province")!.bounds;
  assert.ok(
    46.2382 >= pe.minLatitude && 46.2382 <= pe.maxLatitude &&
    -63.1311 >= pe.minLongitude && -63.1311 <= pe.maxLongitude,
    "and inside Prince Edward Island's own extent",
  );
});

test("the geography is the jurisdiction, so no unit is invented from a storage key", () => {
  assert.equal(isJurisdictionGeography(PE), true);
  assert.equal(PROVINCE.zoneId, undefined, "a hunter is never handed a zone the regulations do not have");
  /* The layer is still found, through the jurisdiction rather than a zone. */
  assert.equal(layerForResolution(PROVINCE).kind, "SERVING");
});

test("every zone-shaped layer still yields a unit", () => {
  /* Guards the default: adding geographyLevel must not silently unit-strip
     a jurisdiction that really does publish units. */
  for (const layer of ZONE_LAYERS) {
    if (layer.jurisdictionId === "jurisdiction:ca-pe") continue;
    assert.equal(isJurisdictionGeography(layer), false, `${layer.id} publishes units`);
  }
});

test("a species query on the island answers UNKNOWN, citing no Prince Edward Island rule", async () => {
  const result = await evaluateHunt(
    { latitude: 46.2382, longitude: -63.1311, date: "2026-10-01" as HuntInput["date"], speciesId: "species:ruffed-grouse" as HuntInput["speciesId"] },
    {
      resolveZone: async () => PROVINCE,
      weather: async (_la: number, _lo: number, date: string) => ({ status: "UNAVAILABLE" as const, summary: "", date: date as HuntInput["date"], sourceId: "source:open-meteo" as const }),
      fetch: (async () => { throw new Error("no request expected"); }) as typeof fetch,
      now: () => new Date("2026-09-23T12:00:00Z"),
    },
  );
  assert.equal(result.regulation.status, "UNKNOWN");
  assert.ok(result.sources.every((source) => !source.id.startsWith("source:ca-pe-hunting-regulation")));
});

test("the four named Wildlife Management Areas are never drawn as management geography", () => {
  /* They are restricted places inside one prohibition, and the province
     publishes no boundary for them that North Ground may use. Nothing in the
     layer may turn them into units. */
  for (const name of ["indian-river", "rollo-bay", "new-glasgow", "pisquid"]) {
    assert.ok(
      !ZONE_LAYERS.some((layer) => layer.zoneIdPrefix.includes(name)),
      `${name} must not appear as a zone prefix`,
    );
  }
  const pe = CANADA_JURISDICTIONS.find((jurisdiction) => jurisdiction.id === "jurisdiction:ca-pe")!;
  assert.ok(
    pe.knownGaps.some((gap) => /Wildlife Management Areas/.test(gap) && /no boundary/.test(gap)),
    "the missing WMA geometry is declared as a gap, not left silent",
  );
});
