import type { CanonicalId } from "../content-contract/index.ts";

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

export const SUPPORTED_BOUNDS = {
  minLatitude: 41,
  maxLatitude: 57,
  minLongitude: -96,
  maxLongitude: -74,
} as const;

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

export const SUPPORTED_SPECIES_IDS = [
  ...SUPPORTED_SMALL_GAME_SPECIES_IDS,
  ...SUPPORTED_MAJOR_GAME_SPECIES_IDS,
] as const;

export type SupportedSpeciesId = (typeof SUPPORTED_SPECIES_IDS)[number];

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
  resourcePath: string;
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
export const SUPPORTED_SPECIES: SupportedSpecies[] = [
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

export const COVERAGE_SUMMARY = "Small-game and major-game rules certified across Ontario's wildlife management units.";


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

export function isWithinSupportedBounds(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) && Number.isFinite(longitude) &&
    latitude >= SUPPORTED_BOUNDS.minLatitude && latitude <= SUPPORTED_BOUNDS.maxLatitude &&
    longitude >= SUPPORTED_BOUNDS.minLongitude && longitude <= SUPPORTED_BOUNDS.maxLongitude
  );
}

export function speciesById(id: CanonicalId<"species"> | string): SupportedSpecies | undefined {
  return SUPPORTED_SPECIES.find((species) => species.id === id);
}
