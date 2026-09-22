import type { QuarantinedFeature, ZoneFeatureRecord, ZoneLayerSource } from "./types.ts";

/**
 * Government of Alberta Wildlife Management Unit layer.
 *
 * Alberta publishes 199 polygon records, and they are not 199 WMUs. Measured
 * against the live service on 2026-09-20:
 *
 *   - 189 named WMUs, each with a five-digit zero-padded code (00102 → WMU 102);
 *   - three of them split across several records — 718 Writing-On-Stone
 *     Provincial Park (6), 728 West Wainwright (3) and 794 Evans-Thomas
 *     Recreation Area (3) — which are one unit each and are grouped into one
 *     MultiPolygon;
 *   - one record with a blank code and name. It is Elk Island National Park of
 *     Canada: its interior point falls inside Parks Canada's legal boundary
 *     (NRCan CLSS "National Parks and National Park Reserves of Canada
 *     Legislative Boundaries", adminAreaId ELKI, accuracy better than 10 m), and
 *     the two areas agree to 0.24% (193.15 km² here, 192.68 km² federal). It is
 *     federal land that no provincial WMU describes, so it is quarantined rather
 *     than given an invented identifier. A point inside it resolves to no WMU.
 *
 * Every one of those facts is checked on each fetch. A different blank record, a
 * new multipart unit or a count change is a boundary event a person must review,
 * so the adapter refuses rather than normalising around it.
 *
 * Legal standing: Alberta states that its WMU boundaries are "small-scale
 * approximations of the actual units legally described in the Wildlife
 * Regulation (AR 143/97) and subsequent amendments". The geometry is official
 * and suitable for locating a point; the written descriptions control.
 *
 * The service is natively EPSG:3400. Geometry is requested in EPSG:4326 so the
 * authority performs the projection North Ground uses.
 */

export const ALBERTA_WMU_LAYER =
  "https://geospatial.alberta.ca/mimas/rest/services/boundaries/fishwild_wildlife_mgmt_unit_public/FeatureServer/0";
export const ALBERTA_WMU_QUERY = `${ALBERTA_WMU_LAYER}/query`;

const OUT_FIELDS = "OBJECTID,GlobalID,WMUNIT_CODE,WMUNIT_NAME,Shape__Area,Shape__Length";
const EXPECTED_SOURCE_RECORDS = 199;
const EXPECTED_NAMED_UNITS = 189;

/** Units the authority publishes as several records, and how many. */
export const ALBERTA_MULTIPART_UNITS: Readonly<Record<string, number>> = { "718": 6, "728": 3, "794": 3 };

/** The one blank record, identified as Elk Island National Park of Canada. */
export const ALBERTA_ELK_ISLAND_RECORD = {
  globalId: "{82103B05-7CAF-4648-A550-5D70B8C51BFC}",
  areaSquareMetres: 193_150_607,
  reason:
    "Blank WMUNIT_CODE and WMUNIT_NAME. Identified as Elk Island National Park of Canada (federal): its interior " +
    "point lies inside Parks Canada's legal boundary (NRCan CLSS adminAreaId ELKI) and the areas agree to 0.24%. " +
    "Not a provincial WMU; no identifier is invented for it.",
} as const;

export const ALBERTA_LOCATION_ACCURACY =
  "Small-scale approximation. Alberta states the legal WMU descriptions are in the Wildlife Regulation " +
  "(AR 143/97) and subsequent amendments, and those prevail over the map.";

interface AlbertaFeatureCollection {
  type?: string;
  features?: Array<{
    properties?: Record<string, unknown>;
    geometry?: { type: string; coordinates: unknown } | null;
  }>;
  error?: { message?: string };
}

type PolygonCoordinates = unknown[];

function polygonParts(geometry: { type: string; coordinates: unknown }): PolygonCoordinates[] {
  if (!Array.isArray(geometry.coordinates)) return [];
  if (geometry.type === "Polygon") return [geometry.coordinates];
  if (geometry.type === "MultiPolygon") return geometry.coordinates;
  return [];
}

/** The service stores a five-character zero-padded code; Alberta displays 102, 539, etc. */
export function normalizeAlbertaWmuCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!/^\d{5}$/.test(raw)) return null;
  const normalized = String(Number(raw));
  return /^\d{3}$/.test(normalized) ? normalized : null;
}

function blank(value: unknown): boolean {
  return typeof value !== "string" || value.trim() === "";
}

