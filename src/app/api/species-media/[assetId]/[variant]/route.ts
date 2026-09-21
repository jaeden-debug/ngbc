import { NextResponse } from "next/server";
import { defaultSupabaseServerClient } from "../../../../../lib/supabase/server";
import { SPECIES_MEDIA_BUCKET } from "../../../../../lib/species-media/paths";
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
    const client = defaultSupabaseServerClient();
    const { data: asset } = await client.from("species_media_assets").select("status").eq("id", assetId).maybeSingle();
    if (asset?.status !== "active") return new NextResponse(null, { status: 404 });
    const { data: rendition } = await client.from("species_media_renditions")
      .select("storage_path").eq("asset_id", assetId).eq("variant", variant).maybeSingle();
    if (!rendition?.storage_path) return new NextResponse(null, { status: 404 });
    const { data, error } = await client.storage.from(SPECIES_MEDIA_BUCKET).download(rendition.storage_path);
    if (error || !data) return new NextResponse(null, { status: 404 });
    return new NextResponse(await data.arrayBuffer(), {
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
