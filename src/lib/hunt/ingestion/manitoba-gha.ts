import { HUNT_DEFAULT_TIME_ZONE, jurisdictionTodayIso } from "../date.ts";
import type { QuarantinedFeature, ZoneFeatureRecord, ZoneLayerSource } from "./types.ts";

/**
 * Manitoba Game Hunting Areas — the province's own term, kept as written.
 *
 * Two official services publish this geography. The one used here is the
 * dedicated "Manitoba Game Hunting Areas" product, which the government
 * describes as "an accurate representation of the game hunting boundaries in
 * Manitoba". The other (`CWD_GHA`) is a copy embedded in the chronic wasting
 * disease map: same 63 records and areas equal to within 0.03 km², but not one
 * geometry is identical and 32 of them carry fewer vertices. A surveillance
 * map's derivative is not the source of a boundary, so it is not read here.
 *
 * Both services attach the same warning, and it governs how the result may be
 * used: Game Hunting Areas are defined by the Hunting Areas and Zones
 * Regulation, M.R. 220/86, and the government directs readers to that
 * regulation for boundary descriptions. The geometry is the authority's
 * rendering of written law, not a survey.
 *
 * The layer carries 63 polygons for 62 areas. The 63rd has no designation. Its
 * extent is Riding Mountain National Park, which M.R. 220/86 draws GHAs 23 and
 * 23A around rather than through, so it is a hole in the hunting-area system,
 * not an area with a missing label. The adapter never guesses what an
 * undesignated polygon is: it quarantines it with its location and says why.
 */

export const MANITOBA_GHA_SERVICE =
  "https://services.arcgis.com/mMUesHYPkXjaFGfS/arcgis/rest/services/Manitoba_Game_Hunting_Areas/FeatureServer/0";
export const MANITOBA_GHA_QUERY = `${MANITOBA_GHA_SERVICE}/query`;

/* Largest areas run to ~40,000 vertices, so pages are small. */
const PAGE_SIZE = 8;
const ATTEMPTS = 3;

interface EsriGeoJson {
  type?: string;
  features?: Array<{
    id?: number;
    properties?: Record<string, unknown>;
    geometry?: { type: string; coordinates: unknown } | null;
  }>;
  error?: { code?: number; message?: string };
}

async function request<T>(url: string, fetcher: typeof fetch): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      const response = await fetcher(url, {
        headers: { accept: "application/geo+json, application/json" },
        signal: AbortSignal.timeout(120_000),
        cache: "no-store",
      });
      // A 4xx will not improve on retry; a 5xx or a dropped connection might.
      if (response.status >= 400 && response.status < 500) {
        throw Object.assign(new Error(`Manitoba GHA service returned ${response.status}`), { permanent: true });
      }
      if (!response.ok) throw new Error(`Manitoba GHA service returned ${response.status}`);
      const payload = await response.json() as T & { error?: { message?: string } };
      /* ArcGIS reports query errors inside a 200 response. */
      if (payload && typeof payload === "object" && "error" in payload && payload.error) {
        throw Object.assign(new Error(`Manitoba GHA service error: ${payload.error.message ?? "unknown"}`), { permanent: true });
      }
      return payload;
    } catch (error) {
      lastError = error;
      if ((error as { permanent?: boolean }).permanent || attempt === ATTEMPTS) break;
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Manitoba GHA service could not be read");
}

function queryUrl(parameters: Record<string, string>): string {
  return `${MANITOBA_GHA_QUERY}?${new URLSearchParams(parameters)}`;
}

function asMultiPolygon(geometry: { type: string; coordinates: unknown }): ZoneFeatureRecord["geometry"] {
  return geometry.type === "MultiPolygon"
    ? { type: "MultiPolygon", coordinates: geometry.coordinates }
    : { type: "MultiPolygon", coordinates: [geometry.coordinates] };
}

function extentOf(geometry: ZoneFeatureRecord["geometry"]): { bbox: QuarantinedFeature["bbox"]; vertices: number } {
  let west = Infinity; let south = Infinity; let east = -Infinity; let north = -Infinity; let vertices = 0;
  for (const polygon of geometry.coordinates as number[][][][]) {
    for (const ring of polygon) {
      for (const [longitude, latitude] of ring) {
        vertices += 1;
        west = Math.min(west, longitude); east = Math.max(east, longitude);
        south = Math.min(south, latitude); north = Math.max(north, latitude);
      }
    }
  }
  return { bbox: [west, south, east, north], vertices };
}

