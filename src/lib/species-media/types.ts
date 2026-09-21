import type { CanonicalId } from "../content-contract";

export const SPECIES_MEDIA_VARIANTS = ["avatar", "card", "profile"] as const;
export type SpeciesMediaVariant = (typeof SPECIES_MEDIA_VARIANTS)[number];

export interface SpeciesMediaRendition {
  variant: SpeciesMediaVariant;
  url: string;
  width: number;
  height: number;
}
export interface SpeciesPrimaryMedia {
  assetId: string;
  speciesId: CanonicalId<"species">;
  altText: string;
  caption: string | null;
  creator: string;
  licence: string;
  renditions: Record<SpeciesMediaVariant, SpeciesMediaRendition>;
}

export function mediaUrl(assetId: string, variant: SpeciesMediaVariant): string {
  return `/api/species-media/${encodeURIComponent(assetId)}/${variant}`;
}
