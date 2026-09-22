import assert from "node:assert/strict";
import { test } from "node:test";
import { COVERED_JURISDICTIONS } from "./coverage.ts";
import { evaluateHunt } from "./evaluate.ts";
import { regulatoryEntryFor, REGULATORY_REGISTRY } from "./regulatory/registry.ts";
import type { HuntInput, ZoneResolution } from "./types.ts";
import { layersForBounds } from "./zone-geometry.ts";
import { ZONE_LAYERS, layerForPoint, layerForResolution, zoneCoverage } from "./zone-layers.ts";

/**
 * British Columbia is served as boundaries only: its 225 Management Units are
 * parity-certified, drawn and resolvable, while no British Columbia rule is
 * certified. Every species there answers UNKNOWN, Hunt never claims British
 * Columbia as covered, and the card points at the province's own rules.
 */

const BC = ZONE_LAYERS.find((layer) => layer.jurisdictionId === "jurisdiction:ca-bc")!;

test("the layer is served for drawing, and its rules are not certified", () => {
  assert.equal(BC.serving, true);
  assert.notEqual(BC.rulesServing, true);
});

test("no British Columbia rules answer, though the bundle ships", () => {
  assert.equal(regulatoryEntryFor("jurisdiction:ca-bc"), undefined);
  assert.ok(REGULATORY_REGISTRY.some((entry) => entry.jurisdictionId === "jurisdiction:ca-bc"), "the bundle ships, unanswering");
});

test("British Columbia is not named as covered", () => {
  assert.doesNotMatch(COVERED_JURISDICTIONS, /British Columbia/);
});

test("British Columbia is drawn, and a point in it resolves to the province", () => {
  const layers = layersForBounds({ west: -139, south: 48.3, east: -114.1, north: 60 });
  assert.ok(layers.some((layer) => layer.jurisdictionId === "jurisdiction:ca-bc"), "the province is drawn");
  assert.equal(layerForPoint(53.9171, -122.7497)?.jurisdictionId, "jurisdiction:ca-bc", "Prince George is inside a served extent");
});

test("a British Columbia zone is presented, and every species there answers UNKNOWN", async () => {
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
  assert.equal(layerForResolution(zone).kind, "SERVING");
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
  assert.ok(result.sources.every((source) => !source.id.startsWith("source:ca-bc-hunting-regulation")));
});

/* ── Boundaries served, rules not certified ──────────────────────────────── */

test("a layer drawn without certified rules answers UNKNOWN for every species, and is never counted as covered", async () => {
  const { COVERAGE_SUMMARY, SUPPORTED_SPECIES_IDS } = await import("./coverage.ts");
  // rulesServing stays absent: British Columbia's boundaries are drawn, its rules are not certified.
  {
    assert.notEqual(BC.rulesServing, true);
    assert.equal(regulatoryEntryFor("jurisdiction:ca-bc"), undefined);
    assert.doesNotMatch(COVERAGE_SUMMARY, /British Columbia/);
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
    // The zone itself is presented: the map may draw it and name it.
    assert.equal(layerForResolution(zone).kind, "SERVING");
    for (const speciesId of SUPPORTED_SPECIES_IDS) {
      const result = await evaluateHunt(
        { latitude: 53.9171, longitude: -122.7497, date: "2026-10-01" as HuntInput["date"], speciesId: speciesId as HuntInput["speciesId"] },
        {
          resolveZone: async () => zone,
          weather: async (_la: number, _lo: number, date: string) => ({ status: "UNAVAILABLE" as const, summary: "", date: date as HuntInput["date"], sourceId: "source:open-meteo" as const }),
          fetch: (async () => { throw new Error("no request expected"); }) as typeof fetch,
          now: () => new Date("2026-09-22T12:00:00Z"),
        },
      );
      assert.equal(result.regulation.status, "UNKNOWN", speciesId);
      assert.ok(result.sources.every((source) => !source.id.startsWith("source:ca-bc-hunting-regulation")), speciesId);
    }
  }
});

test("certified boundaries never report themselves as certified rules", () => {
  /*
   * The zones list writes "Certified rules" for a VERIFIED zone and "Boundary
   * only" otherwise, and the map styles by the same field. British Columbia's
   * units are parity-certified geometry with no serving rules, so every one of
   * them must read as boundary only — including the units the unserved B.C.
   * Reg. 190/84 bundle happens to name.
   */
  const named = [...(BC.certifiedDesignations ?? [])];
  assert.ok(named.length > 0, "the unserved bundle names units, which is exactly the trap");
  for (const designation of named) {
    assert.equal(zoneCoverage(BC, designation), "IN_DEVELOPMENT", `${designation} must not read as certified rules`);
  }

  // And a layer whose rules do serve still reports its own certified units.
  const manitoba = ZONE_LAYERS.find((layer) => layer.id === "layer:ca-mb-gha")!;
  assert.equal(manitoba.rulesServing, true);
  assert.equal(zoneCoverage(manitoba, [...(manitoba.certifiedDesignations ?? ["26"])][0]), "VERIFIED");
});
