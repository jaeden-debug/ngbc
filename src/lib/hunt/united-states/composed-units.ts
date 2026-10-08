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
  /** The division's name without its type word, as the BUREAU prints it. Resolves the geography. */
  baseName: string;
  /** The Bureau's five-digit FIPS, verified to be the one county of that name in this state. */
  geoid: string;
  /**
   * The AUTHORITY's spelling, where it differs from the Bureau's.
   *
   * DECLARED, NEVER SILENT. Kentucky's 301 KAR 2:172 § 6 names "McClean" and
   * "Elliot" for the counties the Bureau calls McLean and Elliott. Normalising
   * those quietly would make the member list drift from the sentence that
   * justifies it — which the enumeration check below catches, and which is why
   * this field exists rather than the check being loosened.
   *
   * A reconciliation is only admissible where the authority's spelling has
   * exactly ONE referent among the jurisdiction's divisions. Both of
   * Kentucky's were measured that way: case-insensitive edit distance 1 over
   * all 120 counties returns McLean and Elliott respectively and nothing else.
   * (A case-SENSITIVE check returned zero candidates for "McClean" and would
   * have read as "no county matches" — a short checker giving a misleading
   * zero, again.)
   */
  regulationSpelling?: string;
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

/**
 * A division whose membership the AUTHORITY ITSELF states inconsistently.
 *
 * Not a gap in our reading and not a unit we cannot resolve: the authority's own
 * text and its own map disagree about where this division belongs. §41A's rule
 * that the source model wins over our schema is why this exists as its own
 * state — Georgia's bear-info page lists 38 northern-zone counties and omits
 * Walton while the Division's own zone map labels Walton, and neither "in" nor
 * "not accounted for" is true of it.
 *
 * Resolving it means reading the controlling rule, not choosing the source that
 * is easier to read (§41B, "where the authority contradicts itself, find the
 * controlling instrument").
 */
