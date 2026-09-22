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
import { base64Chunks, geometryCounts, multiPolygonToEwkb } from "./ewkb.mjs";
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

  /* ── Upload, sized to what the database can take ─────────────────────── *
   *
   * Every REST statement runs under an 8-second timeout on a small instance,
   * and a large JSON body is parsed in the database's memory. On 2026-09-20 two
   * Québec designations sent as 18 and 22 MB of GeoJSON, on top of concurrent
   * parity runs, left the production database unresponsive for half an hour.
   * So a feature above LARGE_FEATURE_BYTES travels as base64 EWKB chunks that
   * the database decodes in one fast statement (see assemble_zone_ingest_
   * feature), smaller ones go in batches capped by bytes, and the database's
   * responsiveness is checked between steps: the upload waits while it is slow
   * and stops rather than push into it. */
  const LARGE_FEATURE_BYTES = 1_500_000;
  const BATCH_BYTES = 2_000_000;
  const SLOW_MS = 2_500;

  async function healthy() {
    for (let attempt = 1; attempt <= 6; attempt += 1) {
      const probeStarted = Date.now();
      try {
        await rest("regulatory_jurisdictions?select=id&limit=1");
        const took = Date.now() - probeStarted;
        if (took < SLOW_MS) return;
        console.log(`  database answered in ${took} ms; waiting before the next upload (${attempt}/6)`);
      } catch (error) {
        console.log(`  database probe failed (${error.message.slice(0, 80)}); waiting (${attempt}/6)`);
      }
      await new Promise((resolve) => setTimeout(resolve, 20_000 * attempt));
    }
    throw new Error("The database stayed slow; stopping the upload rather than adding load. Re-run to resume from a new run.");
  }

  const rowFor = (feature) => ({
    run_id: run.id,
    source_feature_id: feature.sourceFeatureId,
    official_identifier: feature.officialIdentifier,
    canonical_id: source.canonicalZoneId(feature.officialIdentifier),
    official_name: source.officialName(feature.officialIdentifier),
    attributes: feature.attributes,
    geometry: feature.geometry,
  });

  const sized = features.map((feature) => ({ feature, bytes: Buffer.byteLength(JSON.stringify(feature.geometry)) }));
  const small = sized.filter((entry) => entry.bytes <= LARGE_FEATURE_BYTES);
  const large = sized.filter((entry) => entry.bytes > LARGE_FEATURE_BYTES).sort((a, b) => a.bytes - b.bytes);
  let uploaded = 0;

  let batch = [];
  let batchBytes = 0;
  const flush = async () => {
    if (!batch.length) return;
    await healthy();
    await rest("zone_ingest_features", { method: "POST", prefer: "return=minimal", body: batch.map(rowFor) });
    uploaded += batch.length;
    console.log(`  uploaded ${uploaded}/${features.length}`);
    batch = [];
    batchBytes = 0;
  };
  for (const { feature, bytes } of small) {
    if (batch.length && batchBytes + bytes > BATCH_BYTES) await flush();
    batch.push(feature);
    batchBytes += bytes;
  }
  await flush();

  for (const { feature, bytes } of large) {
    const ewkb = multiPolygonToEwkb(feature.geometry);
    const chunks = base64Chunks(ewkb, 600_000);
    const counts = geometryCounts(feature.geometry);
    await healthy();
    for (let index = 0; index < chunks.length; index += 1) {
      await rest("zone_ingest_feature_chunks", {
        method: "POST",
        prefer: "return=minimal",
        body: [{ run_id: run.id, source_feature_id: feature.sourceFeatureId, chunk_index: index, payload: chunks[index] }],
      });
    }
    const row = rowFor(feature);
    const assembled = await rest("rpc/assemble_zone_ingest_feature", {
      method: "POST",
      body: {
        p_run_id: run.id,
        p_source_feature_id: row.source_feature_id,
        p_official_identifier: row.official_identifier,
        p_canonical_id: row.canonical_id,
        p_official_name: row.official_name,
        p_attributes: row.attributes,
        p_chunk_count: chunks.length,
        p_expected_points: counts.points,
        p_expected_polygons: counts.polygons,
      },
    });
    uploaded += 1;
    console.log(
      `  uploaded ${uploaded}/${features.length}  ${feature.officialIdentifier}: ${(bytes / 1e6).toFixed(1)} MB as ` +
        `${chunks.length} EWKB chunk(s), ${assembled.points} vertices in ${assembled.polygons} polygon(s) confirmed`,
    );
    // Let the database settle after a large write before the next one.
    await new Promise((resolve) => setTimeout(resolve, Math.min(30_000, 2_000 * Math.ceil(bytes / 1e6))));
  }

  /* Check each ordinary-sized authority geometry independently. Québec's layer
     also contains continent-scale features; scanning all of them in one REST
     statement can exceed the statement timeout before it reaches a small bad
     feature. The targeted RPC repairs only a topologically lossless defect (at
     most one square metre of symmetric difference) and otherwise raises. Huge
     features remain protected by publish_zone_run's validity gate. */
  const normalized = [];
  let normalizationCursor = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (normalizationCursor < small.length) {
      const { feature } = small[normalizationCursor++];
      const result = await rest("rpc/normalize_zone_ingest_geometry", {
        method: "POST",
        body: { p_run_id: run.id, p_source_feature_id: feature.sourceFeatureId },
      });
      if (result.normalized) normalized.push(result);
    }
  }));
  /* Large features are checked too, one at a time and after the rest.
     Newfoundland publishes four of its seven black bear areas with ring
     self-intersections, and refusing to look at them would leave the province
     unpublishable. The same lossless guard applies, a repair that cannot finish
     inside the statement timeout fails closed, and publish_zone_run's validity
     gate still stands behind this. */
  for (const { feature } of large) {
    const result = await rest("rpc/normalize_zone_ingest_geometry", {
      method: "POST",
      body: { p_run_id: run.id, p_source_feature_id: feature.sourceFeatureId },
    });
    if (result.normalized) normalized.push(result);
  }
  if (normalized.length) {
    console.log("");
    console.log(`Normalized ${normalized.length} invalid authority geometr${normalized.length === 1 ? "y" : "ies"}:`);
    for (const item of normalized.sort((left, right) => left.sourceFeatureId.localeCompare(right.sourceFeatureId))) {
      console.log(
        `  ${item.sourceFeatureId}: ${item.authorityValidityError}; ` +
          `${item.symmetricDifferenceSquareMetres} m² symmetric difference`,
      );
    }
  }

  /* The comparison validates and measures every staged feature in one
     statement. For a layer with a very large feature that can exceed the REST
     timeout; the run is staged either way, and the comparison is then run
     server-side, feature by feature. */
  let comparison;
  try {
    await healthy();
    comparison = await rest("rpc/compare_zone_run", { method: "POST", body: { p_run_id: run.id } });
  } catch (error) {
    console.log("");
    console.log(`Staged run ${run.id}, but the comparison did not complete over REST: ${error.message.slice(0, 160)}`);
    console.log("Run compare_zone_run for this run server-side before publishing.");
    return;
  }
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
