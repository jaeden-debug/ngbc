import assert from "node:assert/strict";
import { test } from "node:test";
import {
  NEWFOUNDLAND_BEAR_CONFIG, NEWFOUNDLAND_CARIBOU_CONFIG, NEWFOUNDLAND_MOOSE_CONFIG, normaliseNewfoundlandArea,
} from "./newfoundland-areas.ts";

/**
 * Newfoundland and Labrador's three big-game geographies, as described to the
 * generic ArcGIS adapter. The counts are the authority's own, read 2026-09-22.
 */

test("a designation is the province's own padded area number", () => {
  assert.equal(normaliseNewfoundlandArea("044"), "044");
  assert.equal(normaliseNewfoundlandArea("005A"), "005A");
  assert.equal(normaliseNewfoundlandArea(200), "200");
  for (const raw of ["", "  ", null, undefined, "Nunavut Territory", "MMNP", "44"]) {
    assert.equal(normaliseNewfoundlandArea(raw), null, String(raw));
  }
});

test("the codes the province reserves for \"not a hunting zone\" are never designations", () => {
  assert.equal(normaliseNewfoundlandArea("000"), null);
  assert.equal(normaliseNewfoundlandArea("099", ["099"]), null);
  // 099 is only a caribou marker; the moose layer has no area 099 to hide.
  assert.equal(normaliseNewfoundlandArea("099"), "099");
});

test("each layer expects the authority's own record and unit counts", () => {
  assert.deepEqual(
    [NEWFOUNDLAND_MOOSE_CONFIG, NEWFOUNDLAND_CARIBOU_CONFIG, NEWFOUNDLAND_BEAR_CONFIG]
      .map((config) => [config.expectedRecords, config.expectedUnits, config.quarantine.length]),
    [[112, 74, 10], [34, 19, 11], [7, 7, 0]],
  );
});

test("every quarantined record says why, and is identified by a stable id", () => {
  for (const config of [NEWFOUNDLAND_MOOSE_CONFIG, NEWFOUNDLAND_CARIBOU_CONFIG]) {
    for (const rule of config.quarantine) {
      assert.equal(rule.match.field, "objectid");
      assert.equal(typeof rule.match.value, "number");
      assert.ok(rule.reason.length > 20, rule.reason);
    }
  }
});

test("the three layers are separate geographies of one province, with one source", () => {
  const configs = [NEWFOUNDLAND_MOOSE_CONFIG, NEWFOUNDLAND_CARIBOU_CONFIG, NEWFOUNDLAND_BEAR_CONFIG];
  assert.equal(new Set(configs.map((config) => config.sourceCanonicalId)).size, 1);
  assert.equal(new Set(configs.map((config) => config.zoneIdPrefix)).size, 3);
  assert.ok(configs.every((config) => config.jurisdictionCanonicalId === "jurisdiction:ca-nl"));
});
