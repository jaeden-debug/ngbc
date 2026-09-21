#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const path = resolve(import.meta.dirname, "../content/published/species-wave-1.json");
const bundle = JSON.parse(await readFile(path, "utf8"));

const biological = (value, kind, dimension, characteristic) => ({
  value, locale: "en-CA", kind,
  intent: { kind: "BIOLOGICAL", dimension, value: characteristic },
});
const regulatory = (value, dimension, characteristic, sourceIds) => ({
  value, locale: "en-CA", kind: "regulatory_class_term",
  intent: { kind: "REGULATORY_CLASS", dimension, value: characteristic },
  sourceIds,
});

const profiles = new Map(bundle.resources.filter((resource) => resource.type === "species")
  .map((resource) => [resource.id, resource.speciesProfile]));

profiles.get("species:white-tailed-deer").sexAgeInfo = {
  terminology: [
    biological("buck", "hunter_term", "SEX", "MALE"),
    biological("male deer", "sex_term", "SEX", "MALE"),
    biological("doe", "hunter_term", "SEX", "FEMALE"),
    biological("female deer", "sex_term", "SEX", "FEMALE"),
    biological("fawn", "age_term", "AGE_CLASS", "FAWN"),
    regulatory("antlered deer", "ANTLER_CLASS", "ANTLERED", ["source:ontario-white-tailed-deer"]),
    regulatory("antlerless deer", "ANTLER_CLASS", "ANTLERLESS", ["source:ontario-white-tailed-deer"]),
  ],
  sexDifferences: [{ text: "Adult bucks usually carry antlers during part of the year; antler presence is seasonal and cannot be treated as a permanent definition of biological sex.", sourceIds: ["source:ontario-white-tailed-deer"] }],
  ageDifferences: [{ text: "Fawns are young deer, often spotted early in life. Regulatory age or antler-class definitions must come from the applicable rule.", sourceIds: ["source:ontario-white-tailed-deer"] }],
};

profiles.get("species:moose").sexAgeInfo = {
  terminology: [
    biological("bull", "hunter_term", "SEX", "MALE"), biological("bull moose", "hunter_term", "SEX", "MALE"),
    biological("cow", "hunter_term", "SEX", "FEMALE"), biological("cow moose", "hunter_term", "SEX", "FEMALE"),
    biological("moose calf", "age_term", "AGE_CLASS", "CALF"), biological("calf moose", "age_term", "AGE_CLASS", "CALF"),
  ],
  sexDifferences: [{ text: "Adult bulls may carry broad antlers; cows do not, but a bull can be antlerless after shedding.", sourceIds: ["source:itis-wave-1-taxonomy"] }],
  ageDifferences: [{ text: "A biological calf is a young moose. Any legally defined calf criterion belongs to the applicable regulation.", sourceIds: ["source:ontario-moose-habitat"] }],
};

profiles.get("species:wild-turkey").sexAgeInfo = {
  terminology: [
    biological("tom", "hunter_term", "SEX", "MALE"), biological("tom turkey", "hunter_term", "SEX", "MALE"),
    biological("gobbler", "hunter_term", "SEX", "MALE"), biological("hen", "hunter_term", "SEX", "FEMALE"),
    biological("hen turkey", "hunter_term", "SEX", "FEMALE"), biological("jake", "hunter_term", "AGE_CLASS", "JUVENILE"),
    regulatory("bearded turkey", "BIRD_CHARACTERISTIC", "BEARDED", ["source:cornell-wild-turkey"]),
    regulatory("wild turkey with visible beard", "BIRD_CHARACTERISTIC", "BEARDED", ["source:cornell-wild-turkey"]),
  ],
  sexDifferences: [{ text: "Adult males are generally larger and more iridescent, with more prominent head and neck ornamentation; beard presence alone must not be equated automatically with male sex.", sourceIds: ["source:cornell-wild-turkey"] }],
  ageDifferences: [{ text: "Juvenile plumage and proportions differ from adults; jake is hunter terminology for a young male, not a separate species.", sourceIds: ["source:cornell-wild-turkey"] }],
};

for (const id of ["species:ruffed-grouse", "species:spruce-grouse", "species:sharp-tailed-grouse"]) {
  const profile = profiles.get(id);
  if (profile) profile.speciesGroupIds = [...new Set([...profile.speciesGroupIds, "species_group:upland-game-birds"])];
}
for (const id of ["species:mallard", "species:canada-goose"]) {
  const profile = profiles.get(id);
  if (profile) profile.speciesGroupIds = [...new Set([...profile.speciesGroupIds, "species_group:waterfowl", "species_group:migratory-game-birds"])];
}

function addLookalikes(speciesId, relatedIds) {
  const resource = bundle.resources.find((candidate) => candidate.id === speciesId);
  if (!resource || resource.type !== "species") return;
  resource.relatedSpeciesIds = [...new Set([...(resource.relatedSpeciesIds ?? []), ...relatedIds])];
  resource.speciesProfile.similarSpeciesIds = [
    ...new Set([...(resource.speciesProfile.similarSpeciesIds ?? []), ...relatedIds]),
  ];
}

/* Reciprocal discovery for comparisons already sourced in Wave 2. The Wave 2
   side names these Wave 1 species; this closes the return path without creating
   a second identity or a thin comparison page. */
addLookalikes("species:snowshoe-hare", ["species:eastern-cottontail", "species:arctic-hare"]);
addLookalikes("species:mallard", ["species:american-black-duck"]);

await writeFile(path, `${JSON.stringify(bundle, null, 2)}\n`);
console.log("Enriched Wave 1 hunter terminology and group lineage.");
