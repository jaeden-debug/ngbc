/**
 * Jurisdiction ingestion contract.
 *
 * Every authority publishes its hunting geography differently — ArcGIS here, an
 * open-data download there, a WFS somewhere else. What must NOT differ is what
 * happens to the result: normalise it, validate it, stage it, compare it against
 * what is already published, and let a person decide before production geometry
 * moves. An adapter supplies the jurisdiction-specific fetch; everything after
 * that is shared.
 */

export interface ZoneFeatureRecord {
  /** The authority's own stable feature key, kept so a redraw is traceable. */
  sourceFeatureId: string;
  /** The authority's own designation, e.g. "57", "69A-1". Never rewritten. */
  officialIdentifier: string;
  /** Attributes worth keeping for provenance and review. */
  attributes: Record<string, unknown>;
  /** GeoJSON Polygon or MultiPolygon in EPSG:4326, as published. */
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: unknown };
}

export interface ZoneLayerSource {
  /** North Ground layer id, e.g. "layer:ca-on-wmu". */
  layerId: string;
  jurisdictionCanonicalId: string;
  /** The authority's term for these areas, preserved for display. */
  officialTerm: string;
  officialTermShort: string;
  zoneType: "WMU" | "GMU" | "ZONE" | "DISTRICT" | "REGION" | "SPECIAL_TERRITORY" | "OTHER";
  authority: string;
  sourceCanonicalId: string;
  sourceUrl: string;
  /** Canonical id for a zone, from its official identifier. */
  canonicalZoneId(officialIdentifier: string): string;
  /** Human name for a zone, from its official identifier. */
  officialName(officialIdentifier: string): string;
  fetchFeatures(): Promise<{ features: ZoneFeatureRecord[]; sourceVersion?: string }>;
}

export interface StagedComparison {
  incoming: number;
  published: number;
  added: string[];
  removed: string[];
  /** Identifiers whose area moved by more than the review threshold. */
  areaChanged: Array<{ identifier: string; publishedKm2: number; incomingKm2: number; percent: number }>;
  invalid: Array<{ identifier: string; reason: string }>;
  unchanged: number;
}

/** Area movement above this fraction requires a person to look before promotion. */
export const AREA_REVIEW_THRESHOLD = 0.005;
