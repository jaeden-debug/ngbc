/**
 * THE RASTER ARTIFACT, and the arithmetic that builds it.
 *
 * Written by Hunt overhaul (67d773f) for the Breeding Bird Survey and kept whole.
 * It is the raster itself — grid, cells, kernel, methodology — not the shape a
 * renderer receives; `surface.ts` wraps it in the transport contract. The two
 * were both called `SpeciesSurface` when they met, which is why this one is now
 * `SurfaceRaster`: the artifact and the contract answer different questions and
 * a single name for both would have hidden that.
 *
 * A species distribution surface: where the animal is, over geography, with no
 * regard whatever for a regulatory boundary.
 *
 * WHAT THIS IS FOR. Until now every heat value North Ground held was attached
 * to a management zone, so the only picture it could draw was a choropleth —
 * one colour per hunting unit, changing at the unit's edge. That picture is
 * wrong in a way that is hard to see and easy to act on: it says the animals
 * change where the regulator drew a line. §41B has always forbidden drawing
 * finer than the evidence; this file is the other half, which is drawing at the
 * resolution the evidence ACTUALLY has when that resolution is not a zone.
 *
 * THE FOUR FACTS STAY APART (§41B). A surface is evidence about animals. It is
 * never a season, never an ownership, never an access right. Nothing in this
 * file imports the regulatory engine, and a `SurfaceRaster` has no field that
 * could carry a legal status.
 *
 * THE GOVERNING RULE. A surface may be built only from observations that are
 * themselves finer than an area — sites with their own coordinates, or the
 * publisher's own grid cells. An area figure may never become one, because a
 * single number for a whole unit cannot say where inside the unit the animals
 * were, and a smoothed blob with a bright centre would put North Ground's
 * invention on the map in the place a hunter would drive to. `surfaceSitesFrom`
 * is where that is enforced, and it refuses rather than degrades.
 */

import type { EvidenceGeometryType, EvidenceRecord } from "./types.ts";

/**
 * What the surface actually measures.
 *
 * Named for the measurement, never for the impression it gives. Only a source
 * that counted animals per unit area may be `POPULATION_DENSITY`; a count of
 * birds detected on a survey route is `RELATIVE_ABUNDANCE` and says so
 * wherever it is shown (§41B: "North Ground never manufactures density from an
 * unrelated metric").
 */
export type SurfaceMetric =
  | "POPULATION_DENSITY"
  | "RELATIVE_ABUNDANCE"
  | "BREEDING_SURVEY_ABUNDANCE"
  | "HARVEST_DENSITY"
  | "OCCURRENCE_PROBABILITY";

/** The words a hunter reads, per metric. A legend may not invent its own. */
export const SURFACE_METRIC_LABELS: Record<SurfaceMetric, string> = {
  POPULATION_DENSITY: "Population density",
  RELATIVE_ABUNDANCE: "Relative abundance",
  BREEDING_SURVEY_ABUNDANCE: "Breeding survey abundance",
  HARVEST_DENSITY: "Harvest density",
  OCCURRENCE_PROBABILITY: "Modelled occurrence probability",
};

/** What each metric may and may not be read as. Shown with the surface. */
export const SURFACE_METRIC_MEANINGS: Record<SurfaceMetric, string> = {
  POPULATION_DENSITY: "The authority counted or estimated animals per unit of area.",
  RELATIVE_ABUNDANCE:
    "How many animals a standard survey detected, relative to other places surveyed the same way. It compares places; it is not a count of the animals present.",
  BREEDING_SURVEY_ABUNDANCE:
    "How many breeding animals a standard survey counted. It describes the breeding season, which is not necessarily where the animals are in the hunting season.",
  HARVEST_DENSITY: "A record of hunting, per unit of area — where animals were taken, not where animals are.",
  OCCURRENCE_PROBABILITY: "A model's estimate of the chance the species is present. It is a model output, not an observation.",
};

/**
 * One place the species was actually surveyed.
 *
 * `value` is in the source's own unit, and `siteGeometry` is the reason this
 * type exists: it can only ever be a geometry FINER than an area, so a value
 * reported for a whole management unit has no way to become a site.
 */
export interface SurfaceSite {
  /** The publisher's own identifier for the site, kept for provenance. */
  id: string;
  latitude: number;
  longitude: number;
  /** The measurement, in the source's unit. */
  value: number;
  /** How many independent survey occasions the value is the combination of. */
  occasions: number;
  /** Only these two. An area figure is refused by `surfaceSitesFrom`. */
  siteGeometry: "POINT" | "GRID_CELL";
}

