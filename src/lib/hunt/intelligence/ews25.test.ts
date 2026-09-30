import assert from "node:assert/strict";
import test from "node:test";
import { evidenceProvenance, heatMethodology, opportunityAt, servableDatasets } from "./bundles.ts";
import { EWS25_BUNDLES } from "./ews25.ts";
import { subZoneEvidenceFindings, subZoneEvidenceFor, validateIntelligenceDatasetRegistry } from "./registry.ts";
import { drawsOnlyWhereSurveyed, mayShapeContinuousSurface, permitsSubAreaVariation, renderKindFor } from "./rendering.ts";

/**
 * The three things the Eastern Waterfowl Survey may not be used to say.
 *
 * They are asserted here because each one is a claim the DATA cannot support
 * while the PICTURE would support it beautifully — a smooth surface over five
 * provinces, an autumn answer from a spring count, a density from a detection.
 * Each would be found later by someone drawing a prettier map.
 */

const ews = () => EWS25_BUNDLES as unknown as Array<{
  speciesId: string; jurisdictionId: string; seasonalBasis?: { matchesHuntingSeason: boolean; warning?: string; observedSeason: string };
  plotShare: number; plotShareFloor: number; limitations: string[];
  evidence: Array<{ metric: string; geographyType: string; unit: string; geographyId: string; normalizedValue?: number }>;
}>;

test("nothing may be drawn between the plots", () => {
  /*
   * 332 plots of 25 km² is 8,300 km² of five provinces. The ground between them
   * was never surveyed, and a continuous surface across it would be a North
   * Ground model wearing ECCC's provenance. The geometry type is what stops it:
   * SAMPLE_PLOT cannot vary inside a plot and cannot be drawn outside one.
   */
  for (const bundle of ews()) {
    for (const record of bundle.evidence) {
      assert.equal(record.geographyType, "SAMPLE_PLOT", `${record.geographyId} must stay a sampled plot`);
    }
  }
  const kind = renderKindFor(["SAMPLE_PLOT"]);
  assert.equal(kind, "SAMPLE_PLOT");
  assert.equal(permitsSubAreaVariation(kind), false, "nothing says which corner of a plot held the birds");
  assert.equal(drawsOnlyWhereSurveyed(kind), true, "unshaded ground here was not looked at, and is not empty");
  /* §41B's continental raster changes nothing here: feeding plots to a surface
     is interpolation between them, which is the refusal this whole ingest is
     built around. */
  assert.equal(mayShapeContinuousSurface("SAMPLE_PLOT"), false, "plots may not set the value of a surface cell");
  assert.equal(mayShapeContinuousSurface("MANAGEMENT_ZONE"), false, "a coarse measurement may never modify fine cells");
  assert.equal(mayShapeContinuousSurface("POLYGON"), false);
  assert.equal(mayShapeContinuousSurface("RANGE"), false);
  assert.equal(mayShapeContinuousSurface("GRID_CELL"), true, "a published cell is what a cell may come from");
});

test("a plot beside a zone is drawn at the coarser of the two, never the finer", () => {
  /* Mixing a zone figure with plot evidence must not let the plots license a
     gradient across the zone. Coarsest wins, as it does for range. */
  assert.equal(renderKindFor(["SAMPLE_PLOT", "MANAGEMENT_ZONE"]), "ZONE_AREA");
  assert.equal(renderKindFor(["SAMPLE_PLOT", "POINT"]), "SAMPLE_PLOT");
  assert.equal(renderKindFor(["SAMPLE_PLOT", "RANGE"]), "RANGE_EXTENT");
});

test("the spring warning travels with the shade, not only with the sources", () => {
  /*
   * The failure this prevents: a May breeding count read as an October hunting
   * map. It looks like an answer to the question a hunter is asking and answers
   * a different one, so it has to reach every surface that carries the heat.
   */
  for (const bundle of ews()) {
    assert.equal(bundle.seasonalBasis?.matchesHuntingSeason, false);
    assert.match(bundle.seasonalBasis?.warning ?? "", /autumn/i, `${bundle.speciesId} must say the season differs`);
  }
  const atPlot = opportunityAt("species:american-black-duck", ews()[0].evidence[0].geographyId);
  assert.ok(atPlot, "the survey answers at a plot");
  assert.equal(atPlot.seasonalBasis?.matchesHuntingSeason, false, "carried on the opportunity itself");
  assert.ok(evidenceProvenance("species:american-black-duck").some((entry) => entry.seasonalBasis), "carried in provenance");
  assert.ok(heatMethodology("species:american-black-duck")?.datasets.some((entry) => entry.seasonalBasis), "carried in the methodology panel");
});

test("detections are not a population and not a density", () => {
  /*
   * ECCC counts what two observers saw, under a double-observer protocol, and
   * publishes no detection correction. Calling that a density would be §41B's
   * named failure: only a source measuring animals per unit area may be called
   * population density.
   */
  for (const bundle of ews()) {
    for (const record of bundle.evidence) {
      assert.equal(record.metric, "SURVEY_OBSERVATION");
      assert.notEqual(record.metric, "POPULATION_DENSITY");
      assert.notEqual(record.metric, "POPULATION_ESTIMATE");
      assert.equal(record.unit, "birds observed on a 25 km² plot");
    }
  }
});

