import type { CanonicalId } from "../content-contract";

export const SPECIES_MEDIA_VARIANTS = ["avatar", "card", "profile", "cover"] as const;
/** Every published asset has these; "cover" (uncropped, card-sized) is newer and optional. */
export const REQUIRED_SPECIES_MEDIA_VARIANTS = ["avatar", "card", "profile"] as const;
export type SpeciesMediaVariant = (typeof SPECIES_MEDIA_VARIANTS)[number];

export interface SpeciesMediaRendition {
  variant: SpeciesMediaVariant;
  url: string;
  width: number;
  height: number;
}

/**
 * Where the image came from, in precedence order: an administrator's upload
 * (MANUAL) always outranks a verified provider image (PROVIDER), which
 * outranks the placeholder. Nothing automated can produce a MANUAL image.
 */
export type SpeciesMediaSource = "MANUAL" | "PROVIDER";

/**
 * A photograph taken by someone else, credited as its provider asks:
 * "Photo by <photographer> on <provider>", both linked.
 */
export interface SpeciesMediaCredit {
  provider: "unsplash";
  providerName: string;
  providerUrl: string;
  creatorName: string;
  creatorUrl: string;
  /** The photo's own page on the provider. */
  sourceUrl: string | null;
}

export interface SpeciesPrimaryMedia {
  /** A manual asset's UUID, or `<provider>:<provider asset id>`. */
  assetId: string;
  speciesId: CanonicalId<"species">;
  source: SpeciesMediaSource;
  altText: string;
  caption: string | null;
  creator: string;
  licence: string;
  /** Present whenever the photograph is someone else's and must be credited. */
  credit: SpeciesMediaCredit | null;
  renditions: Record<SpeciesMediaVariant, SpeciesMediaRendition>;
  /** Where the subject sits, as percentages of the frame; drives object-position. */
  focal: { x: number; y: number };
}

export function mediaUrl(assetId: string, variant: SpeciesMediaVariant): string {
  return `/api/species-media/${encodeURIComponent(assetId)}/${variant}`;
}

/**
 * A provider image is served from the provider's own host (Unsplash requires
 * hotlinking), so it may only be shown where its credit is shown too.
 * Manual images, including credited ones, are ours to show anywhere.
 */
export function requiresVisibleCredit(media: SpeciesPrimaryMedia): boolean {
  return media.source === "PROVIDER";
}

/**
 * The images a surface with no room for a credit line may show: every image of
 * ours, no provider's. Hunt's compact avatars read through this, so a species
 * with only a provider image keeps its placeholder there.
 */
export function uncreditedSurfaceMedia(media: Iterable<[string, SpeciesPrimaryMedia]>): Record<string, SpeciesPrimaryMedia> {
  return Object.fromEntries([...media].filter(([, item]) => !requiresVisibleCredit(item)));
}
