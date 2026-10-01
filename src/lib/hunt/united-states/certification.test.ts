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
  /* 45 firearm/archery and closure rules and 26 falconry rules over eight
     upland species (us-montana.test.ts pins the same count from the bundle). */
  assert.equal(montana.regulations.rules, 71);
  assert.deepEqual(montana.regulations.species.length, 8);
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
  assert.deepEqual(statesWithEvidence(), ["AK", "AL", "AR", "AZ", "CA", "CO", "CT", "DC", "DE", "FL", "GA", "HI", "IA", "ID", "IL", "IN", "KS", "KY", "LA", "MA", "MD", "ME", "MI", "MN", "MO", "MS", "MT", "NC", "ND", "NE", "NH", "NJ", "NM", "NV", "NY", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VA", "VT", "WA", "WI", "WV", "WY"]);
  assert.equal(summary.states.length, 51);
  assert.equal(new Set(summary.states.map((entry) => entry.code)).size, 51);
  for (const lane of [summary.totals.map, summary.totals.regulations, summary.totals.intelligence]) {
    assert.equal(Object.values(lane).reduce((total, count) => total + count, 0), summary.states.length);
  }
  /* Hawaii has a finding and is NOT here: its terms permit use. New York is,
     because it refuses redistribution outright; Oregon and Washington are,
     because their terms are unresolved. A state is on this list when its
     geometry cannot be served, never merely because somebody read its page. */
  assert.deepEqual(summary.licenceBlocked.map((entry) => entry.code), ["AK", "AL", "AR", "CO", "CT", "DE", "GA", "IA", "IL", "IN", "KS", "LA", "MA", "MD", "ME", "MN", "MS", "MT", "ND", "NH", "NJ", "NM", "NV", "NY", "OH", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VA", "WA", "WI", "WV", "WY"]);
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
      } else if (finding.lawVersusGis) {
        /* A third recorded decision, and the two kinds must not read alike.
           WHOLESALE means the layer is not served; WHERE_IT_STOPS means it is
           served and its gap is named. Saying "do not serve" of Florida would
           discard its mainland over its lower Keys. */
        assert.match(state.map.detail!,
          finding.lawVersusGis.defect === "WHOLESALE" ? /DO NOT SERVE AS PUBLISHED/ : /SERVABLE, WITH A RECORDED GAP/,
          `${code}'s row must match the reach of its defect`);
      } else {
        assert.match(state.map.detail!, /Nothing blocks this state but the work/, `${code} is cleared and waiting only on work`);
      }
      continue;
    }
    // No layer is registered for any of the rest, and they are still not
    // "UNAVAILABLE": we know what stands in the way, in the publisher's words.
    assert.equal(state.map.status, "LICENCE_BLOCKED", `${code} is blocked, not unexplored`);
    assert.match(state.map.detail!, new RegExp(finding.licence!.statedAs.slice(0, 40).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    /*
     * CORRECTED 2026-09-30, on the owner's amendment to §44.
     *
     * This asserted `regulations.status === "UNAVAILABLE"` — "no rules work is
     * spent on a state we may not draw". That was the collapse §44 now forbids:
     * it let a GEOMETRY licence question block REGULATORY facts, so a state whose
     * polygons we may not store was also reported as having no readable rules.
     * Reading, deriving and archiving are three different rights.
     *
     * What must STILL hold, and is asserted instead: a state we may not draw
     * cannot be SERVING rules, because serving them means answering through that
     * geometry. The engine already makes this structural — `rulesServing` reads
     * the registered layers and a blocked state has none — and it is pinned here
     * so the two facts stay separable.
     */
    assert.notEqual(state.regulations.status, "SERVED",
      `${code}: rules cannot be served through geometry we may not draw`);
    assert.equal(state.regulations.rulesServing, false, `${code}: no layer is serving rules`);
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

test("a publisher may forbid the exact use Hunt makes of geometry, and that is not the licence", () => {
  /* Alaska is the first US state found to do it. Its terms say, and the current
     edition keeps saying: "Not to be used with GPS to determine physical
     boundaries." Resolving a hunter's position to the subunit they are standing
     in IS using this data with GPS to determine a physical boundary.

     It is recorded apart from the licence because the two are undone by
     different things. Consent would answer the redistribution clause and leave
     this standing — so a future reader who obtains consent must not be able to
     conclude Alaska is unblocked. */
  const finding = mapLicenceFindingFor("AK")!;
  assert.equal(finding.licence!.redistribution, "PROHIBITED");
  assert.match(finding.theTermsAlsoForbidTheUseHuntMakes!.statedAs, /Not to be used with GPS/);
  assert.match(finding.theTermsAlsoForbidTheUseHuntMakes!.whyItIsRecordedSeparatelyFromTheLicence, /consent/);
  /* And the licence note records WHY a partial read would have inverted it: the
     prohibition is the last sentence after a permissive-sounding paragraph. */
  assert.match(finding.licence!.note!, /TRUNCATION WOULD HAVE INVERTED THE ANSWER/);
});

test("a plausible layer name is not a regulatory geography", () => {
  /* New Jersey publishes 88 Deer Management ZONES and 632 Deer Management
     UNITS. The zones set the seasons; the 632 are a sequential 1..632 analysis
     grid. This is a different failure from a feature count being too high —
     both numbers are the honest count of their own layer, and the count cannot
     tell them apart. Only the DISTINCT values of the unit field can.

     Recorded because my first pass wrote New Jersey down as "632 Deer
     Management Units" on the strength of the layer's name, which would have
     answered with a grid cell carrying a real-looking unit id. */
  const finding = mapLicenceFindingFor("NJ")!;
  assert.equal(finding.geography.unitCount, 88, "zones, not the grid");
  assert.match(finding.geography.term, /Deer Management Zone/);
  assert.match(finding.geography.theNamedLayerIsTheWrongCONCEPT!, /632/);
});

test("a clear licence over stale data is more dangerous than a refusal", () => {
  /* KENTUCKY. Its licence is the best in the country — an affirmative CC0 1.0
     dedication, corroborated by the state's own DCAT catalogue. And KDFWR's deer
     zone layer assigns 46 of 120 counties to a different zone than 301 KAR
     2:172, because the column aliased "Current Years Deer Zone" is byte-identical
     to the same layer's 2007-08 column.

     Every surface signal said current: right publisher, "Annual" in the title, an
     edit date of 2026-07-10, 120 clean county polygons, exactly four zone values.
     A refusal would have stopped the ingest. A clear licence does not. So the
     report's cleared-state row must NOT say "nothing blocks this state but the
     work" — that sentence is what sends the next agent to ingest it. */
  const kentucky = certificationFor("KY");
  assert.equal(kentucky.map.status, "LICENCE_CLEAR_NOT_INGESTED");
  assert.doesNotMatch(kentucky.map.detail ?? "", /Nothing blocks this state but the work/);
  assert.match(kentucky.map.detail ?? "", /DO NOT SERVE AS PUBLISHED/);
  /* And it must name the path that IS defensible, because §8 forbids discarding
     a state that can be answered. */
  assert.match(kentucky.map.detail ?? "", /301 KAR 2:172/);

  const finding = mapLicenceFindingFor("KY")!;
  assert.equal(finding.licence!.permittedUse, "PUBLIC_DOMAIN");
  assert.equal(finding.lawVersusGis!.state, "GIS_CONTRADICTS_THE_LAW");
  /* The staleness was PROVEN by a query with a positive control, not inferred
     from a date. An assertion here would be worthless. */
  assert.match(finding.lawVersusGis!.howTheStaleSideWasProven, /positive control/);
  assert.match(finding.lawVersusGis!.howTheStaleSideWasProven, /DZ200708/);
});

test("a state cleared with no recorded trap still says so plainly", () => {
  /* The other side of the branch above, so the warning cannot be vacuous: a
     cleared state with nothing recorded against it keeps the original sentence.
     Hawaii is that state. */
  const hawaii = certificationFor("HI");
  assert.equal(hawaii.map.status, "LICENCE_CLEAR_NOT_INGESTED");
  assert.equal(mapLicenceFindingFor("HI")!.lawVersusGis, undefined);
  assert.match(hawaii.map.detail ?? "", /Nothing blocks this state but the work/);
});

test("terms can hide in a fourth field, and reading the licence field alone clears a refusal", () => {
  /* ARKANSAS. Its licenseInfo is a boundary-accuracy disclaimer, which blocks
     nothing. The express limitation of permitted use — "not for use beyond
     AGFC's Generation Conservation Summit" — is in the portal item's
     DESCRIPTION. Reading the field named "licence" would have cleared a state
     whose data may not be used at all. */
  const finding = mapLicenceFindingFor("AR")!;
  assert.equal(finding.licence!.permittedUse, "RESTRICTED");
  assert.match(finding.termsInTheDescriptionField!.statedAs, /not for use beyond/);
  assert.match(finding.termsInTheDescriptionField!.whatTheLicenceFieldSaidInstead, /accuracy disclaimer/i);
  assert.equal(certificationFor("AR").map.status, "LICENCE_BLOCKED");
});

test("the same words are certifiable in one state and not in another", () => {
  /* Alabama and Kentucky both say hunting is permitted during "daylight hours".
     Kentucky DEFINES the term in statute — KRS 150.010(8), half an hour before
     sunrise to half an hour after sunset — so our astronomy reproduces it.
     Alabama leaves it undefined, so there is no numeric rule to reproduce and
     choosing an offset would be inventing the law.

     This is a third kind of hours rule, and the inverse of Washington's: not a
     table dressed as a formula, but a term with no formula at all. */
  const alabama = mapLicenceFindingFor("AL")!;
  assert.match(alabama.legalHours!.finding, /UNDEFINED/);
  assert.match(alabama.legalHours!.contrastWithKentucky!, /KRS 150\.010\(8\)/);
  /* And Alabama's real blocker is not its licence: nobody publishes its deer
     zones as vector data, so a point cannot be resolved to a deer zone at all. */
  assert.match(alabama.geography.theAbsenceIsTheFinding!, /CANNOT be resolved/);
  assert.equal(alabama.geography.unitCount, null);
});

test("a live authoritative endpoint can serve geography the authority has abolished", () => {
  /* ILLINOIS. IDNR combined the South-Central and South waterfowl zones into one
     South Zone for 2026-2030, and its live layer still serves four. A 200 from
     the agency's own host, resolving points in WGS84, returning clean named
     zones — and one of those names no longer exists in law. */
  const illinois = mapLicenceFindingFor("IL")!;
  assert.equal(illinois.lawVersusGis!.state, "GIS_CONTRADICTS_THE_LAW");
  assert.match(illinois.lawVersusGis!.gisSays, /South Central/);
  assert.match(illinois.lawVersusGis!.lawSays, /combined/);
  /* And there is no path from the law yet, which must be said rather than left
     to look like an oversight: the new lines are published as images only. */
  assert.match(illinois.lawVersusGis!.servablePathFromTheLaw!, /images only|not as vector/);
});

test("a layer that stops short is not a layer that is wrong", () => {
  /* FLORIDA against KENTUCKY. Both are states whose own GIS contradicts their
     own law, and the consequences are opposite:

       Kentucky   the zone attribute is the 2007-08 season across all 120
                  counties, so the layer is not served at all.
       Florida    the DMU layer is an exact 1:1 match with the twelve units
                  codified in 68A-13.0001 — the only such match found in the
                  United States — and simply ends at 24.8814°N while the rule
                  reaches the end of the Keys.

     Collapsing these into one "GIS conflict" and refusing both would discard
     Florida's mainland because its lower Keys are unresolvable. §8 makes that
     over-strict refusal as false as a loose claim, and it is the direction
     nobody reports, because a refusal always looks defensible. */
  const florida = mapLicenceFindingFor("FL")!;
  const kentucky = mapLicenceFindingFor("KY")!;
  assert.equal(florida.lawVersusGis!.defect, "WHERE_IT_STOPS");
  assert.equal(kentucky.lawVersusGis!.defect, "WHOLESALE");
  assert.match(certificationFor("FL").map.detail ?? "", /SERVABLE, WITH A RECORDED GAP/);
  assert.match(certificationFor("KY").map.detail ?? "", /DO NOT SERVE AS PUBLISHED/);
  /* Florida's row must say the mainland survives, in words. */
  assert.match(florida.lawVersusGis!.doNotServe, /must not be discarded/);
  /* And a Keys point is neither closed nor zoneless: the rule names Monroe
     County, so the zone MEMBERSHIP is known even where the polygon is not. */
  assert.match(florida.lawVersusGis!.doNotServe, /do not report it as no-zone or closed/);
  assert.match(florida.geography.theLayerStopsShortOfTheLaw!, /30 km/,
    "the miss was retested with tolerance, so it is a layer that stops rather than a point in water");
});

test("a blocked rules host is not a blocked map", () => {
  /* Massachusetts's zone service answers 200 while mass.gov returns 403 to every
     fetcher, including curl with a full desktop Chrome User-Agent, on three
     separate URLs — and the same URLs return 200 in a real browser engine. New
     Hampshire's GIS item answers while wildlife.nh.gov returns 403 on six paths,
     with a positive control (gc.nh.gov answered in the same session) localising
     the fault to the agency's host.

     Recording either as TRANSPORT_BLOCKED in the MAP lane would assert the map
     cannot be reached, which is false. Both halves fail, for different reasons,
     and the report has to say which. */
  for (const code of ["MA", "NH"]) {
    const finding = mapLicenceFindingFor(code)!;
    assert.equal(finding.reachability, undefined, `${code}'s MAP service is reachable`);
    assert.equal(finding.rulesReachability!.state, "TRANSPORT_BLOCKED");
    assert.notEqual(certificationFor(code).map.status, "TRANSPORT_BLOCKED",
      `${code}'s map lane must not claim the map is unreachable`);
    /* And refusing to defeat the block is stated as a choice, not an omission. */
    assert.match(finding.rulesReachability!.whyNotWorkedAround, /access control/);
  }
  /* Arizona and Missouri remain the real map-transport cases, so the distinction
     is not vacuous. */
  for (const code of ["AZ", "MO"]) {
    assert.equal(certificationFor(code).map.status, "TRANSPORT_BLOCKED");
  }
});

test("the District of Columbia is the first US jurisdiction that can be finished", () => {
  /* DC lacks hunting, not data — and that distinction is the whole finding. Its
     substantive game-law provisions were repealed; 19 DCMR § 1560.1 protects all
     wildlife and the chapter authorises no taking, so it is a closed loop with
     nothing in it; DC is in NO federal flyway under 50 CFR 20.107, so there is
     no vehicle for a migratory season either; and § 22-4503.01 forbids
     discharging a firearm without a police permit, with no hunting exception.

     Reporting that as UNKNOWN would understate what the authority establishes,
     which §8 treats as the same class of error as overstating it — and it is the
     clearest available instance of the under-claim direction §8 says nobody ever
     reports. */
  const finding = mapLicenceFindingFor("DC")!;
  assert.equal(finding.geography.unitCount, 0, "zero units, not an unknown number of them");
  assert.match(finding.completableNow!.whyItMustNotBeServedAsUNKNOWN, /AFFIRMATIVELY ESTABLISHED/);
  /* The absence was established with a control inside the same listing: it
     returns the FISHING sections, so the fetcher works and the hunting
     provisions are genuinely absent. */
  assert.match(finding.geography.theAbsenceIsTheFinding!, /POSITIVE CONTROL/);
  assert.match(finding.geography.theAbsenceIsTheFinding!, /19-1506 fishing seasons/);
  /* Its licence permits use, so nothing stands in the way but the work. */
  assert.equal(certificationFor("DC").map.status, "LICENCE_CLEAR_NOT_INGESTED");
  assert.equal(finding.licence!.redistribution, "PERMITTED");
});

test("a permissive licence that belongs to another publisher is not a grant", () => {
  /* KANSAS, and it is the most dangerous shape found, because it READS as a
     grant. Both Kansas deer items carry U.S. Census Bureau TIGER/Line
     boilerplate — "not copyrighted", "free to use in a product or publication"
     with acknowledgement. Reporting it would have given Kansas a permissive
     licence it never issued.

     It was caught by what surrounds it, not by reading it: the identical
     775-character string sits on six unrelated items created up to six years
     apart, beside item descriptions listing 2010 census population fields
     (POP2010, WHITE, MED_AGE) that exist in none of the layers. And taken at
     face value it argues against itself — it says the boundaries "are not legal
     land descriptions" while K.A.R. 115-4-6 defines the units by metes and
     bounds. */
  const kansas = mapLicenceFindingFor("KS")!;
  assert.ok(kansas.licenceAbsent, "Kansas states no terms of its own");
  assert.equal(kansas.licence, undefined, "and the Census text is not recorded as its licence");
  const inherited = kansas.theInheritedLicenceThatIsNotTheirs!;
  assert.match(inherited.statedAs, /TIGER\/Line/);
  assert.match(inherited.howItWasCaught, /six unrelated items/);
  assert.match(inherited.andItIsEvidenceAgainstFitness, /not legal land descriptions/);
  assert.equal(certificationFor("KS").map.status, "LICENCE_BLOCKED");
});

test("a conflict invisible at the count level is still a conflict", () => {
  /* GEORGIA. Its codified rule and its own map layer disagree about whether
     Bartow County has an either-sex deer season — while BOTH sets contain 133
     counties, so every count check passes. Only a set comparison finds it, which
     is why Georgia's parity was certified by set comparison rather than by count.

     Neither side is declared stale, because the evidence does not settle which is
     right, and saying so is the honest state. */
  const georgia = mapLicenceFindingFor("GA")!;
  assert.equal(georgia.lawVersusGis!.state, "GIS_CONTRADICTS_THE_LAW");
  assert.match(georgia.lawVersusGis!.finding, /INVISIBLE AT THE COUNT LEVEL/);
  assert.match(georgia.lawVersusGis!.howTheStaleSideWasProven, /does not settle which is right/);
  /* And §8 in the other direction: one county's conflict does not discard 158. */
  assert.match(georgia.lawVersusGis!.doNotServe, /do not discard the other 158/);
  /* Georgia's administrative DMU field must never be served as a hunting unit. */
  assert.match(georgia.geography.administrativeFieldsThatMustNeverBeServed!, /ZERO TIMES/);
});

test("every one of the 51 jurisdictions is accounted for, by a finding or by a layer", () => {
  /* The milestone this programme was aimed at, and it is stated as a derivation
     rather than as a number somebody typed: a jurisdiction is accounted for when
     it has a licence FINDING, or when it has a registered LAYER whose own licence
     governs instead. Colorado, Idaho, Montana and Wyoming are the second kind —
     the first wave, whose terms live on the layer via licencePermitsServing. */
  const summary = unitedStatesCertification();
  assert.equal(summary.states.length, 51);
  const unaccounted = summary.states.filter(
    (entry) => !mapLicenceFindingFor(entry.code) && entry.map.layers.length === 0);
  assert.deepEqual(unaccounted.map((entry) => entry.code), [],
    "a jurisdiction with neither a finding nor a layer has not been looked at");
  /* And the four with layers really do have them, so the clause above is not a
     loophole that would swallow an unexamined state. */
  for (const code of ["CO", "ID", "MT", "WY"]) {
    assert.ok(certificationFor(code).map.layers.length > 0, `${code} is accounted for by its layer`);
  }
});

test("one service can hold two different licence states, and neither borrows from the other", () => {
  /* VERMONT. Its Wildlife Management Units carry CC BY-SA — the whole licence is
     those two words, with no conditions paragraph and no prohibition. Its
     Waterfowl Hunting Zones and State Game Refuges, on the same host, in the same
     service, under the same account, in the same publication window, state
     NOTHING: layer copyrightText empty, item licenseInfo null, structuredLicense
     type "none".

     Borrowing the granted dataset's terms onto the silent ones would be a false
     claim in the permissive direction, which is the direction that gets data
     served. */
  const vermont = mapLicenceFindingFor("VT")!;
  assert.equal(vermont.licence!.permittedUse, "COMMERCIAL_PERMITTED");
  assert.match(vermont.termsDifferPerDatasetInOneService!.finding, /DIFFERENT LICENCE STATE per dataset/);
  assert.match(vermont.termsDifferPerDatasetInOneService!.consequence, /cannot be classified once/);
  /* The version is inferred from a machine field, not written by the Agency —
     recorded, because "CC BY-SA 4.0" would be a claim nobody made. */
  assert.match(vermont.licence!.note!, /THE VERSION IS INFERRED, NOT WRITTEN/);
});

test("a terms page can return 200 and not exist", () => {
  /* ArcGIS Hub answers HTTP 200 for any unknown slug, so a plausible terms URL
     "works". Vermont's was caught two ways: the site's own page registry lists 12
     pages and terms-of-use is not among them, and a byte-count control against a
     page that IS registered returned 65,865 against the nonexistent page's
     65,868 — the identical client shell.

     Pinned because a 200 is exactly what would otherwise be recorded as a source. */
  const caught = mapLicenceFindingFor("VT")!.theTermsPageThatReturns200AndDoesNotExist!;
  assert.match(caught.finding, /returns HTTP 200 AND THERE IS NO SUCH PAGE/);
  assert.match(caught.provenTwoWays, /POSITIVE CONTROL BY BYTE COUNT/);
  /* And the page that genuinely could not be read is kept separate from the one
     that does not exist — a 403 is not a 404. */
  assert.match(caught.andOnePageIsGenuinelyUnread!, /403/);
});

test("a permissive licence attached to the wrong object is not that dataset's licence", () => {
  /* TENNESSEE, and it is Kansas's error in the mirror. Kansas carried inherited
     Census boilerplate that was too permissive for the wrong reason; Tennessee's
     "CC-BY-SA" is real and attached to the Hub SITE APPLICATION item, not to any
     dataset. Both would have produced a grant that nobody issued for the thing
     being served. */
  const tennessee = mapLicenceFindingFor("TN")!;
  assert.ok(tennessee.licenceAbsent, "the datasets themselves state nothing");
  assert.equal(tennessee.theHubSiteLicenceIsNotTheDatasetsLicence!.statedAs, "CC-BY-SA");
  assert.match(tennessee.theHubSiteLicenceIsNotTheDatasetsLicence!.finding, /HUB SITE APPLICATION ITEM/);
  /* And one Tennessee licence field is not a licence at all: it says the layer
     may show changes only REQUESTED of the Commission. That is the publisher
     telling you its own layer is not the instrument — Michigan's shape exactly. */
  assert.match(tennessee.theHubSiteLicenceIsNotTheDatasetsLicence!.andOneLicenceFieldIsACurrencyWarning!,
    /requested of the commission/i);
});

test("an outstanding parity check is recorded as outstanding", () => {
  /* SOUTH CAROLINA passed every check run against it: 4 units, 4 features, a
     coded-value domain, one closed ring per zone, geographically correct extents,
     and the statute's own county arithmetic closing at 46. Which is precisely the
     situation where the check nobody ran gets forgotten — and the Game Zone 1/2
     line is not a county line at all. The statute describes it as the main line
     of the Norfolk Southern Railroad and S.C. Highway 183, and the drawn geometry
     was never verified against that description. */
  const sc = mapLicenceFindingFor("SC")!;
  assert.match(sc.geography.theOutstandingParityCheck!, /NOT verified/);
  assert.match(sc.geography.theOutstandingParityCheck!, /Norfolk Southern Railroad/);
  /* And its strongest permission language is an availability statement, which is
     not a licence — inflating it would be the permissive error. */
  assert.match(sc.licenceAbsent!.finding, /AVAILABILITY statement, not a licence/);
});

test("a state whose geometry is blocked may still carry certified regulatory facts", () => {
  /* The capability the amendment creates, asserted rather than assumed.
     §44: reading, deriving and archiving are three different rights, and "missing
     copyright labels never erase independently established regulatory facts".

     Eight states — AL, CT, IA, IL, LA, MA, MS, UT — state no reuse terms at all.
     Their GEOMETRY stays under licence review, because storing a polygon dataset
     IS archival and §44 says so explicitly. Their RULES do not.

     This test does not yet find a state with both, because none has certified
     rules under the new model — so it asserts the SHAPE: nothing in the
     certification derives regulations from the map lane, which is what made the
     old collapse possible. If a future change re-couples them, the derivation
     below stops holding. */
  const summary = unitedStatesCertification();
  const blocked = summary.states.filter((entry) => entry.map.status === "LICENCE_BLOCKED");
  assert.ok(blocked.length > 20, `expected most states blocked on geometry, got ${blocked.length}`);

  /* Regulations are a function of bundles and cases alone, and Montana shows the
     two lanes are already independent in the engine: its map is LICENCE_BLOCKED
     and its 28 rules are CERTIFIED.

     BUT MONTANA IS NOT EVIDENCE THAT THE OLD ASSERTION FORBADE THIS, and an
     earlier draft of this comment claimed it was. Montana has no licence FINDING
     at all — it is one of the four first-wave states (CO, ID, MT, WY) blocked by
     its own registered layer's licence — so the corrected assertion's loop, which
     runs over states WITH findings, never reached it. Every state that loop did
     reach (Maine, Minnesota, Wisconsin) has 0 rules, so the old assertion passed
     vacuously and the collapse was latent rather than live. It would have fired
     the first time anyone certified rules for a state whose publisher refuses its
     geometry, which is exactly what §44 now invites. */
  const montana = certificationFor("MT");
  assert.equal(montana.map.status, "LICENCE_BLOCKED", "Montana's geometry is licence-blocked");
  assert.equal(montana.regulations.status, "CERTIFIED", "and its rules are certified anyway");
  assert.ok(montana.regulations.rules > 0);
  assert.equal(montana.regulations.rulesServing, false, "certified is not served: nothing answers through the blocked layer");
  assert.equal(mapLicenceFindingFor("MT"), undefined, "and Montana is blocked by its layer, not by a finding");

  /* The states the old assertion DID reach, so the vacuity is recorded as a
     measurement rather than as a guess. */
  for (const code of ["ME", "MN", "WI"]) {
    assert.ok(mapLicenceFindingFor(code)?.licence, `${code} has a licence finding, so the old loop reached it`);
    assert.equal(certificationFor(code).regulations.rules, 0, `${code} has no rules, which is why the old assertion passed`);
  }

  /* And the eight terms-unstated states are still blocked on the MAP, because
     §44 does not unblock geometry. Asserting this is what keeps the ruling from
     being over-applied. */
  for (const code of ["AL", "CT", "IA", "IL", "LA", "MA", "MS", "UT"]) {
    assert.equal(certificationFor(code).map.status, "LICENCE_BLOCKED",
      `${code}: unstated terms still leave geometry under licence review`);
  }
});
