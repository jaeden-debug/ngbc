import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { toRenderable } from "../exploration/surface-request.ts";
import { catalogueSpecies } from "./species-catalogue.ts";
import { speciesSurfaces, surfaceRegistry } from "./surface.ts";

/**
 * RECORDED PRESENCE: squares where openly licensed occurrence records place a
 * species. The weakest thing Hunt draws, and the one most easily mistaken for
 * something stronger — so what it may NOT be is tested as hard as what it is.
 *
 *   - never a heat value: its own kind, its own tier, its own paint;
 *   - never smoothed or filled between squares;
 *   - ground with no record is "nobody shared one", never empty;
 *   - never drawn for a species a survey already maps;
 *   - only records whose own licence permits commercial reuse.
 */

interface RecordsRegistry {
  methodology: { minimumRecordsPerSquare: number; minimumRecordsPerSpecies: number; minimumSquares: number };
  surfaces: Array<{ speciesId: string; artifactPath: string; artifactId: string; openRecords: number; supportedCells: number }>;
  declined: Array<{ speciesId: string; reason: string; detail: string }>;
}
interface RecordsArtifact {
  grid: { west: number; south: number; lonStep: number; latStep: number; cols: number; rows: number };
  cells: { row: number[]; col: number[]; intensity: number[] };
  source: { licence: string; attribution: string; url: string };
  contributingDatasets: Array<{ datasetKey: string; count: number }>;
  limitations: string[];
}

const read = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;
const records = read<RecordsRegistry>("content/intelligence/records-registry.json");
const entries = () => surfaceRegistry().surfaces.filter((entry) => entry.evidenceClass === "OCCURRENCE_RECORDS");

test("a records grid is its own kind of evidence, and says so in every field", () => {
  for (const entry of entries()) {
    assert.equal(entry.surfaceKind, "OBSERVATION_GRID", entry.speciesId);
    assert.equal(entry.tier, "T3_RECORDED_PRESENCE");
    assert.equal(entry.unmappedGround, "NOT_SURVEYED", "no record is not no animal");
    assert.equal(entry.interpolationPermitted, false, "never filled between squares");
    assert.equal(entry.matchesHuntingSeason, false);
    assert.equal(entry.surveyedAndNoneFound, 0, "a record grid never claims ground was searched");
  }
});

test("every square holds the declared minimum of records, on GBIF's own squares", () => {
  const { minimumRecordsPerSquare, minimumRecordsPerSpecies, minimumSquares } = records.methodology;
  for (const entry of records.surfaces) {
    const artifact = read<RecordsArtifact>(entry.artifactPath);
    assert.equal(artifact.grid.lonStep, 0.3515625);
    assert.equal(artifact.grid.west, -180);
    assert.ok(artifact.cells.intensity.every((n) => n >= minimumRecordsPerSquare), `${entry.speciesId}: a square below the minimum`);
    assert.equal(artifact.cells.row.length, entry.supportedCells);
    assert.ok(entry.openRecords >= minimumRecordsPerSpecies && entry.supportedCells >= minimumSquares, entry.speciesId);
    /* Only CC0 and CC BY; the non-commercial records are excluded, and said to be. */
    assert.match(artifact.source.licence, /CC0 1\.0 and CC BY 4\.0 only/);
    assert.match(artifact.source.url, /license=cc0_1_0&license=cc_by_4_0/);
    assert.ok(artifact.limitations.some((line) => /not a finding that the species is absent/.test(line)));
    assert.ok(artifact.contributingDatasets.length, "every grid names who to credit");
  }
});

test("every contributing dataset is credited once, across the grids", () => {
  const credits = read<{ datasets: Record<string, { records: number }> }>("content/intelligence/records/datasets.json").datasets;
  for (const entry of records.surfaces) {
    for (const { datasetKey } of read<RecordsArtifact>(entry.artifactPath).contributingDatasets) {
      assert.ok(credits[datasetKey], `${datasetKey} contributed to ${entry.speciesId} and is not credited`);
    }
  }
});

test("a species a survey already maps gets no records grid, and a declined species says why", () => {
  const surveyed = new Set(surfaceRegistry().surfaces
    .filter((entry) => (entry.evidenceClass ?? "STRUCTURED_SURVEY") === "STRUCTURED_SURVEY")
    .map((entry) => entry.speciesId));
  for (const entry of records.surfaces) assert.ok(!surveyed.has(entry.speciesId), `${entry.speciesId} is surveyed and also has records`);
  const REASONS = new Set(["NO_TAXON_MATCH", "TOO_FEW_OPEN_RECORDS", "READ_FAILED", "INCOMPLETE_READ"]);
  for (const row of records.declined) {
    assert.ok(REASONS.has(row.reason), `unexpected reason ${row.reason}`);
    assert.ok(row.detail.length > 20, `${row.speciesId} must say why`);
  }
  /* And never for a species Hunt may not offer as quarry. */
  const eligibility = new Map(catalogueSpecies().map((species) => [species.speciesId, species.takeEligibility]));
  for (const entry of entries()) assert.ok(["HUNTABLE", "REMOVAL"].includes(eligibility.get(entry.speciesId) ?? ""), entry.speciesId);
});

test("served as squares, drawn as hatched squares, never as a field", () => {
  const entry = records.surfaces[0];
  assert.ok(entry, "at least one records grid is certified");
  const reply = speciesSurfaces(entry.speciesId);
  const surface = reply.surfaces.find((one) => one.id === entry.artifactId);
  assert.ok(surface, "the grid is served");
  assert.equal(surface.geometryKind, "OBSERVATION_GRID");
  assert.equal(surface.continuity, "DISCRETE");
  assert.equal(surface.evidence.measured, true, "a record is an observation, not a model");
  const drawn = toRenderable(surface as never);
  assert.ok(drawn?.plots?.length, "squares");
  assert.equal(drawn.style, "RECORDED", "a hatch, off the ramp");
  assert.equal(drawn.cells, undefined, "never a sampled field");
  const [west, south] = drawn.plots[0].rings[0][0];
  const [east, north] = drawn.plots[0].rings[0][2];
  assert.ok(Math.abs(east - west - 0.3515625) < 1e-9 && Math.abs(north - south - 0.3515625) < 1e-9, "at the square's own extent");
});
