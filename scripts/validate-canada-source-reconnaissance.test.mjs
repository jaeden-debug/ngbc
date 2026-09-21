import assert from "node:assert/strict";
import test from "node:test";

import { readJson, validateManifest } from "./validate-canada-source-reconnaissance.mjs";

const manifest = readJson(new URL("../research/hunting/canada-source-reconnaissance.json", import.meta.url));
const schema = readJson(new URL("../research/hunting/canada-source-reconnaissance.schema.json", import.meta.url));
const clone = (value) => structuredClone(value);

test("current Canada reconnaissance manifest passes the source contract", () => {
  assert.deepEqual(validateManifest(manifest, schema), []);
});

test("missing jurisdiction is rejected", () => {
  const candidate = clone(manifest);
  candidate.jurisdictions.pop();
  const errors = validateManifest(candidate, schema);
  assert.ok(errors.some((error) => error.includes("must contain exactly 11 entries")));
  assert.ok(errors.some((error) => error.includes("missing jurisdiction:ca-nu")));
});

test("duplicate source and GIS ids are rejected", () => {
  const candidate = clone(manifest);
  candidate.jurisdictions[1].gis.candidates[0].id = candidate.jurisdictions[0].gis.candidates[0].id;
  candidate.jurisdictions[1].regulations.sources[0].id = candidate.jurisdictions[0].regulations.sources[0].id;
  const errors = validateManifest(candidate, schema);
  assert.ok(errors.some((error) => error.includes("gis candidates: duplicate id")));
  assert.ok(errors.some((error) => error.includes("regulation sources: duplicate id")));
});

test("missing authority, legal standing, licence, readiness and blockers are rejected", () => {
  const candidate = clone(manifest);
  const jurisdiction = candidate.jurisdictions[0];
  jurisdiction.authority.name = "";
  jurisdiction.gis.candidates[0].legalStanding = "";
  jurisdiction.gis.candidates[0].licence.classification = "";
  jurisdiction.readiness = "";
  delete jurisdiction.blockers;
  const errors = validateManifest(candidate, schema);
  assert.ok(errors.some((error) => error.includes("authority: name is required")));
  assert.ok(errors.some((error) => error.includes("legalStanding: is not recognized")));
  assert.ok(errors.some((error) => error.includes("licence.classification: is not recognized")));
  assert.ok(errors.some((error) => error.includes("readiness: is not recognized")));
  assert.ok(errors.some((error) => error.includes("blockers: must be an array")));
});
