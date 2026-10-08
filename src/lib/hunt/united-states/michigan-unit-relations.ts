/**
 * How one Michigan deer management unit relates to another where their polygons
 * overlap — BASE − SUBUNIT + EXCEPTION, with the legal character of every
 * relation coming from the Order and nothing else.
 *
 * WHY A POINT IN THREE UNITS IS MOSTLY CORRECT. Measured 2026-10-07 on MDNR's
 * own service: of 14 probe points inside at least one unit, five fell in three
 * units and five in two. A point at 42.8, -83.5 is in DMU-063 Oakland County,
 * DMU-486 Southern Lower Peninsula multicounty unit AND DMU-499 Urban deer
 * management zone. By bounding box, 106 containment candidates exist among the
 * 115 units, with DMU-486 containing 56.
 *
 * THIS CORRECTS MY OWN EARLIER EXPLANATION. I had recorded that 302 of 624
 * points fall in more than one unit "because the Order defines units as
 * mutually exclusive by carve-out and the drawing does not implement the
 * carve-outs". The overlap count was right and the reason was wrong. The Order
 * states NO general precedence rule at all — measured across its 183 pages,
 * "precedence", "supersede", "most restrictive", "shall govern", "shall
 * control" and "overlap" return zero hits between them, and the single "more
 * restrictive … shall prevail" concerns federal versus state migratory-bird
 * permits rather than geography.
 *
 * So the overlaps are REAL rather than a drawing defect, and the absence of a
 * precedence rule is a drafting choice rather than an omission: WHERE THE
 * DRAFTERS WANTED MUTUAL EXCLUSION THEY WROTE IT INTO THE DEFINITION. §12.19b
 * defines its unit as counties "except those lands defined in section 12.33a".
 * That sentence IS the carve-out algebra, in the authority's own words.
 *
 * WHAT FOLLOWS FOR AN ANSWER. A point in several units is a CONFLICT unless the
 * Order resolves the pair, because picking one would assert a precedence the
 * authority declined to state. §8 supports CONFLICT as a first-class state
 * precisely so this does not have to be guessed.
 */

import type { CanonicalId } from "../../content-contract/index.ts";
import { quoting, type AuthorityQuotation } from "../provenance.ts";

export const MICHIGAN_DMU_SERVICE =
  "https://services3.arcgis.com/Jdnp1TjADvSDxMAX/arcgis/rest/services/WILDGameSpeciesManagementUnitsAndZonesOPENDATA/FeatureServer/3";

export const MICHIGAN_WCO_SOURCE_ID = "source:us-mi-wildlife-conservation-order" as CanonicalId<"source">;

/**
 * What the Order says about two units whose polygons overlap.
 *
 * UNRESOLVED is the default, and CARVED_OUT structurally requires the
 * authority's own words — North Ground cannot remove land from a unit on its
 * own say-so, which is the same discipline `AreaEffect` applies to DEEMED_OPEN.
 */
export type MichiganUnitRelation =
  /**
   * The container's own definition excludes the sub-unit's lands, so a point in
   * the sub-unit is NOT in the container. Requires the defining sentence.
   */
  | { relation: "CARVED_OUT_BY_DEFINITION"; words: AuthorityQuotation }
  /**
   * Both units apply and the Order resolves nothing, so an answer naming one is
   * asserting a precedence the authority declined to state.
   */
  | { relation: "GENUINE_OVERLAP_UNRESOLVED"; because: string }
  /** North Ground has not established which. Neither carved out nor overlapping. */
  | { relation: "UNRESOLVED"; because: string };

export interface MichiganOverlap {
  /** The larger unit, by the authority's own designation. */
  container: string;
  /** The unit inside it. */
  inner: string;
  relation: MichiganUnitRelation;
}

/**
 * The overlaps whose character has been established, and the ones that have
 * not. Deliberately short: four units are known to overlap the county units
 * with nothing resolving them, and one carve-out pattern is read from the
 * Order's own drafting.
 */
