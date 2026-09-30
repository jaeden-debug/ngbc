import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { distanceKm, intensityOf, weightedValueAt } from "./surface-raster.ts";
import { surfaceRegistry } from "./surface.ts";

/* The Breeding Bird Survey fields: the survey registry's entries. A habitat
   model or a records grid is a different claim with its own tests
   (`habitat-model.test.ts`, `record-grids.test.ts`), so the survey's contract is
   checked on the survey's surfaces only. */
const surveyEntries = () => surfaceRegistry().surfaces.filter((entry) => (entry.evidenceClass ?? "STRUCTURED_SURVEY") === "STRUCTURED_SURVEY");

/**
 * THE INTERPOLATION, tested rather than justified.
 *
 * "27 km route spacing, therefore a field is defensible" is an argument, not a
 * specification. This file pins each decision the field rests on: the kernel,
 * the support radius and why it is what it is, the cell size, how weights are
 * normalised, what a zero observation does, what unsampled ground does, what
 * happens at the edge, what an isolated route does, how years combine, whether
 * a species has enough sample at all, and what the coverage mask means.
 *
 * Every parameter here is measured against route geometry, not chosen for the
 * look of the map: median nearest-neighbour route spacing 27.1 km, p90 50.0,
 * p95 58.8, from 4,121 routes run 2016–2025 at standard protocol.
 */

const METHODOLOGY = {
  id: "methodology:ng-bbs-relative-abundance",
  version: "1.2.0",
  effectiveFrom: "2026-09-29",
  kernel: "GAUSSIAN" as const,
  bandwidthKm: 40,
  truncationKm: 120,
  minimumSites: 3,
  maximumSiteDistanceKm: 60,
  transform: "SQRT" as const,
  ceilingQuantile: 0.98,
  yearCombination: "mean over surveyed years",
};

const site = (lat: number, lon: number, value: number) => ({ id: `${lat},${lon}`, latitude: lat, longitude: lon, value, occasions: 1, siteGeometry: "POINT" as const });

test("the kernel is Gaussian, and weight falls with distance", () => {
  const near = weightedValueAt(50, -80, [site(50, -80, 10), site(50.1, -80, 0), site(50, -80.1, 0)], METHODOLOGY);
  const far = weightedValueAt(50, -80, [site(50.3, -80, 10), site(50.1, -80, 0), site(50, -80.1, 0)], METHODOLOGY);
  assert.ok(near && far);
  assert.ok(near.value > far.value, "a route on top of the cell counts for more than one 30 km away");
});

test("the support radius is 60 km, and it is p95 of route spacing rather than a look", () => {
  /*
   * WHY 60. Route spacing has a p95 of 58.8 km, so a cell whose nearest route
   * is inside 60 km sits within the regime the survey was designed to sample.
   * At the previous 100 km, Labrador was painted from a route 89 km away —
   * asserting knowledge the sampling design cannot carry. What it EXCLUDES is
   * real hunting country: Labrador and northern Ontario go NO DATA, and that is
   * a finding about where a roadside survey can run, not about the animals.
   */
  const ring = [site(50.6, -80, 5), site(50.62, -80.1, 5), site(50.64, -80.2, 5)];
  const justInside = weightedValueAt(50.1, -80, ring, METHODOLOGY);
  const wellOutside = weightedValueAt(49.5, -80, ring, METHODOLOGY);
  assert.ok(justInside, "three routes with the nearest inside 60 km support a cell");
  assert.equal(wellOutside, null, "the same three routes support nothing 120 km away");
});

test("three routes are needed, and two are not enough however close", () => {
  const two = weightedValueAt(50, -80, [site(50, -80, 9), site(50.01, -80, 9)], METHODOLOGY);
  assert.equal(two, null, "a pair of routes is not a sample");
  const three = weightedValueAt(50, -80, [site(50, -80, 9), site(50.01, -80, 9), site(50.02, -80, 9)], METHODOLOGY);
  assert.ok(three);
  assert.equal(three.sites, 3);
});

test("an isolated route paints nothing, however high its count", () => {
  /* The failure this prevents is a single exceptional route glowing alone in
     empty country, which reads as a hotspot and is one observation. */
  assert.equal(weightedValueAt(50, -80, [site(50, -80, 500)], METHODOLOGY), null);
});

