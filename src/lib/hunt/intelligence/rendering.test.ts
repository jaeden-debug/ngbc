import assert from "node:assert/strict";
import test from "node:test";
import { servableDatasets } from "./bundles.ts";
import { RENDER_KIND_MEANINGS, permitsRamp, permitsSubAreaVariation, renderKindFor } from "./rendering.ts";
import type { EvidenceGeometryType } from "./types.ts";

/**
 * The honest-resolution tests.
 *
 * The picture these prevent is a zone-level harvest figure smeared into a
 * blurred blob with a bright centre. That says "the animals are HERE, in this
 * corner of the unit". The authority said one number for the whole unit. The
 * bright centre would be North Ground's invention, and a hunter would drive to
 * it.
 */

test("zone evidence can never license a surface that varies inside a zone", () => {
  assert.equal(renderKindFor(["MANAGEMENT_ZONE"]), "ZONE_AREA");
  assert.equal(permitsSubAreaVariation("ZONE_AREA"), false);
  /* Not even mixed with finer evidence: one zone figure among grid cells still
     cannot be drawn as a field, because the field would have to invent detail
     for that zone. */
  assert.equal(renderKindFor(["GRID_CELL", "MANAGEMENT_ZONE"]), "ZONE_AREA");
  assert.equal(renderKindFor(["POINT", "MANAGEMENT_ZONE", "GRID_CELL"]), "ZONE_AREA");
});

test("evidence finer than an area may be drawn as a continuous surface", () => {
  assert.equal(renderKindFor(["GRID_CELL"]), "CONTINUOUS_SURFACE");
  assert.equal(renderKindFor(["POINT"]), "CONTINUOUS_SURFACE");
  assert.equal(permitsSubAreaVariation("CONTINUOUS_SURFACE"), true);
  assert.equal(permitsRamp("CONTINUOUS_SURFACE"), true);
});

test("range extent carries no ramp, because extent has no more and no less", () => {
  assert.equal(renderKindFor(["RANGE"]), "RANGE_EXTENT");
  assert.equal(permitsRamp("RANGE_EXTENT"), false);
  assert.equal(permitsSubAreaVariation("RANGE_EXTENT"), false);
  /* Range mixed with anything stays range: a measured figure inside a range
     polygon must not license a gradient across ground the extent merely says
     the animal occurs in. */
  assert.equal(renderKindFor(["RANGE", "MANAGEMENT_ZONE"]), "RANGE_EXTENT");
  assert.equal(renderKindFor(["RANGE", "GRID_CELL"]), "RANGE_EXTENT");
});

test("no evidence draws nothing at all", () => {
  assert.equal(renderKindFor([]), "NONE");
  assert.equal(permitsRamp("NONE"), false);
});

test("every geometry type has a declared kind, and every kind has a meaning", () => {
  const types: EvidenceGeometryType[] = ["MANAGEMENT_ZONE", "POLYGON", "SAMPLE_PLOT", "GRID_CELL", "POINT", "RANGE"];
  for (const type of types) assert.notEqual(renderKindFor([type]), "NONE", `${type} must declare a kind`);
  for (const kind of Object.keys(RENDER_KIND_MEANINGS)) assert.ok(RENDER_KIND_MEANINGS[kind as keyof typeof RENDER_KIND_MEANINGS].length > 40);
  assert.match(RENDER_KIND_MEANINGS.ZONE_AREA, /Nothing inside an area is hotter/);
});

test("every committed dataset is drawn no finer than the authority reported", () => {
  /*
   * Falsified against the real bundles, not a fixture. Two kinds are held: the
   * harvest datasets are reported per management unit, and the Eastern
   * Waterfowl Survey is reported per surveyed plot. Nothing held is finer than
   * that, and a bundle that arrives claiming a finer primitive fails here
   * before it can paint one.
   *
   * The invariant that spans both: NOTHING we hold may vary inside the area it
   * is reported for. A zone figure cannot say which corner, and neither can a
   * plot count.
   */
  const kinds = new Set<string>();
  for (const dataset of servableDatasets()) {
    assert.ok(
      dataset.renderKind === "ZONE_AREA" || dataset.renderKind === "SAMPLE_PLOT",
      `${dataset.speciesId} in ${dataset.jurisdictionId} claims ${dataset.renderKind}`,
    );
    assert.equal(permitsSubAreaVariation(dataset.renderKind), false, `${dataset.speciesId} in ${dataset.jurisdictionId}`);
    assert.match(dataset.spatialPrecision, /\S/, "the authority's own words for its resolution must travel with it");
    kinds.add(dataset.renderKind);
  }
  assert.deepEqual([...kinds].sort(), ["SAMPLE_PLOT", "ZONE_AREA"], "both kinds are actually exercised by committed data");
});
