import assert from "node:assert/strict";
import test from "node:test";
import { createOpportunityHandler } from "./handler.ts";

const GET = createOpportunityHandler();

test("opportunity endpoint returns explainable evidence without legal status", async () => {
  const response = await GET(new Request("https://northground.example/api/hunt/opportunity?speciesId=species%3Awhite-tailed-deer&geographyId=management_zone%3Aca-on-wmu-57"));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control") ?? "", /s-maxage=21600/);
  const body = await response.json();
  assert.equal(body.result.legalStatus, null);
  assert.equal(body.result.coverage, "PARTIAL_DATA");
  assert.equal(body.result.components.length, 2);
});

test("opportunity endpoint fails honestly for unsupported or absent coverage", async () => {
  const unsupported = await GET(new Request("https://northground.example/api/hunt/opportunity?speciesId=species%3Amoose&geographyId=management_zone%3Aca-on-wmu-57"));
  assert.equal(unsupported.status, 400);
  const absent = await GET(new Request("https://northground.example/api/hunt/opportunity?speciesId=species%3Awhite-tailed-deer&geographyId=management_zone%3Aca-on-wmu-51"));
  assert.equal(absent.status, 404);
  assert.equal((await absent.json()).status, "NO_HEAT_MAP_DATA");
});

test("opportunity endpoint refuses unbounded geography input", async () => {
  const response = await GET(new Request(`https://northground.example/api/hunt/opportunity?speciesId=species%3Awhite-tailed-deer&geographyId=${"x".repeat(10_000)}`));
  assert.equal(response.status, 400);
});
