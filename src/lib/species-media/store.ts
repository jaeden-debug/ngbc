import type { SupabaseClient } from "@supabase/supabase-js";
import type { CanonicalId } from "../content-contract";
import { defaultSupabaseServerClient } from "../supabase/server";
import { mediaUrl, SPECIES_MEDIA_VARIANTS, type SpeciesMediaVariant, type SpeciesPrimaryMedia } from "./types";

interface PrimaryRow { species_id: string; asset_id: string }
interface AssetRow {
  id: string;
  species_id: string;
  alt_text: string;
  caption: string | null;
  creator: string;
  licence: string;
  status: string;
}
interface RenditionRow {
  asset_id: string;
  variant: SpeciesMediaVariant;
  width: number;
  height: number;
}
export interface PublishSpeciesMediaInput {
  assetId: string;
  speciesId: CanonicalId<"species">;
  sourceType: "north_ground" | "north_ground_generated";
  creator: string;
  licence: string;
  altText: string;
  caption: string | null;
  masterStoragePath: string;
  masterWidth: number;
  masterHeight: number;
  masterBytes: number;
  sourceSha256: string;
  identityVerifiedBy: string;
  uploadedBy: string;
  expectedCurrentAssetId: string | null;
  renditions: Array<{
    variant: SpeciesMediaVariant;
    storagePath: string;
    width: number;
    height: number;
    bytes: number;
  }>;
}

export class SpeciesMediaPersistenceError extends Error {
  constructor(readonly code: string, message = code) {
    super(message);
    this.name = "SpeciesMediaPersistenceError";
  }
}

export interface SpeciesMediaStore {
  getPrimary(speciesId: CanonicalId<"species">): Promise<SpeciesPrimaryMedia | null>;
  getPrimaryMap(speciesIds?: CanonicalId<"species">[]): Promise<Map<CanonicalId<"species">, SpeciesPrimaryMedia>>;
  publishPrimary(input: PublishSpeciesMediaInput): Promise<void>;
}

function assemble(
  primaries: PrimaryRow[],
  assets: AssetRow[],
  renditions: RenditionRow[],
): Map<CanonicalId<"species">, SpeciesPrimaryMedia> {
  const assetsById = new Map(assets.filter((row) => row.status === "active").map((row) => [row.id, row]));
  const byAsset = new Map<string, Map<SpeciesMediaVariant, RenditionRow>>();
  for (const row of renditions) {
    const group = byAsset.get(row.asset_id) ?? new Map();
    group.set(row.variant, row);
    byAsset.set(row.asset_id, group);
  }

  const result = new Map<CanonicalId<"species">, SpeciesPrimaryMedia>();
  for (const primary of primaries) {
    const asset = assetsById.get(primary.asset_id);
    const variants = byAsset.get(primary.asset_id);
    if (!asset || !variants || !SPECIES_MEDIA_VARIANTS.every((variant) => variants.has(variant))) continue;
    const speciesId = primary.species_id as CanonicalId<"species">;
    result.set(speciesId, {
      assetId: asset.id,
      speciesId,
      altText: asset.alt_text,
      caption: asset.caption,
      creator: asset.creator,
      licence: asset.licence,
      renditions: Object.fromEntries(SPECIES_MEDIA_VARIANTS.map((variant) => {
        const row = variants.get(variant)!;
        return [variant, { variant, url: mediaUrl(asset.id, variant), width: row.width, height: row.height }];
      })) as SpeciesPrimaryMedia["renditions"],
    });
  }
  return result;
}

export class SupabaseSpeciesMediaStore implements SpeciesMediaStore {
  constructor(private readonly client: SupabaseClient) {}

  async getPrimary(speciesId: CanonicalId<"species">): Promise<SpeciesPrimaryMedia | null> {
    return (await this.getPrimaryMap([speciesId])).get(speciesId) ?? null;
  }

  async getPrimaryMap(speciesIds?: CanonicalId<"species">[]): Promise<Map<CanonicalId<"species">, SpeciesPrimaryMedia>> {
    let query = this.client.from("species_primary_media").select("species_id,asset_id");
    if (speciesIds?.length) query = query.in("species_id", speciesIds);
    const { data: primaryData, error: primaryError } = await query;
    if (primaryError) throw new SpeciesMediaPersistenceError("READ_FAILED", primaryError.message);
    const primaries = (primaryData ?? []) as PrimaryRow[];
    if (!primaries.length) return new Map();

    const assetIds = primaries.map(({ asset_id }) => asset_id);
    const [{ data: assetData, error: assetError }, { data: renditionData, error: renditionError }] = await Promise.all([
      this.client.from("species_media_assets")
        .select("id,species_id,alt_text,caption,creator,licence,status")
        .in("id", assetIds),
      this.client.from("species_media_renditions")
        .select("asset_id,variant,width,height")
        .in("asset_id", assetIds),
    ]);
    if (assetError || renditionError) {
      throw new SpeciesMediaPersistenceError("READ_FAILED", assetError?.message ?? renditionError?.message);
    }
    return assemble(primaries, (assetData ?? []) as AssetRow[], (renditionData ?? []) as RenditionRow[]);
  }

  async publishPrimary(input: PublishSpeciesMediaInput): Promise<void> {
    const { error } = await this.client.rpc("publish_species_primary_media", {
      p_asset_id: input.assetId,
      p_species_id: input.speciesId,
      p_source_type: input.sourceType,
      p_creator: input.creator,
      p_licence: input.licence,
      p_alt_text: input.altText,
      p_caption: input.caption ?? "",
      p_master_storage_path: input.masterStoragePath,
      p_master_width: input.masterWidth,
      p_master_height: input.masterHeight,
      p_master_bytes: input.masterBytes,
      p_source_sha256: input.sourceSha256,
      p_identity_verified_by: input.identityVerifiedBy,
      p_uploaded_by: input.uploadedBy,
      p_renditions: input.renditions.map((rendition) => ({
        variant: rendition.variant,
        storage_path: rendition.storagePath,
        width: rendition.width,
        height: rendition.height,
        bytes: rendition.bytes,
      })),
      p_expected_current_asset_id: input.expectedCurrentAssetId,
    });
    if (error) {
      const code = /PRIMARY_MEDIA_EXISTS/.test(error.message)
        ? "PRIMARY_MEDIA_EXISTS"
        : /PRIMARY_MEDIA_CHANGED/.test(error.message) ? "PRIMARY_MEDIA_CHANGED" : "WRITE_FAILED";
      throw new SpeciesMediaPersistenceError(code, error.message);
    }
  }
}

let defaultStore: SpeciesMediaStore | null = null;
export function defaultSpeciesMediaStore(): SpeciesMediaStore {
  if (!defaultStore) defaultStore = new SupabaseSpeciesMediaStore(defaultSupabaseServerClient());
  return defaultStore;
}
