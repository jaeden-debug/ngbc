import assert from "node:assert/strict";
import test from "node:test";
import { nextFocal, parseFocalPointRequest } from "./focal.ts";

const assetId = "40a615aa-dfc6-4e73-adbf-9e4d0a233738";

test("a focal point is an active asset id and two percentages", () => {
  assert.deepEqual(parseFocalPointRequest({ assetId, x: 31.26, y: 70 }), { assetId, x: 31.3, y: 70 });
  assert.deepEqual(parseFocalPointRequest({ assetId, x: 0, y: 100 }), { assetId, x: 0, y: 100 });
});

test("anything else is refused", () => {
  for (const body of [null, [], "x", { assetId }, { assetId, x: -1, y: 50 }, { assetId, x: 50, y: 101 },
    { assetId, x: "50", y: 50 }, { assetId, x: Number.NaN, y: 50 }, { assetId: "not-a-uuid", x: 50, y: 50 },
    { assetId: "species/../x", x: 50, y: 50 }]) {
    assert.equal(parseFocalPointRequest(body), null, JSON.stringify(body));
  }
});

test("dragging the photo moves the subject with the pointer, inside the frame", () => {
  const drag = { fx: 50, fy: 50, spanX: 200, spanY: 100 };
  // Drag right by a quarter of the overhang: the visible window moves left by 25%.
  assert.deepEqual(nextFocal(drag, 50, 0), { x: 25, y: 50 });
  assert.deepEqual(nextFocal(drag, -50, 0), { x: 75, y: 50 });
  // Vertical uses its own overhang, so the same pixels move it further.
  assert.deepEqual(nextFocal(drag, 0, 25), { x: 50, y: 25 });
  // Never outside the frame, however far the drag goes.
  assert.deepEqual(nextFocal(drag, 5_000, 5_000), { x: 0, y: 0 });
  assert.deepEqual(nextFocal(drag, -5_000, -5_000), { x: 100, y: 100 });
});

test("an axis the photo does not overhang cannot move", () => {
  // A photo exactly as tall as the card: horizontal only.
  assert.deepEqual(nextFocal({ fx: 40, fy: 60, spanX: 120, spanY: 0 }, 60, 80), { x: 0, y: 60 });
});
