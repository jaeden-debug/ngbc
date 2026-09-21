import type { CanonicalId } from "../content-contract";
import type { SpeciesMediaVariant } from "./types";

export const SPECIES_MEDIA_BUCKET = "species-media";

function speciesPathPart(speciesId: CanonicalId<"species">): string {
  return speciesId.slice("species:".length);
}
export function masterStoragePath(speciesId: CanonicalId<"species">, assetId: string): string {
  return `species/${speciesPathPart(speciesId)}/${assetId}/master.webp`;
}

export function renditionStoragePath(
  speciesId: CanonicalId<"species">,
  assetId: string,
  variant: SpeciesMediaVariant,
): string {
  return `species/${speciesPathPart(speciesId)}/${assetId}/${variant}.webp`;
}
