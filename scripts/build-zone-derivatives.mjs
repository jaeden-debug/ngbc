#!/usr/bin/env node
/**
 * Build a jurisdiction's zone derivatives, one zone at a time.
 *
 *   node scripts/build-zone-derivatives.mjs --jurisdiction ca-bc [--missing-only]
 *
 * Calls `build_zone_derivatives` (migration 20260921034448) for each published
 * zone of the jurisdiction: subdivided parts for point lookup, boundary parts
 * for exact boundary distance, and stored drawings for the map. Each call
 * rebuilds that zone's derivatives from its own geometry and nothing else.
 *
 * It is a production write sized for a small instance: one zone per call,
 * the database's responsiveness probed before every call, and the run stops
 * on the first failure rather than pushing into a slow database (see the
 * 2026-09-21 outage in docs/PROJECT-STATE.md). Re-running is safe.
 */

import { readFileSync } from "node:fs";
import { ZONE_ADAPTERS, loadZoneSource } from "./zone-adapters.mjs";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      for (const line of readFileSync(file, "utf8").split("\n")) {
        const match = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
        if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2];
      }
    } catch { /* absent is fine */ }
  }
  const url = process.env.SUPABASE_URL?.trim().replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (server-only).");
  return { url, key };
}

const SLOW_MS = 2_500;

async function main() {
  const args = process.argv.slice(2);
  const jurisdiction = args[args.indexOf("--jurisdiction") + 1];
  if (!ZONE_ADAPTERS[jurisdiction]) throw new Error(`Use --jurisdiction ${Object.keys(ZONE_ADAPTERS).join("|")}`);
  const missingOnly = args.includes("--missing-only");
  const { url, key } = loadEnv();
  const headers = { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" };
  const rest = async (path, init = {}) => {
    const response = await fetch(`${url}/rest/v1/${path}`, { ...init, headers, signal: AbortSignal.timeout(120_000) });
    const text = await response.text();
    if (!response.ok) throw new Error(`${init.method ?? "GET"} ${path} -> ${response.status} ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : null;
  };
  const healthy = async () => {
    for (let attempt = 1; attempt <= 6; attempt += 1) {
      const started = Date.now();
      try {
        await rest("regulatory_jurisdictions?select=id&limit=1");
        if (Date.now() - started < SLOW_MS) return;
      } catch { /* retried below */ }
      console.log(`  database slow or unreachable; waiting (${attempt}/6)`);
      await new Promise((resolve) => setTimeout(resolve, 15_000 * attempt));
    }
    throw new Error("The database stayed slow; stopping rather than adding load. Re-run with --missing-only to resume.");
  };

  const source = await loadZoneSource(jurisdiction);
  const prefix = source.canonicalZoneId("x").slice(0, -1);
  const zones = await rest(`management_zones?canonical_id=like.${encodeURIComponent(`${prefix}*`)}&select=id,canonical_id&order=canonical_id`);
  if (!zones.length) throw new Error(`No published ${jurisdiction} zones; publish a run first.`);
  let todo = zones;
  if (missingOnly) {
    const built = new Set((await rest(`management_zone_display?level=eq.0&select=management_zone_id&management_zone_id=in.(${zones.map(({ id }) => id).join(",")})`))
      .map(({ management_zone_id: id }) => id));
    todo = zones.filter(({ id }) => !built.has(id));
  }
  console.log(`${jurisdiction}: ${todo.length} of ${zones.length} zones to build`);
  const started = Date.now();
  for (const [index, zone] of todo.entries()) {
    await healthy();
    const result = await rest("rpc/build_zone_derivatives", { method: "POST", body: JSON.stringify({ p_management_zone_id: zone.id }) });
    console.log(`  ${index + 1}/${todo.length} ${zone.canonical_id}: ${JSON.stringify(result)}`);
  }
  console.log(`done in ${((Date.now() - started) / 1000).toFixed(0)} s`);
}

main().catch((error) => {
  console.error(`Derivative build stopped: ${error.message}`);
  process.exit(1);
});