test("a species is drawable only where the survey recorded it on half the plots", () => {
  /*
   * Declared methodology, not a tuning constant. Below half, a plot without the
   * species is more likely to be non-detection than absence, so a ramp built on
   * the minority ranks our sampling rather than the birds.
   */
  for (const bundle of ews()) {
    assert.equal(bundle.plotShareFloor, 0.5);
    assert.ok(bundle.plotShare >= 0.5, `${bundle.speciesId} in ${bundle.jurisdictionId} is below its own floor`);
  }
  const drawable = new Set(servableDatasets().filter((d) => d.renderKind === "SAMPLE_PLOT").map((d) => `${d.jurisdictionId} ${d.speciesId}`));
  assert.equal(drawable.size, 36);
  /* Recorded on 37 of Québec's 166 plots and 1 of Newfoundland's 52 — real
     birds, too few plots to rank. */
  assert.equal(drawable.has("jurisdiction:ca-qc species:barrows-goldeneye"), false);
  /* Recorded on 14 of Newfoundland's 52 plots, while Ontario's 44 all carry it. */
  assert.equal(drawable.has("jurisdiction:ca-nl species:mallard"), false);
  assert.equal(drawable.has("jurisdiction:ca-on species:mallard"), true);
});

test("a surveyed plot with none of the species is a zero, and unsurveyed ground is not", () => {
  /*
   * The distinction §41A turns on: absent evidence is not evidence of absence.
   * A plot the crew flew and found no black ducks on is a real observation of
   * none and belongs in the ranked pool; ground with no plot has no record at
   * all, and `opportunityAt` returns null rather than a cold value.
   */
  const bundle = ews().find((entry) => entry.jurisdictionId === "jurisdiction:ca-qc" && entry.speciesId === "species:wood-duck");
  assert.ok(bundle);
  assert.ok(bundle.evidence.some((record) => record.normalizedValue !== undefined), "plots are ranked against each other");
  assert.equal(opportunityAt("species:american-black-duck", "sample_plot:not-a-plot"), null, "unsurveyed ground answers nothing");
});

test("the gap for big game is a recorded finding, not a silence", () => {
  /*
   * The product answer this makes possible: for moose, deer, elk and bear there
   * is no public Canadian evidence finer than the zone, and Hunt can say so
   * with the reason rather than render around it. Each status is a finding
   * about the SEARCH — who was asked and what they publish — never about the
   * animals.
   */
  const ontario = subZoneEvidenceFor("BIG_GAME", "jurisdiction:ca-on");
  assert.equal(ontario?.status, "NONE_PUBLISHED");
  assert.match(ontario?.reason ?? "", /sampling frame/, "the plot grid's emptiness is the reason, and it is stated");

  assert.equal(subZoneEvidenceFor("BIG_GAME", "jurisdiction:ca-bc")?.status, "LICENCE_BLOCKED");
  assert.equal(subZoneEvidenceFor("BIG_GAME", "jurisdiction:ca-ab")?.status, "ZONE_RESOLUTION_ONLY");
  assert.equal(subZoneEvidenceFor("BIG_GAME", "jurisdiction:ca-qc")?.status, "NOT_MACHINE_READABLE");
  assert.equal(subZoneEvidenceFor("BIG_GAME", "jurisdiction:ca-mb")?.status, "NONE_PUBLISHED");

  /* Not looked at is not the same as looked at and empty. A jurisdiction with
     no finding must answer null, so nothing can report a search that never ran
     as a finding that nothing exists. */
  assert.equal(subZoneEvidenceFor("BIG_GAME", "jurisdiction:ca-sk"), null);
  assert.equal(subZoneEvidenceFor("BIG_GAME", "jurisdiction:ca-yt"), null);

  const waterfowl = subZoneEvidenceFor("BREEDING_WATERFOWL", "jurisdiction:ca-qc");
  assert.equal(waterfowl?.status, "AVAILABLE_SAMPLED");
  assert.deepEqual(waterfowl?.datasetIds, ["dataset:ca-nb-ews25-breeding-waterfowl", "dataset:ca-nl-ews25-breeding-waterfowl", "dataset:ca-ns-ews25-breeding-waterfowl", "dataset:ca-on-ews25-breeding-waterfowl", "dataset:ca-qc-ews25-breeding-waterfowl"]);
  assert.match(waterfowl?.resolution ?? "", /25 km/, "a claim of finer evidence states how fine");
});

test("the Québec harvest-density map is named as the trap it is", () => {
  /*
   * The most dangerous artefact the survey found: a sub-zone density map,
   * published by the authority itself, that measures HUNTING. It looks like
   * permission to draw inside a zone. The finding names it so nobody reaches
   * for it later as a shortcut past the gap.
   */
  const quebec = subZoneEvidenceFor("BIG_GAME", "jurisdiction:ca-qc");
  assert.match(quebec?.reason ?? "", /HARVEST density map/, "the trap is named in the record, not only in the research");
  assert.match(quebec?.reason ?? "", /réserves fauniques and the parks/, "a zone estimate that does not cover its zone stays attached to the figure");
});

test("every recorded finding says who was asked and why", () => {
  for (const finding of subZoneEvidenceFindings()) {
    assert.ok(finding.authoritySearched.trim(), `${finding.id} must name the authority searched`);
    assert.ok(finding.reason.trim().length > 40, `${finding.id} must give a reason someone can challenge`);
    assert.ok(finding.jurisdictionIds.length, `${finding.id} must name where it applies`);
  }
  assert.deepEqual(validateIntelligenceDatasetRegistry(), []);
});
