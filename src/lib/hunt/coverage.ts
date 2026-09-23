import type { CanonicalId } from "../content-contract/index.ts";
import type { SpeciesPrimaryMedia } from "../species-media/types.ts";
import { officialTermPlural, speciesLayerFor, ZONE_LAYERS } from "./zone-layers.ts";
import federalSpecies from "../../../content/regulatory/ca-federal-species.generated.json" with { type: "json" };

/**
 * What North Ground Hunt can currently answer.
 *
 * Declared once and shared by the evaluation endpoint and the browser composer, so
 * the two cannot drift into disagreeing about what is in scope. The interface uses
 * this to explain coverage honestly instead of sending a request that will be
 * refused, and the endpoint uses it as the authority.
 *
 * These bounds describe where an evaluation may be ATTEMPTED. They are not a claim
 * that every point inside them is certified: a unit no season row names resolves to
 * UNKNOWN, and that is the correct answer rather than a gap.
 */

/**
 * The union of every served layer's extent, kept for callers that need one box
 * (the map's opening view). Whether a point is in scope is answered per layer by
 * `isWithinSupportedBounds`, because a union box also covers the gaps between
 * jurisdictions.
 */
const SERVED_LAYERS = ZONE_LAYERS.filter((layer) => layer.serving);
/* Layers whose rules are certified and answering. A drawn boundary is not a
   claim about rules, so what Hunt says it covers is this, never SERVED_LAYERS. */
const RULES_LAYERS = ZONE_LAYERS.filter((layer) => layer.serving && layer.rulesServing);

export const SUPPORTED_BOUNDS = {
  minLatitude: Math.min(41, ...SERVED_LAYERS.map((layer) => layer.bounds.minLatitude)),
  maxLatitude: Math.max(57, ...SERVED_LAYERS.map((layer) => layer.bounds.maxLatitude)),
  minLongitude: Math.min(-96, ...SERVED_LAYERS.map((layer) => layer.bounds.minLongitude)),
  maxLongitude: Math.max(-74, ...SERVED_LAYERS.map((layer) => layer.bounds.maxLongitude)),
} as const;

/* Ontario's original evaluation box. Kept so Ontario's scope is exactly what it
   was before other jurisdictions were served, whatever their layers' extents. */
const ONTARIO_EVALUATION_BOX = { minLatitude: 41, maxLatitude: 57, minLongitude: -96, maxLongitude: -74 } as const;

/**
 * Species Hunt can evaluate somewhere in its covered geography.
 *
 * Listed literally rather than derived from the regulatory bundles, because this
 * module reaches the browser and the two bundles are ~225 KB of rules the browser
 * has no use for. `src/lib/hunt/regulatory/ontario.test.ts` asserts these lists
 * match the bundles exactly, so the duplication cannot drift.
 *
 * Appearing here means "North Ground can answer for this species somewhere", not
 * "everywhere": a species may be certified in 85 units and unknown in the rest,
 * and the per-location answer comes from the engine.
 */
export const SUPPORTED_SMALL_GAME_SPECIES_IDS = [
  "species:ruffed-grouse",
  "species:spruce-grouse",
  "species:sharp-tailed-grouse",
  "species:snowshoe-hare",
] as const;

/**
 * Species whose rules turn on facts only the hunter can supply.
 *
 * Kept separate from small game because the difference is visible to the person:
 * a grouse hunter is asked nothing beyond where, when and which species, while a
 * deer hunter is asked residency and implement before any status can be honest.
 * The interface uses this to set expectations before the question appears.
 */
export const SUPPORTED_MAJOR_GAME_SPECIES_IDS = [
  "species:american-black-bear",
  "species:moose",
  "species:white-tailed-deer",
  "species:wild-turkey",
] as const;

/**
 * The migratory game birds federal rules answer for.
 *
 * DERIVED from the published species library, never typed: twenty-five
 * hand-written binomials is a fabrication risk in the class nobody audits.
 * A species whose library record lacks a verified, sourced scientific name or
 * a slug is WITHHELD there and does not appear here, because a species page
 * that 404s and a plausible invented name are both worse than a declared gap.
 *
 * Gated by `FEDERAL_MIGRATORY_SERVING`, which stays false until the federal
 * bundle is certified in production. Drawing and answering are separate
 * switches everywhere else in Hunt; this is the same split for a jurisdiction
 * that has no layer of its own.
 */
export const FEDERAL_MIGRATORY_SERVING = true;

const FEDERAL_MIGRATORY_SPECIES: SupportedSpecies[] = FEDERAL_MIGRATORY_SERVING
  ? (federalSpecies.offered as SupportedSpecies[])
  : [];

