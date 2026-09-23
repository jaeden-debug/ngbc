/* eslint-disable @next/next/no-img-element -- ImageResponse renders these, not a browser */
import { ImageResponse } from "next/og";
import { isPublishedSpeciesSlug } from "../../../../lib/content/species-route";
import { contentRepository } from "../../../../lib/content/repository";
import { speciesTitleCase } from "../../../../lib/seo/species-metadata";
import { cachedSpeciesPrimaryMedia, photoCredit, speciesPhotoDataUrl } from "../../../../lib/species-media/social";

export const runtime = "nodejs";
const size = { width: 1200, height: 630 };

type Props = { params: Promise<{ species: string }> };

async function speciesFor(slug: string) {
  const resource = await contentRepository.getResourceBySlug(slug, { locale: "en-CA" });
  return resource?.type === "species" ? resource : null;
}

/**
 * The species' own verified PRIMARY photo under a quiet North Ground band. No
 * photo is ever substituted: without a verified PRIMARY the card is the name on
 * the brand ground, exactly as the profile shows a placeholder.
 *
 * A route rather than the profile segment's opengraph-image so the page can
 * give each card its own alt text without prerendering it: the PRIMARY photo
 * is live data, and a card built at deploy would keep a replaced photo.
 */
export async function GET(_request: Request, { params }: Props) {
  const { species } = await params;
  if (!isPublishedSpeciesSlug(species)) return new Response(null, { status: 404 });
  const resource = await speciesFor(species);
  const profile = resource?.speciesProfile ?? null;
  const name = speciesTitleCase(resource?.title ?? "Species");
  const [media, groups] = profile
    ? await Promise.all([cachedSpeciesPrimaryMedia(profile.speciesId), contentRepository.getSpeciesGroups(profile.speciesId)])
    : [null, []];
  const photo = media ? await speciesPhotoDataUrl(media, size.width, size.height) : null;
  const group = groups[0]?.names.find(({ locale }) => locale === "en-CA")?.value ?? null;

  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", position: "relative", background: "linear-gradient(145deg, #10130f, #050706 62%)", color: "#e8e1c9" }}>
      {photo ? <img src={photo} width={size.width} height={size.height} style={{ position: "absolute", top: 0, left: 0, width: size.width, height: size.height }} alt="" /> : null}
      <div style={{ position: "absolute", top: 0, left: 0, width: size.width, height: size.height, display: "flex", background: "linear-gradient(0deg, rgba(5,7,6,.94) 0%, rgba(5,7,6,.7) 38%, rgba(5,7,6,0) 70%)" }} />
      <div style={{ position: "absolute", left: 64, right: 64, bottom: 52, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontSize: 24, letterSpacing: 8, textTransform: "uppercase", color: "#c9c2a6" }}>
          {`North Ground · ${group ?? "Species"}`}
        </div>
        <div style={{ display: "flex", fontSize: name.length > 22 ? 76 : 96, fontWeight: 700, letterSpacing: -2, marginTop: 14, lineHeight: 1.02 }}>
          {name}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 22, borderTop: "2px solid rgba(201,194,166,.4)", paddingTop: 18, fontSize: 26, color: "#c9c2a6" }}>
          <span>Habitat · Range · Identification · Field knowledge</span>
          {media && photo ? <span style={{ fontSize: 18, opacity: 0.8 }}>{`Photo: ${photoCredit(media)}`}</span> : null}
        </div>
      </div>
    </div>,
    { ...size, headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" } },
  );
}
