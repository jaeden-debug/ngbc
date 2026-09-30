import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { catalogueSpecies } from "./species-catalogue.ts";
import { spatialStrategies, spatialStrategyFor } from "./spatial-strategy.ts";
import { surfaceRegistry } from "./surface.ts";

/**
 * Every species North Ground publishes has an explicit answer to "where is
 * it?", derived from what is held and never from what is planned.
 *
 * The owner's reading of the live map — "only ruffed grouse has a heat map" —
 * could not have been checked against anything, because no record said per
 * species what was drawn. These tests are that record's guarantees.
 */

const declared = JSON.parse(readFileSync("content/intelligence/spatial-strategy.json", "utf8")) as {
  species: Record<string, { family: string }>;
};

test("every published species has a declared family and plan, and nothing else does", () => {
  const published = catalogueSpecies().map(({ speciesId }) => speciesId).sort();
  assert.deepEqual(Object.keys(declared.species).sort(), published,
    "a species added to the catalogue needs its entry in content/intelligence/spatial-strategy.json");
});

test("no species is left without a strategy", () => {
  for (const row of spatialStrategies()) assert.notEqual(row.stage, "NO_STRATEGY", row.speciesId);
});

test("a certified surface is strategy B and at least served; a plan is never coverage", () => {
  const withSurface = new Set(surfaceRegistry().surfaces.map((entry) => entry.speciesId));
  for (const row of spatialStrategies()) {
    if (withSurface.has(row.speciesId)) {
      assert.equal(row.strategy, "B_MEASURED_DISTRIBUTION", row.speciesId);
      assert.ok(["SERVED", "RENDERED", "PRODUCTION_VERIFIED"].includes(row.stage), row.speciesId);
      assert.equal(row.statement, null, "a drawn surface speaks through its own legend");
    } else if (!row.plotJurisdictions.length) {
      /* Planned C or D, or not: without a held surface the stage stays at the
         strategy and the hunter is told why nothing is painted. */
      assert.equal(row.stage, "STRATEGY_DEFINED", row.speciesId);
      assert.match(row.statement ?? "", /not a finding about the animals/, row.speciesId);
      assert.ok(row.strategy === "D_COARSE_SUPPORTING" || row.strategy === "E_NO_DEFENSIBLE_SURFACE", row.speciesId);
    }
  }
});

test("zone evidence is named by the jurisdictions that hold it, and promises the card", () => {
  const moose = spatialStrategyFor("species:moose");
  /* Alberta's densities are animals per km², and still one figure per unit:
     a better number, not a finer place, so moose stays D and nothing is painted. */
  assert.equal(moose.strategy, "D_COARSE_SUPPORTING");
  assert.deepEqual(moose.zoneEvidenceJurisdictions, ["jurisdiction:ca-ab", "jurisdiction:ca-bc", "jurisdiction:ca-on"]);
  assert.match(moose.statement ?? "", /harvest records in British Columbia and Ontario/);
  assert.match(moose.statement ?? "", /aerial-survey density estimates in Alberta/);
  assert.match(moose.statement ?? "", /card/);
  assert.match(moose.statement ?? "", /not a surface/);
  /* A species the survey declined says why, in the registry's own words. */
  assert.match(spatialStrategyFor("species:brant").statement ?? "", /Detected on 0 of \d+ routes/);
});

test("a browser verification counts only for the bytes it saw", () => {
  const record = JSON.parse(readFileSync("content/intelligence/surface-verification.json", "utf8")) as {
    rendered: Record<string, { speciesId: string }>;
    productionVerified: Record<string, { speciesId: string }>;
  };
  const current = new Map(surfaceRegistry().surfaces.map((entry) => [entry.speciesId, entry.artifactHash]));
  for (const [hash, seen] of [...Object.entries(record.rendered), ...Object.entries(record.productionVerified)]) {
    if (current.get(seen.speciesId) !== hash) continue;
    /* A current hash lifts its species; a stale one lifts nothing. */
    assert.ok(["RENDERED", "PRODUCTION_VERIFIED"].includes(spatialStrategyFor(seen.speciesId).stage), seen.speciesId);
  }
});

test("the committed coverage matrix is what the registries say", () => {
  execFileSync(process.execPath, ["scripts/report-species-coverage.mjs", "--check"], { stdio: "pipe" });
});
