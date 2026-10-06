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
import type { JurisdictionScope, ZoneResolution } from "./types.ts";
import { couldBeJurisdictionScoped, jurisdictionScopeFor } from "./jurisdiction-scope-declarations.ts";
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
  if (!couldBeJurisdictionScoped(latitude, longitude)) return { kind: "NONE" };
  const place = await unitedStatesStateAt(latitude, longitude, fetcher);
  if (!place) return { kind: "NONE" };
  const declaration = jurisdictionScopeFor(place.jurisdictionId);
  if (!declaration?.serving) return { kind: "ATTRIBUTED", place };

  const proximity = await unitedStatesStateLineProximity(latitude, longitude, place.code, fetcher);
  const scope: JurisdictionScope = {
    kind: "WHOLE_JURISDICTION",
    boundary: { ...BOUNDARY, statedAs: boundaryStatement(declaration.name) },
    proximity,
    marginMetres: STATE_LINE_MARGIN_METRES,
    knownDifferences: [...declaration.knownDifferences],
  };
  return {
    kind: "SCOPED",
    resolution: {
      status: "RESOLVED",
      jurisdictionId: declaration.jurisdictionId as CanonicalId<"jurisdiction">,
      /* The Bureau's own name for the place. Not a zone name: there is no zone. */
      officialName: declaration.name,
      verificationFlag: "Placed by the jurisdiction boundary, for whole-jurisdiction rules only",
      /* Always set, so every consumer that already honours a zone line's
         warning honours this one; the bracket is in `jurisdictionScope`. */
      nearBoundary: proximity !== "CLEAR",
      /* No `sourceId`. On a resolution it names the ZONE boundary's source,
         which every reader of "what decided this answer" lists as authority;
         set to the Census source it presented a cartographic state line as a
         zone boundary. What placed the point is `jurisdictionScope.boundary`. */
      jurisdictionScope: scope,
      message: `${scope.boundary.statedAs} ${proximityStatement(scope)}`,
    },
  };
}
