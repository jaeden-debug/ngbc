import type { ZoneResolution } from "./types.ts";
import { designationFromOfficialName, zoneCoverage, zoneDisplayLabel, type ZoneLayer } from "./zone-layers.ts";
import { presentZone } from "./zone-presentation.ts";

/**
 * The body `/api/hunt/zone` returns for a resolved zone.
 *
 * Identity first, presentation beside it. The zone's display geometry is
 * included only when the caller asks (`includeGeometry: true`): it is up to
 * ~78 KB for a large unit and only the current map's hunt-zone highlight uses
 * it. A default request carries no rings.
 */
export function resolvedZoneBody(resolution: ZoneResolution, layer: ZoneLayer, { includeGeometry = false } = {}) {
  const zoneName = designationFromOfficialName(layer, resolution.officialName);
  return {
    status: "RESOLVED" as const,
    zone: {
      id: resolution.zoneId,
      layerId: layer.id,
      designation: zoneName,
      officialName: resolution.officialName,
      shortLabel: zoneName ? zoneDisplayLabel(layer, zoneName) : resolution.officialName,
      // Presentation for the primary locale, beside — never instead of — the identity above.
      presentation: zoneName
        ? presentZone({ designation: zoneName, layerId: layer.id, jurisdictionId: layer.jurisdictionId,
            zoneId: resolution.zoneId, officialName: resolution.officialName })
        : null,
      coverage: zoneCoverage(layer, zoneName),
      boundaryDistanceMeters: resolution.boundaryDistanceMeters,
      nearBoundary: resolution.nearBoundary,
      ...(includeGeometry ? { displayRings: resolution.displayRings } : {}),
      message: resolution.message,
    },
    layer: {
      jurisdictionId: layer.jurisdictionId,
      jurisdictionName: layer.jurisdictionName,
      officialTerm: layer.officialTerm,
      officialTermShort: layer.officialTermShort,
      authority: layer.authority,
      sourceId: layer.sourceId,
    },
  };
}
