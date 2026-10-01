/**
 * Which Colorado units the quail line of Chapter W-3 #320(A) crosses, measured
 * rather than read off a road's name.
 *
 * #320(A) draws three areas: (1) east of I-25 and south of "Interstate 70 from
 * I-25 to Byers and U.S. Highway 36 from Byers to the Kansas line", plus the
 * parts of Pueblo, Fremont, Huerfano, El Paso and Las Animas counties west of
 * I-25; (2) east of I-25 and north of that line; (3) west of I-25 outside those
 * five counties. The builder places units in those areas from W-0 #024's unit
 * descriptions. Two kinds of unit cannot be placed by a description alone, and
 * this script measures both against authority geometry.
 *
 * 1. UNITS BOUNDED BY US 36 WEST OF BYERS (99 to the north, 105 to the south).
 *    W-0 bounds them by US 36 between Colo 79 (Bennett) and Byers, where the
 *    regulation's line is I-70. Whether those are one line is a fact about two
 *    roads, not about wording: if US 36 ran on I-70 there, both units would sit
 *    wholly on one side. The Colorado Department of Transportation's own route
 *    network (Highways: Generalized) carries US 36 east of Watkins as its own
 *    routes, 036C and 036D, not as a concurrency on 070A; and CPW's own GMU
 *    polygons put the 99/105 edge on those routes. So the edge is measured
 *    against I-70: land of a unit north and south of I-70, west of the Byers
 *    interchange (the last point where US 36 meets I-70 before it turns
 *    north-east, where the line passes to US 36).
 *
 * 2. UNITS WEST OF I-25 WHOSE DESCRIPTIONS NAME SOME OF THE FIVE COUNTIES. A
 *    description naming a county does not by itself say how much of the unit
 *    lies in it. The share of each unit's area in each county is sampled from
 *    CPW's polygon and the Census Bureau's county polygons, as a control on
 *    the description, never instead of it.
 *
 * MARGIN. A unit is said to hold land on a side only beyond MARGIN_KM, far
 * wider than the disagreement between the two agencies' digitising of the same
 * road (the 99/105 edge lies within metres of CDOT's US 36).
 *
 * Only derived figures are written. No polygon is stored (U.S. geometry is
 * live-service only, owner decision 2026-09-21).
 *
 * Run: node scripts/derive-us-co-quail-line.mjs
 * Output: research/hunting/us-co-quail-line.json
 */

import { writeFileSync } from "node:fs";

const GMU = "https://services5.arcgis.com/ttNGmDvKQA7oeDQ3/arcgis/rest/services/CPWAdminData/FeatureServer/6/query";
const CDOT = "https://services.arcgis.com/yzB9WM8W0BO3Ql7d/arcgis/rest/services/Highways_Generalized/FeatureServer/0/query";
const COUNTIES = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1/query";
const OUT = "research/hunting/us-co-quail-line.json";
const MARGIN_KM = 0.1;
const FIVE = ["El Paso", "Fremont", "Huerfano", "Las Animas", "Pueblo"];

/** The units W-0 #024 bounds by US 36 or I-70 between I-25 and Byers. */
const EAST_CANDIDATES = ["99", "104", "105", "106"];
/** West of I-25: every unit whose W-0 #024 description names one of the five counties. */
const WEST_CANDIDATES = ["57", "58", "59", "69", "83", "84", "85", "86", "511", "512", "581", "591", "691", "851", "861"];

