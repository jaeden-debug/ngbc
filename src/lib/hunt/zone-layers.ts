import type { CanonicalId } from "../content-contract/index.ts";
import { presentZone } from "./zone-presentation.ts";
import certifiedUnits from "../../../content/regulatory/ca-on-certified-units.json" with { type: "json" };
import manitobaCertifiedUnits from "../../../content/regulatory/ca-mb-certified-units.json" with { type: "json" };
import albertaCertifiedUnits from "../../../content/regulatory/ca-ab-certified-units.json" with { type: "json" };
import quebecCertifiedUnits from "../../../content/regulatory/ca-qc-certified-units.json" with { type: "json" };
import britishColumbiaCertifiedUnits from "../../../content/regulatory/ca-bc-certified-units.json" with { type: "json" };
import { US_ZONE_LAYERS } from "./united-states/layers.ts";
import { normaliseBritishColumbiaMu } from "./ingestion/british-columbia-mu.ts";

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

/**
 * What a published boundary is in law, as its own authority describes it.
 *
 * Government GIS can be official and useful without being the legal boundary.
 * Wyoming says its hunt-area maps are general reference and the written
 * descriptions control; Alberta calls its layer a small-scale approximation of
 * the units described in regulation. North Ground certifies that its copy
 * matches the authority's service — never that the service is the law — and
 * every answer that rests on a layer carries the layer's own standing.
 */
export type LegalStandingKind =
  /** The geometry itself is the legal boundary. */
  | "CONTROLLING_GEOMETRY"
  /** Drawn by the authority from a written legal description, which controls where they differ. */
  | "DERIVED_FROM_LEGAL_DESCRIPTION"
  /** A planning or reference map the authority says not to rely on for the legal boundary. */
  | "PLANNING_GUIDANCE";

export interface LegalStanding {
  kind: LegalStandingKind;
  /** The authority's own words about its map, quoted. */
  statedAs: string;
  /** Where the controlling text is, when it is not the geometry. */
  controllingText?: { title: string; url: string };
}

/**
 * The regulatory period a layer's geometry is certified for.
 *
 * Unit boundaries can move between regulatory years while the unit keeps its
 * number. A date outside this period is never answered with this geometry, so
 * a 2027 hunt cannot silently inherit a 2026 polygon. Absent means the
 * authority publishes one continuing layer with no stated period (Canada's
 * provincial layers), which is certified as it stands.
 */
