import type { SupabaseClient } from "@supabase/supabase-js";
import type { CanonicalId } from "../content-contract";
import { defaultSupabaseServerClient } from "../supabase/server";
import { mediaUrl, REQUIRED_SPECIES_MEDIA_VARIANTS, type SpeciesMediaVariant, type SpeciesPrimaryMedia } from "./types";

interface PrimaryRow { species_id: string; asset_id: string }
interface AssetRow {
  id: string;
  species_id: string;
  alt_text: string;
  caption: string | null;
  creator: string;
  licence: string;
  status: string;
  focal_x: number | null;
  focal_y: number | null;
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

/** PostgreSQL query_canceled: the statement timed out and its transaction rolled back. */
const STATEMENT_TIMEOUT = "57014";

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
  setFocalPoint?(assetId: string, focal: { x: number; y: number }, administratorId: string): Promise<boolean>;
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
    if (!asset || !variants || !REQUIRED_SPECIES_MEDIA_VARIANTS.every((variant) => variants.has(variant))) continue;
    // An asset published before the cover rendition existed uses its uncropped profile rendition.
    const coverRow = variants.get("cover") ?? variants.get("profile")!;
    const coverVariant: SpeciesMediaVariant = variants.has("cover") ? "cover" : "profile";
    const speciesId = primary.species_id as CanonicalId<"species">;
    result.set(speciesId, {
      assetId: asset.id,
      speciesId,
      altText: asset.alt_text,
      caption: asset.caption,
      creator: asset.creator,
      licence: asset.licence,
      renditions: {
        ...Object.fromEntries(REQUIRED_SPECIES_MEDIA_VARIANTS.map((variant) => {
          const row = variants.get(variant)!;
          return [variant, { variant, url: mediaUrl(asset.id, variant), width: row.width, height: row.height }];
        })),
        cover: { variant: coverVariant, url: mediaUrl(asset.id, coverVariant), width: coverRow.width, height: coverRow.height },
      } as SpeciesPrimaryMedia["renditions"],
      focal: { x: asset.focal_x ?? 50, y: asset.focal_y ?? 50 },
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
        .select("id,species_id,alt_text,caption,creator,licence,status,focal_x,focal_y")
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
    let { error } = await this.callPublish(input);
    /* A statement timeout (57014) is reported only after PostgreSQL has rolled
       the whole publish transaction back, so asking once more with the same
       asset id and the same expected current asset is safe: it either commits
       exactly once or meets the same optimistic check. Owner uploads failed
       this way on 2026-09-22 while other jobs loaded the database. */
    if (error?.code === STATEMENT_TIMEOUT) {
      ({ error } = await this.callPublish(input));
      // Had the first attempt somehow committed, our own asset is now current: that is success.
      if (error && /PRIMARY_MEDIA_CHANGED/.test(error.message) &&
          (await this.currentAssetId(input.speciesId)) === input.assetId) return;
    }
    if (error) {
      const code = /PRIMARY_MEDIA_EXISTS/.test(error.message)
        ? "PRIMARY_MEDIA_EXISTS"
        : /PRIMARY_MEDIA_CHANGED/.test(error.message)
          ? "PRIMARY_MEDIA_CHANGED"
          : error.code === STATEMENT_TIMEOUT ? "WRITE_BUSY" : "WRITE_FAILED";
      throw new SpeciesMediaPersistenceError(code, error.message);
    }
  }

  private async callPublish(input: PublishSpeciesMediaInput) {
    return await this.client.rpc("publish_species_primary_media", {
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
  }

  /**
   * Only the active asset moves; returns false when the asset is not current.
   * The administrator and the moment are recorded, as they are for an upload.
   */
  async setFocalPoint(assetId: string, focal: { x: number; y: number }, administratorId: string): Promise<boolean> {
    const { data, error } = await this.client.from("species_media_assets")
      .update({ focal_x: focal.x, focal_y: focal.y, updated_by: administratorId, updated_at: new Date().toISOString() })
      .eq("id", assetId).eq("status", "active").select("id");
    if (error) throw new SpeciesMediaPersistenceError("WRITE_FAILED", error.message);
    return (data ?? []).length === 1;
  }

  private async currentAssetId(speciesId: CanonicalId<"species">): Promise<string | null> {
    const { data, error } = await this.client.from("species_primary_media").select("asset_id").eq("species_id", speciesId).maybeSingle();
    if (error) return null;
    return (data as { asset_id?: string } | null)?.asset_id ?? null;
  }
}

let defaultStore: SpeciesMediaStore | null = null;
export function defaultSpeciesMediaStore(): SpeciesMediaStore {
  if (!defaultStore) defaultStore = new SupabaseSpeciesMediaStore(defaultSupabaseServerClient());
  return defaultStore;
}
