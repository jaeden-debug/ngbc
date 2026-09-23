import assert from "node:assert/strict";
import test from "node:test";
import { certificationFor, statesWithEvidence, unitedStatesCertification } from "./certification.ts";
import { layerById } from "../zone-layers.ts";
import { US_LAYER_IDS } from "./layers.ts";

/**
 * The three lanes are independent, and each is computed from evidence on disk
 * rather than described. A state cannot be promoted by editing a constant.
 */

test("a state's map and its rules are certified separately, and neither implies the other", () => {
  const montana = certificationFor("MT");
  // Rules: a generated bundle plus cases written from the law.
  assert.equal(montana.regulations.status, "CERTIFIED");
  assert.equal(montana.regulations.rules, 28);
  assert.deepEqual(montana.regulations.species.length, 5);
  assert.equal(montana.regulations.cases, 18);
  // Map: parity is clean, and the publisher still grants no reuse.
  assert.equal(montana.map.status, "LICENCE_BLOCKED");
  assert.ok(montana.map.layers.every((layer) => layer.disagreements === 0 && (layer.points ?? 0) > 0));
  assert.match(montana.map.blockedBy!, /No reuse grant recorded for .*us-mt-deer-elk-hd.*us-mt-upland/);
  // Certified rules therefore do not serve.
  assert.equal(montana.regulations.rulesServing, false);

  /* Idaho is certified on both lanes. Whether it SERVES is a separate fact,
     read from the layer rather than implied by either certification. */
  const idaho = certificationFor("ID");
  assert.ok(["CERTIFIED", "SERVED"].includes(idaho.map.status), "Idaho's service states CC-BY and its parity is clean");
  assert.ok(["CERTIFIED", "SERVED"].includes(idaho.regulations.status), "a bundle plus cases written from the law");
  assert.equal(idaho.regulations.rules, 54);
  assert.ok(idaho.regulations.cases > 0);
  const layer = layerById("layer:us-id-gmu")!;
  assert.equal(idaho.regulations.status === "SERVED", layer.rulesServing === true);
  assert.equal(idaho.map.status === "SERVED", layer.serving === true);
});

test("a licence that permits use still does not permit a stored copy", () => {
  const idaho = certificationFor("ID").map.layers[0];
  assert.equal(idaho.licence?.permittedUse, "COMMERCIAL_PERMITTED");
  assert.equal(idaho.licence?.redistribution, "UNRESOLVED");
  assert.equal(idaho.licence?.storedCopyPermitted, false, "US state GIS stays live-service only");
});

test("an absent intelligence layer is never counted as missing coverage", () => {
  const summary = unitedStatesCertification();
  assert.equal(summary.totals.intelligence.NONE, summary.states.length, "no state has an evidence set yet");
  // And the state furthest along on rules is still CERTIFIED with none.
  assert.equal(certificationFor("MT").regulations.status, "CERTIFIED");
  assert.equal(certificationFor("MT").intelligence.status, "NONE");
});

test("only states with evidence are reported, and every one is counted once per lane", () => {
  const summary = unitedStatesCertification();
  assert.deepEqual(statesWithEvidence(), ["CO", "ID", "MT", "WY"]);
  for (const lane of [summary.totals.map, summary.totals.regulations, summary.totals.intelligence]) {
    assert.equal(Object.values(lane).reduce((total, count) => total + count, 0), summary.states.length);
  }
  assert.deepEqual(summary.licenceBlocked.map((entry) => entry.code), ["CO", "MT", "WY"]);
  /* Served is counted from the layers themselves, never asserted as a
     constant: a state counts as served exactly when its layers say so. */
  const servingStates = new Set(US_LAYER_IDS.filter((id) => layerById(id)!.serving).map((id) => id.slice("layer:us-".length, id.indexOf("-", "layer:us-".length)).toUpperCase()));
  assert.equal(summary.totals.map.SERVED, summary.states.filter((entry) => servingStates.has(entry.code) && entry.map.status === "SERVED").length);
});
