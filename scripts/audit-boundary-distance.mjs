#!/usr/bin/env node
/** Verify the live resolver at every database-derived inside-edge sample. */
import { readFileSync, writeFileSync } from "node:fs";

function env() {
  for (const file of [".env.local", ".env"]) {
    try {
      for (const line of readFileSync(file, "utf8").split("\n")) {
        const match = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
        if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2];
      }
    } catch { /* optional */ }
  }
  return { url: process.env.SUPABASE_URL?.replace(/\/$/, ""), key: process.env.SUPABASE_SERVICE_ROLE_KEY };
}

async function rpc(environment, name, body) {
  const response = await fetch(`${environment.url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: environment.key, authorization: `Bearer ${environment.key}`, "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new Error(`${name}: ${response.status} ${(await response.text()).slice(0, 300)}`);
  return response.json();
}

// Québec already measures subdivided derivative boundaries; the fallback defect
// and this certification concern the three jurisdictions without derivatives.
const jurisdictions = ["ca-on", "ca-mb", "ca-ab"];
const environment = env();
if (!environment.url || !environment.key) throw new Error("Supabase server credentials are required");
const results = [];
for (const jurisdiction of jurisdictions) {
  const samples = await rpc(environment, "zone_sample_points", {
    p_jurisdiction_canonical_id: `jurisdiction:${jurisdiction}`,
  });
  const answers = new Array(samples.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: 5 }, async () => {
    while (cursor < samples.length) {
      const index = cursor++;
      const sample = samples[index];
      const rows = await rpc(environment, "resolve_management_zone", {
        p_latitude: sample.edge_latitude,
        p_longitude: sample.edge_longitude,
      });
      const answer = rows.find(({ canonical_id: id }) => id === sample.canonical_id);
      answers[index] = {
        canonicalId: sample.canonical_id,
        resolved: Boolean(answer),
        boundaryDistanceMeters: answer?.boundary_distance_meters ?? null,
      };
    }
  }));
  const distances = answers.map(({ boundaryDistanceMeters }) => boundaryDistanceMeters).filter(Number.isFinite);
  const failures = answers.filter(({ resolved, boundaryDistanceMeters }) => !resolved || !Number.isFinite(boundaryDistanceMeters));
  results.push({
    jurisdiction: `jurisdiction:${jurisdiction}`,
    samples: answers.length,
    resolved: answers.length - failures.length,
    maximumBoundaryDistanceMeters: Math.max(...distances),
    failures,
    status: failures.length ? "FAILED" : "VERIFIED",
  });
  console.log(`${jurisdiction}: ${answers.length - failures.length}/${answers.length}, max ${Math.max(...distances)} m`);
}

const report = { schemaVersion: 1, certifiedAt: new Date().toISOString(), results };
writeFileSync("fixtures/hunt/boundary-distance-certification.json", `${JSON.stringify(report, null, 2)}\n`);
if (results.some(({ status }) => status !== "VERIFIED")) process.exitCode = 1;
