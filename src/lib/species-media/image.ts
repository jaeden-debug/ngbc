import { createHash } from "node:crypto";
import sharp, { type Metadata, type ResizeOptions } from "sharp";
import { SPECIES_MEDIA_VARIANTS, type SpeciesMediaVariant } from "./types";

export const MAX_SPECIES_IMAGE_BYTES = 12 * 1024 * 1024;
export const MAX_SPECIES_IMAGE_PIXELS = 50_000_000;
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp", "avif"]);

export class SpeciesImageValidationError extends Error {
  constructor(readonly code: "EMPTY" | "TOO_LARGE" | "UNSUPPORTED" | "INVALID" | "ANIMATED") {
    super(code);
    this.name = "SpeciesImageValidationError";
  }
}

export interface ProcessedSpeciesImage {
  sourceSha256: string;
  master: { buffer: Buffer; width: number; height: number; bytes: number };
  renditions: Record<SpeciesMediaVariant, { buffer: Buffer; width: number; height: number; bytes: number }>;
}

async function encoded(
  input: Buffer,
  resize: ResizeOptions,
  quality: number,
): Promise<{ buffer: Buffer; width: number; height: number; bytes: number }> {
  const { data, info } = await sharp(input, { failOn: "warning", limitInputPixels: MAX_SPECIES_IMAGE_PIXELS })
    .rotate()
    .resize(resize)
    // Re-encoding without withMetadata() deliberately drops EXIF, GPS, XMP and IPTC.
    .webp({ quality, effort: 5 })
    .toBuffer({ resolveWithObject: true });
  return { buffer: data, width: info.width, height: info.height, bytes: data.byteLength };
}

export async function processSpeciesImage(input: Buffer): Promise<ProcessedSpeciesImage> {
  if (!input.byteLength) throw new SpeciesImageValidationError("EMPTY");
  if (input.byteLength > MAX_SPECIES_IMAGE_BYTES) throw new SpeciesImageValidationError("TOO_LARGE");

  let metadata: Metadata;
  try {
    metadata = await sharp(input, { failOn: "warning", limitInputPixels: MAX_SPECIES_IMAGE_PIXELS }).metadata();
  } catch {
    throw new SpeciesImageValidationError("INVALID");
  }
  if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format)) throw new SpeciesImageValidationError("UNSUPPORTED");
  if ((metadata.pages ?? 1) > 1) throw new SpeciesImageValidationError("ANIMATED");
  if (!metadata.width || !metadata.height) throw new SpeciesImageValidationError("INVALID");

  const [master, avatar, card, profile] = await Promise.all([
    encoded(input, { width: 6000, height: 6000, fit: "inside", withoutEnlargement: true }, 90),
    encoded(input, { width: 96, height: 96, fit: "cover", position: "attention" }, 78),
    encoded(input, { width: 480, height: 320, fit: "cover", position: "attention", withoutEnlargement: true }, 80),
    encoded(input, { width: 1600, height: 1200, fit: "inside", withoutEnlargement: true }, 84),
  ]);

  return {
    sourceSha256: createHash("sha256").update(input).digest("hex"),
    master,
    renditions: { avatar, card, profile },
  };
}

export function allRenditions(image: ProcessedSpeciesImage) {
  return SPECIES_MEDIA_VARIANTS.map((variant) => ({ variant, ...image.renditions[variant] }));
}
