import assert from "node:assert/strict";
import test from "node:test";
import { evaluateRequestBody, toAnswerPayload } from "./answer-payload.ts";
import { evaluateHunt } from "./evaluate.ts";
import { createHuntHandler } from "./handler.ts";
import type { HuntEvaluation, HuntInput, ZoneResolution } from "./types.ts";

/**
 * The composer's answers, through the button's whole path: the record the
 * interface keeps → the body it posts → the endpoint's allowlist → the engine.
 *
 * Found in production: answering Alberta deer's antler-class question posted
 * {"ANIMAL_CLASS:ANTLER_CLASS": "ANTLERED"}, which the endpoint refused with 400,
 * so the person saw "This hunt could not be checked". Every unit test passed,
 * because each layer was right on its own; only the path between them was not.
 */

const ORIGIN = "https://www.northgroundbushcraft.com";
// WMU 102 Pakowi, the Alberta regression cases' point.
const HUNT = { latitude: 49.2391962170392, longitude: -110.694590675416, date: "2026-11-04", speciesId: "species:white-tailed-deer" };

const wmu102: ZoneResolution = {
  status: "RESOLVED",
  zoneId: "management_zone:ca-ab-wmu-102" as ZoneResolution["zoneId"],
  jurisdictionId: "jurisdiction:ca-ab" as ZoneResolution["jurisdictionId"],
  officialName: "Wildlife Management Unit 102",
  boundaryDistanceMeters: 5_000,
  nearBoundary: false,
  sourceId: "source:ca-ab-wmu-service" as ZoneResolution["sourceId"],
  message: "The point intersects one verified management-zone feature.",
};

const handler = createHuntHandler({
  canonicalOrigin: ORIGIN,
  limiter: { check: () => ({ allowed: true, retryAfterSeconds: 0 }) },
  evaluate: (input: HuntInput) => evaluateHunt(input, {
    resolveZone: async () => wmu102,
    weather: async (_latitude, _longitude, date) => ({ status: "UNAVAILABLE", summary: "No forecast", date, sourceId: "source:open-meteo" }),
    now: () => new Date("2026-09-20T12:00:00Z"),
  }),
});

/** What the composer does when a question is answered: post the record it keeps. */
async function press(answers: Record<string, string>) {
  const response = await handler(new Request(`${ORIGIN}/api/hunt/evaluate`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN },
    body: JSON.stringify(evaluateRequestBody(HUNT, answers)),
  }));
  return { status: response.status, result: await response.json() as HuntEvaluation };
}

test("answering the antler-class question reaches the engine and resolves", async () => {
  const asked = await press({ HUNT_METHOD: "RIFLE" });
  assert.equal(asked.status, 200);
  assert.equal(asked.result.completeness, "NEEDS_INPUT");
  assert.equal(asked.result.required?.id, "ANIMAL_CLASS:ANTLER_CLASS");

  // The composer stores the answer under the question's own id.
  const antlered = await press({ HUNT_METHOD: "RIFLE", [asked.result.required!.id]: "ANTLERED" });
  assert.equal(antlered.status, 200, "the endpoint accepts the answer");
  assert.equal(antlered.result.completeness, "RESOLVED");
  assert.equal(antlered.result.regulation.status, "CONDITIONAL");

  const antlerless = await press({ HUNT_METHOD: "RIFLE", LICENCE_TYPE: "GENERAL", "ANIMAL_CLASS:ANTLER_CLASS": "ANTLERLESS" });
  assert.equal(antlerless.status, 200);
  assert.equal(antlerless.result.regulation.status, "CLOSED");
});

test("the question id itself is still refused by the endpoint", async () => {
  const response = await handler(new Request(`${ORIGIN}/api/hunt/evaluate`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN },
    body: JSON.stringify({ ...HUNT, answers: { "ANIMAL_CLASS:ANTLER_CLASS": "ANTLERED" } }),
  }));
  assert.equal(response.status, 400);
});

test("the payload converts only animal classes and omits empty answers", () => {
  assert.equal(toAnswerPayload({}), undefined);
  assert.deepEqual(toAnswerPayload({ RESIDENCY: "RESIDENT", "ANIMAL_CLASS:ANTLER_CLASS": "ANTLERLESS" }), {
    RESIDENCY: "RESIDENT",
    animalClasses: [{ dimension: "ANTLER_CLASS", value: "ANTLERLESS" }],
  });
  assert.equal(evaluateRequestBody(HUNT, {}).answers, undefined);
});

test("the app posts through evaluateRequestBody, never its raw answer record", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../../components/hunt/HuntApp.tsx", import.meta.url), "utf8");
  assert.match(source, /JSON\.stringify\(evaluateRequestBody\(/);
  // The raw record may key the cache of results; it is never what is posted.
  assert.doesNotMatch(source, /JSON\.stringify\(\{[^)]*session\.answers/);
});
