import assert from "node:assert/strict";
import test from "node:test";
import type { CanonicalId, IsoDate } from "../../content-contract/index.ts";
import { regulatoryEntryFor } from "../regulatory/registry.ts";
import { contentRepository } from "../../content/repository.ts";
import { speciesById } from "../coverage.ts";
import { ZONE_LAYERS, layerById, officialNameOf, zoneIdFor } from "../zone-layers.ts";
import { clearZoneSummaryCache, stateOf as engineStateOf, summarizeZone, zoneStatesForSpecies, ZoneSummaryError } from "./zone-summary.ts";

const species = (id: string) => id as CanonicalId<"species">;

function stateOf(summary: Awaited<ReturnType<typeof summarizeZone>>, speciesId: string) {
  return summary.species.find((entry) => entry.speciesId === speciesId)?.state;
}

test("a zone card is the canonical engine's answer, asked about the whole zone", async () => {
  clearZoneSummaryCache();
  const layer = layerById("layer:ca-on-wmu")!;
  const entry = regulatoryEntryFor(layer.jurisdictionId)!;
  const summary = await summarizeZone({ layerId: layer.id, designation: "57" }, "2026-09-21");
  for (const row of summary.species) {
    const outcome = await entry.evaluate(
      { latitude: Number.NaN, longitude: Number.NaN, date: "2026-09-21" as IsoDate, speciesId: row.speciesId, answers: {} },
      { status: "RESOLVED", zoneId: zoneIdFor(layer, "57"), jurisdictionId: layer.jurisdictionId, officialName: "Wildlife Management Unit 57", sourceId: layer.sourceId, message: "" },
      { verifiedAt: "2026-09-21T00:00:00.000Z", scope: "ZONE" },
    );
    const expected = outcome.completeness === "NEEDS_INPUT" ? "CHECK_REQUIREMENTS"
      : outcome.regulation.status === "CONDITIONAL" || outcome.regulation.status === "OPEN" ? "SEASON_AVAILABLE"
      : outcome.regulation.status;
    assert.equal(row.state, expected, row.name);
  }
  assert.equal(summary.counts.jurisdictionSpecies, entry.coverage().species.length);
});

test("a species that depends on the hunter is never shown as in season", async () => {
  const summary = await summarizeZone({ layerId: "layer:ca-on-wmu", designation: "71" }, "2026-11-10");
  const deer = summary.species.find((entry) => entry.speciesId === "species:white-tailed-deer")!;
  // WMU 71's gun season excludes rifles by footnote; a zone card cannot know the hunter's implement.
  assert.equal(deer.state, "CHECK_REQUIREMENTS");
  assert.match(deer.question ?? "", /resident/i);
  assert.equal(summary.species.some((entry) => (entry.state as string) === "OPEN"), false);
});

test("UNKNOWN stays UNKNOWN and is never drawn as CLOSED", async () => {
  const wmu71 = await summarizeZone({ layerId: "layer:ca-on-wmu", designation: "71" }, "2026-11-10");
  assert.equal(stateOf(wmu71, "species:moose"), "UNKNOWN");

  const wmu718 = await summarizeZone({ layerId: "layer:ca-ab-wmu", designation: "718" }, "2026-09-21");
  assert.equal(wmu718.counts.certifiedHere, 0);
  assert.ok(wmu718.species.every((entry) => entry.state === "UNKNOWN"));

  // Algonquin: no small-game row names WMU 51, and absence there is not a closure.
  const wmu51 = await summarizeZone({ layerId: "layer:ca-on-wmu", designation: "51" }, "2026-10-01");
  assert.equal(stateOf(wmu51, "species:ruffed-grouse"), "UNKNOWN");
});

test("CLOSED appears only where the certified rules close it", async () => {
  // GHA 7A on 1 October: no white-tailed deer season is open for any licence or equipment.
  const gha7a = await summarizeZone({ layerId: "layer:ca-mb-gha", designation: "7A" }, "2026-10-01");
  assert.equal(stateOf(gha7a, "species:white-tailed-deer"), "CLOSED");
  // On 4 November some licences have a season and others do not, so the hunter decides.
  const later = await summarizeZone({ layerId: "layer:ca-mb-gha", designation: "7A" }, "2026-11-04");
  assert.equal(stateOf(later, "species:white-tailed-deer"), "CHECK_REQUIREMENTS");
});

test("the Hunt date decides the status, calendar day by calendar day", async () => {
  const before = await summarizeZone({ layerId: "layer:ca-on-wmu", designation: "57" }, "2026-09-14");
  const opening = await summarizeZone({ layerId: "layer:ca-on-wmu", designation: "57" }, "2026-09-15");
  assert.equal(stateOf(before, "species:ruffed-grouse"), "CLOSED");
  assert.equal(stateOf(opening, "species:ruffed-grouse"), "SEASON_AVAILABLE");
  assert.equal(before.date, "2026-09-14");
  // A date past the certified period is a different law North Ground has not read.
  const later = await summarizeZone({ layerId: "layer:ca-on-wmu", designation: "57" }, "2027-06-01");
  assert.equal(stateOf(later, "species:ruffed-grouse"), "NEEDS_VERIFICATION");
});

