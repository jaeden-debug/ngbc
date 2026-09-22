import assert from "node:assert/strict";
import test from "node:test";
import { resolveOntarioReadiness } from "../hunt/readiness/ontario.ts";
import type { HuntEvaluation } from "../hunt/types.ts";
import { createHuntBriefRequestPayload } from "./client.ts";
import { huntEvaluationToShareInput } from "./from-hunt-evaluation.ts";
import { createShareableHuntBrief, parseStoredHuntBrief, type HuntBriefReadiness } from "./model.ts";
import { huntBriefFixture, testShareId } from "./test-fixture.ts";

/**
 * Ready to Hunt in a shared brief: compact, restated from the result, and
 * structurally unable to carry a licence vendor or anyone's location.
 */

const NOW = new Date("2026-09-21T15:00:00Z");
const readiness = resolveOntarioReadiness(
  { speciesId: "species:ruffed-grouse", date: "2026-10-24", zoneId: "management_zone:ca-on-wmu-60", answers: { RESIDENCY: "RESIDENT", HUNT_METHOD: "SHOTGUN" } },
  NOW,
);

function evaluation(): HuntEvaluation {
  return {
    completeness: "RESOLVED",
    dimensions: [],
    input: { latitude: 45.23, longitude: -77.94, date: "2026-10-24", speciesId: "species:ruffed-grouse", answers: { RESIDENCY: "RESIDENT", HUNT_METHOD: "SHOTGUN" } },
    species: { id: "species:ruffed-grouse", name: "Ruffed grouse", canonicalPath: "/hunting/species/ruffed-grouse" },
    zone: { status: "RESOLVED", zoneId: "management_zone:ca-on-wmu-60", jurisdictionId: "jurisdiction:ca-on", officialName: "Wildlife Management Unit 60", sourceId: "source:ca-on-wmu-service", message: "Resolved." },
    regulation: {
      status: "CONDITIONAL", summary: "Conditions apply.", legalTime: { status: "RULE_ONLY", text: "Rule." },
      requirements: [], limitations: [], sourceIds: [], verifiedAt: "2026-09-20",
    },
    weather: { status: "UNAVAILABLE", summary: "Not available.", sourceId: "source:open-meteo" },
    knowledge: { blocks: [] },
    sources: [],
    readiness,
    evaluatedAt: NOW.toISOString(),
  } as unknown as HuntEvaluation;
}

const brief = () => createShareableHuntBrief(huntEvaluationToShareInput(evaluation(), {
  jurisdiction: { id: "jurisdiction:ca-on", displayName: "Ontario" },
}), { shareId: testShareId, createdAt: "2026-09-21T15:00:00Z" });

test("a brief carries the licences, orange and legal methods the result showed", () => {
  const shared = brief();
  // New briefs are the current version; readiness arrived in 3 and every later version keeps it.
  assert.equal(shared.version, 4);
  const names = shared.readiness!.authorizations.map((item) => item.name);
  assert.ok(names.includes("Outdoors Card"));
  assert.ok(names.includes("Small game licence"));
  assert.equal(shared.readiness!.orange?.status, readiness.orange?.status);
  assert.ok(shared.readiness!.legalMethods.some((method) => method.startsWith("Shotgun")));
});

test("a fee in a brief names its licence year and residency category", () => {
  const fee = brief().readiness!.authorizations.find((item) => item.name === "Small game licence")?.fee;
  assert.equal(fee, "2026 fee (Resident small game licence): $22.76 + 13% HST");
});

test("a brief holds no vendor, no purchase link and no location of any kind", () => {
  const serialized = JSON.stringify(brief());
  for (const forbidden of ["vendor", "issuer", "latitude", "longitude", "45.23", "77.94", "huntandfishontario", "1-800"]) {
    assert.ok(!serialized.toLowerCase().includes(forbidden.toLowerCase()), forbidden);
  }
});

test("fields a client adds to the checklist are dropped, not stored", () => {
  const input = huntEvaluationToShareInput(evaluation(), { jurisdiction: { id: "jurisdiction:ca-on", displayName: "Ontario" } });
  const tampered = {
    ...input,
    vendorSearchLocation: { latitude: 45.4, longitude: -75.7 },
    readiness: { ...input.readiness!, vendorSearch: { latitude: 45.4, longitude: -75.7 }, nearestIssuer: "Somewhere" },
  };
  const serialized = JSON.stringify(createShareableHuntBrief(tampered, { shareId: testShareId, createdAt: "2026-09-21T15:00:00Z" }));
  assert.ok(!serialized.includes("45.4") && !serialized.includes("Somewhere") && !serialized.includes("vendor"));
});

test("a version 2 brief never acquires a checklist from its stored payload", () => {
  const stored = { ...huntBriefFixture(), version: 2, readiness: brief().readiness };
  const parsed = parseStoredHuntBrief(stored);
  assert.equal(parsed.status, "found");
  if (parsed.status === "found") assert.equal(parsed.brief.readiness, undefined);
});

test("a version 3 brief round-trips its checklist", () => {
  const shared = brief();
  const parsed = parseStoredHuntBrief(JSON.parse(JSON.stringify(shared)));
  assert.equal(parsed.status, "found");
  if (parsed.status === "found") assert.deepEqual(parsed.brief.readiness, shared.readiness);
});

test("an unsupported checklist status refuses the brief rather than softening it", () => {
  const bad = { ...brief().readiness!, authorizations: [{ status: "OPTIONAL", name: "x", authority: "y" }] } as unknown as HuntBriefReadiness;
  assert.throws(() => createShareableHuntBrief({ ...huntEvaluationToShareInput(evaluation(), { jurisdiction: { id: "jurisdiction:ca-on", displayName: "Ontario" } }), readiness: bad }, { shareId: testShareId, createdAt: "2026-09-21T15:00:00Z" }));
});

test("the browser's request carries the checklist and the hunter's answers to the stored brief", () => {
  // Found in production certification: the request builder is an allowlist, and it
  // dropped both. Tested here along the whole path the Share button takes.
  const withAnswer = {
    ...evaluation(),
    dimensions: [{ id: "RESIDENCY", question: "Are you a resident of Ontario?", options: [{ value: "RESIDENT", label: "Resident" }] }],
  } as unknown as HuntEvaluation;
  const input = huntEvaluationToShareInput(withAnswer, { jurisdiction: { id: "jurisdiction:ca-on", displayName: "Ontario" } });
  const sent = JSON.stringify(createHuntBriefRequestPayload(input));
  assert.ok(!/latitude|longitude|45\.23|77\.94|vendor|issuer/i.test(sent), sent);
  const stored = createShareableHuntBrief(JSON.parse(sent), { shareId: testShareId, createdAt: "2026-09-21T15:00:00Z" });
  assert.deepEqual(stored.readiness, brief().readiness);
  assert.deepEqual(stored.assumptions, [{ question: "Are you a resident of Ontario?", answer: "Resident" }]);
});
