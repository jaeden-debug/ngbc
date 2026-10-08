import assert from "node:assert/strict";
import test from "node:test";
import {
  COMPOSED_UNITS, composedUnitAt, composedUnitsFor, lookupIn, unitsAndUnresolvedOverlap,
  type JurisdictionComposedUnits,
} from "./composed-units.ts";

/**
 * Units the authority composes from divisions it names.
 *
 * The checks that matter here are not the lookup — they are the ones that would
 * catch a membership list quietly losing, duplicating or inventing a county,
 * and the one that stops an unresolvable sibling from being answered with the
 * zone that happens to be encoded.
 */

test("every member list is internally consistent and its accounting adds up", () => {
  assert.ok(COMPOSED_UNITS.length > 0, "nothing is declared, so this measures nothing");
  for (const jurisdiction of COMPOSED_UNITS) {
    const seen = new Map<string, string>();
    for (const unit of jurisdiction.units) {
      assert.ok(unit.quote.length > 40, `${unit.unitId}: the enumeration must be the authority's own words`);
      assert.ok(unit.members.length > 0, `${unit.unitId}: an empty unit is not a composition`);
      for (const member of unit.members) {
        assert.match(member.geoid, /^\d{5}$/, `${unit.unitId}: ${member.baseName} needs a five-digit FIPS`);
        const already = seen.get(member.geoid);
        assert.equal(already, undefined,
          `${member.baseName} (${member.geoid}) is in both ${already} and ${unit.unitId}; a division belongs to one unit`);
        seen.set(member.geoid, unit.unitId);
        /* Every member's own name appears in the quote it came from, so a list
           cannot drift from the sentence that justifies it. */
        assert.ok(unit.quote.includes(member.baseName),
          `${unit.unitId}: ${member.baseName} is not named in the quoted enumeration`);
      }
    }
    const { divisionsInJurisdiction, accountedFor, remainder } = jurisdiction.divisionAccounting;
    assert.equal(seen.size, accountedFor, `${jurisdiction.jurisdictionId}: the lists hold ${seen.size}, accounting says ${accountedFor}`);
    assert.equal(divisionsInJurisdiction - accountedFor, remainder.length,
      `${jurisdiction.jurisdictionId}: the remainder does not explain the difference`);
  }
});

test("the remainder IS the ground the unresolvable units reach, not an unexplained gap", () => {
  /*
   * The cross-check between two independently written fields. If a county falls
   * out of every list for some other reason, this fails rather than letting the
   * accounting look tidy.
   */
  for (const jurisdiction of COMPOSED_UNITS) {
    const reached = new Set(jurisdiction.unresolved.flatMap((unit) => unit.reachesInto.map((m) => m.baseName)));
    assert.deepEqual([...jurisdiction.divisionAccounting.remainder].sort(), [...reached].sort(),
      `${jurisdiction.jurisdictionId}: the unaccounted divisions and the unresolvable units' ground must be the same set`);
  }
});

test("South Carolina composes Zones 2 to 4 from its own county lists", () => {
  const sc = composedUnitsFor("jurisdiction:us-sc");
  assert.ok(sc);
  assert.equal(sc.officialTerm, "game zone");
  assert.equal(sc.units.length, 3);
  assert.deepEqual(sc.units.map((u) => u.members.length), [15, 15, 13]);
  assert.equal(sc.divisionAccounting.divisionsInJurisdiction, 46);
  assert.equal(sc.divisionAccounting.accountedFor, 43);

  /* Anderson is in Zone 2 by the guide's own sentence. */
  const anderson = composedUnitAt("jurisdiction:us-sc", "45007");
  assert.equal(anderson?.state, "IN_UNIT");
  assert.equal(anderson?.state === "IN_UNIT" ? anderson.unit.officialName : undefined, "Game Zone 2");
});

test("a county a traverse-defined zone crosses is given NO zone, not the encoded one", () => {
  /*
   * THE CHECK THIS FILE EXISTS FOR. Oconee, Pickens and Greenville are crossed
   * by Game Zone 1, which is a railway and highway traverse. They appear in no
   * county list. Answering them with Zone 2 — the neighbouring zone we do have
   * — would put a hunter in a zone the authority did not, and it would look
   * entirely normal.
   */
  for (const geoid of ["45073", "45077", "45045"]) {
    const lookup = composedUnitAt("jurisdiction:us-sc", geoid);
    assert.equal(lookup?.state, "IN_AN_UNRESOLVED_UNIT", `${geoid} must not be given a zone`);
    if (lookup?.state !== "IN_AN_UNRESOLVED_UNIT") continue;
    assert.equal(lookup.unresolved.officialName, "Game Zone 1");
    assert.match(lookup.unresolved.because, /north of the main line of the Norfolk Southern Railroad/);
    assert.match(lookup.unresolved.wouldRequire, /Not built/);
  }
});

