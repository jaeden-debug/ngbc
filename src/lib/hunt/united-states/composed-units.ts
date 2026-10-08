/**
 * Regulatory units the authority COMPOSES from administrative divisions it
 * names — "Includes all lands of Abbeville, Anderson, … counties."
 *
 * The second ADMINISTRATIVE_COMPOSITION shape, and it is a different fact from
 * the first (§41B). Virginia's locality IS the unit; South Carolina's Game Zone
 * 2 is a unit BUILT from fifteen named counties. One resolver serves both: the
 * Census Bureau places the point in its county, and this decides which named
 * unit, if any, lists that county.
 *
 * WHAT MAKES THIS COMPOSITION RATHER THAN INFERENCE. The member list is the
 * authority's own enumeration, quoted. Nothing here derives membership from a
 * map colour, a shared border, a name or a guess — a unit whose membership is
 * published only as map shading is NOT composable and is recorded as
 * unresolved, which is Georgia's deer "GREEN" group.
 *
 * AND A SIBLING THAT IS NOT COMPOSABLE DOES NOT STOP THE ONES THAT ARE (§8,
 * fidelity in both directions, worked example). South Carolina writes Zones 2,
 * 3 and 4 as county lists and Zone 1 as a traverse — "All properties north of
 * the main line of the Norfolk Southern Railroad …" — so Zones 2 to 4 are
 * encoded, Zone 1 is not, and the three counties Zone 1 crosses resolve to
 * NEITHER rather than being handed the zone that happens to be encoded.
 * Throwing away 43 counties because 3 are unresolved is the understating error;
 * giving those 3 a zone the authority did not put them in is the overstating
 * one.
 */

import type { CanonicalId } from "../../content-contract/index.ts";

export interface ComposedUnitMember {
  /** The division's name without its type word, as the regulation prints it. */
  baseName: string;
  /** The Bureau's five-digit FIPS, verified to be the one county of that name in this state. */
  geoid: string;
}

export interface ComposedUnitDeclaration {
  unitId: string;
  /** The authority's own name for the unit. */
  officialName: string;
  /** The authority's own enumeration, verbatim. */
  quote: string;
  section: string;
  members: readonly ComposedUnitMember[];
  /**
   * Where the authority states a different membership for one species, named
   * rather than merged — a species-specific set is its own fact (§8).
   */
  speciesVariations?: readonly { note: string; section: string }[];
}

/** A unit the authority publishes that North Ground deliberately cannot resolve. */
export interface UnresolvedUnitDeclaration {
  officialName: string;
  /** Why not: the authority's own words where they are the reason. */
  because: string;
  /** What would be needed. Never a date, never a promise. */
  wouldRequire: string;
  /** Divisions this unit is known to reach into, so they are never given another unit. */
  reachesInto: readonly ComposedUnitMember[];
}

export interface JurisdictionComposedUnits {
  jurisdictionId: string;
  /** The authority's own term for these units: "game zone", "bear zone". */
  officialTerm: string;
  authority: string;
  instrument: string;
  url: string;
  effectiveAs: string;
  retrievedAt: string;
  sourceId: CanonicalId<"source">;
  units: readonly ComposedUnitDeclaration[];
  unresolved: readonly UnresolvedUnitDeclaration[];
  /**
   * The measured control: how many divisions the jurisdiction has, how many the
   * units account for, and the remainder. A membership list that silently loses
   * or duplicates a county shows up here.
   */
  divisionAccounting: {
    divisionsInJurisdiction: number;
    accountedFor: number;
    remainder: readonly string[];
    measuredFrom: string;
    measuredOn: string;
  };
}

