import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { offeredInHunt, permitsSpeciesHeat, SPECIES_TAKE_ELIGIBILITY } from "../../content/species-eligibility.ts";
import { forEachRasterSample, paintFor, type GeoRect, type RenderableSurface } from "../exploration/surface-paint.ts";
import { OFF_VIEW_MEANS, surfaceInView, surfacePaintsWithin, surfaceRequestBox, surfaceStateFromReply, surfaceUrl, type SurfaceReply } from "../exploration/surface-request.ts";
import { createSpeciesSurfaceHandler } from "./handler.ts";
import { catalogueSpecies } from "./species-catalogue.ts";
import { decodeCells, EMPTY_MEANINGS, EVIDENCE_WINDOWS, evidenceWindowOf, hasCertifiedSurface, surfaceRegistry } from "./surface.ts";

/**
 * EVERY HEAT SURFACE, STRUCTURALLY, END TO END (2026-10-06).
 *
 * The other surface tests each hold one link: the registry certifies what the
 * builders wrote, the endpoint serves every artifact, the four states survive
 * packing. This one walks EVERY species in the live heat universe through
 * every link at once, because the failures this repository has shipped were
 * all a species falling between two links that were each green: 25 surfaces
 * served to no client; 17 species served, decoded and painted nowhere because
 * the renderer read 200° where the evidence said -160°.
 *
 * For each Hunt-eligible species whose class grants heat: it resolves in the
 * catalogue, it is offered in Hunt, and it has a certified surface. For each
 * certified surface: the artifact is on disk with the hash the registry
 * certified, its grid is a possible grid, its cells sit inside that grid and
 * on North American ground, it holds found ground, the endpoint serves it in
 * a month it speaks for and for a viewport inside it, the client decodes the
 * reply into something drawable, the renderer's own sampler paints pixels from
 * it, and — where it reaches the 180° meridian — it reads the same however a
 * view writes the longitudes.
 */

const GET = createSpeciesSurfaceHandler();
const ORIGIN = "https://northgroundbushcraft.com";
const sha = (bytes: Buffer) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

interface Artifact {
  id: string;
  speciesId: string;
  grid: { latStep: number; lonStep: number; south: number; west: number; rows: number; cols: number };
  cells?: { row: ArrayLike<number>; col: ArrayLike<number>; intensity: ArrayLike<number> };
  cellsEncoded?: Parameters<typeof decodeCells>[0];
}

const registry = surfaceRegistry();
const heatUniverse = catalogueSpecies().filter(({ speciesId }) => permitsSpeciesHeat(speciesId));

function declinedReasons(): Map<string, string> {
  const reasons = new Map<string, string>();
  for (const path of ["content/intelligence/surface-registry.json", "content/intelligence/range-habitat-registry.json"]) {
    const file = JSON.parse(readFileSync(path, "utf8")) as { declined?: Array<{ speciesId: string; reason: string; detail?: string }> };
    for (const row of file.declined ?? []) if (row.reason) reasons.set(row.speciesId, `${row.reason}: ${row.detail ?? ""}`);
  }
  return reasons;
}

async function ask(speciesId: string, month: number, box?: { west: number; south: number; east: number; north: number }) {
  const url = box ? ORIGIN + surfaceUrl(speciesId, box, month) : `${ORIGIN}/api/hunt/species-surface?speciesId=${encodeURIComponent(speciesId)}&month=${month}`;
  const response = await GET(new Request(url));
  return { status: response.status, payload: (await response.json()) as SurfaceReply };
}

/** How many of a field's pixels the renderer would paint over a rectangle. */
function painted(surface: RenderableSurface, rect: GeoRect, size = 96): Map<number, number> {
  const out = new Map<number, number>();
  forEachRasterSample(surface, rect, size, size, (at, { value }) => {
    if (paintFor(value).alpha > 0) out.set(at, value);
  });
  return out;
}

test("the heat universe is live, and every species in it has a certified surface", () => {
  /* Derived, never typed: a species enters by its canonical take eligibility
     and nothing else. A count pinned here would be one more number to forget. */
  assert.ok(heatUniverse.length >= 200, `the denominator is the catalogue, not an empty set (${heatUniverse.length})`);
  const declined = declinedReasons();
  const uncovered = heatUniverse
    .filter(({ speciesId }) => !hasCertifiedSurface(speciesId))
    .map(({ speciesId }) => `${speciesId}${declined.has(speciesId) ? ` (declined ${declined.get(speciesId)})` : " (no surface and no stated reason)"}`);
  assert.deepEqual(uncovered, [], "every heat-eligible species is drawable");
  for (const { speciesId } of heatUniverse) assert.ok(offeredInHunt(speciesId), `${speciesId} carries heat but is not offered in Hunt`);
});