/** Geometry types that describe an AREA, and can therefore never license a surface. */
/*
 * SAMPLE_PLOT joined this list when the two lanes merged, and it belongs here
 * for the same reason the others do: a plot is an area reported as a whole. It
 * was added after this guard was written, so without this line a plot record
 * would have fallen through to the NO_COORDINATES branch — refused, but for the
 * wrong reason, and a reason that stops being true the moment plots carry
 * coordinates.
 */
const AREA_GEOMETRIES: readonly EvidenceGeometryType[] = ["MANAGEMENT_ZONE", "POLYGON", "SAMPLE_PLOT", "RANGE"];

export interface SurfaceRefusal {
  ok: false;
  /** Machine-readable, so a caller cannot mistake a refusal for an empty result. */
  reason: "AREA_EVIDENCE" | "NO_COORDINATES" | "NO_SITES";
  message: string;
  /** The offending records, so the refusal can be audited rather than trusted. */
  offending: string[];
}

export type SurfaceSites = { ok: true; sites: SurfaceSite[] } | SurfaceRefusal;

/**
 * Evidence records into surface sites, or a refusal.
 *
 * THE NEGATIVE THIS FILE EXISTS FOR. Ontario publishes one moose harvest figure
 * per Wildlife Management Unit. Interpolating those figures would produce a
 * beautiful, smooth, entirely fictional field: a red core somewhere inside WMU
 * 57 that the Ministry never said was there, and that a hunter would drive to.
 * So an area record does not get a worse surface, or a coarser one, or a
 * warning. It gets refused, and the refusal names the records.
 */
export function surfaceSitesFrom(records: readonly EvidenceRecord[]): SurfaceSites {
  const area = records.filter((record) => AREA_GEOMETRIES.includes(record.geographyType));
  if (area.length) {
    return {
      ok: false,
      reason: "AREA_EVIDENCE",
      message:
        "These records describe whole areas. One figure for an area cannot say where inside it the animals were, so it can never be drawn as a surface.",
      offending: area.map((record) => record.id),
    };
  }
  if (!records.length) {
    return { ok: false, reason: "NO_SITES", message: "No evidence records were supplied.", offending: [] };
  }
  return { ok: false, reason: "NO_COORDINATES", message: "Evidence records do not carry coordinates; sites are built by the ingestion that read them.", offending: records.map((r) => r.id) };
}

/**
 * How a surface was computed. Versioned as a whole: changing any field is a new
 * version, never an edit (§41B).
 */
export interface SurfaceMethodology {
  id: string;
  version: string;
  effectiveFrom: string;
  /** The smoothing applied to the sites. */
  kernel: "GAUSSIAN";
  /**
   * THE DECLARED RESOLUTION OF THE SURFACE.
   *
   * Not the grid step. A Gaussian kernel of this width is what determines how
   * finely the field can vary, so this is the number that must be quoted as the
   * resolution and the number a zoom level may never beat. The grid is sampled
   * finer than this on purpose, so that the picture is smooth rather than
   * blocky — sampling a smooth function more densely adds no information and
   * claims none.
   */
  bandwidthKm: number;
  /** Beyond this, a site contributes nothing; the Gaussian tail is cut here. */
  truncationKm: number;
  /** Fewer surveyed sites than this within the truncation radius is NO DATA. */
  minimumSites: number;
  /** No site nearer than this is NO DATA, however many sit at the rim. */
  maximumSiteDistanceKm: number;
  /**
   * How the value is mapped onto the 0..1 the ramp paints.
   *
   * `RANK_AMONG_DETECTED` (2.0.0) paints a cell by its RANK among the cells
   * where the species was detected at all — the empirical distribution
   * function of the positive field — and leaves a surveyed zero at 0. See
   * `rankIntensities` for why that replaced the square root of a ceiling.
   */
  transform: "LINEAR" | "SQRT" | "RANK_AMONG_DETECTED";
  /** For LINEAR and SQRT only: the quantile of the supported field that becomes 1.0. */
  ceilingQuantile?: number;
  /** How several survey years were combined into one site value. */
  yearCombination: string;
}

export interface SurfaceGrid {
  /** Degrees of latitude per row. */
  latStep: number;
  /** Degrees of longitude per column. */
  lonStep: number;
  /** Latitude of the centre of row 0. */
  south: number;
  /** Longitude of the centre of column 0. */
  west: number;
  rows: number;
  cols: number;
}

/**
 * A cell of the surface.
 *
 * `intensity` is 0..1 and is always a SUPPORTED value: a cell that reaches the
 * file has passed the support rule, so 0 means "surveyed, and the species was
 * not found", which is a finding. A cell that is ABSENT from the file is
 * unsurveyed, which is not a finding, and the renderer draws nothing at all
 * there. Those two must never be flattened together (§41B, and the owner's
 * §14: no data must not look like low density).
 */
