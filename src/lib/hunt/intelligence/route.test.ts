import assert from "node:assert/strict";
import test from "node:test";
import { createHeatMethodologyHandler, createOpportunityCoverageHandler, createOpportunityHandler, createSpeciesHeatHandler, MAX_HEAT_ZONES } from "./handler.ts";

const GET = createOpportunityHandler();
const COVERAGE = createOpportunityCoverageHandler();
const POST = createSpeciesHeatHandler({ canonicalOrigin: "https://northground.example" });
const METHOD = createHeatMethodologyHandler();

const methodology = (speciesId: string) =>
  METHOD(new Request(`https://northground.example/api/hunt/opportunity/methodology?speciesId=${encodeURIComponent(speciesId)}`));

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
  /* No season, open or closed, in any form — except the declared field saying
     WHEN an authority counted (Alberta flies in winter, after the hunt), which
     is about the survey and is the reason the field exists. */
  const withoutSurveyTiming = {
    ...body,
    sources: body.sources.map((source: Record<string, unknown>) => Object.fromEntries(Object.entries(source).filter(([key]) => key !== "seasonalBasis"))),
  };
  assert.equal(JSON.stringify(withoutSurveyTiming).toUpperCase().includes("SEASON"), false);
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
  assert.equal(body.speciesJurisdictionPairs, 52);
  assert.equal(body.geographyCount, 4122);
  assert.equal(body.evidenceRecordCount, 9295);
  assert.equal(body.datasets.length, 52);
  for (const dataset of body.datasets) {
    assert.match(dataset.speciesId, /^species:/);
    assert.match(dataset.jurisdictionId, /^jurisdiction:/);
    assert.ok(dataset.geographyCount > 0, "a pair that answers for no geography is not coverage");
  }
});

test("the heat reply carries the continuous value, its strength and its resolution", async () => {
  const response = await heat({
    speciesId: "species:moose",
    zones: [{ layerId: "layer:ca-bc-mu", designation: "7-42" }, { layerId: "layer:ca-on-wmu", designation: "57" }],
  });
  const body = await response.json();
  assert.equal(body.methodologyVersion, "opportunity-v2");
  /* Stated on every reply, so a renderer cannot choose a finer primitive than
     the evidence supports. */
  assert.equal(body.renderKind, "ZONE_AREA");
  assert.match(body.effort, /never move the shade/);
  for (const zone of body.zones as Array<{ classification: string; intensity: number | null; strength: string; renderKind: string }>) {
    assert.ok(["STRONG", "MODERATE", "WEAK", "INSUFFICIENT"].includes(zone.strength));
    assert.equal(zone.renderKind, "ZONE_AREA");
    if (zone.classification === "LIMITED_DATA") assert.equal(zone.intensity, null);
    else assert.ok(typeof zone.intensity === "number" && zone.intensity >= 0 && zone.intensity <= 1);
  }
  // The separation holds in the wire format too.
  assert.equal(JSON.stringify(body).includes("legalStatus"), false);
});

test("the methodology endpoint describes the calculation the map actually performed", async () => {
  const response = await methodology("species:white-tailed-deer");
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.methodology.version, "opportunity-v2");
  assert.equal(body.datasets.length, 3, "deer is served by three authorities and each must be named");

  for (const dataset of body.datasets as Array<{ authority: string; url: string; observationYear: number; measures: Array<{ metric: string; contributes: boolean; weight?: number }>; limitations: string[]; renderKindMeaning: string; grade: string }>) {
    assert.match(dataset.url, /^https:\/\//, "the authority's own source travels with its numbers");
    assert.ok(dataset.observationYear >= 2020);
    assert.ok(dataset.limitations.length > 0);
    assert.match(dataset.renderKindMeaning, /Nothing inside an area is hotter/);
    /* Alberta publishes deer per km²; harvest never earns grade A. */
    assert.equal(dataset.grade === "A", /Alberta/i.test(dataset.authority), `${dataset.authority} graded ${dataset.grade}`);

    const contributing = dataset.measures.filter(({ contributes }) => contributes);
    const total = contributing.reduce((sum, measure) => sum + (measure.weight ?? 0), 0);
    assert.ok(Math.abs(total - 1) < 0.01, `${dataset.authority} weights must sum to one, got ${total}`);
    /* Effort is LISTED and shown as not counted, rather than omitted. A
       measurement silently dropped looks exactly like one never published. */
    for (const measure of dataset.measures) {
      if (measure.metric === "HUNTER_COUNT" || measure.metric === "HUNTER_DAYS") {
        assert.equal(measure.contributes, false);
        assert.equal(measure.weight, undefined);
      }
    }
  }
});

test("a species with no evidence gets a gap, said as a gap", async () => {
  const response = await methodology("species:ruffed-grouse");
  assert.equal(response.status, 404);
  const body = await response.json();
  assert.equal(body.status, "NO_HEAT_MAP_DATA");
  assert.match(body.message, /not a finding about where the animals are/);
  // The methodology itself is still returned: how it WOULD be calculated is
  // not a secret, and saying nothing reads as "there is no method".
  assert.equal(body.methodology.version, "opportunity-v2");
  assert.equal((await methodology("not-a-species")).status, 400);
});

test("the coverage report grades every dataset from its own evidence", async () => {
  const body = await (await COVERAGE()).json();
  assert.equal(body.methodologyVersion, "opportunity-v2");
  /*
   * Three populations, and the split is the point. The thirteen harvest
   * datasets are grade C drawn per management area — a record of hunting, for
   * a whole unit. Alberta's three aerial-survey datasets are grade A, animals
   * per km², and still per unit: a better number, not a finer place. The
   * thirty-six Eastern Waterfowl Survey datasets are grade B drawn per
   * surveyed plot, because the authority counted the animals themselves on a
   * 25 km² square. Counted from the bundles, never declared.
   */
  assert.deepEqual(body.byGrade, { A: 3, B: 36, C: 13 });
  assert.deepEqual(body.byRenderKind, { SAMPLE_PLOT: 36, ZONE_AREA: 16 });
  for (const dataset of body.datasets) {
    assert.ok(dataset.independentValues >= 1);
    assert.ok(dataset.metrics.length >= 1);
    assert.ok(dataset.spatialPrecision.length > 0);
  }
});
