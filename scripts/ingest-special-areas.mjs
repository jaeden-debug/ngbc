#!/usr/bin/env node
/**
 * Store an authority's restricted-area layers as regulatory special areas.
 *
 *   node scripts/ingest-special-areas.mjs --jurisdiction ca-mb            load
 *   node scripts/ingest-special-areas.mjs --jurisdiction ca-mb --check    change watch
 *   ... --layer wmas                                                     one layer only
 *
 * Only layers whose licence permits redistribution are listed here. Each layer
 * is read in full from the authority's own service and checked against the
 * committed, reviewed catalogue: the same record ids, the same count. The
 * restriction text stored is the catalogue's reviewed text; the builder's own
 * `--check` already fails when the authority's text changes. A layer that does
 * not match is refused, and nothing of it is loaded.
 *
 * `--check` is the change watch. It compares each stored layer with the
 * authority's current records (ids, geometry hash, and the service's own
 * dataLastEditDate). A layer that moved is marked NEEDS_REVIEW, which stops
 * Hunt reading it; Hunt then asks the live service until the layer is reloaded
 * after review. Exit 1 when anything moved.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const LAYERS = {
  "ca-mb": {
    jurisdictionId: "jurisdiction:ca-mb",
    catalogue: "content/regulatory/ca-mb-overlays.json",
    licence: "OpenMB Information and Data Use Licence. Contains information from the Manitoba government, licensed under the OpenMB Information and Data Use Licence (Manitoba.ca/OpenMB).",
  },
};

const BATCH_RECORDS = 15;
const BATCH_BYTES = 400 * 1024;

const sha256 = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`;

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

async function json(url, init) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(120_000) });
      const text = await response.text();
      if (!response.ok) throw new Error(`${response.status} from ${url.split("?")[0]}: ${text.slice(0, 200)}`);
      const payload = text ? JSON.parse(text) : null;
      if (payload?.error) throw new Error(`${JSON.stringify(payload.error)} from ${url.split("?")[0]}`);
      return payload;
    } catch (error) {
      if (attempt >= 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
    }
  }
}

/** Every record of an ArcGIS layer at full resolution, in WGS 84, ordered by OBJECTID. */
async function authorityLayer(url) {
  const info = await json(`${url}?f=json`);
  const features = [];
  for (let offset = 0; ; offset += 1000) {
    const parameters = new URLSearchParams({
      where: "1=1", outFields: "OBJECTID", outSR: "4326", orderByFields: "OBJECTID",
      resultOffset: String(offset), resultRecordCount: "1000", f: "geojson",
    });
    const page = await json(`${url}/query?${parameters}`);
    features.push(...(page.features ?? []));
    if (!(page.properties?.exceededTransferLimit || page.exceededTransferLimit)) break;
  }
  const edited = info.editingInfo?.dataLastEditDate ?? info.editingInfo?.lastEditDate;
  return { features, dataLastEditDate: edited ? new Date(edited).toISOString() : null };
}

function recordsHash(features) {
  return sha256(JSON.stringify(features
    .map((feature) => [String(feature.properties?.OBJECTID ?? feature.id), feature.geometry])
    .sort(([a], [b]) => Number(a) - Number(b))));
}

