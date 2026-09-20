import type { ZoneFeatureRecord, ZoneLayerSource } from "./types.ts";

/**
 * Government of Ontario Wildlife Management Unit layer.
 *
 * The service caps a response at 2,000 records but the real constraint is size:
 * Ontario's 151 units carry roughly 1.3 million vertices, so features are drawn in
 * small offset pages rather than one request. Geometry is requested in EPSG:4326
 * even though the layer is natively NAD83, because the projection is the
 * authority's own and re-projecting locally would put North Ground between the
 * authority and its own boundary.
 */

export const ONTARIO_WMU_QUERY =
  "https://ws.lioservices.lrc.gov.on.ca/arcgis2/rest/services/LIO_OPEN_DATA/LIO_Open05/MapServer/5/query";

const PAGE_SIZE = 8;
const OUT_FIELDS = "OGF_ID,OFFICIAL_NAME,LOCATION_ACCURACY,VERIFICATION_STATUS_FLG,SYSTEM_CALCULATED_AREA,EFFECTIVE_DATETIME";

/**
 * The registry column is MultiPolygon, and the service returns whichever of
 * Polygon or MultiPolygon a given unit happens to be. Promoting a Polygon to a
 * single-member MultiPolygon is lossless and keeps one shape in the database, so
 * every zone is queried and simplified the same way.
 */
function asMultiPolygon(geometry: { type: string; coordinates: unknown }): ZoneFeatureRecord["geometry"] {
  if (geometry.type === "MultiPolygon") {
    return { type: "MultiPolygon", coordinates: geometry.coordinates };
  }
  return { type: "MultiPolygon", coordinates: [geometry.coordinates] };
}

interface EsriGeoJson {
  type: string;
  features?: Array<{
    properties?: Record<string, unknown>;
    geometry?: { type: string; coordinates: unknown } | null;
  }>;
}

async function fetchPage(offset: number, fetcher: typeof fetch): Promise<EsriGeoJson> {
  const parameters = new URLSearchParams({
    where: "1=1",
    outFields: OUT_FIELDS,
    returnGeometry: "true",
    outSR: "4326",
    orderByFields: "OGF_ID",
    resultOffset: String(offset),
    resultRecordCount: String(PAGE_SIZE),
    f: "geojson",
  });
  const response = await fetcher(`${ONTARIO_WMU_QUERY}?${parameters}`, {
    headers: { accept: "application/geo+json, application/json" },
    signal: AbortSignal.timeout(120_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Ontario WMU service returned ${response.status} at offset ${offset}`);
  return await response.json() as EsriGeoJson;
}

export function createOntarioWmuSource(fetcher: typeof fetch = fetch): ZoneLayerSource {
  return {
    layerId: "layer:ca-on-wmu",
    jurisdictionCanonicalId: "jurisdiction:ca-on",
    officialTerm: "Wildlife Management Unit",
    officialTermShort: "WMU",
    zoneType: "WMU",
    authority: "Ontario Ministry of Natural Resources",
    sourceCanonicalId: "source:ca-on-wmu-service",
    sourceUrl: ONTARIO_WMU_QUERY.replace("/query", ""),

    // Sub-unit designations carry letters and hyphens ("69A-1"), so the canonical
    // id lower-cases and keeps them rather than coercing to a number.
    canonicalZoneId: (identifier) =>
      `management_zone:ca-on-wmu-${identifier.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-")}`,
    officialName: (identifier) => `Wildlife Management Unit ${identifier.trim()}`,

    async fetchFeatures() {
      const features: ZoneFeatureRecord[] = [];
      const seen = new Set<string>();

      for (let offset = 0; ; offset += PAGE_SIZE) {
        const page = await fetchPage(offset, fetcher);
        const rows = page.features ?? [];
        if (!rows.length) break;

        for (const row of rows) {
          const properties = row.properties ?? {};
          const sourceFeatureId = properties.OGF_ID === undefined || properties.OGF_ID === null
            ? "" : String(properties.OGF_ID);
          const officialIdentifier = typeof properties.OFFICIAL_NAME === "string"
            ? properties.OFFICIAL_NAME.trim() : "";
          const geometry = row.geometry;

          if (!sourceFeatureId || !officialIdentifier || !geometry) continue;
          if (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") continue;
          if (seen.has(sourceFeatureId)) continue;
          seen.add(sourceFeatureId);

          features.push({
            sourceFeatureId,
            officialIdentifier,
            attributes: {
              locationAccuracy: properties.LOCATION_ACCURACY ?? null,
              verificationStatus: properties.VERIFICATION_STATUS_FLG ?? null,
              sourceAreaSquareMetres: properties.SYSTEM_CALCULATED_AREA ?? null,
              effectiveDatetime: properties.EFFECTIVE_DATETIME ?? null,
            },
            geometry: asMultiPolygon(geometry),
          });
        }

        if (rows.length < PAGE_SIZE) break;
      }

      return { features, sourceVersion: `retrieved-${new Date().toISOString().slice(0, 10)}` };
    },
  };
}