export interface MembershipConflict {
  member: ComposedUnitMember;
  /** The units the division is claimed for, or claimed not to be in. */
  between: readonly string[];
  /** What each source says, in its own terms. */
  because: string;
  /** The instrument that would settle it. Never a date, never a promise. */
  settledBy: string;
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
  /** Divisions the authority itself places inconsistently. Empty is the normal case. */
  membershipConflicts: readonly MembershipConflict[];
  /**
   * The measured control: how many divisions the jurisdiction has, how many the
   * units account for, and the remainder. A membership list that silently loses
   * or duplicates a county shows up here.
   */
  divisionAccounting: {
    /**
     * Whether the units are meant to cover the whole jurisdiction.
     *
     * PARTITION: every division belongs to some unit, so one that belongs to
     * none is a DEFECT in our reading — South Carolina's game zones, where the
     * only gap is the ground a traverse-defined zone crosses.
     *
     * SUBSET_OF_JURISDICTION: the units cover part of the jurisdiction by the
     * authority's own design, so a division in none of them is a real answer —
     * Georgia's bear zones hold 50 of 159 counties and there is simply no bear
     * zone in the other 109. Reporting those as unaccounted for would turn the
     * authority's structure into a gap in ours, and demanding they be explained
     * would push someone to invent a unit for them.
     */
    covers: "PARTITION" | "SUBSET_OF_JURISDICTION";
    divisionsInJurisdiction: number;
    accountedFor: number;
    /** For a PARTITION, the divisions no unit holds and why. Empty for a subset. */
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
    membershipConflicts: [],
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
      covers: "PARTITION",
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
  {
    jurisdictionId: "jurisdiction:us-ga",
    officialTerm: "bear zone",
    authority: "Georgia Department of Natural Resources, Wildlife Resources Division",
    instrument: "Georgia DNR Wildlife Resources Division, bear information page",
    url: "https://georgiawildlife.com/bear-info",
    effectiveAs: "as published 2026-10-07",
    retrievedAt: "2026-10-07",
    sourceId: "source:us-ga-wrd-bear-info" as CanonicalId<"source">,
    units: [
      {
        unitId: "us-ga-bear-northern-zone",
        officialName: "Northern bear zone",
        quote:
          "There are 38 counties in the northern zone: Banks, Barrow, Bartow, Carroll, Catoosa, Chattooga, Cherokee, " +
          "Cobb, Dade, Dawson, DeKalb, Douglas, Fannin, Floyd, Forsyth, Franklin, Fulton, Gilmer, Gordon, Gwinnett, " +
          "Habersham, Hall, Haralson, Hart, Jackson, Lumpkin, Madison, Murray, Paulding, Pickens, Polk, Rabun, " +
          "Stephens, Towns, Union, Walker, White, Whitfield.",
        section: "Bear zones",
        members: [
          { baseName: "Banks", geoid: "13011" }, { baseName: "Barrow", geoid: "13013" },
          { baseName: "Bartow", geoid: "13015" }, { baseName: "Carroll", geoid: "13045" },
          { baseName: "Catoosa", geoid: "13047" }, { baseName: "Chattooga", geoid: "13055" },
          { baseName: "Cherokee", geoid: "13057" }, { baseName: "Cobb", geoid: "13067" },
          { baseName: "Dade", geoid: "13083" }, { baseName: "Dawson", geoid: "13085" },
          { baseName: "DeKalb", geoid: "13089" }, { baseName: "Douglas", geoid: "13097" },
          { baseName: "Fannin", geoid: "13111" }, { baseName: "Floyd", geoid: "13115" },
          { baseName: "Forsyth", geoid: "13117" }, { baseName: "Franklin", geoid: "13119" },
          { baseName: "Fulton", geoid: "13121" }, { baseName: "Gilmer", geoid: "13123" },
          { baseName: "Gordon", geoid: "13129" }, { baseName: "Gwinnett", geoid: "13135" },
          { baseName: "Habersham", geoid: "13137" }, { baseName: "Hall", geoid: "13139" },
          { baseName: "Haralson", geoid: "13143" }, { baseName: "Hart", geoid: "13147" },
          { baseName: "Jackson", geoid: "13157" }, { baseName: "Lumpkin", geoid: "13187" },
          { baseName: "Madison", geoid: "13195" }, { baseName: "Murray", geoid: "13213" },
          { baseName: "Paulding", geoid: "13223" }, { baseName: "Pickens", geoid: "13227" },
          { baseName: "Polk", geoid: "13233" }, { baseName: "Rabun", geoid: "13241" },
          { baseName: "Stephens", geoid: "13257" }, { baseName: "Towns", geoid: "13281" },
          { baseName: "Union", geoid: "13291" }, { baseName: "Walker", geoid: "13295" },
          { baseName: "White", geoid: "13311" }, { baseName: "Whitfield", geoid: "13313" },
        ],
      },
      {
        unitId: "us-ga-bear-central-zone",
        officialName: "Central bear zone",
        quote: "There are 4 counties in the northern zone: Bibb, Bleckley, Houston, Twiggs.",
        section: "Bear zones \u2014 central",
        speciesVariations: [{
          note: "THE AUTHORITY'S OWN SENTENCE SAYS \u201cnorthern\u201d IN THE CENTRAL ZONE'S SECTION, and it is quoted " +
            "exactly as published rather than corrected. The four counties it names are not in the 38 the northern zone " +
            "lists, and the section heading is Central, so the words are a typo in the source. North Ground does not " +
            "rewrite an authority's text; the discrepancy is recorded and the membership is taken from the enumeration.",
          section: "Bear zones \u2014 central",
        }],
        members: [
          { baseName: "Bibb", geoid: "13021" }, { baseName: "Bleckley", geoid: "13023" },
          { baseName: "Houston", geoid: "13153" }, { baseName: "Twiggs", geoid: "13289" },
        ],
      },
      {
        unitId: "us-ga-bear-southern-zone",
        officialName: "Southern bear zone",
        quote: "There are 8 counties in the southern zone: Brantley, Camden, Charlton, Clinch, Echols, Lanier, Lowndes, Ware.",
        section: "Bear zones \u2014 southern",
        members: [
          { baseName: "Brantley", geoid: "13025" }, { baseName: "Camden", geoid: "13039" },
          { baseName: "Charlton", geoid: "13049" }, { baseName: "Clinch", geoid: "13065" },
          { baseName: "Echols", geoid: "13101" }, { baseName: "Lanier", geoid: "13173" },
          { baseName: "Lowndes", geoid: "13185" }, { baseName: "Ware", geoid: "13299" },
        ],
      },
    ],
    unresolved: [],
    membershipConflicts: [
      {
        member: { baseName: "Walton", geoid: "13297" },
        between: ["Northern bear zone", "no zone"],
        because:
          "The Division's bear information page lists 38 northern-zone counties and Walton is not among them, while the " +
          "Division's own \u201c2023-25 Georgia Bear Hunting Zones\u201d map (BearZones2023_25_B.pdf) labels Walton. Both " +
          "are the authority's own publications and they disagree.",
        settledBy:
          "The adopted text of Rule 391-4-2-.22 (Bear). Its title was reachable at rules.sos.ga.gov but the body was " +
          "refused (HTTP 403 to an ordinary client), so the controlling text is unread and the conflict stands. A map is " +
          "not the controlling instrument and neither is a web page, so neither source settles it.",
      },
    ],
    divisionAccounting: {
      covers: "SUBSET_OF_JURISDICTION",
      divisionsInJurisdiction: 159,
      accountedFor: 50,
      remainder: [],
      measuredFrom:
        "TIGERweb State_County layer 1, STATE='13' \u2014 159 counties, and all 50 names the three bear zones list " +
        "resolve to exactly one each, with none listed twice. The remainder is empty BY CONSTRUCTION rather than by " +
        "accounting: Georgia's bear zones are not a partition of the state, so the 109 counties in no bear zone are " +
        "outside the bear zones rather than unaccounted for, and Walton is carried as a conflict instead.",
      measuredOn: "2026-10-07",
    },
  },
  {
    jurisdictionId: "jurisdiction:us-ky",
    officialTerm: "deer hunting zone",
    authority: "Kentucky Department of Fish and Wildlife Resources (Fish and Wildlife Commission)",
    instrument: "301 KAR 2:172, Deer hunting seasons, zones, and requirements",
    url: "https://apps.legislature.ky.gov/law/kar/titles/301/002/172/",
    effectiveAs: "52 Ky.R. 479; eff. 3-3-2026, the last entry in the regulation's own HISTORY",
    retrievedAt: "2026-10-07",
    sourceId: "source:us-ky-kar-301-2-172" as CanonicalId<"source">,
    units: [
      {
        unitId: "us-ky-deer-zone-1",
        officialName: "Zone 1",
        quote:
          "Zone 1 shall consist of Adair, Anderson, Ballard, Boone, Boyd, Bracken, Breckinridge, Bullitt, Butler, Caldwell, Calloway, Campbell, Carlisle, Carroll, Carter, Christian, Crittenden, Daviess, Franklin, Fulton, Gallatin, Grant, Graves, Grayson, Green, Greenup, Hancock, Hardin, Harrison, Hart, Henderson, Henry, Hickman, Hopkins, Jefferson, Kenton, Larue, Lawrence, Lewis, Livingston, Logan, Lyon, Marion, Marshall, Mason, McClean, McCracken, Meade, Mercer, Metcalfe, Muhlenberg, Nelson, Ohio, Oldham, Owen, Pendleton, Robertson, Scott, Shelby, Spencer, Taylor, Todd, Trigg, Trimble, Union, Washington, Webster, and Woodford Counties.",
        section: "301 KAR 2:172 \u00a7 6(1)",
        members: [
          { baseName: "Adair", geoid: "21001" }, { baseName: "Anderson", geoid: "21005" },
          { baseName: "Ballard", geoid: "21007" }, { baseName: "Boone", geoid: "21015" },
          { baseName: "Boyd", geoid: "21019" }, { baseName: "Bracken", geoid: "21023" },
          { baseName: "Breckinridge", geoid: "21027" }, { baseName: "Bullitt", geoid: "21029" },
          { baseName: "Butler", geoid: "21031" }, { baseName: "Caldwell", geoid: "21033" },
          { baseName: "Calloway", geoid: "21035" }, { baseName: "Campbell", geoid: "21037" },
          { baseName: "Carlisle", geoid: "21039" }, { baseName: "Carroll", geoid: "21041" },
          { baseName: "Carter", geoid: "21043" }, { baseName: "Christian", geoid: "21047" },
          { baseName: "Crittenden", geoid: "21055" }, { baseName: "Daviess", geoid: "21059" },
          { baseName: "Franklin", geoid: "21073" }, { baseName: "Fulton", geoid: "21075" },
          { baseName: "Gallatin", geoid: "21077" }, { baseName: "Grant", geoid: "21081" },
          { baseName: "Graves", geoid: "21083" }, { baseName: "Grayson", geoid: "21085" },
          { baseName: "Green", geoid: "21087" }, { baseName: "Greenup", geoid: "21089" },
          { baseName: "Hancock", geoid: "21091" }, { baseName: "Hardin", geoid: "21093" },
          { baseName: "Harrison", geoid: "21097" }, { baseName: "Hart", geoid: "21099" },
          { baseName: "Henderson", geoid: "21101" }, { baseName: "Henry", geoid: "21103" },
          { baseName: "Hickman", geoid: "21105" }, { baseName: "Hopkins", geoid: "21107" },
          { baseName: "Jefferson", geoid: "21111" }, { baseName: "Kenton", geoid: "21117" },
          { baseName: "Larue", geoid: "21123" }, { baseName: "Lawrence", geoid: "21127" },
          { baseName: "Lewis", geoid: "21135" }, { baseName: "Livingston", geoid: "21139" },
          { baseName: "Logan", geoid: "21141" }, { baseName: "Lyon", geoid: "21143" },
          { baseName: "Marion", geoid: "21155" }, { baseName: "Marshall", geoid: "21157" },
          { baseName: "Mason", geoid: "21161" }, { baseName: "McLean", regulationSpelling: "McClean", geoid: "21149" },
          { baseName: "McCracken", geoid: "21145" }, { baseName: "Meade", geoid: "21163" },
          { baseName: "Mercer", geoid: "21167" }, { baseName: "Metcalfe", geoid: "21169" },
          { baseName: "Muhlenberg", geoid: "21177" }, { baseName: "Nelson", geoid: "21179" },
          { baseName: "Ohio", geoid: "21183" }, { baseName: "Oldham", geoid: "21185" },
          { baseName: "Owen", geoid: "21187" }, { baseName: "Pendleton", geoid: "21191" },
          { baseName: "Robertson", geoid: "21201" }, { baseName: "Scott", geoid: "21209" },
          { baseName: "Shelby", geoid: "21211" }, { baseName: "Spencer", geoid: "21215" },
          { baseName: "Taylor", geoid: "21217" }, { baseName: "Todd", geoid: "21219" },
          { baseName: "Trigg", geoid: "21221" }, { baseName: "Trimble", geoid: "21223" },
          { baseName: "Union", geoid: "21225" }, { baseName: "Washington", geoid: "21229" },
          { baseName: "Webster", geoid: "21233" }, { baseName: "Woodford", geoid: "21239" },
        ],
      },
      {
        unitId: "us-ky-deer-zone-2",
        officialName: "Zone 2",
        quote:
          "Zone 2 shall consist of Allen, Barren, Bath, Bourbon, Boyle, Casey, Clark, Cumberland, Edmonson, Elliot, Fayette, Fleming, Garrard, Jessamine, Johnson, Lincoln, Madison, Monroe, Montgomery, Morgan, Nicholas, Rowan, Simpson, and Warren Counties.",
        section: "301 KAR 2:172 \u00a7 6(2)",
        members: [
          { baseName: "Allen", geoid: "21003" }, { baseName: "Barren", geoid: "21009" },
          { baseName: "Bath", geoid: "21011" }, { baseName: "Bourbon", geoid: "21017" },
          { baseName: "Boyle", geoid: "21021" }, { baseName: "Casey", geoid: "21045" },
          { baseName: "Clark", geoid: "21049" }, { baseName: "Cumberland", geoid: "21057" },
          { baseName: "Edmonson", geoid: "21061" }, { baseName: "Elliott", regulationSpelling: "Elliot", geoid: "21063" },
          { baseName: "Fayette", geoid: "21067" }, { baseName: "Fleming", geoid: "21069" },
          { baseName: "Garrard", geoid: "21079" }, { baseName: "Jessamine", geoid: "21113" },
          { baseName: "Johnson", geoid: "21115" }, { baseName: "Lincoln", geoid: "21137" },
          { baseName: "Madison", geoid: "21151" }, { baseName: "Monroe", geoid: "21171" },
          { baseName: "Montgomery", geoid: "21173" }, { baseName: "Morgan", geoid: "21175" },
          { baseName: "Nicholas", geoid: "21181" }, { baseName: "Rowan", geoid: "21205" },
          { baseName: "Simpson", geoid: "21213" }, { baseName: "Warren", geoid: "21227" },
        ],
      },
      {
        unitId: "us-ky-deer-zone-3",
        officialName: "Zone 3",
        quote:
          "Zone 3 shall consist of Clinton, Estill, Jackson, Laurel, Martin, Menifee, Pike, Powell, Pulaski, Rockcastle, Russell, Wayne, and Wolfe Counties.",
        section: "301 KAR 2:172 \u00a7 6(3)",
        members: [
          { baseName: "Clinton", geoid: "21053" }, { baseName: "Estill", geoid: "21065" },
          { baseName: "Jackson", geoid: "21109" }, { baseName: "Laurel", geoid: "21125" },
          { baseName: "Martin", geoid: "21159" }, { baseName: "Menifee", geoid: "21165" },
          { baseName: "Pike", geoid: "21195" }, { baseName: "Powell", geoid: "21197" },
          { baseName: "Pulaski", geoid: "21199" }, { baseName: "Rockcastle", geoid: "21203" },
          { baseName: "Russell", geoid: "21207" }, { baseName: "Wayne", geoid: "21231" },
          { baseName: "Wolfe", geoid: "21237" },
        ],
      },
      {
        unitId: "us-ky-deer-zone-4",
        officialName: "Zone 4",
        quote:
          "Zone 4 shall consist of Bell, Breathitt, Clay, Floyd, Harlan, Knott, Knox, Lee, Leslie, Letcher, Magoffin, McCreary, Owsley, Perry, and Whitley Counties.",
        section: "301 KAR 2:172 \u00a7 6(4)",
        members: [
          { baseName: "Bell", geoid: "21013" }, { baseName: "Breathitt", geoid: "21025" },
          { baseName: "Clay", geoid: "21051" }, { baseName: "Floyd", geoid: "21071" },
          { baseName: "Harlan", geoid: "21095" }, { baseName: "Knott", geoid: "21119" },
          { baseName: "Knox", geoid: "21121" }, { baseName: "Lee", geoid: "21129" },
          { baseName: "Leslie", geoid: "21131" }, { baseName: "Letcher", geoid: "21133" },
          { baseName: "Magoffin", geoid: "21153" }, { baseName: "McCreary", geoid: "21147" },
          { baseName: "Owsley", geoid: "21189" }, { baseName: "Perry", geoid: "21193" },
          { baseName: "Whitley", geoid: "21235" },
        ],
      },
    ],
    membershipConflicts: [],
    unresolved: [],
    divisionAccounting: {
      covers: "PARTITION",
      divisionsInJurisdiction: 120,
      accountedFor: 120,
      remainder: [],
      measuredFrom:
        "TIGERweb State_County layer 1, STATE='21' \u2014 120 FEATURES counted as rows, 120 distinct BASENAME, all LSADC " +
        "06, no ambiguous name (the Missouri trap does not apply here). Section 6's four lists name 68 + 24 + 13 + 15 = " +
        "120, all distinct, so the zones PARTITION the state exactly. " +
        "WHICH VERSION IS IN FORCE WAS ESTABLISHED FROM THE MARKUP, NOT FROM A READING. The page carries the engrossed " +
        "regulation and, below it, an \u201cALTERNATE VIEW \u2014 this is how this document appeared before it was " +
        "engrossed\u201d, and the two disagree: one Zone 1 has 68 counties and the other 51. In the alternate view the " +
        "68-county list sits inside <ins data-added=\"1\"> and the 51-county list inside <del data-removed=\"1\">, so the " +
        "68 is the inserted text and is what Section 6 of the engrossed regulation above also says. A summarising read of " +
        "the same page reported the DELETED list as the amended wording, which is the error this check exists to catch.",
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
  | { state: "MEMBERSHIP_IN_CONFLICT"; conflict: MembershipConflict }
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
  /* A conflict the AUTHORITY states outranks everything, including a list that
     happens to hold the division: answering from one of two sources that
     disagree is choosing, and choosing is what §41B forbids here. */
  const conflict = declared.membershipConflicts.find((entry) => entry.member.geoid === geoid);
  if (conflict) return { state: "MEMBERSHIP_IN_CONFLICT", conflict };
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
