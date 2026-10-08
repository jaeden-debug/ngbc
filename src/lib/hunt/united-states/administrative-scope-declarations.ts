/**
 * Jurisdictions whose legal hunting unit IS an administrative division the
 * point can be resolved to from public-domain geography.
 *
 * CLAUDE.md §41B, "A legal rule's geography is not always a polygon":
 * ADMINISTRATIVE_COMPOSITION. In ten U.S. states the county or locality is what
 * the authority writes its rules in, so there is nothing for a wildlife agency
 * to draw — its county polygon would only be a redrawing of a boundary the
 * Census Bureau already owns. §41A's rule that a cartographic boundary may
 * RESOLVE a point for a rule whose own scope IS that geography is what permits
 * this, and its limits are unchanged: never a hunting zone, never a zone id,
 * never the geography of a rule scoped narrower, always labelled as the
 * Bureau's own boundary, proximity always stated.
 *
 * A ROW HERE IS NOT A CLAIM THAT THE RULES ARE CERTIFIED. It says only that
 * North Ground can answer "which legal unit is this point in" for this
 * jurisdiction — the same thing a drawn-but-uncertified layer says
 * (`rulesServing`, §41A "Selectable is not answerable"). What those units'
 * rules say is a separate fact in a separate place.
 *
 * EVERY ROW CARRIES THE AUTHORITY'S OWN WORDS. The family a jurisdiction
 * belongs to is decided by the shape of its authority's definition, not by our
 * convenience: "the following localities" is this family, while "those areas
 * south or west of a line described as" is not, and no row may be added from
 * our own note that a state "uses counties".
 */

import type { CanonicalId } from "../../content-contract/index.ts";

/**
 * Which administrative division the authority legislates in.
 *
 * COUNTY_OR_EQUIVALENT is whatever the Bureau treats as a county equivalent,
 * which is what these authorities legislate in: Louisiana parishes, Alaska
 * boroughs and census areas, and Virginia's independent cities all answer
 * correctly.
 *
 * There is deliberately no MUNICIPALITY member yet. Connecticut and the New
 * England states legislate by TOWN, which is a county subdivision and a
 * different Census service that is not built — and Connecticut shows why the
 * distinction cannot be fudged: it abolished county government, so the county
 * layer answers a Hartford point with "Capitol Planning Region", which is not
 * a town and is not Connecticut's legal geography. A member is added when its
 * resolver is.
 */
export type AdministrativeDivisionKind = "COUNTY_OR_EQUIVALENT";

