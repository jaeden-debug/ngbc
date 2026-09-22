"use client";

import { placeLabels, type LabelCandidate } from "../../../lib/hunt/exploration/labels";

/**
 * Google Maps drawing helpers for Hunt's map.
 *
 * Each factory takes the loaded `google.maps` namespace, because the classes it
 * defines extend `OverlayView`, which does not exist until the API has loaded.
 * All of them draw; none of them decides anything.
 */

export interface LabelSource {
  key: string;
  text: string;
  short: string;
  /** Prefix that carries a filter state in words-and-glyph form, never colour alone. */
  glyph?: string;
  state?: string;
  labelPoint: [number, number];
  labelSpan: [number, number];
  priority: number;
  selected?: boolean;
}

export interface LabelLayerHandle {
  setLabels(labels: LabelSource[]): void;
  /** Hide the names with the boundaries they belong to. */
  setVisible(visible: boolean): void;
  /** How much screen a zone must own before it is named. */
  setMinimumSpan(px: number): void;
  /** Container pixel → coordinate, for a long press. Null before the first draw. */
  toCoordinate(x: number, y: number): { latitude: number; longitude: number } | null;
  destroy(): void;
}

export function createLabelLayer(
  maps: typeof google.maps,
  map: google.maps.Map,
  className: string,
): LabelLayerHandle {
  class LabelLayer extends maps.OverlayView {
    labels: LabelSource[] = [];
    container: HTMLDivElement | null = null;
    /** Set while the zones they name are switched off. */
    hidden = false;
    /** The screen span a zone needs before it is named, from the zoom band. */
    minimumSpan = 0;
    pool = new Map<string, HTMLSpanElement>();

    onAdd() {
      this.container = document.createElement("div");
      this.container.setAttribute("aria-hidden", "true");
      this.container.style.position = "absolute";
      this.container.style.pointerEvents = "none";
      if (this.hidden) this.container.style.display = "none";
      this.getPanes()?.overlayLayer.appendChild(this.container);
    }

    onRemove() {
      this.container?.remove();
      this.container = null;
      this.pool.clear();
    }

    /** Keys drawn last frame, so a pan does not make neighbours trade places. */
    lastPlaced = new Set<string>();

    draw() {
      const projection = this.getProjection();
      const container = this.container;
      if (!projection || !container) return;
      const div = map.getDiv();
      const view = { width: div.clientWidth, height: div.clientHeight };
      const bounds = map.getBounds();

      const candidates: Array<LabelCandidate & { source: LabelSource; divX: number; divY: number }> = [];
      for (const source of this.labels) {
        const [longitude, latitude] = source.labelPoint;
        // Only labels whose point is in view can be placed; skip projecting the rest.
        if (!source.selected && bounds && !bounds.contains({ lat: latitude, lng: longitude })) continue;
        const at = new maps.LatLng(latitude, longitude);
        const screen = projection.fromLatLngToContainerPixel(at);
        const placed = projection.fromLatLngToDivPixel(at);
        if (!screen || !placed) continue;
        const [spanLng, spanLat] = source.labelSpan;
        const corner = projection.fromLatLngToContainerPixel(new maps.LatLng(latitude + spanLat / 2, longitude + spanLng / 2));
        const opposite = projection.fromLatLngToContainerPixel(new maps.LatLng(latitude - spanLat / 2, longitude - spanLng / 2));
        if (!corner || !opposite) continue;
        const spanWidth = Math.abs(corner.x - opposite.x);
        const spanHeight = Math.abs(corner.y - opposite.y);
        /* A zone has to own enough of the screen to be worth naming. At
           country scale that leaves the big ones talking and the rest quiet,
           which is what stops the map becoming a wall of numbers. The chosen
           zone is named wherever it is. */
        if (!source.selected && Math.max(spanWidth, spanHeight) < layer.minimumSpan) continue;
        const prefix = source.glyph ? `${source.glyph} ` : "";
        candidates.push({
          key: source.key,
          text: `${prefix}${source.text}`,
          short: `${prefix}${source.short}`,
          x: screen.x,
          y: screen.y,
          spanWidth,
          spanHeight,
          priority: source.priority,
          force: source.selected,
          source,
          divX: placed.x,
          divY: placed.y,
        });
      }

      const placed = placeLabels(candidates, view, undefined, this.lastPlaced);
      const byKey = new Map(candidates.map((candidate) => [candidate.key, candidate]));
      const seen = new Set<string>();
      for (const label of placed) {
        const candidate = byKey.get(label.key)!;
        let element = this.pool.get(label.key);
        if (!element) {
          element = document.createElement("span");
          element.className = className;
          container.appendChild(element);
          this.pool.set(label.key, element);
        }
        if (element.textContent !== label.text) element.textContent = label.text;
        element.style.transform = `translate(${Math.round(candidate.divX)}px, ${Math.round(candidate.divY)}px) translate(-50%, -50%)`;
        element.dataset.selected = candidate.source.selected ? "true" : "";
        element.dataset.state = candidate.source.state ?? "";
        element.style.display = "";
        seen.add(label.key);
      }
      for (const [key, element] of this.pool) {
        if (!seen.has(key)) element.style.display = "none";
      }
      this.lastPlaced = seen;
    }
  }

  const layer = new LabelLayer();
  layer.setMap(map);
  return {
    setLabels(labels) {
      layer.labels = labels;
      layer.draw();
    },
    setMinimumSpan(px) {
      if (layer.minimumSpan === px) return;
      layer.minimumSpan = px;
      layer.draw();
    },
    setVisible(visible) {
      layer.hidden = !visible;
      if (layer.container) layer.container.style.display = visible ? "" : "none";
    },
    toCoordinate(x, y) {
      const projection = layer.getProjection();
      const at = projection?.fromContainerPixelToLatLng(new maps.Point(x, y));
      return at ? { latitude: at.lat(), longitude: at.lng() } : null;
    },
    destroy() {
      layer.setMap(null);
    },
  };
}

