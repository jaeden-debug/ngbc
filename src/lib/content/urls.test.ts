import assert from "node:assert/strict";
import test from "node:test";
import {
  absoluteUrl,
  canonicalPath,
  isRoutableType,
  jurisdictionSegments,
  speciesInJurisdictionPathFromIds,
} from "./urls.ts";

test("species and guides resolve into the /hunting namespace without trailing slashes", () => {
  assert.equal(canonicalPath("species:ruffed-grouse")?.path, "/hunting/species/ruffed-grouse");
  assert.equal(canonicalPath("hunt_type:upland")?.path, "/hunting/guides/upland");
  assert.equal(canonicalPath("condition:minus-20c")?.path, "/hunting/conditions/minus-20c");
  assert.equal(canonicalPath("skill:navigation")?.path, "/hunting/skills/navigation");
  assert.equal(canonicalPath("field_test:boots-minus-30")?.path, "/hunting/field-tests/boots-minus-30");
});

test("tools stay at the root because a tool may serve several verticals", () => {
  assert.equal(canonicalPath("tool:season-finder")?.path, "/hunt");
  assert.deepEqual(canonicalPath("tool:season-finder")?.previousPaths, ["/tools/season-finder"]);
});

test("jurisdiction IDs are globally unique but nest under their country in routes", () => {
  assert.deepEqual(jurisdictionSegments("ca-qc"), { country: "ca", region: "qc" });
  assert.equal(canonicalPath("jurisdiction:ca-qc")?.path, "/hunting/ca/qc");
  assert.equal(canonicalPath("country:ca")?.path, "/hunting/ca");
});

test("malformed jurisdiction keys resolve to null rather than a broken path", () => {
  assert.equal(canonicalPath("jurisdiction:quebec"), null);
  assert.equal(canonicalPath("jurisdiction:ca-"), null);
  assert.equal(jurisdictionSegments("-qc"), null);
});

test("species x jurisdiction composes both parents", () => {
  assert.equal(
    speciesInJurisdictionPathFromIds("species:ruffed-grouse", "jurisdiction:ca-qc"),
    "/hunting/ca/qc/ruffed-grouse",
  );
});

test("composite paths reject mismatched entity types", () => {
  assert.equal(
    // @ts-expect-error deliberately passing the wrong entity type
    speciesInJurisdictionPathFromIds("hunt_type:upland", "jurisdiction:ca-qc"),
    null,
  );
});

test("entities that intentionally have no page return null, not a guessed route", () => {
  for (const id of [
    "activity:hunting",
    "source:mffp-2026",
    "content_block:ruffed-grouse.cold.clothing.01",
    "equipment_item:wool-base-layer",
    "management_zone:ca-qc-zone-10",
  ]) {
    assert.equal(canonicalPath(id), null, `${id} must not resolve to a page`);
  }
  assert.equal(isRoutableType("activity"), false);
  assert.equal(isRoutableType("species"), true);
});

test("invalid canonical IDs never produce a path", () => {
  for (const id of ["", "species", "species:", "not_a_type:x", "species:Ruffed-Grouse"]) {
    assert.equal(canonicalPath(id), null, `${id} must not resolve`);
  }
});

test("absolute URLs tolerate a trailing slash on the configured origin", () => {
  assert.equal(
    absoluteUrl("/hunting/species/ruffed-grouse", "https://www.northgroundbushcraft.com/"),
    "https://www.northgroundbushcraft.com/hunting/species/ruffed-grouse",
  );
  assert.equal(
    absoluteUrl("hunting/species/ruffed-grouse", "https://www.northgroundbushcraft.com"),
    "https://www.northgroundbushcraft.com/hunting/species/ruffed-grouse",
  );
});
