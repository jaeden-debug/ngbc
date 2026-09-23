import assert from "node:assert/strict";
import test from "node:test";
import { ZONE_LAYERS } from "../zone-layers.ts";
import { jurisdictionsDrawn, readAsList, SERVED_EXTENT, servedGeometryVersion } from "./overview.ts";
import { OPENING_CAMERA, POSTER_BOX, posterFrame, posterSvg } from "./overview-poster.ts";

test("the poster covers every served jurisdiction and holds the opening camera inside it", () => {
  const frame = posterFrame();
  assert.ok(frame.width > 700 && frame.width < 1200, `width ${frame.width}`);
  assert.ok(frame.height > 350 && frame.height < 900, `height ${frame.height}`);
  assert.ok(frame.centreX > 0 && frame.centreX < frame.width);
  assert.ok(frame.centreY > 0 && frame.centreY < frame.height);
  assert.ok(POSTER_BOX.west <= -120 && POSTER_BOX.east >= -57, "Alberta to Québec");
  // Only served geometry: the poster's box is the overview's box, nothing wider.
  assert.deepEqual(POSTER_BOX, SERVED_EXTENT);
});

test("a boundary vertex at the opening camera is drawn exactly under the live map's centre", () => {
  const frame = posterFrame();
  const { longitude: x, latitude: y } = OPENING_CAMERA;
  const svg = posterSvg([{ coverage: "VERIFIED", rings: [[[x, y], [x + 1, y], [x + 1, y + 1], [x, y]]] }]);
  const first = /M(\d+) (\d+)/.exec(svg);
  assert.ok(first);
  assert.ok(Math.abs(Number(first[1]) - frame.centreX) <= 0.5);
  assert.ok(Math.abs(Number(first[2]) - frame.centreY) <= 0.5);
});

test("the poster is a drawing and nothing else", () => {
  const svg = posterSvg([
    { coverage: "VERIFIED", rings: [[[-78, 45], [-77, 45], [-77, 46], [-78, 45]]] },
    { coverage: "IN_DEVELOPMENT", rings: [[[-100, 50], [-99, 50], [-99, 51], [-100, 50]]] },
  ]);
  assert.match(svg, /^<svg xmlns='http:\/\/www\.w3\.org\/2000\/svg'/);
  assert.doesNotMatch(svg, /<script|on\w+=|href=|<image|<foreignObject/i);
  // Certified and boundary-only zones are drawn differently, as on the live map.
  assert.equal((svg.match(/<path /g) ?? []).length, 2);
});

test("the data URI carries the SVG with only URI-unsafe characters escaped", async () => {
  const { posterDataUri } = await import("./overview-poster.ts");
  const svg = posterSvg([{ coverage: "VERIFIED", rings: [[[-78, 45], [-77, 45], [-77, 46], [-78, 45]]] }]);
  const uri = posterDataUri(svg);
  assert.match(uri, /^data:image\/svg\+xml,%3Csvg /);
  assert.doesNotMatch(uri.slice("data:image/svg+xml,".length), /[<>#"']/);
  assert.equal(decodeURIComponent(uri.slice("data:image/svg+xml,".length)), svg);
});

test("the poster's cache key moves with the served geometry", () => {
  assert.match(servedGeometryVersion(), /^[0-9a-f]{8}$/);
  assert.equal(servedGeometryVersion(), servedGeometryVersion(), "stable for the same served set");
});

test("the poster is described by what it drew, never by what is served", () => {
  /* The opening box is a viewport. A served jurisdiction outside it is not in
     the picture, and naming it would describe a drawing that does not contain
     it — to the one reader who cannot check. */
  const served = ZONE_LAYERS.filter((entry) => entry.serving);
  const first = served[0];
  const drawn = jurisdictionsDrawn([{ layerId: first.id }, { layerId: first.id }]);
  assert.deepEqual(drawn, [first.jurisdictionName], "one layer's features name one jurisdiction, once");
  const absent = served.find((entry) => entry.jurisdictionName !== first.jurisdictionName);
  if (absent) assert.ok(!drawn.includes(absent.jurisdictionName), "and no jurisdiction it did not draw");
  // A layer that is not served cannot put a name in the description at all.
  assert.deepEqual(jurisdictionsDrawn([{ layerId: "layer:not-a-layer" }]), []);
  assert.equal(readAsList(["Ontario", "Alberta", "Ontario"]), "Alberta and Ontario");
  assert.equal(readAsList(["Yukon", "Alberta", "Manitoba"]), "Alberta, Manitoba and Yukon");
  assert.equal(readAsList(["Ontario"]), "Ontario");
  assert.equal(readAsList([]), "");
});