/* ── Self location: the conventional blue dot ────────────────────────────── */

export interface SelfMarkerHandle {
  update(fix: { latitude: number; longitude: number; accuracyMeters: number } | null): void;
  destroy(): void;
}

/**
 * The device's location, drawn the way every map app draws it — a blue dot with
 * a white ring and a translucent accuracy disc — so nobody mistakes it for the
 * hunt pin. It is not clickable and carries no hunt meaning.
 */
export function createSelfMarker(
  maps: typeof google.maps,
  map: google.maps.Map,
  className: string,
): SelfMarkerHandle {
  class SelfDot extends maps.OverlayView {
    position: google.maps.LatLng | null = null;
    element: HTMLDivElement | null = null;

    onAdd() {
      this.element = document.createElement("div");
      this.element.className = className;
      this.element.setAttribute("aria-hidden", "true");
      this.element.innerHTML = "<span></span>";
      this.getPanes()?.markerLayer.appendChild(this.element);
    }

    onRemove() {
      this.element?.remove();
      this.element = null;
    }

    draw() {
      const projection = this.getProjection();
      if (!projection || !this.element) return;
      if (!this.position) {
        this.element.style.display = "none";
        return;
      }
      const point = projection.fromLatLngToDivPixel(this.position);
      if (!point) return;
      this.element.style.display = "";
      this.element.style.transform = `translate(${Math.round(point.x)}px, ${Math.round(point.y)}px) translate(-50%, -50%)`;
    }
  }

  const dot = new SelfDot();
  dot.setMap(map);
  const accuracy = new maps.Circle({
    map,
    clickable: false,
    strokeColor: "#4c8ee8",
    strokeOpacity: 0.45,
    strokeWeight: 1,
    fillColor: "#4c8ee8",
    fillOpacity: 0.12,
    zIndex: 7,
    visible: false,
  });

  return {
    update(fix) {
      dot.position = fix ? new maps.LatLng(fix.latitude, fix.longitude) : null;
      dot.draw();
      if (fix) {
        accuracy.setCenter({ lat: fix.latitude, lng: fix.longitude });
        accuracy.setRadius(Math.max(5, fix.accuracyMeters));
        // A disc wider than a small town says nothing useful; the notice says it instead.
        accuracy.setVisible(fix.accuracyMeters <= 5_000);
      } else {
        accuracy.setVisible(false);
      }
    },
    destroy() {
      dot.setMap(null);
      accuracy.setMap(null);
    },
  };
}

/* ── The hunt pin and a previewed point ─────────────────────────────────── */

export interface PointMarkerHandle {
  update(point: { latitude: number; longitude: number } | null, title: string | null): void;
  destroy(): void;
}

/**
 * The hunt pin — a bone teardrop with a dark crosshair, "you plan to hunt
 * here" — and the dashed amber preview of a point not yet chosen. Their shape
 * differs from the round blue self dot as well as their colour, so the three
 * locations are told apart without relying on colour. Drawn as page elements
 * rather than Google markers, which keeps them styleable and needs no map id.
 */
export function createPointMarker(
  maps: typeof google.maps,
  map: google.maps.Map,
  className: string,
  variant: "hunt" | "preview",
): PointMarkerHandle {
  class PointMarker extends maps.OverlayView {
    position: google.maps.LatLng | null = null;
    element: HTMLDivElement | null = null;
    title: string | null = null;

    onAdd() {
      this.element = document.createElement("div");
      this.element.className = className;
      this.element.dataset.variant = variant;
      this.element.setAttribute("aria-hidden", "true");
      this.element.innerHTML =
        '<svg width="34" height="46" viewBox="0 0 34 46" focusable="false">' +
        '<path d="M17 44.5C17 44.5 3 28.6 3 17A14 14 0 0 1 31 17c0 11.6-14 27.5-14 27.5Z"/>' +
        '<circle cx="17" cy="17" r="6.2"/>' +
        '<path class="cross" d="M17 7.5v5M17 21.5v5M7.5 17h5M21.5 17h5"/></svg>';
      this.getPanes()?.markerLayer.appendChild(this.element);
    }

    onRemove() {
      this.element?.remove();
      this.element = null;
    }

    draw() {
      const projection = this.getProjection();
      if (!projection || !this.element) return;
      if (!this.position) {
        this.element.style.display = "none";
        return;
      }
      const point = projection.fromLatLngToDivPixel(this.position);
      if (!point) return;
      this.element.style.display = "";
      this.element.title = this.title ?? "";
      this.element.style.transform = `translate(${Math.round(point.x)}px, ${Math.round(point.y)}px) translate(-50%, -100%)`;
    }
  }

  const marker = new PointMarker();
  marker.setMap(map);
  return {
    update(point, title) {
      marker.position = point ? new maps.LatLng(point.latitude, point.longitude) : null;
      marker.title = title;
      marker.draw();
    },
    destroy() {
      marker.setMap(null);
    },
  };
}
