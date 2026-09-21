"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { placeLabels } from "../../lib/hunt/exploration/labels";
import type { OverlayFeature } from "../../lib/hunt/exploration/overlay-layers";
import type { ExplorationState } from "../../lib/hunt/exploration/states";
import type { ZoneFeature } from "../../lib/hunt/zone-geometry";
import type { LabelSource } from "./map/google-overlays";
import styles from "./Hunt.module.css";

export interface Viewport {
  latitude: number;
  longitude: number;
  zoom: number;
}

interface ZoneCanvasProps {
  features: ZoneFeature[];
  viewport: Viewport;
  onViewportChange: (viewport: Viewport) => void;
  /** The planned hunt location, drawn as the pin. */
  huntPoint: { latitude: number; longitude: number } | null;
  /** The device's location, drawn as the blue dot. Never selectable. */
  selfFix: { latitude: number; longitude: number; accuracyMeters: number } | null;
  /** A previewed point that is not yet selected. */
  previewPoint: { latitude: number; longitude: number } | null;
  /** `${layerId}|${designation}`: designations repeat across jurisdictions. */
  selectedZoneKey: string | null;
  /** How the selected zone is named to assistive technology ("GHA 23A"). */
  selectedZoneLabel: string | null;
  labels: LabelSource[];
  filterStates: ReadonlyMap<string, ExplorationState> | null;
  zoneKeyOf: (feature: ZoneFeature) => string;
  onZoneClick: (feature: ZoneFeature) => void;
  onEmptyClick: () => void;
  onLongPress: (point: { latitude: number; longitude: number }) => void;
  /** Special areas switched on in the Layers control, drawn above the zones. */
  overlays: OverlayFeature[];
  onOverlayClick: (feature: OverlayFeature) => void;
  /** Reports the drawing area so the caller can frame the geometry to it. */
  onResize?: (size: { width: number; height: number }) => void;
}

/**
 * The basemap-free zone view.
 *
 * Used when no Google Maps browser key is configured. It is not a substitute
 * basemap and never pretends to be one: it draws the authority's own boundary
 * geometry, their names, the hunt pin, the device dot, and nothing else. Every
 * line on it comes from an official source, so there is no invented coastline
 * or road to mistake for one.
 */

const TILE = 256;
const LONG_PRESS_MS = 550;

function projectX(longitude: number, scale: number): number {
  return ((longitude + 180) / 360) * scale;
}

function projectY(latitude: number, scale: number): number {
  const clamped = Math.max(-85.05, Math.min(85.05, latitude));
  const radians = (clamped * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) * scale;
}

function unprojectLongitude(x: number, scale: number): number {
  return (x / scale) * 360 - 180;
}

function unprojectLatitude(y: number, scale: number): number {
  const n = Math.PI * (1 - (2 * y) / scale);
  return (180 / Math.PI) * Math.atan(Math.sinh(n));
}

/** Zoom at which `features` fit inside a drawing area of `size`, with padding. */
export function zoomToFit(
  bounds: { west: number; south: number; east: number; north: number },
  size: { width: number; height: number },
  padding = 44,
): number {
  const usableWidth = Math.max(80, size.width - padding * 2);
  const usableHeight = Math.max(80, size.height - padding * 2);
  for (let zoom = 12; zoom >= 3; zoom -= 0.25) {
    const scale = TILE * Math.pow(2, zoom);
    const width = projectX(bounds.east, scale) - projectX(bounds.west, scale);
    const height = projectY(bounds.south, scale) - projectY(bounds.north, scale);
    if (width <= usableWidth && height <= usableHeight) return zoom;
  }
  return 3;
}

/**
 * The viewport that shows `bounds` in the part of a `size` drawing area left
 * uncovered by `padding` (a card on the left, a sheet at the bottom).
 */
export function fitViewport(
  bounds: { west: number; south: number; east: number; north: number },
  size: { width: number; height: number },
  padding: { top: number; right: number; bottom: number; left: number },
): Viewport {
  const usable = {
    width: Math.max(120, size.width - padding.left - padding.right),
    height: Math.max(120, size.height - padding.top - padding.bottom),
  };
  const zoom = zoomToFit(bounds, usable, 24);
  const scale = TILE * Math.pow(2, zoom);
  const centreX = (projectX(bounds.west, scale) + projectX(bounds.east, scale)) / 2;
  const centreY = (projectY(bounds.north, scale) + projectY(bounds.south, scale)) / 2;
  // Move the view centre so the zone's centre sits in the middle of the uncovered area.
  const x = centreX - (padding.left - padding.right) / 2;
  const y = centreY - (padding.top - padding.bottom) / 2;
  return { longitude: unprojectLongitude(x, scale), latitude: unprojectLatitude(y, scale), zoom };
}

