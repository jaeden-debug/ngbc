import assert from "node:assert/strict";
import test from "node:test";
import { UNITED_STATES_JURISDICTIONS } from "./united-states/registry.ts";
import { CANADA_JURISDICTIONS } from "./canada/registry.ts";
import { isCompletionStrategy, resolutionStrategyFor, strategiesOver } from "./resolution-strategy.ts";

/**
 * EVERY IN-SCOPE JURISDICTION DECLARES HOW ITS GEOGRAPHIC QUESTION IS ANSWERED.
 *
 * Over the WHOLE POPULATION, derived from the two jurisdiction registries, so a
 * jurisdiction added tomorrow is measured tomorrow. A hand-kept list of known
 * problems cannot fail for a jurisdiction nobody remembered to put on it, which
 * is the failure this check exists to make impossible.
 *
 * It separates the two things that were previously one. "The authority's GIS is
 * licence-refused" is a true statement ABOUT A SOURCE and is not a product
 * strategy; UNDECLARED is the absence of a strategy and is the only state that
 * fails. The counts below are the honest current position, and they are
 * asserted so the number can only move deliberately.
 */

const US = UNITED_STATES_JURISDICTIONS.map((j) => j.id);
/* The Northwest Territories and Nunavut are out of scope by owner decision (§9)
   and are counted in neither direction. */
const OUT_OF_SCOPE = new Set(["jurisdiction:ca-nt", "jurisdiction:ca-nu"]);
const CA = CANADA_JURISDICTIONS.map((j) => j.id).filter((id) => !OUT_OF_SCOPE.has(id));
const POPULATION = [...US, ...CA];

test("the population is read from the registries, not typed here", () => {
  /* The positive control. If this ever reads a handful, the whole check is
     passing vacuously over jurisdictions it never saw. */
  assert.ok(US.length >= 50, `only ${US.length} U.S. jurisdictions read`);
  assert.ok(CA.length >= 11, `only ${CA.length} in-scope Canadian jurisdictions read`);
  assert.equal(new Set(POPULATION).size, POPULATION.length, "a jurisdiction is counted twice");
});

test("every jurisdiction has a strategy, declared or derived, and none is silently absent", () => {
  for (const id of POPULATION) {
    const s = resolutionStrategyFor(id);
    assert.ok(s.because.length > 40, `${id}: a strategy needs a reason`);
    assert.ok(s.evidence.length > 20, `${id}: a strategy needs evidence`);
  }
});

test("the number of jurisdictions with NO product strategy is exactly what we think", () => {
  /*
   * THE NUMBER THAT MATTERS. Not an allowance — a measurement, asserted so it
   * cannot drift. Lowering it is the milestone's work; raising it fails here.
   *
   * A jurisdiction counted UNDECLARED is one where North Ground has research
   * and no way to answer a hunter. That is different from one that answers
   * UNKNOWN correctly, which is a covered case under §9.
   */
  const undeclared = strategiesOver(POPULATION)
    .filter((s) => !isCompletionStrategy(s.strategy))
    .map((s) => s.jurisdictionId.replace("jurisdiction:", ""))
    .sort();

  assert.ok(undeclared.length < POPULATION.length, "nothing is declared at all, so this is measuring nothing");
  /* PREDICTED 45, MEASURED 49. The gap was four jurisdictions I had counted as
     carrying a strategy because I had researched them; research is not a
     strategy, which is the distinction this file exists to hold.
     49 → 48 on 2026-10-07: Virginia, the first ADMINISTRATIVE_COMPOSITION
     jurisdiction. Its unit is the locality in 4VAC15-90-10's own words, and a
     locality is resolved from the Census Bureau's county boundary, so no
     polygon of the authority's is needed.
     THIS NUMBER IS NOT THE COVERAGE FIGURE. A strategy answers "which legal
     unit is this point in"; it does not mean the rules there are certified.
     Virginia holds no certified rules, so it joins Prince Edward Island, Yukon,
     Massachusetts and Louisiana in the group that can place a point and has
     nothing yet to say — real work, and not coverage (§8). */
  assert.equal(undeclared.length, 46,
    `jurisdictions with no production strategy: ${undeclared.length}\n${undeclared.join(" ")}`);
});

test("a jurisdiction that serves a layer needs no declaration, and cannot be undeclared", () => {
  /*
   * The derivation is the point: serving IS the strategy. This asserts the two
   * cannot disagree — a served jurisdiction reading UNDECLARED would mean the
   * check is reading a stale list instead of the registry.
   */
  for (const code of ["ca-sk", "ca-on", "ca-qc", "us-id", "us-ma", "us-la"]) {
    const s = resolutionStrategyFor(`jurisdiction:${code}`);
    assert.equal(s.strategy, "AUTHORITY_GEOMETRY", `${code} serves a layer`);
    assert.match(s.evidence, /^layer:/, `${code}: evidence must name the layer`);
  }
});

test("Prince Edward Island is complete BECAUSE it has no hunting units", () => {
  /*
   * The case the architecture change exists for. PEI publishes no units, and
   * that is not a gap — its seasons regulation sets open seasons for the whole
   * province. Completing it meant modelling what the authority actually does,
   * not waiting for polygons it will never publish.
   */
  const pei = resolutionStrategyFor("jurisdiction:ca-pe");
  assert.equal(pei.strategy, "JURISDICTION_WIDE");
  assert.match(pei.because, /publishes no hunting units/);
  /*
   * AND IT IS DERIVED, NOT DECLARED. PEI serves `layer:ca-pe-province`, whose
   * single feature is the provincial outline, and the derivation reads
   * `geographyLevel` rather than the bare fact that a layer serves — otherwise
   * it would report that the authority publishes units it does not publish.
   */
  assert.match(pei.evidence, /^layer:ca-pe-province, geography level JURISDICTION/);
});

test("an administrative jurisdiction is derived too, and cannot be undeclared", () => {
  /*
   * The third derivation source. Virginia serves no layer and has no
   * jurisdiction scope; what answers its geographic question is the locality
   * its authority legislates in. Reading UNDECLARED here would mean the check
   * is consulting a stale list instead of the declaration.
   */
  const virginia = resolutionStrategyFor("jurisdiction:us-va");
  assert.equal(virginia.strategy, "ADMINISTRATIVE_COMPOSITION");
  const carolina = resolutionStrategyFor("jurisdiction:us-sc");
  assert.equal(carolina.strategy, "ADMINISTRATIVE_COMPOSITION");
  assert.match(carolina.because, /Includes all lands of Abbeville/);
  assert.equal(resolutionStrategyFor("jurisdiction:us-wv").strategy, "ADMINISTRATIVE_COMPOSITION");
  assert.match(virginia.because, /\u201cIt shall be lawful to hunt deer in the following localities/);
  assert.match(virginia.evidence, /Census Bureau's own county boundary/);
});