test("an answer that varies inside the zone is not given for the whole zone", async () => {
  // Part of GHA 30 is CFB Shilo, which grouse seasons exclude.
  const gha30 = await summarizeZone({ layerId: "layer:ca-mb-gha", designation: "30" }, "2026-10-01");
  const grouse = gha30.species.find((entry) => entry.speciesId === "species:ruffed-grouse")!;
  assert.equal(grouse.state, "NEEDS_VERIFICATION");
  assert.match(grouse.detail ?? "", /Shilo/);
  // Manitoba's special areas are indexed per zone, so none is left as a point-only caveat.
  assert.equal(gha30.pointOnlyChecks, null);
  assert.ok(gha30.specialAreas?.some((area) => area.name.startsWith("Spruce Woods")));
});

test("a season that runs across a zone is not claimed inside the restricted areas within it", async () => {
  // GHA 38 contains closed land, including the portion in the City of Winnipeg.
  const gha38 = await summarizeZone({ layerId: "layer:ca-mb-gha", designation: "38" }, "2026-10-01");
  const grouse = gha38.species.find((entry) => entry.speciesId === "species:ruffed-grouse")!;
  assert.equal(grouse.state, "SEASON_EXCEPT_AREAS");
  assert.ok(grouse.exceptInside?.includes("Portion of GHA 38 and City of Winnipeg"));
  assert.ok(grouse.season, "the season window is still stated for the rest of the zone");

  const winnipeg = gha38.specialAreas?.find((area) => area.name === "Portion of GHA 38 and City of Winnipeg");
  assert.equal(winnipeg?.statedAs, "No person shall hunt or kill wildlife");
  assert.ok(winnipeg?.species.includes("White-tailed deer"));
  // "big game other than white-tailed deer": the R.M. of Macdonald portion does not reach deer.
  const macdonald = gha38.specialAreas?.find((area) => area.name === "Portion of GHA 38 in RM of MacDonald");
  assert.ok(macdonald && !macdonald.species.includes("White-tailed deer") && macdonald.species.includes("Ruffed grouse"));

  // A zone whose areas restrict nothing it hunts keeps its plain answer.
  const gha7a = await summarizeZone({ layerId: "layer:ca-mb-gha", designation: "7A" }, "2026-10-01");
  assert.equal(stateOf(gha7a, "species:ruffed-grouse"), "SEASON_AVAILABLE");
});

test("the special-area index covers every Game Hunting Area and names only catalogued features", async () => {
  const index = (await import("../../../../content/regulatory/ca-mb-overlay-zones.json", { with: { type: "json" } })).default as {
    zones: Record<string, Array<{ layer: string; objectId: number }>>;
  };
  const bundle = (await import("../../../../content/regulatory/ca-mb-2026.json", { with: { type: "json" } })).default as {
    units: Array<{ identifier: string }>;
  };
  const catalogue = (await import("../../../../content/regulatory/ca-mb-overlays.json", { with: { type: "json" } })).default as {
    layers: Array<{ key: string; features: Array<{ objectId: number }> }>;
  };
  assert.deepEqual(Object.keys(index.zones).sort(), bundle.units.map((unit) => unit.identifier).sort());
  for (const entries of Object.values(index.zones)) {
    for (const { layer, objectId } of entries) {
      assert.ok(catalogue.layers.find((candidate) => candidate.key === layer)?.features.some((feature) => feature.objectId === objectId),
        `${layer} ${objectId} is not in the catalogue`);
    }
  }
});

test("zone cards use each jurisdiction's own terms", async () => {
  const gha = await summarizeZone({ layerId: "layer:ca-mb-gha", designation: "26" }, "2026-09-21");
  assert.equal(gha.zone.label, "GHA 26");
  assert.equal(gha.zone.officialTerm, "Game Hunting Area");
  assert.equal(gha.zone.jurisdictionName, "Manitoba");
  const wmu = await summarizeZone({ layerId: "layer:ca-ab-wmu", designation: "102" }, "2026-11-04");
  assert.equal(wmu.zone.label, "WMU 102");
  assert.equal(wmu.zone.officialName, "Wildlife Management Unit 102");
});

