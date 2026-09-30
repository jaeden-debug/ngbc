#!/usr/bin/env node
/**
 * The official management-unit boundaries a species model is fitted and
 * validated on, read from each authority's own service.
 *
 *   node scripts/fetch-unit-boundaries.mjs --out .research/units
 *
 * Alberta's WMUs (the moose densities are per WMU), Ontario's WMUs and British
 * Columbia's Management Units (their harvest records are the external check).
 * The same services Hunt draws from. Coordinates are rounded to 0.001° (about
 * 100 m) because the boundaries are only used to decide which 0.1° cell
 * centres fall in which unit; nothing drawn on the map comes from these files.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const OUT = args.includes("--out") ? args[args.indexOf("--out") + 1] : ".research/units";
mkdirSync(OUT, { recursive: true });
const USER_AGENT = "NorthGroundBushcraft/1.0 (+https://www.northgroundbushcraft.com)";

async function json(url) {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { "user-agent": USER_AGENT }, signal: AbortSignal.timeout(180_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      if (attempt === 4) throw new Error(`${url.slice(0, 160)}: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 4000 * attempt));
    }
  }
}

const round = (ring) => {
  const out = [];
  for (const [x, y] of ring) {
    const point = [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000];
    const last = out.at(-1);
    if (!last || last[0] !== point[0] || last[1] !== point[1]) out.push(point);
  }
  return out;
};
const polygonsOf = (geometry) => {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return [geometry.coordinates.map(round)];
  if (geometry.type === "MultiPolygon") return geometry.coordinates.map((polygon) => polygon.map(round));
  if (geometry.rings) return [geometry.rings.map(round)];
  return [];
};

async function arcgis(label, base, designationOf, extraFields, orderBy = "OBJECTID") {
  const features = [];
  for (let offset = 0; ; offset += 50) {
    const url = `${base}?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&maxAllowableOffset=0.002&f=geojson&resultOffset=${offset}&resultRecordCount=50&orderByFields=${orderBy}`;
    const page = await json(url);
    for (const feature of page.features ?? []) {
      const designation = designationOf(feature.properties ?? {});
      if (!designation) continue;
      features.push({ designation, ...extraFields(feature.properties ?? {}), polygons: polygonsOf(feature.geometry) });
    }
    if (!page.features?.length || page.features.length < 50) break;
  }
  writeFileSync(join(OUT, `${label}.json`), `${JSON.stringify({ source: base, retrievedAt: new Date().toISOString().slice(0, 10), units: features })}\n`);
  process.stdout.write(`${label}: ${features.length} units\n`);
}

await arcgis(
  "ca-ab-wmu",
  "https://geospatial.alberta.ca/mimas/rest/services/boundaries/fishwild_wildlife_mgmt_unit_public/FeatureServer/0/query",
  (p) => (/^\d{5}$/.test(String(p.WMUNIT_CODE ?? "").trim()) ? String(Number(p.WMUNIT_CODE)) : null),
  (p) => ({ name: p.WMUNIT_NAME ?? null }),
);
await arcgis(
  "ca-on-wmu",
  /* The layer Hunt itself draws Ontario from (src/lib/hunt/zone.ts). */
  "https://ws.lioservices.lrc.gov.on.ca/arcgis2/rest/services/LIO_OPEN_DATA/LIO_Open05/MapServer/5/query",
  (p) => String(p.OFFICIAL_NAME ?? "").replace(/^(Wildlife Management Unit|WMU)\s*/i, "").trim() || null,
  (p) => ({ areaSquareMetres: p.SYSTEM_CALCULATED_AREA ?? null }),
  "OGF_ID",
);

/* British Columbia publishes its units through WFS. */
{
  const base = "https://openmaps.gov.bc.ca/geo/pub/WHSE_WILDLIFE_MANAGEMENT.WAA_WILDLIFE_MGMT_UNITS_SVW/ows";
  const url = `${base}?service=WFS&version=2.0.0&request=GetFeature&typeName=pub:WHSE_WILDLIFE_MANAGEMENT.WAA_WILDLIFE_MGMT_UNITS_SVW&outputFormat=json&srsName=EPSG:4326`;
  const page = await json(url);
  const units = (page.features ?? []).map((feature) => ({
    designation: String(feature.properties?.WILDLIFE_MGMT_UNIT_ID ?? "").trim(),
    polygons: polygonsOf(feature.geometry),
  })).filter((unit) => unit.designation);
  writeFileSync(join(OUT, "ca-bc-mu.json"), `${JSON.stringify({ source: base, retrievedAt: new Date().toISOString().slice(0, 10), units })}\n`);
  process.stdout.write(`ca-bc-mu: ${units.length} units\n`);
}
