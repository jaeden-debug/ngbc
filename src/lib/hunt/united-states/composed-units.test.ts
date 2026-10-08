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
        /*
         * Every member's name appears in the quote it came from, so a list
         * cannot drift from the sentence that justifies it — checked against
         * the AUTHORITY's spelling where it differs from the Bureau's.
         *
         * Kentucky's regulation names "McClean" and "Elliot" for McLean and
         * Elliott. This check caught the mismatch when the member carried only
         * the Bureau's name, which is why the member now carries both: the
         * right fix was to declare the reconciliation, not to loosen the check.
         */
        const asTheAuthorityPrintsIt = member.regulationSpelling ?? member.baseName;
        assert.ok(unit.quote.includes(asTheAuthorityPrintsIt),
          `${unit.unitId}: ${asTheAuthorityPrintsIt} is not named in the quoted enumeration`);
      }
    }
    const { covers, divisionsInJurisdiction, accountedFor, remainder } = jurisdiction.divisionAccounting;
    assert.equal(seen.size, accountedFor, `${jurisdiction.jurisdictionId}: the lists hold ${seen.size}, accounting says ${accountedFor}`);
    assert.ok(accountedFor <= divisionsInJurisdiction,
      `${jurisdiction.jurisdictionId}: the units hold more divisions than the jurisdiction has`);
    if (covers === "PARTITION") {
      /* Every division must belong somewhere, so a difference the remainder
         does not explain is a defect in our reading of the lists. */
      assert.equal(divisionsInJurisdiction - accountedFor, remainder.length,
        `${jurisdiction.jurisdictionId}: the remainder does not explain the difference`);
    } else {
      /* The units cover part of the jurisdiction by the authority's own design.
         Demanding an explanation for every other division would push someone to
         invent a unit for ground the authority left outside them. */
      assert.deepEqual([...remainder], [],
        `${jurisdiction.jurisdictionId}: a subset declares no remainder; the uncovered divisions are outside the units, not missing`);
    }
  }
});

