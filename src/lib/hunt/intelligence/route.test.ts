import assert from "node:assert/strict";
import test from "node:test";
import { createOpportunityCoverageHandler, createOpportunityHandler, createSpeciesHeatHandler, MAX_HEAT_ZONES } from "./handler.ts";

const GET = createOpportunityHandler();
const COVERAGE = createOpportunityCoverageHandler();
const POST = createSpeciesHeatHandler({ canonicalOrigin: "https://northground.example" });

const ask = (speciesId: string, geographyId: string) =>
  GET(new Request(`https://northground.example/api/hunt/opportunity?speciesId=${encodeURIComponent(speciesId)}&geographyId=${encodeURIComponent(geographyId)}`));

const heat = (body: unknown, headers: Record<string, string> = {}) =>
  POST(new Request("https://northground.example/api/hunt/opportunity", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }));

test("opportunity endpoint returns explainable evidence without legal status", async () => {
  const response = await ask("species:white-tailed-deer", "management_zone:ca-on-wmu-57");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control") ?? "", /s-maxage=21600/);
  const body = await response.json();
  assert.equal(body.result.legalStatus, null);
  assert.equal(body.result.coverage, "PARTIAL_DATA");
  assert.equal(body.result.components.length, 2);
});

/**
 * THE GATE THIS FILE EXISTS TO HOLD OPEN.
 *
 * The endpoint used to test `speciesId !== "species:white-tailed-deer"` and an
 * Ontario-shaped zone pattern, so nine of the ten committed bundles — 97% of
 * the evidence — returned 400. Every test passed, because every test asked
 * about Ontario deer. Each case below was a 400 before 2026-09-29.
 */
test("every committed species and jurisdiction is reachable, not only Ontario deer", async () => {
  const cases: Array<[string, string]> = [
    ["species:moose", "management_zone:ca-bc-mu-7-42"],
    ["species:american-black-bear", "management_zone:ca-bc-mu-3-12"],
    ["species:mule-deer", "management_zone:ca-bc-mu-3-12"],
    ["species:gray-wolf", "management_zone:ca-bc-mu-7-42"],
    ["species:elk", "management_zone:ca-bc-mu-7-42"],
    ["species:canada-lynx", "management_zone:ca-bc-mu-3-12"],
    ["species:bobcat", "management_zone:ca-bc-mu-3-12"],
    ["species:caribou", "management_zone:ca-bc-mu-3-37"],
    ["species:white-tailed-deer", "management_zone:ca-bc-mu-4-23"],
  ];
  for (const [speciesId, geographyId] of cases) {
    const response = await ask(speciesId, geographyId);
    assert.equal(response.status, 200, `${speciesId} at ${geographyId} must be served`);
    const body = await response.json();
    assert.equal(body.result.speciesId, speciesId);
    assert.equal(body.result.geographyId, geographyId);
    assert.equal(body.result.legalStatus, null, "opportunity can never carry a legal status");
    assert.ok(body.source.url.startsWith("https://"), "its authority travels with it");
  }
  // Caribou's 13 zones are the smallest bundle, and the one most easily rounded
  // away. Its absence from a unit its bundle does not cover is still a 404.
  assert.equal((await ask("species:caribou", "management_zone:ca-bc-mu-7-42")).status, 404);
});

test("absence is a finding, not a bad request", async () => {
  // A species with evidence, at a well-formed zone that holds none for it.
  const elsewhere = await ask("species:bobcat", "management_zone:ca-on-wmu-57");
  assert.equal(elsewhere.status, 404);
  assert.equal((await elsewhere.json()).status, "NO_HEAT_MAP_DATA");
  // A species North Ground holds no evidence for anywhere: said differently, still 404.
  const never = await ask("species:ruffed-grouse", "management_zone:ca-on-wmu-57");
  assert.equal(never.status, 404);
  assert.match((await never.json()).message, /anywhere yet/);
  // A real Ontario WMU with no deer record.
  assert.equal((await ask("species:white-tailed-deer", "management_zone:ca-on-wmu-51")).status, 404);
});

