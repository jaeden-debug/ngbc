import assert from "node:assert/strict";
import test from "node:test";
import { createSpeciesSurfaceHandler } from "./handler.ts";
import { KIND_BEHAVIOUR, speciesSurfaces, surfaceSitesFrom } from "./surface.ts";
import type { SurfaceGeometryKind } from "./surface.ts";
import type { EvidenceRecord } from "./types.ts";

/**
 * The seam between the evidence and the renderer.
 *
 * Everything asserted here is something the renderer would otherwise have to
 * KNOW rather than read — and a renderer that has to know which survey produced
 * a layer is a renderer that will eventually smooth a plot layer.
 */

const GET = createSpeciesSurfaceHandler();
const ask = (query: string) => GET(new Request(`https://northgroundbushcraft.com/api/hunt/species-surface?${query}`));

test("a surface carries how finely it may be drawn, and says so in the authority's words", () => {
  const [surface] = speciesSurfaces("species:american-black-duck").surfaces;
  assert.ok(surface);
  assert.equal(surface.effectiveResolution.metres, 5000, "a 25 km² plot is 5 km on a side and no finer");
  assert.match(surface.effectiveResolution.statedAs, /25 km/);
  /* §41B: smooth rendering is not fine evidence. The number is declared so a
     soft edge can never become a claim of 100 m knowledge. */
  assert.equal(surface.continuity, "DISCRETE", "nothing may be drawn between the plots");
});

test("what unshaded ground means travels with the surface", () => {
  const response = speciesSurfaces("species:american-black-duck");
  for (const surface of response.surfaces) assert.equal(surface.unmappedGround, "NOT_SURVEYED");
  assert.match(response.emptyMeans, /not a finding that the species is absent/);
});

test("a coarse measurement cannot even be BUILT into a surface", () => {
  /*
   * §41B's most direct refusal, and it is refused at construction rather than
   * by a predicate someone must remember to call — Hunt overhaul's design, and
   * the argument for it is that a guard you have to remember is not a guard.
   *
   * A zone-wide 0.8 moose/km² multiplied across pixels would let a regulatory
   * boundary shape the animal surface while looking like biology.
   */
  const zoneRecord: EvidenceRecord = {
    id: "evidence:test", speciesId: "species:moose" as EvidenceRecord["speciesId"], jurisdictionId: "jurisdiction:ca-ab" as EvidenceRecord["jurisdictionId"],
    geographyId: "management_zone:ca-ab-wmu-116", geographyType: "MANAGEMENT_ZONE",
    sourceId: "source:test" as EvidenceRecord["sourceId"], metric: "POPULATION_DENSITY", rawValue: 0.8, unit: "moose/km²",
    observationPeriod: { from: "2025-01-01", through: "2025-03-01" },
    retrievedAt: "2026-09-29", verifiedAt: "2026-09-29", confidence: "HIGH",
    spatialPrecision: "Wildlife Management Unit", version: "1", superseded: false,
  };
  const refused = surfaceSitesFrom([zoneRecord]);
  assert.equal(refused.ok, false, "a management-area figure may not become a surface");
  if (!refused.ok) {
    assert.equal(refused.reason, "AREA_EVIDENCE");
    assert.deepEqual(refused.offending, ["evidence:test"], "and it names the records it refused rather than degrading");
  }

  /* The declarative half survives for a reader of a BUILT surface: which kinds
     could ever have fed cells at all. */
  assert.equal(KIND_BEHAVIOUR.MANAGEMENT_AREA.maySetCellValues, false);
  assert.equal(KIND_BEHAVIOUR.SAMPLE_PLOT.maySetCellValues, false, "plots are the evidence; between them is interpolation");
  assert.equal(KIND_BEHAVIOUR.SURVEY_GRID.maySetCellValues, true);

  /* A sampled plot is refused by the same constructor, and for the same reason
     as a management area: it is an area reported as a whole. It was added to
     that list when the two lanes merged — before that it fell through to a
     refusal for the wrong reason. */
  const plotRecord: EvidenceRecord = { ...zoneRecord, id: "evidence:plot", geographyType: "SAMPLE_PLOT", geographyId: "sample_plot:ews25_76418" };
  const plotRefusal = surfaceSitesFrom([plotRecord]);
  assert.equal(plotRefusal.ok, false);
  if (!plotRefusal.ok) assert.equal(plotRefusal.reason, "AREA_EVIDENCE", "not NO_COORDINATES: the reason has to stay true when plots carry coordinates");
});

