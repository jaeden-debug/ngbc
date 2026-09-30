"use client";

import { rampAt, sampleSurface, type RenderableSurface } from "../../../lib/hunt/exploration/surface-paint";

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

const mercatorY = (latitude: number) => Math.log(Math.tan(Math.PI / 4 + (latitude * Math.PI) / 360));
const inverseMercatorY = (y: number) => ((Math.atan(Math.exp(y)) - Math.PI / 4) * 360) / Math.PI;

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
  if (cols < 1 || rows < 1) return null;
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
      const intensity = sampleSurface(surface, latitude, longitude);
      if (intensity === null) continue;
      const { red, green, blue, alpha } = rampAt(intensity);
      const at = (row * cols + col) * 4;
      data[at] = red;
      data[at + 1] = green;
      data[at + 2] = blue;
      data[at + 3] = Math.round(alpha * 255);
      painted += 1;
    }
  }
  if (!painted) return null;
  context.putImageData(image, 0, 0);
  return canvas;
}
