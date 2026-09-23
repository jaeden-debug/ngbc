import assert from "node:assert/strict";
import test from "node:test";
import { certificationFor, mapLicenceFindingFor, statesWithEvidence, unitedStatesCertification } from "./certification.ts";
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
  assert.match(montana.map.detail!, /No reuse grant recorded for .*us-mt-deer-elk-hd.*us-mt-upland/);
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
  assert.deepEqual(statesWithEvidence(), ["CO", "ID", "ME", "MI", "MN", "MT", "ND", "SD", "WI", "WY"]);
  for (const lane of [summary.totals.map, summary.totals.regulations, summary.totals.intelligence]) {
    assert.equal(Object.values(lane).reduce((total, count) => total + count, 0), summary.states.length);
  }
  assert.deepEqual(summary.licenceBlocked.map((entry) => entry.code), ["CO", "ME", "MN", "MT", "ND", "SD", "WI", "WY"]);
  /* Served is counted from the layers themselves, never asserted as a
     constant: a state counts as served exactly when its layers say so. */
  const servingStates = new Set(US_LAYER_IDS.filter((id) => layerById(id)!.serving).map((id) => id.slice("layer:us-".length, id.indexOf("-", "layer:us-".length)).toUpperCase()));
  assert.equal(summary.totals.map.SERVED, summary.states.filter((entry) => servingStates.has(entry.code) && entry.map.status === "SERVED").length);
});

test("a state whose publisher refuses us is blocked by name, not left looking unexplored", async () => {
  const { licenceRecordIsIntact } = await import("../source-licence.ts");
  /* Every recorded finding, not a list written here: a state added to the
     registry is held to this without anyone remembering to add it. */
  const recorded = statesWithEvidence().map((code) => [code, mapLicenceFindingFor(code)!] as const).filter(([, finding]) => finding);
  assert.ok(recorded.length >= 4, "the licence-first registry is empty");
  for (const [code, finding] of recorded) {
    assert.ok(licenceRecordIsIntact(finding.licence as never), `${code}: the recorded hash does not match the wording`);
    const state = certificationFor(code);
    const permits = ["COMMERCIAL_PERMITTED", "PUBLIC_DOMAIN"].includes(finding.licence.permittedUse);
    if (permits) {
      /* A cleared state says what it is waiting on — never "blocked", never
         merely "unexplored". Usually that is the work; where a serving
         decision has been recorded against it, it is that decision instead,
         because a clear licence is not a clear road. */
      if (finding.servingDecision) {
        assert.match(state.map.detail!, new RegExp(finding.servingDecision.reason.slice(0, 40).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${code}'s recorded decision is what its row says`);
      } else {
        assert.match(state.map.detail!, /Nothing blocks this state but the work/, `${code} is cleared and waiting only on work`);
      }
      continue;
    }
    // No layer is registered for any of the rest, and they are still not
    // "UNAVAILABLE": we know what stands in the way, in the publisher's words.
    assert.equal(state.map.status, "LICENCE_BLOCKED", `${code} is blocked, not unexplored`);
    assert.match(state.map.detail!, new RegExp(finding.licence.statedAs.slice(0, 40).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.equal(state.regulations.status, "UNAVAILABLE", "no rules work is spent on a state we may not draw");
  }
});

test("a cleared licence is not a clear road: a recorded refusal to serve outranks it", () => {
  /* Michigan's licence is a public record with no reuse restrictions, so the
     report would otherwise say "nothing blocks this state but the work" — and
     send the next agent to build a state whose unit list we cannot establish.
     A recorded serving decision replaces that sentence. */
  const finding = mapLicenceFindingFor("MI")!;
  assert.ok(["COMMERCIAL_PERMITTED", "PUBLIC_DOMAIN"].includes(finding.licence.permittedUse), "MI's licence permits reuse");
  const michigan = certificationFor("MI");
  assert.equal(michigan.map.status, "UNAVAILABLE");
  assert.doesNotMatch(michigan.map.detail!, /Nothing blocks this state but the work/);
  assert.match(michigan.map.detail!, /not the instrument that decided it/);
});

test("a refusal and a silence are blocked differently, because they are undone differently", () => {
  /* Minnesota answered: its licence forbids commercial display and
     redistribution outright. Wisconsin said nothing at all. Both block, but
     reporting them identically would make a refusal look like an errand. */
  const minnesota = mapLicenceFindingFor("MN")!;
  assert.equal(minnesota.licence.permittedUse, "RESTRICTED");
  assert.equal(minnesota.licence.redistribution, "PROHIBITED");
  assert.match(certificationFor("MN").map.detail!, /terms refuse this use; only a written exception/);

  const wisconsin = mapLicenceFindingFor("WI")!;
  assert.equal(wisconsin.licence.permittedUse, "UNRESOLVED");
  assert.match(certificationFor("WI").map.detail!, /no grant is stated either way; a person must ask/);

  // Neither is ever mistaken for a grant.
  for (const code of ["MN", "WI"]) assert.notEqual(certificationFor(code).map.status, "SERVED");
});
