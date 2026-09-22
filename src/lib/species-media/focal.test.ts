import assert from "node:assert/strict";
import test from "node:test";
import { parseFocalPointRequest } from "./focal.ts";

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
