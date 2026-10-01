/**
 * Which Colorado Game Management Units lie on which side of the lines Chapter
 * W-3 writes its small-game seasons in.
 *
 * WHY THIS EXISTS. Colorado's small-game regulation does not always speak in
 * units. Dusky grouse is open "West of U.S. Interstate 25"; pheasant has one
 * closing date east of I-25 and another west of it; quail adds I-70, US 36 and
 * five counties; greater prairie-chicken adds Morgan County and "those portions
 * east of Colorado State Highway 71 and south of Colorado State Highway 14 and
 * U.S. Highway 138". The engine places a point in a unit, so each of those
 * sentences has to be turned into unit lists — and where a unit cannot be
 * placed wholly on one side, it must stay UNRESOLVED rather than be guessed.
 *
 * THE EVIDENCE IS THE AUTHORITY'S OWN, TWICE OVER.
 *
 *  1. The unit descriptions in Chapter W-0 #024 name I-25 and Colo 71 as unit
 *     boundaries. A unit "bounded … on the east by I-25" lies west of it by the
 *     regulation's own words, and so on. Those units are the CHAINS below, each
 *     with the phrase that puts it there.
 *  2. For every other unit, Colorado Parks and Wildlife's own GMU feature
 *     service (the layer Hunt already resolves points with) is read, the chain
 *     units' edges reconstruct the line, and a unit is placed on a side only if
 *     EVERY vertex lies more than MARGIN degrees from the line on that side.
 *     The two reconstructions of I-25 (west chain's east edges, east chain's
 *     west edges) are compared at every latitude as a positive control: if they
 *     disagree by more than the margin, the run fails rather than classifies.
 *
 * Only the derived classification is written. No polygon is stored (U.S.
 * geometry is live-service only, owner decision 2026-09-21).
 *
 * Run: node scripts/derive-us-co-gmu-sides.mjs
 * Output: research/hunting/us-co-gmu-sides.json
 */

import { writeFileSync } from "node:fs";

const SERVICE = "https://services5.arcgis.com/ttNGmDvKQA7oeDQ3/arcgis/rest/services/CPWAdminData/FeatureServer/6/query";
const OUT = "research/hunting/us-co-gmu-sides.json";
/** Degrees of longitude (about 1.7 km at 39°N). Far wider than the chains' own disagreement. */
const MARGIN = 0.02;

/** W-0 #024: units whose description puts I-25 on their EAST side. */
const I25_WEST_CHAIN = {
  9: "on the east by I-25", 19: "on the east by I-25", 20: "on the east by I-25", 29: "on the east by I-25",
  38: "on the east by I-25", 51: "on the east by I- 25", 59: "on the east by I-25", 84: "on the east by I-25 and Colo 1", 85: "on the east by I-25",
  391: "on the east by I- 25", 511: "on the east by I-25", 512: "on the east by I-25", 851: "on the east by I-25",
};
/** W-0 #024: units whose description puts I-25 on their WEST side. */
const I25_EAST_CHAIN = {
  87: "on the west by I-25", 94: "on the west by I-25", 104: "on the west by I-25", 110: "on the west by I-25",
  118: "on the west by I-25", 123: "on the west by I-25", 128: "on the west by I-25", 129: "on the west by I-25",
  133: "on the west by I-25", 134: "on the west by I-25", 140: "on the west by I- 25",
};
/**
 * Unit 591 is Fort Carson, carved out of unit 59 ("EXCEPT those portions … within the boundaries of the Fort Carson
 * Military Reservation"), and 59 lies wholly west of I-25 by its own description. Its drawn edge touches I-25, so the
 * geometry alone cannot clear the margin; the description of the unit it is carved from places it.
 */
const I25_WEST_BY_PARENT = { 591: "carved from unit 59, which is bounded on the east by I-25" };

/** W-0 #024: units with Colo 71 as a boundary, by side. */
const SH71_WEST_CHAIN = {
  88: "on the east by Colo 71", 106: "on the east by Colo 71", 111: "on the east by Colo 71",
  119: "on the east by Colo 71", 124: "on the east by Colo 71",
};
const SH71_EAST_CHAIN = {
  89: "on the west by Colo 71", 100: "on the west by Colo 71", 107: "on the west by Colo 71",
  112: "on the west by Colo 71", 120: "on the west by Colo 71", 125: "on the west by Colo 71",
};