async function main() {
  const args = process.argv.slice(2);
  const jurisdiction = args[args.indexOf("--jurisdiction") + 1];
  const config = LAYERS[jurisdiction];
  if (!config) throw new Error(`Use --jurisdiction ${Object.keys(LAYERS).join("|")}`);
  const check = args.includes("--check");
  const catalogue = JSON.parse(readFileSync(config.catalogue, "utf8"));
  if (catalogue.jurisdictionId !== config.jurisdictionId) throw new Error("Catalogue is for another jurisdiction");
  const { url, key } = loadEnv();
  const headers = { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" };
  const rpc = (name, body) => json(`${url}/rest/v1/rpc/${name}`, { method: "POST", headers, body: JSON.stringify(body) });

  const only = args.includes("--layer") ? args[args.indexOf("--layer") + 1] : null;
  if (only && !catalogue.layers.some((layer) => layer.key === only)) throw new Error(`No layer "${only}" in ${config.catalogue}`);
  if (!check) {
    const removed = await rpc("discard_abandoned_special_area_runs", {});
    if (removed) console.log(`discarded ${removed} abandoned run(s)`);
  }
  let moved = 0;
  for (const layer of catalogue.layers.filter((entry) => !only || entry.key === only)) {
    const layerId = `special_layer:${jurisdiction}-${layer.key}`;
    const { features, dataLastEditDate } = await authorityLayer(layer.url);
    const ids = features.map((feature) => Number(feature.properties?.OBJECTID ?? feature.id));
    const reviewed = layer.features.map((feature) => feature.objectId);
    const sameIds = ids.length === reviewed.length && [...ids].sort((a, b) => a - b).join(",") === [...reviewed].sort((a, b) => a - b).join(",");
    const sourceHash = recordsHash(features);

    if (check) {
      const stored = await json(`${url}/rest/v1/regulatory_special_area_layers?layer_id=eq.${encodeURIComponent(layerId)}&select=source_hash,catalogue_hash,data_last_edit_date,status`, { headers });
      const row = stored?.[0];
      const reasons = [];
      if (!row) reasons.push("not stored");
      else {
        if (!sameIds) reasons.push("the authority's record ids no longer match the reviewed catalogue");
        if (row.source_hash !== sourceHash) reasons.push("the authority's geometry changed");
        if (row.catalogue_hash !== layer.contentHash) reasons.push("the stored copy was loaded against another catalogue");
        if (dataLastEditDate && row.data_last_edit_date && new Date(row.data_last_edit_date).getTime() !== new Date(dataLastEditDate).getTime()) {
          reasons.push(`the service reports an edit on ${dataLastEditDate}`);
        }
      }
      if (reasons.length) {
        moved += 1;
        if (row && row.status === "CURRENT") await rpc("mark_special_area_layer", { p_layer_id: layerId, p_status: "NEEDS_REVIEW", p_reason: reasons.join("; ") });
        console.log(`${layerId}: MOVED — ${reasons.join("; ")}`);
      } else {
        console.log(`${layerId}: unchanged (${features.length} records, ${sourceHash.slice(0, 19)}…)`);
      }
      continue;
    }

    if (!sameIds) throw new Error(`${layerId}: the authority serves ${ids.length} records whose ids differ from the ${reviewed.length} reviewed; rebuild and review the catalogue first`);
    if (features.some((feature) => !feature.geometry)) throw new Error(`${layerId}: a record has no geometry`);
    const byId = new Map(layer.features.map((feature) => [feature.objectId, feature]));
    const records = features.map((feature) => {
      const id = Number(feature.properties?.OBJECTID ?? feature.id);
      const reviewedFeature = byId.get(id);
      return {
        sourceRecordId: String(id),
        name: reviewedFeature.name + (reviewedFeature.type ? ` ${reviewedFeature.type}` : ""),
        restrictionText: reviewedFeature.statedAs,
        legalStanding: { kind: "AUTHORITY_LAYER", statedAs: reviewedFeature.regulation ?? null, sourceId: layer.sourceId },
        attributes: {},
        geometry: JSON.stringify(feature.geometry),
      };
    });
    // Staged in small batches: one request per layer would exceed the 8-second
    // statement timeout on large layers, and the polygons are never simplified.
    const runId = await rpc("begin_special_area_run", {
      p_layer: {
        layerId, jurisdictionId: config.jurisdictionId, sourceId: layer.sourceId, serviceUrl: layer.url, licence: config.licence,
        catalogueHash: layer.contentHash, sourceHash, featureCount: records.length, dataLastEditDate, retrievedAt: new Date().toISOString(),
      },
      p_reviewed_ids: reviewed.map(String),
    });
    let batch = [];
    let bytes = 0;
    const flush = async () => {
      if (!batch.length) return;
      const started = Date.now();
      await rpc("stage_special_area_records", { p_run_id: runId, p_features: batch });
      console.log(`  staged ${batch.length} (${(bytes / 1024).toFixed(0)} KB) in ${Date.now() - started} ms`);
      batch = [];
      bytes = 0;
    };
    for (const record of records) {
      if (batch.length && (batch.length >= BATCH_RECORDS || bytes + record.geometry.length > BATCH_BYTES)) await flush();
      batch.push(record);
      bytes += record.geometry.length;
    }
    await flush();
    const loaded = await rpc("publish_special_area_run", { p_run_id: runId });
    console.log(`${layerId}: stored ${loaded} records (${sourceHash.slice(0, 19)}…)`);
  }
  if (check && moved) process.exit(1);
}

main().catch((error) => {
  console.error(`Special areas: ${error.message}`);
  process.exit(1);
});
