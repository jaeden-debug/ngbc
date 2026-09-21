import assert from "node:assert/strict";
import test from "node:test";
import type { CanonicalId, IsoDate } from "../../content-contract/index.ts";
import { regulatoryEntryFor } from "../regulatory/registry.ts";
import { layerById, zoneIdFor } from "../zone-layers.ts";
import { clearZoneSummaryCache, summarizeZone, zoneStatesForSpecies, ZoneSummaryError } from "./zone-summary.ts";

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
