import type { QuarantinedFeature, ZoneFeatureRecord, ZoneLayerSource } from "./types.ts";

/**
 * A declarative adapter for an authority that publishes its hunting geography
 * as an ArcGIS feature layer — which most U.S. states do.
 *
 * Ontario, Manitoba and Alberta each got a hand-written adapter because each
 * was the first of its kind. Fifty states cannot each get one. What differs
 * between them is data — the endpoint, the field holding the unit, how the
 * authority writes it, how many units there are, which records are split into
 * parts, which records are not units at all, what the authority says its map
 * is worth in law — so a state is added by writing that down, and every fetch
 * is held to it:
 *
 *  - the exact record count and unit count reviewed by hand; a change is a
 *    boundary event a person must look at, so the adapter refuses;
 *  - the exact set of units the authority publishes in several records;
 *  - every record without a designation identified and quarantined with its
 *    reason, never silently dropped and never given an invented identifier;
 *  - designations read through the state's own normaliser, never guessed.
 *
 * The service is asked for EPSG:4326 so the authority performs the projection,
 * and paged by its own `maxRecordCount`.
 */

export interface ArcgisQuarantineRule {
  /** Why this record is not a unit, in words a reviewer can check. */
  reason: string;
  /** Identifies the record: a stable attribute and its value (GlobalID, OBJECTID). */
  match: { field: string; value: string | number };
}

export interface ArcgisZoneSourceConfig {
  layerId: string;
  jurisdictionCanonicalId: string;
  /** `us-co`, as in canonical ids. */
  jurisdictionKey: string;
  officialTerm: string;
  officialTermShort: string;
  zoneType: ZoneLayerSource["zoneType"];
  authority: string;
  sourceCanonicalId: string;
  /** The layer URL, without `/query`. */
  layerUrl: string;
  /** The field holding the authority's designation for a unit. */
  idField: string;
  /** Other fields worth keeping for provenance; the id field is always kept. */
  keepFields?: string[];
  /**
   * The designation for a raw id value, or null when the record is not a unit.
   * Default: a trimmed non-empty string, or an integer written as digits.
   */
  normalise?: (raw: unknown) => string | null;
  /** `management_zone:us-co-gmu-` — the prefix every zone id in this layer carries. */
  zoneIdPrefix: string;
  /** Human name for a unit ("Game Management Unit 54"). */
  officialNamePrefix: string;
  expectedRecords: number;
  expectedUnits: number;
  /** Units the authority publishes as several records, and how many records each. */
  multipartUnits: Readonly<Record<string, number>>;
  quarantine: readonly ArcgisQuarantineRule[];
  /** How the authority dates this geometry, recorded as the run's source version. */
  sourceVersion: string;
  /**
   * Attribute values every unit record must carry, such as Montana's
   * `REGYEAR: "2026"`. A record with another value is geometry for a
   * different regulatory year, and the fetch refuses rather than mixing years.
   */
  expectedAttributes?: Readonly<Record<string, string | number>>;
  /** The authority's words about what its map is in law, stored on every unit. */
  legalStanding: { kind: string; statedAs: string };
  pageSize?: number;
  /** The layer's object-id field, for stable paging. Most are OBJECTID; Colorado's is FID. */
  objectIdField?: string;
}

type Geometry = { type: string; coordinates: unknown };

interface GeoJsonPage {
  type?: string;
  features?: Array<{ properties?: Record<string, unknown>; geometry?: Geometry | null }>;
  properties?: { exceededTransferLimit?: boolean };
  exceededTransferLimit?: boolean;
  error?: { message?: string };
}

export function defaultNormalise(raw: unknown): string | null {
  if (typeof raw === "number" && Number.isInteger(raw)) return String(raw);
  if (typeof raw === "string" && raw.trim() !== "") return raw.trim();
  return null;
}

function polygonParts(geometry: Geometry): unknown[] {
  if (!Array.isArray(geometry.coordinates)) return [];
  if (geometry.type === "Polygon") return [geometry.coordinates];
  if (geometry.type === "MultiPolygon") return geometry.coordinates as unknown[];
  return [];
}

