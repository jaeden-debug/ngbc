import type { UnitedStatesPlace } from "./state-boundary.ts";
import type { UnitedStatesJurisdiction } from "./registry.ts";
import { unitedStatesCoverageMatrix } from "./coverage-matrix.ts";

/**
 * A state answer is useful even when Hunt cannot answer the separate unit
 * question. This payload never promotes Census state geometry to hunting
 * geography and never turns a discovered source into certified coverage.
 */
export function unsupportedUnitedStatesResponse(
  place: UnitedStatesPlace,
  jurisdiction: UnitedStatesJurisdiction,
) {
  const officialTerm = jurisdiction.spatial.officialTerm;
  const certified = unitedStatesCoverageMatrix().find((row) => row.code === place.code);
  if (!certified) throw new Error(`No U.S. coverage row for ${place.code}`);
  const readableSource = jurisdiction.officialSources.find((source) => source.scope === "STATE_OFFICIAL_HUB")
    ?? jurisdiction.officialSources[0];

  return {
    status: "UNSUPPORTED" as const,
    jurisdiction: {
      id: jurisdiction.id,
      code: place.code,
      name: place.name,
    },
    coverage: {
      productionStatus: certified.productionStatus,
      map: certified.map.status,
      regulations: certified.regulations.status,
      officialTerm,
    },
    authority: {
      name: jurisdiction.authority.name,
      url: jurisdiction.authority.url,
    },
    source: readableSource ? { title: readableSource.title, url: readableSource.url } : null,
    message:
      `This point is in ${place.name}. North Ground has not certified the official hunting-management ` +
      `boundaries that apply at this point, so it will not invent or name a unit here. ` +
      "That is a gap in North Ground's coverage, not a statement about whether hunting is permitted.",
  };
}
