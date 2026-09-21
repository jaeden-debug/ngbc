import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * Alberta spatial parity, replayed.
 *
 * `scripts/certify-spatial-parity.mjs --jurisdiction ca-ab` asked the Government
 * of Alberta's own WMU service and North Ground's PostGIS registry the same
 * question at every sampled point. That run needs the live service, so it is a
 * certification, not a test. These tests replay what it recorded, and fail if
 * the fixture is ever narrowed to the easy cases.
 */

interface ParityCase {
  kind: string;
  label: string;
  official: string[];
  northGround: string[];
  agree: boolean;
}

const fixture = JSON.parse(
  readFileSync(new URL("../../../fixtures/hunt/ca-ab-spatial-parity.json", import.meta.url), "utf8"),
) as { jurisdiction: string; zones: number; disagreements: number; counts: Record<string, number>; cases: ParityCase[] };

const ofKind = (kind: string) => fixture.cases.filter((item) => item.kind === kind);

test("the certification covered Alberta and found no disagreement", () => {
  assert.equal(fixture.jurisdiction, "jurisdiction:ca-ab");
  assert.equal(fixture.disagreements, 0);
  assert.deepEqual(fixture.cases.filter((item) => !item.agree), []);
  for (const item of fixture.cases) assert.deepEqual(item.northGround, item.official, item.label);
});

test("all 189 WMUs were sampled inside, at the edge and across the boundary, and resolved to themselves", () => {
  assert.equal(fixture.zones, 189);
  for (const kind of ["inside", "edge", "across"]) assert.equal(ofKind(kind).length, 189, kind);
  for (const kind of ["inside", "edge"]) {
    for (const item of ofKind(kind)) assert.deepEqual(item.northGround, [item.label.replace(`${kind} `, "")], item.label);
  }
});

test("every part of the three multipart WMUs was checked", () => {
  const parts = ofKind("component");
  assert.equal(parts.length, 6 + 3 + 3);
  for (const unit of ["718", "728", "794"]) {
    for (const item of parts.filter((part) => part.label.endsWith(`of ${unit}`))) assert.deepEqual(item.northGround, [unit], item.label);
  }
});

test("every national park, including the quarantined Elk Island record, is in no WMU in either system", () => {
  const parks = ofKind("special");
  for (const park of ["Elk Island", "Banff", "Jasper", "Waterton Lakes", "Wood Buffalo"]) {
    assert.ok(parks.some((item) => item.label.startsWith(park)), park);
  }
  for (const item of parks) {
    assert.deepEqual(item.official, [], item.label);
    assert.deepEqual(item.northGround, [], item.label);
  }
});

test("outside Alberta and at impossible coordinates, North Ground names no WMU", () => {
  assert.ok(ofKind("outside").length >= 5);
  for (const item of [...ofKind("outside"), ...ofKind("invalid")]) assert.deepEqual(item.northGround, [], item.label);
});