export interface GeometryPeriod {
  from: string;
  to?: string;
  statedAs: string;
}

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
  /**
   * The term's plural where adding "s" would be wrong. Québec's areas are
   * « zones de chasse », never "Zone de chasses". Absent, the term plus "s".
   */
  officialTermPlural?: string;
  /** Status of the REGULATORY record, not of the geometry. */
  coverage: ZoneCoverageStatus;
  coverageNote: string;
  authority: string;
  sourceId: CanonicalId<"source">;
  /** ArcGIS FeatureServer/MapServer query endpoint, when one has passed review. */
  endpoint?: string;
  /**
   * An OGC WFS the authority serves instead, when one has passed review
   * (Québec's GeoServer). Asked only by the official-GIS fallback, for which
   * zone contains a point; never for drawings.
   */
  wfs?: { url: string; typeName: string; nameField: string; /** Geometry property for spatial filters; Québec's `the_geom` when absent. */ geometryField?: string };
  /** Field on that service carrying the zone's official designation. */
  nameField?: string;
  /** Approximate extent, used to skip requests the layer cannot answer. */
  bounds: { minLatitude: number; maxLatitude: number; minLongitude: number; maxLongitude: number };
  /**
   * Whether Hunt presents zones from this layer. A layer can be published in the
   * registry before its parity with the authority is certified; until then a
   * point inside it is answered as "not yet covered", never in another
   * jurisdiction's terms.
   */
  serving: boolean;
  /** How the registry prefixes this layer's official names, so the bare designation can be shown. */
  officialNamePrefix: string;
  /**
   * Designations with at least one certified rule, generated with the layer's
   * bundle. Present only where rules are certified; a layer without it is
   * boundary-only everywhere.
   */
  certifiedDesignations?: ReadonlySet<string>;
  /** How this layer's adapter mints canonical ids ("management_zone:ca-mb-gha-"), for the official-GIS fallback. */
  zoneIdPrefix: string;
  /**
   * The official designation for a raw `nameField` value, or null when the
   * feature is not a zone. Needed where the service stores something other
   * than the designation — Alberta keeps WMU 102 as "00102" and Elk Island
   * National Park as a blank record. Without it, a trimmed non-empty string or
   * a number is the designation, which is what every other layer publishes.
   */
  designationOf?(raw: unknown): string | null;
  /**
   * Where the map's drawings come from. "authority" (the default) asks the
   * authority's own service per view; "stored" reads North Ground's stored
   * drawings of the parity-certified geometry (`zone_display_in_view`), falling
   * back to the authority's service where there is one.
   */
  mapGeometry?: "authority" | "stored";
  /**
   * The widest longitude span the authority's service answers completely in one
   * envelope query. Wider views are asked in tiles (see `queryTiles`).
   */
  maxQueryLongitudeSpan?: number;
  /**
   * What this layer's boundaries are in law. Required for every layer outside
   * the original Canadian four, which state theirs in `coverageNote`.
   */
  legalStanding?: LegalStanding;
  /**
   * The species whose seasons the authority writes in this layer's units.
   * Absent: every species the jurisdiction's rules name. Present, a species
   * outside it is not answered with this layer's zones — Montana's pronghorn
   * seasons are set by antelope districts, not by deer and elk districts.
   */
  speciesScope?: readonly string[];
  geometryPeriod?: GeometryPeriod;
  /**
   * For a species-scoped layer: whether the map draws it before a species is
   * chosen. True for the one geography a jurisdiction's hunters think of as
   * "the units" (Montana's deer and elk hunting districts); false for the
   * others, which appear when their species is chosen.
   */
  drawnByDefault?: boolean;
  /** The jurisdiction's own clock, for provenance dates stamped on its behalf. */
  timeZone?: string;
  /**
   * How a point is placed in this layer. REGISTRY (the default): North Ground's
   * parity-certified PostGIS copy, with the authority's service as fallback.
   * LIVE_SERVICE: the authority's own service, asked at request time, with no
   * copy of the geometry stored by North Ground. U.S. state layers are
   * LIVE_SERVICE: their GIS is published without an open licence, so North
   * Ground reads it where the state serves it rather than redistributing a copy
   * (owner decision, 2026-09-21).
   */
  resolution?: "REGISTRY" | "LIVE_SERVICE";
}

/** Whether the layer answers "which zone is this?" from location alone. */
export function isLocationLayer(layer: Pick<ZoneLayer, "speciesScope" | "drawnByDefault">): boolean {
  return !layer.speciesScope || layer.drawnByDefault === true;
}

/** The authority's term for several of its areas ("Wildlife Management Units", "zones de chasse"). */
export function officialTermPlural(layer: Pick<ZoneLayer, "officialTerm" | "officialTermPlural">): string {
  return layer.officialTermPlural ?? `${layer.officialTerm}s`;
}

/** A layer's designation for a raw service value, or null when the feature is not a zone. */
export function designationOfRaw(layer: Pick<ZoneLayer, "designationOf">, raw: unknown): string | null {
  if (layer.designationOf) return layer.designationOf(raw);
  if (typeof raw === "number") return String(raw);
  return typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null;
}

/**
 * A zone's full English label ("WMU 57", "Zone 10 West"). Presentation lives in
 * `zone-presentation.ts`; this delegates so no second formatter exists. A layer
 * without a presentation profile keeps its term and raw designation.
 */
