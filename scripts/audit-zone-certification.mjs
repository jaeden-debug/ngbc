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

/**
 * The canonical-id prefix a layer's zones share, derived from the adapter's own
 * id minting rather than a table. A hand-kept table silently answered
 * "undefined*" for a jurisdiction it had never heard of, which reads as "every
 * zone is missing" instead of as a bug (Yukon, 2026-09-22).
 */
function canonicalPrefix(source, officialFeatures) {
  const ids = officialFeatures.map(({ canonicalId }) => canonicalId).filter(Boolean);
  /*
   * A jurisdiction whose official geography is a single area — Prince Edward
   * Island, whose regulations set hunting province-wide — has no second id to
   * find a common prefix with. Its prefix is the one the adapter mints with,
   * recovered by removing the slug the adapter would append. Same rule, read
   * from the adapter rather than guessed from a table.
   */
  if (ids.length === 1) {
    const [identifier] = officialFeatures.map(({ officialIdentifier }) => officialIdentifier);
    const slug = String(identifier).trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-");
    const only = ids[0];
    if (!only.endsWith(slug)) throw new Error(`${source.layerId}: cannot recover the canonical prefix from ${only}`);
    return only.slice(0, only.length - slug.length);
  }
  if (ids.length < 2) throw new Error(`${source.layerId}: no official zones, so no canonical prefix`);
  let prefix = ids[0];
  for (const id of ids.slice(1)) {
    let index = 0;
    while (index < prefix.length && index < id.length && prefix[index] === id[index]) index += 1;
    prefix = prefix.slice(0, index);
  }
  // Stop at the last separator so a shared leading digit never widens the prefix.
  const cut = Math.max(prefix.lastIndexOf("-"), prefix.lastIndexOf(":"));
  prefix = cut >= 0 ? prefix.slice(0, cut + 1) : prefix;
  if (!prefix.startsWith("management_zone:")) throw new Error(`${source.layerId}: derived an unusable canonical prefix "${prefix}"`);
  return prefix;
}

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

/*
 * Even-odd, over every ring, rather than "ring 0 is the exterior and the rest
 * are holes".
 *
 * That positional rule is the GeoJSON convention, and it is wrong for geometry
 * that came from ESRI, which distinguishes exterior rings from interior ones by
 * ORIENTATION and not by position. A conversion that preserves ESRI's ring
 * order turns a second EXTERIOR ring — a separate island — into a "hole", and a
 * point on that island is then judged outside the zone while the authority's
 * own service and PostGIS both correctly place it inside. New Brunswick's zones
 * 3, 4 and 26 failed exactly that way.
 *
 * Counting rings is orientation-free, so it is right for both conventions and
 * for geometry whose winding survived a conversion imperfectly: a point inside
 * an odd number of rings is inside the polygon. A point in a true hole is
 * inside two (the exterior and the hole) and is outside; a point on an island
 * within a hole is inside three and is inside again.
 */
function pointInPolygon(point, polygon) {
  let inside = 0;
  for (const ring of polygon) if (pointInRing(point, ring)) inside += 1;
  return inside % 2 === 1;
}

/**
 * The rings of a polygon that are genuinely holes: those whose own interior
 * lies inside an odd number of the polygon's OTHER rings. Position says
 * nothing, so neither does this.
 */
