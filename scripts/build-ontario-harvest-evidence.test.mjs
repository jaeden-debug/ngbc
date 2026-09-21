import assert from "node:assert/strict";
import test from "node:test";
import { buildBundle, parseCsv, percentileRanks, sha256 } from "./build-ontario-harvest-evidence.mjs";

test("CSV parser handles quoted values and CRLF", () => {
  assert.deepEqual(parseCsv('a,b\r\n"x,y",2\r\n'), [["a", "b"], ["x,y", "2"]]);
});

test("percentile normalisation preserves ties", () => {
  assert.deepEqual(percentileRanks([1, 2, 2, 4]), [0, 0.5, 0.5, 1]);
});

test("builder fails closed on a truncated or structurally different source", () => {
  assert.throws(() => buildBundle("WMU,Year,Active Hunters,Antlered Harvest,Antlerless Harvest,Total Harvest\n57,2025,100,5,5,10\n"), /2,001/);
  assert.throws(() => buildBundle("WMU,Year\n57,2025\n"), /Unexpected harvest columns/);
});

test("hash is stable and explicit", () => {
  assert.equal(sha256("north-ground"), "sha256:bafd0639265d57a8b7facbc9de2c9fe098cd8afadb64ed50a9989d9790c61f83");
});
