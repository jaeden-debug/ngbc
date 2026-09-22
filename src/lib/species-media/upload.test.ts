import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { uploadSpeciesPrimary } from "./upload.ts";
import type { PublishSpeciesMediaInput, SpeciesMediaStore } from "./store.ts";
import type { SpeciesPrimaryMedia } from "./types.ts";

const speciesId = "species:ruffed-grouse" as const;
const assetId = "11111111-1111-4111-8111-111111111111";

async function source() {
  return sharp({ create: { width: 900, height: 600, channels: 3, background: "#55664d" } }).png().toBuffer();
}

function media(): SpeciesPrimaryMedia {
  return {
    assetId,
    speciesId,
    altText: "Ruffed grouse",
    caption: null,
    creator: "North Ground",
    licence: "All rights reserved",
    renditions: {
      avatar: { variant: "avatar", url: `/api/species-media/${assetId}/avatar`, width: 96, height: 96 },
      card: { variant: "card", url: `/api/species-media/${assetId}/card`, width: 480, height: 320 },
      profile: { variant: "profile", url: `/api/species-media/${assetId}/profile`, width: 900, height: 600 },
      cover: { variant: "cover", url: `/api/species-media/${assetId}/cover`, width: 900, height: 600 },
    },
    focal: { x: 50, y: 50 },
  };
}

function input() {
  return {
    speciesId,
    sourceType: "north_ground" as const,
    creator: "North Ground",
    licence: "All rights reserved",
    altText: "Ruffed grouse",
    caption: null,
    admin: { userId: "22222222-2222-4222-8222-222222222222", reviewerName: "Reviewer" },
    expectedCurrentAssetId: null,
  };
}

test("stores one sanitized master plus four immutable renditions before publishing", async () => {
  const uploaded: string[] = [];
  const published: PublishSpeciesMediaInput[] = [];
  const client = { storage: { from: () => ({
    upload: async (path: string) => { uploaded.push(path); return { error: null }; },
    remove: async () => ({ error: null }),
  }) } } as unknown as SupabaseClient;
  const store: SpeciesMediaStore = {
    getPrimary: async () => media(),
    getPrimaryMap: async () => new Map(),
    publishPrimary: async (value) => { published.push(value); },
  };

  const result = await uploadSpeciesPrimary({ ...input(), source: await source() }, client, store, assetId);
  assert.equal(result.assetId, assetId);
  assert.deepEqual(uploaded, [
    `species/ruffed-grouse/${assetId}/master.webp`,
    `species/ruffed-grouse/${assetId}/avatar.webp`,
    `species/ruffed-grouse/${assetId}/card.webp`,
    `species/ruffed-grouse/${assetId}/profile.webp`,
    `species/ruffed-grouse/${assetId}/cover.webp`,
  ]);
  // avatar, card and profile, plus the uncropped cover the full-bleed card is positioned in.
  assert.equal(published[0]?.renditions.length, 4);
  assert.match(published[0]?.sourceSha256 ?? "", /^[0-9a-f]{64}$/);
});

test("removes newly uploaded objects when the atomic publish fails", async () => {
  const uploaded: string[] = [];
  let removed: string[] = [];
  const client = { storage: { from: () => ({
    upload: async (path: string) => { uploaded.push(path); return { error: null }; },
    remove: async (paths: string[]) => { removed = paths; return { error: null }; },
  }) } } as unknown as SupabaseClient;
  const store: SpeciesMediaStore = {
    getPrimary: async () => null,
    getPrimaryMap: async () => new Map(),
    publishPrimary: async () => { throw new Error("write failed"); },
  };

  await assert.rejects(uploadSpeciesPrimary({ ...input(), source: await source() }, client, store, assetId), /write failed/);
  assert.deepEqual(removed, uploaded);
});
