#!/usr/bin/env node
/** Certify that the public map API serves every authority identifier at several LODs. */
import { readFileSync, writeFileSync } from "node:fs";
import { ZONE_LAYERS } from "../src/lib/hunt/zone-layers.ts";

const argument = process.argv.indexOf("--base");
const base = (argument >= 0 ? process.argv[argument + 1] : "https://www.northgroundbushcraft.com").replace(/\/$/, "");
const zooms = [4, 7, 10];
const results = [];

for (const layer of ZONE_LAYERS.filter(({ serving }) => serving)) {
  const jurisdiction = layer.jurisdictionId.replace("jurisdiction:", "");
  const fixture = JSON.parse(readFileSync(`fixtures/hunt/${jurisdiction}-zone-certification.json`, "utf8"));
  const expected = [...fixture.officialIdentifiers].sort();
  const bounds = [layer.bounds.minLongitude, layer.bounds.minLatitude, layer.bounds.maxLongitude, layer.bounds.maxLatitude].join(",");
  for (const zoom of zooms) {
    const response = await fetch(`${base}/api/hunt/zones?bounds=${encodeURIComponent(bounds)}&zoom=${zoom}`, {
      signal: AbortSignal.timeout(120_000), headers: { accept: "application/json" },
    });
    const payload = await response.json();
    const actual = (payload.features ?? []).filter(({ layerId }) => layerId === layer.id).map(({ name }) => name).sort();
    const missing = expected.filter((id) => !actual.includes(id));
    const invented = actual.filter((id) => !expected.includes(id));
    const duplicateCount = actual.length - new Set(actual).size;
    const status = response.ok && payload.status !== "PROVIDER_ERROR" && !missing.length && !invented.length && !duplicateCount
      ? "VERIFIED" : "FAILED";
    results.push({ layerId: layer.id, zoom, expected: expected.length, actual: actual.length, missing, invented, duplicateCount, status });
    console.log(`${layer.jurisdictionName} z${zoom}: ${actual.length}/${expected.length} ${status}`);
  }
}

writeFileSync("fixtures/hunt/production-map-certification.json", `${JSON.stringify({ base, certifiedAt: new Date().toISOString(), results }, null, 2)}\n`);
if (results.some(({ status }) => status !== "VERIFIED")) process.exitCode = 1;
