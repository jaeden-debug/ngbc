import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { ZoneResolution } from "./types.ts";
import { layerById } from "./zone-layers.ts";
import { resolvedZoneBody } from "./zone-response.ts";

const WMU_57: ZoneResolution = {
  status: "RESOLVED",
  zoneId: "management_zone:ca-on-wmu-57" as ZoneResolution["zoneId"],
  jurisdictionId: "jurisdiction:ca-on" as ZoneResolution["jurisdictionId"],
  officialName: "Wildlife Management Unit 57",
  boundaryDistanceMeters: 14_415,
  nearBoundary: false,
  displayRings: [[[-78, 45], [-77.9, 45], [-77.9, 45.1], [-78, 45]]],
  sourceId: "source:ca-on-wmu-service" as ZoneResolution["sourceId"],
  message: "The point intersects one verified management-zone feature.",
};
const ONTARIO = layerById("layer:ca-on-wmu")!;

test("a default zone lookup carries no geometry", () => {
  const body = resolvedZoneBody(WMU_57, ONTARIO);
  assert.equal("displayRings" in body.zone, false);
  assert.equal(body.zone.id, "management_zone:ca-on-wmu-57");
  assert.equal(body.zone.presentation?.fullLabel, "WMU 57");
});

test("geometry is included only when asked for", () => {
  assert.deepEqual(resolvedZoneBody(WMU_57, ONTARIO, { includeGeometry: true }).zone.displayRings, WMU_57.displayRings);
  assert.equal("displayRings" in resolvedZoneBody(WMU_57, ONTARIO, { includeGeometry: false }).zone, false);
});

test("the current map still highlights: its composer asks for geometry, and the pin preview does not", async () => {
  const composer = await readFile(new URL("../../components/hunt/HuntComposer.tsx", import.meta.url), "utf8");
  assert.match(composer, /fetch\("\/api\/hunt\/zone"[\s\S]{0,400}includeGeometry: true/);
  const map = await readFile(new URL("../../components/hunt/HuntMap.tsx", import.meta.url), "utf8");
  assert.match(map, /zone\.displayRings/, "the map highlights from the composer's zone rings");
  assert.doesNotMatch(map, /includeGeometry/, "the pin preview reads only the label");
  const route = await readFile(new URL("../../app/api/hunt/zone/route.ts", import.meta.url), "utf8");
  assert.match(route, /typeof body\.includeGeometry !== "boolean"/, "the flag is validated");
});
