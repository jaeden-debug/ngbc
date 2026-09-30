import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { gunzipSync } from "node:zlib";
import { paintFor, sampleSurface, sampleSurfaceWithSupport, stateOf, UNSUITABLE_VALUE } from "../exploration/surface-paint.ts";
import { toRenderable } from "../exploration/surface-request.ts";
import {
  ageOf, decodeCells, MAX_LEVEL_OF_DETAIL, packCells, speciesSurfaces, stalenessOf, STALENESS_RULES, surfaceRegistry, UNSUITABLE,
} from "./surface.ts";

/**
 * THE FOUR STATES, END TO END (CLAUDE.md §41B, 2026-09-30).
 *
 * A measured zero, no data, modelled unsuitable and outside the range are four
 * different findings, and a map that lets any two of them look alike tells a
 * hunter something nobody established. These tests follow each state from the
 * artifact through the packing the endpoint does, the conversion the client
 * does and the sampler the renderer runs, and hold the rules around them:
 * smoothing never paints past the range, islands survive a coarse view,
 * terrestrial animals are never drawn over water, and every surface says how
 * finely it may be read, how much weight it bears and how old it is.
 */

const GRID = { latStep: 1, lonStep: 1, south: 0, west: 0, rows: 8, cols: 8 };
const cellsOf = (list: Array<[number, number, number]>) => ({
  row: Int32Array.from(list.map(([r]) => r)),
  col: Int32Array.from(list.map(([, c]) => c)),
  intensity: Int16Array.from(list.map(([, , v]) => v)),
});

test("packing keeps the four states apart, and a coarse block never blends them", () => {
  /* Row 0: found, zero, unsuitable, and a gap (no cell) — at full detail. */
  const cells = cellsOf([[0, 0, 800], [0, 1, 0], [0, 2, UNSUITABLE]]);
  const full = packCells(GRID, cells, undefined, 1000);
  assert.ok(full && full !== "TOO_LARGE");
  assert.deepEqual(full.values.slice(0, 3), [800, 0, UNSUITABLE]);
  assert.equal(full.values.length, 3, "only the occupied extent travels");

  /* One block holding all three: the found value wins, and is not averaged with the zero or the unsuitable. */
  const block = packCells(GRID, cellsOf([[0, 0, 800], [0, 1, 0], [1, 0, UNSUITABLE], [1, 1, 400]]), undefined, 1);
  assert.ok(block && block !== "TOO_LARGE");
  assert.equal(block.levelOfDetail, 2);
  assert.deepEqual(block.values, [600]);
  /* Zero outranks unsuitable in a block with no found cell; unsuitable outranks nothing. */
  const zeroBlock = packCells(GRID, cellsOf([[0, 0, 0], [1, 1, UNSUITABLE]]), undefined, 1);
  assert.ok(zeroBlock && zeroBlock !== "TOO_LARGE");
  assert.deepEqual(zeroBlock.values, [0]);
  const unsuitableBlock = packCells(GRID, cellsOf([[0, 0, UNSUITABLE], [1, 1, UNSUITABLE]]), undefined, 1);
  assert.ok(unsuitableBlock && unsuitableBlock !== "TOO_LARGE");
  assert.deepEqual(unsuitableBlock.values, [UNSUITABLE]);
});

test("a coarse block is placed at the centre of its cells, not at its corner", () => {
  const packed = packCells(GRID, cellsOf([[0, 0, 500], [1, 1, 500]]), undefined, 1);
  assert.ok(packed && packed !== "TOO_LARGE");
  assert.equal(packed.levelOfDetail, 2);
  assert.deepEqual(packed.origin, [0.5, 0.5], "a 2 × 2 block of nodes 0 and 1 sits at 0.5");
});

test("an island survives the coarsest view, and zooming in recovers it exactly", () => {
  /* A single found cell far from anything else, as a Hawaiian or mountain-top population is. */
  const big = { ...GRID, rows: 400, cols: 400 };
  const island = cellsOf([[3, 397, 750], [200, 10, 500], [200, 11, 500]]);
  const coarse = packCells(big, island, undefined, 30_000);
  assert.ok(coarse && coarse !== "TOO_LARGE");
  assert.ok(coarse.levelOfDetail > 1 && coarse.levelOfDetail <= MAX_LEVEL_OF_DETAIL);
  assert.ok(coarse.values.includes(750), "the island's own value, at any level of detail");
  const zoomed = packCells(big, island, [396, 2, 398.5, 4.5], 30_000);
  assert.ok(zoomed && zoomed !== "TOO_LARGE");
  assert.equal(zoomed.levelOfDetail, 1);
  assert.equal(zoomed.values.filter((v) => v === 750).length, 1, "and exactly one cell of it when zoomed in");
});

