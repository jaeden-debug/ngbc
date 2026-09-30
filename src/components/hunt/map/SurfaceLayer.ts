"use client";

import { bufferStepPx, type RenderableSurface } from "../../../lib/hunt/exploration/surface-paint";
import { rasteriseSurface } from "./paint-surface";

/**
 * The species surface: a weather-radar field drawn UNDER the hunting geography.
 *
 * THE PANE IS THE ARCHITECTURE. Google composites `mapPane` below
 * `overlayLayer`, which is where the zone polygons live, so putting the canvas
 * there gives §41A's draw order — basemap, animal surface, zone boundaries,
 * legality outlines, condition markers, labels — as a property of the map's own
 * compositor rather than as a z-index someone can nudge. The canvas takes no
 * pointer events, so tapping a zone still reaches the polygon beneath the
 * cursor exactly as before.
 *
 * NOTHING HERE KNOWS WHAT A ZONE IS. There is no zone import, no zone geometry
 * and no zone identifier in this file. That is the §2 acceptance invariant made
 * structural: a hunting boundary cannot stop, clip, average or shape the
 * surface, because the code that draws the surface has no way to find one.
 *
 * ANCHORED, NOT REDRAWN. The field is rendered once for a geographic rectangle
 * larger than the viewport and then anchored to it. Panning re-projects that
 * rectangle — two coordinate conversions and a CSS box — so the surface moves
 * with the map at the map's own frame rate, and the sampling work happens only
 * when the hunter has panned beyond what was rendered or zoomed far enough that
 * the raster would show its own pixels.
 */

export interface SurfaceLayerHandle {
  set(surface: RenderableSurface | null): void;
  destroy(): void;
}

/** How far beyond the viewport the field is rendered, as a fraction of each side. */
const MARGIN = 0.3;
/** Re-render once the map has scaled this far from what the raster was drawn at. */
const RESCALE_TOLERANCE = 1.35;

