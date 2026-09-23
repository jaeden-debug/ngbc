import assert from "node:assert/strict";
import { describe, it } from "node:test";
import bundle from "../../../../content/regulatory/readiness/ca-on-2026.json" with { type: "json" };
import { READINESS_CAPABILITIES, readinessCoverageReport } from "./coverage.ts";

/**
 * The coverage report, held to the property that makes it evidence: every
 * number in it is computed from the bundle, and every capability is named
 * whether or not it is built.
 */

describe("readiness coverage", () => {
  it("reports every capability, including the ones nobody has built", () => {
    const [ontario] = readinessCoverageReport();
    assert.deepEqual(
      ontario.capabilities.map((entry) => entry.capability).sort(),
      [...READINESS_CAPABILITIES].sort(),
      "a capability missing from the report reads as though it were not a question",
    );
    // Each unbuilt one says so in words rather than being a bare state.
    for (const entry of ontario.capabilities) {
      if (entry.state !== "CERTIFIED") assert.ok(entry.note, `${entry.capability} is not CERTIFIED and does not say why`);
    }
  });

  it("counts species from the bundle, not from a constant", () => {
    const [ontario] = readinessCoverageReport();
    const claimed = Object.keys(bundle.speciesMethods).length;
    for (const entry of ontario.capabilities) {
      assert.equal(entry.species.claimed, claimed, `${entry.capability} claims a different species count than the bundle holds`);
      assert.ok(entry.species.certified <= entry.species.claimed, "more species certified than claimed");
    }
    assert.equal(ontario.licenceYear, bundle.licenceYear);
    assert.equal(ontario.jurisdictionId, bundle.jurisdictionId);
  });

  it("does not report a certified rule as uncertified", () => {
    /* Ontario's hunter-orange provenance is an OBJECT keyed by rule, not an
       array. Reading it as an array reported VISIBILITY as NOT_CERTIFIED while
       eight certified rules sat in the bundle — under-claiming, which is
       safer than over-claiming and still wrong: a coverage report is evidence
       or it is nothing. */
    const visibility = readinessCoverageReport()[0].capabilities.find((entry) => entry.capability === "VISIBILITY")!;
    assert.equal(visibility.state, "CERTIFIED");
    assert.ok(Object.keys(bundle.orange.provenance).length > 0);
  });

  it("measures answers a hunter could receive, not records we hold", () => {
    /* CLAUDE.md §8: capability reporting measures DELIVERABLE answers. This
       report previously counted a species as covered when a requirement record
       existed, without asking whether any hunter could reach it — which is the
       clause landing on my own work. A readiness answer is delivered only
       where the regulatory engine can produce a season, because the checklist
       appears only for a CONDITIONAL result. */
    const [ontario] = readinessCoverageReport();
    assert.equal(ontario.officialUnits, 151);
    for (const entry of ontario.capabilities) {
      assert.equal(entry.deliverable.of, ontario.officialUnits! * Object.keys(bundle.speciesMethods).length);
      assert.ok(entry.deliverable.pairs <= entry.deliverable.of, `${entry.capability}: more deliverable than possible`);
      // Encoded but undeliverable must be impossible to read as covered.
      if (entry.state === "NOT_CERTIFIED") assert.equal(entry.deliverable.pairs, 0, `${entry.capability}`);
      else assert.ok(entry.deliverable.pairs > 0, `${entry.capability} is certified but reaches nobody`);
    }
    /* The number that matters, and the reason this test exists: AUTHORIZATION
       is complete for every species and still cannot be delivered in 334 of
       1208 species-unit pairs. "8/8 species" alone would have read as done. */
    const authorization = ontario.capabilities.find((entry) => entry.capability === "AUTHORIZATION")!;
    assert.equal(authorization.species.certified, authorization.species.claimed);
    assert.ok(authorization.deliverable.pairs < authorization.deliverable.of);
    assert.match(authorization.note!, /cannot be answered because no certified season reaches them/);
  });

  it("attributes a deliverability shortfall to the lane that owns it", () => {
    /* The gap is the regulatory engine's unit coverage, not missing
       requirement data. Saying so keeps someone from being sent to fix the
       requirement bundle, which is already complete. */
    const method = readinessCoverageReport()[0].capabilities.find((entry) => entry.capability === "METHOD")!;
    assert.equal(method.state, "CERTIFIED");
    assert.match(method.note!, /no certified season reaches them/);
    assert.doesNotMatch(method.note!, /method table/i, "the shortfall is not a method-data problem");
  });

  it("states are per capability, never one word for the jurisdiction", () => {
    const [ontario] = readinessCoverageReport();
    const states = new Set(ontario.capabilities.map((entry) => entry.state));
    assert.ok(states.size > 1, "a report where every capability agrees is a boolean wearing a longer name");
    assert.ok(!("supported" in ontario), "no jurisdiction-level boolean");
    assert.ok(!("coverage" in ontario), "no jurisdiction-level single word");
  });
});