test("the client and the renderer keep the states: zero is a finding, unsuitable and outside are drawn as nothing", () => {
  const surface = {
    id: "surface:test", speciesId: "species:test", geometryKind: "RANGE_HABITAT", continuity: "CONTINUOUS" as const, unmappedGround: "NO_EVIDENCE_HELD" as const,
    effectiveResolution: { metres: 11_000, statedAs: "test" },
    cells: { origin: [0, 0] as [number, number], stepDegrees: [1, 1] as [number, number], columns: 4, rows: 1, values: [800, 0, UNSUITABLE, null], levelOfDetail: 1 },
  };
  const renderable = toRenderable(surface);
  assert.ok(renderable?.cells);
  assert.equal(renderable.cells.get(0), 0.8);
  assert.equal(renderable.cells.get(1), 0);
  assert.equal(renderable.cells.get(2), UNSUITABLE_VALUE);
  assert.equal(renderable.cells.has(3), false, "outside the range has no cell at all");
  assert.ok(paintFor(sampleSurface(renderable, 0, 0)!).alpha > 0, "found: on the ramp");
  assert.ok(paintFor(sampleSurface(renderable, 0, 1)!).alpha > 0, "measured zero: its own neutral");
  assert.equal(paintFor(sampleSurface(renderable, 0, 2)!).alpha, 0, "modelled unsuitable: nothing");
  assert.equal(sampleSurface(renderable, 0, 3), null, "outside the range: no sample at all");
  /* A surface with nothing but unsuitable ground in view is not renderable at all. */
  assert.equal(toRenderable({ ...surface, cells: { ...surface.cells, values: [UNSUITABLE, null, null, null] } }), null);
});

test("smoothing never paints past the range or into unsuitable ground (moose, the whole continent)", () => {
  const reply = speciesSurfaces("species:moose", undefined, undefined, { month: 10 });
  const field = reply.surfaces.find((s) => s.geometryKind === "RANGE_HABITAT");
  assert.ok(field?.cells, "moose is drawn from range + habitat");
  const renderable = toRenderable(field as never);
  assert.ok(renderable?.grid && renderable.cells);
  const { grid, cells } = renderable;
  let painted = 0;
  for (let y = 0; y < grid.rows * 3; y += 1) {
    for (let x = 0; x < grid.cols * 3; x += 1) {
      const lat = grid.south + (y / 3) * grid.latStep;
      const lon = grid.west + (x / 3) * grid.lonStep;
      const sample = sampleSurfaceWithSupport(renderable, lat, lon);
      if (!sample || paintFor(sample.value).alpha <= 0) continue;
      painted += 1;
      /* Whatever is painted belongs to a cell that is inside the range and suitable. */
      const nearest = cells.get(Math.round((lat - grid.south) / grid.latStep) * grid.cols + Math.round((lon - grid.west) / grid.lonStep));
      assert.ok(nearest !== undefined && nearest > 0, `painted at ${lat.toFixed(2)}, ${lon.toFixed(2)} where the nearest cell is ${nearest}`);
      assert.equal(stateOf(sample.value), 1, "a painted sample is a found value, never a blend with another state");
    }
  }
  assert.ok(painted > 1000);
});

test("no terrestrial animal is drawn over open water, sea or town it does not live in", () => {
  const manifest = JSON.parse(readFileSync("content/intelligence/foundation/landcover-2019-0.1deg.json", "utf8"));
  const shares = gunzipSync(readFileSync(`content/intelligence/foundation/${manifest.artifact.file}`));
  const groups: string[] = manifest.groups.map((g: { name: string }) => g.name);
  const at = (cell: number, name: string) => shares[cell * groups.length + groups.indexOf(name)] / 100;
  const profiles = JSON.parse(readFileSync("content/intelligence/surface-profiles.json", "utf8")).species;
  let checked = 0;
  for (const entry of surfaceRegistry().surfaces) {
    if (entry.evidenceClass !== "RANGE_HABITAT_MODEL") continue;
    const named = new Set(Object.values(profiles[entry.speciesId]?.landCover ?? {}).flat() as string[]);
    const artifact = JSON.parse(readFileSync(entry.artifactPath, "utf8"));
    const decoded = decodeCells(artifact.cellsEncoded);
    for (let i = 0; i < decoded.row.length; i += 1) {
      if (decoded.intensity[i] <= 0) continue;
      const cell = (manifest.grid.rows - 1 - decoded.row[i]) * manifest.grid.columns + decoded.col[i];
      for (const cover of ["WATER", "SEA", "BUILT", "SNOW_ICE"]) {
        if (named.has(cover) || (cover === "SNOW_ICE" && named.has("SNOW_ICE"))) continue;
        assert.ok(at(cell, cover) < 0.5, `${entry.speciesId}: painted over ${cover} (${at(cell, cover)})`);
      }
      if (!named.has("WATER") && !named.has("SEA")) assert.ok(at(cell, "WATER") + at(cell, "SEA") < 0.5, `${entry.speciesId}: painted over water`);
      checked += 1;
    }
  }
  assert.ok(checked > 10_000);
});

