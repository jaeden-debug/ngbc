import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { permitsSpeciesHeat } from "../../content/species-eligibility.ts";
import { decodeCells, surfaceRegistry } from "./surface.ts";

/**
 * RANGE + HABITAT, THE UNIVERSAL FALLBACK (CLAUDE.md §41B, 2026-09-30).
 *
 * A categorical habitat profile inside a range drawn from occurrence records.
 * What these tests hold is what makes it defensible rather than decorative:
 * the profile rests on a statement North Ground already publishes, the build
 * reproduces from committed inputs, the surface owes nothing to hunting
 * geography, and a range is never dressed as a ranking.
 */

const profiles = JSON.parse(readFileSync("content/intelligence/surface-profiles.json", "utf8")) as {
  classValues: Record<string, number>;
  families: Record<string, { reachKm: number; why: string; recordBias: string; isolatedSquareMinRecords: number | null }>;
  species: Record<string, { family: string; habitatStatement: string | null; season?: string; tier?: string; landCover?: Record<string, string[]>; requires?: unknown[]; whyNotRangeHabitat?: string; rangeNotDefensible?: string }>;
};
const registry = JSON.parse(readFileSync("content/intelligence/range-habitat-registry.json", "utf8")) as {
  surfaces: Array<{ speciesId: string; artifactPath: string; surfaceTier: string; surfaceKind: string }>;
  declined: Array<{ speciesId: string; reason: string }>;
};

test("the committed surfaces are exactly what the builder produces from committed inputs", () => {
  execFileSync(process.execPath, ["scripts/build-range-habitat-surfaces.mjs", "--check"], { stdio: "pipe" });
});

test("profiles exist only for Hunt-eligible species, and every quote is the published statement", () => {
  const published = new Map<string, string[]>();
  for (const file of readdirSync("content/published").filter((f) => f.endsWith(".json"))) {
    for (const resource of JSON.parse(readFileSync(`content/published/${file}`, "utf8")).resources ?? []) {
      if (resource.speciesProfile) published.set(resource.speciesProfile.speciesId, (resource.speciesProfile.habitat ?? []).map((h: { text: string }) => h.text));
    }
  }
  for (const [speciesId, profile] of Object.entries(profiles.species)) {
    assert.ok(permitsSpeciesHeat(speciesId), `${speciesId}: no hunter-facing map for a species Hunt may not offer`);
    /* A range-only profile may stand without a quote — the missing statement is why it is range-only — but never without its reason. */
    if (profile.habitatStatement === null) {
      assert.equal(profile.tier, "RANGE_ONLY", `${speciesId}: only a range-only profile may quote nothing`);
      continue;
    }
    assert.ok(published.get(speciesId)?.includes(profile.habitatStatement), `${speciesId}: the quote is not the published statement`);
  }
});

test("a range-only profile says why range + habitat is not defensible; a declined range says why the records cannot be one", () => {
  for (const [speciesId, profile] of Object.entries(profiles.species)) {
    if (profile.tier === "RANGE_ONLY") assert.ok((profile.whyNotRangeHabitat ?? "").length > 40, `${speciesId}: range-only with no reason`);
    if (profile.rangeNotDefensible) assert.ok(registry.declined.some((row) => row.speciesId === speciesId && row.reason === "NO_DEFENSIBLE_RANGE"), speciesId);
  }
  for (const entry of registry.surfaces) {
    if (entry.surfaceTier !== "RANGE_ONLY") continue;
    const artifact = JSON.parse(readFileSync(entry.artifactPath, "utf8"));
    assert.ok(artifact.model.profile.whyNotRangeHabitat, `${entry.speciesId}: the reason travels with the surface`);
  }
});

test("every family states how its records are biased, and records never set a cell's value", () => {
  for (const [name, family] of Object.entries(profiles.families)) {
    assert.ok(family.recordBias.length > 40, `${name}: no statement of how its records are biased`);
    assert.ok(family.isolatedSquareMinRecords === null || family.isolatedSquareMinRecords >= 10, `${name}: an island needs real support`);
  }
  for (const entry of registry.surfaces) {
    const artifact = JSON.parse(readFileSync(entry.artifactPath, "utf8"));
    assert.ok(artifact.limitations.some((line: string) => /never set a cell's colour/.test(line)), `${entry.speciesId}: the bias rule travels with the surface`);
  }
});

test("a profile names land, water and terrain, never hunting geography", () => {
  const text = readFileSync("content/intelligence/surface-profiles.json", "utf8");
  assert.ok(!/management_zone|zoneId|layer:|jurisdiction:|WMU|GHA/.test(text), "no zone or jurisdiction in a habitat profile");
  const builder = readFileSync("scripts/build-range-habitat-surfaces.mjs", "utf8");
  for (const forbidden of ["zone-layers", "regulatory", "zone-geometry", "exploration/zone", "cartography"]) {
    assert.ok(!builder.includes(forbidden), `the builder must not read ${forbidden}`);
  }
});

test("migratory species are drawn from hunting-season records, and say so", () => {
  for (const entry of registry.surfaces) {
    if (profiles.species[entry.speciesId]?.season !== "HUNTING_SEASON_RECORDS") continue;
    const input = JSON.parse(readFileSync(`content/intelligence/range-habitat/inputs/${entry.speciesId.replace("species:", "")}.records.json`, "utf8"));
    assert.ok(Array.isArray(input.months) && input.months.length, `${entry.speciesId}: read without a month window`);
    const artifact = JSON.parse(readFileSync(entry.artifactPath, "utf8"));
    assert.match(artifact.season.observedSeason, /September to February/);
  }
});

test("values are habitat classes, and a range-only surface does not rank", () => {
  const values = new Set(Object.values(profiles.classValues));
  for (const entry of registry.surfaces) {
    const artifact = JSON.parse(readFileSync(entry.artifactPath, "utf8"));
    const cells = decodeCells(artifact.cellsEncoded);
    assert.ok(cells.row.length, entry.speciesId);
    const intensities = new Set(Array.from(cells.intensity));
    /* -1 is ground inside the range rated unsuitable: its own state, never painted. */
    for (const value of intensities) assert.ok(value === -1 || (value >= 200 && value <= 1000), `${entry.speciesId}: ${value} is outside the painted classes`);
    intensities.delete(-1);
    if (entry.surfaceTier === "RANGE_ONLY") {
      assert.deepEqual([...intensities], [500], `${entry.speciesId}: a known distribution is shaded evenly`);
      assert.equal(entry.surfaceKind, "RANGE_EXTENT");
    } else {
      assert.equal(entry.surfaceKind, "RANGE_HABITAT");
      /* A single-class profile draws that class; the classes themselves are the declared convention. */
      assert.ok(values.has(1) && values.has(0.25));
    }
  }
});

test("a declined species keeps its reason, and the served registry holds only eligible species", () => {
  for (const row of registry.declined) assert.ok(row.reason && permitsSpeciesHeat(row.speciesId), row.speciesId);
  for (const entry of surfaceRegistry().surfaces) assert.ok(permitsSpeciesHeat(entry.speciesId), entry.speciesId);
  for (const entry of registry.surfaces) assert.ok(existsSync(entry.artifactPath), entry.artifactPath);
});
