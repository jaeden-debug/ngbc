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

/**
 * A published feature the adapter refused to stage, kept so the refusal is
 * reviewable rather than silent.
 *
 * Manitoba's layer carries one polygon with no Game Hunting Area designation.
 * Dropping it without a record would make "62 staged" look like the whole
 * layer; staging it would invent a hunting area the regulation does not define.
 */
export interface QuarantinedFeature {
  sourceFeatureId: string;
  reason: string;
  attributes: Record<string, unknown>;
  /** [west, south, east, north] in EPSG:4326, so a reviewer can find it. */
  bbox: [number, number, number, number];
  vertices: number;
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
  /**
   * The official identifiers the authority's OWN service reports at a point, in
   * the same form as `officialIdentifier`. Used only by spatial-parity
   * certification, which asks the authority and North Ground the same question.
   * Records the adapter quarantines must not appear here either.
   */
  officialIdentifiersAt?(latitude: number, longitude: number): Promise<string[]>;
  fetchFeatures(): Promise<{ features: ZoneFeatureRecord[]; sourceVersion?: string; quarantined?: QuarantinedFeature[] }>;
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
