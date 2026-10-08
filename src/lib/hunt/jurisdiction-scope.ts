/**
 * Placing a point in a JURISDICTION, for rules whose own scope is the whole
 * jurisdiction — never in a zone.
 *
 * CLAUDE.md §41A, "Resolving inside a jurisdiction is not drawing its
 * boundary" (owner, 2026-09-30): a jurisdiction boundary may resolve a point
 * for a statewide rule. Most United States take listings are statewide, and a
 * rule that can be encoded but never delivered is, by §8's capability rule, no
 * coverage at all. The four binding limits are kept here and in the engine:
 *
 *  1. The resolution has NO zone id — not in the answer, the URL, a zone card,
 *     the zone list, a polygon, a Hunt Brief or a share. It is a different
 *     kind of answer (`jurisdictionScope`), not a zone with an odd id.
 *  2. It reaches only rules whose geography is the whole jurisdiction
 *     (`include.jurisdiction`); the engine never matches a unit, county or
 *     district rule without a unit.
 *  3. It is labelled as what it is — the Census Bureau's cartographic boundary —
 *     and never as the authority's determination of where hunting jurisdiction
 *     runs.
 *  4. Proximity is stated, bracketed rather than invented, and a point the
 *     service could not measure is treated as near the line.
 *
 * Read live, never stored, never drawn: the same two Census queries a person
 * could make, cached per point.
 */

import type { CanonicalId } from "../content-contract/index.ts";
import type { AdministrativeDivision, JurisdictionScope, ZoneResolution } from "./types.ts";
import { couldBeJurisdictionScoped, jurisdictionScopeFor } from "./jurisdiction-scope-declarations.ts";
import {
  administrativeScopeFor, couldBeAdministrativelyScoped, type AdministrativeScopeDeclaration,
} from "./united-states/administrative-scope-declarations.ts";
import {
  COUNTY_LINE_MARGIN_METRES, unitedStatesCountyAt, unitedStatesCountyLineProximity, US_COUNTY_BOUNDARY_SOURCE_ID,
} from "./united-states/county-boundary.ts";
import { composedUnitAt, composedUnitsFor } from "./united-states/composed-units.ts";
import {
  STATE_LINE_MARGIN_METRES, unitedStatesStateAt, unitedStatesStateLineProximity, US_STATE_BOUNDARY_SOURCE_ID,
  type UnitedStatesPlace,
} from "./united-states/state-boundary.ts";

export type JurisdictionPlacement =
  /** Placed in a jurisdiction whose whole-jurisdiction rules are served. */
  | { kind: "SCOPED"; resolution: ZoneResolution }
  /** Placed in a state that has none served: attribution only, no rule reaches it this way. */
  | { kind: "ATTRIBUTED"; place: UnitedStatesPlace }
  /** Not asked (outside every guard), outside every state, or the service could not answer. */
  | { kind: "NONE" };

const BOUNDARY = {
  authority: "U.S. Census Bureau",
  title: "TIGERweb: States and equivalent entities",
  url: "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/0",
  sourceId: US_STATE_BOUNDARY_SOURCE_ID as CanonicalId<"source">,
  describedAs: "the U.S. Census Bureau's cartographic state boundary",
} as const;

/** What the boundary is and is not, said wherever it is shown. */
export function boundaryStatement(name: string): string {
  return `The U.S. Census Bureau's state boundary (TIGERweb) places this point in ${name}. It is a cartographic boundary: ` +
    `North Ground uses it only to apply ${name}'s statewide rules, never as a hunting zone, and it is not ${name}'s ` +
    "determination of where its hunting jurisdiction runs.";
}

/** The proximity sentence for a bracket. Never a figure the service did not give. */
export function proximityStatement(scope: Pick<JurisdictionScope, "proximity" | "marginMetres">): string {
  if (scope.proximity === "CLEAR") return `The point is more than ${scope.marginMetres} m inside the state line as the Bureau draws it.`;
  if (scope.proximity === "NEAR_LINE") {
    return `The point is within about ${scope.marginMetres} m of the state line as the Bureau draws it. The rules on the other side ` +
      "differ, so confirm which state you are in. The map and consumer GPS are not a legal survey.";
  }
  return "North Ground could not measure how close this point is to the state line, so treat it as possibly near it. " +
    "The map and consumer GPS are not a legal survey.";
}

