import { defaultSupabaseServerClient } from "../supabase/server";
import { SPECIES_MEDIA_BUCKET } from "./paths";
import type { SpeciesMediaVariant } from "./types";

/**
 * The bytes of one rendition of an ACTIVE asset, or null. The public media
 * route and the social images read through this one gate, so a retired asset is
 * never served by either.
 */
export async function readSpeciesRendition(assetId: string, variant: SpeciesMediaVariant): Promise<ArrayBuffer | null> {
  const client = defaultSupabaseServerClient();
  const { data: asset } = await client.from("species_media_assets").select("status").eq("id", assetId).maybeSingle();
  if (asset?.status !== "active") return null;
  const { data: rendition } = await client.from("species_media_renditions")
    .select("storage_path").eq("asset_id", assetId).eq("variant", variant).maybeSingle();
  if (!rendition?.storage_path) return null;
  const { data, error } = await client.storage.from(SPECIES_MEDIA_BUCKET).download(rendition.storage_path);
  return error || !data ? null : data.arrayBuffer();
}
