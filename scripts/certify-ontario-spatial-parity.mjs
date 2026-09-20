#!/usr/bin/env node
/**
 * Certify North Ground's PostGIS zone registry against the authority's own service.
 *
 *   node scripts/certify-ontario-spatial-parity.mjs
 *
 * This is a certification run, not a unit test: it deliberately calls the live
 * Government of Ontario service, once per fixture, because the question it answers
 * is "does our copy still agree with theirs?" — which recorded fixtures cannot
 * answer. Unit tests use recorded fixtures and never touch the network.
 *
 * Disagreement is a finding, never something to paper over by preferring the local
 * database. Until this run is clean, official GIS stays the runtime resolver.
 */

import { readFileSync, writeFileSync } from "node:fs";

const ONTARIO_WMU_QUERY =
  "https://ws.lioservices.lrc.gov.on.ca/arcgis2/rest/services/LIO_OPEN_DATA/LIO_Open05/MapServer/5/query";

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
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
    process.exit(1);
  }
  return { url: url.replace(/\/$/, ""), key };
}

const { url: SUPABASE_URL, key: SERVICE_KEY } = loadEnv();

async function rpc(name, body = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      authorization: `Bearer ${SERVICE_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${name} -> ${response.status} ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

/** What the authority says is at this point, asked exactly as Hunt asks it. */
async function officialWmuAt(latitude, longitude) {
  const parameters = new URLSearchParams({
    where: "1=1",
    geometry: `${longitude},${latitude}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "OFFICIAL_NAME",
    returnGeometry: "false",
    f: "geojson",
  });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(`${ONTARIO_WMU_QUERY}?${parameters}`, {
        headers: { accept: "application/geo+json, application/json" },
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      return (payload.features ?? [])
        .map((feature) => String(feature.properties?.OFFICIAL_NAME ?? "").trim())
        .filter(Boolean)
        .sort();
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
    }
  }
  return [];
}

async function main() {
  console.log("Fetching representative points from the North Ground registry...");
  const samples = await rpc("zone_sample_points");
  console.log(`  ${samples.length} zones sampled`);

  const disagreements = [];
  const recorded = [];
  let checked = 0;

  const runCase = async (label, latitude, longitude, expected) => {
    const official = await officialWmuAt(latitude, longitude);
    const ours = await rpc("resolve_management_zone", { p_latitude: latitude, p_longitude: longitude });
    const oursNames = ours
      .map((row) => String(row.official_name ?? "").replace(/^Wildlife Management Unit\s+/i, "").trim())
      .filter(Boolean)
      .sort();

    const agree = JSON.stringify(official) === JSON.stringify(oursNames);
    checked += 1;
    if (!agree) {
      disagreements.push({ label, latitude, longitude, expected, official, ours: oursNames });
    }
    recorded.push({ label, latitude, longitude, official, northGround: oursNames, agree });
    if (checked % 25 === 0) console.log(`  ...${checked} points checked`);
  };

  console.log("Checking a point inside every zone, and one just inside every boundary...");
  for (const sample of samples) {
    await runCase(`inside ${sample.official_identifier}`, sample.inside_latitude, sample.inside_longitude, sample.official_identifier);
    await runCase(`near-edge ${sample.official_identifier}`, sample.edge_latitude, sample.edge_longitude, sample.official_identifier);
  }

  console.log("Checking points outside supported territory and invalid coordinates...");
  const OUTSIDE = [
    ["Manitoba, west of Ontario", 50.0, -99.0],
    ["Quebec, east of Ontario", 46.8, -71.2],
    ["Minnesota, south-west", 47.9, -92.1],
    ["New York, south-east", 43.5, -75.5],
    ["Hudson Bay, open water north", 58.5, -86.0],
  ];
  for (const [label, latitude, longitude] of OUTSIDE) {
    await runCase(label, latitude, longitude, null);
  }

  const INVALID = [
    ["latitude above the pole", 95.0, -80.0],
    ["longitude beyond the meridian", 48.0, -200.0],
  ];
  for (const [label, latitude, longitude] of INVALID) {
    const ours = await rpc("resolve_management_zone", { p_latitude: latitude, p_longitude: longitude });
    const ok = Array.isArray(ours) && ours.length === 0;
    checked += 1;
    recorded.push({ label, latitude, longitude, official: [], northGround: [], agree: ok });
    if (!ok) disagreements.push({ label, latitude, longitude, expected: "no zone", official: [], ours });
  }

  writeFileSync(
    "fixtures/hunt/ontario-spatial-parity.json",
    `${JSON.stringify({ generatedAt: new Date().toISOString(), checked, cases: recorded }, null, 2)}\n`,
  );

  console.log("");
  console.log(`Points checked      : ${checked}`);
  console.log(`Zones in registry   : ${samples.length}`);
  console.log(`Disagreements       : ${disagreements.length}`);
  if (disagreements.length) {
    console.log("");
    for (const item of disagreements.slice(0, 25)) {
      console.log(`  ${item.label} @ ${item.latitude},${item.longitude}`);
      console.log(`     authority   : ${JSON.stringify(item.official)}`);
      console.log(`     North Ground: ${JSON.stringify(item.ours)}`);
    }
    console.log("");
    console.log("Parity NOT established. Official GIS must remain the runtime resolver.");
    process.exit(1);
  }
  console.log("");
  console.log("Parity established: every sampled point resolves identically in both systems.");
}

main().catch((error) => {
  console.error(`Certification failed: ${error.message}`);
  process.exit(1);
});
