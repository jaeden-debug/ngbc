import assert from "node:assert/strict";
import test from "node:test";
import { contentRepository } from "./repository.ts";
import { isPublishedSpeciesSlug, PUBLISHED_SPECIES_SLUGS, speciesProfileHref } from "./species-route.ts";
import { canonicalPath } from "./urls.ts";

test("the proxy's species slugs are exactly the repository's published species", async () => {
  const resources = await contentRepository.getPublishedResources({ locale: "en-CA" });
  const expected = resources.filter((resource) => resource.type === "species").map((resource) => resource.slug).sort();
  assert.deepEqual([...PUBLISHED_SPECIES_SLUGS].sort(), expected);
  /* Non-vacuous: the catalogue is the research registry, never empty. */
  assert.ok(expected.length > 400, `${expected.length}`);
  assert.ok(isPublishedSpeciesSlug("ruffed-grouse"));
  assert.ok(!isPublishedSpeciesSlug("not-a-real-species"));
  assert.ok(!isPublishedSpeciesSlug("ruffed-grouse/extra"));
});

test("every published species links to the route registry's own path for its id", async () => {
  const resources = (await contentRepository.getPublishedResources({ locale: "en-CA" }))
    .filter((resource) => resource.type === "species");
  for (const resource of resources) {
    const href = speciesProfileHref(resource);
    assert.ok(href, `${resource.slug} has no linkable profile`);
    assert.equal(href, canonicalPath(resource.speciesProfile.speciesId)?.path, resource.slug);
  }
});

test("a profile link is refused rather than constructed", () => {
  assert.equal(speciesProfileHref({ slug: "ruffed-grouse", canonicalUrl: null }), null, "no canonical URL, no link");
  assert.equal(speciesProfileHref({ slug: "ruffed-grouse" }), null);
  assert.equal(speciesProfileHref({ slug: "not-a-real-species", canonicalUrl: "/hunting/species/not-a-real-species" }), null, "unpublished, no link");
  assert.equal(speciesProfileHref({ slug: "ruffed-grouse", canonicalUrl: "/hunting/species/ruffed-grouse" }), "/hunting/species/ruffed-grouse");
});
