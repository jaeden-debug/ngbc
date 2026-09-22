import assert from "node:assert/strict";
import test from "node:test";
import { evaluateHunt } from "../evaluate.ts";
import type { ZoneResolution } from "../types.ts";
import { resolveLayerFromOfficialGis } from "../zone.ts";
import { countryOfJurisdiction, isLocationLayer, layerApplicability, layerById, layerOfZoneId, speciesLayerFor } from "../zone-layers.ts";

/**
 * How a U.S. point finds the geography its species is written in, offline.
 * Every state service is replaced by a fetcher that answers as the service
 * does; nothing here reaches the network.
 */

const HD = layerById("layer:us-mt-deer-elk-hd")!;
const UPLAND = layerById("layer:us-mt-upland")!;
const WY_ELK = layerById("layer:us-wy-elk-area")!;

function service(features: Array<{ properties: Record<string, unknown> }>) {
  const calls: string[] = [];
  const fetcher = (async (input: string | URL | Request) => {
    calls.push(String(input));
    const ring = [[-111.1, 45.6], [-111.0, 45.6], [-111.0, 45.7], [-111.1, 45.7], [-111.1, 45.6]];
    return Response.json({ type: "FeatureCollection", features: features.map((feature) => ({ ...feature, geometry: { type: "Polygon", coordinates: [ring] } })) });
  }) as typeof fetch;
  return { fetcher, calls };
}

test("each U.S. state is its own country-coded jurisdiction, read from the id, never guessed", () => {
  assert.equal(countryOfJurisdiction("jurisdiction:us-mt"), "US");
  assert.equal(countryOfJurisdiction("jurisdiction:ca-ab"), "CA");
  assert.equal(countryOfJurisdiction("jurisdiction:xx-yy"), undefined);
});

test("a state's general geography answers location questions; a species-only one does not", () => {
  assert.equal(isLocationLayer(HD), true, "Montana draws its deer and elk districts by default");
  assert.equal(isLocationLayer(UPLAND), false);
  assert.equal(layerOfZoneId("management_zone:us-mt-upland-east-of-the-continental-divide")?.id, UPLAND.id);
  assert.equal(layerOfZoneId("management_zone:us-mt-hd-310")?.id, HD.id);
});

test("a species the layer is not written for is not answered from it, and a date outside its period is not either", () => {
  assert.deepEqual(layerApplicability(HD, "species:elk", "2026-10-10"), { applies: true });
  const grouse = layerApplicability(HD, "species:ruffed-grouse", "2026-10-10");
  assert.equal(grouse.applies, false);
  assert.equal(grouse.applies === false && grouse.reason, "SPECIES_OUT_OF_SCOPE");
  // Montana's 2026 districts are certified for its 2026 licence year; March 2027 is the next year's geometry.
  const nextYear = layerApplicability(HD, "species:elk", "2027-03-01");
  assert.equal(nextYear.applies === false && nextYear.reason, "OUTSIDE_GEOMETRY_PERIOD");
  assert.equal(layerApplicability(WY_ELK, "species:elk", "2026-06-09").applies, false, "before Chapter 7 took effect");
});

test("a worded designation is kept as the state writes it; a unit code is compared upper-case", async () => {
  const upland = await resolveLayerFromOfficialGis(UPLAND, 45.65, -111.05, service([{ properties: { NAME: "East of the Continental Divide:Sage-grouse, Sharp-tailed Grouse, Mountain Grouse, Partridge, Pheasant" } }]).fetcher);
  assert.equal(upland.officialName, "East of the Continental Divide");
  assert.equal(upland.zoneId, "management_zone:us-mt-upland-east-of-the-continental-divide");
  const idaho = await resolveLayerFromOfficialGis(layerById("layer:us-id-gmu")!, 45.65, -111.05, service([{ properties: { NAME: "10a" } }]).fetcher);
  assert.equal(idaho.officialName, "Game Management Unit 10A");
});

test("an impossible coordinate is refused before any state service is asked", async () => {
  const { fetcher, calls } = service([]);
  for (const [latitude, longitude] of [[95, -110], [45, -200], [Number.NaN, -110]]) {
    assert.equal((await resolveLayerFromOfficialGis(HD, latitude, longitude, fetcher)).status, "UNKNOWN");
  }
  assert.equal(calls.length, 0);
});

test("two features at one point are a question for a person, never a choice", async () => {
  const result = await resolveLayerFromOfficialGis(HD, 45.65, -111.05, service([{ properties: { DISTRICT: "309" } }, { properties: { DISTRICT: "310" } }]).fetcher);
  assert.equal(result.status, "UNKNOWN");
  assert.match(result.message, /overlapping/);
});