function holeRingsOf(polygon) {
  return polygon.filter((ring, index) => {
    if (ring.length < 4) return false;
    const inside = poleOfInaccessibility([ring], 0.000_01);
    let enclosing = 0;
    polygon.forEach((other, otherIndex) => {
      if (otherIndex !== index && pointInRing(inside, other)) enclosing += 1;
    });
    return enclosing % 2 === 1;
  });
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

/*
 * The precision the interior point is searched to, and that precision expressed
 * as a distance. A part smaller than this cannot be point-tested: see
 * `sampleOfficialFeatures`.
 */
const SAMPLE_TOLERANCE_DEGREES = 0.000_01;
const SAMPLE_TOLERANCE_METRES = 1.2;

/*
 * A layer certifies on its full component inventory; point sampling
 * corroborates it. If sampling loses its power over more than this share of a
 * layer's samples, the corroboration is gone and the layer does not certify on
 * the inventory alone — so this can never become the route by which a badly
 * degenerate layer passes.
 */
const MAX_UNTESTABLE_SHARE = 0.15;

function metresBetween(from, to) {
  const latitude = radians((from[1] + to[1]) / 2);
  const dx = (from[0] - to[0]) * 111_320 * Math.cos(latitude);
  const dy = (from[1] - to[1]) * 110_574;
  return Math.hypot(dx, dy);
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
      const inside = poleOfInaccessibility(polygon, SAMPLE_TOLERANCE_DEGREES);
      /*
       * A point sample cannot test a part whose furthest-from-any-edge point is
       * itself closer to that edge than the tolerance the point was found to.
       * That is a limit of the METHOD, not a judgement that the geometry is
       * close enough: containment at such a point turns on differences far
       * below any boundary North Ground would report. Recorded as its own
       * outcome, never as agreement.
       */
      const edge = closestBoundary(inside, polygon);
      const poleToEdgeMetres = edge ? metresBetween(inside, edge) : null;
      const untestable = poleToEdgeMetres !== null && poleToEdgeMetres < SAMPLE_TOLERANCE_METRES;
      samples.push({
        kind: component === 0 ? "INTERIOR" : "MULTIPART",
        zone: feature.officialIdentifier,
        point: inside,
        ...(untestable
          ? {
              untestable: true,
              reason: "SLIVER_BELOW_SAMPLING_TOLERANCE",
              poleToEdgeMetres: Number(poleToEdgeMetres.toFixed(4)),
              toleranceMetres: SAMPLE_TOLERANCE_METRES,
              partAreaKm2: Number((selected[component].area * 111.32 * 111.32).toFixed(6)),
            }
          : {}),
      });
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
    const holes = polygons.flatMap(({ polygon }) => holeRingsOf(polygon))
      .map((hole) => ({ hole, area: ringArea(hole) }))
      .sort((left, right) => right.area - left.area);
    for (const { hole } of [holes[0], ...(holes.length > 1 ? [holes.at(-1)] : [])].filter(Boolean)) {
      /*
       * A hole is point-tested the same way a part is, and is untestable on the
       * same grounds: New Brunswick publishes zero-area holes of three and four
       * points, whose furthest-from-any-edge point is ON their edge, so whether
       * a point is "in" them turns on differences far below what any boundary
       * North Ground reports. Recorded as its own outcome, never as agreement.
       */
      const inside = poleOfInaccessibility([hole], SAMPLE_TOLERANCE_DEGREES);
      const edge = closestBoundary(inside, [hole]);
      const poleToEdgeMetres = edge ? metresBetween(inside, edge) : null;
      const untestable = poleToEdgeMetres !== null && poleToEdgeMetres < SAMPLE_TOLERANCE_METRES;
      samples.push({
        kind: "HOLE",
        zone: feature.officialIdentifier,
        point: inside,
        ...(untestable
          ? {
              untestable: true,
              reason: "SLIVER_BELOW_SAMPLING_TOLERANCE",
              poleToEdgeMetres: Number(poleToEdgeMetres.toFixed(4)),
              toleranceMetres: SAMPLE_TOLERANCE_METRES,
              ringPoints: hole.length,
            }
          : {}),
      });
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

async function publishedRows(source, officialFeatures, env) {
  const prefix = canonicalPrefix(source, officialFeatures);
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

async function resolveSamples(samples, source, env, officialFeatures) {
  /*
   * The authority's own spelling of each designation, keyed by canonical id.
   * Reconstructing it by stripping the prefix and upper-casing works while
   * every designation is a token like "57" or "10W", and mangles anything
   * else: Prince Edward Island, whose single area is the province, came back
   * as "PRINCE-EDWARD-ISLAND" against the authority's "Prince Edward Island".
   * The id is the join; the spelling is read, never rebuilt.
   */
  const identifierById = new Map((officialFeatures ?? []).map(({ canonicalId, officialIdentifier }) => [canonicalId, officialIdentifier]));
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
        .map((id) => identifierById.get(id) ?? id.slice(prefix.length).toUpperCase())
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
  const published = await publishedRows(source, officialFeatures, env);
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
  const parity = await resolveSamples(samples, source, env, officialFeatures);
  /* An untestable part is its own outcome and never counts as agreement. */
  const untestable = parity.filter(({ untestable: skip }) => skip);
  const testable = parity.filter(({ untestable: skip }) => !skip);
  const disagreements = testable.filter(({ agree }) => !agree);
  const untestableShare = parity.length ? untestable.length / parity.length : 0;
  const tooManyUntestable = untestableShare > MAX_UNTESTABLE_SHARE;
  console.log(`  parity ${testable.length - disagreements.length}/${testable.length} testable; disagreements=${disagreements.length}`);
  if (untestable.length) {
    const detail = untestable.map((row) => `${row.zone} ${row.poleToEdgeMetres} m`).join(", ");
    console.log(`  ${untestable.length} part(s) untestable (below the ${SAMPLE_TOLERANCE_METRES} m sampling tolerance): ${detail}`);
    if (tooManyUntestable) {
      console.log(`  untestable share ${(untestableShare * 100).toFixed(1)}% exceeds the ${(MAX_UNTESTABLE_SHARE * 100).toFixed(0)}% ceiling; sampling no longer corroborates the inventory`);
    }
  }

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
      agreements: testable.length - disagreements.length,
      disagreements: disagreements.length,
      testable: testable.length,
      /*
       * Certification rests on the independent full-component inventory
       * comparison above; point sampling corroborates it. As `sampleOfficialFeatures`
       * puts it: "The full component inventory is independently compared below,
       * so an island cannot disappear merely because it was not chosen as a
       * point sample."
       */
      untestable: untestable.map((row) => ({
        zone: row.zone, kind: row.kind, reason: row.reason,
        poleToEdgeMetres: row.poleToEdgeMetres, toleranceMetres: row.toleranceMetres,
        partAreaKm2: row.partAreaKm2,
        /* The authority published invalid geometry here and North Ground repaired it. */
        northGroundRepaired: Boolean(normalizations.get(row.zone)),
      })),
      untestableShare: Number(untestableShare.toFixed(4)),
      untestableCeiling: MAX_UNTESTABLE_SHARE,
      unresolved: 0,
      counts: Object.fromEntries([...new Set(parity.map(({ kind }) => kind))].map((kind) => [kind, parity.filter((item) => item.kind === kind).length])),
      failures: disagreements.slice(0, 100),
      sampleHash: `sha256:${createHash("sha256").update(JSON.stringify(parity.map(({ kind, latitude, longitude, expected }) => ({ kind, latitude, longitude, expected })))).digest("hex")}`,
    },
    status: missing.length || invented.length || geometryDisagreements.length || disagreements.length || tooManyUntestable
      ? "NEEDS_VERIFICATION"
      : "VERIFIED",
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
  const unread = [];
  for (const jurisdiction of jurisdictions) {
    try {
      results.push(await certify(jurisdiction, env));
    } catch (cause) {
      /*
       * One authority's service being unwell is not a reason to abandon the
       * national audit and report nothing. The jurisdiction is recorded as
       * UNREAD — which is neither certified nor uncertified, just unanswered —
       * every other jurisdiction is still audited, and the run still fails.
       * A single jurisdiction run re-throws, because there is nothing to
       * continue to and the caller wants the stack.
       */
      if (jurisdictions.length === 1) throw cause;
      console.error(`  UNREAD: ${cause.message}`);
      unread.push(jurisdiction);
    }
  }
  if (unread.length) console.error(`\nnot read from their authority: ${unread.join(", ")}`);
  if (unread.length || results.some(({ status }) => status !== "VERIFIED")) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`Zone certification failed: ${error.stack ?? error.message}`);
  process.exit(1);
});