/**
 * The jurisdiction a point is in, for whole-jurisdiction rules.
 *
 * Asked only inside a serving declaration's guard, so a point nowhere near a
 * statewide jurisdiction never waits on Census. Where the Bureau places the
 * point in such a jurisdiction, the answer is a jurisdiction-scoped resolution;
 * where it places it in another state, only the state is returned, as a fact
 * about the ground that outranks a hunting layer's rectangle.
 */
export async function placeInJurisdiction(
  latitude: number,
  longitude: number,
  fetcher: typeof fetch = fetch,
): Promise<JurisdictionPlacement> {
  /* Either guard may admit the point: the two models answer different questions
     and a jurisdiction can be served by one without the other. Virginia has an
     administrative scope and no jurisdiction scope, and testing only the first
     left every Virginia point unasked. */
  if (!couldBeJurisdictionScoped(latitude, longitude) && !couldBeAdministrativelyScoped(latitude, longitude)) {
    return { kind: "NONE" };
  }
  const place = await unitedStatesStateAt(latitude, longitude, fetcher);
  if (!place) return { kind: "NONE" };
  const declaration = jurisdictionScopeFor(place.jurisdictionId);
  const administrative = administrativeScopeFor(place.jurisdictionId);
  /*
   * A jurisdiction may be served by either model, or both, and they are
   * different questions. A jurisdiction scope answers "which statewide rules
   * reach this point"; an administrative scope answers "which legal unit is
   * this point in" where the authority writes its rules in counties or
   * localities. Virginia has the second and not yet the first, and a locality
   * is a real answer to a real question, so it is not left ATTRIBUTED.
   */
  if (!declaration?.serving && !administrative?.serving) return { kind: "ATTRIBUTED", place };

  const name = declaration?.name ?? administrative?.name ?? place.name;
  const [proximity, division] = await Promise.all([
    unitedStatesStateLineProximity(latitude, longitude, place.code, fetcher),
    administrative?.serving ? divisionAt(latitude, longitude, administrative, fetcher) : Promise.resolve(undefined),
  ]);
  const scope: JurisdictionScope = {
    kind: "WHOLE_JURISDICTION",
    boundary: { ...BOUNDARY, statedAs: boundaryStatement(name) },
    proximity,
    marginMetres: STATE_LINE_MARGIN_METRES,
    knownDifferences: [...(declaration?.knownDifferences ?? administrative?.knownDifferences ?? [])],
    ...(division ? { division } : {}),
  };
  return {
    kind: "SCOPED",
    resolution: {
      status: "RESOLVED",
      jurisdictionId: (declaration?.jurisdictionId ?? administrative!.jurisdictionId) as CanonicalId<"jurisdiction">,
      /* The Bureau's own name for the place. Not a zone name: there is no zone. */
      officialName: name,
      verificationFlag: "Placed by the jurisdiction boundary, for whole-jurisdiction rules only",
      /* Always set, so every consumer that already honours a zone line's
         warning honours this one; the bracket is in `jurisdictionScope`. */
      nearBoundary: proximity !== "CLEAR",
      /* No `sourceId`. On a resolution it names the ZONE boundary's source,
         which every reader of "what decided this answer" lists as authority;
         set to the Census source it presented a cartographic state line as a
         zone boundary. What placed the point is `jurisdictionScope.boundary`. */
      jurisdictionScope: scope,
      message: [scope.boundary.statedAs, proximityStatement(scope), division ? divisionStatement(division) : ""]
        .filter(Boolean).join(" "),
    },
  };
}

/* ── The administrative division, where one IS the legal unit ────────────── */

/** The unit's own word, for a sentence about a unit we cannot resolve. */
function composedTerm(unit: { officialName: string }): string {
  return /zone/i.test(unit.officialName) ? "zone" : "unit";
}

/**
 * What the division is and is not. It placed the point for a rule whose own
 * scope is that division; it is not a hunting zone and not the authority's own
 * boundary.
 */
