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

test("all 50 states and D.C. are reported, and every one is counted once per lane", () => {
  const summary = unitedStatesCertification();
  /* Arizona joined when its service was probed and found to present a
     certificate expired since 2022. The list grows as states gain evidence of
     ANY kind, which includes evidence that a source cannot be used. */
  assert.deepEqual(statesWithEvidence(), ["AZ", "CO", "HI", "ID", "ME", "MI", "MN", "MO", "MT", "ND", "NM", "NV", "NY", "OR", "PA", "SD", "UT", "WA", "WI", "WY"]);
  assert.equal(summary.states.length, 51);
  assert.equal(new Set(summary.states.map((entry) => entry.code)).size, 51);
  for (const lane of [summary.totals.map, summary.totals.regulations, summary.totals.intelligence]) {
    assert.equal(Object.values(lane).reduce((total, count) => total + count, 0), summary.states.length);
  }
  /* Hawaii has a finding and is NOT here: its terms permit use. New York is,
     because it refuses redistribution outright; Oregon and Washington are,
     because their terms are unresolved. A state is on this list when its
     geometry cannot be served, never merely because somebody read its page. */
  assert.deepEqual(summary.licenceBlocked.map((entry) => entry.code), ["CO", "ME", "MN", "MT", "ND", "NM", "NV", "NY", "OR", "PA", "SD", "UT", "WA", "WI", "WY"]);
  assert.ok(!summary.licenceBlocked.some((entry) => entry.code === "HI"), "a permissive licence is not a blocker");
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
    /* EXACTLY ONE of the two, never neither. A finding with a licence has terms
       somebody read; a finding with `reachability` explains why nobody could.
       A finding with neither is a state somebody started and walked away from,
       and it would otherwise read as "checked" in the report. */
    const ways = [finding.licence, finding.reachability, finding.licenceAbsent, finding.searchedNoGeography].filter(Boolean).length;
    assert.equal(ways, 1,
      `${code}: a finding carries EXACTLY ONE of licence (terms read), reachability (unreachable), licenceAbsent (nothing stated) or searchedNoGeography (no geography published) — never two, and never none`);
    if (finding.searchedNoGeography) {
      /* A searched-and-empty state must say what it searched and how many
         authority accounts it found, or it is indistinguishable from a state
         nobody opened — which is the whole distinction this state exists for. */
      const searched = certificationFor(code);
      assert.equal(searched.map.status, "UNAVAILABLE", `${code}: nothing to serve, but now for a recorded reason`);
      assert.match(searched.map.detail!, /Searched \d+ unit terms/, `${code}: the detail must say the search happened`);
      assert.ok(finding.searchedNoGeography.termsSearched >= 5, `${code}: a one-term search is not a search`);
      assert.ok(finding.searchedNoGeography.conclusion.length > 40, `${code}: must state what it concluded`);
      continue;
    }
    if (finding.licenceAbsent) {
      /* Nothing stated is not nothing checked: the record must say where it
         looked and carry a positive control, or an absence is just a shrug. */
      const blocked = certificationFor(code);
      assert.equal(blocked.map.status, "LICENCE_BLOCKED", `${code}: unstated terms still block`);
      assert.ok(finding.licenceAbsent.whereLooked.length >= 3, `${code}: must say where it looked`);
      assert.ok(finding.licenceAbsent.controlForTheAbsence.length > 60,
        `${code}: an absence needs a positive control, or it is indistinguishable from a failed request`);
      continue;
    }
    if (finding.reachability) {
      /* No licence claim in either direction, and the certification says so
         rather than borrowing LICENCE_BLOCKED's words. */
      const blocked = certificationFor(code);
      assert.equal(blocked.map.status, "TRANSPORT_BLOCKED", `${code}: unreachable is its own state`);
      assert.match(blocked.map.detail!, /never read, so its terms were never read/);
      assert.ok(finding.reachability.whyNotWorkedAround.length > 40,
        `${code}: must say why it was not worked around, since the workaround is always available`);
      continue;
    }
    assert.ok(licenceRecordIsIntact(finding.licence as never), `${code}: the recorded hash does not match the wording`);
    const state = certificationFor(code);
    const permits = ["COMMERCIAL_PERMITTED", "PUBLIC_DOMAIN"].includes(finding.licence!.permittedUse);
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
    assert.match(state.map.detail!, new RegExp(finding.licence!.statedAs.slice(0, 40).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.equal(state.regulations.status, "UNAVAILABLE", "no rules work is spent on a state we may not draw");
  }
});

test("a cleared licence is not a clear road: a recorded refusal to serve outranks it", () => {
  /* Michigan's licence is a public record with no reuse restrictions, so the
     report would otherwise say "nothing blocks this state but the work" — and
     send the next agent to build a state whose unit list we cannot establish.
     A recorded serving decision replaces that sentence. */
  const finding = mapLicenceFindingFor("MI")!;
  assert.ok(["COMMERCIAL_PERMITTED", "PUBLIC_DOMAIN"].includes(finding.licence!.permittedUse), "MI's licence permits reuse");
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
  assert.equal(minnesota.licence!.permittedUse, "RESTRICTED");
  assert.equal(minnesota.licence!.redistribution, "PROHIBITED");
  assert.match(certificationFor("MN").map.detail!, /terms refuse this use; only a written exception/);

  const wisconsin = mapLicenceFindingFor("WI")!;
  assert.equal(wisconsin.licence!.permittedUse, "UNRESOLVED");
  assert.match(certificationFor("WI").map.detail!, /no grant is stated either way; a person must ask/);

  // Neither is ever mistaken for a grant.
  for (const code of ["MN", "WI"]) assert.notEqual(certificationFor(code).map.status, "SERVED");
});

test("a licence that permits use is not filed as a blocker, and is not filed as served either", () => {
  /* Hawaii is the first United States jurisdiction whose publisher's own terms
     permit use: "The contents of this web page are public domain", from the
     Hawaii Statewide GIS Program on the State's own host, with the layer's
     copyrightText naming the Department of Land and Natural Resources.

     It is pinned here because it is the case that had nowhere to go. Before
     LICENCE_CLEAR_NOT_INGESTED existed, a permissive licence with no layer fell
     through to UNAVAILABLE — the same word as a state nobody had looked at. The
     two assertions below are the ones that matter, and they point in opposite
     directions: not blocked, and not served. */
  const hawaii = certificationFor("HI");
  assert.equal(hawaii.map.status, "LICENCE_CLEAR_NOT_INGESTED");
  assert.equal(hawaii.map.layers.length, 0, "cleared is not ingested");
  assert.equal(hawaii.regulations.status, "UNAVAILABLE", "and a boundary licence says nothing about rules");
  const finding = mapLicenceFindingFor("HI")!;
  assert.equal(finding.licence!.permittedUse, "PUBLIC_DOMAIN");
  assert.equal(finding.licence!.redistribution, "PERMITTED");
  /* The qualification is recorded rather than waved through: the grant
     qualifies itself "to the extent indicated otherwise in the Terms of Use",
     and that page could not be located. An express grant whose own carve-out is
     unverifiable is not the same as an unqualified one, and the note has to say
     so — otherwise the next person reads PUBLIC_DOMAIN and stores the geometry. */
  assert.match(finding.licence!.note!, /404/);
  assert.match(finding.licence!.note!, /to the extent indicated otherwise/);
  /* And the detail a report prints must not read like coverage. */
  /* And the row uses the sentence this report already had for a cleared state,
     rather than a second one meaning the same thing. */
  assert.match(hawaii.map.detail ?? "", /Nothing blocks this state but the work/);
});

test("a feature count is never taken as a unit count", () => {
  /* Three states in one pass published a layer whose feature count overstates
     its unit system, each for a different reason, and the overstatement is
     always in the direction that looks like MORE coverage:

       Hawaii     186 features, 121 hunting areas — the rest are closures and
                  safety zones, so the excess would draw a safety zone as
                  huntable ground.
       Oregon      69 features,  67 units — two are REGION='NOT MANAGED', a
                  reservation and a national park.
       Washington 1,688 features in "GMU Boundary" against 152 in "GMU
                  Generalized" — the larger number is boundary SEGMENTS, so
                  reading it as units overstates the state elevenfold.

     Pinned together because the failure is one habit, not three facts. */
  const counts = { HI: 121, OR: 67, WA: 152 };
  for (const [code, expected] of Object.entries(counts)) {
    assert.equal(mapLicenceFindingFor(code)!.geography.unitCount, expected, `${code} records units, not features`);
  }
  assert.match(mapLicenceFindingFor("OR")!.geography.theFeatureCountIsNotTheUnitCount!, /69 features/);
});

test("two states are blocked by transport, and neither is mistaken for a refusal", () => {
  /* Arizona's service presents a certificate expired since 2022; Missouri's own
     hunting-zone host does not complete a connection at all (HTTP 0 — not a 4xx
     or 5xx, so not even an answer). Both are TRANSPORT_BLOCKED, and the point of
     the separate state is that neither is undone by reading a licence. */
  for (const code of ["AZ", "MO"]) {
    assert.equal(certificationFor(code).map.status, "TRANSPORT_BLOCKED", `${code} is blocked by transport`);
    const finding = mapLicenceFindingFor(code)!;
    assert.equal(finding.reachability!.state, "TRANSPORT_BLOCKED");
    /* An unreachable host proves nothing on its own: the same output comes from
       a broken fetcher. Each one carries the control that discriminates. */
    assert.ok(Object.keys(finding.reachability!.evidence).length >= 2, `${code} records more than the failure itself`);
  }
  /* And Missouri's real finding is not the outage: it is that Missouri publishes
     no unit grid at all. A resolver demanding one finds nothing in a state whose
     authority sets deer and turkey rules by county. */
  assert.match(mapLicenceFindingFor("MO")!.geography.term, /COUNTY/);
  assert.equal(mapLicenceFindingFor("MO")!.geography.unitCount, null, "no unit count, because there are no units");
});

test("where the authority's own two hosts disagree, neither is served", () => {
  /* Pennsylvania publishes from its ArcGIS Online account AND from its own
     server, and they disagree on two layers: 11 elk hunt zones against 14, and
     7 hunting-hours meridian bands against 6. Elk licences are allocated BY
     ZONE, so answering 11 where the law uses 14 would route hunters to the wrong
     zone with an answer that looks entirely normal.

     §8 provides CONFLICT so this is reportable without being decided. Choosing
     the larger, the smaller or the more recently modified copy would each be an
     invention dressed as a resolution. */
  const conflict = mapLicenceFindingFor("PA")!.conflict!;
  assert.equal(conflict.state, "CONFLICT");
  assert.equal(conflict.doNotServeEitherUntilResolved, true);
  assert.match(conflict.whatWouldResolveIt, /139\.18/, "resolved from the instrument, not from either GIS copy");
  assert.equal(certificationFor("PA").map.layers.length, 0, "nothing is served while it stands");
});
