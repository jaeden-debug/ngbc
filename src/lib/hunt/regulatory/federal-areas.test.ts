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

test("a jurisdiction this build has not encoded answers UNKNOWN, never silence", () => {
  /*
   * This test named Manitoba until Manitoba was encoded, and then it failed —
   * not because the behaviour broke but because its EXAMPLE had graduated. The
   * same shape as a test that used mallard as "a species we do not certify".
   *
   * So it no longer names one. It finds a jurisdiction the bundle genuinely has
   * no areas for, and asserts that such a jurisdiction still exists — so when
   * the last one is encoded this test demands deletion instead of quietly
   * testing nothing.
   */
  const encoded = new Set(FEDERAL_AREAS.map((area) => area.jurisdictionId));
  const canadian = [
    "jurisdiction:ca-nl", "jurisdiction:ca-ns", "jurisdiction:ca-nb",
    "jurisdiction:ca-nt", "jurisdiction:ca-nu",
  ];
  const unencoded = canadian.find((id) => !encoded.has(id));
  assert.ok(unencoded, "every jurisdiction is encoded; this test needs deleting, not passing");

  const resolved = federalAreaAt(unencoded, { latitude: 50 }, "26");
  assert.equal(resolved.status, "UNKNOWN");
  assert.match(resolved.status === "UNKNOWN" ? resolved.statedAs : "", /has not encoded/);
});

/* ── Manitoba: the first Part whose areas are defined two ways at once ── */

test("Manitoba Zone No. 1 is the UNION of the two portions the regulation names", () => {
  /*
   * "the portion of Manitoba lying north of latitude 57°N AND the portion
   * lying east of longitude 94°W and north of latitude 56°N".
   *
   * The "and" joins two PORTIONS, so the zone is their union. Reading it as an
   * intersection would shrink the zone to the northeast corner and leave the
   * rest of it in no federal area at all.
   */
  const far = federalAreaAt("jurisdiction:ca-mb", { latitude: 58.5, longitude: -98 });
  assert.equal(far.status, "RESOLVED");
  assert.equal(far.status === "RESOLVED" ? far.area.name : "", "Game Bird Hunting Zone No. 1");

  /* North of 56 and east of 94°W: the second portion, which an intersection
     reading would keep and a union reading also keeps. */
  const northeast = federalAreaAt("jurisdiction:ca-mb", { latitude: 56.5, longitude: -93 });
  assert.equal(northeast.status, "RESOLVED");

  /* North of 56 but WEST of 94°W, and south of 57: in neither portion. */
  const between = federalAreaAt("jurisdiction:ca-mb", { latitude: 56.5, longitude: -96 });
  assert.equal(between.status, "UNKNOWN");
});

test("a point outside Zones 1 and 4 is PLACED by the regulation, not unplaced", () => {
  /*
   * Two facts that look identical at a point and are not. Alberta's unit 728
   * is in NO federal area — the regulation does not place it. A Manitoba
   * hunting area outside Zone No. 4 IS placed, in Zone No. 2 or No. 3, and
   * North Ground cannot say which because those are drawn along a lake shore
   * and a township line it does not hold.
   *
   * Saying "the regulation places this in no federal area" here would be a
   * false claim about the law, so the two must not share a message.
   */
  const manitoba = federalAreaAt("jurisdiction:ca-mb", { latitude: 52.5, longitude: -99 }, "14");
  assert.equal(manitoba.status, "UNKNOWN");
  assert.match(manitoba.statedAs, /Zone No\. 2 or Game Bird Hunting Zone No\. 3/);
  assert.doesNotMatch(manitoba.statedAs, /in no federal migratory-bird area/);

  const alberta = federalAreaAt("jurisdiction:ca-ab", { latitude: 53 }, "728");
  assert.equal(alberta.status, "UNKNOWN");
  assert.match(alberta.statedAs, /in no federal migratory-bird area/);
});

test("Zones 1 and 4 are not ASSUMED disjoint — an overlap refuses to choose", () => {
  /*
   * The two are believed disjoint (Zone No. 4 is southern, Zone No. 1 is north
   * of 56°N) and "believed" is not a check. Rather than assert disjointness
   * once against geometry we would then have to trust, the resolver tests it at
   * every real point: matching two areas is NEEDS_VERIFICATION.
   */
  const both = federalAreaAt("jurisdiction:ca-mb", { latitude: 58.5, longitude: -98 }, "22");
  assert.equal(both.status, "NEEDS_VERIFICATION");
  assert.match(both.statedAs, /more than one federal area/);
});

test("a stated longitude is a line North Ground will not choose a side of", () => {
  /* The same discipline latitude already had, now that a Part names a meridian.
     Consumer GPS is not a survey (§41). */
  const online = federalAreaAt("jurisdiction:ca-mb", { latitude: 56.5, longitude: -94 });
  assert.equal(online.status, "NEEDS_VERIFICATION");
  assert.match(online.statedAs, /longitude 94°W/);
});

test("a region cannot be resolved from a point that carries no longitude", () => {
  /* Its own answer, not silently folded into "falls in no federal area". */
  const noLongitude = federalAreaAt("jurisdiction:ca-mb", { latitude: 56.5 });
  assert.equal(noLongitude.status, "UNKNOWN");
  assert.match(noLongitude.statedAs, /defined partly by longitude/);
});