async function query(url, params) {
  const response = await fetch(`${url}?${new URLSearchParams({ f: "json", outSR: "4326", ...params })}`, {
    headers: { "user-agent": "NorthGround-research/1.0" },
  });
  if (!response.ok) throw new Error(`${url} ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(`${url}: ${JSON.stringify(body.error)}`);
  return body.features;
}

const route = async (id) => (await query(CDOT, { where: `ROUTE='${id}'`, outFields: "ROUTE", returnGeometry: "true" }))
  .flatMap((feature) => feature.geometry.paths);
const unit = async (id) => (await query(GMU, { where: `GMUID=${id}`, outFields: "GMUID", returnGeometry: "true", maxAllowableOffset: "0.0002" }))[0].geometry.rings;

/** Kilometres between two lon/lat points, locally planar (the distances here are a few km). */
function segmentKm([px, py], [ax, ay], [bx, by]) {
  const kx = 111.32 * Math.cos((py * Math.PI) / 180);
  const ky = 110.57;
  const [x, y, x1, y1, x2, y2] = [px * kx, py * ky, ax * kx, ay * ky, bx * kx, by * ky];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const t = dx === 0 && dy === 0 ? 0 : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - x1 - t * dx, y - y1 - t * dy);
}
const kmTo = (point, paths) => Math.min(...paths.flatMap((path) => path.slice(1).map((b, i) => segmentKm(point, path[i], b))));

/** I-70's latitudes where a meridian crosses it. */
function latitudesAt(paths, longitude) {
  const out = [];
  for (const path of paths) {
    for (let i = 1; i < path.length; i += 1) {
      const [x1, y1] = path[i - 1];
      const [x2, y2] = path[i];
      if (x1 !== x2 && (x1 - longitude) * (x2 - longitude) <= 0) out.push(y1 + ((longitude - x1) * (y2 - y1)) / (x2 - x1));
    }
  }
  return out;
}

function inside([x, y], rings) {
  let within = false;
  for (const ring of rings) {
    for (let i = 1; i < ring.length; i += 1) {
      const [x1, y1] = ring[i - 1];
      const [x2, y2] = ring[i];
      if (y1 > y !== y2 > y && x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1) within = !within;
    }
  }
  return within;
}
const bounds = (rings) => {
  const xs = rings.flat().map(([x]) => x);
  const ys = rings.flat().map(([, y]) => y);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
};

/* ── I-70 and US 36 between Bennett and Byers ── */

const i70 = await route("070A");
const us36 = [...(await route("036C")), ...(await route("036D"))];
if (!i70.length || !us36.length) throw new Error("CDOT returned no geometry for I-70 or US 36");

/* Where US 36 meets I-70 east of Denver, west to east. The last meeting before US 36 leaves north-eastward is Byers. */
const meetings = us36.flat()
  .filter(([x]) => x > -104.7 && x < -104.0)
  .filter((point) => kmTo(point, i70) < MARGIN_KM)
  .map(([x, y]) => [Number(x.toFixed(4)), Number(y.toFixed(4))])
  .sort(([a], [b]) => a - b);
if (meetings.length < 2) throw new Error(`expected US 36 to meet I-70 at least twice east of Watkins, found ${meetings.length}`);
const byersLongitude = meetings[meetings.length - 1][0];
/* The meeting before the Byers interchange: west of it, US 36 runs north of I-70; between it and the interchange,
   south. The regulation hands the line from I-70 to US 36 "at Byers" without saying which point that is. */
const previousMeeting = meetings[meetings.length - 2][0];

/* US 36's own offset from I-70 between Bennett (Colo 79) and Byers: the evidence the two roads are not one line there. */
const BENNETT_LONGITUDE = -104.427;
const offsets = us36.flat()
  .filter(([x]) => x > BENNETT_LONGITUDE - 0.001 && x < byersLongitude)
  .map(([x, y]) => (y - latitudesAt(i70, x)[0]) * 110.57);
const us36VersusI70 = {
  meetingsEastOfWatkins: meetings,
  byersInterchangeLongitude: byersLongitude,
  previousMeetingLongitude: previousMeeting,
  betweenBennettAndByers: {
    maxNorthOfI70Km: Number(Math.max(0, ...offsets).toFixed(2)),
    maxSouthOfI70Km: Number(Math.max(0, ...offsets.map((o) => -o)).toFixed(2)),
  },
};

function sidesOfI70(rings, westOf) {
  let north = 0;
  let south = 0;
  for (const [x, y] of rings.flat()) {
    if (x >= westOf) continue;
    const lats = latitudesAt(i70, x);
    if (!lats.length) continue;
    const offset = (y - lats[0]) * 110.57;
    north = Math.max(north, offset);
    south = Math.max(south, -offset);
  }
  return {
    maxNorthOfI70Km: Number(north.toFixed(2)),
    maxSouthOfI70Km: Number(south.toFixed(2)),
    crosses: north > MARGIN_KM && south > MARGIN_KM,
  };
}

const east = {};
for (const id of EAST_CANDIDATES) {
  const rings = await unit(id);
  east[id] = {
    westOfByersInterchange: sidesOfI70(rings, byersLongitude),
    westOfPreviousMeeting: sidesOfI70(rings, previousMeeting),
  };
}

/* ── The five counties, west of I-25 ── */

const counties = (await query(COUNTIES, { where: "STATE='08'", outFields: "BASENAME", returnGeometry: "true", maxAllowableOffset: "0.0005" }))
  .map((feature) => ({ name: feature.attributes.BASENAME, rings: feature.geometry.rings, box: bounds(feature.geometry.rings) }));
if (counties.length !== 64) throw new Error(`expected Colorado's 64 counties, read ${counties.length}`);

const GRID = 80;
const west = {};
for (const id of WEST_CANDIDATES) {
  const rings = await unit(id);
  const [x0, y0, x1, y1] = bounds(rings);
  const counts = {};
  let total = 0;
  for (let i = 0; i < GRID; i += 1) {
    for (let j = 0; j < GRID; j += 1) {
      const point = [x0 + ((i + 0.5) * (x1 - x0)) / GRID, y0 + ((j + 0.5) * (y1 - y0)) / GRID];
      if (!inside(point, rings)) continue;
      total += 1;
      const county = counties.find(({ box, rings: countyRings }) =>
        point[0] >= box[0] && point[0] <= box[2] && point[1] >= box[1] && point[1] <= box[3] && inside(point, countyRings));
      const name = county?.name ?? "(none)";
      counts[name] = (counts[name] ?? 0) + 1;
    }
  }
  const share = Object.fromEntries(Object.entries(counts).sort(([, a], [, b]) => b - a).map(([name, n]) => [name, Number(((100 * n) / total).toFixed(1))]));
  const inFive = Object.entries(counts).filter(([name]) => FIVE.includes(name)).reduce((sum, [, n]) => sum + n, 0);
  west[id] = { samples: total, percentInFiveCounties: Number(((100 * inFive) / total).toFixed(1)), percentByCounty: share };
}

writeFileSync(OUT, `${JSON.stringify({
  derivedAt: new Date().toISOString().slice(0, 10),
  services: { gmu: GMU, cdotRoutes: CDOT, counties: COUNTIES },
  method:
    `East of I-25: every vertex of CPW's polygon west of the Byers interchange is measured north or south of CDOT's I-70 (route 070A); ` +
    `a unit crosses the line when it holds land more than ${MARGIN_KM} km on both sides. West of I-25: the unit's area is sampled ` +
    `on a ${GRID}x${GRID} grid and each sample placed in a Census county.`,
  marginKm: MARGIN_KM,
  us36VersusI70,
  east,
  west,
}, null, 1)}\n`);
console.log("US 36 vs I-70, Bennett to Byers:", us36VersusI70.betweenBennettAndByers, "Byers at", byersLongitude);
for (const [id, value] of Object.entries(east)) console.log(`unit ${id}`, value);
for (const [id, value] of Object.entries(west)) console.log(`unit ${id}: ${value.percentInFiveCounties}% in the five counties`, value.percentByCounty);