test("the remainder IS the ground the unresolvable units reach, not an unexplained gap", () => {
  /*
   * The cross-check between two independently written fields. If a county falls
   * out of every list for some other reason, this fails rather than letting the
   * accounting look tidy.
   */
  for (const jurisdiction of COMPOSED_UNITS) {
    if (jurisdiction.divisionAccounting.covers !== "PARTITION") continue;
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
    membershipConflicts: [],
    unresolved: [{
      officialName: "Game Zone 8",
      because: "Defined by a traverse that runs through Overlap county.",
      wouldRequire: "Derived geometry. Not built.",
      reachesInto: [{ baseName: "Overlap", geoid: "99001" }],
    }],
    divisionAccounting: {
      covers: "PARTITION",
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

test("a conflict the authority itself states outranks a list that holds the division", () => {
  /*
   * §41B, where the authority contradicts itself: find the controlling
   * instrument, never pick the source that is easier to read. Georgia's bear
   * information page lists 38 northern-zone counties and omits Walton; the
   * Division's OWN zone map labels Walton. Both are the authority's
   * publications. Answering from either would be choosing.
   *
   * The ordering matters here for real, unlike the unresolved-unit case: a
   * conflict is checked before the member lists, so a division that a list DOES
   * hold still answers as conflicted.
   */
  const walton = composedUnitAt("jurisdiction:us-ga", "13297");
  assert.equal(walton?.state, "MEMBERSHIP_IN_CONFLICT");
  if (walton?.state !== "MEMBERSHIP_IN_CONFLICT") return;
  assert.equal(walton.conflict.member.baseName, "Walton");
  assert.match(walton.conflict.because, /labels Walton/);
  assert.match(walton.conflict.settledBy, /391-4-2-\.22/);
  /* And the reason it is unread is recorded as a technical refusal, not as the
     rule being unavailable (§44, a blocked reader is not a legal finding). */
  assert.match(walton.conflict.settledBy, /403/);
});

test("Georgia's bear zones are a subset of the state, so a county in none is an answer", () => {
  /*
   * The distinction the accounting now carries. South Carolina's game zones
   * partition the state, so a county in none would be a defect in our reading.
   * Georgia's bear zones hold 50 of 159 counties by the authority's own design,
   * and there is simply no bear zone in the other 109 — reporting those as
   * unaccounted for would turn the authority's structure into a gap in ours.
   */
  const georgia = composedUnitsFor("jurisdiction:us-ga");
  assert.equal(georgia?.divisionAccounting.covers, "SUBSET_OF_JURISDICTION");
  assert.equal(georgia?.divisionAccounting.divisionsInJurisdiction, 159);
  assert.equal(georgia?.divisionAccounting.accountedFor, 50);
  assert.deepEqual(georgia?.units.map((u) => u.members.length), [38, 4, 8]);
  /* Chatham is in no bear zone, and that is a real answer about bear. */
  assert.equal(composedUnitAt("jurisdiction:us-ga", "13051")?.state, "NOT_ACCOUNTED_FOR");
});

test("the authority's typo is quoted, not corrected", () => {
  /*
   * Georgia's central bear zone section reads "There are 4 counties in the
   * northern zone". The heading is Central and the four counties are not among
   * the northern 38, so the words are wrong — and they are the authority's
   * words. §41A: the original authority text is immutable. The discrepancy is
   * recorded beside it instead.
   */
  const central = composedUnitsFor("jurisdiction:us-ga")?.units.find((u) => u.officialName === "Central bear zone");
  assert.match(central?.quote ?? "", /There are 4 counties in the northern zone/);
  assert.match(central?.speciesVariations?.[0].note ?? "", /quoted\s+exactly as published rather than corrected/);
});

test("Kentucky's four zones partition its 120 counties, and the two reconciled spellings are declared", () => {
  /*
   * The cleanest composition in the corpus: 301 KAR 2:172 § 6 enumerates every
   * Kentucky county into one of four deer zones — 68 + 24 + 13 + 15 = 120 —
   * which is exactly the Bureau's county count, so the partition is complete
   * and checkable rather than merely stated.
   */
  const ky = composedUnitsFor("jurisdiction:us-ky");
  assert.ok(ky);
  assert.equal(ky.divisionAccounting.covers, "PARTITION");
  assert.equal(ky.divisionAccounting.divisionsInJurisdiction, 120);
  assert.equal(ky.divisionAccounting.accountedFor, 120);
  assert.deepEqual(ky.units.map((u) => u.members.length), [68, 24, 13, 15]);
  assert.deepEqual([...ky.divisionAccounting.remainder], []);

  /*
   * The regulation misspells two counties, and the reconciliation is declared
   * on the member rather than applied silently. Admissible only because each
   * spelling has exactly one referent among the 120.
   */
  const reconciled = ky.units.flatMap((u) => u.members).filter((m) => m.regulationSpelling);
  assert.deepEqual(
    reconciled.map((m) => [m.regulationSpelling, m.baseName, m.geoid]).sort(),
    [["Elliot", "Elliott", "21063"], ["McClean", "McLean", "21149"]],
  );

  /*
   * And every county resolves: a point in any Kentucky county reaches a zone.
   * The zones below are read from the regulation, not guessed — my first
   * attempt put Elliott in Zone 3 from memory and the data corrected it to
   * Zone 2, which is the right way round for a test over authority data.
   */
  for (const [geoid, zone] of [["21149", "Zone 1"], ["21063", "Zone 2"], ["21013", "Zone 4"]] as const) {
    const lookup = composedUnitAt("jurisdiction:us-ky", geoid);
    assert.equal(lookup?.state, "IN_UNIT", geoid);
    assert.equal(lookup?.state === "IN_UNIT" ? lookup.unit.officialName : undefined, zone, geoid);
  }
});

test("which version of Kentucky's section 6 is in force was settled by markup, not by reading", () => {
  /*
   * The page carries the engrossed regulation and, below it, an "ALTERNATE VIEW
   * — this is how this document appeared before it was engrossed". The two
   * disagree: one Zone 1 has 68 counties and the other 51, both partitioning
   * the state. A summarising read of the same page reported the 51-county list
   * as "the amended wording", which is backwards.
   *
   * The markup settles it — the 68-county list sits inside <ins data-added>
   * and the 51-county list inside <del data-removed>. That is recorded in the
   * accounting so the next reader does not have to re-derive it, and so the
   * difference from North Carolina is visible: a redline is unusable when its
   * markup is LOST, not inherently.
   */
  const ky = composedUnitsFor("jurisdiction:us-ky")!;
  assert.match(ky.divisionAccounting.measuredFrom, /ins data-added/);
  assert.match(ky.divisionAccounting.measuredFrom, /del data-removed/);
  assert.match(ky.divisionAccounting.measuredFrom, /reported the DELETED list as the amended wording/);
  /* And the effective date is the regulation's own last HISTORY entry. */
  assert.match(ky.effectiveAs, /eff\. 3-3-2026/);
});
