import type { EvidenceGeometryType } from "./types.ts";

/**
 * How finely the heat layer is allowed to be DRAWN, decided by the evidence.
 *
 * The governing rule of §41B: the resolution of a visualisation may never
 * exceed the resolution of its evidence. The failure it prevents is specific
 * and very easy to commit — a zone-level harvest figure smeared into a blurred
 * blob with a bright centre. That picture says "the animals are HERE, in this
 * corner of the unit". The authority said no such thing; it said a number for
 * the whole unit. The bright centre would be North Ground's invention, and a
 * hunter would drive to it.
 *
 * So the renderer does not choose its own primitive. It is TOLD which one the
 * evidence supports, and it has no branch for the other.
 */
export type HeatRenderKind =
  /** One shade across a whole official area, with its published boundary. */
  | "ZONE_AREA"
  /** A continuous field, legitimate only where the evidence is itself finer than an area. */
  | "CONTINUOUS_SURFACE"
  /** Occurrence extent. A presence wash with no gradient, because extent cannot rank. */
  | "RANGE_EXTENT"
  /** Nothing is drawn. */
  | "NONE";

export const RENDER_KIND_MEANINGS: Record<HeatRenderKind, string> = {
  ZONE_AREA:
    "The authority publishes one figure for each whole management area, so each area is shaded evenly. Nothing inside an area is hotter than anything else in it; where the animals are within the area is not something this evidence can say.",
  CONTINUOUS_SURFACE:
    "The authority publishes measurements finer than a management area, so the surface varies within one.",
  RANGE_EXTENT:
    "The authority publishes where the species occurs, and nothing about more or less. It is drawn evenly across the extent and carries no ramp.",
  NONE: "Nothing is drawn, because nothing certified is held here.",
};

/**
 * What a geometry type may be drawn as. A one-way table: it can only ever
 * narrow, never promote.
 */
const KIND_FOR_GEOMETRY: Record<EvidenceGeometryType, HeatRenderKind> = {
  MANAGEMENT_ZONE: "ZONE_AREA",
  POLYGON: "ZONE_AREA",
  GRID_CELL: "CONTINUOUS_SURFACE",
  POINT: "CONTINUOUS_SURFACE",
  RANGE: "RANGE_EXTENT",
};

/* Coarsest first. A mixed set is drawn at the COARSEST kind present, because a
   set containing one zone figure cannot be drawn as a field without inventing
   detail for that zone. */
const COARSENESS: readonly HeatRenderKind[] = ["RANGE_EXTENT", "ZONE_AREA", "CONTINUOUS_SURFACE"];

/**
 * The finest kind a set of evidence supports.
 *
 * Range is treated as coarsest deliberately: an extent polygon mixed with a
 * measured figure would otherwise let the measured one license a gradient
 * across ground the extent merely says the animal occurs in.
 */
export function renderKindFor(geometryTypes: readonly EvidenceGeometryType[]): HeatRenderKind {
  if (!geometryTypes.length) return "NONE";
  const kinds = new Set(geometryTypes.map((type) => KIND_FOR_GEOMETRY[type]));
  return COARSENESS.find((kind) => kinds.has(kind)) ?? "NONE";
}

/** Whether a kind may vary WITHIN one official area. Zone evidence never may. */
export function permitsSubAreaVariation(kind: HeatRenderKind): boolean {
  return kind === "CONTINUOUS_SURFACE";
}

/** Whether a kind carries a ramp at all. Extent has no more and no less. */
export function permitsRamp(kind: HeatRenderKind): boolean {
  return kind === "ZONE_AREA" || kind === "CONTINUOUS_SURFACE";
}
