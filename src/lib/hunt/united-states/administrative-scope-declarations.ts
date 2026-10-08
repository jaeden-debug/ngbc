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
  divisionCount: { expected: number; composition: string; measuredFrom: string; measuredOn: string };
  /**
   * Geography the authority writes that is NARROWER than the division, so a
   * division alone cannot answer it (§41A). Recorded as a known limit rather
   * than left out: a locality answer standing in for a carve-out is the
   * understating error nobody reports, because the hunter simply goes elsewhere.
   */
  subDivisionGeography: { count: string; examples: string[]; consequence: string };
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