test("every surface keeps source, model and display resolution apart, and is never read finer than its model", () => {
  for (const speciesId of ["species:ruffed-grouse", "species:moose", "species:mallard"]) {
    for (const surface of speciesSurfaces(speciesId, undefined, 30_000, { month: 10 }).surfaces) {
      const { source, model, display } = surface.resolution;
      for (const r of [source, model, display]) assert.ok(r.statedAs.length > 10, `${surface.id}: resolution stated in words`);
      if (model.metres && display.metres) assert.ok(display.metres >= model.metres, `${surface.id}: display ${display.metres} finer than model ${model.metres}`);
      if (surface.cells?.levelOfDetail && surface.cells.levelOfDetail > 1) assert.match(display.statedAs, /× .* cells per value/);
    }
  }
});

test("confidence is decided by its components and says which, never a percentage and never HIGH for a profile", () => {
  for (const entry of surfaceRegistry().surfaces) {
    if (entry.evidenceClass !== "RANGE_HABITAT_MODEL") continue;
    const { level, rule } = entry.confidence!;
    assert.notEqual(level, "HIGH", `${entry.speciesId}: a habitat profile measures no animals`);
    assert.doesNotMatch(rule, /%/);
    if (entry.surfaceTier === "RANGE_HABITAT") {
      for (const component of ["range evidence", "habitat concordance", "seasonal applicability", "source age", "resolution"]) assert.match(rule, new RegExp(component), `${entry.speciesId}: ${component}`);
      if (level === "MODERATE") assert.doesNotMatch(rule, /: fails/, `${entry.speciesId}: MODERATE with a failing component`);
    }
  }
});

test("staleness is counted against declared rules, and a surface is as current as its oldest input", () => {
  const recent = ageOf("reads", "OCCURRENCE_READ", "2026-09-01", "2026-09-30");
  assert.equal(recent.state, "CURRENT");
  assert.equal(ageOf("reads", "OCCURRENCE_READ", "2023-01-01", "2026-09-30").state, "AGEING");
  assert.equal(ageOf("cover", "LAND_COVER", "2019-12-31", "2026-09-30").state, "AGEING");
  assert.equal(ageOf("survey", "SURVEY", "2010-12-31", "2026-09-30").state, "STALE");
  assert.equal(stalenessOf([recent, ageOf("cover", "LAND_COVER", "2019-12-31", "2026-09-30")]), "AGEING");
  assert.ok(STALENESS_RULES.SURVEY.currentYears < STALENESS_RULES.SURVEY.ageingYears);
  for (const surface of speciesSurfaces("species:moose", undefined, undefined, { month: 10, asOf: "2026-09-30" }).surfaces) {
    assert.ok(surface.staleness.inputs.length >= 2, "records and land cover, each dated");
    assert.equal(surface.staleness.asOf, "2026-09-30");
  }
});

test("no two species share one surface: identical cells are a copied artifact unless a reason is recorded", () => {
  const documented = JSON.parse(readFileSync("content/intelligence/identical-surfaces.json", "utf8")) as { pairs: Array<{ species: string[]; reason: string }> };
  const allowed = new Set(documented.pairs.map((pair) => [...pair.species].sort().join("|")));
  for (const pair of documented.pairs) assert.ok(pair.reason.length > 40, `${pair.species.join(", ")}: a documented identity needs its reason`);
  const bySignature = new Map<string, string[]>();
  const byInput = new Map<string, string[]>();
  for (const entry of surfaceRegistry().surfaces) {
    const artifact = JSON.parse(readFileSync(entry.artifactPath, "utf8"));
    const cells = artifact.cellsEncoded ? decodeCells(artifact.cellsEncoded) : artifact.cells;
    const signature = createHash("sha256")
      .update(Buffer.from(Int32Array.from(cells.row).buffer)).update(Buffer.from(Int32Array.from(cells.col).buffer)).update(Buffer.from(Int32Array.from(cells.intensity).buffer))
      .update(JSON.stringify(artifact.grid)).digest("hex");
    bySignature.set(signature, [...(bySignature.get(signature) ?? []), entry.speciesId]);
    for (const input of artifact.model?.inputs ?? []) {
      if (!String(input.id).startsWith("open occurrence records")) continue;
      byInput.set(input.hash, [...(byInput.get(input.hash) ?? []), entry.speciesId]);
    }
  }
  for (const species of bySignature.values()) {
    const distinct = [...new Set(species)].sort();
    if (distinct.length > 1) assert.ok(allowed.has(distinct.join("|")), `identical surfaces for ${distinct.join(", ")}`);
  }
  for (const species of byInput.values()) {
    const distinct = [...new Set(species)];
    assert.equal(distinct.length, 1, `one read of occurrence records drew the range of ${distinct.join(", ")}`);
  }
});
