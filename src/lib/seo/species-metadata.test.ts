import assert from "node:assert/strict";
import test from "node:test";
import { coveragePhrase, speciesMetadataCopy, speciesProseName, speciesTitleCase } from "./species-metadata.ts";

test("names are title-cased per word and kept proper in prose", () => {
  assert.equal(speciesTitleCase("White-tailed deer"), "White-tailed Deer");
  assert.equal(speciesTitleCase("Barrow's goldeneye"), "Barrow's Goldeneye");
  assert.equal(speciesProseName("Ruffed grouse"), "ruffed grouse");
  assert.equal(speciesProseName("American black bear"), "American black bear");
  assert.equal(speciesProseName("Canada goose"), "Canada goose");
});

const j = (code: string, nameEn: string) => ({ id: `jurisdiction:${code}`, nameEn });

test("coverage counts provinces, territories and states from canonical ids", () => {
  assert.equal(coveragePhrase([]), null);
  assert.equal(coveragePhrase([j("us-id", "Idaho")]), "Idaho");
  assert.equal(coveragePhrase([j("ca-on", "Ontario"), j("ca-qc", "Québec")]), "Ontario and Québec");
  assert.equal(coveragePhrase([j("ca-on", "Ontario"), j("ca-qc", "Québec"), j("ca-yt", "Yukon"), j("us-mt", "Montana")]),
    "2 provinces, 1 territory and 1 state");
});

test("a covered game species names where its certified rules are", () => {
  const copy = speciesMetadataCopy({
    name: "Ruffed grouse",
    groupIds: ["species_group:grouse"],
    regulatoryJurisdictions: [j("ca-on", "Ontario"), j("ca-qc", "Québec"), j("ca-mb", "Manitoba")],
    takeEligibility: "HUNTABLE",
  });
  assert.equal(copy.title, "Ruffed Grouse: Habitat, Range & Hunting Guide");
  assert.equal(copy.ogTitle, "Ruffed Grouse | North Ground");
  assert.match(copy.description, /certified hunting rules in 3 provinces\.$/);
});

test("an uncovered game species never claims rules", () => {
  const copy = speciesMetadataCopy({ name: "Mallard", groupIds: ["species_group:ducks"], regulatoryJurisdictions: [], takeEligibility: "HUNTABLE" });
  assert.equal(copy.title, "Mallard: Habitat, Range & Hunting Guide");
  assert.doesNotMatch(copy.description, /rules/);
});

test("a furbearer is not called a hunting guide, and unknown groups default to that", () => {
  for (const groupIds of [["species_group:furbearers"], ["species_group:something-new"], []]) {
    const copy = speciesMetadataCopy({ name: "American mink", groupIds, regulatoryJurisdictions: [], takeEligibility: "HUNTABLE" });
    assert.equal(copy.hunted, false);
    assert.equal(copy.title, "American Mink: Identification, Habitat & Range");
    assert.doesNotMatch(`${copy.description} ${copy.ogDescription}`, /hunt/i);
  }
});

test("every description fits a search snippet", () => {
  const copy = speciesMetadataCopy({
    name: "Greater white-fronted goose",
    groupIds: ["species_group:geese"],
    regulatoryJurisdictions: [],
    takeEligibility: "HUNTABLE",
  });
  assert.ok(copy.description.length <= 170, `${copy.description.length}`);
});

test("a protected species is never a hunting guide, even in a hunted group", () => {
  const copy = speciesMetadataCopy({
    name: "Whooping crane",
    groupIds: ["species_group:migratory-game-birds"],
    regulatoryJurisdictions: [],
    takeEligibility: "NON_QUARRY",
  });
  assert.equal(copy.hunted, false);
  assert.equal(copy.title, "Whooping Crane: Identification, Habitat & Range");
});

test("an unknown or limited-take species is not titled a hunting guide", () => {
  const copy = speciesMetadataCopy({
    name: "Lesser prairie-chicken",
    groupIds: ["species_group:prairie-grouse"],
    regulatoryJurisdictions: [],
    takeEligibility: "UNKNOWN",
  });
  assert.equal(copy.hunted, false);
});

test("a limited-take species is never titled a hunting guide, even in a hunted group", () => {
  const copy = speciesMetadataCopy({ name: "Trumpeter swan", groupIds: ["species_group:swans"], regulatoryJurisdictions: [], takeEligibility: "LIMITED_TAKE" });
  assert.equal(copy.hunted, false);
});
