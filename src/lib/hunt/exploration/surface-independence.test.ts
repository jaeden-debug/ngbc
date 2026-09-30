import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createSpeciesSurfaceHandler } from "../intelligence/handler.ts";
import { hasCertifiedSurface, surfaceRegistry } from "../intelligence/surface.ts";
import { rampAt, sampleSurface, type RenderableSurface } from "./surface-paint.ts";
import {
  boxContains, surfaceRequestBox, surfaceStateFromReply, surfaceUrl, toRenderable,
  type ReplySurface, type SurfaceReply,
} from "./surface-request.ts";
import { zoneHasConditions, zoneIsGreen } from "./species-layer.ts";
import type { ZoneSpeciesAnswer } from "./states.ts";

/**
 * The species surface's pipeline, end to end, and the separations it exists to
 * keep.
 *
 * THE DEFECT THIS FILE EXISTS FOR. On 2026-09-29 production served 25 certified
 * surfaces with 200s and no Hunt client ever requested one: the endpoint was
 * built, the renderer was on an unmerged branch, and every backend test was
 * green. So the first test here walks the whole chain in code — registry →
 * handler → the URL the client builds → the reply decoder → the renderer's
 * sampler → a painted, non-transparent pixel — and the browser certification
 * (`scripts/certify-species-surface.mjs`) walks it again in a real Hunt.
 */

const GET = createSpeciesSurfaceHandler();
const ORIGIN = "https://northgroundbushcraft.com";
const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

async function ask(speciesId: string, box: { west: number; south: number; east: number; north: number }) {
  const response = await GET(new Request(ORIGIN + surfaceUrl(speciesId, box)));
  const payload = (await response.json()) as SurfaceReply;
  return { status: response.status, payload };
}

/** The central Ontario/Québec ground a hunter opening Hunt sees first. */
const ONTARIO_VIEW = { west: -80, south: 44.5, east: -74, north: 47.5 };

test("certified artifact → registry → API → client request → decoder → painted pixel, for ruffed grouse", async () => {
  const entry = surfaceRegistry().surfaces.find((surface) => surface.speciesId === "species:ruffed-grouse");
  assert.ok(entry, "ruffed grouse is certified in the surface registry");

  // The URL the client builds for the view, not a hand-written one.
  const box = surfaceRequestBox(ONTARIO_VIEW);
  assert.ok(boxContains(box, ONTARIO_VIEW), "the request covers the view");
  const { status, payload } = await ask("species:ruffed-grouse", box);
  assert.equal(status, 200);

  const state = surfaceStateFromReply("species:ruffed-grouse", "species:ruffed-grouse", status, payload);
  assert.ok(state);
  assert.equal(state.outcome, "DRAWN");
  const field = state.surfaces.find((surface) => surface.continuity === "CONTINUOUS");
  assert.ok(field?.cells && field.grid, "a continuous raster reached the renderer");
  assert.equal(field.id, `surface:bbs-ruffed-grouse`);

  // Sample the view the way the renderer does and count painted pixels.
  let painted = 0;
  let samples = 0;
  for (let lat = ONTARIO_VIEW.south; lat <= ONTARIO_VIEW.north; lat += 0.1) {
    for (let lon = ONTARIO_VIEW.west; lon <= ONTARIO_VIEW.east; lon += 0.1) {
      samples += 1;
      const intensity = sampleSurface(field, lat, lon);
      if (intensity !== null && rampAt(intensity).alpha > 0) painted += 1;
    }
  }
  assert.ok(painted / samples > 0.5, `most of central Ontario is painted (${painted}/${samples})`);

  // The legend carries the reply's own words, not ours.
  const layer = state.legend?.layers[0];
  assert.equal(layer?.geometryKind, "MODELLED_RASTER");
  assert.match(layer?.scaleStatedAs ?? "", /Not a count of animals/);
  assert.match(layer?.resolutionStatedAs ?? "", /40 km/);
});

