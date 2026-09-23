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

  it("states are per capability, never one word for the jurisdiction", () => {
    const [ontario] = readinessCoverageReport();
    const states = new Set(ontario.capabilities.map((entry) => entry.state));
    assert.ok(states.size > 1, "a report where every capability agrees is a boolean wearing a longer name");
    assert.ok(!("supported" in ontario), "no jurisdiction-level boolean");
    assert.ok(!("coverage" in ontario), "no jurisdiction-level single word");
  });
});
