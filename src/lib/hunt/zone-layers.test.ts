import assert from "node:assert/strict";
import { test } from "node:test";
import { ZONE_LAYERS, zoneCoverageWording } from "./zone-layers.ts";

test("coverage wording is a rules claim and cannot be handed the geometry's status", () => {
  /*
   * `ZoneCoverageStatus` is returned by two things meaning different things:
   * `layer.coverage` is the BOUNDARY's standing, `zoneCoverage()` is whether
   * the RULES are certified there. The wording sentences are rules claims, and
   * nothing in the type stopped someone printing one from the other — which is
   * the defect the zone list carried until British Columbia's certified CLOSED
   * answers made it visible.
   *
   * The wording now takes the layer and the zone, so the wrong input cannot be
   * passed. This asserts the behaviour that makes that worth doing: a layer
   * whose boundary is certified but whose rules do not serve must NOT read as
   * certified rules.
   */
  const boundaryOnly = ZONE_LAYERS.find((layer) => layer.serving && layer.rulesServing !== true);
  assert.ok(boundaryOnly, "this test needs a layer drawn without certified rules; delete it when none remains");

  const wording = zoneCoverageWording(boundaryOnly, "1");
  assert.notEqual(wording.label, "Certified");
  assert.match(wording.detail, /not yet certified the rules|certified no rules/);
});