test("every certified surface reaches the renderer from a viewport the client would ask for", async () => {
  // A continental view: every BBS species has cells somewhere in it.
  const box = surfaceRequestBox({ west: -125, south: 25, east: -55, north: 62 });
  for (const entry of surfaceRegistry().surfaces) {
    const { status, payload } = await ask(entry.speciesId, box);
    assert.equal(status, 200, entry.speciesId);
    const state = surfaceStateFromReply(entry.speciesId, entry.speciesId, status, payload);
    assert.equal(state?.outcome, "DRAWN", entry.speciesId);
    assert.ok(state?.surfaces.some((surface) => surface.cells?.size), `${entry.speciesId} has cells to paint`);
  }
});

test("the Hunt client requests the surface: HuntApp → useSpeciesSurface → /api/hunt/species-surface → the map", () => {
  // The exact failure: a served endpoint no component asked for. Each link is
  // asserted where it lives, so deleting any one of them fails here.
  const app = read("../../../components/hunt/HuntApp.tsx");
  assert.match(app, /useSpeciesSurface\(/, "HuntApp calls the surface hook");
  assert.match(app, /surfaces=\{surfaceState\.surfaces\}/, "HuntApp hands the surfaces to the map");
  assert.doesNotMatch(app, /useSpeciesHeat\(|opportunity\/heat["`]/, "the zone-keyed heat request is gone");

  const hook = read("../../../components/hunt/map/useSpeciesSurface.ts");
  assert.match(hook, /surfaceUrl\(speciesId, box\)/, "the hook builds the surface URL");
  assert.match(read("./surface-request.ts"), /\/api\/hunt\/species-surface\?speciesId=/);

  const view = read("../../../components/hunt/HuntMapView.tsx");
  assert.match(view, /live\?\.setSurface\(surfaces\)/, "the Google map receives the surface");
  assert.match(view, /surfaces=\{surfaces\}/, "the fallback canvas receives the surface");
  const google = read("../../../components/hunt/map/GoogleZoneMap.ts");
  assert.match(google, /createSurfaceLayer\(maps, this\.map\)/);
  assert.match(read("../../../components/hunt/map/SurfaceLayer.ts"), /getPanes\(\)\?\.mapPane\.appendChild/, "drawn in mapPane: under the zone polygons");
});

test("every certified surface species can be chosen in Find game", () => {
  // The registry decides, not a list: every surface species is flagged …
  for (const entry of surfaceRegistry().surfaces) assert.ok(hasCertifiedSurface(entry.speciesId), entry.speciesId);
  assert.equal(hasCertifiedSurface("species:snowshoe-hare"), false);
  // … the page puts the flag on the option …
  assert.match(read("../../../app/hunt/page.tsx"), /hasSpeciesSurface: hasCertifiedSurface\(resource\.speciesProfile\.speciesId\)/);
  // … and Find game's list admits it on its own, without rules or zone evidence.
  assert.match(read("../../../components/hunt/HuntApp.tsx"), /\|\| option\.hasSpeciesSurface\)/);
});

/* ------------------------------------------------------ independence */

test("nothing on the surface path can see a zone, a season or a date", () => {
  const files = {
    "surface-paint.ts": read("./surface-paint.ts"),
    "surface-request.ts": read("./surface-request.ts"),
    "paint-surface.ts": read("../../../components/hunt/map/paint-surface.ts"),
    "SurfaceLayer.ts": read("../../../components/hunt/map/SurfaceLayer.ts"),
    "useSpeciesSurface.ts": read("../../../components/hunt/map/useSpeciesSurface.ts"),
  };
  const forbidden = /from ["'][^"']*(zone|regulatory|cartography|species-layer|states|geometry-store|legal|season|date)[^"']*["']/i;
  for (const [name, source] of Object.entries(files)) {
    const imports = source.split("\n").filter((line) => /^\s*(import|export)\b.*from\s/.test(line) || /^\s*}\s*from\s/.test(line));
    for (const line of imports) assert.doesNotMatch(line, forbidden, `${name} imports ${line.trim()}`);
  }
  // The request names ground and a species. No zone, no date, ever.
  const url = surfaceUrl("species:ruffed-grouse", { west: -80, south: 44, east: -74, north: 48 });
  assert.deepEqual([...new URL(ORIGIN + url).searchParams.keys()].sort(), ["bbox", "speciesId"]);
});

/** A field with a single hotspot centred on a line we will call a zone boundary. */
function hotspotAcross(boundaryLon: number): RenderableSurface {
  const grid = { west: boundaryLon - 3, south: 44, lonStep: 0.3, latStep: 0.2, cols: 21, rows: 21 };
  const cells = new Map<number, number>();
  for (let row = 0; row < grid.rows; row += 1) {
    for (let col = 0; col < grid.cols; col += 1) {
      const lon = grid.west + col * grid.lonStep;
      const lat = grid.south + row * grid.latStep;
      const d2 = ((lon - boundaryLon) / 1.2) ** 2 + ((lat - 46) / 0.8) ** 2;
      cells.set(row * grid.cols + col, Math.exp(-d2));
    }
  }
  return { id: "surface:test", speciesId: "species:test", continuity: "CONTINUOUS", effectiveResolutionMetres: 40_000, grid, cells };
}

const answer = (open: boolean, conditions = false, state = "SEASON_AVAILABLE"): ZoneSpeciesAnswer => ({
  state,
  opportunity: { hasCurrentLegalOpportunity: open, hasMaterialConditions: conditions },
} as unknown as ZoneSpeciesAnswer);

test("a hotspot crosses a zone boundary unchanged: the boundary is not an input", () => {
  const boundary = -76.9;
  const surface = hotspotAcross(boundary);
  // Either side of the line, a metre apart: the field is continuous through it.
  const west = sampleSurface(surface, 46, boundary - 0.00001)!;
  const east = sampleSurface(surface, 46, boundary + 0.00001)!;
  assert.ok(west > 0.9 && east > 0.9, "the hotspot sits on the line");
  assert.ok(Math.abs(west - east) < 1e-4, "no step at the boundary");
  // Symmetric about the line, because the evidence is — not clipped to a side.
  for (const offset of [0.3, 0.9, 1.8]) {
    const w = sampleSurface(surface, 46, boundary - offset)!;
    const e = sampleSurface(surface, 46, boundary + offset)!;
    assert.ok(Math.abs(w - e) < 0.02, `symmetric at ±${offset}°`);
  }
});

test("legality cannot alter heat, and heat cannot alter legality", () => {
  const surface = hotspotAcross(-76.9);
  const points = [[46, -76.9], [46.4, -77.5], [45.2, -75.8]] as const;
  const before = points.map(([lat, lon]) => sampleSurface(surface, lat, lon));
  // Every legality the zones around it could have.
  const answers = [answer(true), answer(true, true), answer(false, false, "CLOSED"), answer(false, false, "UNKNOWN")];
  for (const zone of answers) {
    // Legality is a function of the answer alone …
    const green = zoneIsGreen(zone);
    const flagged = zoneHasConditions(zone);
    assert.equal(green, zone.opportunity.hasCurrentLegalOpportunity);
    assert.equal(flagged, green && zone.opportunity.hasMaterialConditions);
    // … and the field is identical whatever it is.
    assert.deepEqual(points.map(([lat, lon]) => sampleSurface(surface, lat, lon)), before);
  }
  // The sampler's arity is (surface, latitude, longitude): there is no slot for a zone.
  assert.equal(sampleSurface.length, 3);
  assert.equal(zoneIsGreen.length, 1);
});

test("a closed zone may hold strong heat, an open one weak heat, and an unknown one any heat", () => {
  const surface = hotspotAcross(-76.9);
  const strong = sampleSurface(surface, 46, -76.9)!;
  const weak = sampleSurface(surface, 44.2, -79.6)!;
  assert.ok(strong > 0.9 && weak < 0.05);
  // Each pairing is representable: green comes from the answer, colour from the field.
  const cases = [
    { zone: answer(false, false, "CLOSED"), heat: strong, green: false },
    { zone: answer(true), heat: weak, green: true },
    { zone: answer(false, false, "UNKNOWN"), heat: strong, green: false },
  ];
  for (const { zone, heat, green } of cases) {
    assert.equal(zoneIsGreen(zone), green);
    assert.ok(rampAt(heat).alpha >= 0);
  }
  // Strong heat reads strong and weak heat reads weak, regardless of the zone.
  assert.ok(rampAt(strong).alpha > rampAt(weak).alpha);
});

test("a reply for the previous species is discarded, never merged", async () => {
  const { status, payload } = await ask("species:wild-turkey", surfaceRequestBox(ONTARIO_VIEW));
  // The hunter has already moved to ruffed grouse when turkey's reply lands.
  assert.equal(surfaceStateFromReply("species:ruffed-grouse", "species:wild-turkey", status, payload), null);
  // Or has cleared the species altogether.
  assert.equal(surfaceStateFromReply(null, "species:wild-turkey", status, payload), null);
  // A reply that claims one species under another's request is not drawn either.
  assert.equal(surfaceStateFromReply("species:ruffed-grouse", "species:ruffed-grouse", status, payload), null);
  // Only the matching reply becomes state, and every surface in it is that species'.
  const own = surfaceStateFromReply("species:wild-turkey", "species:wild-turkey", status, payload);
  assert.ok(own?.surfaces.length);
  assert.ok(own.surfaces.every((surface) => surface.speciesId === "species:wild-turkey"));
});

test("SAMPLE_PLOT stays discrete and the BBS field stays continuous — mallard returns both", async () => {
  const { status, payload } = await ask("species:mallard", surfaceRequestBox({ west: -80, south: 43, east: -64, north: 48 }));
  assert.equal(status, 200);
  const kinds = (payload.surfaces ?? []).map((surface) => `${surface.geometryKind}:${surface.continuity}`);
  assert.ok(kinds.includes("SAMPLE_PLOT:DISCRETE"), kinds.join());
  assert.ok(kinds.includes("MODELLED_RASTER:CONTINUOUS"), kinds.join());
  const state = surfaceStateFromReply("species:mallard", "species:mallard", status, payload)!;
  const plots = state.surfaces.find((surface) => surface.continuity === "DISCRETE")!;
  const field = state.surfaces.find((surface) => surface.continuity === "CONTINUOUS")!;
  // Plots carry their own outlines and no grid: nothing can be interpolated between them.
  assert.ok(plots.plots?.length && !plots.cells && !plots.grid);
  assert.ok(field.cells?.size && !field.plots);
  // Ground between two plots is not sampled from them.
  assert.equal(sampleSurface(plots, 45, -75), null);
  // Plot legend says the ground outside a plot was not surveyed.
  const plotLayer = state.legend!.layers.find((layer) => layer.geometryKind === "SAMPLE_PLOT")!;
  assert.equal(plotLayer.unmappedGround, "NOT_SURVEYED");
});

test("no data is not surveyed zero: null is transparent, 0 is the faintest drawn shade", () => {
  const reply: ReplySurface = {
    id: "surface:t", speciesId: "species:t", geometryKind: "MODELLED_RASTER", continuity: "CONTINUOUS",
    unmappedGround: "NO_EVIDENCE_HELD", effectiveResolution: { metres: 40_000, statedAs: "40 km" },
    cells: { origin: [-80, 45], stepDegrees: [0.3, 0.2], columns: 3, rows: 1, values: [null, 0, 1000] },
  };
  const surface = toRenderable(reply)!;
  assert.equal(surface.cells!.has(0), false, "null never becomes a key");
  assert.equal(surface.cells!.get(1), 0, "a surveyed zero is kept");
  assert.equal(sampleSurface(surface, 45, -80), null, "unsurveyed ground is not drawn");
  const zero = sampleSurface(surface, 45, -79.7);
  assert.equal(zero, 0);
  // Zero is drawn — faintly — because it is a finding; null is not drawn at all.
  assert.equal(rampAt(0).alpha, 0);
  assert.ok(rampAt(0.02).alpha > 0, "the faintest surveyed shade is visible");
  // An all-null reply is not a surface.
  assert.equal(toRenderable({ ...reply, cells: { ...reply.cells!, values: [null, null, null] } }), null);
});

test("smoothing never claims a finer resolution than the evidence", () => {
  const reply: ReplySurface = {
    id: "surface:t", speciesId: "species:t", geometryKind: "MODELLED_RASTER", continuity: "CONTINUOUS",
    unmappedGround: "NO_EVIDENCE_HELD", effectiveResolution: { metres: 40_000, statedAs: "40 km Gaussian bandwidth" },
    cells: { origin: [-80, 45], stepDegrees: [0.3, 0.2], columns: 2, rows: 2, values: [0, 1000, 0, 1000] },
  };
  const surface = toRenderable(reply)!;
  // The declared resolution travels unchanged; the grid step does not replace it.
  assert.equal(surface.effectiveResolutionMetres, 40_000);
  const state = surfaceStateFromReply("species:t", "species:t", 200, { speciesId: "species:t", surfaces: [reply], emptyMeans: "" })!;
  assert.equal(state.legend!.layers[0].resolutionStatedAs, "40 km Gaussian bandwidth");
  // A surface that states no resolution is treated as coarse, never fine.
  const unstated = toRenderable({ ...reply, effectiveResolution: { metres: null, statedAs: "not stated" } })!;
  assert.ok(unstated.effectiveResolutionMetres >= 40_000);
});

test("four outcomes stay apart: drawn, not held, none here, unavailable", async () => {
  // Not held: moose has no surface. The server's own sentence is kept.
  const moose = await ask("species:moose", surfaceRequestBox(ONTARIO_VIEW));
  assert.equal(moose.status, 404);
  const notHeld = surfaceStateFromReply("species:moose", "species:moose", moose.status, moose.payload)!;
  assert.equal(notHeld.outcome, "NOT_HELD");
  assert.equal(notHeld.surfaces.length, 0);
  assert.match(notHeld.message ?? "", /not a finding about the animals/i);

  // None here: ruffed grouse has a surface, and it does not reach the Gulf coast.
  const gulf = await ask("species:ruffed-grouse", { west: -98, south: 18, east: -96, north: 19 });
  assert.equal(gulf.status, 200);
  const none = surfaceStateFromReply("species:ruffed-grouse", "species:ruffed-grouse", gulf.status, gulf.payload)!;
  assert.equal(none.outcome, "NONE_IN_VIEW");
  assert.match(none.message ?? "", /not a finding that the species is absent/i);
  assert.doesNotMatch(none.message ?? "", /No certified evidence is held for this species/);

  // Unavailable: the request failed. Nothing drawn, nothing claimed about animals.
  const failed = surfaceStateFromReply("species:ruffed-grouse", "species:ruffed-grouse", 0, null)!;
  assert.equal(failed.outcome, "UNAVAILABLE");
  assert.equal(failed.surfaces.length, 0);
  assert.match(failed.message ?? "", /nothing is implied about the animals/i);
});

test("the request box covers the renderer's margin and snaps to shareable boxes", () => {
  const view = { west: -76.43, south: 45.21, east: -75.12, north: 45.88 };
  const box = surfaceRequestBox(view);
  // The renderer paints 30% past each edge; the reply must cover that ground.
  const latPad = (view.north - view.south) * 0.3;
  const lonPad = (view.east - view.west) * 0.3;
  assert.ok(boxContains(box, { west: view.west - lonPad, south: view.south - latPad, east: view.east + lonPad, north: view.north + latPad }));
  // Snapped to half-degrees, so two hunters looking at nearly the same ground
  // ask the same URL and the CDN answers the second.
  for (const value of Object.values(box)) assert.equal(Math.round(value * 2), value * 2);
  assert.equal(surfaceUrl("species:x", box), surfaceUrl("species:x", surfaceRequestBox({ ...view, west: view.west + 0.01 })));
});
