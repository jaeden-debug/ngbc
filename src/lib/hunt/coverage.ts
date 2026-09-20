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
 * Listed literally rather than derived from the regulatory bundle, because this
 * module reaches the browser and the bundle is 36 KB of rules the browser has no
 * use for. `src/lib/hunt/regulatory/coverage.test.ts` asserts the two agree, so
 * the duplication cannot drift.
 *
 * Appearing here means "North Ground can answer for this species somewhere", not
 * "everywhere": a species may be certified in 85 units and unknown in the rest,
 * and the per-location answer comes from the engine.
 */
export const SUPPORTED_SPECIES_IDS = [
  "species:ruffed-grouse",
  "species:spruce-grouse",
  "species:sharp-tailed-grouse",
  "species:snowshoe-hare",
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
  resourcePath: string;
  regulatoryCoverage: "VERIFIED" | "IN_DEVELOPMENT";
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
];

export const COVERAGE_SUMMARY = "Small-game rules certified across Ontario's wildlife management units.";

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
