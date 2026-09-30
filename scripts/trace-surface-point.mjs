#!/usr/bin/env node
/**
 * Why a place is the colour it is: one point traced through every step that
 * decides a species' heat, from the evidence to the pixel.
 *
 *   node scripts/trace-surface-point.mjs --species ruffed-grouse --at 46.378,-75.966 [--month 10]
 *   node scripts/trace-surface-point.mjs --grouse-cases --write docs/research/surface-trace-ruffed-grouse.md
 *
 * For each surface the endpoint serves in that month, in the order it composes
 * them: whether the point is inside it (range membership), the land under it
 * (the foundation cell's cover and terrain), how the species' profile classes
 * that land, the survey support around it (routes, detections, the nearest
 * finding route), the value the model or survey gives it, the visual band that
 * value falls in, and the colour the renderer paints — computed by the
 * renderer's own sampler and paint, never re-derived here.
 *
 * It reads only committed inputs, so a trace is reproducible from the tree.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { paintFor, sampleSurfaceWithSupport, edgeFade } from "../src/lib/hunt/exploration/surface-paint.ts";
import { toRenderable } from "../src/lib/hunt/exploration/surface-request.ts";
import { speciesSurfaces } from "../src/lib/hunt/intelligence/surface.ts";

const args = process.argv.slice(2);
const flag = (name, fallback = null) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);

const manifest = JSON.parse(readFileSync("content/intelligence/foundation/landcover-2019-0.1deg.json", "utf8"));
const shares = gunzipSync(readFileSync(`content/intelligence/foundation/${manifest.artifact.file}`));
const groups = manifest.groups.map((g) => g.name);
const G = manifest.grid;
let terrain = null;
try {
  const t = JSON.parse(readFileSync("content/intelligence/foundation/terrain-etopo2022-0.1deg.json", "utf8"));
  terrain = new Int16Array(Uint8Array.from(gunzipSync(readFileSync(`content/intelligence/foundation/${t.artifact.file}`))).buffer);
} catch { /* terrain not built: its lines say so */ }
const profiles = JSON.parse(readFileSync("content/intelligence/surface-profiles.json", "utf8"));

/* The owner's bands (§41B, "colour is rank"): what a value's tenth is called. */
const BANDS = ["bottom tenth (faint blue)", "second tenth (blue)", "third tenth (blue into cyan)", "fourth tenth (cyan)", "fifth tenth (green)",
  "sixth tenth (green)", "seventh tenth (yellow)", "eighth tenth (yellow)", "ninth tenth (orange)", "top tenth (red)"];

const km = (lat1, lon1, lat2, lon2) => {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
};

function land(lat, lon) {
  const row = Math.floor((G.north - lat) / G.cell);
  const col = Math.floor((lon - G.west) / G.cell);
  if (row < 0 || row >= G.rows || col < 0 || col >= G.columns) return null;
  const cell = row * G.columns + col;
  const cover = Object.fromEntries(groups.map((name, i) => [name, shares[cell * groups.length + i]]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]));
  return { cover, meanMetres: terrain ? terrain[cell * 2] : null, reliefMetres: terrain ? terrain[cell * 2 + 1] : null };
}

function classOf(profile, group) {
  if (!profile?.landCover) return null;
  const aliases = profiles.groupAliases;
  for (const level of ["CORE", "HIGH", "MODERATE", "LOW", "UNSUITABLE"]) {
    const names = (profile.landCover[level] ?? []).flatMap((n) => aliases[n] ?? [n]);
    if (names.includes(group)) return level;
  }
  return "UNSUITABLE (not named)";
}

function routeSupport(speciesSlug, lat, lon) {
  let routes;
  try { routes = JSON.parse(readFileSync(`content/intelligence/models/inputs/${speciesSlug}-bbs-routes.json`, "utf8")); } catch { return null; }
  const near = routes.sites.map(([la, lo, mean, years]) => ({ d: km(lat, lon, la, lo), mean, years })).filter((s) => s.d <= 120);
  const finders = routes.sites.map(([la, lo, mean]) => ({ d: km(lat, lon, la, lo), mean })).filter((s) => s.mean > 0).sort((a, b) => a.d - b.d);
  return {
    routesWithin120Km: near.length,
    routesWithin60Km: near.filter((s) => s.d <= 60).length,
    findingWithin120Km: near.filter((s) => s.mean > 0).length,
    nearestFindingRouteKm: finders.length ? Math.round(finders[0].d) : null,
    meanCountOfNearestFinder: finders.length ? finders[0].mean : null,
  };
}

