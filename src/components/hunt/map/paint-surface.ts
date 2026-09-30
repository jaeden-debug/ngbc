"use client";

import { edgeFade, paintFor, RECORDED_PRESENCE, sampleSurfaceWithSupport, type RenderableSurface } from "../../../lib/hunt/exploration/surface-paint";

/**
 * The hatch a recorded-presence square is filled with. A pattern, not a
 * colour, so no point of the heat ramp can be read as "recorded here" and no
 * recorded square can be read as a heat value.
 */
function recordedPattern(context: CanvasRenderingContext2D): CanvasPattern | string {
  const { wash, hatch, spacing } = RECORDED_PRESENCE;
  const tile = document.createElement("canvas");
  tile.width = spacing;
  tile.height = spacing;
  const pen = tile.getContext("2d");
  if (!pen) return `rgba(${wash.red}, ${wash.green}, ${wash.blue}, ${wash.alpha})`;
  pen.fillStyle = `rgba(${wash.red}, ${wash.green}, ${wash.blue}, ${wash.alpha})`;
  pen.fillRect(0, 0, spacing, spacing);
  pen.strokeStyle = `rgba(${hatch.red}, ${hatch.green}, ${hatch.blue}, ${hatch.alpha})`;
  pen.lineWidth = 1.2;
  pen.beginPath();
  pen.moveTo(0, spacing);
  pen.lineTo(spacing, 0);
  pen.stroke();
  return context.createPattern(tile, "repeat") ?? `rgba(${wash.red}, ${wash.green}, ${wash.blue}, ${wash.alpha})`;
}

/**
 * Sample a species surface into a raster, once, for both renderers.
 *
 * WHY IT IS SHARED. Hunt draws its map two ways — the Google map in production
 * and `ZoneCanvas` when Google is unavailable — and a species surface that
 * existed in only one of them would mean the fallback silently showed a hunter
 * no animal evidence while the legend went on describing it. Worse, a second
 * implementation would be free to drift: to fill unsurveyed ground, to smooth a
 * discrete survey, to clamp a value. One function, one set of rules.
 *
 * `null` from `sampleSurface` is UNSURVEYED and leaves the pixel completely
 * transparent. It is never painted at the bottom of the ramp, which would draw
 * ground nobody has visited as though it had been searched and found empty.
 */

export interface GeoRect { north: number; south: number; east: number; west: number }

export const mercatorY = (latitude: number) => Math.log(Math.tan(Math.PI / 4 + (latitude * Math.PI) / 360));
export const inverseMercatorY = (y: number) => ((Math.atan(Math.exp(y)) - Math.PI / 4) * 360) / Math.PI;

/** Where a coordinate lands inside a rectangle drawn at `width` x `height`. */
export function projectInto(rect: GeoRect, width: number, height: number) {
  const yNorth = mercatorY(rect.north);
  const ySouth = mercatorY(rect.south);
  return (longitude: number, latitude: number): [number, number] => [
    ((longitude - rect.west) / (rect.east - rect.west)) * width,
    ((mercatorY(latitude) - yNorth) / (ySouth - yNorth)) * height,
  ];
}

/**
 * The surveyed plots of a DISCRETE surface, drawn at their own published
 * extent.
 *
 * HARD EDGES ARE THE POINT. The authority flew a 25 km² square and counted what
 * was on it; it said nothing whatever about the ground on the other side of the
 * plot's edge. A soft edge would draw a claim about that ground, and a field
 * interpolated between plots would draw a continental duck map out of a few
 * hundred helicopter flights. So plots are vector fills with no smoothing, no
 * blur and no gradient — and nothing between them.
 */
export function paintPlots(
  context: CanvasRenderingContext2D,
  surface: RenderableSurface,
  rect: GeoRect,
  width: number,
  height: number,
): number {
  if (!surface.plots?.length) return 0;
  const project = projectInto(rect, width, height);
  const recorded = surface.style === "RECORDED" ? recordedPattern(context) : null;
  let drawn = 0;
  for (const plot of surface.plots) {
    if (recorded) {
      context.fillStyle = recorded;
    } else {
      const { red, green, blue, alpha } = paintFor(plot.score);
      context.fillStyle = `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    }
    context.beginPath();
    for (const ring of plot.rings) {
      if (ring.length < 3) continue;
      ring.forEach(([longitude, latitude], index) => {
        const [x, y] = project(longitude, latitude);
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.closePath();
    }
    context.fill("evenodd");
    drawn += 1;
  }
  return drawn;
}

/**
 * A raster of the surface over `rect`, at `cols` x `rows` samples.
 *
 * Deliberately coarse: the caller sizes it from the surface's own effective
 * resolution, and whoever draws it scales it up with the browser's bilinear
 * filter. That is what gives the soft radar edges, and it is reconstruction of
 * a field that is already smooth rather than detail invented to fill a gap.
 *
 * Returns null when nothing in the rectangle was surveyed, so a caller can tell
 * "no evidence here" from "an image of nothing" and say the first in words.
 */
export function rasteriseSurface(
  surface: RenderableSurface,
  rect: GeoRect,
  cols: number,
  rows: number,
): HTMLCanvasElement | null {
  if (cols < 1 || rows < 1 || !surface.grid || !surface.cells) return null;
  const canvas = document.createElement("canvas");
  canvas.width = cols;
  canvas.height = rows;
  const context = canvas.getContext("2d");
  if (!context) return null;
  const image = context.createImageData(cols, rows);
  const data = image.data;

  /* Mercator is linear in longitude and in the log-tangent of latitude, so the
     whole rectangle maps with two interpolations and no per-sample call into a
     projection. */
  const yNorth = mercatorY(rect.north);
  const ySouth = mercatorY(rect.south);
  let painted = 0;
  for (let row = 0; row < rows; row += 1) {
    const latitude = inverseMercatorY(yNorth + ((ySouth - yNorth) * (row + 0.5)) / rows);
    for (let col = 0; col < cols; col += 1) {
      const longitude = rect.west + ((rect.east - rect.west) * (col + 0.5)) / cols;
      const sample = sampleSurfaceWithSupport(surface, latitude, longitude);
      if (sample === null) continue;
      const { red, green, blue, alpha } = paintFor(sample.value);
      /* The edge of the surveyed area fades rather than stepping cell by cell;
         only opacity changes, never the colour a value earns (see edgeFade). */
      const faded = alpha * edgeFade(sample.support) * (surface.opacity ?? 1);
      if (faded <= 0) continue;
      const at = (row * cols + col) * 4;
      data[at] = red;
      data[at + 1] = green;
      data[at + 2] = blue;
      data[at + 3] = Math.round(faded * 255);
      painted += 1;
    }
  }
  if (!painted) return null;
  context.putImageData(image, 0, 0);
  return canvas;
}
