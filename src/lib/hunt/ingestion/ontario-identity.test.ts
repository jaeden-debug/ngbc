import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createOntarioWmuSource } from "./ontario-wmu.ts";

/**
 * Generalising promotion moved canonical identity out of SQL and into each
 * adapter. For Ontario that is only safe if the adapter produces exactly the ids
 * and names already published, because every certified rule, share snapshot and
 * parity record keys on them. A difference of one character would fork the
 * registry on the next ingest.
 *
 * The fixture is the live `management_zones` rows for Ontario, recorded rather
 * than re-derived.
 */
const fixture = JSON.parse(
  readFileSync(new URL("../../../../fixtures/hunt/ontario-registry-identity.json", import.meta.url), "utf8"),
) as { zones: Array<{ officialIdentifier: string; canonicalId: string; officialName: string }> };

test("the Ontario adapter reproduces every published Ontario canonical id and name", () => {
  const source = createOntarioWmuSource();
  assert.equal(fixture.zones.length, 151);
  const mismatches = fixture.zones.filter(({ officialIdentifier, canonicalId, officialName }) =>
    source.canonicalZoneId(officialIdentifier) !== canonicalId || source.officialName(officialIdentifier) !== officialName);
  assert.deepEqual(mismatches, []);
});

test("every recorded Ontario id satisfies the staging constraint the migration adds", () => {
  for (const { canonicalId } of fixture.zones) {
    assert.match(canonicalId, /^management_zone:[a-z0-9][a-z0-9-]*$/);
  }
  assert.equal(new Set(fixture.zones.map(({ canonicalId }) => canonicalId)).size, 151);
});
