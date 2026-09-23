import assert from "node:assert/strict";
import test from "node:test";
import { SUPPORTED_SPECIES } from "./coverage.ts";

/**
 * A "Learn more" link that 404s is worse than no link.
 *
 * `resourcePath` used to fall back to a path assembled from the slug when a
 * species had no published canonical URL. It resolved for every species
 * published at the time, which is exactly what makes that kind of guess
 * dangerous: nothing checked it, and nothing would have checked the next one.
 *
 * The rule is the same one an unresolvable species id follows — do not render
 * around it. Here that means NULL, and null means do not link.
 */
test("a species profile link is a published URL or nothing at all", () => {
  for (const species of SUPPORTED_SPECIES) {
    const path = species.resourcePath;
    assert.ok(typeof path === "string" && path.length > 0, `${species.id} has a path`);
    assert.ok(path.startsWith("/hunting/species/"), `${species.id}: ${path}`);
    // Never a bare directory, and never an id or a canonical prefix leaking into a URL.
    assert.notEqual(path, "/hunting/species/", species.id);
    assert.ok(!path.includes("species:"), `${species.id}: a canonical id is not a path`);
    assert.ok(!/undefined|null/.test(path), `${species.id}: ${path}`);
  }
});
