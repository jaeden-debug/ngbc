"use client";

import type { BBox, DrawnZone } from "../../../lib/hunt/exploration/geometry-store";
import type { GeoPoint } from "../../../lib/hunt/exploration/map-state";
import type { OverlayFeature } from "../../../lib/hunt/exploration/overlay-layers";
import { mapLabelFor } from "../../../lib/hunt/exploration/map-labels";
import { EXPLORATION_WORDING, type ExplorationState as ZoneState } from "../../../lib/hunt/exploration/states";
import { BASEMAP_STYLE } from "./google-loader";
import { createLabelLayer, createPointMarker, createSelfMarker, type LabelLayerHandle, type LabelSource, type PointMarkerHandle, type SelfMarkerHandle } from "./google-overlays";

/**
 * The Google map, driven imperatively.
 *
 * React describes what should be on the map; this class makes the fewest
 * changes that get it there. One polygon per official zone is created once and
 * kept for the life of the map: a finer drawing replaces its paths in place, a
 * style change touches only the polygons whose style actually changed, and
 * nothing is torn down because a response is slow or a request failed. That is
 * what keeps the zones on screen while the map moves.
 *
 * The camera moves only when asked, and then as little as it can: a zone that
 * is already fully in view is not re-framed, and one that fits at the current
 * zoom is panned to rather than zoomed.
 */

export interface MapCallbacks {
  onZoneClick(key: string): void;
  onEmptyClick(): void;
  onLongPress(point: GeoPoint): void;
  onViewChange(view: { box: BBox; zoom: number }): void;
  onOverlayClick(layerId: string, objectId: number): void;
  onZoneHover?(key: string | null): void;
}

export interface Padding { top: number; right: number; bottom: number; left: number }

export interface ZoneStyleState {
  selectedKey: string | null;
  huntKey: string | null;
  filterStates: ReadonlyMap<string, ZoneState> | null;
}

const NORTH_AMERICA = { north: 84, south: 14, west: -170, east: -48 };
const LONG_PRESS_MS = 550;
const LONG_PRESS_SLOP_PX = 10;
const MAX_FRAMING_ZOOM = 13;

const COVERAGE_STROKE: Record<string, string> = {
  VERIFIED: "#b8d3a8",
  PARTIAL: "#8faa86",
  IN_DEVELOPMENT: "#8d9c87",
  UNAVAILABLE: "#6a6f66",
};

/* One restrained hue per state, always paired with a glyph and a word in the label and legend. */
const STATE_FILL: Partial<Record<ZoneState, { color: string; opacity: number }>> = {
  SEASON_AVAILABLE: { color: "#7cc08a", opacity: 0.32 },
  SEASON_EXCEPT_AREAS: { color: "#7cc08a", opacity: 0.18 },
  CHECK_REQUIREMENTS: { color: "#e0a04a", opacity: 0.26 },
  NEEDS_VERIFICATION: { color: "#c9a26a", opacity: 0.16 },
  CONFLICT: { color: "#d97a6c", opacity: 0.22 },
  CLOSED: { color: "#9aa0a6", opacity: 0.1 },
};

function zoneOptions(coverage: string, flags: { selected: boolean; hunt: boolean; hovered: boolean; state?: ZoneState; filtering: boolean }): google.maps.PolygonOptions {
  const certified = coverage === "VERIFIED";
  const fill = flags.state ? STATE_FILL[flags.state] : undefined;
  if (flags.selected) {
    return {
      strokeColor: "#f0ead8", strokeOpacity: 1, strokeWeight: 3,
      fillColor: fill?.color ?? "#9fbc8e", fillOpacity: fill ? fill.opacity + 0.06 : 0.14, zIndex: 6,
    };
  }
  if (flags.hunt) {
    return {
      strokeColor: "#f0ead8", strokeOpacity: 0.8, strokeWeight: 2,
      fillColor: fill?.color ?? "#9fbc8e", fillOpacity: fill ? fill.opacity : 0.08, zIndex: 5,
    };
  }
  const stroke = COVERAGE_STROKE[coverage] ?? COVERAGE_STROKE.IN_DEVELOPMENT;
  return {
    strokeColor: stroke,
    strokeOpacity: flags.hovered ? 0.95 : certified ? 0.7 : 0.45,
    strokeWeight: flags.hovered ? 2 : certified ? 1.2 : 0.9,
    fillColor: fill?.color ?? stroke,
    fillOpacity: fill ? fill.opacity + (flags.hovered ? 0.06 : 0) : flags.hovered ? 0.1 : flags.filtering ? 0 : certified ? 0.05 : 0.025,
    zIndex: flags.hovered ? 4 : certified ? 3 : 2,
  };
}