export function divisionStatement(division: AdministrativeDivision): string {
  const near = division.proximity === "CLEAR"
    ? `The point is more than ${division.marginMetres} m inside its line as the Bureau draws it.`
    : division.proximity === "NEAR_LINE"
      ? `The point is within about ${division.marginMetres} m of the line, and the rules in the next ${division.officialTerm} can differ.`
      : `North Ground could not measure how close the point is to that line, so treat it as possibly near it.`;
  const unit = division.composedUnit;
  const inUnit = unit?.state === "IN_UNIT"
    ? ` This authority writes its seasons for the ${unit.officialTerm}, and it lists this ${division.officialTerm} in ${unit.officialName}.`
    : unit?.state === "IN_AN_UNRESOLVED_UNIT"
      ? ` ${unit.officialName} reaches into this ${division.officialTerm} and North Ground cannot yet resolve where its line runs, ` +
        `so no ${composedTerm(unit)} is given for this point.`
      : unit?.state === "NOT_ACCOUNTED_FOR"
        ? ` The authority's own lists do not account for this ${division.officialTerm}, which is a finding rather than an absence of rules.`
        : "";
  return `The Bureau's county boundary places it in ${division.name}, which is the ${division.officialTerm} ` +
    `this jurisdiction writes its hunting rules in. ${near}${inUnit}`;
}

/**
 * The division containing the point, or undefined where the Bureau places it in
 * none or could not be asked. Undefined is never read as "no division": the
 * answer then simply does not name one, rather than naming the wrong one.
 */
async function divisionAt(
  latitude: number,
  longitude: number,
  declaration: AdministrativeScopeDeclaration,
  fetcher: typeof fetch,
): Promise<AdministrativeDivision | undefined> {
  if (!couldBeAdministrativelyScoped(latitude, longitude)) return undefined;
  const county = await unitedStatesCountyAt(latitude, longitude, fetcher);
  if (!county) return undefined;
  /* The Bureau's own five-digit code begins with its state's two digits. A
     county from the neighbouring state is a boundary question for a person, not
     a division of this jurisdiction. */
  if (!county.geoid.startsWith(stateFipsOf(declaration.code) ?? county.stateFips)) return undefined;
  const proximity = await unitedStatesCountyLineProximity(latitude, longitude, county.geoid, fetcher);
  const division: AdministrativeDivision = {
    officialTerm: declaration.officialTerm,
    geoid: county.geoid,
    name: county.name,
    baseName: county.baseName,
    proximity,
    marginMetres: COUNTY_LINE_MARGIN_METRES,
    sourceId: US_COUNTY_BOUNDARY_SOURCE_ID,
    statedAs: "",
    furtherDimensions: [...declaration.furtherDimensions],
    ...composedUnitOf(declaration.jurisdictionId, county.geoid),
  };
  return { ...division, statedAs: divisionStatement(division) };
}

/**
 * The authority's own unit for this division, where the authority composes one.
 * Absent where it does not, which is Virginia: there the division IS the unit.
 */
function composedUnitOf(jurisdictionId: string, geoid: string): { composedUnit?: AdministrativeDivision["composedUnit"] } {
  const lookup = composedUnitAt(jurisdictionId, geoid);
  if (!lookup) return {};
  const term = composedUnitsFor(jurisdictionId)?.officialTerm ?? "unit";
  if (lookup.state === "IN_UNIT") {
    const { unitId, officialName, quote, section } = lookup.unit;
    return { composedUnit: { state: "IN_UNIT", unitId, officialName, officialTerm: term, quote, section } };
  }
  if (lookup.state === "IN_AN_UNRESOLVED_UNIT") {
    const { officialName, because, wouldRequire } = lookup.unresolved;
    return { composedUnit: { state: "IN_AN_UNRESOLVED_UNIT", officialName, because, wouldRequire } };
  }
  return { composedUnit: { state: "NOT_ACCOUNTED_FOR" } };
}

/**
 * The two-digit FIPS of a declared jurisdiction, from its own declaration
 * rather than from the answer being checked — otherwise the check would compare
 * the Bureau's answer with itself, which is a check that cannot fail.
 */
const STATE_FIPS: Readonly<Record<string, string>> = { VA: "51" };

function stateFipsOf(code: string): string | undefined {
  return STATE_FIPS[code];
}
