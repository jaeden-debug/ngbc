import assert from "node:assert/strict";
import test from "node:test";
import { characteristicsFromIntent, needsAnimalClass } from "./animal-characteristics.ts";

test("biological sex remains distinct from a regulatory antler class", () => {
  assert.deepEqual(characteristicsFromIntent({ kind: "BIOLOGICAL", dimension: "SEX", value: "FEMALE" }), {
    biologicalSex: "FEMALE",
  });
  assert.deepEqual(characteristicsFromIntent({ kind: "REGULATORY_CLASS", dimension: "ANTLER_CLASS", value: "ANTLERLESS" }), {
    regulatoryClasses: [{ dimension: "ANTLER_CLASS", value: "ANTLERLESS" }],
  });
});

test("jurisdictional regulatory dimensions explicitly require source definitions", () => {
  const request = needsAnimalClass("ANTLER_CLASS", "Which regulatory class applies?", [
    { value: "ANTLERED", label: "Antlered" },
    { value: "ANTLERLESS", label: "Antlerless" },
    { value: "UNKNOWN", label: "Not sure" },
  ]);
  assert.equal(request.status, "NEEDS_INPUT");
  assert.equal(request.sourceDefinitionRequired, true);
});