export const COMPOSED_UNITS: readonly JurisdictionComposedUnits[] = [
  {
    jurisdictionId: "jurisdiction:us-sc",
    officialTerm: "game zone",
    authority: "South Carolina Department of Natural Resources",
    instrument: "2026-2027 South Carolina Hunting & Fishing Laws and Regulations Guide",
    url: "https://www.dnr.sc.gov/regulations.html",
    effectiveAs: "2026-2027 guide",
    retrievedAt: "2026-10-07",
    sourceId: "source:us-sc-dnr-regulations-guide" as CanonicalId<"source">,
    units: [
      {
        unitId: "us-sc-game-zone-2",
        officialName: "Game Zone 2",
        quote:
          "Includes all lands of Abbeville, Anderson, Cherokee, Chester, Edgefield, Fairfield, Greenwood, Lancaster, " +
          "Laurens, McCormick, Newberry, Saluda, Spartanburg, Union and York counties.",
        section: "Game zones",
        members: [
          { baseName: "Abbeville", geoid: "45001" }, { baseName: "Anderson", geoid: "45007" },
          { baseName: "Cherokee", geoid: "45021" }, { baseName: "Chester", geoid: "45023" },
          { baseName: "Edgefield", geoid: "45037" }, { baseName: "Fairfield", geoid: "45039" },
          { baseName: "Greenwood", geoid: "45047" }, { baseName: "Lancaster", geoid: "45057" },
          { baseName: "Laurens", geoid: "45059" }, { baseName: "McCormick", geoid: "45065" },
          { baseName: "Newberry", geoid: "45071" }, { baseName: "Saluda", geoid: "45081" },
          { baseName: "Spartanburg", geoid: "45083" }, { baseName: "Union", geoid: "45087" },
          { baseName: "York", geoid: "45091" },
        ],
        speciesVariations: [{
          note: "For bear, the guide states Game Zone 2 as “Private land only in Greenville, Oconee, and Pickens " +
            "counties south of Game Zone 1 and all of Anderson and Spartanburg counties” — a different and " +
            "narrower set, which also depends on Game Zone 1's line and on land ownership. It is recorded and not merged " +
            "into the general membership above.",
          section: "Bear seasons",
        }],
      },
      {
        unitId: "us-sc-game-zone-3",
        officialName: "Game Zone 3",
        quote:
          "Includes all lands of Aiken, Allendale, Bamberg, Barnwell, Beaufort, Berkeley, Calhoun, Charleston, " +
          "Colleton, Dorchester, Hampton, Jasper, Lexington, Orangeburg and Richland counties.",
        section: "Game zones",
        members: [
          { baseName: "Aiken", geoid: "45003" }, { baseName: "Allendale", geoid: "45005" },
          { baseName: "Bamberg", geoid: "45009" }, { baseName: "Barnwell", geoid: "45011" },
          { baseName: "Beaufort", geoid: "45013" }, { baseName: "Berkeley", geoid: "45015" },
          { baseName: "Calhoun", geoid: "45017" }, { baseName: "Charleston", geoid: "45019" },
          { baseName: "Colleton", geoid: "45029" }, { baseName: "Dorchester", geoid: "45035" },
          { baseName: "Hampton", geoid: "45049" }, { baseName: "Jasper", geoid: "45053" },
          { baseName: "Lexington", geoid: "45063" }, { baseName: "Orangeburg", geoid: "45075" },
          { baseName: "Richland", geoid: "45079" },
        ],
      },
      {
        unitId: "us-sc-game-zone-4",
        officialName: "Game Zone 4",
        quote:
          "Includes all lands of Chesterfield, Clarendon, Darlington, Dillon, Florence, Georgetown, Horry, Kershaw, " +
          "Lee, Marion, Marlboro, Sumter and Williamsburg counties.",
        section: "Game zones",
        members: [
          { baseName: "Chesterfield", geoid: "45025" }, { baseName: "Clarendon", geoid: "45027" },
          { baseName: "Darlington", geoid: "45031" }, { baseName: "Dillon", geoid: "45033" },
          { baseName: "Florence", geoid: "45041" }, { baseName: "Georgetown", geoid: "45043" },
          { baseName: "Horry", geoid: "45051" }, { baseName: "Kershaw", geoid: "45055" },
          { baseName: "Lee", geoid: "45061" }, { baseName: "Marion", geoid: "45067" },
          { baseName: "Marlboro", geoid: "45069" }, { baseName: "Sumter", geoid: "45085" },
          { baseName: "Williamsburg", geoid: "45089" },
        ],
        speciesVariations: [{
          note: "For bear, the guide states Game Zone 4 as “Florence, Georgetown, Horry, Marion, and Williamsburg " +
            "counties only” — five of the thirteen. Recorded, not merged.",
          section: "Bear seasons",
        }],
      },
    ],
    unresolved: [
      {
        officialName: "Game Zone 1",
        because:
          "The authority defines it by a traverse rather than by counties: “All properties north of the main line of " +
          "the Norfolk Southern Railroad from the Georgia State line to South Carolina Hwy 183 in Westminster, then north " +
          "of SC Hwy 183 …”",
        wouldRequire:
          "DERIVED_FROM_DEFINITION geometry over openly licensed railway and highway centrelines. Not built.",
        reachesInto: [
          { baseName: "Oconee", geoid: "45073" },
          { baseName: "Pickens", geoid: "45077" },
          { baseName: "Greenville", geoid: "45045" },
        ],
      },
    ],
    divisionAccounting: {
      divisionsInJurisdiction: 46,
      accountedFor: 43,
      remainder: ["Greenville", "Oconee", "Pickens"],
      measuredFrom:
        "TIGERweb State_County layer 1, STATE='45' — 46 counties, and every one of the 43 names the three zones list " +
        "resolves to exactly one of them, with no county listed twice. The remainder is exactly the three counties Game " +
        "Zone 1's traverse crosses, which is the authority's own structure rather than a gap in the lists.",
      measuredOn: "2026-10-07",
    },
  },
];

