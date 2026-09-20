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
 * that every point inside them is certified: the certified regulatory record is one
 * zone, and a point elsewhere in Ontario correctly resolves to UNKNOWN.
 */

export const SUPPORTED_BOUNDS = {
  minLatitude: 41,
  maxLatitude: 57,
  minLongitude: -96,
  maxLongitude: -74,
} as const;

export const SUPPORTED_SPECIES_IDS = ["species:ruffed-grouse"] as const;

export type SupportedSpeciesId = (typeof SUPPORTED_SPECIES_IDS)[number];

export interface SupportedSpecies {
  id: SupportedSpeciesId;
  displayName: string;
  scientificName: string;
  /** Canonical North Ground resource for this species. */
  resourcePath: string;
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
];

export const COVERAGE_SUMMARY = "Coverage currently available for select Ontario hunts.";

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