function bboxOf(geometry: Geometry | null | undefined): { bbox: [number, number, number, number]; vertices: number } {
  const points = geometry ? (polygonParts(geometry).flat(2) as number[][]) : [];
  if (!points.length) return { bbox: [0, 0, 0, 0], vertices: 0 };
  const longitudes = points.map(([longitude]) => longitude);
  const latitudes = points.map(([, latitude]) => latitude);
  return {
    bbox: [Math.min(...longitudes), Math.min(...latitudes), Math.max(...longitudes), Math.max(...latitudes)],
    vertices: points.length,
  };
}

export function createArcgisZoneSource(config: ArcgisZoneSourceConfig, fetcher: typeof fetch = fetch): ZoneLayerSource {
  const normalise = config.normalise ?? defaultNormalise;
  const query = `${config.layerUrl}/query`;
  const canonicalZoneId = (identifier: string) =>
    `${config.zoneIdPrefix}${identifier.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-")}`;

  async function page(parameters: URLSearchParams, timeoutMs: number): Promise<GeoJsonPage> {
    const response = await fetcher(`${query}?${parameters}`, {
      headers: { accept: "application/geo+json, application/json" },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`${config.authority} layer returned ${response.status}`);
    const payload = await response.json() as GeoJsonPage;
    if (payload.error) throw new Error(`${config.authority} layer error: ${payload.error.message ?? "unknown error"}`);
    return payload;
  }

  function quarantineRuleFor(properties: Record<string, unknown>): ArcgisQuarantineRule | undefined {
    return config.quarantine.find((rule) => properties[rule.match.field] === rule.match.value);
  }

  return {
    layerId: config.layerId,
    jurisdictionCanonicalId: config.jurisdictionCanonicalId,
    officialTerm: config.officialTerm,
    officialTermShort: config.officialTermShort,
    zoneType: config.zoneType,
    authority: config.authority,
    sourceCanonicalId: config.sourceCanonicalId,
    sourceUrl: config.layerUrl,
    canonicalZoneId,
    officialName: (identifier) => `${config.officialNamePrefix}${identifier.trim()}`,

    async officialIdentifiersAt(latitude, longitude) {
      const parameters = new URLSearchParams({
        where: "1=1",
        geometry: `${longitude},${latitude}`,
        geometryType: "esriGeometryPoint",
        inSR: "4326",
        spatialRel: "esriSpatialRelIntersects",
        outFields: [config.idField, ...config.quarantine.map((rule) => rule.match.field)].join(","),
        returnGeometry: "false",
        f: "geojson",
      });
      const payload = await page(parameters, 30_000);
      /* A quarantined record is absent from the registry, so it must be absent
         here too: the question put to both systems is the same question. */
      return [...new Set((payload.features ?? [])
        .filter(({ properties }) => !quarantineRuleFor(properties ?? {}))
        .map(({ properties }) => normalise(properties?.[config.idField]))
        .filter((identifier): identifier is string => identifier !== null))].sort();
    },

    async fetchFeatures() {
      const pageSize = config.pageSize ?? 1000;
      const oid = config.objectIdField ?? "OBJECTID";
      const quarantineFields = config.quarantine.map((rule) => rule.match.field);
      const outFields = [...new Set([
        config.idField, oid, ...(config.keepFields ?? []), ...quarantineFields, ...Object.keys(config.expectedAttributes ?? {}),
      ])].join(",");
      const rows: NonNullable<GeoJsonPage["features"]> = [];
      for (let offset = 0; ; offset += pageSize) {
        const payload = await page(new URLSearchParams({
          where: "1=1",
          outFields,
          returnGeometry: "true",
          outSR: "4326",
          orderByFields: oid,
          resultOffset: String(offset),
          resultRecordCount: String(pageSize),
          f: "geojson",
        }), 180_000);
        rows.push(...(payload.features ?? []));
        const more = payload.exceededTransferLimit ?? payload.properties?.exceededTransferLimit ?? false;
        if (!more || !(payload.features ?? []).length) break;
        if (offset > 100_000) throw new Error(`${config.authority} layer did not stop paging`);
      }
      if (rows.length !== config.expectedRecords) {
        throw new Error(`${config.layerId}: the authority returned ${rows.length} records; ${config.expectedRecords} were reviewed`);
      }

      const grouped = new Map<string, { polygons: unknown[]; objectIds: unknown[]; attributes: Record<string, unknown>[] }>();
      const quarantined: QuarantinedFeature[] = [];
      const matchedRules = new Set<ArcgisQuarantineRule>();
      for (const row of rows) {
        const properties = row.properties ?? {};
        const rule = quarantineRuleFor(properties);
        if (rule) {
          /* A reviewed quarantine covers a record that is not a unit. If the
             authority has since given it a designation, it may now be one, and
             quarantining it by its old identity would hide a unit. */
          const designation = normalise(properties[config.idField]);
          // A rule may name a non-unit designation itself (Idaho's "YNP"); one
          // matched by record identity must still carry no designation.
          if (designation !== null && rule.match.field !== config.idField) {
            throw new Error(
              `${config.layerId}: reviewed quarantine record ${rule.match.field}=${rule.match.value} now carries ` +
              `${config.idField} "${designation}"; review it before ingesting`,
            );
          }
          matchedRules.add(rule);
          quarantined.push({
            sourceFeatureId: `${rule.match.field}:${rule.match.value}`,
            reason: rule.reason,
            attributes: { ...properties },
            ...bboxOf(row.geometry),
          });
          continue;
        }
        for (const [field, value] of Object.entries(config.expectedAttributes ?? {})) {
          if (properties[field] !== value) {
            throw new Error(
              `${config.layerId}: record ${oid} ${String(properties[oid])} has ${field} ${JSON.stringify(properties[field])}; ` +
              `every unit was reviewed as ${JSON.stringify(value)}`,
            );
          }
        }
        const identifier = normalise(properties[config.idField]);
        if (identifier === null) {
          throw new Error(
            `${config.layerId}: record ${oid} ${String(properties[oid])} has no readable ${config.idField} ` +
            `(${JSON.stringify(properties[config.idField])}) and is not a reviewed quarantine; identify it before ingesting`,
          );
        }
        const geometry = row.geometry;
        if (!geometry || (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") || !polygonParts(geometry).length) {
          throw new Error(`${config.layerId}: unit ${identifier} has no usable polygon geometry`);
        }
        const group = grouped.get(identifier) ?? { polygons: [], objectIds: [], attributes: [] };
        group.polygons.push(...polygonParts(geometry));
        group.objectIds.push(properties[oid]);
        group.attributes.push(properties);
        grouped.set(identifier, group);
      }

      const unmatched = config.quarantine.filter((rule) => !matchedRules.has(rule));
      if (unmatched.length) {
        throw new Error(`${config.layerId}: reviewed quarantine record(s) no longer present: ${unmatched.map((rule) => `${rule.match.field}=${rule.match.value}`).join(", ")}`);
      }
      if (grouped.size !== config.expectedUnits) {
        throw new Error(`${config.layerId}: records normalised to ${grouped.size} units; ${config.expectedUnits} were reviewed`);
      }
      const multipart = Object.fromEntries([...grouped].filter(([, group]) => group.objectIds.length > 1).map(([id, group]) => [id, group.objectIds.length]));
      const expected = Object.fromEntries(Object.entries(config.multipartUnits).sort(([a], [b]) => a.localeCompare(b)));
      const actual = Object.fromEntries(Object.entries(multipart).sort(([a], [b]) => a.localeCompare(b)));
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`${config.layerId}: units published in several records changed: ${JSON.stringify(actual)}; reviewed ${JSON.stringify(expected)}`);
      }
      const ids = new Map<string, string>();
      for (const identifier of grouped.keys()) {
        const id = canonicalZoneId(identifier);
        const other = ids.get(id);
        if (other) throw new Error(`${config.layerId}: units ${other} and ${identifier} would share the id ${id}`);
        ids.set(id, identifier);
      }

      const features: ZoneFeatureRecord[] = [...grouped.entries()]
        .sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true }))
        .map(([officialIdentifier, group]) => ({
          sourceFeatureId: `${config.idField}:${officialIdentifier}`,
          officialIdentifier,
          attributes: {
            componentObjectIds: group.objectIds,
            componentCount: group.objectIds.length,
            ...Object.fromEntries((config.keepFields ?? []).map((field) => [field, group.attributes[0][field] ?? null])),
            legalStanding: config.legalStanding.kind,
            locationAccuracy: config.legalStanding.statedAs,
          },
          geometry: { type: "MultiPolygon", coordinates: group.polygons },
        }));
      return { features, quarantined, sourceVersion: config.sourceVersion };
    },
  };
}
