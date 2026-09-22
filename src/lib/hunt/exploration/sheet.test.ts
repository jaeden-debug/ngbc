import assert from "node:assert/strict";
import test from "node:test";
import { dragHeight, mapBottomFor, resolveSnap, sheetHeights, stepSnap } from "./sheet.ts";

const IPHONE = sheetHeights({ viewportHeight: 844, headerBottom: 99, safeBottom: 34 });
const SE = sheetHeights({ viewportHeight: 568, headerBottom: 52, safeBottom: 0 });

test("three distinct resting heights on phones, ordered peek < half < full", () => {
  for (const heights of [IPHONE, SE]) {
    assert.ok(heights.peek < heights.half && heights.half < heights.full, JSON.stringify(heights));
  }
  assert.equal(IPHONE.peek, 148 + 34, "peek clears the home indicator");
  assert.ok(IPHONE.full <= 844 - 99, "full stops below the header");
});

test("a short landscape phone merges half into full rather than offering a sliver", () => {
  const landscape = sheetHeights({ viewportHeight: 375, headerBottom: 56, safeBottom: 21 });
  assert.equal(landscape.half, landscape.full);
  assert.equal(resolveSnap(landscape, landscape.peek + 10, 0.9), "half");
  assert.equal(stepSnap(landscape, "peek", 1), "half");
});

test("a slow release settles on the nearest resting height", () => {
  assert.equal(resolveSnap(IPHONE, IPHONE.peek + 40, 0), "peek");
  assert.equal(resolveSnap(IPHONE, IPHONE.half - 30, 0.1), "half");
  assert.equal(resolveSnap(IPHONE, IPHONE.full - 20, -0.1), "full");
});

test("a flick moves one stop in its direction from where it was released", () => {
  assert.equal(resolveSnap(IPHONE, IPHONE.peek + 10, 0.8), "half");
  assert.equal(resolveSnap(IPHONE, IPHONE.half + 10, 0.8), "full");
  assert.equal(resolveSnap(IPHONE, IPHONE.half - 10, -0.8), "peek");
  assert.equal(resolveSnap(IPHONE, IPHONE.full, 2), "full", "nothing above full");
  assert.equal(resolveSnap(IPHONE, IPHONE.peek, -2), "peek", "nothing below peek");
});

test("dragging past either end resists instead of running away", () => {
  assert.ok(dragHeight(IPHONE, IPHONE.peek, -100) > IPHONE.peek - 100);
  assert.ok(dragHeight(IPHONE, IPHONE.full, 100) < IPHONE.full + 100);
  assert.equal(dragHeight(IPHONE, IPHONE.half, 20), IPHONE.half + 20);
});

test("the grabber steps between stops and stops at the ends", () => {
  assert.equal(stepSnap(IPHONE, "peek", 1), "half");
  assert.equal(stepSnap(IPHONE, "half", 1), "full");
  assert.equal(stepSnap(IPHONE, "full", 1), "full");
  assert.equal(stepSnap(IPHONE, "full", -1), "half");
  assert.equal(stepSnap(IPHONE, "peek", -1), "peek");
});

test("the map is sized to what the sheet leaves, so the sheet never covers its attribution", () => {
  assert.equal(mapBottomFor("peek", IPHONE), IPHONE.peek);
  assert.equal(mapBottomFor("half", IPHONE), IPHONE.half);
  assert.equal(mapBottomFor("full", IPHONE), IPHONE.half, "reading does not resize the map again");
});
