import assert from "node:assert/strict";
import test from "node:test";
import { unitedStatesJurisdictionById } from "./registry.ts";
import { unsupportedUnitedStatesResponse } from "./unsupported-response.ts";

test("an unsupported U.S. point keeps state identity separate from hunting coverage", () => {
  const jurisdiction = unitedStatesJurisdictionById("jurisdiction:us-ak");
  assert.ok(jurisdiction);
  const response = unsupportedUnitedStatesResponse(
    { jurisdictionId: "jurisdiction:us-ak", name: "Alaska", code: "AK" },
    jurisdiction,
  );

  assert.equal(response.status, "UNSUPPORTED");
  assert.deepEqual(response.jurisdiction, { id: "jurisdiction:us-ak", code: "AK", name: "Alaska" });
  assert.equal(response.coverage.map, "UNAVAILABLE");
  assert.match(response.message, /will not invent or name a unit/i);
  assert.match(response.message, /not a statement about whether hunting is permitted/i);
  assert.ok(response.authority.url.startsWith("https://"));
  assert.ok(response.source?.url.startsWith("https://"));
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
