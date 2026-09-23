import { ImageResponse } from "next/og";
import { getSpeciesPrimaryMediaMap } from "../../../lib/species-media/repository";
import { speciesPhotoDataUrl } from "../../../lib/species-media/social";

export const runtime = "nodejs";
const size = { width: 1200, height: 630 };

/** Recognisable species across both countries' big game, upland and waterfowl. */
const FEATURED = [
  "species:moose",
  "species:white-tailed-deer",
  "species:american-black-bear",
  "species:ruffed-grouse",
  "species:mallard",
] as const;

/**
 * Library card: the featured species' own verified PRIMARY photos as strips.
 * A species without one is left out rather than filled with another image.
 *
 * A route rather than the library segment's opengraph-image, which the
 * `[species]` segment beside it would claim as a slug.
 */
export async function GET() {
  const media = await getSpeciesPrimaryMediaMap([...FEATURED]);
  const available = FEATURED.flatMap((id) => (media.has(id) ? [media.get(id)!] : []));
  const stripWidth = available.length ? Math.floor(size.width / available.length) : 0;
  const photos = (await Promise.all(available.map((item) => speciesPhotoDataUrl(item, stripWidth, size.height))))
    .filter((photo): photo is string => photo !== null);
  const creators = [...new Set(available.map((item) => item.creator))].join(", ");
  const licences = [...new Set(available.map((item) => item.licence))].join(", ");

  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", position: "relative", background: "linear-gradient(145deg, #10130f, #050706 62%)", color: "#e8e1c9" }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: size.width, height: size.height, display: "flex" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- rendered by ImageResponse, not the browser */}
        {photos.map((photo, index) => (
          <img key={index} src={photo} width={stripWidth} height={size.height} alt="" style={{ borderRight: "2px solid #050706" }} />
        ))}
      </div>
      <div style={{ position: "absolute", top: 0, left: 0, width: size.width, height: size.height, display: "flex", background: "linear-gradient(0deg, rgba(5,7,6,.95) 0%, rgba(5,7,6,.72) 42%, rgba(5,7,6,.15) 80%)" }} />
      <div style={{ position: "absolute", left: 64, right: 64, bottom: 52, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontSize: 24, letterSpacing: 8, textTransform: "uppercase", color: "#c9c2a6" }}>
          North Ground · Canada · United States
        </div>
        <div style={{ display: "flex", fontSize: 72, fontWeight: 700, letterSpacing: -2, marginTop: 14, lineHeight: 1.02 }}>
          North American Game Species
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 22, borderTop: "2px solid rgba(201,194,166,.4)", paddingTop: 18, fontSize: 26, color: "#c9c2a6" }}>
          <span>Habitat · Range · Identification · Hunting context</span>
          {photos.length ? <span style={{ fontSize: 16, opacity: 0.8, maxWidth: 420, textAlign: "right" }}>{`Photos: ${creators} (${licences})`}</span> : null}
        </div>
      </div>
    </div>,
    { ...size, headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" } },
  );
}
