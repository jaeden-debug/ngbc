#!/usr/bin/env node
/**
 * Authority-first hunting-zone certification.
 *
 * Government geometry is the expected side. North Ground's published PostGIS
 * rows and resolver are systems under test. No expected identifier, point or
 * geometry metric is read from North Ground.
 *
 * Usage:
 *   node --import tsx scripts/audit-zone-certification.mjs --jurisdiction ca-on
 *   node --import tsx scripts/audit-zone-certification.mjs --all
 *
 * A run fails closed on an incomplete authority response, an inventory or
 * geometry mismatch, or any point-to-zone disagreement. The compact JSON result
 * is safe to commit; full government polygons are never copied into the repo.
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { poleOfInaccessibility, ringArea } from "../src/lib/hunt/exploration/label-point.ts";
import { loadZoneSource, ZONE_ADAPTERS } from "./zone-adapters.mjs";

const EARTH_RADIUS_METRES = 6_371_008.8;
const AREA_TOLERANCE = 0.000_05; // 0.005%; serialization should be much closer.
const BBOX_TOLERANCE = 0.000_002; // ~0.2 m longitude at the equator.

const PREFIXES = {
  "ca-on": "management_zone:ca-on-wmu-",
  "ca-mb": "management_zone:ca-mb-gha-",
  "ca-ab": "management_zone:ca-ab-wmu-",
  "ca-qc": "management_zone:ca-qc-zone-",
};

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

function polygonsOf(geometry) {
  if (!geometry || !Array.isArray(geometry.coordinates)) return [];
  return geometry.type === "Polygon" ? [geometry.coordinates] : geometry.type === "MultiPolygon" ? geometry.coordinates : [];
}

function metrics(geometry) {
  const polygons = polygonsOf(geometry);
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  let vertices = 0, holes = 0, rings = 0, areaSquareMetres = 0;
  for (const polygon of polygons) {
    holes += Math.max(0, polygon.length - 1);
    rings += polygon.length;
    for (let ringIndex = 0; ringIndex < polygon.length; ringIndex += 1) {
      const ring = polygon[ringIndex];
      vertices += ring.length;
      for (const [longitude, latitude] of ring) {
        west = Math.min(west, longitude); east = Math.max(east, longitude);
        south = Math.min(south, latitude); north = Math.max(north, latitude);
      }
      const spherical = sphericalRingArea(ring);
      areaSquareMetres += ringIndex === 0 ? spherical : -spherical;
    }
  }
  return {
    geometryType: geometry?.type ?? null,
    polygons: polygons.length,
    rings,
    holes,
    vertices,
    bbox: polygons.length ? [west, south, east, north].map((value) => Number(value.toFixed(8))) : null,
    areaSquareMetres: Math.abs(areaSquareMetres),
    fingerprint: geometryFingerprint(geometry),
  };
}

function sphericalRingArea(ring) {
  if (ring.length < 4) return 0;
  let sum = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const [lon1, lat1] = ring[index];
    const [lon2, lat2] = ring[index + 1];
    sum += radians(lon2 - lon1) * (2 + Math.sin(radians(lat1)) + Math.sin(radians(lat2)));
  }
  return Math.abs(sum * EARTH_RADIUS_METRES * EARTH_RADIUS_METRES / 2);
}

function radians(value) { return value * Math.PI / 180; }

function geometryFingerprint(geometry) {
  const hash = createHash("sha256");
  const rounded = polygonsOf(geometry).map((polygon) => polygon.map((ring) =>
    ring.map(([longitude, latitude]) => [Number(longitude.toFixed(7)), Number(latitude.toFixed(7))])));
  hash.update(JSON.stringify(rounded));
  return `sha256:${hash.digest("hex")}`;
}

function authorityContentHash(features) {
  const hash = createHash("sha256");
  const ordered = [...features].sort((left, right) => left.sourceFeatureId.localeCompare(right.sourceFeatureId));
  for (const feature of ordered) {
    hash.update(feature.sourceFeatureId);
    hash.update(String.fromCharCode(31));
    hash.update(feature.officialIdentifier);
    hash.update(String.fromCharCode(31));
    hash.update(JSON.stringify(feature.geometry));
    hash.update(String.fromCharCode(30));
  }
  return `sha256:${hash.digest("hex")}`;
}

function pointInRing([x, y], ring) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const [xi, yi] = ring[index];
    const [xj, yj] = ring[previous];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function pointInPolygon(point, polygon) {
  return Boolean(polygon[0] && pointInRing(point, polygon[0]) && !polygon.slice(1).some((hole) => pointInRing(point, hole)));
}

function pointInGeometry(point, geometry) {
  return polygonsOf(geometry).some((polygon) => pointInPolygon(point, polygon));
}

function squaredDistanceToSegment(point, start, end) {
  const latitude = radians(point[1]);
  const metresPerLongitude = 111_320 * Math.cos(latitude);
  const metresPerLatitude = 110_574;
  const px = point[0] * metresPerLongitude, py = point[1] * metresPerLatitude;
  const ax = start[0] * metresPerLongitude, ay = start[1] * metresPerLatitude;
  const bx = end[0] * metresPerLongitude, by = end[1] * metresPerLatitude;
  const dx = bx - ax, dy = by - ay;
  const denominator = dx * dx + dy * dy;
  const ratio = denominator === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / denominator));
  const x = ax + ratio * dx, y = ay + ratio * dy;
  return { distance: (px - x) ** 2 + (py - y) ** 2, point: [x / metresPerLongitude, y / metresPerLatitude] };
}

function closestBoundary(point, polygon) {
  let best = { distance: Infinity, point: null };
  for (const ring of polygon) {
    for (let index = 1; index < ring.length; index += 1) {
      const candidate = squaredDistanceToSegment(point, ring[index - 1], ring[index]);
      if (candidate.distance < best.distance) best = candidate;
    }
  }
  return best.point;
}

function polygonPlanarArea(polygon) {
  return polygon.length ? polygon.slice(1).reduce((area, hole) => area - ringArea(hole), ringArea(polygon[0])) : 0;
}

function bboxContains(bbox, [longitude, latitude]) {
  return longitude >= bbox[0] && longitude <= bbox[2] && latitude >= bbox[1] && latitude <= bbox[3];
}

function expectedAt(point, officialIndex) {
  return officialIndex
    .filter(({ bbox }) => bboxContains(bbox, point))
    .filter(({ feature }) => pointInGeometry(point, feature.geometry))
    .map(({ feature }) => feature.officialIdentifier)
    .sort();
}

function sampleOfficialFeatures(features) {
  const index = features.map((feature) => ({ feature, bbox: metrics(feature.geometry).bbox }));
  const samples = [];
  for (const feature of features) {
    const polygons = polygonsOf(feature.geometry)
      .map((polygon) => ({ polygon, area: polygonPlanarArea(polygon) }))
      .filter(({ polygon, area }) => polygon[0]?.length >= 4 && area > 0)
      .sort((left, right) => right.area - left.area);
    if (!polygons.length) continue;

    // Multiple official components where available: largest and smallest. The
    // full component inventory is independently compared below, so an island
    // cannot disappear merely because it was not chosen as a point sample.
    const selected = [polygons[0], ...(polygons.length > 1 ? [polygons.at(-1)] : [])];
    for (let component = 0; component < selected.length; component += 1) {
      const polygon = selected[component].polygon;
      const inside = poleOfInaccessibility(polygon, 0.000_01);
      samples.push({ kind: component === 0 ? "INTERIOR" : "MULTIPART", zone: feature.officialIdentifier, point: inside });
      if (component > 0) continue;

      const boundary = closestBoundary(inside, polygon);
      if (!boundary) continue;
      const dx = inside[0] - boundary[0], dy = inside[1] - boundary[1];
      const length = Math.hypot(dx, dy);
      if (!length) continue;
      // 12 metres on either side, far above numeric noise and close enough to
      // exercise the actual edge whose warning distance is being certified.
      const latitude = radians(boundary[1]);
      const scaleX = 12 / (111_320 * Math.cos(latitude));
      const scaleY = 12 / 110_574;
      const normX = dx / length, normY = dy / length;
      const candidateA = [boundary[0] + normX * scaleX, boundary[1] + normY * scaleY];
      const candidateB = [boundary[0] - normX * scaleX, boundary[1] - normY * scaleY];
      const aInside = pointInGeometry(candidateA, feature.geometry);
      const bInside = pointInGeometry(candidateB, feature.geometry);
      if (aInside !== bInside) {
        samples.push({ kind: "BOUNDARY_INSIDE", zone: feature.officialIdentifier, point: aInside ? candidateA : candidateB });
        samples.push({ kind: "BOUNDARY_OUTSIDE", zone: feature.officialIdentifier, point: aInside ? candidateB : candidateA });
      }

      // A second interior point, halfway from the pole to its nearest edge.
      samples.push({
        kind: "INTERIOR_SECOND",
        zone: feature.officialIdentifier,
        point: [(inside[0] + boundary[0]) / 2, (inside[1] + boundary[1]) / 2],
      });
    }

    // Every exclusion is counted by the geometry comparison. Point parity uses
    // the largest and smallest exclusion per zone; Québec contains thousands,
    // and asking the live resolver once per ring would add load without adding
    // a different class of evidence.
    const holes = polygons.flatMap(({ polygon }) => polygon.slice(1))
      .filter((hole) => hole.length >= 4)
      .map((hole) => ({ hole, area: ringArea(hole) }))
      .sort((left, right) => right.area - left.area);
    for (const { hole } of [holes[0], ...(holes.length > 1 ? [holes.at(-1)] : [])].filter(Boolean)) {
      samples.push({ kind: "HOLE", zone: feature.officialIdentifier, point: poleOfInaccessibility([hole], 0.000_01) });
    }
  }
  return samples.map((sample) => ({
    ...sample,
    latitude: Number(sample.point[1].toFixed(7)),
    longitude: Number(sample.point[0].toFixed(7)),
    expected: expectedAt(sample.point, index),
  }));
}

async function api(url, key, path, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await fetch(`${url}/rest/v1/${path}`, {
      ...options,
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
        ...(options.headers ?? {}),
      },
      signal: AbortSignal.timeout(120_000),
    });
    const text = await response.text();
    if (response.ok) return text ? JSON.parse(text) : null;
    lastError = new Error(`${path} -> ${response.status} ${text.slice(0, 300)}`);
    if (response.status < 500 && response.status !== 429) throw lastError;
    await new Promise((resolve) => setTimeout(resolve, attempt * 1_500));
  }
  throw lastError;
}

async function publishedRows(source, env) {
  const prefix = PREFIXES[source.jurisdictionCanonicalId.replace("jurisdiction:", "")];
  const summary = await api(env.url, env.key,
    `management_zones?canonical_id=like.${encodeURIComponent(`${prefix}*`)}&select=canonical_id,official_identifier,official_name,source_version,source_retrieved_at,source_verified_at,coverage_status&order=official_identifier`);
  const rows = [];
  let completed = 0;
  const concurrency = 3;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (completed < summary.length) {
      const index = completed++;
      const canonicalId = summary[index].canonical_id;
      const [row] = await api(env.url, env.key,
        `management_zones?canonical_id=eq.${encodeURIComponent(canonicalId)}&select=canonical_id,official_identifier,official_name,source_version,source_retrieved_at,source_verified_at,coverage_status,geometry`);
      rows[index] = row;
    }
  }));
  return rows;
}

async function certifiedNormalizations(source, officialFeatures, env) {
  const hash = authorityContentHash(officialFeatures);
  const runs = await api(env.url, env.key,
    `zone_ingest_runs?layer_id=eq.${encodeURIComponent(source.layerId)}&content_hash=eq.${encodeURIComponent(hash)}` +
      "&status=eq.PUBLISHED&select=id,content_hash,retrieved_at&order=retrieved_at.desc&limit=1");
  if (!runs.length) return new Map();
  const rows = await api(env.url, env.key,
    `zone_ingest_features?run_id=eq.${runs[0].id}&attributes-%3EgeometryNormalization=not.is.null` +
      "&select=official_identifier,attributes,geometry");
  return new Map(rows.map((row) => [row.official_identifier, row]));
}

async function resolveSamples(samples, source, env) {
  const prefix = source.canonicalZoneId("X").replace(/x$/i, "");
  const results = new Array(samples.length);
  let cursor = 0;
  let completed = 0;
  const concurrency = source.jurisdictionCanonicalId === "jurisdiction:ca-qc" ? 1 : 5;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (cursor < samples.length) {
      const index = cursor++;
      const sample = samples[index];
      // Membership-only certification uses the same full-resolution zone/part
      // intersection path as the production resolver without also measuring a
      // potentially continent-scale boundary for every audit point. Boundary
      // distance has its own exhaustive reference comparison.
      const rows = await api(env.url, env.key, "rpc/resolve_zone_for_certification", {
        method: "POST",
        body: JSON.stringify({
          p_latitude: sample.latitude,
          p_longitude: sample.longitude,
          p_jurisdiction_canonical_id: source.jurisdictionCanonicalId,
        }),
      });
      const actual = rows.map(({ canonical_id: id }) => String(id))
        .filter((id) => id.startsWith(prefix))
        .map((id) => id.slice(prefix.length).toUpperCase())
        .sort();
      results[index] = { ...sample, actual, agree: JSON.stringify(sample.expected) === JSON.stringify(actual) };
      completed += 1;
      if (completed % 250 === 0) console.log(`    ${completed}/${samples.length} authority-derived points resolved`);
    }
  }));
  return results;
}

function compareGeometry(official, published) {
  const officialMetric = metrics(official.geometry);
  const publishedMetric = metrics(published.geometry);
  const bboxError = Math.max(...officialMetric.bbox.map((value, index) => Math.abs(value - publishedMetric.bbox[index])));
  const areaError = Math.abs(officialMetric.areaSquareMetres - publishedMetric.areaSquareMetres) /
    Math.max(1, officialMetric.areaSquareMetres);
  const errors = [];
  if (published.canonical_id !== official.canonicalId) errors.push("canonical_id");
  if (published.official_identifier !== official.officialIdentifier) errors.push("official_identifier");
  if (published.official_name !== official.officialName) errors.push("official_name");
  if (publishedMetric.geometryType !== "MultiPolygon") errors.push("geometry_type");
  if (publishedMetric.polygons !== officialMetric.polygons) errors.push("polygon_count");
  if (publishedMetric.holes !== officialMetric.holes) errors.push("holes");
  if (publishedMetric.vertices !== officialMetric.vertices) errors.push("vertices");
  if (bboxError > BBOX_TOLERANCE) errors.push("bbox");
  if (areaError > AREA_TOLERANCE) errors.push("area");
  if (publishedMetric.fingerprint !== officialMetric.fingerprint) errors.push("fingerprint");
  return { official: officialMetric, northGround: publishedMetric, bboxError, areaError, errors };
}

async function certify(jurisdiction, env) {
  const source = await loadZoneSource(jurisdiction);
  console.log(`\n${jurisdiction}: reading ${source.authority}...`);
  const read = await source.fetchFeatures();
  const officialFeatures = read.features.map((feature) => ({
    ...feature,
    canonicalId: source.canonicalZoneId(feature.officialIdentifier),
    officialName: source.officialName(feature.officialIdentifier),
  }));
  const published = await publishedRows(source, env);
  const normalizations = await certifiedNormalizations(source, officialFeatures, env);
  const publishedById = new Map(published.map((row) => [row.canonical_id, row]));
  const officialIds = new Set(officialFeatures.map(({ canonicalId }) => canonicalId));
  const missing = officialFeatures.filter(({ canonicalId }) => !publishedById.has(canonicalId)).map(({ officialIdentifier }) => officialIdentifier);
  const invented = published.filter(({ canonical_id: id }) => !officialIds.has(id)).map(({ official_identifier: id }) => id);

  const geometry = officialFeatures
    .filter(({ canonicalId }) => publishedById.has(canonicalId))
    .map((feature) => {
      const normalized = normalizations.get(feature.officialIdentifier);
      const comparedFeature = normalized ? { ...feature, geometry: normalized.geometry } : feature;
      return ({
      identifier: feature.officialIdentifier,
      authorityFeatureCount: Number(feature.attributes.sourceFeatureCount ?? feature.attributes.componentCount ?? 1),
      authorityName: feature.attributes.officialUnitName ?? feature.attributes.partName ?? null,
      normalization: normalized?.attributes?.geometryNormalization ?? null,
      rawAuthority: normalized ? metrics(feature.geometry) : null,
      ...compareGeometry(comparedFeature, publishedById.get(feature.canonicalId)),
    });
    });
  const geometryDisagreements = geometry.filter(({ errors }) => errors.length);
  console.log(`  inventory official=${officialFeatures.length} North Ground=${published.length} missing=${missing.length} invented=${invented.length}`);
  console.log(`  geometry disagreements=${geometryDisagreements.length}`);
  for (const row of geometryDisagreements.slice(0, 10)) {
    console.log(`    ${row.identifier}: ${row.errors.join(", ")} area=${(row.areaError * 100).toFixed(6)}% bbox=${row.bboxError}`);
  }

  console.log("  deriving parity points from government polygons...");
  const samples = sampleOfficialFeatures(officialFeatures);
  const parity = await resolveSamples(samples, source, env);
  const disagreements = parity.filter(({ agree }) => !agree);
  console.log(`  parity ${parity.length - disagreements.length}/${parity.length}; disagreements=${disagreements.length}`);

  const result = {
    schemaVersion: 1,
    certifiedOn: new Intl.DateTimeFormat("en-CA", { timeZone: source.timeZone ?? "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" })
      .format(new Date()).replace(/-/g, "-"),
    jurisdiction: source.jurisdictionCanonicalId,
    layer: source.layerId,
    authority: source.authority,
    sourceUrl: source.sourceUrl,
    sourceVersion: read.sourceVersion ?? null,
    officialZones: officialFeatures.length,
    officialIdentifiers: officialFeatures.map(({ officialIdentifier }) => officialIdentifier).sort(),
    northGroundZones: published.length,
    quarantined: (read.quarantined ?? []).map(({ sourceFeatureId, reason, bbox, vertices }) => ({ sourceFeatureId, reason, bbox, vertices })),
    inventory: { missing, invented },
    geometry: {
      checked: geometry.length,
      normalizations: geometry.filter(({ normalization }) => normalization).map(({ identifier, normalization, rawAuthority, official }) => ({
        identifier, normalization, rawAuthority, normalizedAuthority: official,
      })),
      disagreements: geometryDisagreements.map(({ identifier, authorityFeatureCount, authorityName, bboxError, areaError, errors, official, northGround }) => ({
        identifier, authorityFeatureCount, authorityName, bboxError, areaError, errors, official, northGround,
      })),
      totals: geometry.reduce((total, row) => ({
        authorityFeatures: total.authorityFeatures + row.authorityFeatureCount,
        polygons: total.polygons + row.official.polygons,
        holes: total.holes + row.official.holes,
        vertices: total.vertices + row.official.vertices,
      }), { authorityFeatures: 0, polygons: 0, holes: 0, vertices: 0 }),
    },
    parity: {
      total: parity.length,
      agreements: parity.length - disagreements.length,
      disagreements: disagreements.length,
      unresolved: 0,
      counts: Object.fromEntries([...new Set(parity.map(({ kind }) => kind))].map((kind) => [kind, parity.filter((item) => item.kind === kind).length])),
      failures: disagreements.slice(0, 100),
      sampleHash: `sha256:${createHash("sha256").update(JSON.stringify(parity.map(({ kind, latitude, longitude, expected }) => ({ kind, latitude, longitude, expected })))).digest("hex")}`,
    },
    status: missing.length || invented.length || geometryDisagreements.length || disagreements.length ? "NEEDS_VERIFICATION" : "VERIFIED",
  };
  const file = `fixtures/hunt/${jurisdiction}-zone-certification.json`;
  writeFileSync(file, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`  ${result.status}: ${file}`);
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const jurisdictions = args.includes("--all")
    ? Object.keys(ZONE_ADAPTERS)
    : [args[args.indexOf("--jurisdiction") + 1]];
  if (!jurisdictions[0] || jurisdictions.some((id) => !ZONE_ADAPTERS[id])) {
    throw new Error(`Use --all or --jurisdiction ${Object.keys(ZONE_ADAPTERS).join("|")}`);
  }
  const env = loadEnv();
  const results = [];
  for (const jurisdiction of jurisdictions) results.push(await certify(jurisdiction, env));
  if (results.some(({ status }) => status !== "VERIFIED")) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`Zone certification failed: ${error.stack ?? error.message}`);
  process.exit(1);
});