export interface SurfaceCell {
  row: number;
  col: number;
  intensity: number;
  /** How many surveyed sites informed it, so a thin cell can be told from a thick one. */
  sites: number;
}

export interface SurfaceRaster {
  id: string;
  speciesId: string;
  metric: SurfaceMetric;
  /** The source's own unit, e.g. "birds per survey route". */
  unit: string;
  methodology: SurfaceMethodology;
  grid: SurfaceGrid;
  cells: SurfaceCell[];
  /** The raw value that was mapped to intensity 1.0, in `unit`. */
  ceiling: number;
  /** Counts that let a reader check the surface against its own inputs. */
  sitesSurveyed: number;
  sitesDetected: number;
}

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance, in kilometres. */
export function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The centre of a cell. */
export function cellCentre(grid: SurfaceGrid, row: number, col: number): { latitude: number; longitude: number } {
  return { latitude: grid.south + row * grid.latStep, longitude: grid.west + col * grid.lonStep };
}

/**
 * The kernel-weighted value at one point, or null where the support rule is
 * not met.
 *
 * Null is not zero, and the difference is the whole point. Zero says the
 * surveys looked and found nothing; null says nobody looked near enough here
 * for North Ground to say anything. Returning zero for the second would draw
 * unsurveyed wilderness as though it had been searched and found empty.
 */
export function weightedValueAt(
  latitude: number,
  longitude: number,
  sites: readonly SurfaceSite[],
  methodology: SurfaceMethodology,
): { value: number; sites: number } | null {
  const twoSigmaSquared = 2 * methodology.bandwidthKm ** 2;
  let weightSum = 0;
  let valueSum = 0;
  let within = 0;
  let nearest = Infinity;
  for (const site of sites) {
    const d = distanceKm(latitude, longitude, site.latitude, site.longitude);
    if (d > methodology.truncationKm) continue;
    if (d < nearest) nearest = d;
    within += 1;
    const w = Math.exp(-(d * d) / twoSigmaSquared);
    weightSum += w;
    valueSum += w * site.value;
  }
  if (within < methodology.minimumSites) return null;
  if (nearest > methodology.maximumSiteDistanceKm) return null;
  if (weightSum <= 0) return null;
  return { value: valueSum / weightSum, sites: within };
}

/** The raw value mapped onto 0..1 by the declared transform and ceiling. */
export function intensityOf(value: number, ceiling: number, transform: SurfaceMethodology["transform"]): number {
  if (ceiling <= 0) return 0;
  const ratio = Math.min(1, Math.max(0, value / ceiling));
  return transform === "SQRT" ? Math.sqrt(ratio) : ratio;
}

/**
 * Each value's rank among the POSITIVE values, per mille; a zero stays 0.
 *
 * WHY RANK, MEASURED. The square root of each value against the field's 98th
 * percentile treated the survey's counts as a ratio scale, and for the birds
 * this survey detects rarely they are not one: ruffed grouse is found on 649
 * of 4,121 routes, 773 of its 1,348 non-zero route-years logged a single bird,
 * and a few routes that crossed a brood logged 7 to 16. Held out route by
 * route, the field separates where a species is found from where it is not
 * very well (AUC 0.91 for grouse, 0.73–0.97 across every species) and ranks
 * how many only moderately (Spearman 0.56). A ratio scale spent the colour on
 * the brood routes: 65% of the ground where grouse were found painted blue or
 * cyan, including the median place the survey finds them.
 *
 * A rank claims exactly what the evidence supports — this ground is in the
 * top tenth of where the survey finds the species — and spends the ramp evenly
 * across it. It is the convention eBird's relative-abundance maps use.
 *
 * Ties share the higher rank, so equal values paint equally. The smallest
 * positive rank is 1, never 0: 0 is "surveyed, none found" and must stay
 * distinguishable from the faintest detection.
 */
export function rankIntensities(values: readonly number[]): number[] {
  const positive = values.filter((value) => value > 0).sort((a, b) => a - b);
  const n = positive.length;
  const upperRank = (value: number): number => {
    let lo = 0;
    let hi = n;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (positive[mid] <= value) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  return values.map((value) => (value > 0 ? Math.max(1, Math.round((1000 * upperRank(value)) / n)) : 0));
}

/**
 * The finest resolution, in kilometres, at which this surface may be described.
 *
 * It is the bandwidth, NOT the grid step, and a caller asking "how fine is
 * this?" must be told the bandwidth however densely the grid was sampled.
 */
export function surfaceResolutionKm(surface: Pick<SurfaceRaster, "methodology">): number {
  return surface.methodology.bandwidthKm;
}
