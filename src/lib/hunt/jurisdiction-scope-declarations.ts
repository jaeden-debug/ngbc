/**
 * Jurisdictions whose certified rules are served at the scope of the WHOLE
 * jurisdiction, placed by the jurisdiction's boundary rather than by a zone.
 *
 * Pure data, safe for the browser: the composer and the evaluation endpoint
 * both read `isWithinSupportedBounds`, and a statewide jurisdiction is in scope
 * there even though it draws no layer.
 *
 * WHAT A ROW HERE MEANS (CLAUDE.md §41A, "Resolving inside a jurisdiction is
 * not drawing its boundary"). The jurisdiction's certified bundle states rules
 * whose own geography is the whole jurisdiction (`include.jurisdiction`), and
 * North Ground may place a point inside it with the named boundary to apply
 * THOSE rules. It never makes the boundary a hunting zone, never gives a point
 * a zone id, and never applies a rule scoped narrower than the jurisdiction.
 *
 * `envelope` is a request guard, not an answer: a point outside it is not
 * asked about at all, and a point inside it is placed only by the boundary
 * service itself. It is the Census Bureau's own extent for the state, read
 * 2026-10-01 with `returnExtentOnly`, padded by 0.05°.
 */

export type JurisdictionBoundarySource = "US_CENSUS_TIGERWEB_STATE";

export interface JurisdictionScopeDeclaration {
  jurisdictionId: string;
  name: string;
  /** Two-letter code the boundary service uses. */
  code: string;
  boundary: JurisdictionBoundarySource;
  /** [west, south, east, north], containing the whole jurisdiction. */
  envelope: [number, number, number, number];
  /**
   * Answering in production. Like a layer's `rulesServing`, a fact about
   * certification, set by a person: false keeps the jurisdiction out of every
   * selector, report and evaluation.
   */
  serving: boolean;
  /**
   * Where the jurisdiction's hunting law and its drawn extent are known to
   * differ, said rather than smoothed (§41A). North Ground's own sentences.
   */
  knownDifferences: string[];
}

export const JURISDICTION_SCOPES: readonly JurisdictionScopeDeclaration[] = [
  {
    jurisdictionId: "jurisdiction:us-ia",
    name: "Iowa",
    code: "IA",
    boundary: "US_CENSUS_TIGERWEB_STATE",
    /* Census extent: -96.6395, 40.3754, -90.1401, 43.5012. */
    envelope: [-96.69, 40.32, -90.09, 43.55],
    serving: true,
    knownDifferences: [
      "Iowa's eastern border follows the Mississippi River and most of its western border the Missouri and Big Sioux rivers. " +
        "On or near the water, which state's hunting law applies is for the authorities to settle, not this map.",
      "Federal land with rules of its own — national wildlife refuges, Effigy Mounds National Monument — and the Meskwaki " +
        "Settlement, which is tribal land, lie inside this boundary. North Ground does not check whether a point is on any of them.",
    ],
  },
];

export function jurisdictionScopeFor(jurisdictionId: string | undefined): JurisdictionScopeDeclaration | undefined {
  return jurisdictionId ? JURISDICTION_SCOPES.find((entry) => entry.jurisdictionId === jurisdictionId) : undefined;
}

/** Whether this jurisdiction's whole-jurisdiction rules are answering. */
export function jurisdictionScopeServing(jurisdictionId: string | undefined): boolean {
  return jurisdictionScopeFor(jurisdictionId)?.serving === true;
}

/** Whether a point is inside some serving declaration's request guard. */
export function couldBeJurisdictionScoped(latitude: number, longitude: number): boolean {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  return JURISDICTION_SCOPES.some(({ serving, envelope: [west, south, east, north] }) =>
    serving && longitude >= west && longitude <= east && latitude >= south && latitude <= north);
}
