import assert from "node:assert/strict";
import { test } from "node:test";
import { FEDERAL_AREAS, federalAreaAt } from "./federal-areas.ts";

/**
 * A federal area is resolved FROM the provincial answer, because that is how
 * the regulation defines it. These pin the three shapes wave 1 covers and, more
 * importantly, the places North Ground must refuse to choose.
 */

test("every area carries the regulation's own definition", () => {
  assert.ok(FEDERAL_AREAS.length > 0);
  for (const area of FEDERAL_AREAS) {
    assert.ok(area.statedAs.trim().length > 0, area.name);
    assert.ok(area.jurisdictionId.startsWith("jurisdiction:"), area.name);
  }
});

test("Prince Edward Island's federal area is the province itself", () => {
  const resolved = federalAreaAt("jurisdiction:ca-pe", { latitude: 46.2382 });
  assert.equal(resolved.status, "RESOLVED");
  assert.equal(resolved.status === "RESOLVED" && resolved.area.kind, "JURISDICTION");
  /* No unit is needed, because the province publishes none. */
  assert.equal(federalAreaAt("jurisdiction:ca-pe", { latitude: 46.5 }).status, "RESOLVED");
});

test("Yukon's bands are computed from the point, exactly as the regulation states them", () => {
  const northern = federalAreaAt("jurisdiction:ca-yt", { latitude: 67.5 });
  assert.equal(northern.status === "RESOLVED" && northern.area.name, "Northern Yukon");
  const central = federalAreaAt("jurisdiction:ca-yt", { latitude: 64.0 });
  assert.equal(central.status === "RESOLVED" && central.area.name, "Central Yukon");
  const southern = federalAreaAt("jurisdiction:ca-yt", { latitude: 60.5 });
  assert.equal(southern.status === "RESOLVED" && southern.area.name, "Southern Yukon");
});

test("a point on a stated latitude is NEEDS_VERIFICATION, not a guess", () => {
  /*
   * The regulation draws its line at a whole degree and a consumer GPS fix is
   * not a survey. Picking a side would hand a hunter a season decided by
   * metres of receiver error.
   */
  for (const latitude of [62, 62.001, 65.999, 66]) {
    const resolved = federalAreaAt("jurisdiction:ca-yt", { latitude });
    assert.equal(resolved.status, "NEEDS_VERIFICATION", String(latitude));
    assert.match(resolved.status === "NEEDS_VERIFICATION" ? resolved.statedAs : "", /will not choose a side/);
  }
});

test("Alberta resolves through its own certified units", () => {
  const zone1 = FEDERAL_AREAS.find((area) => area.name === "Zone No. 1")!;
  const inZone1 = zone1.units![0];
  const resolved = federalAreaAt("jurisdiction:ca-ab", { latitude: 53.5 }, inZone1);
  assert.equal(resolved.status, "RESOLVED");
  assert.equal(resolved.status === "RESOLVED" && resolved.area.name, "Zone No. 1");
});

test("the two Alberta zones do not overlap, so no unit resolves to both", () => {
  const zones = FEDERAL_AREAS.filter((area) => area.jurisdictionId === "jurisdiction:ca-ab");
  assert.equal(zones.length, 2);
  const [first, second] = zones.map((area) => new Set(area.units));
  for (const unit of first) assert.ok(!second.has(unit), `${unit} is in both federal zones`);
});

test("a unit the regulation places in no federal area says so, and is not assumed in", () => {
  /* Alberta 728 and 730 are certified provincial units that Schedule 3 names
     in neither Zone. That is a fact about the regulation, not a gap here. */
  const resolved = federalAreaAt("jurisdiction:ca-ab", { latitude: 53.5 }, "728");
  assert.equal(resolved.status, "UNKNOWN");
  assert.match(resolved.status === "UNKNOWN" ? resolved.statedAs : "", /in no federal migratory-bird area/);
});

test("a unit-defined jurisdiction with no unit resolved answers UNKNOWN", () => {
  const resolved = federalAreaAt("jurisdiction:ca-ab", { latitude: 53.5 });
  assert.equal(resolved.status, "UNKNOWN");
  assert.match(resolved.status === "UNKNOWN" ? resolved.statedAs : "", /no unit was resolved/);
});

test("a jurisdiction wave 1 has not encoded answers UNKNOWN, never silence", () => {
  const resolved = federalAreaAt("jurisdiction:ca-mb", { latitude: 50 }, "26");
  assert.equal(resolved.status, "UNKNOWN");
  assert.match(resolved.status === "UNKNOWN" ? resolved.statedAs : "", /has not encoded/);
});