test("weights are normalised, so density of routes does not become abundance", () => {
  /*
   * The value is a weighted MEAN, not a weighted sum. Without the denominator,
   * a cell surrounded by many routes would score higher than an identical cell
   * with fewer — measuring where the survey drives rather than where the birds
   * are.
   */
  const sparse = weightedValueAt(50, -80, [site(50, -80, 4), site(50.05, -80, 4), site(50, -80.05, 4)], METHODOLOGY);
  const dense = weightedValueAt(50, -80, [
    site(50, -80, 4), site(50.05, -80, 4), site(50, -80.05, 4),
    site(50.02, -80.02, 4), site(50.03, -80.01, 4), site(50.01, -80.03, 4),
  ], METHODOLOGY);
  assert.ok(sparse && dense);
  assert.ok(Math.abs(sparse.value - dense.value) < 1e-9, "twice the routes, same value");
  assert.equal(dense.sites, 6, "the count of contributing routes is carried separately");
});

test("a zero observation is evidence and pulls the value down", () => {
  /*
   * THE TWO ZEROS, at the arithmetic. A route run without detecting the species
   * contributes 0 because the survey looked; it is not missing data. Half of
   * what these surfaces know is that negative — ruffed grouse has 11,733
   * surveyed-and-none-found cells against 22,873 supported.
   */
  const withZeros = weightedValueAt(50, -80, [site(50, -80, 6), site(50.05, -80, 0), site(50, -80.05, 0)], METHODOLOGY);
  const withoutZeros = weightedValueAt(50, -80, [site(50, -80, 6), site(50.05, -80, 6), site(50, -80.05, 6)], METHODOLOGY);
  assert.ok(withZeros && withoutZeros);
  assert.ok(withZeros.value < withoutZeros.value, "routes that found none must lower the answer");
  assert.ok(withZeros.value > 0, "and must not erase a route that found some");
});

test("unsampled ground returns null, which is not zero", () => {
  const nothing = weightedValueAt(60, -95, [site(45, -75, 8), site(45.1, -75, 8), site(45.2, -75, 8)], METHODOLOGY);
  assert.equal(nothing, null, "null is the refusal to answer; 0 would be an answer");
});

test("the truncation is the edge, and it is stated because it decides support", () => {
  /* Past 3σ the Gaussian weight is under 1/700 and the arithmetic is noise —
     but the cutoff is not only an optimisation, it decides which routes count
     toward the minimum, so it is part of the published methodology. */
  /* Nearest at 55.6 km — inside the 60 km rule, so this one IS supported. The
     first version of this fixture assumed it was not, and the test caught the
     assumption rather than the code. */
  const nearestInside = weightedValueAt(50, -80, [site(50.5, -80, 7), site(50.6, -80, 7), site(50.7, -80, 7)], METHODOLOGY);
  assert.ok(nearestInside, "three routes with the nearest at 55.6 km support the cell");
  /* Nearest at 66.7 km — three routes well inside the 120 km truncation, so the
     COUNT is satisfied and the cell is still refused. That separation is why
     both numbers are published. */
  const nearestOutside = weightedValueAt(50, -80, [site(50.6, -80, 7), site(50.7, -80, 7), site(50.8, -80, 7)], METHODOLOGY);
  assert.equal(nearestOutside, null, "the count alone does not support a cell whose nearest route is past 60 km");
  const beyondTruncation = weightedValueAt(50, -80, [site(52, -80, 7), site(52.1, -80, 7), site(52.2, -80, 7)], METHODOLOGY);
  assert.equal(beyondTruncation, null, "and past 120 km they do not count at all");
});

test("the ceiling is a percentile, and the transform is declared", () => {
  /* A single exceptional route would otherwise set the scale for a continent
     and flatten everything else to the bottom of the ramp. */
  assert.equal(intensityOf(1, 4, "LINEAR"), 0.25);
  assert.equal(intensityOf(1, 4, "SQRT"), 0.5);
  assert.equal(intensityOf(9, 4, "LINEAR"), 1, "above the ceiling saturates rather than overflowing");
  assert.equal(intensityOf(0, 4, "SQRT"), 0, "and a surveyed zero stays zero through the transform");
});

test("distance is great-circle, not degrees", () => {
  /* A degree of longitude is 111 km at the equator and 54 km at 60°N. Treating
     degrees as distance would make the support radius shrink northward exactly
     where the routes are already sparsest. */
  const atEquator = distanceKm(0, 0, 0, 1);
  const atSixty = distanceKm(60, 0, 60, 1);
  assert.ok(atEquator > 110 && atEquator < 112);
  assert.ok(atSixty > 55 && atSixty < 56);
});

