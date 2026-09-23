import { NextResponse } from "next/server";
import { readSpeciesRendition } from "../../../../../lib/species-media/read";
import { SPECIES_MEDIA_VARIANTS, type SpeciesMediaVariant } from "../../../../../lib/species-media/types";

export const runtime = "nodejs";
type Props = { params: Promise<{ assetId: string; variant: string }> };

export async function GET(_request: Request, { params }: Props) {
  const { assetId, variant } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(assetId)
    || !SPECIES_MEDIA_VARIANTS.includes(variant as SpeciesMediaVariant)) {
    return new NextResponse(null, { status: 404 });
  }
  try {
    const bytes = await readSpeciesRendition(assetId, variant as SpeciesMediaVariant);
    if (!bytes) return new NextResponse(null, { status: 404 });
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse(null, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
