import assert from "node:assert/strict";
import { test } from "node:test";
import { YUKON_GMS_CONFIG, normaliseYukonSubzone } from "./yukon-subzones.ts";

/** Yukon's subzone integers, read as the territory writes them (417 → "4-17"). */

test("a subzone integer becomes the territory's own designation", () => {
  assert.equal(normaliseYukonSubzone(417), "4-17");
  assert.equal(normaliseYukonSubzone(101), "1-01");
  assert.equal(normaliseYukonSubzone(1146), "11-46");
  assert.equal(normaliseYukonSubzone("824"), "8-24");
});

test("the two national-park features are never given a subzone number", () => {
  assert.equal(normaliseYukonSubzone(102), null);
  assert.equal(normaliseYukonSubzone(103), null);
  assert.equal(YUKON_GMS_CONFIG.quarantine.length, 2);
  assert.ok(YUKON_GMS_CONFIG.quarantine.every((rule) => /National Park/.test(rule.reason)));
});

test("anything that is not a subzone is refused", () => {
  for (const raw of [null, undefined, "", "GMS", 0, 99, 1200, 1100, 4.5, "4-17"]) {
    assert.equal(normaliseYukonSubzone(raw), null, String(raw));
  }
});

test("the layer expects the service's 445 records for Yukon's 443 stated subzones", () => {
  assert.equal(YUKON_GMS_CONFIG.expectedRecords, 445);
  assert.equal(YUKON_GMS_CONFIG.expectedUnits, 443);
});
