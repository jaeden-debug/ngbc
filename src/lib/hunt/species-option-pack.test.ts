import assert from "node:assert/strict";
import { test } from "node:test";
import type { SpeciesSelectorOption } from "./coverage.ts";
import { packSpeciesOptions, unpackSpeciesOptions } from "./species-option-pack.ts";

const option = (overrides: Partial<SpeciesSelectorOption> = {}): SpeciesSelectorOption => ({
  id: "species:moose" as SpeciesSelectorOption["id"],
  displayName: "Moose",
  scientificName: "Alces alces",
  category: "Deer",
  aliases: ["orignal"],
  searchTerms: ["Orignal"],
  groupIds: ["species_group:deer", "species_group:big-game"],
  resourcePath: "/hunting/species/moose",
  image: null,
  regulatoryJurisdictions: [{ id: "jurisdiction:ca-on" as SpeciesSelectorOption["regulatoryJurisdictions"][number]["id"], name: "Ontario", asksQuestion: true }],
  hasOpportunityEvidence: true,
  hasSpeciesSurface: false,
  ...overrides,
});

test("packing drops nothing: every field survives the round trip", () => {
  const options = [
    option(),
    option({ id: "species:x" as SpeciesSelectorOption["id"], resourcePath: null, regulatoryJurisdictions: [], hasOpportunityEvidence: false, hasSpeciesSurface: true, aliases: [], searchTerms: [], groupIds: [] }),
  ];
  assert.deepEqual(unpackSpeciesOptions(packSpeciesOptions(options)), options);
});

test("packed options are smaller than the objects they carry", () => {
  const options = Array.from({ length: 50 }, (_, index) => option({ id: `species:s${index}` as SpeciesSelectorOption["id"] }));
  assert.ok(JSON.stringify(packSpeciesOptions(options)).length < JSON.stringify(options).length * 0.7);
});