/** "13a" and " 13A " are the same area; the authority writes upper case. */
export function normaliseGhaDesignation(value: unknown): string {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

export function createManitobaGhaSource(fetcher: typeof fetch = fetch): ZoneLayerSource {
  return {
    layerId: "layer:ca-mb-gha",
    jurisdictionCanonicalId: "jurisdiction:ca-mb",
    officialTerm: "Game Hunting Area",
    officialTermShort: "GHA",
    /* The normalised type is a hunting zone. The official term above is what a
       reader sees; nothing relabels a GHA as a WMU. */
    zoneType: "ZONE",
    authority: "Manitoba Natural Resources and Indigenous Futures",
    sourceCanonicalId: "source:ca-mb-gha-service",
    sourceUrl: MANITOBA_GHA_SERVICE,

    canonicalZoneId: (identifier) =>
      `management_zone:ca-mb-gha-${normaliseGhaDesignation(identifier).toLowerCase().replace(/[^a-z0-9-]+/g, "-")}`,
    officialName: (identifier) => `Game Hunting Area ${normaliseGhaDesignation(identifier)}`,

    /* What the province's own service reports at a point. The undesignated park
       polygon answers with a blank GHA; it is filtered out exactly as it is
       quarantined from staging, so "no hunting area here" means the same thing
       on both sides of a parity check. */
    async officialIdentifiersAt(latitude, longitude) {
      const payload = await request<EsriGeoJson>(
        queryUrl({
          geometry: `${longitude},${latitude}`,
          geometryType: "esriGeometryPoint",
          inSR: "4326",
          spatialRel: "esriSpatialRelIntersects",
          outFields: "GHA",
          returnGeometry: "false",
          f: "geojson",
        }),
        fetcher,
      );
      return (payload.features ?? [])
        .map((feature) => normaliseGhaDesignation(feature.properties?.GHA))
        .filter(Boolean)
        .sort(compareGhaDesignations);
    },

    async fetchFeatures() {
      /* The authority's own version signal: when the layer's data last changed.
         Two reads of an unchanged layer carry the same version. */
      const metadata = await request<{ editingInfo?: { dataLastEditDate?: number } }>(
        `${MANITOBA_GHA_SERVICE}?f=json`, fetcher,
      );
      const edited = metadata.editingInfo?.dataLastEditDate;

      const { count } = await request<{ count?: number }>(
        queryUrl({ where: "1=1", returnCountOnly: "true", f: "json" }), fetcher,
      );
      if (typeof count !== "number" || count < 1) throw new Error("Manitoba GHA service reported no features");

      const { objectIds } = await request<{ objectIds?: number[] }>(
        queryUrl({ where: "1=1", returnIdsOnly: "true", f: "json" }), fetcher,
      );
      const ids = [...new Set(objectIds ?? [])].sort((left, right) => left - right);
      if (ids.length !== count) {
        throw new Error(`Manitoba GHA service listed ${ids.length} feature ids but counts ${count}; refusing a partial read`);
      }

      const features: ZoneFeatureRecord[] = [];
      const quarantined: QuarantinedFeature[] = [];
      const seenIds = new Set<number>();
      const seenDesignations = new Map<string, number>();

      /* Requested by explicit id rather than by offset, so a page boundary can
         neither repeat one feature nor skip another. */
      for (let index = 0; index < ids.length; index += PAGE_SIZE) {
        const batch = ids.slice(index, index + PAGE_SIZE);
        const page = await request<EsriGeoJson>(
          queryUrl({
            objectIds: batch.join(","),
            outFields: "OBJECTID,GHA",
            returnGeometry: "true",
            /* Natively Web Mercator. The service reprojects, so the authority
               performs the transform rather than North Ground. */
            outSR: "4326",
            f: "geojson",
          }),
          fetcher,
        );

        for (const row of page.features ?? []) {
          const properties = row.properties ?? {};
          const objectId = Number(properties.OBJECTID ?? row.id);
          if (!Number.isInteger(objectId) || !batch.includes(objectId)) {
            throw new Error(`Manitoba GHA service returned an unrequested feature (${String(objectId)})`);
          }
          if (seenIds.has(objectId)) throw new Error(`Manitoba GHA feature ${objectId} arrived twice`);
          seenIds.add(objectId);

          const geometry = row.geometry;
          if (!geometry || (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon")) {
            throw new Error(`Manitoba GHA feature ${objectId} has no polygon geometry`);
          }
          const multi = asMultiPolygon(geometry);
          const designation = normaliseGhaDesignation(properties.GHA);

          if (!designation) {
            quarantined.push({
              sourceFeatureId: String(objectId),
              reason: "The feature carries no Game Hunting Area designation, so it is not staged as a hunting area.",
              attributes: { GHA: properties.GHA ?? null },
              ...extentOf(multi),
            });
            continue;
          }

          const previous = seenDesignations.get(designation);
          if (previous !== undefined) {
            throw new Error(`GHA ${designation} is published twice (features ${previous} and ${objectId}); refusing to stage`);
          }
          seenDesignations.set(designation, objectId);

          features.push({
            sourceFeatureId: String(objectId),
            officialIdentifier: designation,
            attributes: { objectId, sourceCrs: "EPSG:3857", polygonCount: (multi.coordinates as unknown[]).length },
            geometry: multi,
          });
        }
      }

      if (seenIds.size !== count) {
        throw new Error(`Manitoba GHA read received ${seenIds.size} of ${count} features; refusing a partial read`);
      }

      features.sort((left, right) => compareGhaDesignations(left.officialIdentifier, right.officialIdentifier));

      const retrievedOn = jurisdictionTodayIso(HUNT_DEFAULT_TIME_ZONE);
      return {
        features,
        quarantined,
        sourceVersion: edited
          ? `data-${new Date(edited).toISOString().slice(0, 10)}`
          : `retrieved-${retrievedOn}`,
      };
    },
  };
}

/**
 * The authority's own ordering: 1, 2, 2A, 3, 3A, 4, … 34, 34A, 34B, 34C, 35.
 *
 * This is not cosmetic. M.R. 165/91 writes ranges such as "Areas 5-7" and
 * "12-14, 14A", and the published guide shows those ranges covering every area
 * that sorts between the two ends in this order — 5, 6, 6A, 7 but not 7A — so
 * the same ordering is what expands them.
 */
export function compareGhaDesignations(left: string, right: string): number {
  const parse = (value: string) => {
    const match = /^(\d+)([A-Z]*)$/.exec(value);
    return match ? { number: Number(match[1]), suffix: match[2] } : { number: Number.MAX_SAFE_INTEGER, suffix: value };
  };
  const a = parse(left);
  const b = parse(right);
  if (a.number !== b.number) return a.number - b.number;
  return a.suffix < b.suffix ? -1 : a.suffix > b.suffix ? 1 : 0;
}
