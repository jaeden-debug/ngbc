import assert from "node:assert/strict";
import test from "node:test";
import { evaluateRequestBody, toAnswerPayload } from "../answer-payload.ts";
import { createHuntHandler } from "../handler.ts";
import type { HuntEvaluation, HuntInput } from "../types.ts";

/**
 * The two answers U.S. rules add — the hunt code a tag is for, and the land a
 * hunter will be on — travel the composer's own path: the record it keeps →
 * `evaluateRequestBody` → the endpoint's allowlist → the engine. A key the
 * allowlist did not know would be refused with 400 and the hunt could not be
 * checked, exactly as the antler-class answer once was.
 */

const ORIGIN = "https://www.northgroundbushcraft.com";
// A served point (Alberta WMU 102): U.S. layers are not served yet, so a U.S.
// point is refused as outside covered geography before its answers are read.
const HUNT = { latitude: 49.2391962170392, longitude: -110.694590675416, date: "2026-11-04", speciesId: "species:white-tailed-deer" };

test("hunt code and land type pass through the converter unchanged", () => {
  assert.deepEqual(toAnswerPayload({ HUNT_CODE: "4007", LAND_TYPE: "PUBLIC_OR_ACCESS" }), { HUNT_CODE: "4007", LAND_TYPE: "PUBLIC_OR_ACCESS" });
});

test("an unserved U.S. point is refused as outside covered geography, whatever its answers", async () => {
  const handler = createHuntHandler({
    canonicalOrigin: ORIGIN,
    limiter: { check: () => ({ allowed: true, retryAfterSeconds: 0 }) },
    evaluate: async () => { throw new Error("must not be evaluated"); },
  });
  const response = await handler(new Request(`${ORIGIN}/api/hunt/evaluate`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN },
    body: JSON.stringify(evaluateRequestBody({ latitude: 46.2, longitude: -116.0, date: "2026-10-01", speciesId: "species:white-tailed-deer" }, { HUNT_CODE: "4007" })),
  }));
  assert.equal(response.status, 400);
});

test("the endpoint accepts them and hands them to the engine as given", async () => {
  const received: HuntInput[] = [];
  const handler = createHuntHandler({
    canonicalOrigin: ORIGIN,
    limiter: { check: () => ({ allowed: true, retryAfterSeconds: 0 }) },
    evaluate: async (input: HuntInput) => {
      received.push(input);
      return { completeness: "NEEDS_INPUT" } as unknown as HuntEvaluation;
    },
  });
  const response = await handler(new Request(`${ORIGIN}/api/hunt/evaluate`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN },
    body: JSON.stringify(evaluateRequestBody(HUNT, { HUNT_CODE: "4007", LAND_TYPE: "PRIVATE_NOT_ACCESS" })),
  }));
  assert.equal(response.status, 200);
  assert.equal(received[0].answers?.HUNT_CODE, "4007");
  assert.equal(received[0].answers?.LAND_TYPE, "PRIVATE_NOT_ACCESS");
});
