import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { createSpeciesSurfaceHandler } from "./handler.ts";
import { catalogueSpecies } from "./species-catalogue.ts";
import { EMPTY_MEANINGS, speciesSurfaces, surfaceRegistry } from "./surface.ts";

/**
 * EVERY COMMITTED ARTIFACT IS REACHABLE THROUGH THE ENDPOINT.
 *
 * The failure this exists for, in full, because it is the one the repository
 * has committed twice. 25 surface artifacts — 18 MB, 25,736 cells each — were
 * built, hashed, reproduced byte-identically across two machines, and committed.
 * Nothing opened them. `speciesSurfaces` filtered to `SAMPLE_PLOT`, so every one
 * of those species answered 404 with a well-written sentence saying no evidence
 * was held. The sentence was careful, cautious, and false.
 *
 * Every check we ran asked whether the data was good. None asked whether it
 * ARRIVED. So this one asks only that: for each artifact on disk, does a request
 * return it? It deliberately reads the directory rather than a list, because a
 * list is a second place to forget.
 */

const GET = createSpeciesSurfaceHandler();
/* Every directory a surface builder writes: the survey fields, North Ground's
   habitat models and the recorded-presence grids. A validation report and the
   credits list sit beside them and are not surfaces. */
const ARTIFACT_DIRS = ["surfaces", "models", "records"].map((dir) => `content/intelligence/${dir}`);
const NOT_SURFACES = /(-validation|^datasets)\.json$/;

function committedArtifacts(): Array<{ path: string; id: string; speciesId: string; cells: number }> {
  return ARTIFACT_DIRS.flatMap((dir) => {
    let files: string[] = [];
    try { files = readdirSync(join(process.cwd(), dir)); } catch { return []; }
    return files
      .filter((file) => file.endsWith(".json") && !NOT_SURFACES.test(file))
      .map((file) => {
        const artifact = JSON.parse(readFileSync(join(process.cwd(), dir, file), "utf8"));
        return { path: `${dir}/${file}`, id: artifact.id as string, speciesId: artifact.speciesId as string, cells: artifact.cells.row.length as number };
      });
  });
}

test("every catalogued species the survey records gets a surface or a stated reason", () => {
  /*
   * THE DERIVATION, not a count. A test pinning "29 surfaces" is another number
   * someone has to remember; what has to hold is that nothing published falls
   * outside the builder's universe unexplained.
   *
   * The defect this replaces: the builder joined against a hand-kept list of 32
   * while the catalogue holds 60, so six species Hunt publishes AND the survey
   * records could never receive a surface. No gate saw it, because a registry
   * certifies what a builder produced and cannot see an input it never
   * considered.
   */
  const registry = surfaceRegistry();
  const accountedFor = new Set([
    ...registry.surfaces.map(({ speciesId }) => speciesId),
    ...registry.declined.map(({ speciesId }) => speciesId),
    ...registry.unmatched.map(({ speciesId }) => speciesId),
  ]);
  const unaccounted = catalogueSpecies()
    .map(({ speciesId }) => speciesId)
    .filter((speciesId) => !accountedFor.has(speciesId))
    .sort();
  assert.deepEqual(unaccounted, [], "a published species must be served, declined or recorded as not in the survey");

  /* And every stated reason must actually state one. "Declined" with no detail
     is the same silence in a longer word. */
  for (const entry of [...registry.declined, ...registry.unmatched]) {
    assert.ok(entry.reason && entry.detail.length > 20, `${entry.speciesId} must say why it has no surface`);
  }
});