function signature(options: google.maps.PolygonOptions): string {
  return `${options.strokeColor}|${options.strokeOpacity}|${options.strokeWeight}|${options.fillColor}|${options.fillOpacity}|${options.zIndex}`;
}

function toPaths(rings: number[][][]): google.maps.LatLngLiteral[][] {
  return rings.map((ring) => ring.map(([lng, lat]) => ({ lat, lng })));
}

interface ZoneShape {
  polygon: google.maps.Polygon;
  rings: number[][][];
  coverage: string;
  style: string;
}

export class GoogleZoneMap {
  readonly map: google.maps.Map;
  private readonly maps: typeof google.maps;
  private readonly callbacks: MapCallbacks;
  private readonly shapes = new Map<string, ZoneShape>();
  private readonly overlayShapes: Array<google.maps.Polygon | google.maps.Polyline> = [];
  private readonly labels: LabelLayerHandle;
  private readonly self: SelfMarkerHandle;
  private readonly huntPin: PointMarkerHandle;
  private readonly previewPin: PointMarkerHandle;
  private style: ZoneStyleState = { selectedKey: null, huntKey: null, filterStates: null };
  private hoverKey: string | null = null;
  private suppressClickUntil = 0;
  private readonly cleanups: Array<() => void> = [];
  private readonly reducedMotion: boolean;
  private framingListener: google.maps.MapsEventListener | null = null;

  constructor(container: HTMLElement, maps: typeof google.maps, callbacks: MapCallbacks, options: {
    center: GeoPoint; zoom: number; fineControls: boolean; labelClass: string; selfClass: string; pinClass: string;
  }) {
    this.maps = maps;
    this.callbacks = callbacks;
    this.reducedMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    this.map = new maps.Map(container, {
      center: { lat: options.center.latitude, lng: options.center.longitude },
      zoom: options.zoom,
      mapTypeId: "terrain",
      styles: BASEMAP_STYLE,
      disableDefaultUI: true,
      // A zoom control earns its place only for a mouse; fingers pinch.
      zoomControl: options.fineControls,
      zoomControlOptions: { position: maps.ControlPosition.RIGHT_BOTTOM },
      gestureHandling: "greedy",
      clickableIcons: false,
      keyboardShortcuts: true,
      minZoom: 3,
      maxZoom: 18,
      restriction: { latLngBounds: NORTH_AMERICA, strictBounds: false },
      backgroundColor: "#151a15",
    });
    this.labels = createLabelLayer(maps, this.map, options.labelClass);
    this.self = createSelfMarker(maps, this.map, options.selfClass);
    this.huntPin = createPointMarker(maps, this.map, options.pinClass, "hunt");
    this.previewPin = createPointMarker(maps, this.map, options.pinClass, "preview");

    const listeners = [
      this.map.addListener("idle", () => {
        const box = this.visibleBox();
        if (box) callbacks.onViewChange({ box, zoom: this.map.getZoom() ?? options.zoom });
      }),
      // A plain click away from every zone closes what is open. It never picks a location.
      this.map.addListener("click", () => {
        if (Date.now() < this.suppressClickUntil) return;
        callbacks.onEmptyClick();
      }),
      // Right-click on a desktop, and a long press on most touch browsers.
      this.map.addListener("contextmenu", (event: google.maps.MapMouseEvent) => {
        if (!event.latLng || Date.now() < this.suppressClickUntil) return;
        this.suppressClickUntil = Date.now() + 700;
        callbacks.onLongPress({ latitude: event.latLng.lat(), longitude: event.latLng.lng() });
      }),
    ];
    this.cleanups.push(() => listeners.forEach((listener) => listener.remove()));
    this.cleanups.push(this.watchLongPress(container));
  }

  /* ── Zones ─────────────────────────────────────────────────────────────── */

