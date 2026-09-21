#!/usr/bin/env node
/**
 * Which published special areas lie inside each management zone.
 *
 * A point answer asks the authority's refuge, conservation-area, WMA and
 * closed-lands layers which features contain the point. A zone card has no
 * point, so it needs the same thing for the whole zone: which of those features
 * overlap it at all. This asks the authority itself, zone by zone, with the
 * zone's full-resolution polygon from the authority's own zone layer:
 *
 *   inside = features that intersect the zone − features that only touch its edge
 *
 * so a refuge lying against a zone line is not attributed to the zone next door.
 * The result is committed, so zone cards stay deterministic and offline-testable,
 * and `--check` fails when the authority's layers have moved since the index was
 * built.
 *
 *   node scripts/build-overlay-zone-index.mjs            rebuild
 *   node scripts/build-overlay-zone-index.mjs --check    exit 1 if it would change
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const JURISDICTIONS = [
  {
    jurisdictionId: "jurisdiction:ca-mb",
    catalogue: "content/regulatory/ca-mb-overlays.json",
    output: "content/regulatory/ca-mb-overlay-zones.json",
    zoneService: "https://services.arcgis.com/mMUesHYPkXjaFGfS/arcgis/rest/services/Manitoba_Game_Hunting_Areas/FeatureServer/0",
    designationField: "GHA",
    timeZone: "America/Winnipeg",
  },
];

const check = process.argv.includes("--check");

async function json(url, init) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error(`${response.status} from ${url}`);
      const payload = await response.json();
      if (payload.error) throw new Error(`${JSON.stringify(payload.error)} from ${url}`);
      return payload;
    } catch (error) {
      if (attempt >= 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 1_500));
    }
  }
}

async function zones(config) {
  const payload = await json(`${config.zoneService}/query?${new URLSearchParams({
    where: "1=1", outFields: config.designationField, returnGeometry: "true", outSR: "4326", f: "json",
  })}`);
  const byDesignation = new Map();
  for (const feature of payload.features ?? []) {
    const raw = feature.attributes?.[config.designationField];
    const designation = typeof raw === "string" ? raw.trim() : raw == null ? "" : String(raw);
    // A blank record is not a zone (Manitoba's Riding Mountain National Park polygon).
    if (!designation || !feature.geometry?.rings?.length) continue;
    byDesignation.set(designation, [...(byDesignation.get(designation) ?? []), ...feature.geometry.rings]);
  }
  return byDesignation;
}

async function idsInside(layerUrl, rings) {
  const ask = async (spatialRel) => {
    const body = new URLSearchParams({
      where: "1=1",
      geometry: JSON.stringify({ rings, spatialReference: { wkid: 4326 } }),
      geometryType: "esriGeometryPolygon",
      inSR: "4326",
      spatialRel,
      returnIdsOnly: "true",
      f: "json",
    });
    const payload = await json(`${layerUrl}/query`, { method: "POST", body });
    if (payload.objectIds !== null && !Array.isArray(payload.objectIds)) throw new Error(`Unexpected response from ${layerUrl}`);
    return new Set(payload.objectIds ?? []);
  };
  const [intersects, touches] = await Promise.all([ask("esriSpatialRelIntersects"), ask("esriSpatialRelTouches")]);
  return [...intersects].filter((id) => !touches.has(id)).sort((a, b) => a - b);
}

function jurisdictionDay(timeZone) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

let drift = false;
for (const config of JURISDICTIONS) {
  const catalogue = JSON.parse(readFileSync(config.catalogue, "utf8"));
  const zoneGeometry = await zones(config);
  const index = {};
  for (const designation of [...zoneGeometry.keys()].sort((a, b) => a.localeCompare(b, "en", { numeric: true }))) {
    const rings = zoneGeometry.get(designation);
    const inside = [];
    for (const layer of catalogue.layers) {
      for (const objectId of await idsInside(layer.url, rings)) inside.push({ layer: layer.key, objectId });
    }
    index[designation] = inside;
  }

  const content = {
    jurisdictionId: config.jurisdictionId,
    zoneService: config.zoneService,
    layers: catalogue.layers.map((layer) => ({ key: layer.key, url: layer.url, sourceId: layer.sourceId })),
    zones: index,
  };
  const contentHash = `sha256:${createHash("sha256").update(JSON.stringify(content)).digest("hex")}`;
  const previous = existsSync(config.output) ? JSON.parse(readFileSync(config.output, "utf8")) : null;
  const unchanged = previous?.contentHash === contentHash;
  const built = {
    generatedBy: "scripts/build-overlay-zone-index.mjs",
    purpose:
      "Which of the authority's published special areas overlap each zone (intersecting, not merely touching its edge), " +
      "so a whole-zone answer can say which areas inside it restrict a hunt. Read from the authority's own layers.",
    // Moves only when the content moves: re-reading an unchanged index is not new information.
    retrievedAt: unchanged ? previous.retrievedAt : jurisdictionDay(config.timeZone),
    contentHash,
    ...content,
  };
  const zonesWithAreas = Object.values(index).filter((entries) => entries.length).length;
  console.log(`${config.jurisdictionId}: ${Object.keys(index).length} zones, ${zonesWithAreas} with special areas inside`);
  if (check) {
    if (!unchanged) {
      drift = true;
      console.error(`${config.output} is out of date with the authority's layers; rebuild and review the change.`);
    }
  } else {
    writeFileSync(config.output, `${JSON.stringify(built, null, 2)}\n`);
  }
}
process.exit(drift ? 1 : 0);
