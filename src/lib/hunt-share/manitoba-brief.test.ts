import assert from "node:assert/strict";
import test from "node:test";
import { evaluateHunt } from "../hunt/evaluate.ts";
import { clearOverlayCache } from "../hunt/overlays.ts";
import type { HuntInput, ZoneResolution } from "../hunt/types.ts";
import { huntEvaluationToShareInput } from "./from-hunt-evaluation.ts";
import { createShareableHuntBrief, HUNT_BRIEF_SCHEMA_VERSION, parseStoredHuntBrief } from "./model.ts";

/**
 * A Manitoba deer hunt, evaluated on the real engine and bundle, shared as a
 * Hunt Brief and read back.
 *
 * A Manitoba deer answer depends on the hunter's residency, licence and
 * equipment, which North Ground asked about and did not verify. A brief that
 * dropped them could be read as the season for anyone. The brief must carry
 * those assumptions in the words the question used, name Manitoba and the
 * GHA, and carry nothing that locates the hunter.
 */

const LATITUDE = 50.312345;
const LONGITUDE = -99.412345;

const zone: ZoneResolution = {
  status: "RESOLVED",
  zoneId: "management_zone:ca-mb-gha-23a",
  jurisdictionId: "jurisdiction:ca-mb",
  officialName: "Game Hunting Area 23A",
  boundaryDistanceMeters: 5_000,
  nearBoundary: false,
  displayRings: [[[-99.5, 50.2], [-99.3, 50.2], [-99.3, 50.4], [-99.5, 50.2]]],
  sourceId: "source:ca-mb-gha-service",
  message: "The point intersects one verified management-zone feature.",
};

const noOverlays = (async () =>
  new Response(JSON.stringify({ features: [] }), { status: 200, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;

async function manitobaDeerHunt() {
  clearOverlayCache();
  const input: HuntInput = {
    latitude: LATITUDE,
    longitude: LONGITUDE,
    date: "2026-11-20",
    speciesId: "species:white-tailed-deer",
    answers: { RESIDENCY: "MANITOBA_RESIDENT", LICENCE_TYPE: "MB_RESIDENT_GENERAL_WTD", HUNT_METHOD: "RIFLE" },
  };
  return await evaluateHunt(input, {
    resolveZone: async () => zone,
    weather: async (_latitude, _longitude, date) => ({ status: "UNAVAILABLE", summary: "No forecast", date, sourceId: "source:open-meteo" }),
    fetch: noOverlays,
    now: () => new Date("2026-09-20T12:00:00Z"),
  });
}

test("a Manitoba brief carries the hunter's stated assumptions in the question's own words", async () => {
  const evaluation = await manitobaDeerHunt();
  assert.equal(evaluation.completeness, "RESOLVED");

  const brief = createShareableHuntBrief(
    huntEvaluationToShareInput(evaluation, { jurisdiction: { id: "jurisdiction:ca-mb", displayName: "Manitoba" } }),
    { shareId: "hb_manitobaBriefTest0001", createdAt: "2026-09-20T12:00:00Z" },
  );

  assert.equal(brief.version, HUNT_BRIEF_SCHEMA_VERSION);
  assert.deepEqual(brief.jurisdiction, { id: "jurisdiction:ca-mb", displayName: "Manitoba" });
  assert.deepEqual(brief.managementZone, { id: "management_zone:ca-mb-gha-23a", displayName: "Game Hunting Area 23A" });
  assert.equal(brief.regulatory.status, evaluation.regulation.status);
  const assumptions = Object.fromEntries(brief.assumptions.map(({ question, answer }) => [question, answer]));
  assert.equal(assumptions["Which Manitoba residency class applies to you?"], "Manitoba resident");
  assert.equal(assumptions["Which licence will you hunt under?"], "Manitoba resident general white-tailed deer licence");
  assert.equal(assumptions["What will you be hunting with?"], "Rifle");
});

test("a Manitoba brief carries nothing that locates the hunter, and survives storage unchanged", async () => {
  const evaluation = await manitobaDeerHunt();
  const brief = createShareableHuntBrief(
    huntEvaluationToShareInput(evaluation, { jurisdiction: { id: "jurisdiction:ca-mb", displayName: "Manitoba" } }),
    { shareId: "hb_manitobaBriefTest0002", createdAt: "2026-09-20T12:00:00Z" },
  );
  const serialized = JSON.stringify(brief);
  // Neither the coordinates, at any precision a map would use, nor the zone's drawn ring.
  assert.doesNotMatch(serialized, /50\.31|99\.41|50\.2\b|99\.5\b|displayRings|latitude|longitude/);

  const stored = parseStoredHuntBrief(JSON.parse(serialized));
  assert.equal(stored.status, "found");
  assert.deepEqual(stored.status === "found" ? stored.brief : null, brief);
});
