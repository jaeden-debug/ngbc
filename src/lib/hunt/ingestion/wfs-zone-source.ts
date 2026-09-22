import type { QuarantinedFeature, ZoneFeatureRecord, ZoneLayerSource } from "./types.ts";

/**
 * A declarative adapter for an authority that publishes its hunting geography
 * through an OGC Web Feature Service (GeoServer and the like).
 *
 * The WFS twin of `arcgis-zone-source.ts`: what differs between authorities is
 * data — the endpoint, the feature type, the field holding the unit, how many
 * records and units there are, which records are not units — so a jurisdiction
 * is added by writing that down, and every fetch is held to it:
 *
 *  - the exact record count and unit count reviewed by hand; a change is a
 *    boundary event a person must look at, so the adapter refuses;
 *  - the exact set of units published in several records;
 *  - every record without a designation identified and quarantined with its
 *    reason, never silently dropped and never given an invented identifier;
 *  - designations read through the jurisdiction's own normaliser, never guessed;
 *  - two designations that would mint the same canonical id refuse the read.
 *
 * The service is asked for EPSG:4326 so the authority performs the projection,
 * and paged in the authority's own stable order.
 *
 * Ingestion and certification only. At run time a point is placed by the
 * layer's `wfs` fallback in `zone.ts`, never by this module.
 *
 * Québec keeps its own adapter (`quebec-zone.ts`): its designation-as-key
 * grouping and part-name repair are specific to that ministry's layer.
 */

export interface WfsQuarantineRule {
  /** Why this record is not a unit, in words a reviewer can check. */
  reason: string;
  /** Identifies the record: a stable attribute and its value. */
  match: { field: string; value: string | number };
}

export interface WfsZoneSourceConfig {
  layerId: string;
  jurisdictionCanonicalId: string;
  officialTerm: string;
  officialTermShort: string;
  zoneType: ZoneLayerSource["zoneType"];
  authority: string;
  sourceCanonicalId: string;
  /** The OWS endpoint, without query parameters. */
  serviceUrl: string;
  /** The feature type name, e.g. `pub:WHSE_WILDLIFE_MANAGEMENT.WAA_WILDLIFE_MGMT_UNITS_SVW`. */
  typeName: string;
  /** The geometry property, for spatial filters (`GEOMETRY`, `the_geom`). */
  geometryField: string;
  /** A unique, stable attribute to page by (`OBJECTID`). */
  sortField: string;
  /** The field holding the authority's designation for a unit. */
  idField: string;
  /** Other fields worth keeping for provenance; the id field is always kept. */
  keepFields?: string[];
  /** The designation for a raw id value, or null when the record is not a unit. */
  normalise?: (raw: unknown) => string | null;
  /** `management_zone:ca-bc-mu-` — the prefix every zone id in this layer carries. */
  zoneIdPrefix: string;
  /** Human name for a unit ("Management Unit 7-15"). Display labels come from the presentation table. */
  officialNamePrefix: string;
  expectedRecords: number;
  expectedUnits: number;
  /** Units the authority publishes as several records, and how many records each. */
  multipartUnits: Readonly<Record<string, number>>;
  quarantine: readonly WfsQuarantineRule[];
  /** How the authority dates this geometry, recorded as the run's source version. */
  sourceVersion: string;
  /** The authority's own words about what its map is in law, stored on every unit. */
  legalStanding: { kind: string; statedAs: string };
  /** The IANA zone whose calendar day dates this authority's records. */
  timeZone?: string;
  pageSize?: number;
}

type Geometry = { type: string; coordinates: unknown };

interface WfsPage {
  features?: Array<{ id?: string; properties?: Record<string, unknown>; geometry?: Geometry | null }>;
  numberMatched?: number | string;
  totalFeatures?: number | string;
}

export function defaultWfsNormalise(raw: unknown): string | null {
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
  let [west, south, east, north] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [longitude, latitude] of points) {
    west = Math.min(west, longitude); east = Math.max(east, longitude);
    south = Math.min(south, latitude); north = Math.max(north, latitude);
  }
  return { bbox: [west, south, east, north], vertices: points.length };
}

