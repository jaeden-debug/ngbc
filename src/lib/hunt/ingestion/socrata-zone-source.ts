import type { LegalStanding } from "../zone-layers.ts";
import type { QuarantinedFeature, ZoneFeatureRecord, ZoneLayerSource } from "./types.ts";

/**
 * Authorities that publish their hunting geography on Socrata.
 *
 * Nova Scotia is the first. Unlike the ArcGIS and WFS authorities, Socrata
 * publishes one row per POLYGON PART rather than one per zone: Nova Scotia's
 * twelve deer management zones arrive as 234 rows. Reading a row as a zone
 * would invent 234 zones out of twelve, so parts are grouped by the
 * authority's own designation and merged into one MultiPolygon each, and the
 * expected part count per zone is declared so a silent change to the
 * authority's parts fails the ingest rather than passing unnoticed.
 */

export interface SocrataZoneSourceConfig {
  layerId: string;
  jurisdictionCanonicalId: string;
  officialTerm: string;
  officialTermShort: string;
  zoneType: ZoneLayerSource["zoneType"];
  authority: string;
  sourceCanonicalId: string;
  /** The dataset's host, e.g. `data.novascotia.ca`. */
  host: string;
  /** The dataset's four-by-four identifier, e.g. `m6qa-i3w9`. */
  datasetId: string;
  /** The geometry column, for spatial filters (`the_geom`). */
  geometryField: string;
  /** The column holding the authority's designation for a zone. */
  idField: string;
  /** Other columns worth keeping for provenance; the id column is always kept. */
  keepFields?: string[];
  /** The designation for a raw value, or null when the row is not a zone. */
  normalise?: (raw: unknown) => string | null;
  zoneIdPrefix: string;
  officialNamePrefix: string;
  /** Rows the authority publishes, counted at review. */
  expectedRecords: number;
  /** Zones those rows group into. */
  expectedUnits: number;
  /** How many rows each zone is published as, so a change to the parts is caught. */
  multipartUnits: Readonly<Record<string, number>>;
  sourceVersion: string;
  legalStanding: LegalStanding;
  timeZone?: string;
  pageSize?: number;
}

type Row = Record<string, unknown> & { the_geom?: unknown };

function isPolygonal(value: unknown): value is { type: "Polygon" | "MultiPolygon"; coordinates: unknown } {
  const geometry = value as { type?: unknown; coordinates?: unknown } | null;
  return Boolean(geometry) && (geometry?.type === "Polygon" || geometry?.type === "MultiPolygon") && Array.isArray(geometry?.coordinates);
}

/** Every part of a zone, as one MultiPolygon in the order the authority served them. */
function mergeParts(parts: Array<{ type: string; coordinates: unknown }>): { type: "MultiPolygon"; coordinates: unknown } {
  const polygons: unknown[] = [];
  for (const part of parts) {
    if (part.type === "Polygon") polygons.push(part.coordinates);
    else for (const polygon of part.coordinates as unknown[]) polygons.push(polygon);
  }
  return { type: "MultiPolygon", coordinates: polygons };
}

function boundsOf(geometry: { coordinates: unknown }): [number, number, number, number] {
  let west = 180, south = 90, east = -180, north = -90;
  const walk = (value: unknown): void => {
    if (Array.isArray(value) && typeof value[0] === "number" && typeof value[1] === "number") {
      const [longitude, latitude] = value as [number, number];
      west = Math.min(west, longitude); east = Math.max(east, longitude);
      south = Math.min(south, latitude); north = Math.max(north, latitude);
      return;
    }
    if (Array.isArray(value)) for (const inner of value) walk(inner);
  };
  walk(geometry.coordinates);
  return [west, south, east, north];
}

function countVertices(value: unknown): number {
  if (Array.isArray(value) && typeof value[0] === "number") return 1;
  return Array.isArray(value) ? value.reduce((total: number, inner) => total + countVertices(inner), 0) : 0;
}

