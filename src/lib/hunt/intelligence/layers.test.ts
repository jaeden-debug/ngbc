import assert from "node:assert/strict";
import test from "node:test";
import { INTELLIGENCE_LAYERS } from "./layers.ts";

test("product vocabulary uses the required Specie Heat Map name", () => {
  assert.equal(INTELLIGENCE_LAYERS.find(({ id }) => id === "specie-heat-map")?.label, "SPECIE HEAT MAP");
});

test("opportunity and ownership layers cannot decide legality", () => {
  for (const id of ["specie-heat-map", "harvest-data", "habitat", "species-range", "crown-public-land", "potential-hunting-areas"]) {
    assert.equal(INTELLIGENCE_LAYERS.find((layer) => layer.id === id)?.legalDecision, false, id);
  }
});

test("three modes share one layer catalogue", () => {
  const modes = new Set(INTELLIGENCE_LAYERS.flatMap(({ modes }) => modes));
  assert.deepEqual([...modes].sort(), ["CHECK_HUNT", "EXPLORE", "FIND_GAME"]);
  assert.equal(new Set(INTELLIGENCE_LAYERS.map(({ id }) => id)).size, INTELLIGENCE_LAYERS.length);
});