test("American black duck is served as a field, not only as plots", async () => {
  /*
   * The case worth keeping, because it is the failure that SURVIVES a
   * reachability check: black duck answered 200 with its waterfowl plots and no
   * Breeding Bird Survey field, so something came back and nothing looked
   * wrong. Partially present is harder to see than absent.
   */
  const response = await GET(
    new Request("https://northgroundbushcraft.com/api/hunt/species-surface?speciesId=species:american-black-duck&bbox=-80,43,-74,47"),
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  const kinds = new Set(body.surfaces.map((s: { geometryKind: string }) => s.geometryKind));
  assert.ok(kinds.has("SAMPLE_PLOT"), "the Eastern Waterfowl Survey plots");
  assert.ok(kinds.has("MODELLED_RASTER"), "and the Breeding Bird Survey field it was missing");
});

test("a surface says how much of it is a negative finding", () => {
  /*
   * Spruce grouse is the case: 89% of its supported cells are surveyed with
   * none found. Drawn without `sampling`, that is a nearly-blank map
   * indistinguishable from no data, when the truth is the opposite — the survey
   * looked almost everywhere and almost nowhere held one.
   */
  const thin = speciesSurfaces("species:spruce-grouse", [-100, 40, -70, 55]).surfaces.find((s) => s.cells);
  const common = speciesSurfaces("species:mourning-dove", [-100, 40, -70, 55]).surfaces.find((s) => s.cells);
  assert.ok(thin?.sampling && common?.sampling);
  const share = (s: NonNullable<typeof thin>) => s.sampling!.surveyedAndNoneFound / s.sampling!.supportedCells;
  assert.ok(share(thin) > 0.8, "a thinly detected bird reports itself as thin");
  assert.ok(share(common) < 0.3, "a common one does not");
  assert.ok(thin.sampling!.sitesDetected < common.sampling!.sitesDetected);
});

test("an artifact in the tree that the registry does not certify FAILS the gate", () => {
  /*
   * §18, and the falsification that makes this whole file worth having: it is
   * not enough that every registered surface serves — an artifact present and
   * UNREGISTERED must turn the gate red, because that is the exact shape of the
   * defect. Twice now this repository has committed evidence no code path could
   * reach while every check stayed green, and both times the reachable set lived
   * somewhere a human had to remember to update.
   *
   * Falsified by hand before it was trusted: dropping an extra .json into the
   * surfaces directory fails this assertion, and removing it passes again.
   */
  const onDisk = new Set(committedArtifacts().map(({ path }) => path));
  const certified = new Set(surfaceRegistry().surfaces.map(({ artifactPath }) => artifactPath));
  const uncertified = [...onDisk].filter((path) => !certified.has(path)).sort();
  assert.deepEqual(uncertified, [], "an artifact the registry does not certify is unreachable evidence");

  const missing = [...certified].filter((path) => !onDisk.has(path)).sort();
  assert.deepEqual(missing, [], "the registry must not certify a surface that is not deployed");
});

test("the registry carries what a reader needs to judge a surface", () => {
  for (const entry of surfaceRegistry().surfaces) {
    assert.match(entry.speciesId, /^species:/);
    assert.match(entry.artifactHash, /^sha256:[0-9a-f]{64}$/, "certification is of BYTES, not of a filename");
    assert.ok(entry.sourceDatasetId, `${entry.speciesId} must name the dataset it came from`);
    assert.ok(entry.effectiveResolutionMetres > 0 && entry.effectiveResolutionStatedAs, `${entry.speciesId} must declare its resolution`);
    assert.ok(entry.season && typeof entry.matchesHuntingSeason === "boolean", `${entry.speciesId} must state its season`);
    assert.ok(entry.methodologyId && entry.methodologyVersion, `${entry.speciesId} must name a versioned methodology`);
    assert.ok(entry.tier && entry.grade, `${entry.speciesId} must carry its evidence tier and grade`);
    assert.ok(entry.unmappedGround, `${entry.speciesId} must say what unshaded ground means`);
  }
  /* A species that does NOT serve is recorded with a reason, because silence
     would read as "nobody looked". */
  const declined = surfaceRegistry().declined;
  assert.ok(declined.length >= 3);
  for (const entry of declined) assert.ok(entry.reason && entry.detail.length > 20, `${entry.speciesId} must say why`);
});

test("every committed surface artifact is served by the endpoint", async () => {
  const artifacts = committedArtifacts();
  assert.ok(artifacts.length >= 25, "the artifacts are on disk to begin with");

  const unreachable: string[] = [];
  for (const artifact of artifacts) {
    const response = await GET(
      new Request(`https://northgroundbushcraft.com/api/hunt/species-surface?speciesId=${artifact.speciesId}`),
    );
    if (response.status !== 200) {
      unreachable.push(`${artifact.path} → ${response.status}`);
      continue;
    }
    /* By ITS id: a species answering with some other surface of its own is
       exactly the partially-present failure a looser check would pass. */
    const body = await response.json();
    const surface = body.surfaces.find((s: { id: string; cells?: unknown }) => s.id === artifact.id && s.cells);
    if (!surface) unreachable.push(`${artifact.path} → 200 but ${artifact.id} is not in it`);
  }
  assert.deepEqual(unreachable, [], "an artifact nobody can request is an artifact nobody has");
});

test("the acceptance species the owner named answer with a real surface", async () => {
  /* Named rather than derived, because these are the ones the owner asked for
     by name and a loop over the directory would pass even if they vanished. */
  for (const speciesId of ["species:ruffed-grouse", "species:wild-turkey", "species:mallard", "species:american-black-duck"]) {
    const response = await GET(
      new Request(`https://northgroundbushcraft.com/api/hunt/species-surface?speciesId=${speciesId}&bbox=-80,43,-74,47`),
    );
    assert.equal(response.status, 200, `${speciesId} must answer`);
    const body = await response.json();
    assert.ok(body.surfaces.length, `${speciesId} must carry at least one surface`);
  }
});

test("both render kinds come out of the one endpoint", async () => {
  /*
   * The owner's ruling: plots draw only where flown, the Breeding Bird Survey
   * draws as a field, and both are legitimate. Mallard is the species that has
   * both, so it is the one that proves the contract carries them together
   * rather than choosing.
   */
  const response = await GET(
    new Request("https://northgroundbushcraft.com/api/hunt/species-surface?speciesId=species:mallard&bbox=-80,43,-74,47"),
  );
  const body = await response.json();
  const kinds = new Set(body.surfaces.map((s: { geometryKind: string }) => s.geometryKind));
  assert.ok(kinds.has("SAMPLE_PLOT"), "the plots are still there");
  assert.ok(kinds.has("MODELLED_RASTER"), "and the field is there beside them");

  for (const surface of body.surfaces) {
    if (surface.geometryKind === "SAMPLE_PLOT") {
      assert.equal(surface.continuity, "DISCRETE");
      assert.ok(surface.features.length && !surface.cells);
    } else {
      assert.equal(surface.continuity, "CONTINUOUS");
      assert.ok(surface.cells && !surface.features.length);
      /* The bandwidth, not the grid step: 0.2° cells drawn from a 40 km kernel
         are still 40 km knowledge. */
      assert.equal(surface.effectiveResolution.metres, 40_000);
      assert.match(surface.effectiveResolution.statedAs, /does not make it finer/);
    }
  }
});

test("a box too large to carry says so, and never says no evidence", () => {
  /*
   * An oversized request that came back as an empty list would read exactly
   * like "nothing is held here" — the same false sentence by a different route.
   *
   * Driven with a small ceiling because the real one is above the whole
   * continental grid, so no live request can reach it. A branch no case reaches
   * is not protection, it is decoration, and the only way to know which this is
   * was to make it fire.
   */
  /* Ruffed grouse holds two rasters — the survey field and, beyond it, the
     habitat model — and each is refused in its own words. */
  const held = surfaceRegistry().surfaces.filter((entry) => entry.speciesId === "species:ruffed-grouse").length;
  assert.ok(held >= 1);
  const refused = speciesSurfaces("species:ruffed-grouse", undefined, 100);
  assert.equal(refused.surfaces.length, 0);
  assert.equal(refused.refusals.length, held);
  for (const refusal of refused.refusals) {
    assert.equal(refusal.reason, "BOX_TOO_LARGE");
    assert.match(refusal.message, /not an absence of evidence/);
  }

  /* And the same request under the real ceiling is answered, so the refusal is
     about the ask and not about the species — measured evidence first. */
  const answered = speciesSurfaces("species:ruffed-grouse").surfaces;
  assert.equal(answered.length, held);
  assert.equal(answered[0].evidence.measured, true);
});

test("the two zeros stay apart in the transport", async () => {
  /*
   * 11,733 of ruffed grouse's 22,873 supported cells are surveyed-and-none-found.
   * In the packed form `null` is ground nobody surveyed and `0` is ground that
   * was surveyed and held none — and there is no way to spell the first as the
   * second, which is stronger than documenting the difference.
   */
  const response = await GET(
    new Request("https://northgroundbushcraft.com/api/hunt/species-surface?speciesId=species:ruffed-grouse&bbox=-100,30,-70,55"),
  );
  const body = await response.json();
  const cells = body.surfaces.find((s: { cells?: unknown }) => s.cells).cells;
  const nulls = cells.values.filter((v: number | null) => v === null).length;
  const zeros = cells.values.filter((v: number | null) => v === 0).length;
  assert.ok(nulls > 0, "some ground in this box was never surveyed");
  assert.ok(zeros > 0, "and some was surveyed and held no ruffed grouse");
  assert.equal(nulls + zeros + cells.values.filter((v: number | null) => typeof v === "number" && v > 0).length, cells.values.length);
});

test("every answer carries a non-empty emptyMeans, whatever its status", async () => {
  /*
   * The defect: `emptyMeans` was typed `string`, one branch did not set it, and
   * the legend drew AN EMPTY PARAGRAPH under "Where to look for the animal" —
   * for moose, the most-hunted species in the product. The contract was right,
   * the refusal to draw zone evidence as a surface was right, the certification
   * was green, and the sentence explaining it was an empty string. Nothing that
   * checks data could see it, because the data was fine.
   *
   * So: one field, same name, on every body a caller can receive. A caller who
   * has to look somewhere else depending on the status will one day look in the
   * wrong place and render a blank line.
   */
  const cases: Array<[string, string]> = [
    ["species:moose", "-100,43,-74,55"],                 // held, none drawable
    ["species:snowshoe-hare", "-100,43,-74,55"],         // nothing held
    ["species:ruffed-grouse", "-160,20,-150,25"],        // exists, not in view
    ["species:ruffed-grouse", "-100,43,-74,55"],         // drawn
    ["species:american-black-duck", "-80,43,-74,47"],    // both kinds drawn
  ];
  for (const [speciesId, bbox] of cases) {
    const response = await GET(new Request(`https://northgroundbushcraft.com/api/hunt/species-surface?speciesId=${speciesId}&bbox=${bbox}`));
    const body = await response.json();
    assert.ok(
      typeof body.emptyMeans === "string" && body.emptyMeans.length > 40,
      `${speciesId} at ${bbox} (status ${response.status}) must say what unshaded ground means`,
    );
    assert.ok(Array.isArray(body.surfaces), "and must always carry a surfaces array, even when refusing");
  }
});

test("the sentence describes what came back, not the species", () => {
  /*
   * A ruffed-grouse caller holding a drawn field was told "no certified
   * evidence is held for this species here" — false, and it looked careful.
   * The meaning is derived from the surfaces returned.
   */
  assert.equal(speciesSurfaces("species:ruffed-grouse", [-100, 43, -74, 55]).emptyMeans, EMPTY_MEANINGS.UNSUPPORTED_GROUND);
  assert.equal(speciesSurfaces("species:mallard", [-76, 46, -74, 47]).emptyMeans, EMPTY_MEANINGS.UNSUPPORTED_GROUND);
  assert.equal(speciesSurfaces("species:moose").emptyMeans, EMPTY_MEANINGS.NOTHING_HELD);
  /* Every declared meaning is a real sentence. `""` is not assignable to
     EmptyMeaning, so this is belt and braces on the literals themselves. */
  for (const [key, sentence] of Object.entries(EMPTY_MEANINGS)) {
    assert.ok(sentence.length > 40, `${key} must be a sentence`);
    assert.match(sentence, /[.]$/, `${key} must read as prose`);
  }
});