export interface AdministrativeScopeDeclaration {
  jurisdictionId: string;
  name: string;
  /** Two-letter code, for the state resolver. */
  code: string;
  divisionKind: AdministrativeDivisionKind;
  /** The authority's own term for the unit, kept rather than normalised (§9). */
  officialTerm: string;
  /** The authority's own words establishing that the division is the legal unit. Verbatim. */
  authorityDefinition: {
    quote: string;
    authority: string;
    instrument: string;
    section: string;
    url: string;
    /** As the instrument itself prints it. */
    effectiveAs: string;
    retrievedAt: string;
    sourceId: CanonicalId<"source">;
  };
  /**
   * What the authority layers ON TOP of the division. These are dimensions of
   * the opportunity, never geography, and they are named here so that nobody
   * later reads "this state uses counties" as the whole model.
   */
  furtherDimensions: string[];
  /**
   * How many divisions the jurisdiction has, and from where. A positive control:
   * a resolver that answers from the wrong layer, or a Census layer that changes
   * shape, shows up here rather than as a quietly wrong locality.
   */
  divisionCount: {
    expected: number;
    /**
     * The Bureau's own breakdown, by its LSADC code, summing to `expected`.
     *
     * RECORDED SEPARATELY BECAUSE A SINGLE TOTAL HID A REAL ERROR. Missouri was
     * declared with 114, which is how many of its county equivalents are
     * COUNTIES; the Bureau returns 115, the extra one being the independent
     * City of St. Louis. A breakdown makes the county-versus-equivalent
     * distinction legible instead of resting on one number nobody can check.
     */
    byKind: { kind: string; lsadc: string; count: number }[];
    /**
     * Division names that are NOT unique within this jurisdiction, so a name in
     * a regulation cannot be resolved to one division without more.
     *
     * Missouri has one — "St. Louis" is both a county (29189) and an
     * independent city (29510) — and Virginia has four: Fairfax, Franklin,
     * Richmond and Roanoke each exist as a county and as an independent city.
     * Any future encoding of a name list for these jurisdictions must resolve
     * the ambiguity from the authority's own text rather than pick a row.
     */
    ambiguousNames: string[];
    /**
     * Divisions the authority's own geography does not reach, each with a
     * disposition — never left to prose.
     *
     * THE CASE THIS EXISTS FOR. Missouri's 115th county equivalent is the
     * independent City of St. Louis, and the rule's four limit lists name
     * "St. Louis" once without ever writing "City of St. Louis". The city's
     * disposition first lived in a sentence, and deleting that sentence failed
     * no test — so a point there could have fallen through every list and read
     * as though no limit applied. §8: a fact that lives only in a display
     * string is not resolved.
     *
     * NOT_ESTABLISHED is the honest answer until the authority's text settles
     * it, and it is an answer: it means a point there is told its class is
     * unresolved.
     */
    unaccountedFor: {
      name: string;
      geoid: string;
      disposition: "NOT_ESTABLISHED" | "OUTSIDE_BY_THE_AUTHORITY" | "REACHED_UNDER_ANOTHER_NAME";
      because: string;
    }[];
    composition: string;
    measuredFrom: string;
    measuredOn: string;
  };
  /**
   * Geography the authority writes that is NARROWER than the division, so a
   * division alone cannot answer it (§41A). Recorded as a known limit rather
   * than left out: a locality answer standing in for a carve-out is the
   * understating error nobody reports, because the hunter simply goes elsewhere.
   */
  subDivisionGeography: {
    count: string;
    examples: string[];
    /**
     * Whether North Ground can answer this narrower geography.
     *
     * A STRUCTURED FACT, not a sentence to be pattern-matched. The first version
     * of this contract carried only `consequence` prose and a test grepped it
     * for “not built / unresolved / incomplete” — which flagged Georgia's
     * honest “recorded and not served” and West Virginia's “until the
     * division lines are built”, because the vocabulary was short rather than
     * the records wrong. Widening the word list each time is how a check becomes
     * a spell-checker, and §8 already says it: a fact that lives only in a
     * display string is not resolved.
     */
    answerable: "NOT_BUILT" | "PARTIALLY_BUILT" | "BUILT";
    consequence: string;
  };
  /** [west, south, east, north], containing the whole jurisdiction. A request guard, not an answer. */
  envelope: [number, number, number, number];
  /**
   * Answering in production. Like a layer's `serving`, a fact about
   * certification set by a person: false keeps the jurisdiction out of every
   * selector, report and evaluation.
   */
  serving: boolean;
  /** Where hunting jurisdiction and the drawn extent are known to differ, said rather than smoothed (§41A). */
  knownDifferences: string[];
}

