import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";
import { createSpeciesSurfaceHandler } from "./handler.ts";
import { MAX_LEVEL_OF_DETAIL, KIND_BEHAVIOUR, speciesSurfaces, surfaceSitesFrom } from "./surface.ts";
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
  /* Black duck now carries BOTH kinds, and they mean different things by blank
     ground: off a surveyed plot nobody looked, off a supported raster cell
     nothing is held. That difference is the field's whole reason for existing,
     so it is asserted per kind rather than uniformly. */
  const response = speciesSurfaces("species:american-black-duck", [-80, 43, -74, 47]);
  for (const surface of response.surfaces) {
    assert.equal(
      surface.unmappedGround,
      surface.geometryKind === "SAMPLE_PLOT" ? "NOT_SURVEYED" : "NO_EVIDENCE_HELD",
      `${surface.geometryKind} must say what ground with no value means`,
    );
  }
  const plotsOnly = speciesSurfaces("species:mallard", [-76, 46, -74, 47]);
  assert.match(plotsOnly.emptyMeans, /not a finding that the species is absent|gap in what North Ground holds/);
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
   * Moose used to be this example: harvest and density figures by unit, and
   * no surface, because a figure for a whole management area is not one. Under
   * the every-species-has-a-map direction (§41B, 2026-09-30) moose falls one
   * tier to range + habitat instead of to nothing — and its unit figures are
   * STILL not a surface: they stay in the card and play no part in the paint.
   */
  const moose = await ask("speciesId=species:moose");
  assert.equal(moose.status, 200);
  const mooseBody = await moose.json();
  assert.ok(mooseBody.surfaces.length, "moose has a map");
  for (const surface of mooseBody.surfaces) {
    assert.notEqual(surface.geometryKind, "MANAGEMENT_AREA");
    assert.doesNotMatch(`${surface.represents} ${surface.scale.statedAs}`, /\bdensity\b/i, "a habitat surface never claims density");
  }

  /* A species Hunt may not offer as quarry is the genuine no-surface case, and
     it says why rather than answering with an empty map. */
  const unheld = await ask("speciesId=species:trumpeter-swan");
  assert.equal(unheld.status, 404);
  const unheldBody = await unheld.json();
  assert.match(unheldBody.message, /gap in what North Ground holds, not a finding about the animals/);

  assert.equal((await ask("speciesId=not-a-species")).status, 400);
});

test("a drawn surface carries its season and its provenance, or it is not drawable", async () => {
  /* June: the breeding surveys' own season. In the hunting months a black
     duck hunter is shown the hunting-season surface instead (seasonal truth). */
  const response = await ask("speciesId=species:american-black-duck&bbox=-80,43,-52,56&month=6");
  assert.equal(response.status, 200);
  const body = await response.json();

  /* EVERY surface, whichever survey it came from: a spring count is not the
     autumn a hunter is asking about, and the warning is the thing that stops a
     breeding map being read as a hunting one. */
  for (const surface of body.surfaces) {
    assert.equal(surface.season.matchesHuntingSeason, false, "a spring survey is not the hunting season");
    assert.match(surface.season.warning, /breeding season|autumn/i);
    assert.equal(surface.evidenceWindow.id, "BREEDING", "a partial migrant's spring count speaks for the breeding season");
    assert.equal(surface.seasonMatch, "IN_WINDOW");
    assert.ok(surface.provenance.limitations.length >= 3);
    assert.equal(surface.scale.comparable, false, "a rank within one dataset is not comparable to another's");
  }

  /* The plot surfaces are the Eastern Waterfowl Survey's, under the Open
     Government Licence. The raster is the Breeding Bird Survey's, public domain
     under CC0 — so the licence assertion is per source rather than blanket, and
     only the modelled surface may carry a model id. */
  for (const surface of body.surfaces) {
    if (surface.geometryKind === "SAMPLE_PLOT") {
      assert.ok(surface.provenance.authority.includes("Canadian Wildlife Service"));
      assert.ok(surface.provenance.licence.includes("Open Government Licence"));
      assert.equal(surface.provenance.model, undefined, "measured plot evidence is not a model");
      for (const feature of surface.features) {
        assert.equal(feature.geometry.type, "Polygon");
        assert.ok(feature.observedYear && feature.observedYear >= 1990);
      }
    } else {
      assert.ok(surface.provenance.licence.includes("CC0"), "the Breeding Bird Survey is public domain");
      assert.ok(surface.provenance.model?.id, "an interpolated field states the model that produced it");
    }
  }
});

test("a window too wide to carry at full detail is sent coarser, never refused, and never blends found with none-found", () => {
  /* Ruffed grouse's whole field is 102,168 cells: under a 30,000-cell ceiling
     it must come back at a level of detail, not as a refusal. */
  const coarse = speciesSurfaces("species:ruffed-grouse", undefined, 30_000).surfaces.find((surface) => surface.id === "surface:bbs-ruffed-grouse");
  assert.ok(coarse?.cells, "served, not refused");
  const k = coarse.cells.levelOfDetail;
  assert.ok(k >= 2 && k <= MAX_LEVEL_OF_DETAIL, `level of detail ${k}`);
  assert.equal(coarse.cells.stepDegrees[0], 0.3 * k);
  assert.ok(coarse.cells.columns * coarse.cells.rows <= 30_000);
  /* Each coarse value lies within the found values of its block, or is 0 only
     where the block held nothing but none-found cells. */
  const artifact = JSON.parse(readFileSync("content/intelligence/surfaces/ruffed-grouse.json", "utf8"));
  /* A block's value sits at the CENTRE of its k × k nodes, so the block's first
     node is (k − 1)/2 steps south-west of the origin. */
  const firstWest = coarse.cells.origin[0] - ((k - 1) / 2) * artifact.grid.lonStep;
  const firstSouth = coarse.cells.origin[1] - ((k - 1) / 2) * artifact.grid.latStep;
  assert.equal(Math.round(((firstWest - artifact.grid.west) / artifact.grid.lonStep) % k), 0, "blocks align to the artifact's own grid");
  const blocks = new Map<string, number[]>();
  artifact.cells.row.forEach((row: number, i: number) => {
    const col = artifact.cells.col[i];
    const west = artifact.grid.west + col * artifact.grid.lonStep;
    const south = artifact.grid.south + row * artifact.grid.latStep;
    const bc = Math.floor((west - firstWest) / coarse.cells!.stepDegrees[0] + 1e-9);
    const br = Math.floor((south - firstSouth) / coarse.cells!.stepDegrees[1] + 1e-9);
    const key = `${br}:${bc}`;
    blocks.set(key, [...(blocks.get(key) ?? []), artifact.cells.intensity[i]]);
  });
  let checked = 0;
  coarse.cells.values.forEach((value, at) => {
    if (value === null) return;
    const inBlock = blocks.get(`${Math.floor(at / coarse.cells!.columns)}:${at % coarse.cells!.columns}`) ?? [];
    const found = inBlock.filter((v) => v > 0);
    if (value === 0) assert.equal(found.length, 0, "0 only where nothing in the block was found");
    else assert.ok(value >= Math.min(...found) && value <= Math.max(...found), "a found block is a blend of found cells only");
    checked += 1;
  });
  assert.ok(checked > 1000);
  /* Past the coarsest level it may be sent at, it is refused, and says it is not an absence. */
  const refused = speciesSurfaces("species:ruffed-grouse", undefined, 100);
  assert.ok(refused.refusals.every((notice) => notice.reason === "BOX_TOO_LARGE"));
});