function count(value: number | string | undefined): number | null {
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null;
}

/** The canonical id for a designation: lower-cased, with anything but letters, digits and hyphens made a hyphen. */
export function wfsCanonicalZoneId(prefix: string, identifier: string): string {
  return `${prefix}${identifier.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-")}`;
}

export function createWfsZoneSource(config: WfsZoneSourceConfig, fetcher: typeof fetch = fetch): ZoneLayerSource {
  const normalise = config.normalise ?? defaultWfsNormalise;
  const pageSize = config.pageSize ?? 100;

  function url(parameters: Record<string, string>): string {
    return `${config.serviceUrl}?${new URLSearchParams({
      service: "WFS",
      version: "2.0.0",
      request: "GetFeature",
      typeNames: config.typeName,
      outputFormat: "application/json",
      ...parameters,
    })}`;
  }

  /* GeoServer answers `resultType=hits` as a WFS XML document whatever
     `outputFormat` says; other servers honour JSON. Either carries the count. */
  async function publishedCount(): Promise<number | null> {
    const response = await fetcher(url({ resultType: "hits" }), {
      headers: { accept: "application/json, application/xml" },
      signal: AbortSignal.timeout(60_000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`${config.authority} WFS returned ${response.status} for its record count`);
    const text = await response.text();
    if (text.trimStart().startsWith("{")) {
      const body = JSON.parse(text) as WfsPage;
      return count(body.numberMatched) ?? count(body.totalFeatures);
    }
    const match = /\bnumberMatched="(\d+)"/.exec(text);
    return match ? Number.parseInt(match[1], 10) : null;
  }

  async function read(target: string, timeoutMs: number): Promise<WfsPage> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = await fetcher(target, {
          headers: { accept: "application/json" },
          signal: AbortSignal.timeout(timeoutMs),
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`${config.authority} WFS returned ${response.status}`);
        return await response.json() as WfsPage;
      } catch (error) {
        lastError = error;
        if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 1_500 * attempt));
      }
    }
    throw lastError instanceof Error ? lastError : new Error(`${config.authority} WFS could not be read`);
  }

  return {
    layerId: config.layerId,
    jurisdictionCanonicalId: config.jurisdictionCanonicalId,
    officialTerm: config.officialTerm,
    officialTermShort: config.officialTermShort,
    zoneType: config.zoneType,
    authority: config.authority,
    sourceCanonicalId: config.sourceCanonicalId,
    sourceUrl: config.serviceUrl,
    ...(config.timeZone ? { timeZone: config.timeZone } : {}),
    canonicalZoneId: (identifier) => wfsCanonicalZoneId(config.zoneIdPrefix, identifier),
    officialName: (identifier) => `${config.officialNamePrefix} ${identifier.trim()}`,

    /**
     * What the authority's own service says is at this point, for parity
     * certification. The point carries SRID=4326: without it GeoServer reads
     * the coordinates in the layer's native projection and matches nothing,
     * which would look like "no unit here". Longitude first, as EWKT requires.
     */
    async officialIdentifiersAt(latitude, longitude) {
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
        return [];
      }
      const page = await read(url({
        propertyName: config.idField,
        CQL_FILTER: `INTERSECTS(${config.geometryField},SRID=4326;POINT(${longitude} ${latitude}))`,
      }), 30_000);
      return [...new Set((page.features ?? [])
        .map((feature) => normalise(feature.properties?.[config.idField]))
        .filter((value): value is string => value !== null))].sort();
    },

    async fetchFeatures() {
      const published = await publishedCount();
      if (published !== config.expectedRecords) {
        throw new Error(
          `${config.authority} publishes ${published ?? "an unstated number of"} records, reviewed as ${config.expectedRecords}. ` +
            "A changed record count is a boundary event for a person to review; refusing to stage.",
        );
      }

      const keep = [...new Set([config.idField, ...(config.keepFields ?? [])])];
      const byUnit = new Map<string, { attributes: Record<string, unknown>; polygons: unknown[]; records: string[] }>();
      const quarantined: QuarantinedFeature[] = [];
      const seen = new Set<string>();
      const quarantineMatched = new Set<number>();

      for (let startIndex = 0; startIndex < published; startIndex += pageSize) {
        const page = await read(url({
          srsName: "EPSG:4326",
          sortBy: config.sortField,
          count: String(pageSize),
          startIndex: String(startIndex),
        }), 120_000);
        const rows = page.features ?? [];
        if (!rows.length) break;
        for (const row of rows) {
          const properties = row.properties ?? {};
          const recordKey = String(properties[config.sortField] ?? row.id ?? "");
          if (!recordKey) throw new Error(`${config.authority} returned a record with no ${config.sortField}; refusing a read that cannot be checked`);
          if (seen.has(recordKey)) throw new Error(`${config.authority} record ${recordKey} arrived twice; paging is not stable`);
          seen.add(recordKey);

          const geometry = row.geometry;
          const polygons = geometry ? polygonParts(geometry) : [];
          const designation = normalise(properties[config.idField]);
          const ruleIndex = config.quarantine.findIndex((rule) => String(properties[rule.match.field]) === String(rule.match.value));

          if (ruleIndex >= 0) {
            quarantineMatched.add(ruleIndex);
            const { bbox, vertices } = bboxOf(geometry);
            quarantined.push({
              sourceFeatureId: recordKey,
              reason: config.quarantine[ruleIndex].reason,
              attributes: Object.fromEntries(keep.map((field) => [field, properties[field] ?? null])),
              bbox,
              vertices,
            });
            continue;
          }
          if (!designation) {
            throw new Error(`${config.authority} record ${recordKey} has no ${config.idField} and no reviewed reason; refusing to invent or drop a unit`);
          }
          if (!polygons.length) {
            throw new Error(`${config.authority} unit ${designation} (record ${recordKey}) has no polygon geometry`);
          }
          const unit = byUnit.get(designation) ?? { attributes: {}, polygons: [], records: [] };
          if (!unit.records.length) {
            unit.attributes = Object.fromEntries(keep.map((field) => [field, properties[field] ?? null]));
          }
          unit.polygons.push(...polygons);
          unit.records.push(recordKey);
          byUnit.set(designation, unit);
        }
      }

      if (seen.size !== published) {
        throw new Error(`Incomplete read of ${config.authority}: ${seen.size} distinct records received, ${published} published.`);
      }
      const unmatched = config.quarantine.filter((_, index) => !quarantineMatched.has(index));
      if (unmatched.length) {
        throw new Error(`Reviewed quarantine record(s) no longer published: ${unmatched.map((rule) => `${rule.match.field}=${rule.match.value}`).join(", ")}`);
      }
      if (byUnit.size !== config.expectedUnits) {
        throw new Error(`${config.authority} publishes ${byUnit.size} units, reviewed as ${config.expectedUnits}; refusing to stage.`);
      }
      for (const [designation, unit] of byUnit) {
        const expectedParts = config.multipartUnits[designation] ?? 1;
        if (unit.records.length !== expectedParts) {
          throw new Error(`${config.authority} unit ${designation} arrives in ${unit.records.length} records, reviewed as ${expectedParts}.`);
        }
      }
      const minted = new Map<string, string>();
      for (const designation of byUnit.keys()) {
        const id = wfsCanonicalZoneId(config.zoneIdPrefix, designation);
        const clash = minted.get(id);
        if (clash) throw new Error(`Designations "${clash}" and "${designation}" would both be ${id}; refusing to merge two units.`);
        minted.set(id, designation);
      }

      const features: ZoneFeatureRecord[] = [...byUnit.entries()]
        .map(([designation, unit]) => ({
          sourceFeatureId: unit.records.length === 1 ? unit.records[0] : `${designation}:${[...unit.records].sort().join("+")}`,
          officialIdentifier: designation,
          attributes: {
            ...unit.attributes,
            sourceRecords: unit.records.length,
            legalStanding: config.legalStanding,
          },
          geometry: { type: "MultiPolygon" as const, coordinates: unit.polygons },
        }))
        .sort((left, right) => left.officialIdentifier.localeCompare(right.officialIdentifier, "en", { numeric: true }));

      return { features, sourceVersion: config.sourceVersion, quarantined };
    },
  };
}
