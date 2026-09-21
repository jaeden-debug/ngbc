#!/usr/bin/env node
/**
 * Certify North Ground's PostGIS zone registry against an authority's own service.
 *
 *   node scripts/certify-spatial-parity.mjs --jurisdiction ca-ab
 *
 * The jurisdiction-neutral form of `certify-ontario-spatial-parity.mjs`, which
 * stays as Ontario's recorded regression. Any adapter that implements
 * `officialIdentifiersAt` can be certified here without a new script.
 *
 * Every point is put to both systems and must get the same answer:
 *
 *   inside    a point inside every unit           → that unit
 *   edge      just inside its closest boundary    → that unit
 *   across    just outside that same boundary     → the neighbour, or nothing
 *   component every sizeable part of a multipart unit
 *   outside   points beyond the jurisdiction      → nothing
 *   invalid   impossible coordinates              → nothing, from North Ground
 *
 * plus any extra cases the jurisdiction declares below — typically a record the
 * adapter quarantines, which must resolve to no zone in both systems.
 *
 * This is a certification, not a unit test: it deliberately calls the live
 * service. Disagreement is a finding, never something to resolve by preferring
 * the local copy. Exit 0 only when every point agrees.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { loadZoneSource } from "./zone-adapters.mjs";

/** Points a jurisdiction adds beyond the generated samples: [label, lat, lon]. */
const EXTRA_CASES = {};

const INVALID = [
  ["latitude above the pole", 95.0, -114.0],
  ["longitude beyond the meridian", 53.0, -200.0],
];

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      for (const line of readFileSync(file, "utf8").split("\n")) {
        const match = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
        if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2];
      }
    } catch {
      /* absent is fine */
    }
  }
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (server-only).");
    process.exit(1);
  }
  return { url: url.replace(/\/$/, ""), key };
}

async function main() {
  const args = process.argv.slice(2);
  const jurisdiction = args[args.indexOf("--jurisdiction") + 1];
  const source = await loadZoneSource(jurisdiction);
  if (typeof source.officialIdentifiersAt !== "function") {
    throw new Error(`The ${jurisdiction} adapter cannot ask its authority about a point (no officialIdentifiersAt).`);
  }
  const { url, key } = loadEnv();

  async function rpc(name, body = {}) {
    const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`${name} -> ${response.status} ${text.slice(0, 300)}`);
    return JSON.parse(text);
  }

  async function official(latitude, longitude) {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await source.officialIdentifiersAt(latitude, longitude);
      } catch (error) {
        if (attempt === 2) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
      }
    }
  }

  const prefix = `${source.canonicalZoneId("X").replace(/x$/i, "")}`;
  async function northGround(latitude, longitude) {
    const rows = await rpc("resolve_management_zone", { p_latitude: latitude, p_longitude: longitude });
    return rows
      .map((row) => String(row.canonical_id))
      // A point in another jurisdiction's zone is a finding too: keep it visible.
      .map((canonical) => (canonical.startsWith(prefix) ? canonical.slice(prefix.length) : canonical))
      .sort();
  }

  // Compare by canonical id: the adapter's identifiers mapped through its own
  // canonicalZoneId, so both sides use one vocabulary.
  const canonicalTail = (identifier) => source.canonicalZoneId(identifier).slice(prefix.length);

  const recorded = [];
  const disagreements = [];
  const latencies = [];

  async function check(kind, label, latitude, longitude) {
    const started = performance.now();
    const ours = await northGround(latitude, longitude);
    latencies.push(performance.now() - started);
    const theirs = (await official(latitude, longitude)).map(canonicalTail).sort();
    const agree = JSON.stringify(theirs) === JSON.stringify(ours);
    recorded.push({ kind, label, latitude, longitude, official: theirs, northGround: ours, agree });
    if (!agree) disagreements.push({ kind, label, latitude, longitude, official: theirs, northGround: ours });
    if (recorded.length % 50 === 0) console.log(`  ...${recorded.length} points checked`);
  }

  console.log(`Sampling ${source.jurisdictionCanonicalId} from the North Ground registry...`);
  const samples = await rpc("zone_sample_points", { p_jurisdiction_canonical_id: source.jurisdictionCanonicalId });
  const components = await rpc("zone_component_sample_points", {
    p_jurisdiction_canonical_id: source.jurisdictionCanonicalId,
    p_max_components: 8,
  });
  console.log(`  ${samples.length} zones, ${components.length} multipart components`);
  if (!samples.length) throw new Error("The registry holds no zones for this jurisdiction; nothing to certify.");

  for (const sample of samples) {
    await check("inside", `inside ${sample.official_identifier}`, sample.inside_latitude, sample.inside_longitude);
    await check("edge", `edge ${sample.official_identifier}`, sample.edge_latitude, sample.edge_longitude);
    await check("across", `across ${sample.official_identifier}`, sample.across_latitude, sample.across_longitude);
  }
  for (const component of components) {
    await check(
      "component",
      `component ${component.component_rank}/${component.component_count} of ${component.official_identifier}`,
      component.latitude,
      component.longitude,
    );
  }
  const extra = EXTRA_CASES[jurisdiction] ?? { outside: [], special: [] };
  for (const [label, latitude, longitude] of extra.outside) await check("outside", label, latitude, longitude);
  for (const [label, latitude, longitude] of extra.special) await check("special", label, latitude, longitude);

  for (const [label, latitude, longitude] of INVALID) {
    const ours = await rpc("resolve_management_zone", { p_latitude: latitude, p_longitude: longitude });
    const agree = Array.isArray(ours) && ours.length === 0;
    recorded.push({ kind: "invalid", label, latitude, longitude, official: [], northGround: ours.map((row) => row.canonical_id), agree });
    if (!agree) disagreements.push({ kind: "invalid", label, latitude, longitude, official: [], northGround: ours });
  }

  latencies.sort((a, b) => a - b);
  const percentile = (p) => Math.round(latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p))]);
  const counts = Object.fromEntries(
    [...new Set(recorded.map(({ kind }) => kind))].map((kind) => [kind, recorded.filter((item) => item.kind === kind).length]),
  );
  const file = `fixtures/hunt/${jurisdiction}-spatial-parity.json`;
  writeFileSync(file, `${JSON.stringify({
    jurisdiction: source.jurisdictionCanonicalId,
    layer: source.layerId,
    authority: source.authority,
    sourceUrl: source.sourceUrl,
    certifiedOn: new Date().toISOString().slice(0, 10),
    zones: samples.length,
    counts,
    disagreements: disagreements.length,
    cases: recorded,
  }, null, 2)}\n`);

  console.log("");
  console.log(`Points checked    : ${recorded.length} ${JSON.stringify(counts)}`);
  console.log(`Zones in registry : ${samples.length}`);
  console.log(`PostGIS resolve   : median ${percentile(0.5)} ms, p90 ${percentile(0.9)} ms (REST round trip)`);
  console.log(`Disagreements     : ${disagreements.length}`);
  console.log(`Recorded          : ${file}`);
  if (disagreements.length) {
    for (const item of disagreements.slice(0, 40)) {
      console.log(`  [${item.kind}] ${item.label} @ ${item.latitude},${item.longitude}`);
      console.log(`     authority   : ${JSON.stringify(item.official)}`);
      console.log(`     North Ground: ${JSON.stringify(item.northGround)}`);
    }
    console.log("\nParity NOT established.");
    process.exit(1);
  }
  console.log("\nParity established: every sampled point resolves identically in both systems.");
}

main().catch((error) => {
  console.error(`Certification failed: ${error.message}`);
  process.exit(1);
});
