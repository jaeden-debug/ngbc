#!/usr/bin/env node
/**
 * Every layer North Ground says it serves must actually draw.
 *
 *   node scripts/certify-served-layers.mjs [--layer layer:ca-pe-province]
 *
 * This exists because the same defect has now happened three times: Yukon
 * (certified, refused by a 400-row cap), Newfoundland caribou (certified,
 * unreachable behind a species gate) and Prince Edward Island (certified, never
 * promoted, so zone_display_in_view returned nothing). Each time the coverage
 * report said VERIFIED and the map showed nothing.
 *
 * The cross-check that was supposed to catch this compared a NATIONAL SUM of
 * official units against a national sum of drawn features. That cannot see
 * Prince Edward Island: its correct expected count is one drawn area and zero
 * units, because a jurisdiction-level geography HAS no units. Zero equalled
 * zero, the sum balanced, and it would have balanced at any moment it ran.
 *
 * So the expectation is per layer, and it is never satisfied by a balance:
 *
 *   a zone layer            must draw its authority's own unit count;
 *   a jurisdiction layer    must draw exactly one area;
 *   any serving layer       drawing zero is a failure, always.
 *
 * It calls the database and the authorities' services, so it is a
 * certification, not a unit test. It writes fixtures/hunt/served-layers.json,
 * which `src/lib/hunt/served-layers.test.ts` replays without a network.
 */

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fetchZoneGeometry } from "../src/lib/hunt/zone-geometry.ts";
import { certifiedUnitsForLayer } from "../src/lib/hunt/canada/certified-units.ts";
import { ZONE_LAYERS, isJurisdictionGeography } from "../src/lib/hunt/zone-layers.ts";
import { OVERVIEW_ZOOM } from "../src/lib/hunt/exploration/overview.ts";
import { usAdapterConfig } from "../src/lib/hunt/united-states/layers.ts";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (match) process.env[match[1]] ??= match[2].replace(/^["']|["']$/g, "");
}

/** What this layer must draw inside its own declared bounds. */
function expectationFor(layer) {
  if (isJurisdictionGeography(layer)) {
    return { kind: "EXACTLY", count: 1, why: "a jurisdiction-level geography is one area, not a set of units" };
  }
  const units = certifiedUnitsForLayer(layer.id) ?? usUnits(layer.id);
  if (units !== null && units !== undefined) {
    return { kind: "EXACTLY", count: units, why: "the authority's own unit count, asserted by the ingestion adapter" };
  }
  /*
   * A jurisdiction whose rules are certified carries its count in its bundle
   * rather than an adapter, so the certification run's own record of what the
   * authority published is the next source. It is read, never guessed.
   */
  const certified = certifiedZoneCount(layer.id);
  if (certified !== null) {
    return { kind: "EXACTLY", count: certified, why: "the authority's zone count recorded by this layer's certification run" };
  }
  /* A layer whose count no source states still may not draw nothing. */
  return { kind: "AT_LEAST", count: 1, why: "no source states this layer's unit count; zero drawn is still a failure" };
}

/** A U.S. layer's own adapter count; `usAdapterConfig` throws for anything else. */
function usUnits(layerId) {
  try {
    return usAdapterConfig(layerId).expectedUnits ?? null;
  } catch {
    return null;
  }
}

/** The `officialZones` count from whichever certification fixture covers this layer. */
function certifiedZoneCount(layerId) {
  for (const file of readdirSync("fixtures/hunt").filter((name) => name.endsWith("-zone-certification.json"))) {
    const record = JSON.parse(readFileSync(`fixtures/hunt/${file}`, "utf8"));
    if (record.layer === layerId && typeof record.officialZones === "number") return record.officialZones;
  }
  return null;
}

async function main() {
  const only = process.argv.includes("--layer") ? process.argv[process.argv.indexOf("--layer") + 1] : null;
  const layers = ZONE_LAYERS.filter((layer) => layer.serving && (!only || layer.id === only));
  if (!layers.length) throw new Error(only ? `No serving layer ${only}` : "No serving layers");

  const results = [];
  for (const layer of layers) {
    const expected = expectationFor(layer);
    const box = {
      west: layer.bounds.minLongitude, south: layer.bounds.minLatitude,
      east: layer.bounds.maxLongitude, north: layer.bounds.maxLatitude,
    };
    let drawn = null;
    let failure = null;
    try {
      /*
       * Asked exactly as the product asks: at the overview zoom, and with the
       * species where the layer is scoped to one. Both of those were got wrong
       * while writing this, and both produced a confident FAIL against working
       * code — Yukon's whole layer refused at a zoom the map never requests,
       * and Newfoundland's caribou areas absent because no species was passed.
       * A harness that asks a different question than the product answers a
       * different question too.
       */
      const speciesId = layer.speciesScope?.[0];
      const answer = await fetchZoneGeometry(box, OVERVIEW_ZOOM, fetch, speciesId ? { speciesId } : {});
      drawn = (answer.features ?? []).filter((feature) => feature.layerId === layer.id).length;
      const reported = answer.layers?.find((entry) => entry.layerId === layer.id);
      if (reported && reported.status !== "OK" && reported.status !== "EMPTY") failure = reported.message ?? reported.status;
    } catch (cause) {
      failure = cause.message;
    }
    const ok = failure === null && (expected.kind === "EXACTLY" ? drawn === expected.count : drawn >= expected.count);
    results.push({ layerId: layer.id, jurisdictionId: layer.jurisdictionId, speciesId: layer.speciesScope?.[0] ?? null, expected, drawn, failure, ok });
    const verdict = ok ? "ok  " : "FAIL";
    console.log(`  ${verdict} ${layer.id.padEnd(28)} drew ${String(drawn ?? "-").padStart(4)}, expected ${expected.kind === "EXACTLY" ? "" : ">= "}${expected.count}${failure ? ` (${failure})` : ""}`);
  }

  const failures = results.filter((result) => !result.ok);
  if (only) {
    /* A single-layer run is for diagnosis. It must NOT write the record: doing
       so once replaced the whole certification with one entry, and the record
       is what the test trusts. Only a full run may speak for every layer. */
    console.log(`${failures.length ? "FAILED" : "ok"}: single layer, record not written`);
    if (failures.length) process.exitCode = 1;
    return;
  }
  const file = "fixtures/hunt/served-layers.json";
  writeFileSync(file, `${JSON.stringify({
    schemaVersion: 1,
    certifiedOn: new Date().toISOString().slice(0, 10),
    layers: results,
    status: failures.length ? "FAILED" : "VERIFIED",
  }, null, 2)}\n`);
  console.log(`${failures.length ? "FAILED" : "VERIFIED"}: ${file}`);
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`Served-layer certification failed: ${error.stack ?? error.message}`);
  process.exit(1);
});