export function createSurfaceLayer(maps: typeof google.maps, map: google.maps.Map): SurfaceLayerHandle {
  class SurfaceOverlay extends maps.OverlayView {
    surface: RenderableSurface | null = null;
    canvas: HTMLCanvasElement | null = null;
    /** The geographic rectangle the current raster covers. */
    rendered: { north: number; south: number; east: number; west: number } | null = null;
    /** The width in pixels the raster was drawn for, so a zoom can be detected. */
    renderedWidthPx = 0;

    onAdd() {
      const canvas = document.createElement("canvas");
      canvas.style.position = "absolute";
      canvas.style.pointerEvents = "none";
      /* Decoration to assistive technology: everything this says in colour is
         said in words by the legend and the zone card, which are real content.
         A canvas announced as an image would be an unlabelled one. */
      canvas.setAttribute("aria-hidden", "true");
      this.canvas = canvas;
      this.getPanes()?.mapPane.appendChild(canvas);
    }

    onRemove() {
      this.canvas?.remove();
      this.canvas = null;
      this.rendered = null;
    }

    /** Throw away the raster so the next draw rebuilds it. */
    invalidate() {
      this.rendered = null;
      this.draw();
    }

    draw() {
      const canvas = this.canvas;
      const projection = this.getProjection();
      if (!canvas || !projection) return;
      if (!this.surface) {
        canvas.style.display = "none";
        this.rendered = null;
        return;
      }
      const div = map.getDiv();
      const width = div.clientWidth;
      const height = div.clientHeight;
      if (!width || !height) return;

      const bounds = map.getBounds();
      if (!bounds) return;
      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();

      const covered = this.rendered
        && this.rendered.north >= ne.lat() && this.rendered.south <= sw.lat()
        && this.rendered.east >= ne.lng() && this.rendered.west <= sw.lng();
      const scaleDrifted = this.renderedWidthPx > 0
        && (width / this.renderedWidthPx > RESCALE_TOLERANCE || this.renderedWidthPx / width > RESCALE_TOLERANCE);

      if (!covered || scaleDrifted || !this.rendered) this.render(width, height, ne, sw);
      this.position();
    }

    /**
     * Sample the field into a raster for a rectangle wider than the viewport.
     *
     * The buffer is deliberately COARSER than the screen: one sample covers at
     * most a quarter of the surface's own effective resolution (§13). Sampling
     * a 40 km field per screen pixel would cost forty times the work to draw
     * exactly the same picture, and would invite the belief that the picture
     * carries pixel-level knowledge. The browser's own bilinear filter then
     * scales the raster up, which is what gives the soft radar edges — and it
     * is reconstruction of a field that is already smooth, not detail invented
     * to fill the gap.
     */
    render(width: number, height: number, ne: google.maps.LatLng, sw: google.maps.LatLng) {
      const surface = this.surface;
      const canvas = this.canvas;
      if (!surface || !canvas) return;

      const latMargin = (ne.lat() - sw.lat()) * MARGIN;
      const lngMargin = (ne.lng() - sw.lng()) * MARGIN;
      const rect = {
        north: Math.min(85, ne.lat() + latMargin),
        south: Math.max(-85, sw.lat() - latMargin),
        east: ne.lng() + lngMargin,
        west: sw.lng() - lngMargin,
      };

      const boxWidthPx = width * (1 + 2 * MARGIN);
      const boxHeightPx = height * (1 + 2 * MARGIN);
      /* Metres per pixel at the rectangle's middle latitude — the scale the
         hunter is actually looking at. */
      const middle = (rect.north + rect.south) / 2;
      const metresPerPixel = (Math.abs(rect.east - rect.west) * 111_320 * Math.cos((middle * Math.PI) / 180)) / boxWidthPx;
      const step = bufferStepPx(surface.effectiveResolutionMetres, metresPerPixel);

      const cols = Math.max(1, Math.ceil(boxWidthPx / step));
      const rows = Math.max(1, Math.ceil(boxHeightPx / step));

      const buffer = rasteriseSurface(surface, rect, cols, rows);
      if (!buffer) {
        /* Nothing in view was surveyed. The canvas is cleared rather than left
           showing the last place that was — a stale raster under a new viewport
           is evidence attached to the wrong ground. */
        canvas.style.display = "none";
        this.rendered = rect;
        this.renderedWidthPx = width;
        return;
      }

      canvas.width = Math.round(boxWidthPx);
      canvas.height = Math.round(boxHeightPx);
      const context = canvas.getContext("2d");
      if (!context) return;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(buffer, 0, 0, canvas.width, canvas.height);
      canvas.style.display = "";

      this.rendered = rect;
      this.renderedWidthPx = width;
    }

    /** Put the raster back over the ground it was drawn for. */
    position() {
      const canvas = this.canvas;
      const projection = this.getProjection();
      const rect = this.rendered;
      if (!canvas || !projection || !rect) return;
      const topLeft = projection.fromLatLngToDivPixel(new maps.LatLng(rect.north, rect.west));
      const bottomRight = projection.fromLatLngToDivPixel(new maps.LatLng(rect.south, rect.east));
      if (!topLeft || !bottomRight) return;
      canvas.style.left = `${topLeft.x}px`;
      canvas.style.top = `${topLeft.y}px`;
      canvas.style.width = `${bottomRight.x - topLeft.x}px`;
      canvas.style.height = `${bottomRight.y - topLeft.y}px`;
    }
  }

  const overlay = new SurfaceOverlay();
  overlay.setMap(map);

  return {
    set(surface) {
      /*
       * A SPECIES CHANGE THROWS THE RASTER AWAY. §12: switching from moose to
       * ruffed grouse must leave no moose hotspot underneath. Keeping the
       * raster and letting the next pan replace it would do exactly that, and
       * the stale part would be the part the hunter is not looking at — the
       * worst possible place for a wrong answer to survive.
       */
      const changed = overlay.surface?.speciesId !== surface?.speciesId
        || overlay.surface?.continuity !== surface?.continuity;
      overlay.surface = surface;
      if (changed) overlay.invalidate();
      else overlay.draw();
    },
    destroy() {
      overlay.setMap(null);
    },
  };
}