test("every geometry kind declares its own behaviour, and none of them defaults", () => {
  const kinds: SurfaceGeometryKind[] = [
    "SAMPLE_PLOT", "OBSERVATION_POINT", "SURVEY_POLYGON", "SURVEY_GRID", "AERIAL_STRATUM",
    "DENSITY_RASTER", "MODELLED_RASTER", "HABITAT_LAYER", "NORTH_GROUND_MODEL", "MANAGEMENT_AREA",
  ];
  for (const kind of kinds) {
    const behaviour = KIND_BEHAVIOUR[kind];
    assert.ok(behaviour, `${kind} must declare its behaviour`);
    assert.ok(behaviour.meaning.length > 40, `${kind} must say what it means to a reader`);
  }
  /* The four that describe an area reported as a whole can never fill a cell,
     whatever their resolution says. */
  for (const kind of ["SAMPLE_PLOT", "SURVEY_POLYGON", "AERIAL_STRATUM", "MANAGEMENT_AREA"] as SurfaceGeometryKind[]) {
    assert.equal(KIND_BEHAVIOUR[kind].maySetCellValues, false, `${kind} reports an area as a whole`);
  }
  assert.equal(KIND_BEHAVIOUR.NORTH_GROUND_MODEL.continuity, "CONTINUOUS");
  assert.match(KIND_BEHAVIOUR.NORTH_GROUND_MODEL.meaning, /never presented before measured evidence/);
});

test("measured evidence sorts ahead of anything modelled", () => {
  const response = speciesSurfaces("species:american-black-duck");
  assert.ok(response.surfaces.length >= 1);
  for (const surface of response.surfaces) assert.equal(surface.evidence.measured, true);
  const strengths = response.surfaces.map((surface) => (surface.evidence.measured ? 1 : 0));
  assert.deepEqual([...strengths].sort((a, b) => b - a), strengths, "strongest first");
});

test("the viewport is part of the question, not an optimisation", async () => {
  const everywhere = speciesSurfaces("species:american-black-duck");
  const near = speciesSurfaces("species:american-black-duck", [-76, 45, -74, 47]);
  const count = (r: typeof everywhere) => r.surfaces.reduce((sum, surface) => sum + surface.features.length, 0);
  assert.equal(count(everywhere), 331, "every plot the survey published");
  assert.ok(count(near) > 0 && count(near) < count(everywhere), "a box returns what it contains");

  const bad = await ask("speciesId=species:american-black-duck&bbox=10,10,0,0");
  assert.equal(bad.status, 400, "an inverted box is a bad request");
});

test("a species with no surface says why, and never answers with an empty map", async () => {
  /*
   * Moose HAS evidence — Ontario and British Columbia harvest — and none of it
   * is a surface, because a figure for a whole management area is not one. That
   * is a different answer from a species nothing is held for, and a renderer
   * that received an empty list for both would draw the same blank map for two
   * different facts.
   */
  const moose = await ask("speciesId=species:moose");
  assert.equal(moose.status, 404);
  const mooseBody = await moose.json();
  assert.equal(mooseBody.status, "NO_SURFACE");
  assert.match(mooseBody.message, /not a surface/);

  /* Ruffed grouse was this example until the Breeding Bird Survey was wired in
     and it stopped being true — which is the whole point of the reachability
     test beside this one. Snowshoe hare is genuinely unheld: no bundle, no
     raster, nothing. */
  const unheld = await ask("speciesId=species:snowshoe-hare");
  const unheldBody = await unheld.json();
  assert.match(unheldBody.message, /gap in what North Ground holds, not a finding about the animals/);

  assert.equal((await ask("speciesId=not-a-species")).status, 400);
});

test("a drawn surface carries its season and its provenance, or it is not drawable", async () => {
  const response = await ask("speciesId=species:american-black-duck&bbox=-80,43,-52,56");
  assert.equal(response.status, 200);
  const body = await response.json();
  for (const surface of body.surfaces) {
    assert.equal(surface.season.matchesHuntingSeason, false, "a May survey is not the hunting season");
    assert.match(surface.season.warning, /autumn/i);
    assert.ok(surface.provenance.authority.includes("Canadian Wildlife Service"));
    assert.ok(surface.provenance.licence.includes("Open Government Licence"));
    assert.ok(surface.provenance.limitations.length >= 3);
    assert.equal(surface.provenance.model, undefined, "only a North Ground surface carries a model id");
    assert.equal(surface.scale.comparable, false, "a rank within one dataset is not comparable to another's");
    for (const feature of surface.features) {
      assert.equal(feature.geometry.type, "Polygon");
      assert.ok(feature.observedYear && feature.observedYear >= 1990);
    }
  }
});