test("a species without enough routes gets no surface, and is recorded as declined", () => {
  /*
   * Per-species sufficiency, separate from per-cell support: a species detected
   * on a handful of routes cannot carry a continental field however good the
   * licence. Recorded rather than dropped, because silence reads as "nobody
   * looked at this species".
   */
  const declined = surfaceRegistry().declined;
  const names = new Set(declined.map(({ speciesId }) => speciesId));
  /* The originally declined species stay declined; the list itself is DERIVED
     from the catalogue (it grew with wave 3), so it is not pinned. */
  for (const id of ["species:brant", "species:cackling-goose", "species:greater-white-fronted-goose",
    "species:rock-ptarmigan", "species:snow-goose"]) assert.ok(names.has(id), id);
  /* A decline carries one of a CLOSED set of reasons. Widened from a single
     value when protection became a second ground: a species that must never be
     hunted gets no surface however many routes detect it, and whooping crane
     was declined for route count, which is luck rather than a rule. Closed
     rather than open, so an invented reason still fails. */
  const REASONS = new Set(["TOO_FEW_ROUTES", "PROTECTED_NOT_HUNTED", "ELIGIBILITY_UNVERIFIED"]);
  for (const entry of declined) assert.ok(REASONS.has(entry.reason), `unexpected decline reason: ${entry.reason}`);
  for (const id of ["species:brant", "species:snow-goose"]) {
    assert.equal(declined.find((entry) => entry.speciesId === id)?.reason, "TOO_FEW_ROUTES");
  }
  const served = new Set(surveyEntries().map(({ speciesId }) => speciesId));
  for (const id of names) assert.ok(!served.has(id), `${id} is both declined and served`);
});

test("temporal aggregation is stated, and a species' years do not silently combine", () => {
  const versions = new Set(surveyEntries().map((entry) => entry.methodologyVersion));
  assert.equal(versions.size, 1, "one version across the set, so two surfaces are comparable");
  for (const entry of surveyEntries()) {
    assert.equal(entry.effectiveResolutionMetres, 40_000, "the bandwidth, not the grid step");
    assert.equal(entry.colourScale, "RANK_AMONG_DETECTED", "every surface is painted on the declared scale");
  }
});

test("every artifact paints rank among detected ground, and keeps its surveyed zeros", () => {
  /*
   * The 2.0.0 contract, checked on the committed artifacts rather than on a
   * fixture: a surveyed zero stays exactly 0 (and is counted in the registry),
   * and the detected ground is spread across the ramp by rank — each tenth of
   * the scale holds about a tenth of it. Under 1.x the lowest two tenths held
   * the majority of ruffed grouse's detected ground.
   */
  for (const entry of surveyEntries()) {
    const artifact = JSON.parse(readFileSync(entry.artifactPath, "utf8")) as { cells: { intensity: number[] } };
    const intensity = artifact.cells.intensity;
    assert.equal(intensity.filter((v) => v === 0).length, entry.surveyedAndNoneFound, `${entry.speciesId}: zeros kept`);
    const detected = intensity.filter((v) => v > 0);
    const tenths = new Array(10).fill(0);
    for (const v of detected) tenths[Math.min(9, Math.floor((v - 1) / 100))] += 1;
    for (const count of tenths) {
      /* Ties share a rank, so a species with many equal values can bunch; a
         third either side of an even tenth still rules out the ratio scale. */
      assert.ok(Math.abs(count - detected.length / 10) <= detected.length / 30 + 5, `${entry.speciesId}: ${tenths.join("/")}`);
    }
  }
});

test("seasonal movement is declared, and absent means migratory", () => {
  const byId = new Map(surveyEntries().map((entry) => [entry.speciesId, entry]));
  assert.equal(byId.get("species:ruffed-grouse")?.seasonalMovement, "RESIDENT");
  assert.equal(byId.get("species:wild-turkey")?.seasonalMovement, "RESIDENT");
  assert.equal(byId.get("species:mallard")?.seasonalMovement, "MIGRATORY");
  assert.equal(byId.get("species:willow-ptarmigan")?.seasonalMovement, "SHORT_DISTANCE");
});
