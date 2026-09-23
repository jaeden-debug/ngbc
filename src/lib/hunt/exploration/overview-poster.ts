/**
 * The official zone boundaries as a picture, for the first second of Hunt.
 *
 * The live map needs the Maps JavaScript API, its tiles and North Ground's
 * geometry before it can draw a single zone — seconds on a phone. This is the
 * same official overview geometry drawn once on the server into an image in the
 * exact projection, scale and centre the live map opens at, so the page shows
 * real boundaries almost at once and the live map then takes over in place:
 * every line of the picture lies under the line the map is about to draw.
 *
 * It is a drawing of the authorities' own generalised boundaries and nothing
 * else — no basemap, no invented coastline — and it is never interactive.
 */

import { OPENING_BOX, OPENING_CAMERA } from "./overview.ts";

export { OPENING_CAMERA };

const TILE = 256;

/**
 * The box the poster covers: exactly the box the map asks for first, because
 * the poster is a drawing of that answer and nothing else. One declared
 * camera drives both, so the picture lies under the lines the map draws.
 */
export const POSTER_BOX = OPENING_BOX;

function worldX(longitude: number, zoom: number): number {
  return ((longitude + 180) / 360) * TILE * 2 ** zoom;
}

function worldY(latitude: number, zoom: number): number {
  const clamped = Math.max(-85.05, Math.min(85.05, latitude));
  const radians = (clamped * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) * TILE * 2 ** zoom;
}

export interface PosterFrame {
  width: number;
  height: number;
  /** Pixel inside the poster that sits under the live map's centre. */
  centreX: number;
  centreY: number;
}

/** The poster's size and the pixel under the opening camera: fixed, so layout needs no JavaScript. */
export function posterFrame(): PosterFrame {
  const zoom = OPENING_CAMERA.zoom;
  const left = worldX(POSTER_BOX.west, zoom);
  const top = worldY(POSTER_BOX.north, zoom);
  return {
    width: Math.round(worldX(POSTER_BOX.east, zoom) - left),
    height: Math.round(worldY(POSTER_BOX.south, zoom) - top),
    centreX: Math.round((worldX(OPENING_CAMERA.longitude, zoom) - left) * 100) / 100,
    centreY: Math.round((worldY(OPENING_CAMERA.latitude, zoom) - top) * 100) / 100,
  };
}

export interface PosterZone {
  coverage: string;
  rings: number[][][];
}

/**
 * The SVG. Paths are in whole poster pixels as relative moves — a zone line
 * within half a pixel of where the live map draws it at the opening zoom — one
 * path per coverage class so the certified/boundary-only distinction matches
 * the live map's. Attributes use single quotes so the image can travel inside
 * the page as a data URI with almost no escaping.
 */
export function posterSvg(zones: readonly PosterZone[]): string {
  const zoom = OPENING_CAMERA.zoom;
  const left = worldX(POSTER_BOX.west, zoom);
  const top = worldY(POSTER_BOX.north, zoom);
  const { width, height } = posterFrame();
  const paths = new Map<string, string[]>();
  for (const zone of zones) {
    const key = zone.coverage === "VERIFIED" ? "VERIFIED" : "OTHER";
    const list = paths.get(key) ?? [];
    for (const ring of zone.rings) {
      let d = "";
      let lastX = 0, lastY = 0, points = 0;
      for (const [longitude, latitude] of ring) {
        const x = Math.round(worldX(longitude, zoom) - left);
        const y = Math.round(worldY(latitude, zoom) - top);
        if (points > 0 && x === lastX && y === lastY) continue;
        d += points === 0 ? `M${x} ${y}` : `l${x - lastX} ${y - lastY}`;
        lastX = x;
        lastY = y;
        points += 1;
      }
      // Anything that collapses below a triangle at this zoom has nothing to show.
      if (points >= 3) list.push(`${d.replace(/ -/g, "-")}z`);
    }
    paths.set(key, list);
  }
  const style = {
    VERIFIED: "fill='rgba(184,211,168,0.05)' stroke='rgba(184,211,168,0.7)' stroke-width='1.2'",
    OTHER: "fill='rgba(141,156,135,0.025)' stroke='rgba(141,156,135,0.45)' stroke-width='0.9'",
  } as const;
  const body = (["OTHER", "VERIFIED"] as const)
    .filter((key) => paths.get(key)?.length)
    .map((key) => `<path ${style[key]} stroke-linejoin='round' fill-rule='evenodd' d='${paths.get(key)!.join("")}'/>`)
    .join("");
  return `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}' viewBox='0 0 ${width} ${height}'>${body}</svg>`;
}

/**
 * The SVG as a data URI for an <img>: carried in the page itself, so the
 * picture paints with the first render instead of waiting on a request.
 * Only the characters a URI cannot carry, and quotes, are escaped.
 */
export function posterDataUri(svg: string): string {
  // Quotes too: in an HTML attribute React would write each as a six-character entity.
  return `data:image/svg+xml,${svg.replace(/%/g, "%25").replace(/#/g, "%23").replace(/</g, "%3C").replace(/>/g, "%3E").replace(/'/g, "%27").replace(/"/g, "%22")}`;
}