  /** Put exactly these drawings on the map, changing only what differs. */
  setZones(drawn: readonly DrawnZone[]): void {
    const wanted = new Set<string>();
    for (const zone of drawn) {
      wanted.add(zone.key);
      const existing = this.shapes.get(zone.key);
      if (!existing) {
        const polygon = new this.maps.Polygon({ map: this.map, paths: toPaths(zone.piece.rings), clickable: true });
        const key = zone.key;
        polygon.addListener("click", () => {
          if (Date.now() < this.suppressClickUntil) return;
          this.callbacks.onZoneClick(key);
        });
        polygon.addListener("contextmenu", (event: google.maps.PolyMouseEvent) => {
          if (!event.latLng || Date.now() < this.suppressClickUntil) return;
          this.suppressClickUntil = Date.now() + 700;
          this.callbacks.onLongPress({ latitude: event.latLng.lat(), longitude: event.latLng.lng() });
        });
        polygon.addListener("mouseover", () => this.setHover(key));
        polygon.addListener("mouseout", () => { if (this.hoverKey === key) this.setHover(null); });
        this.shapes.set(key, { polygon, rings: zone.piece.rings, coverage: zone.coverage, style: "" });
        continue;
      }
      if (existing.rings !== zone.piece.rings) {
        existing.polygon.setPaths(toPaths(zone.piece.rings));
        existing.rings = zone.piece.rings;
      }
      existing.coverage = zone.coverage;
    }
    for (const [key, shape] of this.shapes) {
      if (wanted.has(key)) continue;
      this.maps.event.clearInstanceListeners(shape.polygon);
      shape.polygon.setMap(null);
      this.shapes.delete(key);
    }
    this.restyle();
  }

  setStyleState(next: ZoneStyleState): void {
    this.style = next;
    this.restyle();
  }

  private setHover(key: string | null): void {
    if (this.hoverKey === key) return;
    this.hoverKey = key;
    this.restyle();
    this.callbacks.onZoneHover?.(key);
  }

  /** Apply each polygon's style, touching only the ones that changed. */
  private restyle(): void {
    const { selectedKey, huntKey, filterStates } = this.style;
    const filtering = Boolean(filterStates);
    for (const [key, shape] of this.shapes) {
      const options = zoneOptions(shape.coverage, {
        selected: key === selectedKey,
        hunt: key === huntKey,
        hovered: key === this.hoverKey,
        state: filterStates?.get(key),
        filtering,
      });
      const next = signature(options);
      if (next === shape.style) continue;
      shape.polygon.setOptions(options);
      shape.style = next;
    }
  }

  setLabels(drawn: readonly DrawnZone[]): void {
    const { selectedKey, huntKey, filterStates } = this.style;
    const sources: LabelSource[] = [];
    for (const zone of drawn) {
      const { labelPoint, labelSpan } = zone.piece;
      // Compact label, else the designation label, else no label — never a raw code.
      const text = mapLabelFor(zone);
      if (!labelPoint || !labelSpan || !text) continue;
      const state = filterStates?.get(zone.key);
      const selected = zone.key === selectedKey || zone.key === huntKey;
      sources.push({
        key: zone.key,
        text,
        short: text,
        labelPoint,
        labelSpan,
        priority: selected ? 100 : zone.coverage === "VERIFIED" ? 2 : 1,
        selected,
        ...(state ? { glyph: EXPLORATION_WORDING[state].glyph, state } : {}),
      });
    }
    this.labels.setLabels(sources);
  }

  /* ── Special areas ─────────────────────────────────────────────────────── */

  setOverlays(features: readonly OverlayFeature[]): void {
    for (const shape of this.overlayShapes) {
      this.maps.event.clearInstanceListeners(shape);
      shape.setMap(null);
    }
    this.overlayShapes.length = 0;
    /* A special area reads as a different kind of thing from a management zone:
       a dashed amber outline over a light wash, not another solid colour. */
    const dash = { path: "M 0,-1 0,1", strokeOpacity: 0.95, strokeColor: "#e0a04a", scale: 2 };
    for (const feature of features) {
      const paths = toPaths(feature.rings);
      const polygon = new this.maps.Polygon({
        map: this.map, paths, strokeWeight: 0, fillColor: "#e0a04a", fillOpacity: 0.14, zIndex: 8, clickable: true,
      });
      polygon.addListener("click", () => {
        if (Date.now() < this.suppressClickUntil) return;
        this.callbacks.onOverlayClick(feature.layerId, feature.objectId);
      });
      this.overlayShapes.push(polygon, ...paths.map((path) => new this.maps.Polyline({
        map: this.map, path, strokeOpacity: 0, clickable: false, zIndex: 8,
        icons: [{ icon: dash, offset: "0", repeat: "9px" }],
      })));
    }
  }