export const SUPPORTED_SPECIES_IDS = [
  ...SUPPORTED_SMALL_GAME_SPECIES_IDS,
  ...SUPPORTED_MAJOR_GAME_SPECIES_IDS,
  ...FEDERAL_MIGRATORY_SPECIES.map((species) => species.id),
] as readonly string[];

export type SupportedSpeciesId = string;

export interface SupportedSpecies {
  id: SupportedSpeciesId;
  displayName: string;
  scientificName: string;
  /** Canonical North Ground resource for this species. */
  resourcePath: string;
}

export interface SpeciesSelectorOption {
  id: CanonicalId<"species">;
  displayName: string;
  scientificName: string;
  category: string;
  aliases: string[];
  /** Compact server-built vocabulary: aliases, French names, groups and hunter terms. */
  searchTerms: string[];
  /**
   * The species' own published profile, or NULL when it has none.
   *
   * Never constructed. A path built from a slug is a link North Ground made
   * up: it happens to resolve for every species published today, and nothing
   * checks that it will for the next one. `null` means DO NOT LINK — the same
   * rule as an unresolvable species id, which fails rather than being rendered
   * around (`docs/contracts/hunt-sheet-presentation.md` §3).
   */
  resourcePath: string | null;
  /** Canonical PRIMARY image, resolved server-side from the media relationship. */
  image: SpeciesPrimaryMedia | null;
  /**
   * Jurisdictions whose certified rule bundles currently contain this species,
   * derived from the national coverage report rather than declared per species.
   * `asksQuestion` is per jurisdiction because the same species can be published
   * as a plain season in one province and as a licence- or residency-dependent
   * table in another.
   */
  regulatoryJurisdictions: Array<{
    id: CanonicalId<"jurisdiction">;
    name: string;
    asksQuestion: boolean;
  }>;
}

/**
 * Whether a hunter may choose this species HERE at all — a different question
 * from whether North Ground can answer for it.
 *
 * A species is SELECTABLE where a served layer covers it: the map can draw the
 * official geography its seasons are written in, and a point can be resolved
 * to a zone. It is ANSWERABLE (`hasSpeciesCoverageIn`) only where a certified
 * regulatory record exists.
 *
 * Keeping them apart is what lets a hunter in British Columbia, Saskatchewan,
 * Yukon or Newfoundland — all drawn, none with certified rules — learn which
 * official zone they are standing in, instead of being offered nothing at all.
 * What they must never get is a season: an unanswerable species answers
 * UNKNOWN in the engine's own words, with the authority's link.
 */
export function speciesSelectableIn(
  speciesId: CanonicalId<"species">,
  jurisdictionId?: CanonicalId<"jurisdiction">,
): boolean {
  if (!jurisdictionId) return true;
  return Boolean(speciesLayerFor(jurisdictionId, speciesId));
}

export function hasSpeciesCoverageIn(
  species: Pick<SpeciesSelectorOption, "regulatoryJurisdictions">,
  jurisdictionId?: CanonicalId<"jurisdiction">,
): boolean {
  if (!jurisdictionId) return species.regulatoryJurisdictions.length > 0;
  return species.regulatoryJurisdictions.some(({ id }) => id === jurisdictionId);
}

/**
 * Whether evaluating this species will put a question to the hunter.
 *
 * Before a place is chosen the answer is only "yes" when every jurisdiction with
 * rules would ask, so the selector never promises a direct answer it may not give.
 */
export function speciesAsksQuestionIn(
  species: Pick<SpeciesSelectorOption, "regulatoryJurisdictions">,
  jurisdictionId?: CanonicalId<"jurisdiction">,
): boolean {
  const applicable = jurisdictionId
    ? species.regulatoryJurisdictions.filter(({ id }) => id === jurisdictionId)
    : species.regulatoryJurisdictions;
  return applicable.length > 0 && applicable.every(({ asksQuestion }) => asksQuestion);
}

/**
 * Only species with a certified regulatory record appear here. The research
 * inventory contains far more; none of it is huntable information until it has
 * been certified, and showing it as selectable would imply coverage we do not have.
 */
