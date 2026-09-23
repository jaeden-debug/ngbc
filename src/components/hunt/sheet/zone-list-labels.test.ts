import assert from "node:assert/strict";
import test from "node:test";
import { ZONE_LAYERS } from "../../../lib/hunt/zone-layers.ts";

/**
 * A boundary's standing and a zone's rules are two facts, and the zone list
 * must not read one off the other.
 *
 * British Columbia made the confusion visible: its units answer CLOSED quoting
 * B.C. Reg. 190/84 while their GEOMETRY is still IN_DEVELOPMENT. The list read
 * `coverage` — the geometry's status — and called those zones "boundary only"
 * beside a card answering from certified rules with a source. Both claims were
 * true; one was being made at the wrong scope.
 */
test("a layer can have certified rules and an uncertified boundary at once", () => {
  const serving = ZONE_LAYERS.filter((layer) => layer.serving);
  const rulesWithoutCertifiedGeometry = serving.filter((layer) => layer.rulesServing && layer.coverage !== "VERIFIED");
  assert.ok(
    rulesWithoutCertifiedGeometry.length > 0,
    "the case this guards is real; if it ever becomes empty, keep the test and check why",
  );
  for (const layer of rulesWithoutCertifiedGeometry) {
    // What the list now says comes from the rules flag, never from the geometry's.
    assert.equal(Boolean(layer.rulesServing), true, layer.id);
    assert.notEqual(layer.coverage, "VERIFIED", layer.id);
  }
});

test("and the two flags are genuinely independent across the served layers", () => {
  const serving = ZONE_LAYERS.filter((layer) => layer.serving);
  const boundaryOnly = serving.filter((layer) => !layer.rulesServing);
  assert.ok(boundaryOnly.length > 0, "some layers are drawn without certified rules");
  for (const layer of boundaryOnly) {
    /* Drawing a boundary is not a claim about the rules inside it (§41A), so a
       layer without certified rules may still have certified geometry. */
    assert.equal(Boolean(layer.rulesServing), false, layer.id);
  }
});