async function fetchUnits() {
  const units = new Map();
  for (let offset = 0; ; offset += 20) {
    const query = new URLSearchParams({
      where: "1=1", outFields: "GMUID", returnGeometry: "true", outSR: "4326", maxAllowableOffset: "0.0005",
      f: "json", resultOffset: String(offset), resultRecordCount: "20", orderByFields: "GMUID",
    });
    const response = await fetch(`${SERVICE}?${query}`, { headers: { "user-agent": "NorthGround-research/1.0" } });
    if (!response.ok) throw new Error(`GMU service ${response.status}`);
    const body = await response.json();
    for (const feature of body.features ?? []) units.set(String(feature.attributes.GMUID), feature.geometry.rings);
    if ((body.features ?? []).length < 20) break;
  }
  return units;
}

/** Every crossing of a horizontal line at `latitude` with the units' edges. */
function crossings(units, ids, latitude) {
  const xs = [];
  for (const id of ids) {
    for (const ring of units.get(String(id)) ?? []) {
      for (let i = 1; i < ring.length; i += 1) {
        const [x1, y1] = ring[i - 1];
        const [x2, y2] = ring[i];
        if ((y1 <= latitude && latitude < y2) || (y2 <= latitude && latitude < y1)) xs.push(x1 + ((latitude - y1) * (x2 - x1)) / (y2 - y1));
      }
    }
  }
  return xs;
}

function line(units, westChain, eastChain) {
  return (latitude) => {
    const fromWest = crossings(units, Object.keys(westChain), latitude);
    const fromEast = crossings(units, Object.keys(eastChain), latitude);
    const a = fromWest.length ? Math.max(...fromWest) : null;
    const b = fromEast.length ? Math.min(...fromEast) : null;
    return { a, b, at: a ?? b };
  };
}

function sideOf(rings, at) {
  const sides = new Set();
  let nearest = Infinity;
  for (const ring of rings) {
    for (const [x, y] of ring) {
      const position = at(y);
      if (position === null) { sides.add("BEYOND_LINE"); continue; }
      const d = x - position;
      nearest = Math.min(nearest, Math.abs(d));
      sides.add(d < -MARGIN ? "W" : d > MARGIN ? "E" : "NEAR");
    }
  }
  return { sides: [...sides].sort(), nearest };
}

const units = await fetchUnits();
if (units.size !== 186) throw new Error(`expected 186 units, read ${units.size}`);

/* ── I-25 ── */
const i25 = line(units, I25_WEST_CHAIN, I25_EAST_CHAIN);
let worst = 0;
for (let k = 3700; k < 4100; k += 1) {
  const { a, b } = i25(k / 100 + 0.005);
  if (a === null || b === null) throw new Error(`I-25 chains leave a gap at ${k / 100}`);
  worst = Math.max(worst, Math.abs(a - b));
}
if (worst > MARGIN / 2) throw new Error(`I-25 chains disagree by ${worst}°`);

const i25Side = {};
for (const [id, rings] of units) {
  if (I25_WEST_CHAIN[id]) { i25Side[id] = { side: "WEST", evidence: `W-0 #024 unit ${id}: “${I25_WEST_CHAIN[id]}”` }; continue; }
  if (I25_EAST_CHAIN[id]) { i25Side[id] = { side: "EAST", evidence: `W-0 #024 unit ${id}: “${I25_EAST_CHAIN[id]}”` }; continue; }
  if (I25_WEST_BY_PARENT[id]) { i25Side[id] = { side: "WEST", evidence: `W-0 #024 unit ${id}: ${I25_WEST_BY_PARENT[id]}` }; continue; }
  /* Vertices on the state lines sit at the ends of I-25's latitude range; they are not evidence either way. */
  const { sides, nearest } = sideOf(rings, (latitude) => (latitude >= 37.0 && latitude < 41.0 ? i25(latitude).at : null));
  const decisive = sides.filter((side) => side !== "BEYOND_LINE");
  const side = decisive.length === 1 && decisive[0] === "W" ? "WEST" : decisive.length === 1 && decisive[0] === "E" ? "EAST" : "UNRESOLVED";
  i25Side[id] = { side, evidence: `CPW GMU service geometry: every vertex ${side === "UNRESOLVED" ? "NOT" : ""} more than ${MARGIN}° ${side === "EAST" ? "east" : "west"} of the I-25 line the chain units trace (nearest ${nearest.toFixed(3)}°)` };
}
const unresolvedI25 = Object.entries(i25Side).filter(([, value]) => value.side === "UNRESOLVED").map(([id]) => id);
if (unresolvedI25.length) throw new Error(`units not placed against I-25: ${unresolvedI25.join(", ")}`);

