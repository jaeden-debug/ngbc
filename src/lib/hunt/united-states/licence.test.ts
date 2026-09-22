import assert from "node:assert/strict";
import test from "node:test";
import { licenceHash, licencePermitsServing, licencePermitsStoredCopy, licenceRecordIsIntact } from "../source-licence.ts";
import { layerById } from "../zone-layers.ts";
import { US_LAYER_IDS } from "./layers.ts";

/**
 * Every U.S. layer records what its publisher actually says, and a layer whose
 * licence does not permit reuse is not served — whatever the configuration
 * intends, and however certified its geometry and rules are.
 */

test("every U.S. layer records a licence, quoted from the dataset itself, with an intact hash", () => {
  for (const layerId of US_LAYER_IDS) {
    const layer = layerById(layerId)!;
    const licence = layer.licence;
    assert.ok(licence, `${layerId} records no licence`);
    assert.ok(licence.statedAs.trim().length > 0, `${layerId}: the publisher's words are empty`);
    assert.match(licence.url, /^https:\/\//, `${layerId}: no source for the wording`);
    assert.match(licence.retrievedAt, /^\d{4}-\d{2}-\d{2}$/, `${layerId}: no retrieval date`);
    assert.ok(licenceRecordIsIntact(licence), `${layerId}: the recorded hash does not match the recorded wording`);
  }
});

test("a layer is served only where its licence permits reuse; silence is never permission", () => {
  for (const layerId of US_LAYER_IDS) {
    const layer = layerById(layerId)!;
    if (!licencePermitsServing(layer.licence)) {
      assert.equal(layer.serving, false, `${layerId} serves without a licence that permits it`);
      assert.notEqual(layer.rulesServing, true, `${layerId} answers rules without a licence that permits it`);
    }
  }
});

test("the recorded readings are the publishers' own words", () => {
  // Idaho's service states a licence; Montana's, Colorado's and Wyoming's do not.
  assert.equal(layerById("layer:us-id-gmu")!.licence!.permittedUse, "COMMERCIAL_PERMITTED");
  assert.equal(layerById("layer:us-id-gmu")!.licence!.statedAs, "CC-BY Idaho Fish and Game");
  for (const layerId of ["layer:us-mt-deer-elk-hd", "layer:us-mt-upland", "layer:us-co-gmu", "layer:us-wy-elk-area"]) {
    assert.equal(layerById(layerId)!.licence!.permittedUse, "UNRESOLVED", layerId);
  }
  assert.equal(licencePermitsServing(undefined), false, "an unrecorded licence never permits serving");
  assert.equal(licenceHash("CC-BY Idaho Fish and Game"), layerById("layer:us-id-gmu")!.licence!.sha256);
});

test("U.S. state GIS is live-service only, and the record makes that enforceable", () => {
  /* The owner's decision is that North Ground stores no copy of a state's
     hunting geometry. No state's terms grant redistribution, so every record
     says so and the ingest gate refuses each of them — rather than the
     decision living only in a comment. */
  for (const layerId of US_LAYER_IDS) {
    const layer = layerById(layerId)!;
    assert.equal(layer.licence!.redistribution, "UNRESOLVED", layerId);
    assert.equal(licencePermitsStoredCopy(layer.licence), false, `${layerId} would allow a stored copy`);
  }
  // Idaho grants use but not copying: the two gates must disagree for it.
  const idaho = layerById("layer:us-id-gmu")!;
  assert.equal(licencePermitsServing(idaho.licence), true);
  assert.equal(licencePermitsStoredCopy(idaho.licence), false);
});
