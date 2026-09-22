import assert from "node:assert/strict";
import test from "node:test";
import { mapLabelFor } from "./map-labels.ts";

test("polygons carry the compact label", () => {
  assert.equal(mapLabelFor({ layerId: "layer:ca-on-wmu", name: "57" }), "57");
  assert.equal(mapLabelFor({ layerId: "layer:ca-on-wmu", name: "64B" }), "64B");
  assert.equal(mapLabelFor({ layerId: "layer:ca-mb-gha", name: "38" }), "38");
  assert.equal(mapLabelFor({ layerId: "layer:ca-ab-wmu", name: "102" }), "102");
  assert.equal(mapLabelFor({ layerId: "layer:ca-qc-zone-chasse", name: "10O" }), "10W");
});

test("a Québec west zone is never written with its source code, which reads as a number", () => {
  const label = mapLabelFor({ layerId: "layer:ca-qc-zone-chasse", name: "11O" });
  assert.notEqual(label, "11O");
  assert.doesNotMatch(label ?? "", /^\d+O$/);
});

test("a zone the contract cannot present gets no label rather than a raw code", () => {
  assert.equal(mapLabelFor({ layerId: "layer:xx-unknown", name: "57" }), null);
  assert.equal(mapLabelFor({ layerId: "layer:ca-qc-zone-chasse", name: "10W" }), null);
});
