import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { paintFor, sampleSurfaceWithSupport, SURVEYED_NONE, type RenderableSurface } from "./surface-paint.ts";

/**
 * THE VISUAL TRANSFORM NEVER CHANGES THE VALUE (CLAUDE.md §41B, 2026-09-30).
 *
 * How a value becomes a colour — sampling, smoothing, edge fade, opacity — is
 * presentation. These tests hold that presentation can soften and fade, and
 * can never invent a value the surface does not hold. The defect they were
 * written against blended "surveyed, none found" (0) into detected values, so
 * the renderer painted a blue fringe of low ranks that no survey produced.
 */

function field(cells: Array<[number, number, number]>): RenderableSurface {
  return {
    id: "surface:test",
    speciesId: "species:test",
    continuity: "CONTINUOUS",
    effectiveResolutionMetres: 40_000,
    grid: { latStep: 1, lonStep: 1, south: 0, west: 0, rows: 10, cols: 10 },
    cells: new Map(cells.map(([row, col, value]) => [row * 10 + col, value])),
  };
}

test("between found and none-found, the found side keeps its value and the other stays none", () => {
  /* A detected cell at 0.8 beside a surveyed-none cell. */
  const surface = field([[2, 2, 0.8], [2, 3, 0]]);
  /* Just on the found side of the midline: the value is the found cell's, not a blend toward 0. */
  const foundSide = sampleSurfaceWithSupport(surface, 2, 2.45);
  assert.equal(foundSide?.value, 0.8);
  /* Just on the none-found side: exactly 0, which paints the neutral, never the ramp. */
  const noneSide = sampleSurfaceWithSupport(surface, 2, 2.55);
  assert.equal(noneSide?.value, 0);
  assert.deepEqual(paintFor(noneSide!.value), SURVEYED_NONE);
  /* The boundary softens in opacity from both sides instead. */
  assert.ok(foundSide!.support < 1 && noneSide!.support < 1);
});

test("found ground blends only with found ground, so a value stays between its detected neighbours", () => {
  const surface = field([[4, 4, 0.2], [4, 5, 0.9], [5, 4, 0], [5, 5, 0]]);
  for (let lat = 4; lat <= 4.49; lat += 0.07) {
    for (let lon = 4; lon <= 5; lon += 0.1) {
      const sample = sampleSurfaceWithSupport(surface, lat, lon);
      if (!sample || sample.value === 0) continue;
      assert.ok(sample.value >= 0.2 - 1e-9 && sample.value <= 0.9 + 1e-9, `${lat},${lon} → ${sample.value}`);
    }
  }
});

test("on the committed ruffed grouse field, rendering never manufactures a value below the detected ground around it", () => {
  const artifact = JSON.parse(readFileSync("content/intelligence/surfaces/ruffed-grouse.json", "utf8"));
  const { grid, cells: packed } = artifact;
  const cells = new Map<number, number>();
  packed.row.forEach((row: number, i: number) => cells.set(row * grid.cols + packed.col[i], packed.intensity[i] / 1000));
  const surface: RenderableSurface = { id: artifact.id, speciesId: artifact.speciesId, continuity: "CONTINUOUS", effectiveResolutionMetres: 40_000, grid, cells };
  let checked = 0;
  let zerosPaintedOnRamp = 0;
  let belowNeighbours = 0;
  /* Southern Québec and Ontario, where found and none-found ground interleave. */
  for (let lat = 43; lat <= 49; lat += 0.037) {
    for (let lon = -82; lon <= -70; lon += 0.041) {
      const sample = sampleSurfaceWithSupport(surface, lat, lon);
      if (!sample) continue;
      checked += 1;
      const row = Math.round((lat - grid.south) / grid.latStep);
      const col = Math.round((lon - grid.west) / grid.lonStep);
      const nearest = cells.get(row * grid.cols + col)!;
      if (nearest === 0 && sample.value !== 0) zerosPaintedOnRamp += 1;
      if (nearest > 0) {
        const r0 = Math.floor((lat - grid.south) / grid.latStep);
        const c0 = Math.floor((lon - grid.west) / grid.lonStep);
        const around = [[0, 0], [0, 1], [1, 0], [1, 1]]
          .map(([dr, dc]) => cells.get((r0 + dr) * grid.cols + c0 + dc))
          .filter((v): v is number => v !== undefined && v > 0);
        if (around.length && sample.value < Math.min(...around) - 1e-9) belowNeighbours += 1;
      }
    }
  }
  assert.ok(checked > 10_000, `sampled ${checked}`);
  assert.equal(zerosPaintedOnRamp, 0, "none-found ground is never painted as a few");
  assert.equal(belowNeighbours, 0, "no sample is lower than the detected cells it blends");
});
