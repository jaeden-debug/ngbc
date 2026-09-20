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
  assert.deepEqual(related, [{
    id: "tool:season-finder",
    type: "tool",
    title: "North Ground Hunt season finder",
    description: "Resolve an Ontario wildlife management unit and evaluate the certified ruffed grouse rule for a selected date.",
    canonicalUrl: "/tools/season-finder",
  }]);
});
