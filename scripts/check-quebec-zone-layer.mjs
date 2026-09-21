#!/usr/bin/env node
/**
 * Watch the ministry's hunting-zone layer for change.
 *
 *   node scripts/check-quebec-zone-layer.mjs                # record its fingerprint
 *   node scripts/check-quebec-zone-layer.mjs --check        # exit 2 if the layer moved
 *   node scripts/check-quebec-zone-layer.mjs --save DIR     # also keep the raw responses
 *   node scripts/check-quebec-zone-layer.mjs --check --from DIR   # read saved responses (drills)
 *
 * North Ground's PostGIS copy of these 59 zones was parity-certified against
 * this layer (fixtures/hunt/ca-qc-spatial-parity.json). When the layer moves,
 * that certification no longer describes it. Nothing here re-ingests or
 * publishes: re-stage with `scripts/ingest-zone-layer.mjs --jurisdiction ca-qc`,
 * read its comparison, re-certify parity, and only then promote.
 *
 * Exit codes: 0 unchanged, 2 the layer moved, 1 it could not be read.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { jurisdictionToday } from "./ontario-source.mjs";
import { diffZoneLayer, fetchText, formatZoneLayerDiff, readZoneLayer, zoneLayerFingerprint } from "./quebec-source.mjs";

const OUTPUT = "content/regulatory/ca-qc-zone-layer.json";

/* Saved responses are named by what was asked, so a drill can edit one and replay the rest. */
function fileFor(url) {
  const query = new URL(url).searchParams;
  const request = query.get("request");
  if (request === "GetCapabilities") return "capabilities.xml";
  if (request === "DescribeFeatureType") return "schema.xml";
  if (request === "GetFeature") return `features-${query.get("startIndex") ?? "0"}.json`;
  throw new Error(`Unexpected request ${url}`);
}

async function main() {
  const args = process.argv.slice(2);
  const check = args.includes("--check");
  const from = args.includes("--from") ? args[args.indexOf("--from") + 1] : null;
  const save = args.includes("--save") ? args[args.indexOf("--save") + 1] : null;
  const output = args.includes("--out") ? args[args.indexOf("--out") + 1] : OUTPUT;

  const read = from
    ? async (url) => readFileSync(join(from, fileFor(url)), "utf8")
    : async (url) => {
      const text = await fetchText(url);
      if (save) {
        mkdirSync(save, { recursive: true });
        writeFileSync(join(save, fileFor(url)), text);
      }
      return text;
    };

  const fingerprint = zoneLayerFingerprint(await readZoneLayer(read));
  let previous = null;
  try { previous = JSON.parse(readFileSync(output, "utf8")); } catch { /* none yet */ }

  if (check) {
    if (!previous) throw new Error(`${output} does not exist; record the layer first.`);
    const diff = diffZoneLayer(previous, fingerprint);
    if (!diff.moved && previous.contentHash === fingerprint.contentHash) {
      console.log(`Québec zone layer unchanged (${fingerprint.records} records, ${fingerprint.designations.length} zones, ${fingerprint.contentHash}).`);
      return;
    }
    console.error("The ministry's hunting-zone layer has changed since North Ground certified its copy:");
    console.error(formatZoneLayerDiff(diff) || "  (the fingerprint moved without a named change)");
    console.error("Nothing has been re-ingested or published. Re-stage, re-certify parity, then promote.");
    process.exit(2);
  }

  /* The date moves only with the content, so recording an unchanged layer
     rewrites nothing. It is Québec's calendar day, never a UTC slice. */
  const retrievedAt = previous?.contentHash === fingerprint.contentHash && previous.retrievedAt
    ? previous.retrievedAt
    : jurisdictionToday("America/Toronto");
  writeFileSync(output, `${JSON.stringify({
    layer: "SmartFaunePub:Zone_chasse_da3_sefaq",
    purpose: "The ministry's hunting-zone layer as North Ground last certified it, without geometry. A change here means the parity certification no longer describes the live layer.",
    retrievedAt,
    ...fingerprint,
  }, null, 2)}\n`);
  console.log(`Wrote ${output}: ${fingerprint.records} records in ${fingerprint.designations.length} zones (${fingerprint.contentHash}).`);
}

main().catch((error) => {
  console.error(`Zone layer check failed: ${error.message}`);
  process.exit(1);
});
