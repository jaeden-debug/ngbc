import type { CanonicalId } from "../content-contract/index.ts";
import certifiedUnits from "../../../content/regulatory/ca-on-certified-units.json" with { type: "json" };

/**
 * Which hunting-zone geography North Ground can actually draw, and how far the
 * regulatory record behind it has been certified.
 *
 * Two different claims live here and must never be collapsed into one:
 *
 *   GEOMETRY  — "we have this jurisdiction's official boundary layer"
 *   REGULATORY— "we have certified the rules that apply inside those boundaries"
 *
 * Ontario currently has the first and only a single zone of the second. Drawing a
 * boundary is therefore not a statement that North Ground can answer a hunt inside
 * it, and the map says so. Nothing in this file may describe a boundary North
 * Ground cannot trace to a named authority's own published GIS service.
 */

export type ZoneCoverageStatus = "VERIFIED" | "PARTIAL" | "IN_DEVELOPMENT" | "UNAVAILABLE";

export interface ZoneLayer {
  id: string;
  jurisdictionId: CanonicalId<"jurisdiction">;
  jurisdictionName: string;
  country: "CA" | "US";
  /**
   * The authority's own term. Ontario says "Wildlife Management Unit", Quebec says
   * "zone de chasse", most U.S. states say "Game Management Unit". These are not
   * interchangeable words and the interface never rewrites one into another, even
   * though the internal model treats them all as `management_zone`.
   */
  officialTerm: string;
  officialTermShort: string;
  /** Status of the REGULATORY record, not of the geometry. */
  coverage: ZoneCoverageStatus;
  coverageNote: string;
  authority: string;
  sourceId: CanonicalId<"source">;
  /** ArcGIS FeatureServer/MapServer query endpoint, when one has passed review. */
  endpoint?: string;
  /** Field on that service carrying the zone's official designation. */
  nameField?: string;
  /** Approximate extent, used to skip requests the layer cannot answer. */
  bounds: { minLatitude: number; maxLatitude: number; minLongitude: number; maxLongitude: number };
}

export const ONTARIO_WMU_ENDPOINT =
  "https://ws.lioservices.lrc.gov.on.ca/arcgis2/rest/services/LIO_OPEN_DATA/LIO_Open05/MapServer/5/query";

/**
 * Layers with real, reviewed geometry. A jurisdiction appears here only once its
 * endpoint, schema, coordinate system and licence have been checked by hand.
 */
export const ZONE_LAYERS: ZoneLayer[] = [
  {
    id: "layer:ca-on-wmu",
    jurisdictionId: "jurisdiction:ca-on",
    jurisdictionName: "Ontario",
    country: "CA",
    officialTerm: "Wildlife Management Unit",
    officialTermShort: "WMU",
    coverage: "PARTIAL",
    coverageNote:
      "Official Ontario WMU boundaries are drawn from the province's own feature layer. " +
      `Certified small-game season and limit records exist for ${certifiedUnits.certifiedUnits.length} of ` +
      `${certifiedUnits.officialUnitCount} units; the remainder are named by no season row North Ground has certified.`,
    authority: "Government of Ontario",
    sourceId: "source:ca-on-wmu-service",
    endpoint: ONTARIO_WMU_ENDPOINT,
    nameField: "OFFICIAL_NAME",
    bounds: { minLatitude: 41.5, maxLatitude: 57, minLongitude: -95.5, maxLongitude: -74 },
  },
];

/**
 * Units that carry at least one certified regulatory rule.
 *
 * Generated alongside the regulatory bundle rather than maintained by hand, so
 * expanding coverage cannot leave the map claiming "boundary only" for a unit
 * whose rules have in fact been certified. It is a short list of identifiers
 * because this module reaches the browser; the rules themselves stay server-side.
 *
 * "Certified" here means the unit has rules for SOME species. Whether the species
 * a person actually picked is certified there is a separate question the engine
 * answers per request.
 */
export const CERTIFIED_ZONE_NAMES: ReadonlySet<string> = new Set(
  certifiedUnits.certifiedUnits.map((unit) => unit.toUpperCase()),
);

/**
 * What the rest of North America looks like today, stated as counts rather than a
 * fabricated map. These numbers come from `research/hunting/`, which is a research
 * inventory: a jurisdiction being counted here is a record that a source exists,
 * never a claim that its rules or boundaries are usable.
 */
export const COVERAGE_ROADMAP = {
  drawnJurisdictions: 1,
  certifiedUnits: certifiedUnits.certifiedUnits.length,
  officialUnits: certifiedUnits.officialUnitCount,
  canadaInDevelopment: 13,
  unitedStatesInDevelopment: 50,
  summary:
    "One jurisdiction's official zone geometry is published here. Boundary layers for " +
    "the remaining Canadian and United States jurisdictions are in development and are " +
    "not drawn until their official source has been verified.",
} as const;

export function layerForPoint(latitude: number, longitude: number): ZoneLayer | undefined {
  return ZONE_LAYERS.find(
    (layer) =>
      latitude >= layer.bounds.minLatitude && latitude <= layer.bounds.maxLatitude &&
      longitude >= layer.bounds.minLongitude && longitude <= layer.bounds.maxLongitude,
  );
}

export function layerById(id: string): ZoneLayer | undefined {
  return ZONE_LAYERS.find((layer) => layer.id === id);
}

/** Coverage of a single named zone, which is stricter than its layer's coverage. */
export function zoneCoverage(layer: ZoneLayer, zoneName: string): ZoneCoverageStatus {
  if (layer.id !== "layer:ca-on-wmu") return layer.coverage;
  return CERTIFIED_ZONE_NAMES.has(zoneName.trim().toUpperCase()) ? "VERIFIED" : "IN_DEVELOPMENT";
}

export const COVERAGE_WORDING: Record<ZoneCoverageStatus, { label: string; detail: string }> = {
  VERIFIED: {
    label: "Certified",
    detail: "Seasons and limits here are encoded from the authority's current published record.",
  },
  PARTIAL: {
    label: "Partly certified",
    detail: "Official boundaries are published. Only some zones inside them have certified rules.",
  },
  IN_DEVELOPMENT: {
    label: "Boundary only",
    detail: "The official boundary is shown. North Ground has not yet certified the rules for this zone.",
  },
  UNAVAILABLE: {
    label: "Not available",
    detail: "No reviewed official source is available for this area yet.",
  },
};
