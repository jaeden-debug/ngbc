import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import type { CanonicalId } from "../content-contract";
import { allRenditions, processSpeciesImage } from "./image";
import { masterStoragePath, renditionStoragePath, SPECIES_MEDIA_BUCKET } from "./paths";
import type { SpeciesMediaStore } from "./store";
import type { SpeciesPrimaryMedia } from "./types";

export interface UploadSpeciesPrimaryInput {
  speciesId: CanonicalId<"species">;
  source: Buffer;
  sourceType: "north_ground" | "north_ground_generated";
  creator: string;
  licence: string;
  altText: string;
  caption: string | null;
  admin: { userId: string; reviewerName: string };
  expectedCurrentAssetId: string | null;
}

export async function uploadSpeciesPrimary(
  input: UploadSpeciesPrimaryInput,
  client: SupabaseClient,
  store: SpeciesMediaStore,
  assetId = randomUUID(),
): Promise<SpeciesPrimaryMedia> {
  const processed = await processSpeciesImage(input.source);
  const masterPath = masterStoragePath(input.speciesId, assetId);
  const renditionFiles = allRenditions(processed).map((rendition) => ({
    ...rendition,
    storagePath: renditionStoragePath(input.speciesId, assetId, rendition.variant),
  }));
  const files = [
    { path: masterPath, buffer: processed.master.buffer },
    ...renditionFiles.map(({ storagePath, buffer }) => ({ path: storagePath, buffer })),
  ];
  const uploaded: string[] = [];

  try {
    for (const file of files) {
      const { error } = await client.storage.from(SPECIES_MEDIA_BUCKET).upload(file.path, file.buffer, {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: false,
      });
      if (error) throw error;
      uploaded.push(file.path);
    }

    await store.publishPrimary({
      assetId,
      speciesId: input.speciesId,
      sourceType: input.sourceType,
      creator: input.creator,
      licence: input.licence,
      altText: input.altText,
      caption: input.caption,
      masterStoragePath: masterPath,
      masterWidth: processed.master.width,
      masterHeight: processed.master.height,
      masterBytes: processed.master.bytes,
      sourceSha256: processed.sourceSha256,
      identityVerifiedBy: input.admin.reviewerName,
      uploadedBy: input.admin.userId,
      expectedCurrentAssetId: input.expectedCurrentAssetId,
      renditions: renditionFiles.map(({ variant, storagePath, width, height, bytes }) => ({
        variant, storagePath, width, height, bytes,
      })),
    });
    const media = await store.getPrimary(input.speciesId);
    if (!media || media.assetId !== assetId) throw new Error("PUBLISHED_MEDIA_NOT_READABLE");
    return media;
  } catch (error) {
    if (uploaded.length) await client.storage.from(SPECIES_MEDIA_BUCKET).remove(uploaded).catch(() => undefined);
    throw error;
  }
}