export function composedUnitsFor(jurisdictionId: string | undefined): JurisdictionComposedUnits | undefined {
  return jurisdictionId ? COMPOSED_UNITS.find((entry) => entry.jurisdictionId === jurisdictionId) : undefined;
}

/**
 * Which composed unit, if any, lists this division.
 *
 * Three answers, and the middle one is the one that matters: the division is in
 * a named unit; the division is reached by a unit North Ground cannot resolve,
 * so NO unit may be given for it; or the authority's lists simply do not
 * account for it, which is a finding rather than an absence of rules.
 */
export type ComposedUnitLookup =
  | { state: "IN_UNIT"; unit: ComposedUnitDeclaration }
  | { state: "IN_AN_UNRESOLVED_UNIT"; unresolved: UnresolvedUnitDeclaration }
  | { state: "NOT_ACCOUNTED_FOR" };

export function composedUnitAt(jurisdictionId: string, geoid: string): ComposedUnitLookup | undefined {
  const declared = composedUnitsFor(jurisdictionId);
  return declared ? lookupIn(declared, geoid) : undefined;
}

/**
 * The lookup itself, over a declaration passed in.
 *
 * Separated from `composedUnitAt` so the RULE can be tested rather than only
 * its current instance. An unresolved unit is checked FIRST, and with today's
 * South Carolina data that order is unobservable — no county is both listed and
 * crossed, so flipping the order changed nothing and a test over the real data
 * could not fail. The order is still the rule, because the overlap is
 * legitimate and will arrive: an authority can list a county in one zone and
 * run another zone's line through it, and then answering with the listed zone
 * would put a hunter in a zone the authority did not.
 *
 * `unitsAndUnresolvedAreDisjoint` asserts the absence of that overlap as a
 * measured fact about the data, so nobody reads the order as load-bearing today
 * — and this function proves it is load-bearing when the overlap exists.
 */
export function lookupIn(declared: JurisdictionComposedUnits, geoid: string): ComposedUnitLookup {
  const unresolved = declared.unresolved.find((unit) => unit.reachesInto.some((member) => member.geoid === geoid));
  if (unresolved) return { state: "IN_AN_UNRESOLVED_UNIT", unresolved };
  const unit = declared.units.find((candidate) => candidate.members.some((member) => member.geoid === geoid));
  return unit ? { state: "IN_UNIT", unit } : { state: "NOT_ACCOUNTED_FOR" };
}

/**
 * Whether any division is BOTH in a member list and reached by an unresolved
 * unit. Returns the overlapping divisions, so a caller can state them rather
 * than only know they exist.
 */
export function unitsAndUnresolvedOverlap(declared: JurisdictionComposedUnits): string[] {
  const reached = new Set(declared.unresolved.flatMap((unit) => unit.reachesInto.map((member) => member.geoid)));
  return declared.units
    .flatMap((unit) => unit.members)
    .filter((member) => reached.has(member.geoid))
    .map((member) => member.baseName);
}