test("no surface is certified for a species outside the heat universe", () => {
  const universe = new Set(heatUniverse.map(({ speciesId }) => speciesId));
  const strays = [...new Set(registry.surfaces.map(({ speciesId }) => speciesId))].filter((id) => !universe.has(id));
  assert.deepEqual(strays, [], "a certified surface for a species heat does not cover");
  /* And the reverse refusal holds for every class that grants none. */
  for (const [speciesId, eligibility] of SPECIES_TAKE_ELIGIBILITY) {
    if (!permitsSpeciesHeat(speciesId)) assert.equal(hasCertifiedSurface(speciesId), false, `${speciesId} (${eligibility})`);
  }
});

test("every certified surface: artifact, hash, grid, coordinates, endpoint, client, renderer, antimeridian", async () => {
  assert.ok(registry.surfaces.length >= 200, `the registry holds the surfaces (${registry.surfaces.length})`);
  const failures: string[] = [];
  const fail = (entryId: string, what: string) => failures.push(`${entryId}: ${what}`);
  let crossing = 0;

  for (const entry of registry.surfaces) {
    const id = entry.artifactId;
    /* 1. The artifact the registry certified is on disk, byte for byte. */
    if (!existsSync(entry.artifactPath)) { fail(id, `no artifact at ${entry.artifactPath}`); continue; }
    const bytes = readFileSync(entry.artifactPath);
    if (sha(bytes) !== entry.artifactHash) { fail(id, "artifact does not match the hash the registry certified"); continue; }
    const artifact = JSON.parse(bytes.toString("utf8")) as Artifact;
    if (artifact.id !== id) fail(id, `artifact id ${artifact.id}`);
    if (artifact.speciesId !== entry.speciesId) fail(id, `artifact species ${artifact.speciesId}`);

    /* 2. A possible grid: finite positive steps, whole counts, inside the globe,
       no wider than one turn of longitude. */
    const g = artifact.grid;
    const finite = [g.latStep, g.lonStep, g.south, g.west, g.rows, g.cols].every(Number.isFinite);
    if (!finite || g.latStep <= 0 || g.lonStep <= 0 || !Number.isInteger(g.rows) || !Number.isInteger(g.cols) || g.rows < 1 || g.cols < 1) {
      fail(id, `impossible grid ${JSON.stringify(g)}`);
      continue;
    }
    const north = g.south + (g.rows - 1) * g.latStep;
    const east = g.west + (g.cols - 1) * g.lonStep;
    if (g.south < -90 || north > 90) fail(id, `grid latitude ${g.south}..${north}`);
    if (east - g.west >= 360 || g.west < -360 || east > 180 + g.lonStep) fail(id, `grid longitude ${g.west}..${east}`);

    /* 3. Cells inside the grid, found ground present, all of it on North
       American ground (the strip past 180 is stored below -180). */
    const cells = artifact.cells ?? (artifact.cellsEncoded ? decodeCells(artifact.cellsEncoded) : null);
    if (!cells || !cells.row.length) { fail(id, "no cells"); continue; }
    let found = 0;
    let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
    const foundCells: Array<[number, number]> = [];
    for (let i = 0; i < cells.row.length; i += 1) {
      const r = cells.row[i];
      const c = cells.col[i];
      if (r < 0 || r >= g.rows || c < 0 || c >= g.cols) { fail(id, `cell ${r},${c} outside a ${g.rows}x${g.cols} grid`); break; }
      if (cells.intensity[i] <= 0) continue;
      found += 1;
      const lat = g.south + r * g.latStep;
      const lon = g.west + c * g.lonStep;
      foundCells.push([lat, lon]);
      minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
      minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon);
    }
    if (!found) { fail(id, "holds no found ground: nothing a hunter could be shown"); continue; }
    if (minLat < 15 || maxLat > 84 || minLon < -188.1 || maxLon > -50) fail(id, `found ground outside North America: ${minLat}..${maxLat}, ${minLon}..${maxLon}`);

    /* 4. Served in a month it speaks for, whole and for a viewport inside it. */
    const month = EVIDENCE_WINDOWS[evidenceWindowOf(entry)].months[0];
    const whole = await ask(entry.speciesId, month);
    if (whole.status !== 200) { fail(id, `month ${month} → ${whole.status}`); continue; }
    if (!(whole.payload.surfaces ?? []).some((s) => s.id === id)) { fail(id, `month ${month} → 200 without ${id}`); continue; }
    foundCells.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const [lat, lon] = foundCells[Math.floor(foundCells.length / 2)];
    const wireLon = lon < -180 ? lon + 360 : lon;
    const view = { west: Math.max(-180, wireLon - 3), south: lat - 2, east: Math.min(180, wireLon + 3), north: lat + 2 };
    const regional = await ask(entry.speciesId, month, view);
    if (regional.status !== 200 || !(regional.payload.surfaces ?? []).some((s) => s.speciesId === entry.speciesId)) {
      fail(id, `a viewport inside its own range (${JSON.stringify(view)}) → ${regional.status} with ${regional.payload.surfaces?.length ?? 0} surfaces`);
    }

    /* 5. The client decodes the reply into this surface, drawable. */
    const state = surfaceStateFromReply(entry.speciesId, entry.speciesId, whole.status, whole.payload);
    const renderable = state?.surfaces.find((s) => s.id === id);
    if (state?.outcome !== "DRAWN" || !renderable?.grid) { fail(id, `client outcome ${state?.outcome ?? "discarded"}`); continue; }

    /* 6. The renderer's own sampler paints it, over its own extent. */
    const rg = renderable.grid;
    const rect: GeoRect = { west: rg.west, east: rg.west + rg.cols * rg.lonStep, south: Math.max(-85, rg.south), north: Math.min(85, rg.south + rg.rows * rg.latStep) };
    if (!painted(renderable, rect).size) fail(id, "the renderer paints nothing over the surface's own extent");

    /* 7. At the 180° meridian, a view reads the same however it is written.
       Sampled over the ground the surface actually holds west of 170°W, at a
       quarter of a cell, so one small island is not stepped over. */
    const western = foundCells.filter(([, cellLon]) => cellLon < -170);
    if (western.length) {
      crossing += 1;
      const pad = Math.max(rg.latStep, rg.lonStep);
      const south = Math.min(...western.map(([cellLat]) => cellLat)) - pad;
      const north = Math.max(...western.map(([cellLat]) => cellLat)) + pad;
      const west = Math.min(...western.map(([, cellLon]) => cellLon)) - pad;
      const east = -170;
      const cols = Math.min(800, Math.ceil((east - west) / (rg.lonStep / 4)));
      const rows = Math.min(800, Math.ceil((north - south) / (rg.latStep / 4)));
      const sample = (rect: GeoRect) => {
        const out = new Map<number, number>();
        forEachRasterSample(renderable, rect, cols, rows, (at, { value }) => { if (paintFor(value).alpha > 0) out.set(at, value); });
        return out;
      };
      /* As Google reports a view across the line (west of it in the eastern
         hemisphere), and unwrapped one turn west. */
      const asReported = sample({ south, north, west: west + 360, east: east + 360 });
      const unwrapped = sample({ south, north, west, east });
      if (!asReported.size) fail(id, `a view across 180° paints nothing of the ${western.length} cells the surface holds west of 170°W`);
      /* The same pixels, and the same values to floating-point noise: 172 + x
         and -188 + x land on the grid a few ulps apart. */
      const same = asReported.size === unwrapped.size && [...asReported].every(([at, value]) => unwrapped.has(at) && Math.abs(unwrapped.get(at)! - value) < 1e-6);
      if (!same) fail(id, "a view across 180° reads differently depending on how its longitudes are written");
      /* Ground stored past 180 (the Rat and Near Islands, below -180 in the
         grid's frame) is painted when a view asks for it as 172°E–180°. Both
         readings above could agree by both losing it; this one cannot. */
      const pastTheLine = western.filter(([, cellLon]) => cellLon < -180);
      if (pastTheLine.length) {
        const stripWest = Math.min(...pastTheLine.map(([, cellLon]) => cellLon)) - pad;
        const strip = sample({
          south: Math.min(...pastTheLine.map(([cellLat]) => cellLat)) - pad,
          north: Math.max(...pastTheLine.map(([cellLat]) => cellLat)) + pad,
          west: stripWest + 360,
          east: 180,
        });
        if (!strip.size) fail(id, `${pastTheLine.length} cells east of 180° are held and a view of 172°E–180° paints none of them`);
      }
    }
  }
  assert.deepEqual(failures, [], `${failures.length} structural failures`);
  assert.ok(crossing > 0, "at least one surface reaches the 180° meridian, so the antimeridian check is not vacuous");
});

