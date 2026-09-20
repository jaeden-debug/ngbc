"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ZoneFeature } from "../../lib/hunt/zone-geometry";
import { COVERAGE_WORDING, type ZoneCoverageStatus } from "../../lib/hunt/zone-layers";
import ZoneCanvas, { zoomToFit, type Viewport } from "./ZoneCanvas";
import styles from "./Hunt.module.css";

export interface ResolvedZone {
  officialName: string;
  shortLabel: string;
  coverage: ZoneCoverageStatus;
  nearBoundary?: boolean;
  boundaryDistanceMeters?: number;
  displayRings?: number[][][];
}

interface LayerMeta {
  jurisdictionName: string;
  officialTerm: string;
  officialTermShort: string;
  authority: string;
  coverage: ZoneCoverageStatus;
  coverageNote: string;
}

interface HuntMapProps {
  point: { latitude: number; longitude: number } | null;
  placeLabel: string | null;
  zone: ResolvedZone | null;
  googleMapsApiKey?: string;
}

/**
 * The Hunt map.
 *
 * It is useful before anything is typed: the supported jurisdictions' official
 * hunting-zone boundaries are already drawn, so the first thing a person sees is
 * "these are hunting zones", not an empty grey rectangle asking for coordinates.
 *
 * Geometry is requested for the current viewport at a tolerance chosen from the
 * zoom, server-side. Nothing here loads a continental polygon set, and nothing here
 * draws a boundary North Ground cannot trace to a named authority.
 */

/* On the basemap there is a continent to give context, so the opening view is a
   broad Canada/United States extent with the drawn coverage inside it. */
const DEFAULT_VIEWPORT: Viewport = { latitude: 49.1, longitude: -88.5, zoom: 4 };

/* Without a basemap there is no continent to show — only boundaries — so the
   boundary view opens framed on the geometry that actually exists. */
const CANVAS_VIEWPORT: Viewport = { latitude: 49.6, longitude: -84.8, zoom: 4.6 };

const ZONE_STROKE: Record<ZoneCoverageStatus, string> = {
  VERIFIED: "#b8d3a8",
  PARTIAL: "#8faa86",
  IN_DEVELOPMENT: "#7d9179",
  UNAVAILABLE: "#6a6f66",
};

/* ── Google loader ───────────────────────────────────────────────────────── */

let googleMapsPromise: Promise<typeof google.maps> | null = null;

/** Global the Maps bootstrap calls once the core library is ready. */
const READY_CALLBACK = "__northGroundMapsReady";

/**
 * Load the Maps JavaScript API.
 *
 * `loading=async` is the recommended bootstrap, and with it the script's own
 * `onload` fires BEFORE `google.maps` exists — so resolving on `onload` and
 * checking for `google.maps` there reports a failure for a map that is loading
 * perfectly well, and drops the product to its fallback view every time. The
 * documented signal is the `callback` parameter, which fires when the library is
 * actually usable.
 */
