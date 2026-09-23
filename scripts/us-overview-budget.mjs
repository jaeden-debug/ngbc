#!/usr/bin/env node
/**
 * What a state would cost the map's opening payload — measured BEFORE it is
 * served, not after.
 *
 *   node --experimental-strip-types scripts/us-overview-budget.mjs            every unserved state with a layer
 *   node --experimental-strip-types scripts/us-overview-budget.mjs ID CO      just these
 *
 * Hunt opens at the served extent and draws every zone in it, so the opening
 * payload is one budget shared by both countries: a state's units and a
 * province's are the same bytes on the same first paint. A state is measured
 * by drawing the opening view with its layers on and with them off, and
 * comparing the brotli-compressed responses — the same compression the browser
 * receives.
 *
 * The working line is ~145 KB brotli. A state that would take the overview
 * past it is not served until delivery changes (viewport-scoped or tiled), so
 * the measurement comes first and the decision is made on it.
 *
 * This asks each authority's own live service, so it is a handful of polite
 * requests per state, not a sweep.
 */

import { readFileSync } from "node:fs";
import { brotliCompressSync, constants } from "node:zlib";

/* The stored Canadian drawings come from PostGIS, so without credentials every
   Canadian layer would fail and the measurement would flatter a state by
   leaving the rest of the map out of the comparison. */
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const match = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
  if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2];
}
import { OVERVIEW_ZOOM, SERVED_EXTENT } from "../src/lib/hunt/exploration/overview.ts";
import { clearZoneGeometryCache, fetchZoneGeometry } from "../src/lib/hunt/zone-geometry.ts";
import { layerById } from "../src/lib/hunt/zone-layers.ts";
import { US_LAYER_IDS } from "../src/lib/hunt/united-states/layers.ts";

const BUDGET_BYTES = 145 * 1024;
const stateOf = (layerId) => layerId.slice("layer:us-".length, layerId.indexOf("-", "layer:us-".length)).toUpperCase();

/* A cold stored layer can time out; that is a transient failure, not a
   measurement. One retry, then refuse rather than report a number that left
   layers out. */
async function overview(attempt = 0) {
  clearZoneGeometryCache();
  const result = await fetchZoneGeometry(SERVED_EXTENT, OVERVIEW_ZOOM);
  if (result.status === "PROVIDER_ERROR") throw new Error(`The overview could not be drawn: ${result.message}`);
  /* What the browser receives: the level-1 DRAWING each layer returns, never
     source geometry. Level-1 simplification flattens vertex counts, so zone
     COUNT predicts cost far better than how heavy a source looks. */
  /* Compressed as a CDN compresses, not at maximum: brotli quality 5 is what
     the response is served at, and quality 11 understates it by about a
     quarter — enough to report a state as affordable when it is not. */
  const body = JSON.stringify({ status: result.status, features: result.features });
  const failed = (result.layers ?? []).filter((layer) => layer.status === "PROVIDER_ERROR").map((layer) => layer.layerId);
  if (failed.length) {
    if (attempt === 0) return overview(1);
    throw new Error(`Not a measurement: these layers did not draw — ${failed.join(", ")}`);
  }
  return { bytes: brotliCompressSync(Buffer.from(body), { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } }).length, features: result.features.length, status: result.status };
}

const wanted = process.argv.slice(2).filter((argument) => /^[A-Z]{2}$/i.test(argument)).map((code) => code.toUpperCase());
const candidates = [...new Set(US_LAYER_IDS.map(stateOf))]
  .filter((code) => (wanted.length ? wanted.includes(code) : US_LAYER_IDS.filter((id) => stateOf(id) === code).some((id) => !layerById(id).serving)));

const base = await overview();
console.log(`Opening payload as served today: ${(base.bytes / 1024).toFixed(1)} KB brotli, ${base.features} features (budget ${(BUDGET_BYTES / 1024).toFixed(0)} KB).\n`);

for (const code of candidates) {
  const layers = US_LAYER_IDS.filter((id) => stateOf(id) === code).map((id) => layerById(id));
  const before = layers.map((layer) => layer.serving);
  const alreadyServed = before.every(Boolean);
  try {
    for (const layer of layers) layer.serving = !alreadyServed ? true : false;
    const other = await overview();
    const withState = alreadyServed ? base : other;
    const without = alreadyServed ? other : base;
    const delta = withState.bytes - without.bytes;
    const room = BUDGET_BYTES - withState.bytes;
    console.log(
      `${code}: ${alreadyServed ? "already served" : "would add"} ${(delta / 1024).toFixed(1)} KB and ${withState.features - without.features} features ` +
      `→ ${(withState.bytes / 1024).toFixed(1)} KB total, ${(room / 1024).toFixed(1)} KB ${room >= 0 ? "left" : "OVER BUDGET"}.`,
    );
    if (room < 0) console.log(`   ${code} is not served on this measurement: the opening payload needs viewport-scoped or tiled delivery first.`);
  } finally {
    layers.forEach((layer, index) => { layer.serving = before[index]; });
  }
}