export function zoneDisplayLabel(
  layer: Pick<ZoneLayer, "jurisdictionId" | "officialTermShort"> & { id?: string },
  designation: string,
): string {
  const presented = presentZone({ designation, layerId: layer.id, jurisdictionId: layer.jurisdictionId });
  return presented.status === "UNSUPPORTED_JURISDICTION" ? `${layer.officialTermShort} ${designation}` : presented.fullLabel;
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
    serving: true,
    officialNamePrefix: "Wildlife Management Unit ",
    certifiedDesignations: new Set(certifiedUnits.certifiedUnits.map((unit) => unit.toUpperCase())),
    zoneIdPrefix: "management_zone:ca-on-wmu-",
    // LIO drops units from wide envelope queries; 5° wide returns every unit.
    maxQueryLongitudeSpan: 5,
  },
  {
    id: "layer:ca-mb-gha",
    jurisdictionId: "jurisdiction:ca-mb",
    jurisdictionName: "Manitoba",
    country: "CA",
    // Manitoba's own term. A GHA is not relabelled a WMU.
    officialTerm: "Game Hunting Area",
    officialTermShort: "GHA",
    coverage: "PARTIAL",
    coverageNote:
      "Official Manitoba Game Hunting Area boundaries are drawn from the province's own feature layer, parity-certified " +
      "against it. The boundaries are the province's map of the written descriptions in M.R. 220/86, which control. " +
      `Certified rules reach ${manitobaCertifiedUnits.certifiedUnits.length} of ${manitobaCertifiedUnits.officialUnitCount} areas for at least one species.`,
    authority: "Government of Manitoba",
    sourceId: "source:ca-mb-gha-service",
    endpoint: "https://services.arcgis.com/mMUesHYPkXjaFGfS/arcgis/rest/services/Manitoba_Game_Hunting_Areas/FeatureServer/0/query",
    nameField: "GHA",
    bounds: { minLatitude: 48.99, maxLatitude: 60.01, minLongitude: -102.05, maxLongitude: -88.9 },
    serving: true,
    officialNamePrefix: "Game Hunting Area ",
    certifiedDesignations: new Set(manitobaCertifiedUnits.certifiedUnits.map((unit) => unit.toUpperCase())),
    zoneIdPrefix: "management_zone:ca-mb-gha-",
  },
  {
    id: "layer:ca-ab-wmu",
    jurisdictionId: "jurisdiction:ca-ab",
    jurisdictionName: "Alberta",
    country: "CA",
    officialTerm: "Wildlife Management Unit",
    officialTermShort: "WMU",
    coverage: "PARTIAL",
    coverageNote:
      "Official Alberta WMU boundaries are drawn from the province's own feature layer, parity-certified against it. " +
      "Alberta describes them as small-scale approximations of the units legally described in the Wildlife Regulation " +
      `(AR 143/97), which controls. Certified rules reach ${albertaCertifiedUnits.certifiedUnits.length} of ` +
      `${albertaCertifiedUnits.officialUnitCount} units for at least one species. National parks are in no WMU.`,
    authority: "Government of Alberta",
    sourceId: "source:ca-ab-wmu-service",
    endpoint: "https://geospatial.alberta.ca/mimas/rest/services/boundaries/fishwild_wildlife_mgmt_unit_public/FeatureServer/0/query",
    nameField: "WMUNIT_CODE",
    bounds: { minLatitude: 48.99, maxLatitude: 60.01, minLongitude: -120.01, maxLongitude: -109.99 },
    serving: true,
    officialNamePrefix: "Wildlife Management Unit ",
    certifiedDesignations: new Set(albertaCertifiedUnits.certifiedUnits),
    zoneIdPrefix: "management_zone:ca-ab-wmu-",
    // "00102" is WMU 102. The blank record is Elk Island National Park: no zone.
    designationOf: (raw) => {
      if (typeof raw !== "string" || !/^\d{5}$/.test(raw.trim())) return null;
      const designation = String(Number(raw.trim()));
      return /^\d{3}$/.test(designation) ? designation : null;
    },
  },
  {
    id: "layer:ca-qc-zone-chasse",
    jurisdictionId: "jurisdiction:ca-qc",
    jurisdictionName: "Québec",
    country: "CA",
    // The ministry's own term, in French. It is not translated into "unit".
    officialTerm: "Zone de chasse",
    officialTermShort: "Zone",
    officialTermPlural: "zones de chasse",
    coverage: "PARTIAL",
    coverageNote:
      "Official Québec hunting-zone boundaries are drawn from North Ground's copy of the ministry's own GeoServer layer, " +
      "the service behind Forêt ouverte, parity-certified against it. The ministry states its map « n'a aucune portée " +
      "légale, seuls les documents déposés ont force de loi ». " +
      `Certified rules reach ${quebecCertifiedUnits.certifiedUnits.length} of ${quebecCertifiedUnits.officialUnitCount} zones for at least one species.`,
    authority: "Gouvernement du Québec",
    sourceId: "source:ca-qc-zone-chasse-service",
    bounds: { minLatitude: 44.9, maxLatitude: 62.7, minLongitude: -79.9, maxLongitude: -57 },
    serving: true,
    officialNamePrefix: "Zone de chasse ",
    certifiedDesignations: new Set(quebecCertifiedUnits.certifiedUnits.map((unit) => unit.toUpperCase())),
    zoneIdPrefix: "management_zone:ca-qc-zone-",
    wfs: {
      url: "https://servicesvecto3.mern.gouv.qc.ca/geoserver/SmartFaunePub/ows",
      typeName: "SmartFaunePub:Zone_chasse_da3_sefaq",
      nameField: "Zone",
    },
    /* The ministry serves WFS, not ArcGIS, and zone 21 alone is 838,537 vertices:
       the map draws North Ground's stored drawings of the certified copy. */
    mapGeometry: "stored",
  },
  {
    id: "layer:ca-bc-mu",
    jurisdictionId: "jurisdiction:ca-bc",
    jurisdictionName: "British Columbia",
    country: "CA",
    officialTerm: "Management Unit",
    officialTermShort: "MU",
    coverage: "IN_DEVELOPMENT",
    coverageNote:
      "British Columbia's 225 Management Units from the province's own WFS (Open Government Licence – British Columbia). " +
      "Under B.C. Reg. 64/96 the enacted regional maps control, and a river boundary follows the right-hand bank (the " +
      "left-hand bank for the West Road, Liard and Peace rivers). " +
      `A first wave of rules from B.C. Reg. 190/84 reaches ${britishColumbiaCertifiedUnits.certifiedUnits.length} of ${britishColumbiaCertifiedUnits.officialUnitCount} units.`,
    authority: "Government of British Columbia",
    sourceId: "source:ca-bc-mu-service",
    bounds: { minLatitude: 48.2, maxLatitude: 60.01, minLongitude: -139.07, maxLongitude: -114.05 },
    // Not served until its parity is certified and its first rules are.
    serving: false,
    officialNamePrefix: "Management Unit ",
    certifiedDesignations: new Set(britishColumbiaCertifiedUnits.certifiedUnits.map((unit) => unit.toUpperCase())),
    zoneIdPrefix: "management_zone:ca-bc-mu-",
    designationOf: normaliseBritishColumbiaMu,
    wfs: {
      url: "https://openmaps.gov.bc.ca/geo/pub/WHSE_WILDLIFE_MANAGEMENT.WAA_WILDLIFE_MGMT_UNITS_SVW/ows",
      typeName: "pub:WHSE_WILDLIFE_MANAGEMENT.WAA_WILDLIFE_MGMT_UNITS_SVW",
      nameField: "WILDLIFE_MGMT_UNIT_ID",
      geometryField: "GEOMETRY",
    },
    /* The province serves WFS, not ArcGIS, and its 225 units carry 2.08 million
       vertices: the map draws North Ground's stored drawings of the certified copy. */
    mapGeometry: "stored",
  },
  /* United States, first wave. Described in `united-states/layers.ts`; each is
     answered by its state's own live service, and served only once certified. */
  ...US_ZONE_LAYERS,
];

