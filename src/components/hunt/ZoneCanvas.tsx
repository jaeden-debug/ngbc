"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ZoneFeature } from "../../lib/hunt/zone-geometry";
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
  point: { latitude: number; longitude: number } | null;
  /** `${layerId}|${designation}`: designations repeat across jurisdictions. */
  selectedZoneKey: string | null;
  /** How the selected zone is named to assistive technology ("GHA 23A"). */
  selectedZoneLabel: string | null;
  onZoneClick: (feature: ZoneFeature) => void;
  /** Reports the drawing area so the caller can frame the geometry to it. */
  onResize?: (size: { width: number; height: number }) => void;
}

/**
 * The basemap-free zone view.
 *
 * Used when no Google Maps browser key is configured. It is not a substitute
 * basemap and never pretends to be one: it draws the authority's own boundary
 * geometry, the selected point, and nothing else. Every line on it comes from an
 * official source, so there is no invented coastline or road to mistake for one.
 */

const TILE = 256;

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

export default function ZoneCanvas({
  features, viewport, onViewportChange, point, selectedZoneKey, selectedZoneLabel, onZoneClick, onResize,
}: ZoneCanvasProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 720, height: 520 });
  const dragRef = useRef<{ pointerId: number; x: number; y: number; moved: boolean } | null>(null);

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

  const shapes = useMemo(
    () =>
      features.map((feature) => ({
        feature,
        paths: feature.rings.map(
          (ring) => `${ring.map((position) => toScreen(position).map((value) => value.toFixed(1)).join(",")).join(" ")}`,
        ),
      })),
    [features, toScreen],
  );

  const pin = point ? toScreen([point.longitude, point.latitude]) : null;

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
    <div className={styles.zoneCanvas} ref={frameRef}>
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
        onPointerDown={(event) => {
          dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== event.pointerId) return;
          const dx = event.clientX - drag.x;
          const dy = event.clientY - drag.y;
          if (Math.abs(dx) + Math.abs(dy) < 2) return;
          drag.x = event.clientX;
          drag.y = event.clientY;
          drag.moved = true;
          panBy(dx, dy);
        }}
        onPointerUp={(event) => {
          if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
        }}
        onPointerCancel={() => { dragRef.current = null; }}
      >
        {shapes.map(({ feature, paths }) =>
          paths.map((points, index) => (
            <polygon
              key={`${feature.layerId}|${feature.name}-${index}`}
              points={points}
              className={styles.zoneCanvasShape}
              data-coverage={feature.coverage}
              data-selected={`${feature.layerId}|${feature.name}` === selectedZoneKey || undefined}
              onClick={() => {
                if (dragRef.current?.moved) return;
                onZoneClick(feature);
              }}
            />
          )),
        )}

        {pin ? (
          <g className={styles.zoneCanvasPin} transform={`translate(${pin[0].toFixed(1)} ${pin[1].toFixed(1)})`}>
            <circle r="11" className={styles.zoneCanvasPinHalo} />
            <circle r="5" className={styles.zoneCanvasPinCore} />
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
