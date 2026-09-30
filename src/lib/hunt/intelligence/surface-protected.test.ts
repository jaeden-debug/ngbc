import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PROTECTED_LOOKALIKE_IDS } from "../../seo/species-metadata.ts";

/**
 * A species that must never be hunted must never get a Species Heat surface.
 *
 * The surface layer answers "where should I look for this animal". Drawn for a
 * whooping crane — endangered, and the highest-consequence misidentification in
 * North American bird hunting — that is a hunting aid for a bird whose shooting
 * ends in prosecution. §16 says library presence never implies legal
 * opportunity; a heat map is a stronger implication than a profile, so the
 * library may hold these species and the surface may not.
 *
 * Why this is a test rather than a filter in the builder: the builder derives
 * its universe from the species catalogue (deliberately — a hand-kept list is
 * what made 97% of committed evidence unreachable once already), and the
 * catalogue carries no hunted/non-hunted fact for it to read. Until it does,
 * this is the guard, and it fails at the moment someone runs the builder and
 * commits a registry — which is exactly when a human should look.
 *
 * The concept belongs in the catalogue, not in the SEO module it is imported
 * from here. That move is the real fix; this test is what holds the line until
 * someone makes it.
 */
test("no protected species carries a Species Heat surface", () => {
  const registry = JSON.parse(readFileSync("content/intelligence/surface-registry.json", "utf8")) as {
    surfaces: ReadonlyArray<{ speciesId: string }>;
  };
  assert.ok(registry.surfaces.length > 0, "the registry should not be empty; an empty one would pass this vacuously");

  const offending = registry.surfaces
    .map((entry) => entry.speciesId)
    .filter((id) => PROTECTED_LOOKALIKE_IDS.has(id));
  assert.deepEqual(offending, [], `a protected species has a surface: ${offending.join(", ")}`);
});

test("the guard can fail — a protected id in the drawn set is caught", () => {
  /* The positive control. Without it, this file passes whether or not the
     check works, which is the failure shape this program keeps finding. */
  const drawn = ["species:ruffed-grouse", "species:whooping-crane"];
  const offending = drawn.filter((id) => PROTECTED_LOOKALIKE_IDS.has(id));
  assert.deepEqual(offending, ["species:whooping-crane"]);
});