/**
 * Whether a layer's zones may be used to answer this species on this date.
 *
 * Two guards, each an honest "not with this geometry" rather than a guess:
 * the species must be one the authority writes in these units, and the date
 * must fall in the period the geometry is certified for.
 */
export function layerApplicability(
  layer: Pick<ZoneLayer, "speciesScope" | "geometryPeriod" | "officialTerm" | "jurisdictionName">,
  speciesId: string,
  date: string,
): { applies: true } | { applies: false; reason: "SPECIES_OUT_OF_SCOPE" | "OUTSIDE_GEOMETRY_PERIOD"; message: string } {
  if (layer.speciesScope && !layer.speciesScope.includes(speciesId)) {
    return {
      applies: false,
      reason: "SPECIES_OUT_OF_SCOPE",
      message:
        `${layer.jurisdictionName} does not set this species' seasons by ${layer.officialTerm}. It uses a different ` +
        "geography for it, which North Ground has not certified, so it will not answer from this one.",
    };
  }
  const period = layer.geometryPeriod;
  if (period && (date < period.from || (period.to !== undefined && date > period.to))) {
    return {
      applies: false,
      reason: "OUTSIDE_GEOMETRY_PERIOD",
      message:
        `The ${layer.officialTerm} boundaries North Ground holds are certified for ${period.statedAs}. The selected date ` +
        "is outside that period, and boundaries can change between regulatory years even where a unit keeps its number.",
    };
  }
  return { applies: true };
}