  /* ── Points ────────────────────────────────────────────────────────────── */

  setHuntPin(point: GeoPoint | null, label: string | null): void {
    this.huntPin.update(point, label ? `Planned hunt location: ${label}` : null);
  }

  setPreviewPin(point: GeoPoint | null): void {
    this.previewPin.update(point, point ? "Previewed location — not selected" : null);
  }

  setSelf(fix: { latitude: number; longitude: number; accuracyMeters: number } | null): void {
    this.self.update(fix);
  }

  setMapType(mode: "terrain" | "hybrid"): void {
    this.map.setMapTypeId(mode);
  }

  /* ── Camera ────────────────────────────────────────────────────────────── */

  visibleBox(): BBox | null {
    const bounds = this.map.getBounds();
    if (!bounds) return null;
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    return { west: sw.lng(), south: sw.lat(), east: ne.lng(), north: ne.lat() };
  }

  centre(): GeoPoint | null {
    const centre = this.map.getCenter();
    return centre ? { latitude: centre.lat(), longitude: centre.lng() } : null;
  }

  /** Container pixel → coordinate, for a long press. */
  toCoordinate(x: number, y: number): GeoPoint | null {
    return this.labels.toCoordinate(x, y);
  }

  /** Pixel size of a box at a zoom, from the map's projection. */
  private pixelSize(box: BBox, zoom: number): { width: number; height: number } | null {
    const projection = this.map.getProjection();
    if (!projection) return null;
    const scale = 2 ** zoom;
    const sw = projection.fromLatLngToPoint(new this.maps.LatLng(box.south, box.west));
    const ne = projection.fromLatLngToPoint(new this.maps.LatLng(box.north, box.east));
    if (!sw || !ne) return null;
    return { width: Math.abs(ne.x - sw.x) * scale, height: Math.abs(sw.y - ne.y) * scale };
  }

  /** The part of the view left uncovered by `padding`, as a box. */
  private usableBox(padding: Padding): BBox | null {
    const div = this.map.getDiv();
    const box = this.visibleBox();
    if (!box) return null;
    const width = div.clientWidth || 1;
    const height = div.clientHeight || 1;
    const lngPerPx = (box.east - box.west) / width;
    const latPerPx = (box.north - box.south) / height;
    return {
      west: box.west + padding.left * lngPerPx,
      east: box.east - padding.right * lngPerPx,
      north: box.north - padding.top * latPerPx,
      south: box.south + padding.bottom * latPerPx,
    };
  }

  /**
   * Show a zone. Left alone if it is already fully in view; panned to if it
   * fits at the current zoom; otherwise framed. Never zoomed past street level
   * for a small zone.
   */
  showBox(box: BBox, padding: Padding): void {
    const usable = this.usableBox(padding);
    if (usable && box.west >= usable.west && box.east <= usable.east && box.south >= usable.south && box.north <= usable.north) {
      const zoom = this.map.getZoom() ?? 0;
      const size = this.pixelSize(box, zoom);
      const div = this.map.getDiv();
      // Visible AND legible: at least a sixth of the free width or height.
      if (size && (size.width >= (div.clientWidth - padding.left - padding.right) / 6 || size.height >= (div.clientHeight - padding.top - padding.bottom) / 6)) return;
    }
    const bounds = new this.maps.LatLngBounds({ lat: box.south, lng: box.west }, { lat: box.north, lng: box.east });
    const zoom = this.map.getZoom() ?? 0;
    const size = this.pixelSize(box, zoom);
    const div = this.map.getDiv();
    const fitsNow = size && size.width <= div.clientWidth - padding.left - padding.right &&
      size.height <= div.clientHeight - padding.top - padding.bottom;
    if (fitsNow && size && (size.width >= div.clientWidth / 6 || size.height >= div.clientHeight / 6) && !this.reducedMotion) {
      this.map.panToBounds(bounds, padding);
      return;
    }
    this.map.fitBounds(bounds, padding);
    this.framingListener?.remove();
    this.framingListener = this.maps.event.addListenerOnce(this.map, "idle", () => {
      this.framingListener = null;
      if ((this.map.getZoom() ?? 0) > MAX_FRAMING_ZOOM) this.map.setZoom(MAX_FRAMING_ZOOM);
    });
  }

