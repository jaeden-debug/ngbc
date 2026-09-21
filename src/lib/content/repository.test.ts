import assert from "node:assert/strict";
import test from "node:test";
import { contentRepository } from "./repository.ts";

test("repository resolves canonical IDs and slugs without guessing URLs", async () => {
  const byId = await contentRepository.resolveEntity({ value: "species:ruffed-grouse" });
  assert.equal(byId.status, "resolved");
  if (byId.status === "resolved") assert.equal(byId.matchedBy, "id");

  const bySlug = await contentRepository.resolveEntity({ value: "ruffed-grouse", locale: "en-CA" });
  assert.equal(bySlug.status, "resolved");
  assert.equal((await contentRepository.getCanonicalUrl("species:ruffed-grouse", "en-CA"))?.path, "/hunting/species/ruffed-grouse");
});

test("ambiguous regional aliases do not silently resolve", async () => {
  const result = await contentRepository.resolveEntity({ value: "partridge", locale: "en-CA" });
  assert.equal(result.status, "ambiguous");
  if (result.status === "ambiguous") {
    assert.deepEqual(result.candidates.map(({ id }) => id).sort(), ["species:gray-partridge", "species:ruffed-grouse"]);
  }
});

test("context matching requires constrained jurisdiction data and explains matches", async () => {
  const incomplete = await contentRepository.getContextualBlocks({
    locale: "en-CA",
    activityId: "activity:hunting",
    speciesIds: ["species:ruffed-grouse"],
    blockTypes: ["legal_note"],
  });
  assert.equal(incomplete.blocks.length, 0);
  assert.equal(incomplete.warnings[0]?.code, "NO_MATCH");

  const complete = await contentRepository.getContextualBlocks({
    locale: "en-CA",
    countryId: "country:ca",
    jurisdictionIds: ["jurisdiction:ca-on"],
    zoneIds: ["management_zone:ca-on-wmu-57"],
    speciesIds: ["species:ruffed-grouse"],
    date: "2026-10-15",
    activityId: "activity:hunting",
    huntTypeId: "hunt_type:upland",
    blockTypes: ["habitat_tip", "identification_warning", "legal_note"],
  });
  assert.deepEqual(complete.blocks.map(({ block }) => block.type), ["legal_note", "identification_warning", "habitat_tip"]);
  assert.ok(complete.blocks.every(({ matchReasons }) => matchReasons.includes("species")));
});

test("related resources expose only real published destinations", async () => {
  const related = await contentRepository.getRelatedResources("species:ruffed-grouse", { locale: "en-CA" });
  assert.deepEqual(related.map(({ id }) => id), ["tool:season-finder", "species:spruce-grouse"]);
  assert.ok(related.every(({ canonicalUrl }) => canonicalUrl?.startsWith("/")));
});

test("production species lookup, aliases and search use canonical identity", async () => {
  const deer = await contentRepository.getSpecies("species:white-tailed-deer");
  assert.equal(deer?.speciesProfile.scientificName, "Odocoileus virginianus");
  assert.equal(deer?.canonicalUrl, "/hunting/species/white-tailed-deer");

  const whitetail = await contentRepository.searchSpecies("whitetail", { locale: "en-CA" });
  assert.deepEqual(whitetail.map(({ id }) => id), ["species:white-tailed-deer"]);
  const french = await contentRepository.searchSpecies("Orignal", { locale: "en-CA" });
  assert.deepEqual(french.map(({ id }) => id), ["species:moose"]);
  assert.ok((await contentRepository.getSpeciesAliases("species:white-tailed-deer")).some(({ value }) => value === "white-tail"));
});

test("species groups, related species and image publication gate remain explicit", async () => {
  const spruce = await contentRepository.getSpecies("species:spruce-grouse");
  assert.deepEqual(spruce?.speciesProfile.speciesGroupIds, ["species_group:grouse", "species_group:upland-game-birds"]);
  assert.deepEqual((await contentRepository.getRelatedSpecies("species:spruce-grouse")).map(({ id }) => id), ["species:ruffed-grouse"]);
  assert.equal(await contentRepository.getSpeciesImage("species:spruce-grouse"), null);
  assert.equal((await contentRepository.getSpecies("species:gray-partridge"))?.status, "published");
});

test("species App Blocks and sources remain independently retrievable", async () => {
  const blocks = await contentRepository.getSpeciesBlocks("species:mallard", {
    locale: "en-CA",
    activityId: "activity:hunting",
    blockTypes: ["identification_warning"],
  });
  assert.equal(blocks.blocks[0]?.block.id, "content_block:mallard.identification.01");
  assert.deepEqual((await contentRepository.getSpeciesSources("species:mallard")).map(({ id }) => id), ["source:cornell-mallard"]);
});