/** The country a jurisdiction belongs to, read from its canonical id ("jurisdiction:us-co" → "US"). */
export function countryOfJurisdiction(jurisdictionId: string | undefined): "CA" | "US" | undefined {
  const match = /^jurisdiction:(ca|us)-/.exec(jurisdictionId ?? "");
  return match ? (match[1].toUpperCase() as "CA" | "US") : undefined;
}

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
const SERVED = ZONE_LAYERS.filter((layer) => layer.serving);
const servedNames = SERVED.map((layer) => layer.jurisdictionName);
const servedList = servedNames.length > 1
  ? `${servedNames.slice(0, -1).join(", ")} and ${servedNames.at(-1)}`
  : servedNames[0] ?? "No jurisdiction";

export const COVERAGE_ROADMAP = {
  // Counted, not typed: a registered layer that is not served yet is not drawn.
  drawnJurisdictions: SERVED.length,
  certifiedUnits: SERVED.reduce((total, layer) => total + (layer.certifiedDesignations?.size ?? 0), 0),
  officialUnits: certifiedUnits.officialUnitCount + manitobaCertifiedUnits.officialUnitCount,
  // Thirteen provinces and territories, less those whose geometry is drawn.
  canadaInDevelopment: 13 - SERVED.filter((layer) => layer.country === "CA").length,
  unitedStatesInDevelopment: 50,
  summary:
    `Official hunting-zone geometry for ${servedList} is published here. Boundary layers for ` +
    "the remaining Canadian and United States jurisdictions are in development and are " +
    "not drawn until their official source has been verified.",
} as const;

/**
 * A layer whose extent contains the point — a hint for which registry to ask.
 *
 * Only serving layers are offered, so a certified layer is never shadowed by one
 * that is not presented yet. Presentation must still come from the resolved
 * zone (`layerForResolution`), because extents overlap.
 */
export function layerForPoint(latitude: number, longitude: number): ZoneLayer | undefined {
  return ZONE_LAYERS.filter((layer) => layer.serving).find(
    (layer) =>
      latitude >= layer.bounds.minLatitude && latitude <= layer.bounds.maxLatitude &&
      longitude >= layer.bounds.minLongitude && longitude <= layer.bounds.maxLongitude,
  );
}

export function layerById(id: string): ZoneLayer | undefined {
  return ZONE_LAYERS.find((layer) => layer.id === id);
}

/**
 * The layer a jurisdiction answers location-only questions in: its general
 * management geography, or the one species-scoped geography it draws by
 * default. Canada's jurisdictions have one layer each, which is this one.
 */
export function layerForJurisdiction(jurisdictionId: string | undefined): ZoneLayer | undefined {
  if (!jurisdictionId) return undefined;
  const layers = ZONE_LAYERS.filter((layer) => layer.jurisdictionId === jurisdictionId);
  return layers.find(isLocationLayer) ?? layers[0];
}