test("opportunity endpoint refuses malformed and unbounded input", async () => {
  assert.equal((await ask("species:white-tailed-deer", "x".repeat(10_000))).status, 400);
  assert.equal((await ask("not-a-species", "management_zone:ca-on-wmu-57")).status, 400);
  assert.equal((await ask("species:white-tailed-deer", "layer:ca-on-wmu")).status, 400);
});

test("the species layer asks about one viewport and gets back only zones with evidence", async () => {
  const response = await heat({
    speciesId: "species:moose",
    zones: [
      { layerId: "layer:ca-bc-mu", designation: "7-42" },
      { layerId: "layer:ca-bc-mu", designation: "3-12" },
      { layerId: "layer:ca-on-wmu", designation: "51" },
      { layerId: "layer:ca-bc-mu", designation: "99-99" },
    ],
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.status, "OK");
  const keyed = new Map<string, { layerId: string; designation: string; geographyId: string }>(
    (body.zones as Array<{ layerId: string; designation: string; geographyId: string }>).map((zone) => [zone.designation, zone]),
  );
  assert.equal(keyed.size, 2, "the unreported Ontario zone and the invented BC unit hold no moose evidence and are absent");
  assert.ok(keyed.has("7-42") && keyed.has("3-12"));
  // The caller keys by what it asked with; it never mints a canonical id in the browser.
  assert.equal(keyed.get("7-42")!.layerId, "layer:ca-bc-mu");
  assert.equal(keyed.get("7-42")!.geographyId, "management_zone:ca-bc-mu-7-42");
  // The peer set is stated, because the class is a rank and not a density.
  assert.match(body.peerSet, /within each jurisdiction/);
  assert.ok(body.sources.length > 0 && body.sources[0].limitations.length > 0);
  // Nothing in the reply can carry a legal status.
  assert.equal(JSON.stringify(body).includes("legalStatus"), false);
  assert.equal(JSON.stringify(body).toUpperCase().includes("SEASON"), false);
});

test("the species layer refuses to answer for more than one screenful", async () => {
  const zones = Array.from({ length: MAX_HEAT_ZONES + 1 }, () => ({ layerId: "layer:ca-bc-mu", designation: "7-42" }));
  assert.equal((await heat({ speciesId: "species:moose", zones })).status, 400);
  assert.equal((await heat({ speciesId: "species:moose", zones: [] })).status, 200);
});

test("the species layer rejects a foreign origin, a wrong content type and junk", async () => {
  assert.equal((await heat({ speciesId: "species:moose", zones: [] }, { origin: "https://evil.example" })).status, 403);
  assert.equal((await POST(new Request("https://northground.example/api/hunt/opportunity", {
    method: "POST", headers: { "content-type": "text/plain" }, body: "{}",
  }))).status, 415);
  assert.equal((await heat("{not json")).status, 400);
  assert.equal((await heat({ speciesId: "species:moose", zones: [{ layerId: "layer:ca-bc-mu", designation: "../../etc" }] })).status, 400);
  assert.equal((await heat({ speciesId: "species:moose" })).status, 400);
});

test("coverage is computed from the bundles at call time, never typed by hand", async () => {
  const body = await (await COVERAGE()).json();
  assert.equal(body.speciesJurisdictionPairs, 13);
  assert.equal(body.geographyCount, 1469);
  assert.equal(body.evidenceRecordCount, 6642);
  assert.equal(body.datasets.length, 13);
  for (const dataset of body.datasets) {
    assert.match(dataset.speciesId, /^species:/);
    assert.match(dataset.jurisdictionId, /^jurisdiction:/);
    assert.ok(dataset.geographyCount > 0, "a pair that answers for no geography is not coverage");
  }
});
