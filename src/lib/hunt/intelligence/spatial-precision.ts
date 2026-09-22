/**
 * How finely a piece of evidence actually describes the ground — and the one
 * rule that follows from it:
 *
 *   THE RESOLUTION OF A VISUALISATION MAY NEVER EXCEED THE RESOLUTION OF ITS
 *   EVIDENCE.
 *
 * A province-wide population estimate painted per management unit invents
 * differences between units that nobody measured. A range polygon shaded into
 * hotspots invents places inside a range that nobody ranked. Both look like
 * intelligence and are fabrication, which section 61 of the blueprint forbids
 * outright.
 *
 * The check is a partial order, not a number line, because these categories
 * genuinely are not all comparable: a county and an ecoregion carve the same
 * province differently, and neither contains the other. Where two precisions
 * cannot be compared, this module refuses. It never guesses an ordering to make
 * a map render.
 */

export type SpatialPrecision =
  | "COUNTRY"
  | "JURISDICTION"
  /** The census/administrative unit some United States wildlife datasets report by. */
  | "COUNTY"
  | "ECOREGION"
  /** The authority's own hunting unit: WMU, GHA, zone, GMU. */
  | "MANAGEMENT_UNIT"
  /** A unit drawn for one species specifically, which need not follow the hunting units. */
  | "SPECIES_MANAGEMENT_AREA"
  /** A regular tiling the publisher defined; `approximateMetres` is required to compare it. */
  | "GRID"
  /** An arbitrary polygon the publisher drew (a refuge, a survey block, a range extent). */
  | "POLYGON"
  /** A continuous surface; `approximateMetres` is the cell size. */
  | "RASTER"
  /** A linear feature: a river, a migration corridor, a road. */
  | "CORRIDOR"
  /** A single located observation. */
  | "POINT";

/**
 * A precision with its measured size where the publisher states one.
 *
 * GRID and RASTER are meaningless without it — a 1 km raster and a 30 km raster
 * are not the same evidence — so the comparison refuses when it is missing.
 */
export interface SpatialResolution {
  precision: SpatialPrecision;
  /** The publisher's own cell size or nominal feature size, in metres. */
  approximateMetres?: number;
}

/**
 * Which precisions are wholly contained by which, stated rather than derived.
 *
 * Read as: a thing described at the key is bigger than, and contains, the
 * things listed. Anything not reachable here is UNCOMPARABLE, deliberately.
 */
const CONTAINS: Record<SpatialPrecision, readonly SpatialPrecision[]> = {
  COUNTRY: ["JURISDICTION"],
  JURISDICTION: ["COUNTY", "ECOREGION", "MANAGEMENT_UNIT", "SPECIES_MANAGEMENT_AREA", "GRID", "POLYGON", "RASTER", "CORRIDOR", "POINT"],
  COUNTY: ["POINT"],
  ECOREGION: ["POINT"],
  MANAGEMENT_UNIT: ["POINT"],
  SPECIES_MANAGEMENT_AREA: ["POINT"],
  GRID: ["POINT"],
  POLYGON: ["POINT"],
  RASTER: ["POINT"],
  CORRIDOR: ["POINT"],
  POINT: [],
};

/** Whether `coarser` wholly contains `finer`, transitively. */
export function contains(coarser: SpatialPrecision, finer: SpatialPrecision): boolean {
  const seen = new Set<SpatialPrecision>();
  const queue = [...CONTAINS[coarser]];
  while (queue.length) {
    const next = queue.shift()!;
    if (next === finer) return true;
    if (seen.has(next)) continue;
    seen.add(next);
    queue.push(...CONTAINS[next]);
  }
  return false;
}

export type PrecisionVerdict =
  /** The target is the same size or coarser: aggregating up is always honest. */
  | { permitted: true; reason: string }
  /** The target would be finer than the evidence: the fabrication this exists to stop. */
  | { permitted: false; reason: string; kind: "FINER_THAN_EVIDENCE" }
  /** The two cannot be ordered, so nothing has been shown. Fails closed. */
  | { permitted: false; reason: string; kind: "UNCOMPARABLE" };

