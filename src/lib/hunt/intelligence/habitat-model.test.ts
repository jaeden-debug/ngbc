import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { MODELLED_OPACITY } from "../exploration/surface-paint.ts";
import { toRenderable } from "../exploration/surface-request.ts";
import { speciesSurfaces, surfaceRegistry } from "./surface.ts";

/**
 * NORTH GROUND HABITAT MODELS (§41B): reproducible or unpublished, never
 * presented before measured evidence, never a count, never drawn where they
 * were not tested.
 *
 * These are checked on the committed artifacts rather than on fixtures, because
 * the claims that matter are claims about what was published: that a model
 * which failed its declared bar published nothing, that one which passed says
 * which of its claims passed, and that it never paints over ground a survey
 * already speaks for.
 */

interface ModelArtifact {
  id: string;
  speciesId: string;
  grid: { latStep: number; lonStep: number; south: number; west: number; rows: number; cols: number };
  cells: { row: number[]; col: number[]; intensity: number[] };
  model: {
    id: string;
    version: string;
    claim: string;
    history: Array<{ version: string; outcome: string; detail: string }>;
    inputs: Array<{ id: string; hash: string }>;
    validation: { passed: boolean; bar: Record<string, number>; [key: string]: unknown };
    coefficients: Array<Record<string, unknown>>;
  };
}

const models = () => surfaceRegistry().surfaces.filter((entry) => entry.evidenceClass === "NORTH_GROUND_MODEL");
const read = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;

test("every published model passed the bar it declared, and says so", () => {
  for (const entry of models()) {
    const artifact = read<ModelArtifact>(entry.artifactPath);
    assert.equal(artifact.model.validation.passed, true, `${entry.speciesId}: a model below its bar is never published`);
    assert.ok(Object.keys(artifact.model.validation.bar).length, `${entry.speciesId}: the bar travels with the model`);
    assert.equal(entry.tier, "T4_DERIVED_HABITAT");
    assert.equal(entry.unmappedGround, "NO_EVIDENCE_HELD");
    assert.equal(entry.surveyedAndNoneFound, 0, "a model never claims ground was searched");
    /* The foundation it was fitted on is named by the hash of the exact bytes. */
    const manifest = read<{ artifact: { sha256: string } }>("content/intelligence/foundation/landcover-2019-0.1deg.json");
    assert.ok(artifact.model.inputs.some((input) => input.hash === manifest.artifact.sha256), `${entry.speciesId}: land-cover input hashed`);
    const bytes = readFileSync("content/intelligence/foundation/landcover-2019-0.1deg.u8.gz");
    assert.equal(`sha256:${createHash("sha256").update(bytes).digest("hex")}`, manifest.artifact.sha256, "and those are the bytes in the tree");
  }
});

test("a model never paints 0, which on a ramp surface means surveyed and none found", () => {
  for (const entry of models()) {
    const artifact = read<ModelArtifact>(entry.artifactPath);
    assert.ok(artifact.cells.intensity.length, `${entry.speciesId}: something drawn`);
    assert.ok(artifact.cells.intensity.every((value) => value >= 1 && value <= 1000), entry.speciesId);
  }
});

test("the ruffed grouse model speaks only beyond the survey field, and only to the claim that passed", () => {
  const entry = models().find((surface) => surface.speciesId === "species:ruffed-grouse");
  assert.ok(entry, "the grouse model is published");
  const artifact = read<ModelArtifact>(entry.artifactPath);
  const field = read<ModelArtifact>("content/intelligence/surfaces/ruffed-grouse.json");
  assert.deepEqual(artifact.grid, field.grid, "one grid, so 'beyond the field' is exact");
  const surveyed = new Set(field.cells.row.map((row, i) => row * field.grid.cols + field.cells.col[i]));
  const overlap = artifact.cells.row.filter((row, i) => surveyed.has(row * artifact.grid.cols + artifact.cells.col[i]));
  assert.equal(overlap.length, 0, "no model cell sits on ground the survey speaks for, including its surveyed zeros");

  /* 1.0.0 claimed a count and failed; the withdrawal is kept, not erased. */
  assert.equal(artifact.model.claim, "DETECTION");
  const failed = artifact.model.history.find((row) => row.version === "1.0.0");
  assert.equal(failed?.outcome, "FAILED_DECLARED_BAR");
  assert.ok(artifact.model.coefficients.every((row) => !("abundance" in row)), "a withdrawn claim's weights are not in what is drawn");
  assert.equal(entry.metric, "MODELLED_DETECTION_LIKELIHOOD", "named for what it models, never a count or a density");

  /* Nothing past the tree line: every painted cell is south of 70°N. */
  const north = Math.max(...artifact.cells.row.map((row) => artifact.grid.south + (row + 1) * artifact.grid.latStep));
  assert.ok(north <= 70, `painted as far north as ${north}°`);
});

test("measured evidence comes first, and the model is drawn fainter than it", () => {
  const surfaces = speciesSurfaces("species:ruffed-grouse").surfaces;
  const model = surfaces.find((surface) => surface.geometryKind === "NORTH_GROUND_MODEL");
  assert.ok(model, "the model is served");
  assert.equal(surfaces[0].evidence.measured, true, "the survey field outranks the model");
  assert.equal(model.evidence.measured, false);
  assert.match(model.scale.statedAs, /not a count/i);
  assert.equal(toRenderable(model as never)?.opacity, MODELLED_OPACITY);
  assert.equal(toRenderable(surfaces[0] as never)?.opacity, undefined, "measured evidence at full strength");
});

test("a model that failed its bar publishes nothing, and its report says why", () => {
  /* Moose, fitted to Alberta's unit densities: the report is the record. */
  const path = "content/intelligence/models/moose-validation.json";
  assert.ok(existsSync(path), "the attempt is recorded");
  const report = read<{ validation: { passed: boolean } }>(path);
  if (!report.validation.passed) {
    assert.ok(!models().some((entry) => entry.speciesId === "species:moose"), "a failed model is never served");
    assert.ok(!existsSync("content/intelligence/models/moose.json"), "and never left on disk");
  }
});
