import assert from "node:assert/strict";
import { test } from "node:test";
import { COVERED_JURISDICTIONS } from "./coverage.ts";
import { evaluateHunt } from "./evaluate.ts";
import { regulatoryEntryFor, REGULATORY_REGISTRY } from "./regulatory/registry.ts";
import type { HuntInput, ZoneResolution } from "./types.ts";
import { layersForBounds } from "./zone-geometry.ts";
import { layerForPoint, layerForResolution, ZONE_LAYERS } from "./zone-layers.ts";

/**
 * British Columbia lands with its layer registered but NOT served. Hunt must
 * behave exactly as it did before: no BC rules answer, BC is not claimed as
 * covered, nothing BC is drawn, and a BC zone is never presented.
 */

const BC = ZONE_LAYERS.find((layer) => layer.jurisdictionId === "jurisdiction:ca-bc")!;

test("the British Columbia layer is registered and not served", () => {
  assert.ok(BC);
  assert.equal(BC.serving, false);
});

test("no British Columbia rules answer while the layer is unserved", () => {
  assert.equal(regulatoryEntryFor("jurisdiction:ca-bc"), undefined);
  assert.ok(REGULATORY_REGISTRY.some((entry) => entry.jurisdictionId === "jurisdiction:ca-bc"), "the bundle ships, unserved");
});

test("British Columbia is not named as covered", () => {
  assert.doesNotMatch(COVERED_JURISDICTIONS, /British Columbia/);
});

test("nothing British Columbian is drawn, anywhere in the province", () => {
  const layers = layersForBounds({ west: -139, south: 48.3, east: -114.1, north: 60 });
  assert.ok(layers.every((layer) => layer.jurisdictionId !== "jurisdiction:ca-bc"));
  assert.equal(layerForPoint(53.9171, -122.7497), undefined, "Prince George is outside every served extent");
});

test("a British Columbia zone is never presented, and its point answers UNKNOWN", async () => {
  const zone: ZoneResolution = {
    status: "RESOLVED",
    zoneId: "management_zone:ca-bc-mu-7-15" as ZoneResolution["zoneId"],
    jurisdictionId: "jurisdiction:ca-bc",
    officialName: "Management Unit 7-15",
    boundaryDistanceMeters: 5_000,
    nearBoundary: false,
    sourceId: "source:ca-bc-mu-service",
    message: "",
  };
  assert.equal(layerForResolution(zone).kind, "NOT_SERVING");
  const result = await evaluateHunt(
    { latitude: 53.9171, longitude: -122.7497, date: "2026-10-01" as HuntInput["date"], speciesId: "species:ruffed-grouse" as HuntInput["speciesId"] },
    {
      resolveZone: async () => zone,
      weather: async (_la: number, _lo: number, date: string) => ({ status: "UNAVAILABLE" as const, summary: "", date: date as HuntInput["date"], sourceId: "source:open-meteo" as const }),
      fetch: (async () => { throw new Error("no request expected"); }) as typeof fetch,
      now: () => new Date("2026-09-22T12:00:00Z"),
    },
  );
  assert.equal(result.regulation.status, "UNKNOWN");
  assert.ok(result.sources.every((source) => !source.id.startsWith("source:ca-bc-")), result.sources.map((s) => s.id).join(", "));
});
