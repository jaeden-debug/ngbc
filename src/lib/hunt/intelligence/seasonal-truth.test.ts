import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { createSpeciesSurfaceHandler } from "./handler.ts";
import {
  composeSurfaces, EVIDENCE_WINDOWS, evidenceWindowOf, monthsToWindow, movementOf, SEASON_WARNING, speciesSurfaces, surfaceRegistry,
  type CompositionCandidate,
} from "./surface.ts";

/**
 * SEASONAL TRUTH (CLAUDE.md §41B, 2026-09-30).
 *
 * A June breeding survey of a migrant says where it breeds, not where it is
 * hunted. These tests hold the three things that keep a hunter from being
 * shown the wrong season: movement is declared from North Ground's own
 * published words; every surface declares the months it speaks for; and Hunt is
 * served the surface for the month of the hunt, or told plainly that none
 * describes it.
 */

const declarations = JSON.parse(readFileSync("content/intelligence/seasonal-movement.json", "utf8")) as {
  species: Record<string, { movement: string; statedAs: string | null; field: string | null }>;
};
const profiles = JSON.parse(readFileSync("content/intelligence/surface-profiles.json", "utf8")) as {
  species: Record<string, { season?: string; tier?: string }>;
};

const published = new Map<string, Record<string, string[]>>();
for (const file of readdirSync("content/published").filter((f) => f.endsWith(".json"))) {
  for (const resource of JSON.parse(readFileSync(`content/published/${file}`, "utf8")).resources ?? []) {
    const p = resource.speciesProfile;
    if (!p) continue;
    const texts = (list: unknown) => (Array.isArray(list) ? list : [list]).map((x) => String((x as { text?: string; value?: string })?.text ?? (x as { value?: string })?.value ?? x));
    published.set(p.speciesId, {
      rangeSummary: texts(p.rangeSummary ?? []),
      seasonalBehavior: texts(p.seasonalBehavior ?? []),
      behavior: texts(p.behavior ?? []),
      habitat: texts(p.habitat ?? []),
    });
  }
}

test("every declared movement quotes North Ground's published profile, in the field it names", () => {
  for (const [speciesId, row] of Object.entries(declarations.species)) {
    if (row.movement === "UNDECLARED") {
      assert.equal(row.statedAs, null, `${speciesId}: an undeclared movement quotes nothing`);
      continue;
    }
    const field = published.get(speciesId)?.[row.field ?? ""] ?? [];
    assert.ok(field.some((text) => text.includes(row.statedAs!)), `${speciesId}: "${row.statedAs}" is not in its published ${row.field}`);
  }
});

test("every surveyed bird has its movement declared, and the warning a hunter reads follows it", () => {
  const surveyed = surfaceRegistry().surfaces.filter((entry) => (entry.evidenceClass ?? "STRUCTURED_SURVEY") === "STRUCTURED_SURVEY");
  for (const entry of surveyed) {
    assert.ok(declarations.species[entry.speciesId], `${entry.speciesId}: no movement declaration`);
    const [surface] = speciesSurfaces(entry.speciesId, undefined, undefined, { month: 6 }).surfaces.filter((s) => s.id === entry.artifactId);
    if (surface) assert.equal(surface.season?.warning, SEASON_WARNING[movementOf(entry.speciesId)], entry.speciesId);
  }
});

test("a bird that moves between seasons is drawn for the hunting months from hunting-season records", () => {
  for (const [speciesId, row] of Object.entries(declarations.species)) {
    if (row.movement === "RESIDENT" || row.movement === "SHORT_DISTANCE") continue;
    const profile = profiles.species[speciesId];
    assert.ok(profile, `${speciesId}: moves (${row.movement}) and has no hunting-season profile`);
    assert.equal(profile.season, "HUNTING_SEASON_RECORDS", `${speciesId}: moves and would be drawn from all-year records`);
  }
});

test("a breeding survey speaks for every month only for a bird that stays", () => {
  for (const entry of surfaceRegistry().surfaces) {
    if ((entry.evidenceClass ?? "STRUCTURED_SURVEY") !== "STRUCTURED_SURVEY") continue;
    const movement = movementOf(entry.speciesId);
    assert.equal(evidenceWindowOf(entry), movement === "RESIDENT" || movement === "SHORT_DISTANCE" ? "YEAR_ROUND" : "BREEDING", entry.speciesId);
  }
});

/* ------------------------------------------------------ the composition rule */

const candidate = (id: string, tier: CompositionCandidate["tier"], window: CompositionCandidate["window"] = "YEAR_ROUND", measured = false): CompositionCandidate => ({
  id, tier, window, measured, resolutionMetres: 11_000,
});

