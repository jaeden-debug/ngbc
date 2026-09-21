#!/usr/bin/env node
/**
 * Ingest an authority's hunting-zone layer into North Ground's spatial registry.
 *
 *   node scripts/ingest-zone-layer.mjs --jurisdiction ca-on            # stage + compare
 *   node scripts/ingest-zone-layer.mjs --jurisdiction ca-on --publish  # promote a run
 *
 * Staging and promotion are separate on purpose. An authority redrawing a
 * boundary, renaming a unit or dropping one is a regulatory event: the comparison
 * is printed for a person, and `--publish` is that person's decision. Geometry is
 * never rewritten as a side effect of a fetch.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { ZONE_ADAPTERS, loadZoneSource } from "./zone-adapters.mjs";

/* ── Environment ─────────────────────────────────────────────────────────── */

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

const { url: SUPABASE_URL, key: SERVICE_KEY } = loadEnv();

async function rest(path, { method = "GET", body, prefer } = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      authorization: `Bearer ${SERVICE_KEY}`,
      "content-type": "application/json",
      ...(prefer ? { prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path} -> ${response.status} ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

/* ── Pipeline ────────────────────────────────────────────────────────────── */

const FIELD_SEPARATOR = String.fromCharCode(31);
const RECORD_SEPARATOR = String.fromCharCode(30);

/** Stable across runs: identity plus geometry, so an unchanged source is recognisable. */
function contentHash(features) {
  const hash = createHash("sha256");
  const ordered = [...features].sort((a, b) => a.sourceFeatureId.localeCompare(b.sourceFeatureId));
  for (const feature of ordered) {
    hash.update(feature.sourceFeatureId);
    hash.update(FIELD_SEPARATOR);
    hash.update(feature.officialIdentifier);
    hash.update(FIELD_SEPARATOR);
    hash.update(JSON.stringify(feature.geometry));
    hash.update(RECORD_SEPARATOR);
  }
  return `sha256:${hash.digest("hex")}`;
}

async function main() {
  const args = process.argv.slice(2);
  const jurisdiction = args[args.indexOf("--jurisdiction") + 1];
  const publish = args.includes("--publish");
  if (!ZONE_ADAPTERS[jurisdiction]) {
    console.error(`Unknown jurisdiction. Known: ${Object.keys(ZONE_ADAPTERS).join(", ")}`);
    process.exit(1);
  }
  const source = await loadZoneSource(jurisdiction);

  console.log(`Fetching ${source.officialTerm} features from ${source.authority}...`);
  const started = Date.now();
  const { features, sourceVersion, quarantined = [] } = await source.fetchFeatures();
  console.log(`  ${features.length} features in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  // A record the authority publishes and North Ground does not stage is shown to
  // the reviewer and written onto the run, never dropped silently.
  for (const record of quarantined) console.log(`  quarantined ${record.sourceFeatureId}: ${record.reason}`);
  if (!features.length) {
    console.error("The authority returned no features. Refusing to stage an empty layer.");
    process.exit(1);
  }

  const identifiers = new Set(features.map((feature) => feature.officialIdentifier));
  if (identifiers.size !== features.length) {
    console.error("Duplicate official identifiers in the source response; refusing to stage.");
    process.exit(1);
  }

  const [jurisdictionRow] = await rest(
    `regulatory_jurisdictions?canonical_id=eq.${encodeURIComponent(source.jurisdictionCanonicalId)}&select=id`,
  );
  if (!jurisdictionRow) throw new Error(`Jurisdiction ${source.jurisdictionCanonicalId} is not registered`);

  const retrievedAt = new Date().toISOString();
  const hash = contentHash(features);

  const [run] = await rest("zone_ingest_runs", {
    method: "POST",
    prefer: "return=representation",
    body: [
      {
        jurisdiction_id: jurisdictionRow.id,
        layer_id: source.layerId,
        source_url: source.sourceUrl,
        source_version: sourceVersion ?? null,
        content_hash: hash,
        retrieved_at: retrievedAt,
        feature_count: features.length,
        status: "STAGED",
        notes: [
          `Ingested by scripts/ingest-zone-layer.mjs for ${jurisdiction}`,
          ...quarantined.map((record) => `Quarantined ${record.sourceFeatureId}: ${record.reason}`),
        ].join("\n"),
      },
    ],
  });
  console.log(`  staged as run ${run.id}`);
  console.log(`  content hash ${hash}`);

  // Rows carry multi-megabyte geometry, so they go up in small batches.
  const BATCH = 4;
  for (let index = 0; index < features.length; index += BATCH) {
    const rows = features.slice(index, index + BATCH).map((feature) => ({
      run_id: run.id,
      source_feature_id: feature.sourceFeatureId,
      official_identifier: feature.officialIdentifier,
      canonical_id: source.canonicalZoneId(feature.officialIdentifier),
      official_name: source.officialName(feature.officialIdentifier),
      attributes: feature.attributes,
      geometry: feature.geometry,
    }));
    await rest("zone_ingest_features", { method: "POST", prefer: "return=minimal", body: rows });
    console.log(`  uploaded ${Math.min(index + BATCH, features.length)}/${features.length}`);
  }

  const comparison = await rest("rpc/compare_zone_run", { method: "POST", body: { p_run_id: run.id } });
  console.log("");
  console.log("Comparison against published geometry:");
  console.log(`  incoming ${comparison.incoming}  published ${comparison.published}  unchanged ${comparison.unchanged}`);
  console.log(`  added      ${comparison.added.length ? comparison.added.join(", ") : "none"}`);
  console.log(`  removed    ${comparison.removed.length ? comparison.removed.join(", ") : "none"}`);
  console.log(`  invalid    ${comparison.invalid.length ? JSON.stringify(comparison.invalid) : "none"}`);
  console.log(`  area moved ${comparison.areaChanged.length ? JSON.stringify(comparison.areaChanged) : "none beyond 0.5%"}`);

  if (!publish) {
    console.log("");
    console.log("Staged only. Review the comparison, then re-run with --publish to promote it.");
    return;
  }

  if (comparison.invalid.length) {
    console.error("Refusing to publish: the run contains invalid geometry.");
    process.exit(1);
  }

  const result = await rest("rpc/publish_zone_run", {
    method: "POST",
    body: { p_run_id: run.id, p_zone_type: source.zoneType, p_source_canonical_id: source.sourceCanonicalId },
  });
  console.log("");
  console.log(`Published: ${result.inserted} inserted, ${result.updated} updated, ${result.totalZones} zones now in the registry.`);
}

main().catch((error) => {
  console.error(`Ingestion failed: ${error.message}`);
  process.exit(1);
});
