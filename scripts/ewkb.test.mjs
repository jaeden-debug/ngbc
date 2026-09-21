import assert from "node:assert/strict";
import { test } from "node:test";
import { base64Chunks, geometryCounts, multiPolygonToEwkb } from "./ewkb.mjs";

test("a MultiPolygon encodes to the exact EWKB PostGIS writes for it", () => {
  // SELECT ST_AsEWKB('SRID=4326;MULTIPOLYGON(((0 0,1 0,1 1,0 0)))'::geometry) in PostGIS.
  const geometry = { type: "MultiPolygon", coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 0]]]] };
  /* Written field by field so each byte is reviewable against the WKB spec. */
  const d0 = "0000000000000000"; // 0.0 as a little-endian double
  const d1 = "000000000000F03F"; // 1.0 as a little-endian double
  const expected = [
    "01", "06000020", "E6100000", "01000000", // little-endian MultiPolygon with SRID 4326, one polygon
    "01", "03000000", "01000000", "04000000", // little-endian Polygon, one ring of four points
    d0, d0, d1, d0, d1, d1, d0, d0, //            (0 0) (1 0) (1 1) (0 0)
  ].join("");
  assert.equal(multiPolygonToEwkb(geometry).toString("hex").toUpperCase(), expected);
});

test("coordinates survive as the same doubles, holes and all", () => {
  // A shell with one hole, at the full precision the ministry's service returns.
  const shell = [[-75.97221234567891, 46.37691234567891], [-75.9, 46.37691234567891], [-75.9, 46.4], [-75.97221234567891, 46.37691234567891]];
  const hole = [[-75.95, 46.38], [-75.94, 46.38], [-75.94, 46.39], [-75.95, 46.38]];
  const buffer = multiPolygonToEwkb({ type: "MultiPolygon", coordinates: [[shell, hole]] });
  // Header 13 bytes, polygon header 9, ring count prefix 4, then the first vertex.
  assert.equal(buffer.readDoubleLE(13 + 9 + 4), -75.97221234567891);
  assert.equal(buffer.readDoubleLE(13 + 9 + 4 + 8), 46.37691234567891);
  assert.equal(buffer.readUInt32LE(13 + 5), 2, "two rings: the shell and the hole");
  assert.deepEqual(geometryCounts({ type: "MultiPolygon", coordinates: [[shell, hole]] }), { points: 8, polygons: 1 });
});

test("a Polygon is written as a one-part MultiPolygon", () => {
  const polygon = { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] };
  assert.equal(multiPolygonToEwkb(polygon).toString("hex"), multiPolygonToEwkb({ type: "MultiPolygon", coordinates: [polygon.coordinates] }).toString("hex"));
});

test("a third ordinate or a non-finite one is refused, not dropped", () => {
  assert.throws(() => multiPolygonToEwkb({ type: "MultiPolygon", coordinates: [[[[0, 0, 5], [1, 0, 5], [1, 1, 5], [0, 0, 5]]]] }), /2D position/);
  assert.throws(() => multiPolygonToEwkb({ type: "MultiPolygon", coordinates: [[[[0, 0], [NaN, 0], [1, 1], [0, 0]]]] }), /2D position/);
  assert.throws(() => multiPolygonToEwkb({ type: "Point", coordinates: [0, 0] }), /Only Polygon and MultiPolygon/);
});

test("base64 chunks reassemble to the original bytes", () => {
  const buffer = Buffer.from(Array.from({ length: 10_000 }, (_, index) => index % 256));
  const chunks = base64Chunks(buffer, 999);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.length <= 999));
  assert.deepEqual(Buffer.from(chunks.join(""), "base64"), buffer);
});
