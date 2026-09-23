import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { ZONE_LAYERS, isJurisdictionGeography } from "./zone-layers.ts";

/**
 * A layer North Ground says it serves must actually draw.
 *
 * Three times now the coverage report has said VERIFIED while the map showed
 * nothing: Yukon (refused by a 400-row cap), Newfoundland's caribou areas
 * (unreachable behind a species gate) and Prince Edward Island (certified but
 * never promoted, so `zone_display_in_view` returned no row).
 *
 * The national cross-check could not catch the third. It compared a SUM of
 * official units against a sum of drawn features, and a jurisdiction-level
 * geography has zero units and should draw one area — so zero equalled zero
 * and the sum balanced. It would have balanced whenever it ran.
 *
 * `scripts/certify-served-layers.mjs` asks each layer separately, against the
 * live database and the authorities' services, and records the answer. This
 * replays that record and never touches the network (section 59).
 */

const CERTIFICATION = JSON.parse(readFileSync("fixtures/hunt/served-layers.json", "utf8")) as {
  status: string;
  certifiedOn: string;
  layers: Array<{
    layerId: string;
    speciesId: string | null;
    expected: { kind: "EXACTLY" | "AT_LEAST"; count: number };
    drawn: number | null;
    failure: string | null;
    ok: boolean;
  }>;
};

test("the recorded certification passed", () => {
  assert.equal(CERTIFICATION.status, "VERIFIED");
});

test("every serving layer drew, and none drew nothing", () => {
  for (const record of CERTIFICATION.layers) {
    assert.equal(record.failure, null, `${record.layerId}: ${record.failure}`);
    assert.ok((record.drawn ?? 0) > 0, `${record.layerId} drew nothing while serving`);
    if (record.expected.kind === "EXACTLY") {
      assert.equal(record.drawn, record.expected.count, record.layerId);
    } else {
      assert.ok((record.drawn ?? 0) >= record.expected.count, record.layerId);
    }
  }
});

test("every layer currently serving is covered by the certification", () => {
  /* The guard that makes the class impossible rather than detectable: turning
     on `serving` without re-certifying fails here, so a layer cannot be
     announced as served while nothing is known about whether it draws. */
  const certified = new Set(CERTIFICATION.layers.map(({ layerId }) => layerId));
  for (const layer of ZONE_LAYERS.filter((candidate) => candidate.serving)) {
    assert.ok(
      certified.has(layer.id),
      `${layer.id} is serving but absent from fixtures/hunt/served-layers.json — re-run scripts/certify-served-layers.mjs`,
    );
  }
  /* And nothing lingers in the record after it stops serving. */
  const serving = new Set(ZONE_LAYERS.filter((candidate) => candidate.serving).map(({ id }) => id));
  for (const record of CERTIFICATION.layers) {
    assert.ok(serving.has(record.layerId), `${record.layerId} is certified as served but no longer serves`);
  }
});

test("a jurisdiction-level layer expects exactly one area, never zero", () => {
  /*
   * This is the shape the national sum was missing. A jurisdiction-level
   * geography contributes no units to any total, so only a per-layer
   * expectation can tell "correctly drew its one province" from "drew nothing".
   */
  for (const layer of ZONE_LAYERS.filter((candidate) => candidate.serving && isJurisdictionGeography(candidate))) {
    const record = CERTIFICATION.layers.find(({ layerId }) => layerId === layer.id)!;
    assert.equal(record.expected.kind, "EXACTLY", layer.id);
    assert.equal(record.expected.count, 1, layer.id);
    assert.equal(record.drawn, 1, layer.id);
  }
});

test("a species-scoped layer is certified in its own species' geography", () => {
  /* Newfoundland's caribou areas draw only when caribou is the species; asking
     without one reports zero, which is right for the map and wrong as proof. */
  for (const layer of ZONE_LAYERS.filter((candidate) => candidate.serving && candidate.speciesScope)) {
    const record = CERTIFICATION.layers.find(({ layerId }) => layerId === layer.id)!;
    assert.ok(record.speciesId, `${layer.id} must be certified with a species`);
    assert.ok(layer.speciesScope!.includes(record.speciesId!), layer.id);
  }
});