export default function ZoneCanvas({
  features, viewport, onViewportChange, huntPoint, selfFix, previewPoint, selectedZoneKey, selectedZoneLabel,
  labels, filterStates, zoneKeyOf, onZoneClick, onEmptyClick, onLongPress, overlays, onOverlayClick, onResize,
}: ZoneCanvasProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 720, height: 520 });
  /* `zoneKey` is read at pointerdown: pointer capture retargets pointerup to the SVG itself. */
  const dragRef = useRef<{ pointerId: number; x: number; y: number; moved: boolean; timer: number; pressed: boolean; zoneKey: string | null } | null>(null);

  useEffect(() => {
    const element = frameRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width <= 0 || height <= 0) return;
      setSize({ width, height });
      onResize?.({ width, height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [onResize]);

  const scale = TILE * Math.pow(2, viewport.zoom);
  const originX = projectX(viewport.longitude, scale) - size.width / 2;
  const originY = projectY(viewport.latitude, scale) - size.height / 2;

  const toScreen = useCallback(
    ([longitude, latitude]: number[]): [number, number] => [
      projectX(longitude, scale) - originX,
      projectY(latitude, scale) - originY,
    ],
    [scale, originX, originY],
  );

  const toCoordinate = useCallback(
    (x: number, y: number) => ({
      longitude: unprojectLongitude(x + originX, scale),
      latitude: unprojectLatitude(y + originY, scale),
    }),
    [scale, originX, originY],
  );

  /* One path per zone: its parts and holes together, so a multipart zone is one shape. */
  const shapes = useMemo(
    () =>
      features.map((feature) => ({
        feature,
        key: zoneKeyOf(feature),
        d: feature.rings
          .map((ring) => `M${ring.map((position) => toScreen(position).map((value) => value.toFixed(1)).join(",")).join("L")}Z`)
          .join(""),
      })),
    [features, toScreen, zoneKeyOf],
  );

  const overlayShapes = useMemo(
    () => overlays.map((feature) => ({
      feature,
      key: `${feature.layerId}|${feature.objectId}`,
      d: feature.rings
        .map((ring) => `M${ring.map((position) => toScreen(position).map((value) => value.toFixed(1)).join(",")).join("L")}Z`)
        .join(""),
    })),
    [overlays, toScreen],
  );

  const placed = useMemo(() => {
    const candidates = labels.map((label) => {
      const [x, y] = toScreen(label.labelPoint);
      const [spanLng, spanLat] = label.labelSpan;
      const [x1, y1] = toScreen([label.labelPoint[0] - spanLng / 2, label.labelPoint[1] + spanLat / 2]);
      const [x2, y2] = toScreen([label.labelPoint[0] + spanLng / 2, label.labelPoint[1] - spanLat / 2]);
      const prefix = label.glyph ? `${label.glyph} ` : "";
      return {
        key: label.key,
        text: `${prefix}${label.text}`,
        short: `${prefix}${label.short}`,
        x, y,
        spanWidth: Math.abs(x2 - x1),
        spanHeight: Math.abs(y2 - y1),
        priority: label.priority,
        force: label.selected,
      };
    });
    return placeLabels(candidates, size);
  }, [labels, toScreen, size]);

  const hunt = huntPoint ? toScreen([huntPoint.longitude, huntPoint.latitude]) : null;
  const preview = previewPoint ? toScreen([previewPoint.longitude, previewPoint.latitude]) : null;
  const self = selfFix ? toScreen([selfFix.longitude, selfFix.latitude]) : null;
  const metresPerPixel = selfFix ? (156_543.03 * Math.cos((selfFix.latitude * Math.PI) / 180)) / Math.pow(2, viewport.zoom) : 1;

  function panBy(dx: number, dy: number) {
    onViewportChange({
      longitude: unprojectLongitude(projectX(viewport.longitude, scale) - dx, scale),
      latitude: unprojectLatitude(projectY(viewport.latitude, scale) - dy, scale),
      zoom: viewport.zoom,
    });
  }

  function zoomBy(delta: number) {
    onViewportChange({ ...viewport, zoom: Math.max(3, Math.min(13, viewport.zoom + delta)) });
  }

  return (
    <div
      className={styles.zoneCanvas}
      ref={frameRef}
      tabIndex={0}
      role="group"
      aria-label="Zone map. Arrow keys move the map; plus and minus zoom. The zones list names every zone in view."
      onKeyDown={(event) => {
        const step = 80;
        const moves: Record<string, [number, number]> = {
          ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step],
        };
        if (moves[event.key]) {
          event.preventDefault();
          panBy(...moves[event.key]);
        } else if (event.key === "+" || event.key === "=") {
          event.preventDefault();
          zoomBy(1);
        } else if (event.key === "-" || event.key === "_") {
          event.preventDefault();
          zoomBy(-1);
        }
      }}
    >
      <svg
        className={styles.zoneCanvasSvg}
        width={size.width}
        height={size.height}
        viewBox={`0 0 ${size.width} ${size.height}`}
        role="img"
        aria-label={
          features.length
            ? `Official hunting-zone boundaries${selectedZoneLabel ? `, with ${selectedZoneLabel} highlighted` : ""}. ` +
              "Boundaries only — this view has no basemap and is not a legal survey."
            : "No official hunting-zone boundaries are available for this view."
        }
        onContextMenu={(event) => {
          event.preventDefault();
          const rect = event.currentTarget.getBoundingClientRect();
          onLongPress(toCoordinate(event.clientX - rect.left, event.clientY - rect.top));
          if (dragRef.current) dragRef.current.pressed = true;
        }}
        onPointerDown={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const x = event.clientX - rect.left;
          const y = event.clientY - rect.top;
          const drag = {
            pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false, pressed: false, timer: 0,
            zoneKey: (event.target as Element).getAttribute?.("data-zone-key") ?? null,
          };
          drag.timer = window.setTimeout(() => {
            if (drag.moved) return;
            drag.pressed = true;
            onLongPress(toCoordinate(x, y));
          }, LONG_PRESS_MS);
          dragRef.current = drag;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== event.pointerId) return;
          const dx = event.clientX - drag.x;
          const dy = event.clientY - drag.y;
          if (Math.abs(dx) + Math.abs(dy) < 2) return;
          if (!drag.moved && Math.hypot(dx, dy) > 8) window.clearTimeout(drag.timer);
          drag.x = event.clientX;
          drag.y = event.clientY;
          drag.moved = true;
          panBy(dx, dy);
        }}
        onPointerUp={(event) => {
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== event.pointerId) return;
          window.clearTimeout(drag.timer);
          const wasTap = !drag.moved && !drag.pressed;
          dragRef.current = null;
          if (!wasTap) return;
          const overlay = drag.zoneKey?.startsWith("overlay|")
            ? overlayShapes.find((shape) => `overlay|${shape.key}` === drag.zoneKey)?.feature
            : undefined;
          if (overlay) {
            onOverlayClick(overlay);
            return;
          }
          const feature = drag.zoneKey ? shapes.find((shape) => shape.key === drag.zoneKey)?.feature : undefined;
          if (feature) onZoneClick(feature);
          else onEmptyClick();
        }}
        onPointerCancel={() => {
          if (dragRef.current) window.clearTimeout(dragRef.current.timer);
          dragRef.current = null;
        }}
      >
        {shapes.map(({ feature, key, d }) => (
          <path
            key={key}
            d={d}
            fillRule="evenodd"
            data-zone-key={key}
            className={styles.zoneCanvasShape}
            data-coverage={feature.coverage}
            data-state={filterStates?.get(key)}
            data-selected={key === selectedZoneKey || undefined}
          />
        ))}

        {overlayShapes.map(({ key, d }) => (
          <path key={key} d={d} fillRule="evenodd" data-zone-key={`overlay|${key}`} className={styles.zoneCanvasOverlay} />
        ))}

        {placed.map((label) => (
          <text
            key={label.key}
            x={label.x}
            y={label.y}
            className={styles.zoneCanvasLabel}
            data-selected={label.key === selectedZoneKey || undefined}
            textAnchor="middle"
            dominantBaseline="central"
            aria-hidden="true"
          >
            {label.text}
          </text>
        ))}

        {self && selfFix ? (
          <g transform={`translate(${self[0].toFixed(1)} ${self[1].toFixed(1)})`} aria-hidden="true">
            {selfFix.accuracyMeters <= 5_000 ? (
              <circle r={Math.max(9, selfFix.accuracyMeters / metresPerPixel)} className={styles.zoneCanvasSelfAccuracy} />
            ) : null}
            <circle r="7" className={styles.zoneCanvasSelf} />
          </g>
        ) : null}

        {preview ? (
          <g className={styles.zoneCanvasPin} data-preview="true" transform={`translate(${preview[0].toFixed(1)} ${preview[1].toFixed(1)})`} aria-hidden="true">
            <path d="M0 0C0 0-12-13.6-12-23.5a12 12 0 0 1 24 0C12-13.6 0 0 0 0Z" />
            <circle cy="-23.5" r="4.6" />
          </g>
        ) : null}

        {hunt ? (
          <g className={styles.zoneCanvasPin} transform={`translate(${hunt[0].toFixed(1)} ${hunt[1].toFixed(1)})`} aria-hidden="true">
            <path d="M0 0C0 0-12-13.6-12-23.5a12 12 0 0 1 24 0C12-13.6 0 0 0 0Z" />
            <circle cy="-23.5" r="4.6" />
          </g>
        ) : null}
      </svg>

      <div className={styles.zoneCanvasControls}>
        <button type="button" className={`${styles.mapControl} ng-glass-control`} onClick={() => zoomBy(1)}>
          <span className="ng-visually-hidden">Zoom in</span>
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" fill="none">
            <path d="M7 2.5v9M2.5 7h9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </button>
        <button type="button" className={`${styles.mapControl} ng-glass-control`} onClick={() => zoomBy(-1)}>
          <span className="ng-visually-hidden">Zoom out</span>
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" fill="none">
            <path d="M2.5 7h9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