/**
 * The served layer a jurisdiction writes this species' seasons in: one scoped
 * to the species if the authority publishes one, else its general geography.
 * Undefined when the only served geography is scoped to other species — the
 * honest answer is then that North Ground holds no geography for it.
 */
export function speciesLayerFor(jurisdictionId: string | undefined, speciesId: string): ZoneLayer | undefined {
  if (!jurisdictionId) return undefined;
  const served = ZONE_LAYERS.filter((layer) => layer.jurisdictionId === jurisdictionId && layer.serving);
  return served.find((layer) => layer.speciesScope?.includes(speciesId)) ?? served.find((layer) => !layer.speciesScope);
}

/**
 * The layer a canonical zone id was minted in, by its prefix. The longest
 * matching prefix wins, so a state with several geographies ("us-wy-elk-area-",
 * "us-wy-deer-area-") can never have one mistaken for another.
 */
export function layerOfZoneId(zoneId: string | undefined): ZoneLayer | undefined {
  if (!zoneId) return undefined;
  return ZONE_LAYERS
    .filter((layer) => zoneId.startsWith(layer.zoneIdPrefix))
    .sort((a, b) => b.zoneIdPrefix.length - a.zoneIdPrefix.length)[0];
}

/**
 * The layer a resolved zone is presented in: the one its own jurisdiction owns.
 *
 * Bounding boxes overlap — Ontario's reaches into Québec and Manitoba — so the
 * box a point falls in is only a hint about which registry to ask, never the
 * answer. A zone from a jurisdiction Hunt does not serve yet, or has not
 * registered at all, is not presented, and must not be dressed in another
 * jurisdiction's terms.
 */
export function layerForResolution(resolution: { status: string; jurisdictionId?: string; zoneId?: string }):
  | { kind: "SERVING"; layer: ZoneLayer }
  | { kind: "NOT_SERVING"; layer: ZoneLayer }
  | { kind: "UNREGISTERED" } {
  // A zone names its own layer; a state can hold several.
  const layer = layerOfZoneId(resolution.zoneId) ?? layerForJurisdiction(resolution.jurisdictionId);
  if (!layer) return { kind: "UNREGISTERED" };
  return layer.serving ? { kind: "SERVING", layer } : { kind: "NOT_SERVING", layer };
}

/** The bare designation, from the registry's official name ("Wildlife Management Unit 57" → "57"). */
export function designationFromOfficialName(layer: ZoneLayer, officialName: string | undefined): string {
  const name = officialName?.trim() ?? "";
  return name.startsWith(layer.officialNamePrefix) ? name.slice(layer.officialNamePrefix.length) : name;
}

/**
 * The canonical id of a zone in this layer, minted the same way by the
 * official-GIS resolver, the ingestion adapters and the regulatory bundles
 * ("management_zone:ca-on-wmu-69a-1").
 */
export function zoneIdFor(layer: Pick<ZoneLayer, "zoneIdPrefix">, designation: string): CanonicalId<"management_zone"> {
  return `${layer.zoneIdPrefix}${designation.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-")}` as CanonicalId<"management_zone">;
}

/** Coverage of a single named zone, which is stricter than its layer's coverage. */
export function zoneCoverage(layer: ZoneLayer, zoneName: string): ZoneCoverageStatus {
  if (!layer.certifiedDesignations) return layer.coverage;
  return layer.certifiedDesignations.has(zoneName.trim().toUpperCase()) ? "VERIFIED" : "IN_DEVELOPMENT";
}

/** Serving layers whose extent contains the point. Extents overlap; this is a hint, never an answer. */
export function servingLayersAt(latitude: number, longitude: number): ZoneLayer[] {
  return ZONE_LAYERS.filter((layer) =>
    layer.serving &&
    latitude >= layer.bounds.minLatitude && latitude <= layer.bounds.maxLatitude &&
    longitude >= layer.bounds.minLongitude && longitude <= layer.bounds.maxLongitude);
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
