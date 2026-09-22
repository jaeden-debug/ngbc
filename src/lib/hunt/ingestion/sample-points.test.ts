import assert from "node:assert/strict";
import test from "node:test";
import { closestBoundaryPoint, pointInGeometry, unitSamples, type Geometry } from "./sample-points.ts";

const square = (x: number, y: number, size = 1): number[][] => [[x, y], [x + size, y], [x + size, y + size], [x, y + size], [x, y]];

test("membership is decided against every ring, so a hole is outside the unit", () => {
  const withHole: Geometry = { type: "Polygon", coordinates: [square(0, 0, 10), square(4, 4, 2)] };
  assert.equal(pointInGeometry([1, 1], withHole), true);
  assert.equal(pointInGeometry([5, 5], withHole), false);
  assert.equal(pointInGeometry([11, 1], withHole), false);
});

test("the edge sample is just inside the closest boundary and the across sample just outside it", () => {
  const unit: Geometry = { type: "Polygon", coordinates: [square(0, 0, 10)] };
  const samples = unitSamples("1", unit);
  assert.equal(pointInGeometry(samples.inside, unit), true);
  assert.equal(pointInGeometry(samples.edge, unit), true);
  assert.equal(pointInGeometry(samples.across, unit), false);
  const closest = closestBoundaryPoint(samples.inside, unit);
  const toEdge = Math.hypot(samples.edge[0] - closest[0], samples.edge[1] - closest[1]);
  const toAcross = Math.hypot(samples.across[0] - closest[0], samples.across[1] - closest[1]);
  assert.ok(toEdge > 0 && toEdge < 0.05, `edge ${toEdge} from the boundary`);
  assert.ok(toAcross > 0 && toAcross < 0.05, `across ${toAcross} from the boundary`);
});

test("each sizeable part of a multipart unit is sampled, and a zero-area digitising sliver is not", () => {
  const sliver = [[20, 20], [20.00001, 20], [20.00001, 20.00001], [20, 20.00001], [20, 20]];
  const unit: Geometry = { type: "MultiPolygon", coordinates: [[square(0, 0, 4)], [square(10, 10, 2)], [sliver]] };
  const samples = unitSamples("690", unit);
  assert.equal(samples.components.length, 2);
  for (const component of samples.components) assert.equal(pointInGeometry(component.point, unit), true);
  // The interior sample is in the largest part.
  assert.ok(samples.inside[0] < 4 && samples.inside[1] < 4);
});

test("a single-part unit has no component samples", () => {
  assert.deepEqual(unitSamples("54", { type: "Polygon", coordinates: [square(0, 0)] }).components, []);
});
