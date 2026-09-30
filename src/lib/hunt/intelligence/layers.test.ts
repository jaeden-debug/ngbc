import assert from "node:assert/strict";
import test from "node:test";
import { INTELLIGENCE_LAYERS } from "./layers.ts";

test("product vocabulary uses the required SPECIES HEAT name", () => {
  /* Renamed by the owner, 2026-09-29: a "specie" is coined money. The name is
     SPECIES HEAT, and never "population density" — most layers are not one. */
  assert.equal(INTELLIGENCE_LAYERS.find(({ id }) => id === "species-heat")?.label, "SPECIES HEAT");
  assert.equal(INTELLIGENCE_LAYERS.some(({ label }) => /\bSPECIE\b/.test(label)), false, "no layer may say SPECIE");
});

test("opportunity and ownership layers cannot decide legality", () => {
  for (const id of ["species-heat", "harvest-data", "habitat", "species-range", "crown-public-land", "potential-hunting-areas"]) {
    assert.equal(INTELLIGENCE_LAYERS.find((layer) => layer.id === id)?.legalDecision, false, id);
  }
});

test("three modes share one layer catalogue", () => {
  const modes = new Set(INTELLIGENCE_LAYERS.flatMap(({ modes }) => modes));
  assert.deepEqual([...modes].sort(), ["CHECK_HUNT", "EXPLORE", "FIND_GAME"]);
  assert.equal(new Set(INTELLIGENCE_LAYERS.map(({ id }) => id)).size, INTELLIGENCE_LAYERS.length);
});