test("species-specific membership is recorded beside the unit, never merged into it", () => {
  /*
   * South Carolina's bear seasons state Zone 2 and Zone 4 with narrower,
   * different county sets. Merging either into the general membership would
   * silently change which zone a county is in for every other species.
   */
  const sc = composedUnitsFor("jurisdiction:us-sc");
  const zone2 = sc?.units.find((u) => u.officialName === "Game Zone 2");
  assert.ok(zone2?.speciesVariations?.length, "the bear variation is recorded");
  assert.match(zone2.speciesVariations[0].note, /Private land only/);
  /* And the general list is unchanged by it: Greenville is not a member. */
  assert.equal(zone2.members.some((m) => m.baseName === "Greenville"), false);
});

test("a jurisdiction that composes nothing is undefined, not an empty answer", () => {
  assert.equal(composedUnitsFor("jurisdiction:us-va"), undefined, "Virginia's locality IS the unit");
  assert.equal(composedUnitAt("jurisdiction:us-va", "51087"), undefined);
  assert.equal(composedUnitsFor(undefined), undefined);
});

test("a division in a composing jurisdiction that no list holds is a finding", () => {
  /* A county of another state, asked of South Carolina: not in a unit, not
     reached by Zone 1, so the honest answer is that the lists do not account
     for it — never "no rules here". */
  assert.equal(composedUnitAt("jurisdiction:us-sc", "13001")?.state, "NOT_ACCOUNTED_FOR");
});

test("an unresolved unit outranks a member list, proved on an overlap the real data does not have", () => {
  /*
   * THE RULE, TESTED RATHER THAN ITS CURRENT INSTANCE. Flipping the lookup order
   * left every test in this file green, because no South Carolina county is both
   * listed in a zone and crossed by Game Zone 1 — so a test over the real data
   * could not fail, and the check I cared about most was measuring nothing.
   *
   * Here the overlap is constructed. A county listed in Zone 9 is ALSO crossed
   * by an unresolved zone's line, and the answer must be the unresolved one:
   * otherwise a hunter is placed in a zone the authority did not place them in,
   * and it looks entirely normal.
   */
  const overlapping: JurisdictionComposedUnits = {
    jurisdictionId: "jurisdiction:us-test",
    officialTerm: "game zone",
    authority: "Test authority",
    instrument: "Test instrument",
    url: "https://example.invalid/",
    effectiveAs: "test",
    retrievedAt: "2026-10-07",
    sourceId: "source:test" as JurisdictionComposedUnits["sourceId"],
    units: [{
      unitId: "test-zone-9",
      officialName: "Game Zone 9",
      quote: "Includes all lands of Overlap county, which another zone's line also crosses.",
      section: "test",
      members: [{ baseName: "Overlap", geoid: "99001" }],
    }],
    unresolved: [{
      officialName: "Game Zone 8",
      because: "Defined by a traverse that runs through Overlap county.",
      wouldRequire: "Derived geometry. Not built.",
      reachesInto: [{ baseName: "Overlap", geoid: "99001" }],
    }],
    divisionAccounting: {
      divisionsInJurisdiction: 1, accountedFor: 1, remainder: [],
      measuredFrom: "constructed for this test", measuredOn: "2026-10-07",
    },
  };
  assert.equal(lookupIn(overlapping, "99001").state, "IN_AN_UNRESOLVED_UNIT",
    "a listed county crossed by an unresolved zone must not be given the listed zone");
  assert.deepEqual(unitsAndUnresolvedOverlap(overlapping), ["Overlap"]);
});

test("no declared jurisdiction has that overlap today, so the order is not silently load-bearing", () => {
  /*
   * The companion to the test above. The rule is proved on a constructed case;
   * here the real data is measured, so the next person knows the order has no
   * effect on it yet rather than assuming it is being exercised.
   */
  for (const jurisdiction of COMPOSED_UNITS) {
    assert.deepEqual(unitsAndUnresolvedOverlap(jurisdiction), [],
      `${jurisdiction.jurisdictionId}: a division is both listed and crossed; that is legitimate, but say so deliberately`);
  }
});
