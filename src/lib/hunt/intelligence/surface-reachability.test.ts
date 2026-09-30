import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { createSpeciesSurfaceHandler } from "./handler.ts";
import { speciesSurfaces, surfaceRegistry } from "./surface.ts";

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
const SURFACES = join(process.cwd(), "content", "intelligence", "surfaces");

function committedArtifacts(): Array<{ file: string; speciesId: string; cells: number }> {
  return readdirSync(SURFACES)
    .filter((file) => file.endsWith(".json"))
    .map((file) => {
      const artifact = JSON.parse(readFileSync(join(SURFACES, file), "utf8"));
      return { file, speciesId: artifact.speciesId as string, cells: artifact.cells.row.length as number };
    });
}

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
  const onDisk = new Set(committedArtifacts().map(({ file }) => `content/intelligence/surfaces/${file}`));
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
      unreachable.push(`${artifact.file} → ${response.status}`);
      continue;
    }
    const body = await response.json();
    const surface = body.surfaces.find((s: { cells?: unknown }) => s.cells);
    if (!surface) unreachable.push(`${artifact.file} → 200 but no continuous surface`);
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
  const refused = speciesSurfaces("species:ruffed-grouse", undefined, 100);
  assert.equal(refused.surfaces.length, 0);
  assert.equal(refused.refusals.length, 1);
  assert.equal(refused.refusals[0].reason, "BOX_TOO_LARGE");
  assert.match(refused.refusals[0].message, /not an absence of evidence/);

  /* And the same request under the real ceiling is answered, so the refusal is
     about the ask and not about the species. */
  assert.equal(speciesSurfaces("species:ruffed-grouse").surfaces.length, 1);
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