test("promotion is auditable: T6 → T5 → T3, and a lower tier is kept, never deleted", () => {
  /* A known distribution alone. */
  let composed = composeSurfaces([candidate("t6", "RANGE_ONLY")], 10);
  assert.deepEqual(composed.chosen.map((c) => [c.id, c.role]), [["t6", "PRIMARY"]]);
  /* A habitat profile arrives: it leads, and the distribution stays, beyond it. */
  composed = composeSurfaces([candidate("t6", "RANGE_ONLY"), candidate("t5", "RANGE_HABITAT")], 10);
  assert.deepEqual(composed.chosen.map((c) => [c.id, c.role]), [["t5", "PRIMARY"], ["t6", "COMPLEMENT_BEYOND"]]);
  assert.deepEqual(composed.chosen[1].beyond, ["t5"]);
  /* A survey arrives: it leads; both weaker surfaces remain, each kept off the ground of those stronger. */
  composed = composeSurfaces([candidate("t6", "RANGE_ONLY"), candidate("t5", "RANGE_HABITAT"), candidate("t3", "SYSTEMATIC_SURVEY", "YEAR_ROUND", true)], 10);
  assert.deepEqual(composed.chosen.map((c) => [c.id, c.role]), [["t3", "PRIMARY"], ["t5", "COMPLEMENT_BEYOND"], ["t6", "COMPLEMENT_BEYOND"]]);
  assert.deepEqual(composed.chosen[1].beyond, ["t3"]);
  assert.deepEqual(composed.chosen[2].beyond, ["t3", "t5"]);
  assert.equal(composed.outOfSeason.length, 0, "nothing was dropped");
});

test("the month decides which season's evidence is drawn, and a month nothing describes is said, never silent", () => {
  const breeding = candidate("bbs", "SYSTEMATIC_SURVEY", "BREEDING", true);
  const hunting = candidate("season", "RANGE_HABITAT", "HUNTING_SEASON");
  /* October: the hunting-season records, even though a survey is the stronger tier. */
  let composed = composeSurfaces([breeding, hunting], 10);
  assert.deepEqual(composed.chosen.map((c) => c.id), ["season"]);
  assert.deepEqual(composed.outOfSeason, ["bbs"]);
  assert.equal(composed.matched, "IN_WINDOW");
  /* June: the breeding survey. */
  composed = composeSurfaces([breeding, hunting], 6);
  assert.deepEqual(composed.chosen.map((c) => c.id), ["bbs"]);
  /* March: nothing describes it; the nearest season (February, one month) is drawn and the reply says so. */
  composed = composeSurfaces([breeding, hunting], 3);
  assert.equal(composed.matched, "NEAREST");
  assert.deepEqual(composed.chosen.map((c) => c.id), ["season"]);
  assert.equal(monthsToWindow(3, "HUNTING_SEASON"), 1);
  assert.equal(monthsToWindow(4, "BREEDING"), 1);
  /* Different seasons never mask each other when nothing is filtered. */
  composed = composeSurfaces([breeding, hunting]);
  assert.deepEqual(composed.chosen.map((c) => c.role), ["PRIMARY", "PRIMARY"]);
});

test("the windows cover the year without overlap between breeding and hunting", () => {
  const breeding = new Set(EVIDENCE_WINDOWS.BREEDING.months);
  assert.ok(EVIDENCE_WINDOWS.HUNTING_SEASON.months.every((m) => !breeding.has(m)));
  assert.equal(EVIDENCE_WINDOWS.YEAR_ROUND.months.length, 12);
});

test("the endpoint serves the season asked for, and says how it matched", async () => {
  const GET = createSpeciesSurfaceHandler();
  const ask = async (query: string) => {
    const response = await GET(new Request(`https://northgroundbushcraft.com/api/hunt/species-surface?${query}`));
    return { status: response.status, body: await response.json() };
  };
  /* A resident: the same survey in June and October. */
  const june = await ask("speciesId=species:ruffed-grouse&month=6");
  const october = await ask("speciesId=species:ruffed-grouse&month=10");
  assert.deepEqual(june.body.surfaces.map((s: { id: string }) => s.id), october.body.surfaces.map((s: { id: string }) => s.id));
  assert.equal(october.body.season.matched, "IN_WINDOW");
  /* A partial migrant in June: its breeding evidence, labelled as such. */
  const mallard = await ask("speciesId=species:mallard&month=6");
  assert.ok(mallard.body.surfaces.length);
  for (const surface of mallard.body.surfaces) assert.equal(surface.evidenceWindow.id, "BREEDING");
  /* A bad month is refused, never quietly read as another. */
  assert.equal((await ask("speciesId=species:mallard&month=13")).status, 400);
  assert.equal((await ask("speciesId=species:mallard&month=x")).status, 400);
});