  /** Bring a point into the free part of the view, at no less than `minZoom`. */
  showPoint(point: GeoPoint, minZoom: number, padding: Padding): void {
    const usable = this.usableBox(padding);
    const zoom = this.map.getZoom() ?? 0;
    const inView = usable && point.longitude >= usable.west && point.longitude <= usable.east &&
      point.latitude >= usable.south && point.latitude <= usable.north;
    if (inView && zoom >= minZoom) return;
    const targetZoom = Math.max(zoom, minZoom);
    // Centre the point in the free area, not the whole map, where a panel covers part of it.
    const target = this.offsetCentre(point, (padding.left - padding.right) / 2, (padding.top - padding.bottom) / 2, targetZoom);
    if (targetZoom !== zoom || this.reducedMotion) {
      this.map.setZoom(targetZoom);
      this.map.setCenter(target);
    } else {
      this.map.panTo(target);
    }
  }

  /** The centre that puts `point` `ox`,`oy` pixels right of and below the map's middle. */
  private offsetCentre(point: GeoPoint, ox: number, oy: number, zoom: number): google.maps.LatLngLiteral {
    const projection = this.map.getProjection();
    const fallback = { lat: point.latitude, lng: point.longitude };
    if (!projection || (!ox && !oy)) return fallback;
    const world = projection.fromLatLngToPoint(new this.maps.LatLng(point.latitude, point.longitude));
    if (!world) return fallback;
    const scale = 2 ** zoom;
    const centre = projection.fromPointToLatLng(new this.maps.Point(world.x - ox / scale, world.y - oy / scale));
    return centre ? { lat: centre.lat(), lng: centre.lng() } : fallback;
  }

  panToCentre(point: GeoPoint): void {
    const target = { lat: point.latitude, lng: point.longitude };
    if (this.reducedMotion) this.map.setCenter(target);
    else this.map.panTo(target);
  }

  /* ── Long press: measured from the pointer, because iOS reports no contextmenu ── */

  private watchLongPress(element: HTMLElement): () => void {
    let timer = 0;
    let start: { x: number; y: number; id: number } | null = null;
    const cancel = () => { window.clearTimeout(timer); start = null; };
    const down = (event: PointerEvent) => {
      if (event.pointerType === "mouse") return;
      if (!event.isPrimary) { cancel(); return; }
      const rect = element.getBoundingClientRect();
      start = { x: event.clientX, y: event.clientY, id: event.pointerId };
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const point = this.toCoordinate(x, y);
        start = null;
        if (!point) return;
        this.suppressClickUntil = Date.now() + 700;
        this.callbacks.onLongPress(point);
      }, LONG_PRESS_MS);
    };
    const move = (event: PointerEvent) => {
      if (start && event.pointerId === start.id && Math.hypot(event.clientX - start.x, event.clientY - start.y) > LONG_PRESS_SLOP_PX) cancel();
    };
    element.addEventListener("pointerdown", down, { passive: true });
    element.addEventListener("pointermove", move, { passive: true });
    element.addEventListener("pointerup", cancel, { passive: true });
    element.addEventListener("pointercancel", cancel, { passive: true });
    return () => {
      cancel();
      element.removeEventListener("pointerdown", down);
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", cancel);
      element.removeEventListener("pointercancel", cancel);
    };
  }

  destroy(): void {
    this.framingListener?.remove();
    for (const cleanup of this.cleanups.splice(0)) cleanup();
    for (const shape of this.shapes.values()) {
      this.maps.event.clearInstanceListeners(shape.polygon);
      shape.polygon.setMap(null);
    }
    this.shapes.clear();
    this.setOverlays([]);
    this.labels.destroy();
    this.self.destroy();
    this.huntPin.destroy();
    this.previewPin.destroy();
    this.maps.event.clearInstanceListeners(this.map);
  }
}
