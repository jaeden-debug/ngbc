#!/usr/bin/env node
/**
 * Certify a live-service zone layer: the geography North Ground answers from
 * the authority's own service at request time, and stores no copy of.
 *
 *   node scripts/certify-live-zone-layer.mjs --layer layer:us-co-gmu [--concurrency 3] [--boundary N]
 *
 * The counterpart of `certify-spatial-parity.mjs` for layers that are not in
 * the PostGIS registry. There, the question is whether North Ground's stored
 * copy agrees with the authority. Here there is no stored copy, so the
 * question is whether North Ground's PRODUCTION RESOLVER reads the authority's
 * service correctly — its designation encoding, the records it must treat as
 * no zone, what it does where the service returns two features — and whether
 * the service's point answers agree with the authority's own full geometry.
 *
 * Every point is answered three ways, and all three must agree:
 *
 *   geometry    the authority's whole layer, read into memory for this run
 *               only and tested exactly (holes are outside);
 *   authority   the service's own answer at the point (the adapter);
 *   production  North Ground's resolver, as Hunt calls it.
 *
 * Points: inside, just inside the closest boundary, and just across it for
 * every unit; each sizeable part of a multipart unit; outside and special
 * places from `fixtures/hunt/<state>-parity-cases.json`; impossible
 * coordinates. Where the geometry holds two units at a point (an overlap or a
 * sliver), agreement means the production resolver names neither.
 *
 * This is a certification, not a unit test: it calls the live service. It
 * writes `fixtures/hunt/<layer>-live-parity.json` and exits 0 only when every
 * point agrees. No geometry is written anywhere.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { createArcgisZoneSource } from "../src/lib/hunt/ingestion/arcgis-zone-source.ts";
import { boundarySamples, pointInGeometry, unitSamples } from "../src/lib/hunt/ingestion/sample-points.ts";
import { usAdapterConfig } from "../src/lib/hunt/united-states/layers.ts";
import { resolveLayerFromOfficialGis } from "../src/lib/hunt/zone.ts";
import { layerById } from "../src/lib/hunt/zone-layers.ts";

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const layerId = argument("--layer");
if (!layerId) {
  console.error("Usage: node scripts/certify-live-zone-layer.mjs --layer <layer id> [--concurrency 3]");
  process.exit(1);
}
const concurrency = Math.max(1, Number(argument("--concurrency", "3")) || 3);
// Extra edge/across pairs spread along each unit's boundary, for layers with few, large units.
const alongBoundary = Math.max(0, Number(argument("--boundary", "0")) || 0);
const layer = layerById(layerId);
if (!layer || layer.resolution !== "LIVE_SERVICE") throw new Error(`${layerId} is not a registered live-service layer`);
const config = usAdapterConfig(layerId);
const source = createArcgisZoneSource(config);
const stateKey = config.jurisdictionKey;

async function retried(operation) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
    }
  }
}

/* The production resolver reports a provider failure as a status, not an
   exception; a failure is retried like any other transient error, and a point
   that could not be asked is never counted as agreeing. */
async function production(latitude, longitude) {
  return retried(async () => {
    const result = await resolveLayerFromOfficialGis({ ...layer, serving: true }, latitude, longitude);
    if (result.status === "PROVIDER_ERROR") throw new Error(result.message);
    if (result.status !== "RESOLVED") return [];
    return [result.officialName.slice(layer.officialNamePrefix.length)];
  });
}

console.log(`Reading ${layerId} from ${config.layerUrl} into memory...`);
const started = Date.now();
const { features, quarantined, sourceVersion } = await retried(() => source.fetchFeatures());
console.log(`  ${features.length} units, ${quarantined?.length ?? 0} quarantined records, in ${((Date.now() - started) / 1000).toFixed(1)} s`);

const units = features.map((feature) => ({ identifier: feature.officialIdentifier, geometry: feature.geometry }));
const inGeometry = (latitude, longitude) =>
  units.filter((unit) => pointInGeometry([longitude, latitude], unit.geometry)).map((unit) => unit.identifier).sort();

const planned = [];
for (const unit of units) {
  const samples = unitSamples(unit.identifier, unit.geometry);
  planned.push({ kind: "inside", label: `inside ${unit.identifier}`, point: samples.inside });
  planned.push({ kind: "edge", label: `edge ${unit.identifier}`, point: samples.edge });
  planned.push({ kind: "across", label: `across ${unit.identifier}`, point: samples.across });
  boundarySamples(unit.geometry, samples.inside, alongBoundary).forEach((pair, index) => {
    planned.push({ kind: "boundary", label: `boundary ${index + 1} inside ${unit.identifier}`, point: pair.edge });
    planned.push({ kind: "boundary", label: `boundary ${index + 1} across ${unit.identifier}`, point: pair.across });
  });
  for (const component of samples.components) {
    planned.push({ kind: "component", label: `component ${component.rank}/${component.count} of ${unit.identifier}`, point: component.point });
  }
}

