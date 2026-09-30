import { PUBLISHED_SPECIES_BUNDLES } from "./species-route.ts";

/**
 * Whether a species may take part in any hunting-opportunity feature: a Species
 * Heat surface, the Hunt species selector, a "hunting guide" title.
 *
 * AN ALLOWLIST, NEVER A DENYLIST. Trumpeter swan reached production with a
 * "where to look for this animal" layer through a pipeline in which every part
 * behaved correctly: the catalogue held no protected fact, so the builder had
 * nothing to refuse on, and a three-name denylist added afterwards would have
 * missed the next protected bird nobody listed. So every published profile
 * carries its own eligibility, a missing one fails the load, and a feature is
 * permitted only by a class that grants it. Huntability is never inferred from
 * presence in the library, a survey, a surface artifact, a search index or the
 * absence of a list entry.
 *
 * This is species-level only. HUNTABLE says an authority North Ground read
 * permits taking the species somewhere; whether it is legal HERE and NOW is the
 * regulatory engine's answer alone, and eligibility never implies it.
 */
export type TakeEligibility =
  /** Taken as game somewhere, by hunting or trapping. */
  | "HUNTABLE"
  /** Nuisance, invasive or removal take (feral swine, nutria, mute swan): takeable,
      but not a game season. Not protected merely for not being traditional game. */
  | "REMOVAL"
  /** Protected, non-quarry, published for identification safety (whooping crane
      beside sandhill crane). Keeps its page; never a hunting aid. */
  | "PROTECTED"
  /** No authority North Ground has read establishes current take. Unknown is not
      protected and is not huntable, so it gets no hunting aid either. */
  | "UNVERIFIED";

const CLASSES: ReadonlySet<string> = new Set<TakeEligibility>(["HUNTABLE", "REMOVAL", "PROTECTED", "UNVERIFIED"]);
const GRANTS_OPPORTUNITY: ReadonlySet<TakeEligibility> = new Set<TakeEligibility>(["HUNTABLE", "REMOVAL"]);

export function isTakeEligibility(value: unknown): value is TakeEligibility {
  return typeof value === "string" && CLASSES.has(value);
}

/** The allowlist itself: true only for a class that grants it. */
export function grantsHuntingOpportunity(eligibility: TakeEligibility): boolean {
  return GRANTS_OPPORTUNITY.has(eligibility);
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

/** A species this map does not know is UNVERIFIED, and so is refused. */
export function takeEligibilityOf(speciesId: string): TakeEligibility {
  return SPECIES_TAKE_ELIGIBILITY.get(speciesId) ?? "UNVERIFIED";
}

export function permitsHuntingOpportunity(speciesId: string): boolean {
  return grantsHuntingOpportunity(takeEligibilityOf(speciesId));
}

/**
 * The species Hunt may offer as quarry. A protected lookalike keeps its profile
 * and is never offered in the selector; a link naming one is refused like any
 * unknown species.
 */
export function offeredAsQuarry<T extends { type: string }>(resources: readonly T[]): Array<T & { speciesProfile: { speciesId: string } }> {
  return resources.filter((resource): resource is T & { speciesProfile: { speciesId: string } } => {
    const profile = (resource as { speciesProfile?: { speciesId?: string } }).speciesProfile;
    return resource.type === "species" && typeof profile?.speciesId === "string" && permitsHuntingOpportunity(profile.speciesId);
  });
}