export function trace(speciesId, lat, lon, month) {
  const slug = speciesId.replace("species:", "");
  const box = [lon - 1.5, lat - 1, lon + 1.5, lat + 1];
  const reply = speciesSurfaces(speciesId, box, undefined, { month, asOf: "2026-09-30" });
  const ground = land(lat, lon);
  const profile = profiles.species[speciesId];
  const layers = reply.surfaces.map((surface) => {
    const renderable = toRenderable(surface);
    const sample = renderable ? sampleSurfaceWithSupport(renderable, lat, lon) : null;
    const nearest = renderable?.cells ? renderable.cells.get(Math.round((lat - renderable.grid.south) / renderable.grid.latStep) * renderable.grid.cols + Math.round((lon - renderable.grid.west) / renderable.grid.lonStep)) : undefined;
    const paint = sample ? paintFor(sample.value) : null;
    const alpha = paint ? paint.alpha * edgeFade(sample.support) * (renderable.opacity ?? 1) : 0;
    const state = nearest === undefined
      ? (surface.cellStates.nullMeans === "OUTSIDE_RANGE" ? "OUTSIDE RANGE" : "NO DATA")
      : nearest < 0 ? "MODELLED UNSUITABLE" : nearest === 0 ? "MEASURED ZERO" : "FOUND";
    return {
      surface: surface.id,
      tier: surface.tier,
      role: surface.role,
      season: surface.evidenceWindow.statedAs,
      rangeMembership: state,
      modelOutput: nearest === undefined ? null : nearest,
      interpolated: sample ? Number(sample.value.toFixed(3)) : null,
      support: sample ? Number(sample.support.toFixed(2)) : null,
      visualBand: sample && sample.value > 0 ? (surface.visualTransform.kind.startsWith("RANK") ? BANDS[Math.min(9, Math.floor(sample.value * 10))] : `habitat class value ${sample.value.toFixed(2)}`) : state.toLowerCase(),
      finalColour: paint && alpha > 0 ? `rgba(${paint.red}, ${paint.green}, ${paint.blue}, ${alpha.toFixed(2)})` : "transparent",
      confidence: surface.confidence.level,
      staleness: surface.staleness.state,
    };
  });
  return {
    speciesId, latitude: lat, longitude: lon, month,
    seasonMatch: reply.season,
    environment: ground,
    habitatClassification: profile?.landCover && ground ? Object.fromEntries(Object.keys(ground.cover).map((g) => [g, classOf(profile, g)])) : "no range-and-habitat profile (the survey and its model speak here)",
    surveySupport: routeSupport(slug, lat, lon),
    layers,
    setAside: reply.setAside,
  };
}

function markdown(traces) {
  const lines = [
    "# Ruffed grouse: where each colour comes from",
    "",
    "Generated by `scripts/trace-surface-point.mjs --grouse-cases` from committed inputs, with the renderer's own sampler and paint. Do not edit by hand.",
    "",
  ];
  for (const { name, t } of traces) {
    lines.push(`## ${name} — ${t.latitude}, ${t.longitude} (month ${t.month})`, "");
    lines.push(`- **Environment (0.1° land cover):** ${t.environment ? Object.entries(t.environment.cover).map(([g, v]) => `${g} ${v}%`).join(", ") : "outside the foundation"}${t.environment?.meanMetres !== null && t.environment ? `; mean elevation ${t.environment.meanMetres} m, relief ${t.environment.reliefMetres} m` : ""}.`);
    lines.push(`- **Habitat classification:** ${typeof t.habitatClassification === "string" ? t.habitatClassification : Object.entries(t.habitatClassification).map(([g, c]) => `${g} ${c}`).join(", ")}.`);
    lines.push(`- **Survey support:** ${t.surveySupport ? `${t.surveySupport.routesWithin120Km} routes within 120 km (${t.surveySupport.routesWithin60Km} within 60 km), ${t.surveySupport.findingWithin120Km} of them found grouse; nearest finding route ${t.surveySupport.nearestFindingRouteKm ?? "none"} km (mean ${t.surveySupport.meanCountOfNearestFinder ?? "–"} birds per run)` : "no route input"}.`);
    for (const layer of t.layers) {
      lines.push(`- **${layer.surface}** (${layer.tier}, ${layer.role}, ${layer.season}): range membership ${layer.rangeMembership}; model output ${layer.modelOutput ?? "none"}; interpolated ${layer.interpolated ?? "none"} with support ${layer.support ?? "–"}; visual band ${layer.visualBand}; **final colour ${layer.finalColour}**.`);
    }
    if (!t.layers.length) lines.push("- No surface reaches this ground in this month.");
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

if (args.includes("--grouse-cases")) {
  /* Maniwaki, the owner's diagnostic case; the strongest-supported survey cell;
     a marginal one; ground the survey measured as none found; and ground
     outside everything. The high and marginal cells are found, not chosen. */
  const artifact = JSON.parse(readFileSync("content/intelligence/surfaces/ruffed-grouse.json", "utf8"));
  const found = artifact.cells.row.map((r, i) => ({ r, c: artifact.cells.col[i], v: artifact.cells.intensity[i], s: artifact.cells.sites[i] })).filter((x) => x.v > 0);
  const high = [...found].sort((a, b) => b.s - a.s || b.v - a.v).find((x) => x.v >= 900);
  const marginal = [...found].sort((a, b) => b.s - a.s).find((x) => x.v <= 100);
  const at = (x) => [Number((artifact.grid.south + x.r * artifact.grid.latStep).toFixed(3)), Number((artifact.grid.west + x.c * artifact.grid.lonStep).toFixed(3))];
  const cases = [
    { name: "Maniwaki, Québec", point: [46.378, -75.966] },
    { name: "High support (the best-supported cell in the top tenth)", point: at(high) },
    { name: "Marginal (the best-supported cell in the bottom tenth)", point: at(marginal) },
    { name: "Measured none (central Kansas, surveyed)", point: [38.5, -98.5] },
    { name: "Outside the range (Nunavut tundra)", point: [66.5, -97.0] },
  ];
  const traces = cases.map(({ name, point }) => ({ name, t: trace("species:ruffed-grouse", point[0], point[1], 10) }));
  const out = flag("write");
  if (out) writeFileSync(out, markdown(traces));
  process.stdout.write(out ? `wrote ${out}\n` : markdown(traces));
} else {
  const species = flag("species", "ruffed-grouse");
  const [lat, lon] = (flag("at", "46.378,-75.966")).split(",").map(Number);
  process.stdout.write(`${JSON.stringify(trace(`species:${species.replace("species:", "")}`, lat, lon, Number(flag("month", "10"))), null, 2)}\n`);
}
