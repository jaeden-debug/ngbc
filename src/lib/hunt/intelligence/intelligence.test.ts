import assert from "node:assert/strict";
import test from "node:test";
import { ontarioHarvestEvidenceCoverage, ontarioWhiteTailedDeerOpportunity } from "./ontario-harvest.ts";
import { derivePotentialArea } from "./planning.ts";
import { datasetsForLayer, validateIntelligenceDatasetRegistry } from "./registry.ts";

test("official Ontario harvest evidence is real, bounded and partial", () => {
  assert.deepEqual(ontarioHarvestEvidenceCoverage(), {
    speciesId: "species:white-tailed-deer",
    jurisdictionId: "jurisdiction:ca-on",
    geographyCount: 116,
    evidenceRecordCount: 232,
    latestObservationYear: 2025,
    coverage: "PARTIAL_DATA",
  });
  const result = ontarioWhiteTailedDeerOpportunity("management_zone:ca-on-wmu-57");
  assert.ok(result);
  assert.equal(result.result.legalStatus, null);
  assert.equal(result.result.components.length, 2);
  assert.match(result.limitations.join(" "), /not.*legality/i);
  assert.equal(ontarioWhiteTailedDeerOpportunity("management_zone:ca-on-wmu-51"), null);
});

test("dataset registry preserves licence blockers and rejected misuse", () => {
  assert.deepEqual(validateIntelligenceDatasetRegistry(), []);
  const crown = datasetsForLayer("crown-public-land", "jurisdiction:ca-on");
  assert.equal(crown.length, 2);
  assert.equal(crown.some(({ productionStatus }) => productionStatus === "LICENCE_PENDING"), true);
  assert.equal(crown.some(({ ingestionStatus }) => ingestionStatus === "REJECTED_FOR_OWNERSHIP"), true);
});

test("public ownership and good evidence still do not bypass Hunt", () => {
  const opportunity = ontarioWhiteTailedDeerOpportunity("management_zone:ca-on-wmu-57")!.result;
  const uncertain = derivePotentialArea({ opportunity, ownership: "PUBLIC", access: "CONFIRMED", legalStatus: "UNKNOWN", knownProhibition: false });
  assert.equal(uncertain.state, "CHECK_THIS_AREA");
  assert.equal(uncertain.requiresHuntEvaluation, true);
  const prohibited = derivePotentialArea({ opportunity, ownership: "PUBLIC", access: "CONFIRMED", legalStatus: "OPEN", knownProhibition: true });
  assert.equal(prohibited.state, "NOT_A_CANDIDATE");
});