test("Ontario, Manitoba and Alberta answer side by side for one species, each as its own card does", async () => {
  const zones = [
    { layerId: "layer:ca-on-wmu", designation: "71" },
    { layerId: "layer:ca-mb-gha", designation: "7A" },
    { layerId: "layer:ca-ab-wmu", designation: "102" },
    { layerId: "layer:ca-ab-wmu", designation: "322" },
  ];
  for (const date of ["2026-11-01", "2026-11-04", "2026-11-10"]) {
    const states = await zoneStatesForSpecies(species("species:white-tailed-deer"), date, zones);
    for (const [index, zone] of zones.entries()) {
      const card = await summarizeZone(zone, date);
      assert.equal(states[index].state, stateOf(card, "species:white-tailed-deer"), `${zone.layerId} ${zone.designation} ${date}`);
    }
    assert.ok(states.every((entry) => entry.state !== "NOT_CERTIFIED"), "all three certify white-tailed deer");
  }

  // A species a jurisdiction has no rules for is not certified there, anywhere in it.
  const turkey = await zoneStatesForSpecies(species("species:wild-turkey"), "2026-10-01", [{ layerId: "layer:ca-mb-gha", designation: "26" }]);
  assert.equal(turkey[0].state, "NOT_CERTIFIED");
});

test("only served layers and real designations are summarised", async () => {
  const quebec = layerById("layer:ca-qc-zone-chasse")!;
  const was = quebec.serving;
  quebec.serving = false;
  try {
    await assert.rejects(summarizeZone({ layerId: quebec.id, designation: "10E" }, "2026-09-21"), ZoneSummaryError);
  } finally {
    quebec.serving = was;
  }
  await assert.rejects(summarizeZone({ layerId: "layer:ca-on-wmu", designation: "57; drop" }, "2026-09-21"), ZoneSummaryError);
});

test("a summary carries no coordinate", async () => {
  const summary = await summarizeZone({ layerId: "layer:ca-on-wmu", designation: "57" }, "2026-09-21");
  assert.doesNotMatch(JSON.stringify(summary), /latitude|longitude/);
});

/* ── `next` rides alongside the status, and is never one ── */

test("a CLOSED species carries its next opening and stays CLOSED", async () => {
  /*
   * The owner's ruling: `next` is supplementary temporal information, not a
   * ninth state. "Closed" and "closed, opens September 15" are different
   * answers to a hunter and neither is a different legal status — so the state
   * must not move when a next opening exists.
   */
  clearZoneSummaryCache();
  const summary = await summarizeZone({ layerId: "layer:ca-on-wmu", designation: "57" }, "2026-07-15");
  const closed = summary.species.filter((row) => row.state === "CLOSED");
  assert.ok(closed.length > 0, "this test needs a closed species; July should supply several");

  const withNext = closed.filter((row) => row.next.kind === "SEASON");
  assert.ok(withNext.length > 0, "a July date should have seasons still to come");
  for (const row of withNext) {
    assert.equal(row.state, "CLOSED", "carrying a next opening must not change the state");
  }
});

test("every row states a next, and the four kinds stay distinguishable", async () => {
  /*
   * Required rather than optional, because the distinction the owner asked for
   * — closed-until-further-notice versus we-do-not-know — dies the moment it
   * is carried by absence. An absent field and a null field render alike at
   * every call site that forgets which it meant.
   */
  clearZoneSummaryCache();
  const kinds = new Set<string>();
  for (const designation of ["57", "71"]) {
    const summary = await summarizeZone({ layerId: "layer:ca-on-wmu", designation }, "2026-11-10");
    for (const row of summary.species) {
      assert.ok(row.next, `${row.speciesId} states no next`);
      assert.match(row.next.kind, /^(SEASON|DEPENDS_ON_HUNTER|NONE_IN_CERTIFIED_PERIOD|NOT_CERTIFIED)$/);
      kinds.add(row.next.kind);
      /* Each kind carries exactly what it claims and nothing it does not. */
      if (row.next.kind === "SEASON") assert.ok(row.next.opens && row.next.closes);
      if (row.next.kind === "NONE_IN_CERTIFIED_PERIOD") assert.ok(row.next.through);
    }
  }
  assert.ok(kinds.size > 1, "a single kind everywhere would not prove they are distinguishable");
});

test("a species whose answer needs the hunter does not state a next date", async () => {
  /*
   * Where the engine returns before evaluating any window, there is nothing to
   * read a next opening from — and one stated anyway would be true for only
   * some licences. DEPENDS_ON_HUNTER is read from the engine's own
   * `completeness`, never from a second pass over the rules.
   */
  clearZoneSummaryCache();
  const summary = await summarizeZone({ layerId: "layer:ca-on-wmu", designation: "57" }, "2026-11-10");
  const depends = summary.species.filter((row) => row.state === "CHECK_REQUIREMENTS");
  assert.ok(depends.length > 0, "this test needs a species that asks the hunter something");
  for (const row of depends) {
    assert.equal(row.next.kind, "DEPENDS_ON_HUNTER", row.speciesId);
  }
});

