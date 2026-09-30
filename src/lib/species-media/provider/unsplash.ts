import type { SpeciesMediaCredit, SpeciesMediaRendition, SpeciesMediaVariant } from "../types.ts";

/**
 * Unsplash's API guidelines, as they apply to a species page:
 *
 * - Hotlink: show the image from the `photo.urls` host the API returned. Sizes
 *   are Imgix parameters on that same URL, never a copy on our host (so the
 *   Next.js optimiser is bypassed for these images).
 * - Attribute: "Photo by <photographer> on Unsplash", both linked, with
 *   `utm_source=<app>&utm_medium=referral` on every link.
 * - Download event: sent once when a photo is chosen (scripts/species-images).
 *
 * Nothing here needs, or can see, the API key.
 */
export const UNSPLASH_APP_NAME = "north_ground";

const IMAGE_HOST = "images.unsplash.com";

export function isUnsplashImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === IMAGE_HOST && !/["<>\s]/.test(value);
  } catch {
    return false;
  }
}

/** Adds Unsplash's referral parameters to one of its own links, and refuses any other host. */
export function withUnsplashReferral(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "unsplash.com") throw new Error("not an unsplash.com link");
  url.searchParams.set("utm_source", UNSPLASH_APP_NAME);
  url.searchParams.set("utm_medium", "referral");
  return url.toString();
}

export function unsplashCredit(input: {
  photographerName: string;
  photographerProfileUrl: string;
  sourcePageUrl: string | null;
}): SpeciesMediaCredit {
  return {
    provider: "unsplash",
    providerName: "Unsplash",
    providerUrl: withUnsplashReferral("https://unsplash.com/"),
    creatorName: input.photographerName,
    creatorUrl: withUnsplashReferral(input.photographerProfileUrl),
    sourceUrl: input.sourcePageUrl ? withUnsplashReferral(input.sourcePageUrl) : null,
  };
}

const SIZES: Record<SpeciesMediaVariant, { width: number; height: number; crop: boolean }> = {
  avatar: { width: 192, height: 192, crop: true },
  card: { width: 960, height: 640, crop: true },
  profile: { width: 1600, height: 1200, crop: false },
  cover: { width: 960, height: 960, crop: false },
};

function sized(imageUrl: string, width: number, height: number, crop: boolean): string {
  const url = new URL(imageUrl);
  url.searchParams.set("w", String(width));
  url.searchParams.set("h", String(height));
  url.searchParams.set("fit", crop ? "crop" : "max");
  if (crop) url.searchParams.set("crop", "entropy");
  else url.searchParams.delete("crop");
  url.searchParams.set("q", "80");
  url.searchParams.set("auto", "format");
  return url.toString();
}

/** The same four renditions a manual upload has, as Imgix sizes of the hotlinked original. */
export function unsplashRenditions(
  imageUrl: string,
  original: { width: number; height: number },
): Record<SpeciesMediaVariant, SpeciesMediaRendition> {
  if (!isUnsplashImageUrl(imageUrl)) throw new Error("not an Unsplash image URL");
  const entries = (Object.keys(SIZES) as SpeciesMediaVariant[]).map((variant) => {
    const { width, height, crop } = SIZES[variant];
    if (crop) return [variant, { variant, url: sized(imageUrl, width, height, true), width, height }];
    const scale = Math.min(1, width / original.width, height / original.height);
    const w = Math.max(1, Math.round(original.width * scale));
    const h = Math.max(1, Math.round(original.height * scale));
    return [variant, { variant, url: sized(imageUrl, w, h, false), width: w, height: h }];
  });
  return Object.fromEntries(entries) as Record<SpeciesMediaVariant, SpeciesMediaRendition>;
}
