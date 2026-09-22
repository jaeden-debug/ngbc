import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { usAdapterConfig, US_LAYER_IDS } from "./layers.ts";
import { layerById } from "../zone-layers.ts";

/**
 * Replays the recorded live certifications of the U.S. layers. The live run
 * (`scripts/certify-live-zone-layer.mjs`) calls each state's service; this
 * never touches the network. It holds the record to what certification means:
 * every unit sampled inside, just inside and just across its boundary, every
 * point agreed by the state's full geometry, the state's own point answer and
 * North Ground's production resolver, and none of it stored as geometry.
 */

interface ParityRecord {
  layer: string;
  resolution: string;
  units: number;
  points: number;
  counts: Record<string, number>;
  disagreements: number;
  results: Array<{ kind: string; label: string; geometry: string[]; official: string[]; production: string[]; agree: boolean }>;
}

const read = (layerId: string): ParityRecord =>
  JSON.parse(readFileSync(new URL(`../../../../fixtures/hunt/${layerId.replace(/^layer:/, "")}-live-parity.json`, import.meta.url), "utf8"));

test("every U.S. layer has a recorded live certification with no disagreement", () => {
  for (const layerId of US_LAYER_IDS) {
    const record = read(layerId);
    assert.equal(record.layer, layerId);
    assert.equal(record.resolution, "LIVE_SERVICE (no copy stored)");
    assert.equal(record.disagreements, 0, `${layerId} has disagreements`);
    assert.equal(record.results.filter((result) => !result.agree).length, 0);
    assert.equal(record.points, record.results.length);
  }
});

test("each certification sampled every unit the adapter was reviewed to expect", () => {
  for (const layerId of US_LAYER_IDS) {
    const record = read(layerId);
    const expected = usAdapterConfig(layerId).expectedUnits;
    assert.equal(record.units, expected, `${layerId} certified ${record.units} units; ${expected} were reviewed`);
    for (const kind of ["inside", "edge", "across"]) assert.equal(record.counts[kind], expected, `${layerId} ${kind}`);
    assert.ok(record.counts.outside >= 5, `${layerId} tested too few points outside the state`);
    assert.equal(record.counts.invalid, 3);
  }
});

test("where the authority's geometry holds a point in one unit, production named exactly that unit", () => {
  for (const layerId of US_LAYER_IDS) {
    for (const result of read(layerId).results) {
      if (result.kind === "invalid") {
        assert.deepEqual(result.production, [], `${layerId}: an impossible coordinate resolved`);
        continue;
      }
      if (result.geometry.length === 1) assert.deepEqual(result.production, result.geometry, `${layerId} ${result.label}`);
      else assert.deepEqual(result.production, [], `${layerId} ${result.label}: production must never pick one of several`);
    }
  }
});

test("a U.S. layer is served only with certified rules, a clean live parity record and certification cases", async () => {
  const { regulatoryEntryFor } = await import("../regulatory/registry.ts");
  const { existsSync } = await import("node:fs");
  for (const layerId of US_LAYER_IDS) {
    const layer = layerById(layerId)!;
    assert.equal(layer.resolution, "LIVE_SERVICE");
    assert.ok(layer.legalStanding, `${layerId} records no legal standing`);
    if (!layer.serving) continue;
    assert.ok(regulatoryEntryFor(layer.jurisdictionId), `${layerId} is served without certified rules for ${layer.jurisdictionName}`);
    const parity = JSON.parse(readFileSync(new URL(`../../../../fixtures/hunt/${layerId.slice(6)}-live-parity.json`, import.meta.url), "utf8")) as { disagreements: number; points: number };
    assert.ok(parity.points > 0 && parity.disagreements === 0, `${layerId} is served without a clean live parity record`);
    const state = layer.jurisdictionId.slice("jurisdiction:".length);
    assert.ok(existsSync(new URL(`../../../../fixtures/hunt/${state}-certification-cases.json`, import.meta.url)), `${layerId} is served without certification cases`);
  }
});