/* ── The bulk path and individual evaluation cannot disagree ── */

test("bulk and individual evaluation agree, in every rules-certified jurisdiction", async () => {
  /*
   * THE RISK THIS WHOLE FEATURE CARRIES. A fast path that quietly answers
   * differently from the slow one is the worst thing we could ship, because
   * both look right in isolation and nobody compares them in the product.
   *
   * One jurisdiction proves the mechanism; all of them prove the claim. This
   * walks every served layer that has certified rules, several zones in each,
   * and every species the jurisdiction recognises — comparing the bulk row
   * against a direct `entry.evaluate` for the same inputs.
   *
   * Both sides are mapped through the SAME exported `stateOf`. What is under
   * test is that the two paths reach the same engine outcome, not that the
   * mapping is right; re-deriving the mapping here would let a mapping bug
   * hide behind a second copy of itself.
   */
  clearZoneSummaryCache();
  const date = "2026-11-10";
  let compared = 0;
  const jurisdictions = new Set<string>();

  for (const layer of ZONE_LAYERS.filter((candidate) => candidate.serving)) {
    const entry = regulatoryEntryFor(layer.jurisdictionId);
    if (!entry || !layer.certifiedDesignations?.size) continue;
    jurisdictions.add(layer.jurisdictionId);

    /* A spread rather than the first few, so a zone-ordering quirk cannot make
       the sample unrepresentative. */
    const all = [...layer.certifiedDesignations];
    const picks = [all[0], all[Math.floor(all.length / 2)], all.at(-1)!];

    for (const designation of picks) {
      const summary = await summarizeZone({ layerId: layer.id, designation }, date);
      for (const row of summary.species) {
        const outcome = await entry.evaluate(
          { latitude: Number.NaN, longitude: Number.NaN, date: date as IsoDate, speciesId: row.speciesId, answers: {} },
          { status: "RESOLVED", zoneId: zoneIdFor(layer, designation), jurisdictionId: layer.jurisdictionId,
            officialName: officialNameOf(layer, designation), sourceId: layer.sourceId, message: "" },
          { verifiedAt: new Date(0).toISOString(), scope: "ZONE" },
        );
        const where = `${layer.id} ${designation} ${row.speciesId}`;
        assert.equal(row.state, engineStateOf(outcome), `state disagrees: ${where}`);

        /* `next` too — it is derived from the engine, so it must travel with it. */
        const expectedNext = outcome.completeness === "NEEDS_INPUT"
          ? { kind: "DEPENDS_ON_HUNTER" }
          : outcome.regulation.next;
        assert.deepEqual(row.next, expectedNext, `next disagrees: ${where}`);

        compared += 1;
      }
    }
  }

  assert.ok(jurisdictions.size >= 5, `expected every rules-certified jurisdiction; walked ${jurisdictions.size}`);
  assert.ok(compared > 100, `expected a real sample; compared ${compared}`);
});

/* ── Identity is the server's; naming is the presentation layer's ── */

test("every speciesId a zone summary returns resolves through the presentation path", async () => {
  /*
   * THE INVARIANT THAT REPLACES A SERVER-SUPPLIED NAME. The response carries
   * `speciesId` and no display name, because a server-side name becomes a
   * second naming system the moment there are two locales — and it would drift
   * from the canonical path exactly as a second rules interpretation drifts
   * from the engine.
   *
   * That only holds if every id actually resolves. AND THERE IS NO FALLBACK:
   * an id that does not resolve is a contract or data defect that fails here,
   * never a hole plugged with a placeholder. A placeholder would be a species
   * North Ground cannot name appearing as though it could — and it would keep
   * the name path silently working until a locale was added and nobody could
   * say which system was in use.
   *
   * Resolution deliberately omits the slug fallback in `speciesName`: this
   * asks whether the canonical path answers, not whether something can be
   * printed.
   */
  clearZoneSummaryCache();
  const unresolvable: string[] = [];
  let checked = 0;

  for (const layer of ZONE_LAYERS.filter((candidate) => candidate.serving)) {
    if (!regulatoryEntryFor(layer.jurisdictionId) || !layer.certifiedDesignations?.size) continue;
    const designation = [...layer.certifiedDesignations][0];
    const summary = await summarizeZone({ layerId: layer.id, designation }, "2026-11-10");
    for (const row of summary.species) {
      const resolved = speciesById(row.speciesId)?.displayName
        ?? (await contentRepository.getSpecies(row.speciesId))?.title;
      if (!resolved) unresolvable.push(`${layer.jurisdictionId} ${row.speciesId}`);
      checked += 1;
    }
  }

  assert.ok(checked > 0, "this test needs species to check; it proves nothing on an empty set");
  assert.deepEqual(unresolvable, [], "these ids cannot be named by the presentation path");
});