test("hunter terms resolve to one canonical species plus a distinct characteristic intent", async () => {
  const cases = [
    ["doe", "species:white-tailed-deer", "BIOLOGICAL", "FEMALE"],
    ["buck", "species:white-tailed-deer", "BIOLOGICAL", "MALE"],
    ["female deer", "species:white-tailed-deer", "BIOLOGICAL", "FEMALE"],
    ["antlerless deer", "species:white-tailed-deer", "REGULATORY_CLASS", "ANTLERLESS"],
    ["bull moose", "species:moose", "BIOLOGICAL", "MALE"],
    ["cow moose", "species:moose", "BIOLOGICAL", "FEMALE"],
    ["hen turkey", "species:wild-turkey", "BIOLOGICAL", "FEMALE"],
    ["bearded turkey", "species:wild-turkey", "REGULATORY_CLASS", "BEARDED"],
  ] as const;
  for (const [query, speciesId, kind, value] of cases) {
    const result = await contentRepository.interpretSpeciesQuery(query, { locale: "en-CA" });
    assert.equal(result.status, "resolved", query);
    if (result.status === "resolved") {
      assert.equal(result.species.id, speciesId, query);
      assert.equal(result.intent?.kind, kind, query);
      assert.equal(result.intent?.value, value, query);
    }
  }
  assert.equal(await contentRepository.getSpecies("species:doe"), null);
  assert.equal(await contentRepository.getSpecies("species:buck"), null);
});

test("biological sex and jurisdiction-defined regulatory classes remain separate", async () => {
  const deer = await contentRepository.getSpeciesSexAgeInfo("species:white-tailed-deer");
  const female = deer?.terminology.find(({ value }) => value === "female deer")?.intent;
  const antlerless = deer?.terminology.find(({ value }) => value === "antlerless deer")?.intent;
  assert.deepEqual(female, { kind: "BIOLOGICAL", dimension: "SEX", value: "FEMALE" });
  assert.deepEqual(antlerless, { kind: "REGULATORY_CLASS", dimension: "ANTLER_CLASS", value: "ANTLERLESS" });
  assert.notDeepEqual(female, antlerless);
});

test("broad animal words and bird categories return choices rather than fake species", async () => {
  for (const [query, expected] of [
    ["rabbit", ["species:arctic-hare", "species:eastern-cottontail", "species:snowshoe-hare"]],
    ["wolf", ["species:eastern-wolf", "species:gray-wolf"]],
    ["fox", ["species:arctic-fox", "species:gray-fox", "species:red-fox"]],
  ] as const) {
    const result = await contentRepository.interpretSpeciesQuery(query, { locale: "en-CA" });
    assert.equal(result.status, "choices", query);
    if (result.status === "choices") assert.deepEqual(result.species.map(({ id }) => id).sort(), [...expected].sort(), query);
  }
  const ducks = await contentRepository.interpretSpeciesQuery("duck", { locale: "en-CA" });
  assert.equal(ducks.status, "choices");
  if (ducks.status === "choices") {
    assert.ok(ducks.species.some(({ id }) => id === "species:mallard"));
    assert.ok(ducks.species.some(({ id }) => id === "species:canvasback"));
    assert.ok(ducks.species.length >= 16);
  }
  const geese = await contentRepository.interpretSpeciesQuery("goose", { locale: "en-CA" });
  assert.equal(geese.status, "choices");
  if (geese.status === "choices") assert.ok(geese.species.some(({ id }) => id === "species:brant"));
});

test("French names, scientific names, groups, lookalikes and image gates survive Wave 2 promotion", async () => {
  assert.deepEqual((await contentRepository.searchSpecies("Lynx du Canada")).map(({ id }) => id), ["species:canada-lynx"]);
  assert.deepEqual((await contentRepository.searchSpecies("Antilocapra americana")).map(({ id }) => id), ["species:pronghorn"]);
  assert.ok((await contentRepository.searchSpecies("waterfowl")).length >= 20);
  assert.ok((await contentRepository.getSpeciesGroups("species:canvasback")).some(({ id }) => id === "species_group:waterfowl"));
  assert.ok((await contentRepository.getRelatedSpecies("species:greater-scaup")).some(({ id }) => id === "species:lesser-scaup"));
  assert.deepEqual(
    (await contentRepository.getRelatedSpecies("species:snowshoe-hare")).map(({ id }) => id),
    ["species:eastern-cottontail", "species:arctic-hare"],
  );
  assert.ok((await contentRepository.getRelatedSpecies("species:mallard")).some(({ id }) => id === "species:american-black-duck"));
  assert.ok((await contentRepository.getSpeciesIdentificationWarnings("species:greater-scaup")).length > 0);
  assert.deepEqual(await contentRepository.getSpeciesImages("species:greater-scaup"), []);
});

test("production library is substantial while the selector vocabulary remains compact", async () => {
  const species = (await contentRepository.getPublishedResources({ locale: "en-CA" })).filter((resource) => resource.type === "species");
  assert.equal(species.length, 60);
  const compact = await Promise.all(species.map(async (resource) => ({
    id: resource.id,
    n: resource.title,
    s: resource.speciesProfile.scientificName,
    a: (await contentRepository.getSpeciesAliases(resource.speciesProfile.speciesId)).map(({ value }) => value),
    t: resource.speciesProfile.sexAgeInfo?.terminology.map(({ value }) => value) ?? [],
  })));
  assert.ok(Buffer.byteLength(JSON.stringify(compact)) < 40_000);
});