export function createSocrataZoneSource(config: SocrataZoneSourceConfig, fetcher: typeof fetch = fetch): ZoneLayerSource {
  const base = `https://${config.host}/resource/${config.datasetId}`;
  const designationOf = (raw: unknown): string | null =>
    config.normalise ? config.normalise(raw) : (typeof raw === "string" && raw.trim() ? raw.trim() : null);
  const canonicalZoneId = (identifier: string) =>
    `${config.zoneIdPrefix}${identifier.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-")}`;

  return {
    layerId: config.layerId,
    jurisdictionCanonicalId: config.jurisdictionCanonicalId,
    officialTerm: config.officialTerm,
    officialTermShort: config.officialTermShort,
    zoneType: config.zoneType,
    authority: config.authority,
    sourceCanonicalId: config.sourceCanonicalId,
    sourceUrl: `${base}.geojson`,
    timeZone: config.timeZone,
    canonicalZoneId,
    officialName: (identifier) => `${config.officialNamePrefix}${identifier}`,

    /** The authority's own answer at a point, for parity certification. */
    async officialIdentifiersAt(latitude, longitude) {
      const url = new URL(`${base}.json`);
      url.searchParams.set("$select", config.idField);
      url.searchParams.set("$where", `intersects(${config.geometryField}, 'POINT(${longitude} ${latitude})')`);
      const response = await fetcher(url, { headers: { accept: "application/json" } });
      if (!response.ok) throw new Error(`${config.layerId}: the authority answered ${response.status} for a point`);
      const rows = await response.json() as Array<Record<string, unknown>>;
      return [...new Set(rows.map((row) => designationOf(row[config.idField])).filter((id): id is string => Boolean(id)))].sort();
    },

    async fetchFeatures() {
      const pageSize = config.pageSize ?? 1_000;
      const rows: Row[] = [];
      for (let offset = 0; ; offset += pageSize) {
        const url = new URL(`${base}.geojson`);
        url.searchParams.set("$limit", String(pageSize));
        url.searchParams.set("$offset", String(offset));
        url.searchParams.set("$order", ":id");
        const response = await fetcher(url, { headers: { accept: "application/geo+json, application/json" } });
        if (!response.ok) throw new Error(`${config.layerId}: the authority answered ${response.status}`);
        const payload = await response.json() as { features?: Array<{ properties?: Row; geometry?: unknown }> };
        const page = payload.features ?? [];
        for (const feature of page) rows.push({ ...(feature.properties ?? {}), the_geom: feature.geometry });
        if (page.length < pageSize) break;
      }

      if (rows.length !== config.expectedRecords) {
        throw new Error(`${config.layerId}: the authority served ${rows.length} rows; ${config.expectedRecords} were reviewed`);
      }

      const quarantined: QuarantinedFeature[] = [];
      const grouped = new Map<string, { parts: Array<{ type: string; coordinates: unknown }>; attributes: Record<string, unknown>; rows: number }>();
      rows.forEach((row, index) => {
        const identifier = designationOf(row[config.idField]);
        const geometry = row.the_geom;
        if (!identifier || !isPolygonal(geometry)) {
          const bbox: [number, number, number, number] = isPolygonal(geometry) ? boundsOf(geometry) : [0, 0, 0, 0];
          quarantined.push({
            sourceFeatureId: `row:${index}`,
            reason: identifier
              ? `Row ${index} carries no polygonal geometry.`
              : `Row ${index} carries no ${config.idField} the regulation defines, so it names no zone.`,
            attributes: { ...row, the_geom: undefined },
            bbox,
            vertices: isPolygonal(geometry) ? countVertices(geometry.coordinates) : 0,
          });
          return;
        }
        const group = grouped.get(identifier) ?? { parts: [], attributes: {}, rows: 0 };
        group.parts.push(geometry as { type: string; coordinates: unknown });
        group.rows += 1;
        for (const field of [config.idField, ...(config.keepFields ?? [])]) {
          if (row[field] !== undefined && group.attributes[field] === undefined) group.attributes[field] = row[field];
        }
        grouped.set(identifier, group);
      });

      if (grouped.size !== config.expectedUnits) {
        throw new Error(`${config.layerId}: rows grouped into ${grouped.size} zones; ${config.expectedUnits} were reviewed`);
      }
      /* A zone quietly gaining or losing parts is a change to the authority's
         geography, not a detail: it fails here rather than being published. */
      const actual = Object.fromEntries([...grouped].map(([id, group]): [string, number] => [id, group.rows]).sort(([a], [b]) => a.localeCompare(b)));
      const expected = Object.fromEntries(Object.entries(config.multipartUnits).sort(([a], [b]) => a.localeCompare(b)));
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`${config.layerId}: parts per zone changed: ${JSON.stringify(actual)}; reviewed ${JSON.stringify(expected)}`);
      }

      const ids = new Map<string, string>();
      for (const identifier of grouped.keys()) {
        const id = canonicalZoneId(identifier);
        const other = ids.get(id);
        if (other) throw new Error(`${config.layerId}: zones ${other} and ${identifier} would share the id ${id}`);
        ids.set(id, identifier);
      }

      const features: ZoneFeatureRecord[] = [...grouped].map(([identifier, group]) => ({
        sourceFeatureId: identifier,
        officialIdentifier: identifier,
        attributes: group.attributes,
        geometry: mergeParts(group.parts),
      }));
      return { features, sourceVersion: config.sourceVersion, quarantined };
    },
  };
}