test("a Montana grouse question placed in a deer and elk district is asked again in the upland districts", async () => {
  const served = [HD, UPLAND].map((layer) => ({ serving: layer.serving, rules: layer.rulesServing }));
  // Montana is licence-blocked in the configuration; this suite exercises the served state.
  for (const layer of [HD, UPLAND]) { layer.serving = true; layer.rulesServing = true; }
  try {
    assert.equal(speciesLayerFor("jurisdiction:us-mt", "species:ruffed-grouse")?.id, UPLAND.id);
    assert.equal(speciesLayerFor("jurisdiction:us-mt", "species:elk")?.id, HD.id);
    assert.equal(speciesLayerFor("jurisdiction:us-mt", "species:moose"), undefined, "no geography for a species no layer covers");
    const located: ZoneResolution = {
      status: "RESOLVED", zoneId: "management_zone:us-mt-hd-310" as ZoneResolution["zoneId"], jurisdictionId: "jurisdiction:us-mt" as ZoneResolution["jurisdictionId"],
      officialName: "Hunting District 310", sourceId: HD.sourceId, message: "",
    };
    const placedIn: string[] = [];
    const evaluation = await evaluateHunt(
      { latitude: 45.65, longitude: -111.05, date: "2026-10-10" as never, speciesId: "species:ruffed-grouse" as never },
      {
        resolveZone: async () => located,
        resolveInLayer: async (layer) => {
          placedIn.push(layer.id);
          return { ...located, zoneId: "management_zone:us-mt-upland-east-of-the-continental-divide" as ZoneResolution["zoneId"], officialName: "East of the Continental Divide", sourceId: UPLAND.sourceId };
        },
        weather: async () => ({ status: "UNAVAILABLE", summary: "Not asked in this test.", date: "2026-10-10" as never, sourceId: "source:test-weather" as never }),
        // Montana's reservation and restricted-area layers, answered as "nothing here".
        fetch: (async () => Response.json({ features: [] })) as unknown as typeof fetch,
      },
    );
    assert.deepEqual(placedIn, [UPLAND.id]);
    assert.equal(evaluation.zone.officialName, "East of the Continental Divide");
    assert.equal(evaluation.zone.jurisdictionId, "jurisdiction:us-mt");
    // Montana's own upland rules answer it — mountain grouse, the same for everyone, no question asked.
    assert.equal(evaluation.completeness, "RESOLVED");
    assert.equal(evaluation.regulation.status, "CONDITIONAL");
    assert.match(evaluation.regulation.summary, /East of the Continental Divide/);
  } finally {
    [HD, UPLAND].forEach((layer, index) => { layer.serving = served[index].serving; layer.rulesServing = served[index].rules; });
  }
});

test("a point inside two of one state's own layers keeps that state, so a reservation is not jurisdictionless", async () => {
  const { soleJurisdictionAt } = await import("../zone.ts");
  // Lame Deer sits in Montana's deer-and-elk extent and its upland extent, and in no other state's.
  assert.equal(soleJurisdictionAt(45.623, -106.667), "jurisdiction:us-mt");
  // Cranbrook, B.C. is inside Alberta's box as well as B.C.'s: evidence for neither.
  assert.equal(soleJurisdictionAt(49.5097, -115.7688), undefined);
test("place search reaches the United States only once a U.S. state's zones are served", async () => {
  const { searchRegionCodes } = await import("../location.ts");
  const { US_ZONE_LAYERS } = await import("./layers.ts");
  const served = US_ZONE_LAYERS.map((layer) => layer.serving);
  try {
    for (const layer of US_ZONE_LAYERS) layer.serving = false;
    assert.deepEqual(searchRegionCodes(), ["ca"], "no U.S. layer served: a U.S. place would be a place Hunt cannot answer for");
    HD.serving = true;
    assert.deepEqual(searchRegionCodes(), ["ca", "us"]);
  } finally {
    US_ZONE_LAYERS.forEach((layer, index) => { layer.serving = served[index]; });
  }
});

test("a zone card accepts a worded designation as the state writes it, and still refuses anything else", async () => {
  const { isDesignation } = await import("../exploration/zone-summary.ts");
  assert.equal(isDesignation("East of the Continental Divide"), true);
  assert.equal(isDesignation("69A-1"), true);
  assert.equal(isDesignation("x".repeat(49)), false);
  assert.equal(isDesignation("<script>"), false);
  assert.equal(isDesignation(" leading space"), false);
});
