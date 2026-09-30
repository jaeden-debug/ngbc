import { PUBLISHED_SPECIES_BUNDLES } from "./species-route.ts";

/**
 * THREE QUESTIONS, NEVER COLLAPSED (owner ruling, 2026-09-30; CLAUDE.md §16):
 *
 * - CONSERVATION STATUS — what is this animal's protection or conservation
 *   classification, and where? (`conservationStatus` on the profile, sourced.)
 * - TAKE ELIGIBILITY — is this species part of North Ground's meaningful
 *   hunting/removal universe anywhere? (This module.)
 * - REGULATORY EVIDENCE — can I legally take it HERE, NOW, and on what
 *   conditions? (The regulatory engine, only where a certified rule exists.)
 *
 * The earlier model used one PROTECTED flag for the first two, and trumpeter
 * swan broke it: it is conservation-sensitive AND Nevada's drawn swan season
 * counts it against a quota of ten. So eligibility never reads conservation
 * status, and neither of them decides legality.
 *
 * AN ALLOWLIST. A feature is available only where the species' class grants it.
 * Huntability is never inferred from presence in the library, a survey, a
 * surface artifact, a search index, a generic group season or a list.
 */
export type TakeEligibility =
  /** Conventional regulated quarry somewhere in North America. */
  | "HUNTABLE"
  /** Legal take exists, but only under unusually narrow conditions: a quota, a
      draw, a collection permit, special geography. Trumpeter swan (Nevada). */
  | "LIMITED_TAKE"
  /** Lawful nuisance, invasive or unprotected-species take with a meaningful
      program behind it (feral swine, Burmese python). Not ordinary game. */
  | "NUISANCE_OR_INVASIVE_TAKE"
  /** Not a North Ground hunting target (whooping crane). The page stays, for
      identification. */
  | "NON_QUARRY"
  /** Not sufficiently established yet. Unknown is neither open nor protected. */
  | "UNKNOWN";

export interface EligibilityCapabilities {
  /** May be chosen in Hunt. Legality is still only the engine's answer. */
  offeredInHunt: boolean;
  /** May carry a Species Heat surface or zone opportunity evidence — a
      continental "where to look" layer. */
  speciesHeat: boolean;
  /** May be titled a hunting guide (where its group is hunted). */
  huntingGuideTitle: boolean;
}

/* Why LIMITED_TAKE gets no heat: a continent-wide "where to look" layer for a
   species whose only legal take is a quota in three Nevada counties would read
   as "huntable here" everywhere. Green outlines remain the only statement that
   a legal opportunity exists. */
export const ELIGIBILITY_CAPABILITIES: Record<TakeEligibility, EligibilityCapabilities> = {
  HUNTABLE: { offeredInHunt: true, speciesHeat: true, huntingGuideTitle: true },
  LIMITED_TAKE: { offeredInHunt: true, speciesHeat: false, huntingGuideTitle: false },
  NUISANCE_OR_INVASIVE_TAKE: { offeredInHunt: true, speciesHeat: true, huntingGuideTitle: true },
  NON_QUARRY: { offeredInHunt: false, speciesHeat: false, huntingGuideTitle: false },
  UNKNOWN: { offeredInHunt: false, speciesHeat: false, huntingGuideTitle: false },
};

export function isTakeEligibility(value: unknown): value is TakeEligibility {
  return typeof value === "string" && Object.hasOwn(ELIGIBILITY_CAPABILITIES, value);
}

/** The class decides; conservation status is not an input. */
export function capabilitiesOf(eligibility: TakeEligibility): EligibilityCapabilities {
  return ELIGIBILITY_CAPABILITIES[eligibility];
}

type Profile = { speciesId?: string; takeEligibility?: unknown };
type Bundle = { resources?: Array<{ type?: string; speciesProfile?: Profile }> };

/** Every species' eligibility, read from bundles; a profile without one throws. */
export function eligibilityFromBundles(bundles: readonly unknown[]): ReadonlyMap<string, TakeEligibility> {
  const found = new Map<string, TakeEligibility>();
  for (const bundle of bundles as Bundle[]) {
    for (const resource of bundle.resources ?? []) {
      const profile = resource.type === "species" ? resource.speciesProfile : undefined;
      if (!profile?.speciesId) continue;
      if (!isTakeEligibility(profile.takeEligibility)) {
        throw new Error(`${profile.speciesId} has no take eligibility; every published species must declare one`);
      }
      found.set(profile.speciesId, profile.takeEligibility);
    }
  }
  return found;
}

export const SPECIES_TAKE_ELIGIBILITY: ReadonlyMap<string, TakeEligibility> = eligibilityFromBundles(PUBLISHED_SPECIES_BUNDLES);

/** A species this map does not know is UNKNOWN, and so is refused everything. */
export function takeEligibilityOf(speciesId: string): TakeEligibility {
  return SPECIES_TAKE_ELIGIBILITY.get(speciesId) ?? "UNKNOWN";
}

export function offeredInHunt(speciesId: string): boolean {
  return capabilitiesOf(takeEligibilityOf(speciesId)).offeredInHunt;
}

export function permitsSpeciesHeat(speciesId: string): boolean {
  return capabilitiesOf(takeEligibilityOf(speciesId)).speciesHeat;
}

/**
 * The species Hunt may offer. A non-quarry species keeps its profile and is
 * never offered; a link naming one is refused like any unknown species.
 */
export function offeredAsQuarry<T extends { type: string }>(resources: readonly T[]): Array<T & { speciesProfile: { speciesId: string } }> {
  return resources.filter((resource): resource is T & { speciesProfile: { speciesId: string } } => {
    const profile = (resource as { speciesProfile?: { speciesId?: string } }).speciesProfile;
    return resource.type === "species" && typeof profile?.speciesId === "string" && offeredInHunt(profile.speciesId);
  });
}