function loadGoogleMaps(apiKey: string): Promise<typeof google.maps> {
  if (googleMapsPromise) return googleMapsPromise;
  googleMapsPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("Google Maps needs a browser"));
    if (window.google?.maps) return resolve(window.google.maps);

    const globals = window as unknown as Record<string, unknown>;
    const fail = (reason: string) => {
      googleMapsPromise = null;
      delete globals[READY_CALLBACK];
      reject(new Error(reason));
    };

    globals[READY_CALLBACK] = () => {
      delete globals[READY_CALLBACK];
      if (window.google?.maps) resolve(window.google.maps);
      else fail("Google Maps signalled ready without an API");
    };

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?${new URLSearchParams({
      key: apiKey, v: "weekly", loading: "async", callback: READY_CALLBACK,
    })}`;
    script.async = true;
    script.onerror = () => fail("Google Maps failed to load");
    document.head.appendChild(script);
  });
  return googleMapsPromise;
}

/**
 * A muted natural basemap: land and water stay clearly distinct and roads stay
 * legible, so the regulatory overlay is the brightest thing on the map without the
 * geography underneath it disappearing.
 */
const BASEMAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#20261f" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#a7ae9e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#11140f" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#3a4038" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#232b21" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#26331f" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#33382f" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#99a08f" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#4a4a36" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#13212b" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#5c7b8c" }] },
];

/* ── Component ───────────────────────────────────────────────────────────── */

export default function HuntMap({ point, placeLabel, zone, googleMapsApiKey }: HuntMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const zoneShapesRef = useRef<google.maps.Polygon[]>([]);
  const highlightRef = useRef<google.maps.Polygon[]>([]);

  const [googleFailed, setGoogleFailed] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [viewport, setViewport] = useState<Viewport>(CANVAS_VIEWPORT);
  const [features, setFeatures] = useState<ZoneFeature[]>([]);
  const [layer, setLayer] = useState<LayerMeta | null>(null);
  const [zonesState, setZonesState] = useState<"idle" | "loading" | "empty" | "error">("idle");
  const [zonesMessage, setZonesMessage] = useState<string | null>(null);
  const [inspected, setInspected] = useState<ZoneFeature | null>(null);
  const [mapMode, setMapMode] = useState<"terrain" | "hybrid">("terrain");
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number } | null>(null);
  const [framed, setFramed] = useState(false);

  const useGoogle = Boolean(googleMapsApiKey) && !googleFailed;

  /* ── Zone geometry for the current viewport ───────────────────────────── */

  const requestIdRef = useRef(0);

  const loadZones = useCallback(async (box: { west: number; south: number; east: number; north: number }, zoom: number) => {
    const id = ++requestIdRef.current;
    setZonesState("loading");
    try {
      const bounds = [box.west, box.south, box.east, box.north].map((value) => value.toFixed(4)).join(",");
      const response = await fetch(`/api/hunt/zones?bounds=${bounds}&zoom=${Math.round(zoom)}`);
      const payload = await response.json() as {
        status: string; message?: string; features?: ZoneFeature[];
        layer?: LayerMeta | null;
      };
      if (id !== requestIdRef.current) return;

      setLayer(payload.layer ?? null);
      setFeatures(payload.features ?? []);
      setZonesMessage(payload.message ?? null);
      setZonesState(
        payload.status === "OK" ? "idle"
          : payload.status === "PROVIDER_ERROR" ? "error"
          : "empty",
      );
    } catch {
      if (id !== requestIdRef.current) return;
      setFeatures([]);
      setZonesState("error");
      setZonesMessage("Official zone boundaries could not be loaded. North Ground will not draw an approximate boundary.");
    }
  }, []);

  /* The canvas path drives loading from its own viewport; the Google path drives it
     from `idle`. Both are debounced so panning does not stampede the authority. */
  useEffect(() => {
    if (useGoogle) return;
    const timer = setTimeout(() => {
      const span = 360 / Math.pow(2, viewport.zoom) * 3;
      void loadZones(
        {
          west: Math.max(-180, viewport.longitude - span),
          south: Math.max(-85, viewport.latitude - span * 0.6),
          east: Math.min(180, viewport.longitude + span),
          north: Math.min(85, viewport.latitude + span * 0.6),
        },
        viewport.zoom,
      );
    }, 220);
    return () => clearTimeout(timer);
  }, [useGoogle, viewport, loadZones]);

  /* ── Google map lifecycle ─────────────────────────────────────────────── */

  useEffect(() => {
    if (!useGoogle || !containerRef.current || mapRef.current) return;
    let cancelled = false;

    loadGoogleMaps(googleMapsApiKey!)
      .then((maps) => {
        if (cancelled || !containerRef.current) return;
        const map = new maps.Map(containerRef.current, {
          center: { lat: DEFAULT_VIEWPORT.latitude, lng: DEFAULT_VIEWPORT.longitude },
          zoom: DEFAULT_VIEWPORT.zoom,
          mapTypeId: "terrain",
          styles: BASEMAP_STYLE,
          disableDefaultUI: true,
          zoomControl: true,
          zoomControlOptions: { position: maps.ControlPosition.RIGHT_BOTTOM },
          fullscreenControl: true,
          fullscreenControlOptions: { position: maps.ControlPosition.RIGHT_TOP },
          gestureHandling: "greedy",
          clickableIcons: false,
          minZoom: 3,
        });
        mapRef.current = map;

        let debounce = 0;
        map.addListener("idle", () => {
          window.clearTimeout(debounce);
          debounce = window.setTimeout(() => {
            const bounds = map.getBounds();
            if (!bounds) return;
            const sw = bounds.getSouthWest();
            const ne = bounds.getNorthEast();
            void loadZones(
              { west: sw.lng(), south: sw.lat(), east: ne.lng(), north: ne.lat() },
              map.getZoom() ?? DEFAULT_VIEWPORT.zoom,
            );
          }, 220);
        });

        setGoogleReady(true);
      })
      .catch(() => { if (!cancelled) setGoogleFailed(true); });

    return () => { cancelled = true; };
  }, [useGoogle, googleMapsApiKey, loadZones]);

  useEffect(() => {
    if (!googleReady || !mapRef.current) return;
    mapRef.current.setMapTypeId(mapMode);
  }, [googleReady, mapMode]);

  /* Zone overlays on the Google map. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !googleReady) return;

    for (const shape of zoneShapesRef.current) shape.setMap(null);
    zoneShapesRef.current = [];

    for (const feature of features) {
      for (const ring of feature.rings) {
        const polygon = new google.maps.Polygon({
          map,
          paths: ring.map(([lng, lat]) => ({ lat, lng })),
          strokeColor: ZONE_STROKE[feature.coverage],
          strokeOpacity: feature.coverage === "VERIFIED" ? 0.95 : 0.55,
          strokeWeight: feature.coverage === "VERIFIED" ? 2.2 : 1.1,
          fillColor: ZONE_STROKE[feature.coverage],
          fillOpacity: feature.coverage === "VERIFIED" ? 0.14 : 0.05,
          clickable: true,
          zIndex: feature.coverage === "VERIFIED" ? 3 : 2,
        });
        polygon.addListener("click", () => setInspected(feature));
        zoneShapesRef.current.push(polygon);
      }
    }
  }, [googleReady, features]);

  /* The resolved zone, drawn above the layer so the answer is unmistakable. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !googleReady) return;

    for (const shape of highlightRef.current) shape.setMap(null);
    highlightRef.current = [];
    if (!zone?.displayRings?.length) return;

    const bounds = new google.maps.LatLngBounds();
    for (const ring of zone.displayRings) {
      const path = ring.map(([lng, lat]) => ({ lat, lng }));
      for (const position of path) bounds.extend(position);
      highlightRef.current.push(new google.maps.Polygon({
        map, paths: path,
        strokeColor: "#d8e6c8", strokeOpacity: 1, strokeWeight: 3,
        fillColor: "#9fbc8e", fillOpacity: 0.2, clickable: false, zIndex: 6,
      }));
    }
    if (point) bounds.extend({ lat: point.latitude, lng: point.longitude });
    if (!bounds.isEmpty()) map.fitBounds(bounds, 56);
  }, [googleReady, zone, point]);

  /* The selected point. Conventional device blue: the one place a familiar
     convention beats brand colour, because people already read it instantly. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !googleReady || !point) return;
    const position = { lat: point.latitude, lng: point.longitude };
    if (!markerRef.current) {
      markerRef.current = new google.maps.Marker({
        map, position, title: placeLabel ?? "Selected location", zIndex: 9,
        icon: {
          path: google.maps.SymbolPath.CIRCLE, scale: 8,
          fillColor: "#5aa0e6", fillOpacity: 1, strokeColor: "#0d1a26", strokeWeight: 3,
        },
      });
    } else {
      markerRef.current.setPosition(position);
      markerRef.current.setTitle(placeLabel ?? "Selected location");
    }
    if (!zone?.displayRings?.length) {
      map.panTo(position);
      if ((map.getZoom() ?? 0) < 8) map.setZoom(9);
    }
  }, [googleReady, point, placeLabel, zone]);

  /* The boundary view frames itself to the geometry it received, once, so the
     drawn coverage fills a phone and a wide desktop panel equally well instead of
     sitting at one fixed zoom. A pan, a zoom or a selection ends the framing. */
  if (!useGoogle && !framed && !point && canvasSize && features.length) {
    setFramed(true);
    let west = 180, east = -180, south = 90, north = -90;
    for (const feature of features) {
      for (const ring of feature.rings) {
        for (const [longitude, latitude] of ring) {
          if (longitude < west) west = longitude;
          if (longitude > east) east = longitude;
          if (latitude < south) south = latitude;
          if (latitude > north) north = latitude;
        }
      }
    }
    if (west < east && south < north) {
      setViewport({
        latitude: (south + north) / 2,
        longitude: (west + east) / 2,
        zoom: zoomToFit({ west, south, east, north }, canvasSize),
      });
    }
  }

  /* The canvas follows a new selection too. Compared by coordinate rather than by
     object identity, because the parent builds a fresh point object each render. */
  const pointKey = point ? `${point.latitude},${point.longitude}` : null;
  const [followedPoint, setFollowedPoint] = useState<string | null>(null);
  if (!useGoogle && point && pointKey !== followedPoint) {
    setFollowedPoint(pointKey);
    setViewport((current) => ({
      latitude: point.latitude,
      longitude: point.longitude,
      zoom: Math.max(current.zoom, 8),
    }));
  }

  const zoneName = zone?.shortLabel ?? null;
  const inspectedCoverage = inspected ? COVERAGE_WORDING[inspected.coverage] : null;

  return (
    <div className={styles.mapSurface}>
      {useGoogle ? (
        <div ref={containerRef} className={styles.mapCanvas} />
      ) : (
        <ZoneCanvas
          features={features}
          viewport={viewport}
          onViewportChange={(next) => {
            setFramed(true);
            setViewport(next);
          }}
          onResize={setCanvasSize}
          point={point}
          selectedZoneName={zone?.shortLabel?.split(" ").pop() ?? null}
          onZoneClick={setInspected}
        />
      )}

      {/* ── Overlay chrome ─────────────────────────────────────────────── */}

      <div className={styles.mapTopLeft}>
        {zoneName ? (
          <p className={`${styles.mapBadge} ng-glass-overlay`}>
            <span className={styles.mapBadgeDot} aria-hidden="true" />
            <span>
              <strong>{zoneName}</strong>
              {layer ? <span className={styles.mapBadgeMeta}>{layer.jurisdictionName}</span> : null}
            </span>
          </p>
        ) : (
          <p className={`${styles.mapBadge} ng-glass-overlay`}>
            <span className={styles.mapBadgeDot} aria-hidden="true" />
            <span>
              <strong>{layer ? `${layer.jurisdictionName} ${layer.officialTerm}s` : "Official hunting zones"}</strong>
              <span className={styles.mapBadgeMeta}>
                {zonesState === "loading" ? "Loading official boundaries…"
                  : features.length ? `${features.length} drawn in view`
                  : "Pan to covered geography"}
              </span>
            </span>
          </p>
        )}
      </div>

      {useGoogle ? (
        <div className={styles.mapTopRight}>
          <div className={`${styles.mapModes} ng-glass-control`} role="group" aria-label="Map style">
            {(["terrain", "hybrid"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={styles.mapMode}
                aria-pressed={mapMode === mode}
                data-active={mapMode === mode || undefined}
                onClick={() => setMapMode(mode)}
              >
                {mode === "terrain" ? "Terrain" : "Satellite"}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {inspected ? (
        <div className={`${styles.mapInspector} ng-glass-popover`} role="status">
          <button
            type="button"
            className={styles.mapInspectorClose}
            onClick={() => setInspected(null)}
          >
            <span className="ng-visually-hidden">Close zone details</span>
            <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true" fill="none">
              <path d="m2 2 8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </button>
          <p className={styles.mapInspectorTitle}>{inspected.label}</p>
          {layer ? (
            <p className={styles.mapInspectorMeta}>
              {layer.officialTerm} · {layer.jurisdictionName} · {layer.authority}
            </p>
          ) : null}
          <p className="ng-status" data-status={inspected.coverage === "VERIFIED" ? "OPEN" : "UNKNOWN"}>
            {inspectedCoverage?.label}
          </p>
          <p className={styles.mapInspectorNote}>{inspectedCoverage?.detail}</p>
          <p className={styles.mapInspectorNote}>
            A zone on its own does not say what is legal. Choose a date and a species
            to get an answer for this place.
          </p>
        </div>
      ) : null}

      <div className={styles.mapBottom}>
        <p className={`${styles.mapLegend} ng-glass-overlay`}>
          <span className={styles.legendSwatch} data-coverage="VERIFIED" aria-hidden="true" />
          <span>Certified rules</span>
          <span className={styles.legendSwatch} data-coverage="IN_DEVELOPMENT" aria-hidden="true" />
          <span>Boundary only</span>
        </p>

        {zonesState === "error" ? (
          <p className={`${styles.mapNotice} ng-glass-popover`} role="status">{zonesMessage}</p>
        ) : null}

        {googleFailed ? (
          <p className={`${styles.mapNotice} ng-glass-popover`} role="status">
            The interactive basemap could not load. Official boundaries and every
            result below are unaffected.
          </p>
        ) : null}

        {!useGoogle && !googleFailed ? (
          <p className={`${styles.mapNotice} ng-glass-overlay`} data-compact="true">
            Boundary view — no basemap
          </p>
        ) : null}
      </div>

      {/* The map is never the only interface. */}
      <p className="ng-visually-hidden">
        {point
          ? `Map showing ${placeLabel ?? "the selected location"}` +
            (zone ? `, inside ${zone.officialName}.` : ", with no official zone resolved.") +
            (zone?.nearBoundary ? " This point is close to the mapped zone boundary." : "") +
            " Every fact shown on the map is also listed as text on this page."
          : `Map showing ${features.length} official hunting-zone boundaries` +
            (layer ? ` published by ${layer.authority} for ${layer.jurisdictionName}.` : ".") +
            " Search a place to resolve the zone that applies there."}
      </p>
    </div>
  );
}