export function createAlbertaWmuSource(fetcher: typeof fetch = fetch): ZoneLayerSource {
  return {
    layerId: "layer:ca-ab-wmu",
    jurisdictionCanonicalId: "jurisdiction:ca-ab",
    officialTerm: "Wildlife Management Unit",
    officialTermShort: "WMU",
    zoneType: "WMU",
    authority: "Government of Alberta",
    sourceCanonicalId: "source:ca-ab-wmu-service",
    sourceUrl: ALBERTA_WMU_LAYER,
    canonicalZoneId: (identifier) => `management_zone:ca-ab-wmu-${identifier.trim()}`,
    officialName: (identifier) => `Wildlife Management Unit ${identifier.trim()}`,

    async officialIdentifiersAt(latitude, longitude) {
      const parameters = new URLSearchParams({
        where: "1=1",
        geometry: `${longitude},${latitude}`,
        geometryType: "esriGeometryPoint",
        inSR: "4326",
        spatialRel: "esriSpatialRelIntersects",
        outFields: "WMUNIT_CODE",
        returnGeometry: "false",
        f: "json",
      });
      const response = await fetcher(`${ALBERTA_WMU_QUERY}?${parameters}`, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Alberta WMU service returned ${response.status}`);
      const payload = await response.json() as { features?: Array<{ attributes?: Record<string, unknown> }>; error?: { message?: string } };
      if (payload.error) throw new Error(`Alberta WMU service error: ${payload.error.message ?? "unknown error"}`);
      // The quarantined Elk Island record has a blank code and normalises to
      // nothing, exactly as it is absent from the registry.
      return [...new Set((payload.features ?? [])
        .map(({ attributes }) => normalizeAlbertaWmuCode(attributes?.WMUNIT_CODE))
        .filter((code): code is string => code !== null))].sort();
    },

    async fetchFeatures() {
      const countParameters = new URLSearchParams({ where: "1=1", returnCountOnly: "true", f: "json" });
      const countResponse = await fetcher(`${ALBERTA_WMU_QUERY}?${countParameters}`, {
        headers: { accept: "application/json" }, signal: AbortSignal.timeout(30_000), cache: "no-store",
      });
      if (!countResponse.ok) throw new Error(`Alberta WMU count service returned ${countResponse.status}`);
      const countPayload = await countResponse.json() as { count?: number; error?: { message?: string } };
      if (countPayload.error) throw new Error(`Alberta WMU service error: ${countPayload.error.message ?? "unknown error"}`);
      if (countPayload.count !== EXPECTED_SOURCE_RECORDS) {
        throw new Error(
          `Alberta WMU source returned ${countPayload.count ?? "no count"} records; expected ${EXPECTED_SOURCE_RECORDS}`,
        );
      }
      const parameters = new URLSearchParams({
        where: "1=1",
        outFields: OUT_FIELDS,
        returnGeometry: "true",
        outSR: "4326",
        orderByFields: "WMUNIT_CODE,OBJECTID",
        resultRecordCount: "1000",
        f: "geojson",
      });
      const response = await fetcher(`${ALBERTA_WMU_QUERY}?${parameters}`, {
        headers: { accept: "application/geo+json, application/json" },
        signal: AbortSignal.timeout(120_000),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Alberta WMU service returned ${response.status}`);
      const payload = await response.json() as AlbertaFeatureCollection;
      if (payload.error) throw new Error(`Alberta WMU service error: ${payload.error.message ?? "unknown error"}`);
      const rows = payload.features ?? [];
      if (rows.length !== EXPECTED_SOURCE_RECORDS) {
        throw new Error(`Alberta WMU source returned ${rows.length} records; expected ${EXPECTED_SOURCE_RECORDS}`);
      }

      const grouped = new Map<string, {
        name: string;
        components: string[];
        globalIds: string[];
        sourceAreaSquareMetres: number;
        sourceLengthMetres: number;
        polygons: PolygonCoordinates[];
      }>();
      const quarantined: QuarantinedFeature[] = [];

      for (const row of rows) {
        const properties = row.properties ?? {};
        const globalId = String(properties.GlobalID ?? "").trim();
        const objectId = String(properties.OBJECTID ?? "").trim();
        if (!objectId || !globalId) throw new Error("Alberta WMU source record is missing its OBJECTID or GlobalID");

        if (blank(properties.WMUNIT_CODE) && blank(properties.WMUNIT_NAME)) {
          const area = Number(properties.Shape__Area ?? 0);
          const drift = Math.abs(area - ALBERTA_ELK_ISLAND_RECORD.areaSquareMetres) / ALBERTA_ELK_ISLAND_RECORD.areaSquareMetres;
          if (globalId !== ALBERTA_ELK_ISLAND_RECORD.globalId || drift > 0.005) {
            throw new Error(
              `Alberta WMU source has an unrecognised blank record ${globalId} (${(area / 1e6).toFixed(2)} km²); ` +
              "identify it before ingesting",
            );
          }
          const coordinates = row.geometry ? polygonParts(row.geometry).flat(2) as number[][] : [];
          const longitudes = coordinates.map(([longitude]) => longitude);
          const latitudes = coordinates.map(([, latitude]) => latitude);
          quarantined.push({
            sourceFeatureId: `GlobalID:${globalId}`,
            reason: ALBERTA_ELK_ISLAND_RECORD.reason,
            attributes: { ...properties },
            bbox: [Math.min(...longitudes), Math.min(...latitudes), Math.max(...longitudes), Math.max(...latitudes)],
            vertices: coordinates.length,
          });
          continue;
        }

        const identifier = normalizeAlbertaWmuCode(properties.WMUNIT_CODE);
        const name = typeof properties.WMUNIT_NAME === "string" ? properties.WMUNIT_NAME.trim() : "";
        if (!identifier || !name) {
          throw new Error(`Alberta WMU record ${globalId} has an unreadable code or a missing name`);
        }
        const geometry = row.geometry;
        if (!geometry || (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon")) {
          throw new Error(`Alberta WMU ${identifier} has no usable polygon geometry`);
        }
        const parts = polygonParts(geometry);
        if (!parts.length) throw new Error(`Alberta WMU ${identifier} has empty polygon geometry`);

        const current = grouped.get(identifier) ?? {
          name,
          components: [],
          globalIds: [],
          sourceAreaSquareMetres: 0,
          sourceLengthMetres: 0,
          polygons: [],
        };
        if (current.name !== name) {
          throw new Error(`Alberta WMU ${identifier} has conflicting names: ${current.name} / ${name}`);
        }
        current.components.push(objectId);
        current.globalIds.push(globalId);
        current.sourceAreaSquareMetres += Number(properties.Shape__Area ?? 0);
        current.sourceLengthMetres += Number(properties.Shape__Length ?? 0);
        current.polygons.push(...parts);
        grouped.set(identifier, current);
      }

      if (quarantined.length !== 1) {
        throw new Error(`Alberta WMU source contained ${quarantined.length} blank records; expected exactly the Elk Island record`);
      }
      if (grouped.size !== EXPECTED_NAMED_UNITS) {
        throw new Error(`Alberta WMU source normalised to ${grouped.size} named units; expected ${EXPECTED_NAMED_UNITS}`);
      }
      const multipart = Object.fromEntries(
        [...grouped].filter(([, group]) => group.components.length > 1).map(([id, group]) => [id, group.components.length]),
      );
      if (JSON.stringify(multipart) !== JSON.stringify(ALBERTA_MULTIPART_UNITS)) {
        throw new Error(
          `Alberta WMU multipart structure changed: ${JSON.stringify(multipart)}; expected ${JSON.stringify(ALBERTA_MULTIPART_UNITS)}`,
        );
      }
      const names = new Map<string, string>();
      for (const [identifier, group] of grouped) {
        const other = names.get(group.name);
        if (other) throw new Error(`Alberta WMUs ${other} and ${identifier} share the name ${group.name}`);
        names.set(group.name, identifier);
      }

      const features: ZoneFeatureRecord[] = [...grouped.entries()]
        .sort(([left], [right]) => Number(left) - Number(right))
        .map(([officialIdentifier, group]) => ({
          sourceFeatureId: `WMUNIT_CODE:${officialIdentifier}`,
          officialIdentifier,
          attributes: {
            officialUnitName: group.name,
            componentObjectIds: group.components,
            componentGlobalIds: group.globalIds,
            componentCount: group.components.length,
            sourceAreaSquareMetres: group.sourceAreaSquareMetres,
            sourceLengthMetres: group.sourceLengthMetres,
            sourceCrs: "EPSG:3400",
            legalStanding: "OFFICIAL_BUT_INDICATIVE",
            locationAccuracy: ALBERTA_LOCATION_ACCURACY,
          },
          geometry: { type: "MultiPolygon", coordinates: group.polygons },
        }));

      return { features, quarantined, sourceVersion: "Alberta open-data metadata modified 2026-03-04" };
    },
  };
}