const CERTIFIED_PROVINCIAL_SPECIES: SupportedSpecies[] = [
  {
    id: "species:ruffed-grouse",
    displayName: "Ruffed grouse",
    scientificName: "Bonasa umbellus",
    resourcePath: "/hunting/species/ruffed-grouse",
  },
  {
    id: "species:spruce-grouse",
    displayName: "Spruce grouse",
    scientificName: "Canachites canadensis",
    resourcePath: "/hunting/species/spruce-grouse",
  },
  {
    id: "species:sharp-tailed-grouse",
    displayName: "Sharp-tailed grouse",
    scientificName: "Tympanuchus phasianellus",
    resourcePath: "/hunting/species/sharp-tailed-grouse",
  },
  {
    id: "species:snowshoe-hare",
    displayName: "Snowshoe hare",
    scientificName: "Lepus americanus",
    resourcePath: "/hunting/species/snowshoe-hare",
  },
  {
    id: "species:white-tailed-deer",
    displayName: "White-tailed deer",
    scientificName: "Odocoileus virginianus",
    resourcePath: "/hunting/species/white-tailed-deer",
  },
  {
    id: "species:american-black-bear",
    displayName: "American black bear",
    scientificName: "Ursus americanus",
    resourcePath: "/hunting/species/american-black-bear",
  },
  {
    id: "species:moose",
    displayName: "Moose",
    scientificName: "Alces alces",
    resourcePath: "/hunting/species/moose",
  },
  {
    id: "species:wild-turkey",
    displayName: "Wild turkey",
    scientificName: "Meleagris gallopavo",
    resourcePath: "/hunting/species/wild-turkey",
  },
];

/**
 * Everything Hunt can offer: the provincially certified species, plus the
 * migratory game birds federal rules answer for once they serve.
 */
export const SUPPORTED_SPECIES: SupportedSpecies[] = [
  ...CERTIFIED_PROVINCIAL_SPECIES,
  ...FEDERAL_MIGRATORY_SPECIES,
];

function spokenList(items: readonly string[]): string {
  return items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/* Named from the served layers, so the copy grows with coverage instead of
   going stale. A jurisdiction is named once however many layers it serves,
   and a layer is named for rules only where some of its units carry
   certified rules: Montana's deer and elk districts are drawn, but its
   certified rules are written in its upland districts. */
/** Where Hunt can answer today: "Ontario and Manitoba". */
/* One name per jurisdiction: Montana's rules serve through two of its layers
   and it is one state. */
export const COVERED_JURISDICTIONS = spokenList([...new Set(RULES_LAYERS.map((layer) => layer.jurisdictionName))]);

/* A layer is named for rules only where its own units carry certified rules:
   Montana's certified rules are written in its upland districts, while its
   deer and elk districts are drawn without a certified rule of their own. */
export const COVERAGE_SUMMARY =
  `Certified rules for selected species in ${spokenList(RULES_LAYERS
    .filter((layer) => (layer.certifiedDesignations?.size ?? 0) > 0)
    .map((layer) => `${layer.jurisdictionName}'s ${officialTermPlural(layer)}`))}.`;


export type MajorGameSpeciesId = (typeof SUPPORTED_MAJOR_GAME_SPECIES_IDS)[number];

/**
 * Whether this species will put questions to the hunter before it can answer.
 *
 * Not a coverage state: both shapes are fully certified. It describes the shape
 * of the conversation, which the interface says up front so a question does not
 * arrive as a surprise after a Hunt has been run.
 */
export function evaluationShape(id: string): "DIRECT" | "CONDITIONAL" {
  return (SUPPORTED_MAJOR_GAME_SPECIES_IDS as readonly string[]).includes(id) ? "CONDITIONAL" : "DIRECT";
}

export function isMajorGameSpecies(value: unknown): value is MajorGameSpeciesId {
  return typeof value === "string" && (SUPPORTED_MAJOR_GAME_SPECIES_IDS as readonly string[]).includes(value);
}

export function isSupportedSpecies(value: unknown): value is SupportedSpeciesId {
  return typeof value === "string" && (SUPPORTED_SPECIES_IDS as readonly string[]).includes(value);
}

/**
 * Whether an evaluation may be attempted here: inside Ontario's original box, or
 * inside a served layer's extent. Registry-driven, so serving a jurisdiction's
 * layer is what brings it into scope — no code change per province.
 */
/**
 * A pair that could name a place on Earth at all.
 *
 * Distinct from coverage on purpose. "We do not cover there" is a statement
 * about North Ground; "that is not a coordinate" is a statement about the
 * request. Answering the second with the first tells a caller whose latitude
 * and longitude are swapped, or whose value is in the wrong unit, that we do
 * not serve their area — and they go looking in the wrong place for the fault.
 */
export function isCoordinate(latitude: unknown, longitude: unknown): boolean {
  return typeof latitude === "number" && typeof longitude === "number"
    && Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

export function isWithinSupportedBounds(latitude: number, longitude: number): boolean {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  const inside = (box: { minLatitude: number; maxLatitude: number; minLongitude: number; maxLongitude: number }) =>
    latitude >= box.minLatitude && latitude <= box.maxLatitude && longitude >= box.minLongitude && longitude <= box.maxLongitude;
  return inside(ONTARIO_EVALUATION_BOX) || SERVED_LAYERS.some((layer) => inside(layer.bounds));
}

export function speciesById(id: CanonicalId<"species"> | string): SupportedSpecies | undefined {
  return SUPPORTED_SPECIES.find((species) => species.id === id);
}
