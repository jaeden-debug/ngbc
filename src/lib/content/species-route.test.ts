import assert from "node:assert/strict";
import test from "node:test";
import { contentRepository } from "./repository.ts";
import { isPublishedSpeciesSlug, PUBLISHED_SPECIES_SLUGS } from "./species-route.ts";

test("the proxy's species slugs are exactly the repository's published species", async () => {
  const resources = await contentRepository.getPublishedResources({ locale: "en-CA" });
  const expected = resources.filter((resource) => resource.type === "species").map((resource) => resource.slug).sort();
  assert.deepEqual([...PUBLISHED_SPECIES_SLUGS].sort(), expected);
  assert.equal(expected.length, 60);
  assert.ok(isPublishedSpeciesSlug("ruffed-grouse"));
  assert.ok(!isPublishedSpeciesSlug("not-a-real-species"));
  assert.ok(!isPublishedSpeciesSlug("ruffed-grouse/extra"));
});
