import sharp from "sharp";
import { readSpeciesRendition } from "./read";
import type { SpeciesPrimaryMedia } from "./types";

/**
 * A species photo cropped to a social-card slot around its verified focal point,
 * as a JPEG data URL the image renderer can embed (it cannot read WebP). Null
 * when the rendition is unavailable, so a card falls back rather than failing.
 */
export async function speciesPhotoDataUrl(
  media: SpeciesPrimaryMedia,
  width: number,
  height: number,
): Promise<string | null> {
  try {
    const bytes = await readSpeciesRendition(media.assetId, "profile");
    if (!bytes) return null;
    const image = sharp(Buffer.from(bytes));
    const { width: w = 0, height: h = 0 } = await image.metadata();
    if (!w || !h) return null;
    const scale = Math.max(width / w, height / h);
    const cropW = Math.min(w, Math.round(width / scale));
    const cropH = Math.min(h, Math.round(height / scale));
    const left = Math.min(w - cropW, Math.max(0, Math.round((media.focal.x / 100) * w - cropW / 2)));
    const top = Math.min(h - cropH, Math.max(0, Math.round((media.focal.y / 100) * h - cropH / 2)));
    const jpeg = await image
      .extract({ left, top, width: cropW, height: cropH })
      .resize(width, height)
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch {
    return null;
  }
}

/** "Jane Doe · CC BY 4.0" — every photo on a card keeps its attribution. */
export function photoCredit(media: SpeciesPrimaryMedia): string {
  return `${media.creator} · ${media.licence}`;
}