export const ADMINISTRATIVE_SCOPES: readonly AdministrativeScopeDeclaration[] = [
  {
    jurisdictionId: "jurisdiction:us-va",
    name: "Virginia",
    code: "VA",
    divisionKind: "COUNTY_OR_EQUIVALENT",
    officialTerm: "locality",
    authorityDefinition: {
      quote:
        "It shall be lawful to hunt deer in the following localities, including the cities and towns therein, " +
        "during the following seasons, all dates inclusive.",
      authority: "Virginia Department of Wildlife Resources (Board of Wildlife Resources regulations)",
      instrument: "Virginia Administrative Code",
      section: "4VAC15-90-10(A), Open season; generally",
      url: "https://law.lis.virginia.gov/admincode/title4/agency15/chapter90/section10/",
      effectiveAs: "Virginia Register Volume 41, Issue 26, eff. September 1, 2025",
      retrievedAt: "2026-10-07",
      sourceId: "source:us-va-vac-4-15-90" as CanonicalId<"source">,
    },
    furtherDimensions: [
      "LAND CLASS. Many localities are stated twice over different land: Augusta County “except on national forest and " +
        "department-owned lands”, Warren County “(non-national forest lands)”. Which land a point is on is a " +
        "dimension of the opportunity and is not resolved by the locality.",
      "LEGAL ANIMAL CLASS. Fairfax County appears again as “(antlerless deer only)” with its own season, so a " +
        "locality can carry more than one opportunity (§8, “A season is not a date range”).",
      "A SUB-LOCALITY LINE. Suffolk (City of) is split “east of Dismal Swamp Line” and “west of Dismal Swamp " +
        "Line”, which is geography NARROWER than the locality. §41A forbids answering it with the locality, so that " +
        "split is unresolved rather than flattened.",
    ],
    divisionCount: {
      expected: 133,
      byKind: [
        { kind: "county", lsadc: "06", count: 95 },
        { kind: "independent city", lsadc: "25", count: 38 },
      ],
      /* Each of these is BOTH a county and an independent city in Virginia, so
         a locality name alone does not identify one. Measured 2026-10-07. */
      ambiguousNames: ["Fairfax", "Franklin", "Richmond", "Roanoke"],
      unaccountedFor: [],

      composition: "95 counties and 38 independent cities, which are county equivalents rather than parts of a county",
      measuredFrom: "TIGERweb State_County MapServer, STATE='51', returnCountOnly — 133 on both the finest Counties layer (1) " +
        "and the small-scale layer (13), which also agree on Richmond city (51760). Layer 1 is used, being the same " +
        "generalisation as the states layer the jurisdiction resolver already asks.",
      measuredOn: "2026-10-07",
    },
    subDivisionGeography: {
      count: "about 15 to 20 distinct lines across the seasons guide",
      examples: [
        "Rockingham (west of Rts. 613 and 731)",
        "Campbell (East of Norfolk Southern Railroad)",
        "Suffolk (City of) (east of Dismal Swamp Line) and (west of Dismal Swamp Line)",
        "Earn-A-Buck is listed West of the Blue Ridge and East of the Blue Ridge, a physical divide the guide draws no polygon for",
        "Migratory seasons divide at I-95, and a resident Canada goose season at the Prince William/Stafford county line",
      ],
      answerable: "NOT_BUILT",
      consequence:
        "A locality is the unit for most seasons and is NOT the unit for these. Where a carve-out applies, the locality " +
        "answer is incomplete and must say so rather than be given as the whole answer; each line needs " +
        "DERIVED_FROM_DEFINITION geometry that is not built. The count is approximate because it comes from the seasons " +
        "guide rather than from an enumeration, and is recorded as approximate rather than rounded into a figure.",
    },
    /* Census extent for Virginia, padded. A guard: the Bureau still decides. */
    envelope: [-83.73, 36.49, -74.19, 39.52],
    /*
     * The division resolver answers for Virginia; no Virginia RULES are
     * certified yet, which is the ordinary split §41A already draws between
     * drawing a geography and answering about it.
     */
    serving: true,
    knownDifferences: [
      "Virginia's localities include 38 independent cities, which are county equivalents rather than parts of a county. " +
        "Richmond city and Henrico County are different localities with different rules, and the Bureau resolves them separately.",
      "Hunting on national forest and department-owned land is stated separately from the rest of many localities. North Ground " +
        "does not check which land a point is on, so a locality alone does not settle which of those seasons applies.",
      "Virginia's eastern boundary runs through the Chesapeake Bay and the Atlantic, and the Potomac is Maryland's to the " +
        "Virginia shore. On or near the water, which jurisdiction's hunting law applies is for the authorities to settle, not this map.",
    ],
  },
  {
    jurisdictionId: "jurisdiction:us-sc",
    name: "South Carolina",
    code: "SC",
    divisionKind: "COUNTY_OR_EQUIVALENT",
    /*
     * The DIVISION's term, not the unit's. South Carolina's unit is the game
     * zone, which it COMPOSES from counties (`composed-units.ts`); the county is
     * how a point reaches one. Virginia's locality is both at once, and keeping
     * the two words apart is what stops a county being reported as a zone.
     */
    officialTerm: "county",
    authorityDefinition: {
      quote:
        "Includes all lands of Abbeville, Anderson, Cherokee, Chester, Edgefield, Fairfield, Greenwood, Lancaster, " +
        "Laurens, McCormick, Newberry, Saluda, Spartanburg, Union and York counties.",
      authority: "South Carolina Department of Natural Resources",
      instrument: "2026-2027 South Carolina Hunting & Fishing Laws and Regulations Guide",
      section: "Game zones \u2014 Game Zone 2",
      url: "https://www.dnr.sc.gov/regulations.html",
      effectiveAs: "2026-2027 guide",
      retrievedAt: "2026-10-07",
      sourceId: "source:us-sc-dnr-regulations-guide" as CanonicalId<"source">,
    },
    furtherDimensions: [
      "THE UNIT IS A GAME ZONE, NOT THE COUNTY. Zones 2, 3 and 4 are county lists; a county resolves to the zone that " +
        "lists it, and the zone is what the seasons are written for.",
      "SPECIES-SPECIFIC MEMBERSHIP. The bear seasons state Game Zone 2 and Game Zone 4 with narrower, different county " +
        "sets than the general zones, so a species can change which zone a county is in. Recorded per unit, never merged.",
      "LAND OWNERSHIP. The bear statement for Game Zone 2 is \u201cPrivate land only\u201d for three counties, which is a " +
        "dimension of the opportunity and is not resolved by the county.",
    ],
    divisionCount: {
      expected: 46,
      byKind: [{ kind: "county", lsadc: "06", count: 46 }],
      ambiguousNames: [],
      unaccountedFor: [],
      composition: "46 counties; South Carolina has no independent cities or other county equivalents",
      measuredFrom: "TIGERweb State_County MapServer layer 1, STATE='45', returnCountOnly \u2014 46.",
      measuredOn: "2026-10-07",
    },
    subDivisionGeography: {
      count: "one, and it is the reason three counties resolve to no zone",
      examples: [
        "Game Zone 1 is \u201cAll properties north of the main line of the Norfolk Southern Railroad from the Georgia " +
          "State line to South Carolina Hwy 183 in Westminster, then north of SC Hwy 183 \u2026\u201d",
        "That line crosses Oconee, Pickens and Greenville, so the northern parts of those three are Zone 1 and the " +
          "southern parts are not",
        "The bear text confirms the split from the other side: \u201cPrivate land only in Greenville, Oconee, and " +
          "Pickens counties south of Game Zone 1\u201d",
      ],
      answerable: "NOT_BUILT",
      consequence:
        "Zones 2, 3 and 4 are encoded and Zone 1 is not built, so those three counties are answered as reached by an " +
        "unresolved unit rather than handed the zone that happens to be encoded. Discarding the other 43 because of them " +
        "would be the opposite error (\u00a78, fidelity in both directions).",
    },
    /* Census extent for South Carolina, padded. */
    envelope: [-83.40, 31.99, -78.49, 35.26],
    serving: true,
    knownDifferences: [
      "South Carolina's seasons are written for game zones rather than for counties, so a county answer is a step toward " +
        "the zone and is not itself the regulatory geography.",
      "Game Zone 1 is defined by a railway and highway traverse, so for Oconee, Pickens and Greenville a county cannot " +
        "say which zone a point is in.",
      "The coast and the Savannah River are boundaries with Georgia and the Atlantic. On or near the water, which " +
        "jurisdiction's hunting law applies is for the authorities to settle, not this map.",
    ],
  },
  {
    jurisdictionId: "jurisdiction:us-wv",
    name: "West Virginia",
    code: "WV",
    divisionKind: "COUNTY_OR_EQUIVALENT",
    officialTerm: "county",
    authorityDefinition: {
      quote:
        "Includes all of Berkeley, Grant, Hampshire, Hardy, Jefferson, Mineral, Morgan and Pendleton counties.",
      authority: "West Virginia Division of Natural Resources",
      instrument: "West Virginia Hunting and Trapping Regulations Summary, July 2026 \u2013 June 2027",
      section: "Chronic wasting disease \u2014 Containment Area",
      url: "https://wvdnr.gov/hunting/",
      effectiveAs: "July 2026 \u2013 June 2027 summary",
      retrievedAt: "2026-10-07",
      sourceId: "source:us-wv-dnr-regulations-summary" as CanonicalId<"source">,
    },
    furtherDimensions: [
      "WEST VIRGINIA WRITES ITS SEASONS BY COUNTY and publishes no numbered management units, so the county is the unit " +
        "for most species rather than a step toward one.",
      "SPECIES-SPECIFIC COUNTY SETS. The summary states different county sets per species, so a county's answer depends " +
        "on which species is asked about.",
      "DISEASE GEOGRAPHY IS ITS OWN LAYER. The CWD Containment Area is eight whole counties and the carcass-transport " +
        "area is seven of them; both are overlays on the county rather than units of it, and an area's effect on a hunt " +
        "is a separate dimension (CLAUDE.md \u00a741A, an area's hunting effect is its own field). Not encoded here.",
    ],
    divisionCount: {
      expected: 55,
      byKind: [{ kind: "county", lsadc: "06", count: 55 }],
      ambiguousNames: [],
      unaccountedFor: [],
      composition: "55 counties; West Virginia has no independent cities or other county equivalents",
      measuredFrom: "TIGERweb State_County MapServer layer 1, STATE='54', returnCountOnly \u2014 55.",
      measuredOn: "2026-10-07",
    },
    subDivisionGeography: {
      count: "six, each a named division line inside one county, for deer",
      examples: [
        "Fayette County (East/West Division Line) \u2014 \u201cstarting at the Raleigh County line, U.S. Route 19N to New " +
          "River, then follow New River north to the Gauley River (at Gauley Bridge) \u2026\u201d",
        "Kanawha County (North/South Division Line) \u2014 \u201cstarting at the Clay County line at the Elk River, west " +
          "along the Elk River to Charleston (intersection of I-64 with Corridor G) \u2026\u201d",
        "Mineral County (East/West Division Line) \u2014 \u201cstarting at the West Virginia\u2013Maryland state line, " +
          "U.S. Route 220S to SR 972 \u2026\u201d",
        "Greenbrier, Raleigh and Wayne carry their own division lines in the same form",
      ],
      answerable: "NOT_BUILT",
      consequence:
        "For deer in Fayette (54019), Greenbrier (54025), Kanawha (54039), Mineral (54057), Raleigh (54081) and Wayne " +
        "(54099) the county is NOT the unit, and a county answer there is incomplete until the division lines are built " +
        "as DERIVED_FROM_DEFINITION geometry over openly licensed road and river centrelines. The other 49 counties are " +
        "unaffected, and the splits are deer-specific rather than general.",
    },
    /* Census extent for West Virginia, padded. */
    envelope: [-82.70, 37.15, -77.67, 40.69],
    serving: true,
    knownDifferences: [
      "West Virginia publishes no numbered management units, so there is no zone for a county to resolve to: the county " +
        "is the regulatory geography the seasons are written for.",
      "Six counties carry a named division line for deer, so for that species a county cannot say which side of the line " +
        "a point is on.",
      "The Ohio River is the boundary with Ohio and Kentucky and the Potomac with Maryland. On or near the water, which " +
        "jurisdiction's hunting law applies is for the authorities to settle, not this map.",
      "The authority's own code sites could not be read: the Secretary of State's rule page returned no extractable text " +
        "and code.wvlegislature.gov presented an expired certificate, which was not retried insecurely. The county " +
        "definitions above come from the Division's own regulations summary, and the underlying rule text is unread.",
    ],
  },
  {
    jurisdictionId: "jurisdiction:us-ga",
    name: "Georgia",
    code: "GA",
    divisionKind: "COUNTY_OR_EQUIVALENT",
    officialTerm: "county",
    authorityDefinition: {
      quote:
        "There are 38 counties in the northern zone: Banks, Barrow, Bartow, Carroll, Catoosa, Chattooga, Cherokee, " +
        "Cobb, Dade, Dawson, DeKalb, Douglas, Fannin, Floyd, Forsyth, Franklin, Fulton, Gilmer, Gordon, Gwinnett, " +
        "Habersham, Hall, Haralson, Hart, Jackson, Lumpkin, Madison, Murray, Paulding, Pickens, Polk, Rabun, " +
        "Stephens, Towns, Union, Walker, White, Whitfield.",
      authority: "Georgia Department of Natural Resources, Wildlife Resources Division",
      instrument: "Georgia DNR Wildlife Resources Division, bear information page",
      section: "Bear zones \u2014 northern",
      url: "https://georgiawildlife.com/bear-info",
      effectiveAs: "as published 2026-10-07",
      retrievedAt: "2026-10-07",
      sourceId: "source:us-ga-wrd-bear-info" as CanonicalId<"source">,
    },
    furtherDimensions: [
      "GEORGIA PUBLISHES NO WILDLIFE-MANAGEMENT-UNIT SYSTEM. Its seasons are written by county, and for bear by three " +
        "named zones composed of counties (`composed-units.ts`).",
      "SPECIES DECIDES WHETHER A UNIT EXISTS AT ALL. The bear zones hold 50 of 159 counties; for the other 109 there is " +
        "no bear zone, which is an answer rather than a gap.",
      "THE DEER RULE IS A NEGATIVE COMPOSITION AND IS NOT BUILT. Rule 391-4-2-.27(1)(a) reads \u201cAll counties, except " +
        "Clayton, Cobb, DeKalb, that portion of Forsyth lying south of GA Hwy 20, that portion of Fulton lying north of " +
        "GA Hwy 92 and that portion of Glynn lying within Jekyll Island\u201d \u2014 the whole state MINUS three counties " +
        "and three part-counties. The part-county exclusions are narrower than a county, so a county answer cannot " +
        "settle Forsyth, Fulton or Glynn.",
    ],
    divisionCount: {
      expected: 159,
      byKind: [{ kind: "county", lsadc: "06", count: 159 }],
      ambiguousNames: [],
      unaccountedFor: [],
      composition: "159 counties; Georgia has no independent cities or other county equivalents",
      measuredFrom: "TIGERweb State_County MapServer layer 1, STATE='13', returnCountOnly \u2014 159.",
      measuredOn: "2026-10-07",
    },
    subDivisionGeography: {
      count: "three part-county exclusions in the deer rule, plus whatever the unread bear rule carries",
      examples: [
        "\u201cthat portion of Forsyth lying south of GA Hwy 20\u201d, where only shotguns and muzzleloaders may be used",
        "\u201cthat portion of Fulton lying north of GA Hwy 92\u201d",
        "\u201cthat portion of Glynn lying within Jekyll Island\u201d",
      ],
      answerable: "NOT_BUILT",
      consequence:
        "For deer, Forsyth, Fulton and Glynn cannot be answered by the county: each is split by a highway or an island " +
        "boundary. The deer geography is therefore recorded and not served, and the 2026-27 guide publishes the same set " +
        "as a map colour group with NO county list in its text \u2014 MAP_ONLY, which is never inferred from shading.",
    },
    /* Census extent for Georgia, padded. */
    envelope: [-85.66, 30.30, -80.79, 35.05],
    serving: true,
    knownDifferences: [
      "Georgia publishes no management units, so a county is the regulatory geography for most species and a step " +
        "toward a bear zone for bear.",
      "The controlling rules could not be read: rules.sos.ga.gov refused an ordinary client with HTTP 403 for both " +
        "391-4-2-.22 (Bear) and the adopted 391-4-2-.27 (Firearms Deer Hunting) bodies, which was not routed around. " +
        "The definitions above come from the Division's own published pages, and the rule text is unread.",
      "The Division's own bear page and its own bear-zone map disagree about Walton County, so Walton is answered as a " +
        "conflict rather than placed in a zone.",
      "The Savannah River, the Chattahoochee and the Atlantic are boundaries with South Carolina, Alabama, Florida and " +
        "the sea. On or near the water, which jurisdiction's hunting law applies is for the authorities to settle.",
    ],
  },
  {
    jurisdictionId: "jurisdiction:us-mo",
    name: "Missouri",
    code: "MO",
    divisionKind: "COUNTY_OR_EQUIVALENT",
    officialTerm: "county",
    authorityDefinition: {
      quote: "This rule establishes deer harvest limits by county.",
      authority: "Missouri Department of Conservation (Conservation Commission)",
      instrument: "Wildlife Code of Missouri, 3 CSR 10-7",
      section: "3 CSR 10-7.437, Deer: Antlerless Deer Hunting Permit Availability \u2014 PURPOSE",
      url: "https://www.sos.mo.gov/cmsimages/adrules/csr/current/3csr/3c10-7.pdf",
      effectiveAs: "the current Code of State Regulations as published; authority sections 40 and 45 of Art. IV, Mo. Const.",
      retrievedAt: "2026-10-07",
      sourceId: "source:us-mo-csr-3-10-7" as CanonicalId<"source">,
    },
    furtherDimensions: [
      "THE RULE'S OWN PURPOSE SENTENCE IS THE DEFINITION, and it is the clearest in the corpus: the rule exists to set " +
        "limits BY COUNTY. Missouri publishes no management units for deer.",
      "THE LIMIT IS THE RULE CONTENT, NOT A SECOND GEOGRAPHY. 3 CSR 10-7.437(2) sorts every county into four classes by " +
        "how many firearms antlerless permits a person may fill \u2014 none (5 counties), one (10), two (3), four (96). " +
        "Those are bag limits keyed to the county, so they belong in a certified Missouri bundle rather than here; " +
        "encoding them as composed units would describe a limit class as a place.",
      "ARCHERY IS STATEWIDE. 3 CSR 10-7.437(1)(A) makes archery antlerless permits valid statewide, so for that season " +
        "the county does not narrow anything \u2014 the same jurisdiction can be county-scoped for one implement and " +
        "whole-state for another.",
      "THE CITY OF ST. LOUIS IS NOT ESTABLISHED. Missouri's 115th county equivalent is the independent City of St. " +
        "Louis (29510). The rule's four lists name \u201cSt. Louis\u201d once and the document never writes " +
        "\u201cCity of St. Louis\u201d or \u201cSt. Louis City\u201d, so whether the name reaches the city, the " +
        "county, or both is NOT ESTABLISHED from the text \u2014 and the rule may genuinely not reach a city of that " +
        "density, which would be a real fact about Missouri's limits rather than a gap in ours. A point there must be " +
        "told its limit class is unresolved; it must never fall through the four lists and read as though no limit " +
        "applied.",
    ],
    divisionCount: {
      expected: 115,
      byKind: [
        { kind: "county", lsadc: "06", count: 114 },
        { kind: "independent city", lsadc: "25", count: 1 },
      ],
      /* "St. Louis" is both St. Louis County (29189) and St. Louis city
         (29510). The rule names "St. Louis" once and never says "City of St.
         Louis", so which it means is not established from its text. */
      ambiguousNames: ["St. Louis"],
      unaccountedFor: [{
        name: "St. Louis city",
        geoid: "29510",
        disposition: "NOT_ESTABLISHED",
        because:
          "3 CSR 10-7.437(2) names \u201cSt. Louis\u201d once across its four limit lists and the rule never writes " +
          "\u201cCity of St. Louis\u201d or \u201cSt. Louis City\u201d, so whether that name reaches the independent " +
          "city, St. Louis County (29189), or both is not established from its text. The rule may genuinely not reach a " +
          "city of that density, which would be a fact about Missouri's limits rather than a gap in ours. A point here " +
          "is told its limit class is unresolved; it never falls through the lists and reads as no limit applying.",
      }],
      composition:
        "115 county equivalents: 114 counties and the independent City of St. Louis",
      measuredFrom:
        "TIGERweb State_County MapServer layer 1, STATE='29' \u2014 115 features, 114 of LSADC 06 (county) and one of " +
        "LSADC 25 (city). The four lists in 3 CSR 10-7.437(2) name 114 counties, 114 distinct, so the COUNTIES match " +
        "one-for-one and the independent city is NOT accounted for. " +
        "THIS CORRECTS A CONTROL THAT COULD NOT FAIL. It first read 115 as 114 because the comparison was built from a " +
        "map keyed by the Bureau's BASENAME, and St. Louis County and St. Louis city share the BASENAME \u201cSt. " +
        "Louis\u201d \u2014 so two rows collapsed into one and the rule's single \u201cSt. Louis\u201d matched a " +
        "denominator that my own key had deduplicated to fit it. The match came out perfect, which is exactly why it " +
        "read as a measurement rather than a reading.",
      measuredOn: "2026-10-07",
    },
    subDivisionGeography: {
      count: "none found in this rule; the county is the whole of its geography",
      examples: [
        "3 CSR 10-7.437(2)(A)\u2013(D) name only whole counties: no part-county, highway or river qualifier appears",
        "the archery provision is statewide rather than sub-county",
        "other rules in 3 CSR 10-7 carry department-area and managed-hunt provisions, which are place-based permissions " +
          "rather than subdivisions of a county, and are a separate dimension",
      ],
      answerable: "NOT_BUILT",
      consequence:
        "For this rule nothing is narrower than the county, so a county answer is not incomplete for it \u2014 which is " +
        "why the count above says none rather than leaving the field vague. What is not built is Missouri's rule " +
        "CONTENT: no certified Missouri bundle exists, so the county resolves and there is nothing yet to say about it.",
    },
    /* Census extent for Missouri, padded. */
    envelope: [-95.82, 35.95, -88.99, 40.66],
    serving: true,
    knownDifferences: [
      "Missouri publishes no deer management units, so the county is the regulatory geography its harvest limits are " +
        "written for rather than a step toward a zone.",
      "The Mississippi River is the boundary with Illinois, Kentucky and Tennessee and the Missouri with Nebraska and " +
        "Kansas in part. On or near the water, which jurisdiction's hunting law applies is for the authorities to settle.",
      "The rule text was read from the Secretary of State's published Code PDF by mechanical extraction, which loses " +
        "ligatures: one county arrived as \u201cJe\u2026erson\u201d and was repaired to Jefferson against the Bureau's " +
        "own list, which is recorded here rather than left as a silent correction.",
    ],
  },
];

export function administrativeScopeFor(jurisdictionId: string | undefined): AdministrativeScopeDeclaration | undefined {
  return jurisdictionId ? ADMINISTRATIVE_SCOPES.find((entry) => entry.jurisdictionId === jurisdictionId) : undefined;
}

/** Whether this jurisdiction's administrative units are being resolved. */
export function administrativeScopeServing(jurisdictionId: string | undefined): boolean {
  return administrativeScopeFor(jurisdictionId)?.serving === true;
}

/** Whether a point is inside some serving declaration's request guard. */
export function couldBeAdministrativelyScoped(latitude: number, longitude: number): boolean {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  return ADMINISTRATIVE_SCOPES.some(({ serving, envelope: [west, south, east, north] }) =>
    serving && longitude >= west && longitude <= east && latitude >= south && latitude <= north);
}