const SIZED: readonly SpatialPrecision[] = ["GRID", "RASTER"];

/**
 * May evidence held at `evidence` be drawn at `target`?
 *
 * Yes when the target is the same, or coarser — aggregating measured things
 * upward loses detail but states nothing untrue. No when it is finer, and no
 * when it cannot be shown to be either.
 */
export function permitsVisualisationAt(evidence: SpatialResolution, target: SpatialResolution): PrecisionVerdict {
  const needsSize = SIZED.includes(evidence.precision) || SIZED.includes(target.precision);
  if (needsSize && (evidence.approximateMetres === undefined || target.approximateMetres === undefined)) {
    // A grid or raster without its cell size is not a resolution, it is a shape.
    return {
      permitted: false,
      kind: "UNCOMPARABLE",
      reason: `A ${evidence.precision} or ${target.precision} resolution cannot be compared without the publisher's own cell size.`,
    };
  }
  if (evidence.approximateMetres !== undefined && target.approximateMetres !== undefined) {
    return target.approximateMetres >= evidence.approximateMetres
      ? { permitted: true, reason: `Drawn at ${target.approximateMetres} m from evidence measured at ${evidence.approximateMetres} m.` }
      : {
          permitted: false,
          kind: "FINER_THAN_EVIDENCE",
          reason: `Evidence is measured at ${evidence.approximateMetres} m and cannot be drawn at ${target.approximateMetres} m.`,
        };
  }
  if (evidence.precision === target.precision) {
    return { permitted: true, reason: `Drawn at the ${target.precision} the evidence was collected at.` };
  }
  if (contains(target.precision, evidence.precision)) {
    return { permitted: true, reason: `Aggregated up from ${evidence.precision} to ${target.precision}.` };
  }
  if (contains(evidence.precision, target.precision)) {
    return {
      permitted: false,
      kind: "FINER_THAN_EVIDENCE",
      reason: `Evidence describes a whole ${evidence.precision}; drawing it per ${target.precision} would invent differences nobody measured.`,
    };
  }
  return {
    permitted: false,
    kind: "UNCOMPARABLE",
    reason: `A ${evidence.precision} and a ${target.precision} do not nest, so neither can stand in for the other.`,
  };
}

/**
 * The finest resolution a set of evidence may be drawn at together.
 *
 * Mixing resolutions in one picture takes the coarsest, because the picture is
 * only as trustworthy as its weakest member. Any pair that cannot be ordered
 * makes the whole set undrawable, which is the correct answer.
 */
export function finestPermittedResolution(evidence: readonly SpatialResolution[]): SpatialResolution | null {
  if (!evidence.length) return null;
  return evidence.reduce<SpatialResolution | null>((coarsest, candidate) => {
    if (!coarsest) return candidate;
    if (permitsVisualisationAt(candidate, coarsest).permitted) return coarsest;
    if (permitsVisualisationAt(coarsest, candidate).permitted) return candidate;
    return null;
  }, null);
}

/** Plain words for a person, so the resolution is legible outside the code. */
export function describeResolution({ precision, approximateMetres }: SpatialResolution): string {
  const base: Record<SpatialPrecision, string> = {
    COUNTRY: "the whole country",
    JURISDICTION: "the whole province, territory or state",
    COUNTY: "the county",
    ECOREGION: "the ecoregion",
    MANAGEMENT_UNIT: "the management unit",
    SPECIES_MANAGEMENT_AREA: "the area managed for this species",
    GRID: "a grid the publisher defined",
    POLYGON: "an area the publisher drew",
    RASTER: "a continuous surface",
    CORRIDOR: "a linear feature",
    POINT: "a single located observation",
  };
  return approximateMetres === undefined ? base[precision] : `${base[precision]} of about ${approximateMetres} m`;
}