let cases = { outside: [], special: [] };
try {
  cases = JSON.parse(readFileSync(new URL(`../fixtures/hunt/${stateKey}-parity-cases.json`, import.meta.url), "utf8"));
} catch {
  console.warn(`  No fixtures/hunt/${stateKey}-parity-cases.json: certifying without outside or special points.`);
}
for (const [label, latitude, longitude] of cases.outside ?? []) planned.push({ kind: "outside", label, point: [longitude, latitude] });
for (const [label, latitude, longitude] of cases.special ?? []) planned.push({ kind: "special", label, point: [longitude, latitude] });

const recorded = [];
const officialLatencies = [];
const productionLatencies = [];
let next = 0;
async function worker() {
  while (next < planned.length) {
    const item = planned[next++];
    const [longitude, latitude] = item.point;
    const geometry = inGeometry(latitude, longitude);
    let t = performance.now();
    const official = (await retried(() => source.officialIdentifiersAt(latitude, longitude))).sort();
    officialLatencies.push(performance.now() - t);
    t = performance.now();
    const ours = await production(latitude, longitude);
    productionLatencies.push(performance.now() - t);
    /* Where the authority's own geometry puts the point in two units, the only
       correct production answer is none: North Ground never picks one. */
    const expectedProduction = geometry.length === 1 ? geometry : [];
    const agree =
      JSON.stringify(official) === JSON.stringify(geometry) &&
      JSON.stringify(ours) === JSON.stringify(expectedProduction);
    recorded.push({
      kind: item.kind, label: item.label,
      latitude: Number(latitude.toFixed(7)), longitude: Number(longitude.toFixed(7)),
      geometry, official, production: ours, agree,
    });
    if (recorded.length % 50 === 0) console.log(`  ${recorded.length}/${planned.length}`);
  }
}
await Promise.all(Array.from({ length: concurrency }, worker));

const INVALID = [["latitude above the pole", 95, -107], ["longitude beyond the meridian", 40, -200], ["not a number", Number.NaN, -107]];
for (const [label, latitude, longitude] of INVALID) {
  const ours = await production(latitude, longitude).catch(() => ["(threw)"]);
  const agree = ours.length === 0;
  recorded.push({ kind: "invalid", label, latitude: String(latitude), longitude: String(longitude), geometry: [], official: [], production: ours, agree });
}

recorded.sort((a, b) => a.kind.localeCompare(b.kind) || a.label.localeCompare(b.label, "en", { numeric: true }));
const disagreements = recorded.filter((item) => !item.agree);
const counts = Object.fromEntries([...new Set(recorded.map((item) => item.kind))].map((kind) => [kind, recorded.filter((item) => item.kind === kind).length]));
const overlaps = recorded.filter((item) => item.geometry.length > 1).length;
const percentile = (values, p) => Math.round([...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * p))]);
const record = {
  layer: layerId,
  jurisdiction: layer.jurisdictionId,
  authority: layer.authority,
  service: config.layerUrl,
  sourceVersion,
  resolution: "LIVE_SERVICE (no copy stored)",
  legalStanding: layer.legalStanding?.kind,
  certifiedOn: new Intl.DateTimeFormat("en-CA", { timeZone: layer.timeZone ?? "America/Denver", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()),
  units: units.length,
  quarantined: (quarantined ?? []).map((entry) => ({ sourceFeatureId: entry.sourceFeatureId, reason: entry.reason })),
  points: recorded.length,
  counts,
  overlapsInAuthorityGeometry: overlaps,
  disagreements: disagreements.length,
  latencyMs: {
    authorityMedian: percentile(officialLatencies, 0.5), authorityP90: percentile(officialLatencies, 0.9),
    productionMedian: percentile(productionLatencies, 0.5), productionP90: percentile(productionLatencies, 0.9),
  },
  results: recorded,
};
const out = new URL(`../fixtures/hunt/${layerId.replace(/^layer:/, "")}-live-parity.json`, import.meta.url);
writeFileSync(out, `${JSON.stringify(record, null, 2)}\n`);

console.log(`\n${layerId}: ${recorded.length} points, ${disagreements.length} disagreements, ${overlaps} in two units of the authority's geometry`);
console.log(`  ${Object.entries(counts).map(([kind, count]) => `${kind} ${count}`).join(", ")}`);
console.log(`  authority median ${record.latencyMs.authorityMedian} ms p90 ${record.latencyMs.authorityP90} ms; production median ${record.latencyMs.productionMedian} ms p90 ${record.latencyMs.productionP90} ms`);
for (const item of disagreements.slice(0, 20)) {
  console.log(`  DISAGREE ${item.label} (${item.latitude}, ${item.longitude}): geometry ${JSON.stringify(item.geometry)} official ${JSON.stringify(item.official)} production ${JSON.stringify(item.production)}`);
}
console.log(`Wrote ${out.pathname}`);
process.exit(disagreements.length ? 3 : 0);