test("a view that misses a species' map is told where the map is, in the month asked", async () => {
  /* The zebra dove lives on Hawaiʻi's main islands; asked over Ontario the
     answer is not an empty layer but the ground its map describes. */
  const dove = await ask("species:zebra-dove", 10, { west: -80, south: 43, east: -74, north: 47 });
  assert.equal(dove.status, 200);
  assert.equal(dove.payload.surfaces?.length ?? 0, 0);
  const box = dove.payload.elsewhere;
  assert.ok(box, "the empty answer says where the map lies");
  assert.ok(box.west >= -160.6 && box.east <= -154.5 && box.south >= 18.5 && box.north <= 22.6, `inside the main Hawaiian Islands: ${JSON.stringify(box)}`);
  assert.doesNotMatch(dove.payload.emptyMeans ?? "", /surveys/, "a range map is not called a survey");
  /* A range that reaches Attu says so in the grid's frame, below -180. */
  const goose = await ask("species:emperor-goose", 10, { west: -80, south: 43, east: -74, north: 47 });
  assert.ok((goose.payload.elsewhere?.west ?? 0) < -180, `the emperor goose's map runs past 180°: ${JSON.stringify(goose.payload.elsewhere)}`);
});

test("a reply that holds a map no part of the view shows is shown as mapped elsewhere", async () => {
  /* PRODUCTION, 2026-10-06, desktop. A shared zebra-dove link opens over
     eastern North America at 1280x800; the view runs to about 146°W, its
     request (the view plus the renderer's margin) to 180°W, and Hawaiʻi is
     in the reply. The legend named a drawn "Range + habitat" layer over a
     map with nothing painted on it — the empty toggle §41B forbids. */
  const view = { west: -146, south: 22, east: -34, north: 70 };
  const box = surfaceRequestBox(view);
  assert.ok(box.west <= -160.2, `the margin reaches Hawaiʻi, as it did in production: ${JSON.stringify(box)}`);
  const reply = await ask("species:zebra-dove", 10, box);
  assert.equal(reply.status, 200);
  assert.ok((reply.payload.surfaces?.length ?? 0) > 0, "the reply holds the map: the defect's premise");
  assert.ok(reply.payload.extent, "every reply says where the whole map lies");
  const state = surfaceStateFromReply("species:zebra-dove", "species:zebra-dove", 200, reply.payload)!;
  assert.equal(state.outcome, "DRAWN");
  assert.equal(surfacePaintsWithin(state.surfaces, view), false, "no found cell lies in the view");
  const shown = surfaceInView(state, view);
  assert.equal(shown.outcome, "NONE_IN_VIEW");
  assert.deepEqual(shown.elsewhere, reply.payload.extent);
  assert.equal(shown.surfaces, state.surfaces, "the renderer keeps the surfaces, so a pan paints them at once");
  /* Over the islands the same reply is drawn, unchanged. */
  const islands = { west: -161, south: 18, east: -154, north: 23 };
  assert.equal(surfaceInView(state, islands), state);
  /* A view over Attu, written as the map writes one across 180°, sees the
     emperor goose's cells stored below -180. */
  const across = { west: 170, south: 50, east: -170, north: 56 };
  const goose = await ask("species:emperor-goose", 10, surfaceRequestBox(across));
  const gooseState = surfaceStateFromReply("species:emperor-goose", "species:emperor-goose", 200, goose.payload)!;
  assert.equal(gooseState.outcome, "DRAWN");
  assert.equal(surfacePaintsWithin(gooseState.surfaces, across), true, "a view across 180° sees the strip");
  assert.equal(surfaceInView(gooseState, across), gooseState);
  assert.equal(surfacePaintsWithin(gooseState.surfaces, { west: 172.5, south: 52, east: 179.9, north: 54 }), true, "a view wholly east of 180° sees the strip");
});

test("the client's and the server's sentence for a map elsewhere are one sentence", () => {
  assert.equal(OFF_VIEW_MEANS, EMPTY_MEANINGS.NONE_IN_VIEW);
});
