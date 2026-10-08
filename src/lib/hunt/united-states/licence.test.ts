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
  /*
   * Idaho's service states a licence. Montana's, Colorado's and Wyoming's state
   * TERMS THAT DO NOT ADDRESS USE, which is a third thing.
   *
   * This assertion read UNRESOLVED until 2026-10-07, under a comment saying
   * those three "do not" state a licence. Measured to the Massachusetts
   * standard, that was true of the SERVICE and wrong about the ITEM: Colorado's
   * item licenceInfo is 1,138 characters of warranty disclaimer and indemnity,
   * and Wyoming's is a warranty disclaimer plus a recommendation to obtain the
   * data directly from WGFD. Neither says anything about reuse.
   *
   * So they are not the silence case the owner's §44 decision unblocked — §44
   * turns on an absence measured with a positive control proving the search
   * could have found terms had any existed, and here it found them — and they
   * are not a refusal either. TERMS_SILENT_ON_USE names that, and the next
   * assertion below is the one that matters: none of them serves.
   */
  assert.equal(layerById("layer:us-id-gmu")!.licence!.permittedUse, "COMMERCIAL_PERMITTED");
  assert.equal(layerById("layer:us-id-gmu")!.licence!.statedAs, "CC-BY Idaho Fish and Game");
  for (const layerId of ["layer:us-co-gmu", "layer:us-wy-elk-area"]) {
    const licence = layerById(layerId)!.licence!;
    assert.equal(licence.permittedUse, "TERMS_SILENT_ON_USE", layerId);
    assert.equal(licencePermitsServing(licence), false, `${layerId} must not serve on terms that do not grant use`);
    /* Every record carries the measurement, not just the conclusion: the full
       quoted text, where it was read, and the positive control. */
    assert.ok(licence.statedAs.length > 150, `${layerId}: the publisher's words are recorded in full`);
    assert.match(licence.note ?? "", /POSITIVE CONTROL/, `${layerId}: the search must be shown capable of finding terms`);
    assert.match(licence.note ?? "", /OPEN FOR THE OWNER/, `${layerId}: the decision is named as the owner's`);
  }

  /*
   * MONTANA IS A THIRD FINDING, and lumping it with the two above was my first
   * mistake today. Its terms of use DO address use: section 4, COPYRIGHT
   * LIMITATIONS, grants "view, copy, or distribute … for personal or
   * informational use … if the documents are not modified in any respect".
   *
   * That is neither silence nor a plain refusal. It is a grant whose two
   * conditions North Ground's use does not obviously satisfy — a commercial
   * product is arguably neither personal nor informational, and normalising
   * geometry is modification — so it stays UNRESOLVED. Calling it RESTRICTED
   * would assert a refusal FWP has not made of us; calling it silent would
   * assert an absence that is not there.
   *
   * The sweep that found it is recorded in the note: only "copyright" hit, and
   * reading those two hits is what a keyword list for "licence" would have
   * missed.
   */
  for (const layerId of ["layer:us-mt-deer-elk-hd", "layer:us-mt-upland"]) {
    const licence = layerById(layerId)!.licence!;
    assert.equal(licence.permittedUse, "UNRESOLVED", layerId);
    assert.equal(licencePermitsServing(licence), false, layerId);
    assert.match(licence.statedAs, /COPYRIGHT LIMITATIONS/, `${layerId}: the clause that addresses use is the one quoted`);
    assert.match(licence.statedAs, /for personal or informational use/, layerId);
    assert.match(licence.note ?? "", /neither silent nor plainly refusing/i, `${layerId}: say which of the three it is`);
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
