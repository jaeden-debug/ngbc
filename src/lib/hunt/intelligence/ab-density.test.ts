import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { mayShapeContinuousSurface } from "./rendering.ts";
import { surfaceSitesFrom } from "./surface-raster.ts";

/**
 * Alberta's aerial surveys are the first ABSOLUTE DENSITY North Ground holds
 * for big game — animals per km², where every other big-game heat value was
 * harvest, a record of hunting. §41B prefers density over harvest at the same
 * resolution because density measures what the hunter asked about.
 *
 * And it is a figure for a WHOLE management unit, so §41B's coarse-evidence
 * prohibition binds it absolutely: a zone value multiplied across fine pixels
 * would let a regulatory boundary shape the animal surface while looking like
 * biology. That is not a rule to remember at render time — it is tested here,
 * against the published bundles, because the bundles are what a future
 * consumer will reach for.
 */

const SPECIES = ["moose", "mule-deer", "white-tailed-deer", "elk"] as const;
const bundles = SPECIES.map((name) => [
  name,
  JSON.parse(readFileSync(`content/intelligence/ca-ab-${name}-density.json`, "utf8")),
] as const);

test("no Alberta density record may shape the continuous surface", () => {
  for (const [name, bundle] of bundles) {
    assert.ok(bundle.evidence.length > 0, `${name}: no evidence`);
    for (const record of bundle.evidence) {
      assert.equal(record.geographyType, "MANAGEMENT_ZONE", `${name}: ${record.id}`);
      assert.equal(mayShapeContinuousSurface(record.geographyType), false);
    }
    /* Not "produced no sites" — REFUSED, with the reason named and the records
       listed, so a caller cannot read the refusal as an empty result. */
    const surface = surfaceSitesFrom(bundle.evidence);
    assert.equal(surface.ok, false, `${name}: a whole-unit figure reached the raster`);
    assert.equal(surface.ok === false && surface.reason, "AREA_EVIDENCE");
    assert.equal(
      surface.ok === false && surface.offending.length, bundle.evidence.length,
      `${name}: the refusal must name every record, so it can be audited`,
    );
  }
});

test("the metric is named for what the source measures", () => {
  for (const [name, bundle] of bundles) {
    for (const record of bundle.evidence) {
      assert.equal(record.metric, "POPULATION_DENSITY", `${name}: ${record.id}`);
      assert.equal(record.unit, "animals per square kilometre");
      /* §41B: only a source measuring animals per unit area may be called
         population density. Alberta's is; harvest counts are not, and must
         never acquire this metric by sitting in the same bundle. */
      assert.ok(record.rawValue > 0 && record.rawValue < 100, `${name}: ${record.rawValue} is not a plausible density`);
    }
  }
});

test("the bundle says what it could not read, and in what shape", () => {
  for (const [name, bundle] of bundles) {
    const reading = bundle.reading;
    assert.ok(reading, `${name}: no reading record`);
    assert.equal(reading.reportsRead, 112);
    assert.ok(reading.refusedBy.length >= 3, `${name}: the refusal shapes are not named`);
    const reasons = reading.refusedBy.map((entry: { reason: string }) => entry.reason);
    /* The distinction that matters: a row we could not parse invites fixing an
       extractor; a row the authority published no density for is a finding
       about the source and nothing can fix it here. Collapsing them reported
       80 parse failures where 21 were the authority's own blanks. */
    assert.ok(reasons.includes("ROW_SHAPE"));
    assert.ok(reasons.includes("NO_DENSITY_PUBLISHED"));
    assert.ok(
      bundle.limitations.some((line: string) => line.includes("An absent unit is a unit not read")),
      `${name}: an absent unit could be read as a unit with no animals`,
    );
  }
});

test("winter is carried as winter, never as the hunting season", () => {
  for (const [name, bundle] of bundles) {
    assert.equal(bundle.seasonalBasis.matchesHuntingSeason, false, name);
    assert.match(bundle.seasonalBasis.warning, /autumn/,
      "a layer that looks like a hunting map while answering a winter question is the worst artefact here");
  }
});