export const MICHIGAN_OVERLAPS: readonly MichiganOverlap[] = [
  {
    container: "486",
    inner: "ANY_COUNTY_UNIT_WITHIN",
    relation: {
      relation: "GENUINE_OVERLAP_UNRESOLVED",
      because:
        "DMU-486, the Southern Lower Peninsula multicounty unit, contains 56 other units by bounding box and the Order " +
        "states no precedence. Nothing in it says which of the two applies to a point in both.",
    },
  },
  {
    container: "487",
    inner: "ANY_COUNTY_UNIT_WITHIN",
    relation: {
      relation: "GENUINE_OVERLAP_UNRESOLVED",
      because: "DMU-487, the Northeast Lower Peninsula multicounty unit, on the same footing as 486.",
    },
  },
  {
    container: "499",
    inner: "ANY_COUNTY_UNIT_WITHIN",
    relation: {
      relation: "GENUINE_OVERLAP_UNRESOLVED",
      because:
        "DMU-499, the Urban deer management zone, overlaps the county units — measured at 42.8, -83.5, where a point is " +
        "in Oakland County, 486 and 499 at once.",
    },
  },
  {
    container: "333",
    inner: "ANY_COUNTY_UNIT_WITHIN",
    relation: {
      relation: "GENUINE_OVERLAP_UNRESOLVED",
      because: "DMU-333, the Lansing core CWD area, overlaps the county units with nothing resolving it.",
    },
  },
  {
    /*
     * THE ONE RESOLVED CASE, and it is the pattern rather than a special case:
     * the drafters carve out by naming the excluded lands in the container's own
     * definition. Recorded from the consolidated Order, which is current only
     * through Amendment 5 of 2026 — so this establishes the DRAFTING PATTERN and
     * is not used to certify either unit's current extent.
     */
    container: "12.19b",
    inner: "12.33a",
    relation: {
      relation: "CARVED_OUT_BY_DEFINITION",
      words: quoting(
        "except those lands defined in section 12.33a",
        MICHIGAN_WCO_SOURCE_ID,
        "Wildlife Conservation Order § 12.19b, as consolidated through Amendment 5 of 2026 (eff. 2026-04-08)",
        "en-US",
      ),
    },
  },
];

/**
 * Units the authority has RESCINDED that its own service still publishes.
 *
 * An explicit, sourced exclusion rather than a rule inferred from the data —
 * nothing on the layer distinguishes them, because `Year` reads 2026 for all
 * 115 rows and the two do not even share a naming pattern ("DMU-351 Mideast
 * Upper Peninsula" carries no unit suffix while "DMU-352 Midwest Upper
 * Peninsula unit" does).
 */
export const MICHIGAN_RESCINDED_UNITS: readonly string[] = ["351", "352"];

/** Whether the layer may draw this unit. */
export function michiganUnitIsCurrent(designation: string): boolean {
  return !MICHIGAN_RESCINDED_UNITS.includes(designation.trim());
}

/**
 * What to do with a point that resolves to several units.
 *
 * CONFLICT unless every pair is resolved by a carve-out, because choosing
 * asserts a precedence the Order declined to state. The units are returned so
 * an answer can name all of them rather than reporting that something went
 * wrong.
 */
export function michiganResolution(designations: readonly string[]):
  | { outcome: "NO_UNIT" }
  | { outcome: "RESOLVED"; designation: string }
  | { outcome: "CONFLICT"; designations: readonly string[]; because: string } {
  const current = designations.map((d) => d.trim()).filter((d) => d && michiganUnitIsCurrent(d));
  if (current.length === 0) return { outcome: "NO_UNIT" };
  if (current.length === 1) return { outcome: "RESOLVED", designation: current[0] };
  return {
    outcome: "CONFLICT",
    designations: current,
    because:
      "Michigan's Wildlife Conservation Order states no rule of precedence between overlapping deer management units, " +
      "and these units genuinely overlap. Naming one of them would assert a precedence the authority declined to state.",
  };
}
