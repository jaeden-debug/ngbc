import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { compareGhaDesignations } from "./ingestion/manitoba-gha.ts";

/**
 * Manitoba spatial parity, replayed.
 *
 * `scripts/certify-spatial-parity.mjs --jurisdiction ca-mb` asks the Government
 * of Manitoba's own Game Hunting Area service and North Ground's PostGIS
 * registry the same question at every sampled point. That run needs the live
 * service, so it is a certification, not a test. These tests replay what it
 * recorded, and fail if the fixture is ever narrowed to the easy cases.
 */

interface ParityCase {
  kind: string;
  label: string;
  latitude: number;
  longitude: number;
  official: string[];
  northGround: string[];
  agree: boolean;
}

const fixture = JSON.parse(
  readFileSync(new URL("../../../fixtures/hunt/ca-mb-spatial-parity.json", import.meta.url), "utf8"),
) as { jurisdiction: string; zones: number; disagreements: number; cases: ParityCase[] };

const cases = fixture.cases;
const ofKind = (kind: string) => cases.filter((item) => item.kind === kind);

/** The 62 areas M.R. 220/86 s. 1 defines. There is no Area 37. */
const DEFINED_AREAS = [
  "1", "2", "2A", "3", "3A", "4", "5", "6", "6A", "7", "7A", "8", "9", "9A", "10", "11", "12", "13", "13A",
  "14", "14A", "15", "15A", "16", "17", "17A", "17B", "18", "18A", "18B", "18C", "19", "19A", "19B", "20",
  "21", "21A", "22", "23", "23A", "24", "25", "25A", "25B", "26", "27", "28", "29", "29A", "30", "31", "31A",
  "32", "33", "34", "34A", "34B", "34C", "35", "35A", "36", "38",
];

test("the certification covered Manitoba and found no disagreement", () => {
  assert.equal(fixture.jurisdiction, "jurisdiction:ca-mb");
  assert.equal(fixture.disagreements, 0);
  assert.deepEqual(cases.filter((item) => !item.agree), []);
  for (const item of cases) assert.deepEqual(item.northGround, item.official, `${item.label}`);
});

test("every area the regulation defines was sampled inside and at its edge, and resolved to itself", () => {
  assert.equal(fixture.zones, DEFINED_AREAS.length);
  for (const kind of ["inside", "edge"]) {
    const sampled = ofKind(kind).map((item) => item.label.replace(`${kind} `, "")).sort(compareGhaDesignations);
    assert.deepEqual(sampled, DEFINED_AREAS, `${kind} points must cover every defined area`);
    for (const item of ofKind(kind)) assert.deepEqual(item.northGround, [item.label.replace(`${kind} `, "")], item.label);
  }
});

test("points just across each sampled boundary were checked too", () => {
  assert.equal(ofKind("across").length, DEFINED_AREAS.length);
});

test("Riding Mountain National Park is in no Game Hunting Area in either system", () => {
  const park = ofKind("special").filter((item) => item.label.startsWith("Riding Mountain National Park"));
  assert.equal(park.length, 2);
  for (const item of park) {
    assert.deepEqual(item.official, []);
    assert.deepEqual(item.northGround, []);
  }
});

test("outside Manitoba and at impossible coordinates, North Ground names no area", () => {
  assert.ok(ofKind("outside").length >= 5);
  for (const item of [...ofKind("outside"), ...ofKind("invalid")]) assert.deepEqual(item.northGround, [], item.label);
});
