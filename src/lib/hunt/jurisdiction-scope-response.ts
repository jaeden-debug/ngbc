import type { ZoneResolution } from "./types.ts";
import { proximityStatement } from "./jurisdiction-scope.ts";
import { regulatoryEntryFor } from "./regulatory/registry.ts";
import { unitedStatesJurisdictionById } from "./united-states/registry.ts";

/**
 * The zone endpoint's answer for a point placed in a JURISDICTION, not a zone.
 *
 * Its own status word, `JURISDICTION`, so no client that reads `RESOLVED` as
 * "here is a zone" can mistake it for one, and no `zone` key at all — there is
 * no designation, layer, geometry or zone id to send (§41A). What it carries
 * instead is what placed the point, labelled as the Census Bureau's
 * cartographic boundary, the bracketed proximity to the line, the known
 * differences between hunting jurisdiction and drawn extent, and which
 * species have certified whole-jurisdiction rules here.
 */
export interface JurisdictionScopedBody {
  status: "JURISDICTION";
  scope: "WHOLE_JURISDICTION";
  jurisdiction: { id: string; name: string };
  resolvedBy: { authority: string; title: string; url: string; statedAs: string };
  proximity: { state: "CLEAR" | "NEAR_LINE" | "NOT_MEASURED"; marginMetres: number; statedAs: string };
  nearBoundary: boolean;
  knownDifferences: string[];
  /**
   * The administrative division the point is also in, where the authority
   * writes its rules in one (§41B). Absent otherwise, and absent when the
   * Bureau could not place it — never a guess, and never a zone.
   */
  division?: {
    officialTerm: string;
    geoid: string;
    name: string;
    baseName: string;
    proximity: "CLEAR" | "NEAR_LINE" | "NOT_MEASURED";
    marginMetres: number;
    statedAs: string;
    furtherDimensions: string[];
    /** The authority's own composed unit for this division, with its state. */
    composedUnit?: NonNullable<import("./types.ts").AdministrativeDivision["composedUnit"]>;
  };
  rules: { authority: string | null; speciesIds: string[] };
  message: string;
}

export function jurisdictionScopedBody(resolution: ZoneResolution): JurisdictionScopedBody {
  const scope = resolution.jurisdictionScope;
  if (!scope || !resolution.jurisdictionId || resolution.zoneId) {
    throw new Error("A jurisdiction-scoped body is built only from a jurisdiction-scoped resolution with no zone");
  }
  const entry = regulatoryEntryFor(resolution.jurisdictionId);
  return {
    status: "JURISDICTION",
    scope: "WHOLE_JURISDICTION",
    jurisdiction: { id: resolution.jurisdictionId, name: resolution.officialName ?? entry?.jurisdictionName ?? resolution.jurisdictionId },
    resolvedBy: { authority: scope.boundary.authority, title: scope.boundary.title, url: scope.boundary.url, statedAs: scope.boundary.statedAs },
    proximity: { state: scope.proximity, marginMetres: scope.marginMetres, statedAs: proximityStatement(scope) },
    nearBoundary: resolution.nearBoundary === true,
    knownDifferences: scope.knownDifferences,
    ...(scope.division ? { division: {
      officialTerm: scope.division.officialTerm,
      geoid: scope.division.geoid,
      name: scope.division.name,
      baseName: scope.division.baseName,
      proximity: scope.division.proximity,
      marginMetres: scope.division.marginMetres,
      statedAs: scope.division.statedAs,
      furtherDimensions: scope.division.furtherDimensions,
      ...(scope.division.composedUnit ? { composedUnit: scope.division.composedUnit } : {}),
    } } : {}),
    rules: {
      authority: unitedStatesJurisdictionById(resolution.jurisdictionId)?.authority.name ?? null,
      speciesIds: entry?.coverage().species.map((row) => row.speciesId) ?? [],
    },
    message: resolution.message,
  };
}
