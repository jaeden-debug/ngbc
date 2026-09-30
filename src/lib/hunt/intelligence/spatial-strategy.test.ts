import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { toRenderable } from "../exploration/surface-request.ts";
import { permitsHuntingOpportunity } from "../../content/species-eligibility.ts";
import { catalogueSpecies } from "./species-catalogue.ts";
import { GENUINE_BLOCKERS, spatialStrategies, spatialStrategyFor } from "./spatial-strategy.ts";
import { speciesSurfaces, surfaceRegistry, TIER_MEANING } from "./surface.ts";

/**
 * EVERY HUNT-ELIGIBLE SPECIES HAS A MAP (CLAUDE.md §41B, 2026-09-30).
 *
 * The owner's direction as a repository invariant rather than an aspiration:
 * every species Hunt may offer as quarry resolves to a surface that is
 * certified, served by the endpoint, and renderable by the one renderer — or
 * stands on a GENUINE, documented reason. "No density survey exists" is not
 * one; neither is an unread source or a foundation not yet built.
 */

const declared = JSON.parse(readFileSync("content/intelligence/spatial-strategy.json", "utf8")) as {
  species: Record<string, { family: string }>;
};

test("every published species has a declared family and plan, and nothing else does", () => {
  const published = catalogueSpecies().map(({ speciesId }) => speciesId).sort();
  assert.deepEqual(Object.keys(declared.species).sort(), published,
    "a species added to the catalogue needs its entry in content/intelligence/spatial-strategy.json");
});

test("THE INVARIANT: every Hunt-eligible species has a served, renderable surface, or a genuine blocker", () => {
  const failures: string[] = [];
  for (const row of spatialStrategies()) {
    if (!permitsHuntingOpportunity(row.speciesId)) continue;
    if (row.tier !== "NO_SURFACE") {
      /* Served is not enough: the one renderer must be able to draw what came back. */
      const reply = speciesSurfaces(row.speciesId);
      const drawable = reply.surfaces.map((surface) => toRenderable(surface as never)).filter(Boolean);
      if (!drawable.length) failures.push(`${row.speciesId}: served ${reply.surfaces.length} surfaces and none is renderable`);
      continue;
    }
    if (!row.blocker?.genuine) failures.push(`${row.speciesId}: no surface, and ${row.blocker ? `${row.blocker.reason} is not a genuine blocker (${row.blocker.detail})` : "no stated reason"}`);
  }
  assert.deepEqual(failures, [], "NO_SURFACE is an audited exception, never a gap");
});

test("a species Hunt may not offer as quarry has no surface, and says why", () => {
  for (const species of catalogueSpecies()) {
    if (permitsHuntingOpportunity(species.speciesId)) continue;
    const row = spatialStrategyFor(species.speciesId);
    assert.equal(row.tier, "NO_SURFACE", species.speciesId);
    assert.equal(row.blocker?.reason, "NOT_HUNT_ELIGIBLE", species.speciesId);
    assert.ok(GENUINE_BLOCKERS.has(row.blocker!.reason));
    assert.match(row.statement ?? "", /not a finding about the animals/);
  }
});

test("a surface's words match its evidence tier: only a measurement says density, a model or a range never says abundance", () => {
  for (const species of catalogueSpecies()) {
    if (!permitsHuntingOpportunity(species.speciesId)) continue;
    for (const surface of speciesSurfaces(species.speciesId).surfaces) {
      const meaning = TIER_MEANING[surface.tier];
      assert.equal(surface.represents, meaning.represents, `${surface.id}: represents is decided by the tier`);
      const words = `${surface.scale.statedAs} ${surface.represents}`.toLowerCase();
      if (!meaning.mayClaimDensity) assert.ok(!/\bdensity\b|per km|\/km/.test(words.replace(/not a density|never a density|not a count of animals and not a density/g, "")), `${surface.id} claims density: ${words}`);
      if (!meaning.mayClaimAbundance) assert.ok(!/\babundance\b/.test(words), `${surface.id} claims abundance: ${words}`);
      if (!meaning.ranksPlaces) assert.match(surface.scale.statedAs, /does not rank/, surface.id);
      /* Confidence is a word decided by a stated rule, never a percentage. */
      assert.ok(["HIGH", "MODERATE", "LIMITED"].includes(surface.confidence.level), surface.id);
      assert.ok(surface.confidence.rule.length > 20 && !/%/.test(surface.confidence.rule), surface.id);
      assert.ok(surface.visualTransform.kind && surface.visualTransform.statedAs, `${surface.id} states how its colour is made`);
    }
  }
});

test("zone evidence stays in the card: it is named by jurisdiction and never becomes a layer", () => {
  const moose = spatialStrategyFor("species:moose");
  assert.deepEqual(moose.zoneEvidenceJurisdictions, ["jurisdiction:ca-ab", "jurisdiction:ca-bc", "jurisdiction:ca-on"]);
  for (const layer of moose.layers) assert.notEqual(layer.surfaceKind, "MANAGEMENT_AREA");
});

test("a browser verification counts only for the bytes it saw", () => {
  const record = JSON.parse(readFileSync("content/intelligence/surface-verification.json", "utf8")) as {
    rendered: Record<string, { speciesId: string }>;
    productionVerified: Record<string, { speciesId: string }>;
  };
  const current = new Set(surfaceRegistry().surfaces.map((entry) => entry.artifactHash));
  for (const row of spatialStrategies()) {
    for (const layer of row.layers) {
      if (layer.stage === "PRODUCTION_VERIFIED") assert.ok(record.productionVerified[layer.artifactHash], layer.artifactId);
      if (layer.stage === "RENDERED") assert.ok(record.rendered[layer.artifactHash], layer.artifactId);
      /* A stale hash in the record lifts nothing, because the stage is read by the layer's CURRENT hash. */
      assert.ok(current.has(layer.artifactHash));
    }
  }
});

test("the committed coverage matrix is what the registries say", () => {
  execFileSync(process.execPath, ["scripts/report-species-coverage.mjs", "--check"], { stdio: "pipe" });
});