/* ── Colo 71, for greater prairie-chicken ── */
const sh71 = line(units, SH71_WEST_CHAIN, SH71_EAST_CHAIN);
/* The chain's latitude extent: Colo 71 is a unit boundary from the Nebraska line south to US 50. Outside that band
   "east of Colo 71" is not a line North Ground can draw, so a unit reaching beyond it is UNRESOLVED. */
let south = Infinity;
let north = -Infinity;
for (let k = 3690; k < 4110; k += 1) {
  const latitude = k / 100 + 0.005;
  if (sh71(latitude).at !== null) { south = Math.min(south, latitude); north = Math.max(north, latitude); }
}
const sh71Side = {};
for (const [id, rings] of units) {
  if (i25Side[id].side === "WEST") { sh71Side[id] = { side: "WEST", evidence: "west of I-25, therefore west of Colo 71" }; continue; }
  if (SH71_WEST_CHAIN[id]) { sh71Side[id] = { side: "WEST", evidence: `W-0 #024 unit ${id}: “${SH71_WEST_CHAIN[id]}”` }; continue; }
  if (SH71_EAST_CHAIN[id]) { sh71Side[id] = { side: "EAST", evidence: `W-0 #024 unit ${id}: “${SH71_EAST_CHAIN[id]}”` }; continue; }
  const { sides, nearest } = sideOf(rings, (latitude) => (latitude >= south && latitude <= north ? sh71(latitude).at : null));
  const side = sides.length === 1 && sides[0] === "W" ? "WEST" : sides.length === 1 && sides[0] === "E" ? "EAST" : "UNRESOLVED";
  sh71Side[id] = {
    side,
    evidence: side === "UNRESOLVED"
      ? `CPW GMU service geometry: vertices ${sides.join("/")} relative to the Colo 71 line between ${south.toFixed(2)}°N and ${north.toFixed(2)}°N (nearest ${nearest.toFixed(3)}°)`
      : `CPW GMU service geometry: every vertex more than ${MARGIN}° ${side === "EAST" ? "east" : "west"} of Colo 71, inside the latitudes it bounds units (nearest ${nearest.toFixed(3)}°)`,
  };
}

const sorted = (object) => Object.fromEntries(Object.entries(object).sort(([a], [b]) => Number(a) - Number(b)));
writeFileSync(OUT, `${JSON.stringify({
  derivedAt: new Date().toISOString().slice(0, 10),
  service: SERVICE,
  method:
    "Units named in W-0 #024 as bounded by the line are placed by their description. Every other unit is placed only if " +
    `every vertex of CPW's own GMU polygon lies more than ${MARGIN}° of longitude on one side of the line those units trace.`,
  margin: MARGIN,
  i25ChainDisagreementDegrees: Number(worst.toFixed(4)),
  sh71BoundsUnitsBetween: { southLatitude: Number(south.toFixed(3)), northLatitude: Number(north.toFixed(3)) },
  i25: sorted(i25Side),
  sh71: sorted(sh71Side),
}, null, 1)}\n`);
console.log(`I-25: ${Object.values(i25Side).filter((v) => v.side === "WEST").length} west, ${Object.values(i25Side).filter((v) => v.side === "EAST").length} east; chains agree to ${worst.toFixed(4)}°`);
console.log(`Colo 71 (${south.toFixed(2)}–${north.toFixed(2)}°N):`, Object.entries(sh71Side).filter(([, v]) => v.side !== "WEST").map(([id, v]) => `${id}:${v.side}`).join(" "));
