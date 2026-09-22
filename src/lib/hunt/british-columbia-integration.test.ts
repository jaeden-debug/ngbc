import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { evaluateHunt } from "./evaluate.ts";
import { regulatoryEntryFor } from "./regulatory/registry.ts";
import type { HuntInput, ZoneResolution } from "./types.ts";
import { presentZoneById } from "./zone-presentation.ts";
import { ZONE_LAYERS } from "./zone-layers.ts";

/**
 * British Columbia through Hunt's real evaluation path, as it will run once its
 * layer is served. The layer is served only for these tests; the zone resolver
 * and weather are deterministic stand-ins and the rules are the committed
 * bundle. The law itself is covered by `regulatory/british-columbia.test.ts`.
 */

const BC = ZONE_LAYERS.find((layer) => layer.jurisdictionId === "jurisdiction:ca-bc")!;
const wasServing = BC.serving;
const wasRulesServing = BC.rulesServing;
/* Both flags: British Columbia's boundaries and its rules. Serving the
   boundaries alone is a different state, covered by the unserved test. */
before(() => { BC.serving = true; BC.rulesServing = true; });
after(() => { BC.serving = wasServing; BC.rulesServing = wasRulesServing; });

function bcZone(unit: string): ZoneResolution {
  return {
    status: "RESOLVED",
    zoneId: `management_zone:ca-bc-mu-${unit}` as ZoneResolution["zoneId"],
    jurisdictionId: "jurisdiction:ca-bc",
    officialName: `Management Unit ${unit}`,
    boundaryDistanceMeters: 5_000,
    nearBoundary: false,
    sourceId: "source:ca-bc-mu-service",
    message: "The point intersects one verified management-zone feature.",
  };
}

const noWeather = async (_latitude: number, _longitude: number, date: string) =>
  ({ status: "UNAVAILABLE" as const, summary: "No forecast", date: date as HuntInput["date"], sourceId: "source:open-meteo" as const });

const offline = (async (input: string | URL) => { throw new Error(`unexpected request ${String(input)}`); }) as typeof fetch;

async function hunt(unit: string, speciesId: string, date: string, answers: HuntInput["answers"] = undefined) {
  return await evaluateHunt(
    { latitude: 50.6745, longitude: -120.3273, date: date as HuntInput["date"], speciesId: speciesId as HuntInput["speciesId"], ...(answers ? { answers } : {}) },
    { resolveZone: async () => bcZone(unit), weather: noWeather, fetch: offline, now: () => new Date("2026-09-22T12:00:00Z") },
  );
}

test("the entry exists only while the layer is served AND its rules are certified", () => {
  assert.ok(regulatoryEntryFor("jurisdiction:ca-bc"));
  BC.serving = false;
  try { assert.equal(regulatoryEntryFor("jurisdiction:ca-bc"), undefined); } finally { BC.serving = true; }
  BC.rulesServing = false;
  try { assert.equal(regulatoryEntryFor("jurisdiction:ca-bc"), undefined, "drawn boundaries alone never answer with rules"); }
  finally { BC.rulesServing = true; }
});

test("Kamloops (MU 3-20) is answered by British Columbia's rules and cites only British Columbia", async () => {
  const result = await hunt("3-20", "species:ruffed-grouse", "2026-10-15");
  assert.equal(result.regulation.status, "CONDITIONAL");
  const ids = result.sources.map((source) => source.id);
  assert.ok(ids.includes("source:ca-bc-hunting-regulation"), `the body of the regulation is cited: ${ids.join(", ")}`);
  assert.ok(ids.includes("source:ca-bc-hunting-regulation-sch3"), `Schedule 3 is cited: ${ids.join(", ")}`);
  assert.ok(ids.every((id) => !/ca-(on|mb|qc|ab)-/.test(id)), `no other province's source: ${ids.join(", ")}`);
  assert.doesNotMatch(JSON.stringify(result.regulation), /Ontario|Manitoba|Alberta|Québec/);
});

test("a question the law turns on is asked through Hunt, then answered", async () => {
  const asked = await hunt("4-3", "species:american-black-bear", "2026-09-05");
  assert.equal(asked.completeness, "NEEDS_INPUT");
  assert.equal(asked.required?.id, "HUNT_METHOD");
  const answered = await hunt("4-3", "species:american-black-bear", "2026-09-05", { HUNT_METHOD: "CROSSBOW" });
  assert.equal(answered.regulation.status, "CONDITIONAL");
});

test("the four units no schedule row names answer UNKNOWN, never CLOSED (B.C. Reg. 190/84, s. 4)", async () => {
  // 2-1, 3-45, 5-16 and 7-1 appear in no Part 1 row of Schedules 1-8. Section 4
  // makes the schedules the open seasons, but limited entry seasons are set by
  // B.C. Reg. 134/93, which North Ground has not read: silence is not a closure.
  for (const unit of ["2-1", "3-45", "5-16", "7-1"]) {
    for (const [speciesId, date] of [["species:ruffed-grouse", "2026-10-15"], ["species:american-black-bear", "2026-09-15"]]) {
      const result = await hunt(unit, speciesId, date);
      assert.equal(result.regulation.status, "UNKNOWN", `${unit} ${speciesId}`);
    }
  }
});

test("the zone is presented in British Columbia's own terms", () => {
  const presented = presentZoneById("management_zone:ca-bc-mu-7-15", "en-CA", "Management Unit 7-15");
  assert.equal(presented.fullLabel, "MU 7-15");
});
