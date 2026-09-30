import assert from "node:assert/strict";
import test from "node:test";
import { unitedStatesCertification } from "./certification.ts";
import { unitedStatesJurisdictionById } from "./registry.ts";
import { unsupportedUnitedStatesResponse } from "./unsupported-response.ts";

/*
 * The fixture is DERIVED, not named.
 *
 * This test used to name Alaska, and Alaska stopped being unexplored the moment
 * its licence was read: ADF&G refuses redistribution outright, so its map went
 * UNAVAILABLE -> LICENCE_BLOCKED and the test failed for the best possible
 * reason. Naming the next state would buy the same failure again, because the
 * whole point of this program is that states keep leaving this category.
 *
 * So it asks the certification for a state that is genuinely still UNAVAILABLE
 * and uses that. The invariant under test was never about Alaska: it is that a
 * point in a state we cannot answer for still gets the state's identity, and
 * that saying so is not a statement about whether hunting is permitted there.
 */
test("an unsupported U.S. point keeps state identity separate from hunting coverage", () => {
  const unexplored = unitedStatesCertification().states.find((entry) => entry.map.status === "UNAVAILABLE");
  /* If this ever fires it is a milestone, not a defect: every US jurisdiction
     would have evidence of some kind, and this test would need a new subject. */
  assert.ok(unexplored, "no state is UNAVAILABLE any more — every one has evidence, so rewrite this test");
  const jurisdiction = unitedStatesJurisdictionById(`jurisdiction:us-${unexplored.code.toLowerCase()}`);
  assert.ok(jurisdiction, `${unexplored.code} is certified but not in the registry`);
  const response = unsupportedUnitedStatesResponse(
    { jurisdictionId: jurisdiction.id, name: jurisdiction.nameEn, code: unexplored.code },
    jurisdiction,
  );

  assert.equal(response.status, "UNSUPPORTED");
  assert.deepEqual(response.jurisdiction, { id: jurisdiction.id, code: unexplored.code, name: jurisdiction.nameEn });
  assert.equal(response.coverage.map, "UNAVAILABLE");
  assert.match(response.message, /will not invent or name a unit/i);
  assert.match(response.message, /not a statement about whether hunting is permitted/i);
  assert.ok(response.authority.url.startsWith("https://"));
  assert.ok(response.source?.url.startsWith("https://"));
});

test("a state that HAS been read is no longer reported as unexplored", () => {
  /* The other half of the same invariant, and the reason the fixture above had
     to be derived. Alaska is the case: 73 published subunits on ADF&G's own
     host, and terms that refuse redistribution. Reporting it as UNAVAILABLE
     would describe a state nobody had looked at. */
  const jurisdiction = unitedStatesJurisdictionById("jurisdiction:us-ak")!;
  const response = unsupportedUnitedStatesResponse(
    { jurisdictionId: "jurisdiction:us-ak", name: "Alaska", code: "AK" },
    jurisdiction,
  );
  assert.equal(response.coverage.map, "LICENCE_BLOCKED");
  assert.doesNotMatch(response.message, /\bis certified\b|\bis served\b/i);
});

test("state attribution does not claim a licence-blocked hunting layer is served", () => {
  const jurisdiction = unitedStatesJurisdictionById("jurisdiction:us-mt");
  assert.ok(jurisdiction);
  const response = unsupportedUnitedStatesResponse(
    { jurisdictionId: "jurisdiction:us-mt", name: "Montana", code: "MT" },
    jurisdiction,
  );

  assert.equal(response.coverage.map, "LICENCE_BLOCKED");
  assert.equal(response.coverage.regulations, "CERTIFIED");
  assert.doesNotMatch(response.message, /\bis certified\b|\bis served\b/i);
});
