"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { nearestNeighbour } from "../../lib/hunt/exploration/boundary";
import type { ExplorationEvent, ExplorationState, GeoPoint, SelfFailure } from "../../lib/hunt/exploration/map-state";
import type { OverlayFeature, OverlayLayerDescriptor } from "../../lib/hunt/exploration/overlay-layers";
import { EXPLORATION_WORDING, type ExplorationState as ZoneState, type ZoneRef, type ZoneSummary } from "../../lib/hunt/exploration/states";
import type { SpeciesSelectorOption } from "../../lib/hunt/coverage";
import type { ZoneFeature } from "../../lib/hunt/zone-geometry";
import { type ZoneCoverageStatus } from "../../lib/hunt/zone-layers";
import { createLabelLayer, createSelfMarker, huntPinIcon, type LabelLayerHandle, type LabelSource, type SelfMarkerHandle } from "./map/google-overlays";
import ZoneCanvas, { fitViewport, zoomToFit, type Viewport } from "./ZoneCanvas";
import { OverlayCard, PinPreviewCard, ZoneCard, type PinZone, type SummaryLoad } from "./ZoneCard";
import styles from "./Hunt.module.css";

export interface ResolvedZone {
  /** The layer the zone was resolved in; designations repeat across jurisdictions. */
  layerId?: string;
  /** The authority's bare designation ("57", "23A"). */
  designation?: string;
  officialName: string;
  shortLabel: string;
  coverage: ZoneCoverageStatus;
  nearBoundary?: boolean;
  boundaryDistanceMeters?: number;
  displayRings?: number[][][];
}

interface LayerMeta {
  id: string;
  jurisdictionName: string;
  officialTerm: string;
  officialTermShort: string;
  authority: string;
  coverage: ZoneCoverageStatus;
  coverageNote: string;
}

interface HuntMapProps {
  exploration: ExplorationState;
  dispatch: Dispatch<ExplorationEvent>;
  /** The zone the HUNT location resolved to. Never the device's zone. */
  zone: ResolvedZone | null;
  date: string;
  isToday: boolean;
  speciesOptions: SpeciesSelectorOption[];
  googleMapsApiKey?: string;
  /** The zone card's action for the hunt zone: continue in the composer. */
  onContinueHunt: () => void;
  /** The person confirmed the previewed point as their hunt location. */
  onConfirmPin: () => void;
  /** Where the hunt point sits beside another zone, by that zone's label. */
  onNeighbour?: (label: string | null) => void;
}

/**
 * The Hunt map: an exploration surface, not only a picture behind the form.
 *
 * Official zone boundaries are drawn before anything is typed and named on the
 * map in each authority's own terms. Tapping a zone opens what the certified
 * rules say about the whole zone on the Hunt date. A long press (or right-click,
 * or the Drop-pin control) previews a point, which becomes the hunt location
 * only when confirmed. The device's own location is a blue dot that can centre
 * the camera and never selects anything.
 *
 * Geometry is requested for the current viewport at a tolerance chosen from the
 * zoom, server-side. Nothing here loads a continental polygon set, and nothing
 * here draws a boundary North Ground cannot trace to a named authority.
 */

const DEFAULT_VIEWPORT: Viewport = { latitude: 49.1, longitude: -88.5, zoom: 4 };
const CANVAS_VIEWPORT: Viewport = { latitude: 49.6, longitude: -84.8, zoom: 4.6 };
const LONG_PRESS_MS = 550;
const LONG_PRESS_SLOP_PX = 10;

const ZONE_STROKE: Record<ZoneCoverageStatus, string> = {
  VERIFIED: "#b8d3a8",
  PARTIAL: "#8faa86",
  IN_DEVELOPMENT: "#8d9c87",
  UNAVAILABLE: "#6a6f66",
};

/* Filter fills: one restrained hue per state, always paired with a glyph and a word on the label and legend. */
const STATE_FILL: Partial<Record<ZoneState, { color: string; opacity: number }>> = {
  SEASON_AVAILABLE: { color: "#7cc08a", opacity: 0.3 },
  SEASON_EXCEPT_AREAS: { color: "#7cc08a", opacity: 0.16 },
  CHECK_REQUIREMENTS: { color: "#e0a04a", opacity: 0.24 },
  NEEDS_VERIFICATION: { color: "#c9a26a", opacity: 0.16 },
  CONFLICT: { color: "#d97a6c", opacity: 0.2 },
  CLOSED: { color: "#9aa0a6", opacity: 0.12 },
};

const SELF_FAILURES: Record<number, SelfFailure> = { 1: "denied", 2: "position", 3: "timeout" };

export function zoneKey(ref: { layerId: string; designation?: string; name?: string }): string {
  return `${ref.layerId}|${(ref.designation ?? ref.name ?? "").toUpperCase()}`;
}

function featureRef(feature: ZoneFeature): ZoneRef {
  return { layerId: feature.layerId, designation: feature.name };
}

function boundsOfRings(rings: number[][][]): { west: number; south: number; east: number; north: number } | null {
  let west = 180, east = -180, south = 90, north = -90;
  for (const ring of rings) {
    for (const [longitude, latitude] of ring) {
      if (longitude < west) west = longitude;
      if (longitude > east) east = longitude;
      if (latitude < south) south = latitude;
      if (latitude > north) north = latitude;
    }
  }
  return west < east && south < north ? { west, south, east, north } : null;
}

/* ── Google loader ───────────────────────────────────────────────────────── */

let googleMapsPromise: Promise<typeof google.maps> | null = null;

/** Global the Maps bootstrap calls once the core library is ready. */
const READY_CALLBACK = "__northGroundMapsReady";

/**
 * Google reports a refused key (wrong referrer, disabled API, billing) through
 * this global AFTER the library has loaded, and leaves a grey "something went
 * wrong" map behind. Without it Hunt would show that instead of falling back
 * to its own boundary view.
 */
const authFailureListeners = new Set<() => void>();
let authFailed = false;
function onGoogleAuthFailure(listener: () => void): () => void {
  if (authFailed) listener();
  authFailureListeners.add(listener);
  return () => authFailureListeners.delete(listener);
}

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
    globals.gm_authFailure = () => {
      authFailed = true;
      for (const listener of authFailureListeners) listener();
    };
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

export default function HuntMap({
  exploration, dispatch, zone, date, isToday, speciesOptions, googleMapsApiKey, onContinueHunt, onConfirmPin, onNeighbour,
}: HuntMapProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const labelLayerRef = useRef<LabelLayerHandle | null>(null);
  const selfMarkerRef = useRef<SelfMarkerHandle | null>(null);
  const huntMarkerRef = useRef<google.maps.Marker | null>(null);
  const previewMarkerRef = useRef<google.maps.Marker | null>(null);
  const zoneShapesRef = useRef(new Map<string, { polygon: google.maps.Polygon; feature: ZoneFeature }>());
  const overlayShapesRef = useRef(new Map<string, Array<google.maps.Polygon | google.maps.Polyline>>());
  const highlightRef = useRef<google.maps.Polygon[]>([]);
  /* Set when a long press fires, so the click that ends the same touch is not also a zone selection. */
  const suppressClickUntilRef = useRef(0);
  const pinModeRef = useRef<"pressed" | "centre" | null>(null);

  const [googleFailed, setGoogleFailed] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [viewport, setViewport] = useState<Viewport>(CANVAS_VIEWPORT);
  const [view, setView] = useState<{ box: { west: number; south: number; east: number; north: number }; zoom: number } | null>(null);
  const [features, setFeatures] = useState<ZoneFeature[]>([]);
  const [layers, setLayers] = useState<LayerMeta[]>([]);
  const [overlayLayers, setOverlayLayers] = useState<OverlayLayerDescriptor[]>([]);
  const [zonesState, setZonesState] = useState<"idle" | "loading" | "empty" | "error" | "partial">("idle");
  const [zonesMessage, setZonesMessage] = useState<string | null>(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [mapMode, setMapMode] = useState<"terrain" | "hybrid">("terrain");
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number } | null>(null);
  const [framed, setFramed] = useState(false);
  const [panel, setPanel] = useState<null | "layers" | "zones">(null);
  const [zoneFilterText, setZoneFilterText] = useState("");
  const [filterSpeciesId, setFilterSpeciesId] = useState<string>("");
  const [filterStates, setFilterStates] = useState<Map<string, ZoneState>>(new Map());
  const [filterLoading, setFilterLoading] = useState(false);
  const [enabledOverlays, setEnabledOverlays] = useState<string[]>([]);
  const [overlayFeatures, setOverlayFeatures] = useState<Record<string, OverlayFeature[]>>({});
  const [overlayNotice, setOverlayNotice] = useState<string | null>(null);
  const [summaryLoad, setSummaryLoad] = useState<SummaryLoad | null>(null);
  const [pinZone, setPinZone] = useState<PinZone>({ kind: "loading" });

  const useGoogle = Boolean(googleMapsApiKey) && !googleFailed;
  const { self, hunt, selection, cardOpen, pin, camera, notice } = exploration;
  const selectedKey = selection.kind === "zone" ? zoneKey(selection.zone) : null;
  const huntKey = zone?.layerId && zone.designation ? zoneKey({ layerId: zone.layerId, designation: zone.designation }) : null;
  const featureByKey = useMemo(() => new Map(features.map((feature) => [zoneKey(feature), feature])), [features]);
  const filterActive = Boolean(filterSpeciesId);
  pinModeRef.current = pin?.mode ?? null;

  const explorableSpecies = useMemo(
    () => speciesOptions.filter((option) => option.regulatoryJurisdictions.length > 0),
    [speciesOptions],
  );

  /* ── Zone geometry for the current viewport ───────────────────────────── */

  const requestIdRef = useRef(0);

  const loadZones = useCallback(async (box: { west: number; south: number; east: number; north: number }, zoom: number) => {
    /* A map measured before it has laid out reports a zero-width view; there is
       nothing to draw for it, and the server would rightly refuse it. */
    if (!(box.west < box.east && box.south < box.north)) return;
    setView({ box, zoom });
    const id = ++requestIdRef.current;
    setZonesState("loading");
    try {
      const bounds = [box.west, box.south, box.east, box.north].map((value) => value.toFixed(4)).join(",");
      const response = await fetch(`/api/hunt/zones?bounds=${bounds}&zoom=${Math.round(zoom)}`);
      const payload = await response.json() as {
        status: string; message?: string; features?: ZoneFeature[];
        layers?: LayerMeta[]; overlays?: OverlayLayerDescriptor[];
      };
      if (id !== requestIdRef.current) return;

      setLayers(payload.layers ?? []);
      setOverlayLayers(payload.overlays ?? []);
      setFeatures(payload.features ?? []);
      setZonesMessage(payload.message ?? null);
      setZonesState(
        payload.status === "OK" ? "idle"
          : payload.status === "PROVIDER_ERROR" ? "error"
          : payload.status === "PARTIAL" ? "partial"
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

  /* ── Self location: watched only after an explicit request ────────────── */

  const watchRef = useRef<number | null>(null);

  /* If this site already holds permission, the dot appears without a prompt;
     nobody is ever asked for location until they press the location control. */
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) return;
    let cancelled = false;
    navigator.permissions.query({ name: "geolocation" as PermissionName })
      .then((status) => { if (!cancelled && status.state === "granted") dispatch({ type: "SELF_REQUESTED" }); })
      .catch(() => { /* Permissions API unavailable: wait for an explicit request. */ });
    return () => { cancelled = true; };
  }, [dispatch]);

  useEffect(() => {
    if (self.status !== "requesting" || watchRef.current !== null) return;
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      dispatch({ type: "SELF_FAILED", reason: "unsupported" });
      return;
    }
    if (!window.isSecureContext) {
      dispatch({ type: "SELF_FAILED", reason: "insecure" });
      return;
    }
    watchRef.current = navigator.geolocation.watchPosition(
      ({ coords, timestamp }) => {
        dispatch({
          type: "SELF_FIX",
          fix: { latitude: coords.latitude, longitude: coords.longitude, accuracyMeters: coords.accuracy, at: timestamp },
        });
      },
      (error) => {
        dispatch({ type: "SELF_FAILED", reason: SELF_FAILURES[error.code] ?? "position" });
        if (error.code === 1 && watchRef.current !== null) {
          navigator.geolocation.clearWatch(watchRef.current);
          watchRef.current = null;
        }
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    );
  }, [self.status, dispatch]);

  useEffect(() => () => {
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
  }, []);

  /* ── Google map lifecycle ─────────────────────────────────────────────── */

  useEffect(() => {
    if (!useGoogle) return;
    return onGoogleAuthFailure(() => {
      setGoogleReady(false);
      setGoogleFailed(true);
    });
  }, [useGoogle]);

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
          gestureHandling: "greedy",
          clickableIcons: false,
          keyboardShortcuts: true,
          minZoom: 3,
        });
        mapRef.current = map;
        labelLayerRef.current = createLabelLayer(maps, map, styles.mapZoneLabel);
        selfMarkerRef.current = createSelfMarker(maps, map, styles.selfDot);

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
          if (pinModeRef.current === "centre") {
            const centre = map.getCenter();
            if (centre) dispatch({ type: "PIN_CENTRE_MOVED", point: { latitude: centre.lat(), longitude: centre.lng() } });
          }
        });

        /* A plain click away from every zone closes what is open; it never picks a location. */
        map.addListener("click", () => {
          if (Date.now() < suppressClickUntilRef.current) return;
          dispatch({ type: "MAP_TAPPED_EMPTY" });
        });
        /* Right-click on a desktop, and a long press on most touch browsers. */
        map.addListener("contextmenu", (event: google.maps.MapMouseEvent) => {
          if (!event.latLng || Date.now() < suppressClickUntilRef.current) return;
          suppressClickUntilRef.current = Date.now() + 700;
          dispatch({ type: "PIN_PRESSED", point: { latitude: event.latLng.lat(), longitude: event.latLng.lng() } });
        });

        setGoogleReady(true);
      })
      .catch(() => { if (!cancelled) setGoogleFailed(true); });

    return () => { cancelled = true; };
  }, [useGoogle, googleMapsApiKey, loadZones, dispatch]);

  /* A long press, measured from the pointer itself: touch browsers differ in
     whether they report one, and iOS reports none. Movement cancels it, so
     panning is never mistaken for choosing a point. */
  useEffect(() => {
    const element = containerRef.current;
    if (!useGoogle || !googleReady || !element) return;
    let timer = 0;
    let start: { x: number; y: number; id: number } | null = null;
    const cancel = () => { window.clearTimeout(timer); start = null; };
    const down = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (!event.isPrimary) { cancel(); return; }
      const rect = element.getBoundingClientRect();
      start = { x: event.clientX, y: event.clientY, id: event.pointerId };
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const point = labelLayerRef.current?.toCoordinate(x, y);
        start = null;
        if (!point) return;
        suppressClickUntilRef.current = Date.now() + 700;
        dispatch({ type: "PIN_PRESSED", point });
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
  }, [useGoogle, googleReady, dispatch]);

  useEffect(() => {
    if (!googleReady || !mapRef.current) return;
    mapRef.current.setMapTypeId(mapMode);
  }, [googleReady, mapMode]);

  /* ── Zone polygons: created once per drawing, restyled in place ────────── */

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !googleReady) return;
    const shapes = zoneShapesRef.current;
    const wanted = new Set<string>();
    for (const feature of features) {
      const key = zoneKey(feature);
      wanted.add(key);
      const existing = shapes.get(key);
      // Same zone, same drawing: nothing to do. A new tolerance replaces the paths only.
      if (existing && existing.feature.rings === feature.rings) continue;
      const paths = feature.rings.map((ring) => ring.map(([lng, lat]) => ({ lat, lng })));
      if (existing) {
        existing.polygon.setPaths(paths);
        existing.feature = feature;
        continue;
      }
      const polygon = new google.maps.Polygon({ map, paths, clickable: true });
      polygon.addListener("click", () => {
        if (Date.now() < suppressClickUntilRef.current) return;
        dispatch({ type: "ZONE_SELECTED", zone: featureRef(shapes.get(key)!.feature), origin: "map" });
      });
      polygon.addListener("contextmenu", (event: google.maps.PolyMouseEvent) => {
        if (!event.latLng || Date.now() < suppressClickUntilRef.current) return;
        suppressClickUntilRef.current = Date.now() + 700;
        dispatch({ type: "PIN_PRESSED", point: { latitude: event.latLng.lat(), longitude: event.latLng.lng() } });
      });
      polygon.addListener("mouseover", () => setHoveredKey(key));
      polygon.addListener("mouseout", () => setHoveredKey((current) => (current === key ? null : current)));
      shapes.set(key, { polygon, feature });
    }
    for (const [key, { polygon }] of shapes) {
      if (!wanted.has(key)) {
        google.maps.event.clearInstanceListeners(polygon);
        polygon.setMap(null);
        shapes.delete(key);
      }
    }
  }, [googleReady, features, dispatch]);

  useEffect(() => {
    if (!googleReady) return;
    for (const [key, { polygon, feature }] of zoneShapesRef.current) {
      const certified = feature.coverage === "VERIFIED";
      const selected = key === selectedKey || key === huntKey;
      const hovered = key === hoveredKey;
      const state = filterActive ? filterStates.get(key) : undefined;
      const fill = state ? STATE_FILL[state] : undefined;
      polygon.setOptions({
        strokeColor: selected ? "#f0ead8" : ZONE_STROKE[feature.coverage],
        strokeOpacity: selected ? 1 : hovered ? 0.95 : certified ? 0.7 : 0.42,
        strokeWeight: selected ? 2.8 : hovered ? 2 : certified ? 1.2 : 0.9,
        fillColor: fill?.color ?? (selected ? "#9fbc8e" : ZONE_STROKE[feature.coverage]),
        fillOpacity: fill
          ? fill.opacity + (hovered ? 0.06 : 0)
          : selected ? 0.13 : hovered ? 0.1 : filterActive ? 0 : certified ? 0.05 : 0.025,
        zIndex: selected ? 5 : hovered ? 4 : certified ? 3 : 2,
      });
    }
  }, [googleReady, features, selectedKey, huntKey, hoveredKey, filterActive, filterStates]);

  /* Labels: the authority's designation, once per zone, where it fits. */
  const labelSources = useMemo<LabelSource[]>(() => features.flatMap((feature) => {
    if (!feature.labelPoint || !feature.labelSpan) return [];
    const key = zoneKey(feature);
    const state = filterActive ? filterStates.get(key) : undefined;
    const selected = key === selectedKey || key === huntKey;
    return [{
      key,
      text: feature.label,
      short: feature.name,
      labelPoint: feature.labelPoint,
      labelSpan: feature.labelSpan,
      priority: selected ? 100 : feature.coverage === "VERIFIED" ? 2 : 1,
      selected,
      ...(state ? { glyph: EXPLORATION_WORDING[state].glyph, state } : {}),
    }];
  }), [features, filterActive, filterStates, selectedKey, huntKey]);

  useEffect(() => {
    if (googleReady) labelLayerRef.current?.setLabels(labelSources);
  }, [googleReady, labelSources]);

  /* The hunt zone at full detail, above the layer, so the answer is unmistakable. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !googleReady) return;
    for (const shape of highlightRef.current) shape.setMap(null);
    highlightRef.current = [];
    if (!zone?.displayRings?.length || !hunt) return;
    highlightRef.current.push(new google.maps.Polygon({
      map,
      paths: zone.displayRings.map((ring) => ring.map(([lng, lat]) => ({ lat, lng }))),
      strokeColor: "#f0ead8", strokeOpacity: 0.95, strokeWeight: 2.6,
      fillColor: "#9fbc8e", fillOpacity: 0.1, clickable: false, zIndex: 6,
    }));
  }, [googleReady, zone, hunt]);

  /* ── Markers ─────────────────────────────────────────────────────────── */

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !googleReady) return;
    if (!hunt) {
      huntMarkerRef.current?.setMap(null);
      huntMarkerRef.current = null;
      return;
    }
    const position = { lat: hunt.latitude, lng: hunt.longitude };
    const title = `Planned hunt location: ${hunt.label}`;
    if (!huntMarkerRef.current) {
      huntMarkerRef.current = new google.maps.Marker({
        map, position, title, zIndex: 10, clickable: false, icon: huntPinIcon(google.maps, "hunt"),
      });
    } else {
      huntMarkerRef.current.setPosition(position);
      huntMarkerRef.current.setTitle(title);
    }
  }, [googleReady, hunt]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !googleReady) return;
    // A centre-follow preview is shown by the fixed crosshair, not a marker.
    if (!pin || pin.mode === "centre") {
      previewMarkerRef.current?.setMap(null);
      previewMarkerRef.current = null;
      return;
    }
    const position = { lat: pin.point.latitude, lng: pin.point.longitude };
    if (!previewMarkerRef.current) {
      previewMarkerRef.current = new google.maps.Marker({
        map, position, title: "Previewed location — not selected", zIndex: 11, clickable: false, icon: huntPinIcon(google.maps, "preview"),
      });
    } else {
      previewMarkerRef.current.setPosition(position);
    }
  }, [googleReady, pin]);

  useEffect(() => {
    if (!googleReady) return;
    selfMarkerRef.current?.update(self.status === "live" ? self.fix : null);
  }, [googleReady, self]);

  /* ── Camera: only ever in response to an explicit request ─────────────── */

  const sheetPadding = useCallback((): google.maps.Padding => {
    const element = surfaceRef.current;
    const width = element?.clientWidth ?? 800;
    const height = element?.clientHeight ?? 520;
    const sheet = cardOpen || pin;
    if (!sheet) return { top: 56, right: 64, bottom: 40, left: 40 };
    // Wide: the card floats on the left. Narrow: it rises from the bottom.
    return width >= 700
      ? { top: 56, right: 64, bottom: 40, left: Math.min(380, width * 0.5) }
      : { top: 56, right: 60, bottom: Math.round(height * 0.5), left: 24 };
  }, [cardOpen, pin]);

  const lastCameraRef = useRef(0);
  useEffect(() => {
    if (!camera || camera.seq === lastCameraRef.current) return;
    // A map that failed after it was built is still referenced; it must not be driven.
    const map = useGoogle && googleReady ? mapRef.current : null;
    if (useGoogle && !map) return;
    lastCameraRef.current = camera.seq;

    let rings: number[][][] | null = null;
    let point: GeoPoint | null = null;
    if (camera.target === "self" && self.status === "live") point = self.fix;
    if (camera.target === "hunt" && hunt) point = hunt;
    if (camera.target === "zone" && selection.kind === "zone") {
      const key = zoneKey(selection.zone);
      rings = key === huntKey && zone?.displayRings?.length ? zone.displayRings : featureByKey.get(key)?.rings ?? null;
      if (key === huntKey && hunt) point = hunt;
    }

    if (map) {
      if (rings) {
        const bounds = new google.maps.LatLngBounds();
        for (const ring of rings) for (const [lng, lat] of ring) bounds.extend({ lat, lng });
        if (point) bounds.extend({ lat: point.latitude, lng: point.longitude });
        map.fitBounds(bounds, sheetPadding());
      } else if (point) {
        map.panTo({ lat: point.latitude, lng: point.longitude });
        const minimum = camera.target === "self" ? 12 : 9;
        if ((map.getZoom() ?? 0) < minimum) map.setZoom(minimum);
      }
      return;
    }

    /* The boundary view moves the same way, within its own projection. */
    if (rings && canvasSize) {
      const box = boundsOfRings(point ? [...rings, [[point.longitude, point.latitude]]] : rings);
      if (box) {
        setFramed(true);
        const padding = sheetPadding();
        setViewport(fitViewport(box, canvasSize, {
          top: padding.top ?? 0, right: padding.right ?? 0, bottom: padding.bottom ?? 0, left: padding.left ?? 0,
        }));
      }
    } else if (point) {
      setFramed(true);
      setViewport((current) => ({ latitude: point!.latitude, longitude: point!.longitude, zoom: Math.max(current.zoom, camera.target === "self" ? 10 : 8) }));
    }
  }, [camera, useGoogle, googleReady, self, hunt, selection, huntKey, zone, featureByKey, canvasSize, sheetPadding]);

  /* ── Boundary neighbour for the hunt point ────────────────────────────── */

  const neighbour = useMemo(() => {
    if (!hunt || !zone?.nearBoundary || !zone.layerId || !zone.designation) return null;
    return nearestNeighbour(hunt, { layerId: zone.layerId, name: zone.designation }, features, 2_500);
  }, [hunt, zone, features]);

  useEffect(() => {
    onNeighbour?.(neighbour?.zone.label ?? null);
  }, [neighbour, onNeighbour]);

  /* ── Zone card: what the certified rules say about the whole zone ─────── */

  const summaryCacheRef = useRef(new Map<string, ZoneSummary>());
  useEffect(() => {
    if (selection.kind !== "zone" || !cardOpen) {
      setSummaryLoad(null);
      return;
    }
    const { layerId, designation } = selection.zone;
    const cacheKey = `${zoneKey(selection.zone)}|${date}`;
    const cached = summaryCacheRef.current.get(cacheKey);
    if (cached) {
      setSummaryLoad({ kind: "ready", summary: cached });
      return;
    }
    const controller = new AbortController();
    setSummaryLoad({ kind: "loading" });
    fetch(`/api/hunt/zone-summary?${new URLSearchParams({ layer: layerId, zone: designation, date })}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as { status: string; summary?: ZoneSummary; message?: string };
        if (payload.status !== "OK" || !payload.summary) throw new Error(payload.message ?? "This zone could not be summarised.");
        summaryCacheRef.current.set(cacheKey, payload.summary);
        setSummaryLoad({ kind: "ready", summary: payload.summary });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setSummaryLoad({
          kind: "error",
          message: `${error instanceof Error ? error.message : "This zone could not be summarised."} North Ground will not infer what applies.`,
        });
      });
    return () => controller.abort();
  }, [selection, cardOpen, date]);

  /* ── Species filter: one species across the zones in view ─────────────── */

  const filterKey = useMemo(
    () => features.map((feature) => zoneKey(feature)).sort().join(","),
    [features],
  );
  const filterCacheRef = useRef(new Map<string, ZoneState>());
  useEffect(() => {
    if (!filterSpeciesId) {
      setFilterStates(new Map());
      return;
    }
    const prefix = `${filterSpeciesId}|${date}|`;
    const known = new Map<string, ZoneState>();
    const missing: ZoneRef[] = [];
    for (const feature of features) {
      const key = zoneKey(feature);
      const cached = filterCacheRef.current.get(prefix + key);
      if (cached) known.set(key, cached);
      else missing.push(featureRef(feature));
    }
    setFilterStates(known);
    if (!missing.length) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setFilterLoading(true);
      fetch("/api/hunt/zone-status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ speciesId: filterSpeciesId, date, zones: missing.slice(0, 450) }),
        signal: controller.signal,
      })
        .then(async (response) => {
          const payload = await response.json() as { status: string; states?: Array<ZoneRef & { state: ZoneState }> };
          if (payload.status !== "OK" || !payload.states) throw new Error("status unavailable");
          const next = new Map(known);
          for (const entry of payload.states) {
            const key = zoneKey(entry);
            filterCacheRef.current.set(prefix + key, entry.state);
            next.set(key, entry.state);
          }
          setFilterStates(next);
        })
        .catch(() => { /* Unfiltered zones stay unfilled: no state is ever guessed. */ })
        .finally(() => { if (!controller.signal.aborted) setFilterLoading(false); });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
    // `filterKey` stands for `features`: re-run when the set of zones changes, not on every redraw.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSpeciesId, date, filterKey]);

  /* ── Special overlays, only when switched on ──────────────────────────── */

  useEffect(() => {
    if (!enabledOverlays.length || !view) return;
    const controller = new AbortController();
    const bounds = [view.box.west, view.box.south, view.box.east, view.box.north].map((value) => value.toFixed(4)).join(",");
    const failures: string[] = [];
    Promise.all(enabledOverlays.map(async (id) => {
      try {
        const response = await fetch(`/api/hunt/overlays?${new URLSearchParams({ layer: id, bounds, zoom: String(Math.round(view.zoom)) })}`, { signal: controller.signal });
        const payload = await response.json() as { status: string; message?: string; features?: OverlayFeature[] };
        if (payload.status === "PROVIDER_ERROR" && payload.message) failures.push(payload.message);
        return [id, payload.features ?? []] as const;
      } catch {
        return [id, [] as OverlayFeature[]] as const;
      }
    })).then((entries) => {
      if (controller.signal.aborted) return;
      setOverlayFeatures(Object.fromEntries(entries));
      setOverlayNotice(failures.length ? failures.join(" ") : null);
    });
    return () => controller.abort();
  }, [enabledOverlays, view]);

  const drawnOverlays = useMemo(
    () => enabledOverlays.flatMap((id) => overlayFeatures[id] ?? []),
    [enabledOverlays, overlayFeatures],
  );

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !googleReady) return;
    const shapes = overlayShapesRef.current;
    for (const drawn of shapes.values()) {
      for (const shape of drawn) {
        google.maps.event.clearInstanceListeners(shape);
        shape.setMap(null);
      }
    }
    shapes.clear();
    /* A special area reads as a different kind of thing from a management zone:
       a dashed amber outline over a light wash, not another solid colour. */
    const dash = { path: "M 0,-1 0,1", strokeOpacity: 0.95, strokeColor: "#e0a04a", scale: 2 };
    for (const feature of drawnOverlays) {
      const paths = feature.rings.map((ring) => ring.map(([lng, lat]) => ({ lat, lng })));
      const polygon = new google.maps.Polygon({
        map, paths, strokeWeight: 0, fillColor: "#e0a04a", fillOpacity: 0.14, zIndex: 8, clickable: true,
      });
      polygon.addListener("click", () => {
        if (Date.now() < suppressClickUntilRef.current) return;
        dispatch({ type: "OVERLAY_SELECTED", layerId: feature.layerId, objectId: feature.objectId });
      });
      const outlines = paths.map((path) => new google.maps.Polyline({
        map, path, strokeOpacity: 0, clickable: false, zIndex: 8,
        icons: [{ icon: dash, offset: "0", repeat: "9px" }],
      }));
      shapes.set(`${feature.layerId}|${feature.objectId}`, [polygon, ...outlines]);
    }
  }, [googleReady, drawnOverlays, dispatch]);

  /* ── Pin preview: which zone would this point be in? ──────────────────── */

  useEffect(() => {
    if (!pin) return;
    const controller = new AbortController();
    setPinZone({ kind: "loading" });
    const timer = window.setTimeout(() => {
      fetch("/api/hunt/zone", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ latitude: Number(pin.point.latitude.toFixed(6)), longitude: Number(pin.point.longitude.toFixed(6)) }),
        signal: controller.signal,
      })
        .then(async (response) => {
          const payload = await response.json() as { status: string; message?: string; zone?: { shortLabel: string }; layer?: { jurisdictionName: string } };
          if (payload.status === "RESOLVED" && payload.zone) {
            setPinZone({ kind: "resolved", label: payload.zone.shortLabel, jurisdiction: payload.layer?.jurisdictionName ?? "" });
          } else {
            setPinZone({ kind: "none", message: payload.message ?? "No official hunting zone could be resolved for this point." });
          }
        })
        .catch(() => { if (!controller.signal.aborted) setPinZone({ kind: "none", message: "The official zone service could not be reached." }); });
    }, pin.mode === "centre" ? 450 : 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [pin]);

  /* ── The boundary view frames itself once ──────────────────────────────── */

  if (!useGoogle && !framed && !hunt && canvasSize && features.length) {
    setFramed(true);
    const box = boundsOfRings(features.flatMap((feature) => feature.rings));
    if (box) {
      setViewport({
        latitude: (box.south + box.north) / 2,
        longitude: (box.west + box.east) / 2,
        zoom: zoomToFit(box, canvasSize),
      });
    }
  }

  /* ── Actions ───────────────────────────────────────────────────────────── */

  const liveGoogleMap = useGoogle && googleReady ? mapRef.current : null;

  const mapCentre = useCallback((): GeoPoint => {
    const centre = liveGoogleMap?.getCenter();
    return centre ? { latitude: centre.lat(), longitude: centre.lng() } : { latitude: viewport.latitude, longitude: viewport.longitude };
  }, [liveGoogleMap, viewport]);

  const startCentrePin = useCallback((at?: GeoPoint) => {
    setPanel(null);
    if (at) {
      if (liveGoogleMap) liveGoogleMap.panTo({ lat: at.latitude, lng: at.longitude });
      else setViewport((current) => ({ ...current, latitude: at.latitude, longitude: at.longitude }));
    }
    dispatch({ type: "PIN_CENTRE_STARTED", point: at ?? mapCentre() });
  }, [dispatch, mapCentre, liveGoogleMap]);

  const selectedFeature = selectedKey ? featureByKey.get(selectedKey) ?? null : null;
  const selectedOverlay = selection.kind === "overlay"
    ? drawnOverlays.find((feature) => feature.layerId === selection.layerId && feature.objectId === selection.objectId) ?? null
    : null;

  const checkHuntInZone = useCallback(() => {
    if (selectedKey && selectedKey === huntKey) {
      dispatch({ type: "CARD_CLOSED" });
      onContinueHunt();
      return;
    }
    // A zone is not a hunting spot: the person places one inside it and confirms.
    startCentrePin(selectedFeature?.labelPoint ? { latitude: selectedFeature.labelPoint[1], longitude: selectedFeature.labelPoint[0] } : undefined);
  }, [selectedKey, huntKey, dispatch, onContinueHunt, startCentrePin, selectedFeature]);

  /* ── Panels: focus moves in on open, and back to the trigger on Escape ───── */

  const panelTriggerRef = useRef<HTMLButtonElement | null>(null);
  const togglePanel = useCallback((next: "layers" | "zones", trigger: HTMLButtonElement) => {
    panelTriggerRef.current = trigger;
    setPanel((current) => (current === next ? null : next));
  }, []);
  useEffect(() => {
    if (!panel) return;
    const container = document.getElementById(panel === "zones" ? "hunt-zones-in-view" : "hunt-map-layers");
    container?.querySelector<HTMLElement>("input, button")?.focus();
  }, [panel]);
  const closePanelOnEscape = useCallback((event: ReactKeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    setPanel(null);
    panelTriggerRef.current?.focus();
  }, []);

  /* ── Derived chrome ────────────────────────────────────────────────────── */

  const layerOf = (layerId: string | undefined) => layers.find((candidate) => candidate.id === layerId) ?? null;
  const drawnLayerIds = [...new Set(features.map((feature) => feature.layerId))];
  const soleLayer = drawnLayerIds.length === 1 ? layerOf(drawnLayerIds[0]) : null;
  const statesInView = filterActive ? [...new Set(filterStates.values())] : [];
  const zonesForList = useMemo(() => {
    const query = zoneFilterText.trim().toUpperCase();
    return [...features]
      .filter((feature) => !query || feature.label.toUpperCase().includes(query) || feature.name.toUpperCase() === query)
      // An exact designation first ("71" before "718"), then by jurisdiction and designation.
      .sort((a, b) =>
        Number(b.name.toUpperCase() === query) - Number(a.name.toUpperCase() === query) ||
        a.layerId.localeCompare(b.layerId) || a.name.localeCompare(b.name, "en", { numeric: true }));
  }, [features, zoneFilterText]);
  const selectedZoneLabel = selection.kind === "zone"
    ? selectedFeature?.label ?? (selectedKey === huntKey ? zone?.shortLabel : null) ?? selection.zone.designation
    : null;
  const liveFix = self.status === "live" ? self.fix : null;

  return (
    <div
      className={styles.mapSurface}
      ref={surfaceRef}
      data-sheet={cardOpen || pin ? "open" : undefined}
      data-pin={pin?.mode}
    >
      {useGoogle ? (
        <div ref={containerRef} className={styles.mapCanvas} />
      ) : (
        <ZoneCanvas
          features={features}
          viewport={viewport}
          onViewportChange={(next) => {
            setFramed(true);
            setViewport(next);
            if (pin?.mode === "centre") dispatch({ type: "PIN_CENTRE_MOVED", point: { latitude: next.latitude, longitude: next.longitude } });
          }}
          onResize={setCanvasSize}
          huntPoint={hunt}
          selfFix={liveFix}
          previewPoint={pin?.mode === "pressed" ? pin.point : null}
          selectedZoneKey={selectedKey ?? huntKey}
          selectedZoneLabel={selectedZoneLabel ?? zone?.shortLabel ?? null}
          labels={labelSources}
          filterStates={filterActive ? filterStates : null}
          zoneKeyOf={zoneKey}
          onZoneClick={(feature) => dispatch({ type: "ZONE_SELECTED", zone: featureRef(feature), origin: "map" })}
          onEmptyClick={() => dispatch({ type: "MAP_TAPPED_EMPTY" })}
          onLongPress={(point) => dispatch({ type: "PIN_PRESSED", point })}
          overlays={drawnOverlays}
          onOverlayClick={(feature) => dispatch({ type: "OVERLAY_SELECTED", layerId: feature.layerId, objectId: feature.objectId })}
        />
      )}

      {pin?.mode === "centre" ? (
        <div className={styles.pinCrosshair} aria-hidden="true">
          <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
            <circle cx="22" cy="22" r="9" stroke="currentColor" strokeWidth="2" />
            <path d="M22 3v11M22 30v11M3 22h11M30 22h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      ) : null}

      {/* ── Top-left: what is drawn, and the species filter ──────────────── */}

      <div className={styles.mapTopLeft}>
        <button
          type="button"
          className={`${styles.mapBadge} ng-glass-overlay`}
          aria-expanded={panel === "zones"}
          aria-controls="hunt-zones-in-view"
          onClick={(event) => togglePanel("zones", event.currentTarget)}
        >
          <span className={styles.mapBadgeDot} aria-hidden="true" />
          <span>
            <strong>
              {zone && hunt ? zone.shortLabel : soleLayer ? `${soleLayer.jurisdictionName} ${soleLayer.officialTerm}s` : "Official hunting zones"}
            </strong>
            <span className={styles.mapBadgeMeta}>
              {zonesState === "loading" ? "Loading official boundaries…"
                : features.length ? `${features.length} in view · list zones`
                : "Pan to covered geography"}
            </span>
          </span>
        </button>

        {explorableSpecies.length ? (
          <label className={`${styles.mapFilter} ng-glass-overlay`}>
            <span className={styles.mapFilterLabel}>Explore</span>
            <select
              value={filterSpeciesId}
              onChange={(event) => setFilterSpeciesId(event.target.value)}
              aria-label="Show a species' status by zone"
            >
              <option value="">All zones</option>
              {explorableSpecies.map((option) => (
                <option key={option.id} value={option.id}>{option.displayName}</option>
              ))}
            </select>
            {filterLoading ? <span className={styles.spinner} aria-hidden="true" /> : null}
          </label>
        ) : null}
      </div>

      {/* ── Right: map controls ──────────────────────────────────────────── */}

      <div className={styles.mapControls}>
        <button
          type="button"
          className={`${styles.mapControl} ng-glass-control`}
          onClick={() => dispatch({ type: "RECENTER" })}
          aria-label={liveFix ? "Centre the map on your location" : "Show your location on the map"}
          title={liveFix ? "Centre on your location" : "Show your location"}
          data-active={liveFix ? "true" : undefined}
          aria-busy={self.status === "requesting" || undefined}
        >
          {self.status === "requesting" ? (
            <span className={styles.spinner} aria-hidden="true" />
          ) : (
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" fill="none">
              <circle cx="10" cy="10" r="5.2" stroke="currentColor" strokeWidth="1.6" />
              <circle cx="10" cy="10" r="1.9" fill="currentColor" />
              <path d="M10 1.5v3M10 15.5v3M1.5 10h3M15.5 10h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          )}
        </button>
        <button
          type="button"
          className={`${styles.mapControl} ng-glass-control`}
          onClick={() => (pin ? dispatch({ type: "PIN_CANCELLED" }) : startCentrePin())}
          aria-pressed={Boolean(pin)}
          aria-label={pin ? "Cancel choosing a location" : "Choose a hunting spot on the map"}
          title={pin ? "Cancel" : "Choose a spot on the map"}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" fill="none">
            <path d="M10 18.5s-5.6-6.3-5.6-10.6a5.6 5.6 0 0 1 11.2 0c0 4.3-5.6 10.6-5.6 10.6Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            <circle cx="10" cy="7.9" r="2" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </button>
        <button
          type="button"
          className={`${styles.mapControl} ng-glass-control`}
          aria-expanded={panel === "layers"}
          aria-controls="hunt-map-layers"
          aria-label="Map layers"
          title="Map layers"
          onClick={(event) => togglePanel("layers", event.currentTarget)}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" fill="none">
            <path d="m10 2.5 8 4.2-8 4.2-8-4.2 8-4.2Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            <path d="m2 10.4 8 4.2 8-4.2M2 13.9l8 4.2 8-4.2" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* ── Panels ────────────────────────────────────────────────────────── */}

      {panel === "layers" ? (
        <div id="hunt-map-layers" className={`${styles.mapPanel} ng-glass-popover`} role="group" aria-label="Map layers" onKeyDown={closePanelOnEscape}>
          <p className={styles.mapPanelTitle}>Layers</p>
          {useGoogle ? (
            <div className={styles.mapModes} role="group" aria-label="Basemap">
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
          ) : null}
          <div className={styles.layerRow}>
            <span className={styles.layerCheck} aria-hidden="true">✓</span>
            <div>
              <p className={styles.layerName}>Management areas <span className={styles.layerTag}>always shown</span></p>
              {(drawnLayerIds.length ? drawnLayerIds.map((id) => layerOf(id)).filter((meta): meta is LayerMeta => Boolean(meta)) : layers).map((meta) => (
                <p key={meta.id} className={styles.layerNote}>
                  {meta.jurisdictionName} {meta.officialTerm}s — {meta.authority}. {meta.coverageNote}
                </p>
              ))}
            </div>
          </div>
          {overlayLayers.map((layer) => {
            const on = enabledOverlays.includes(layer.id);
            return (
              <label key={layer.id} className={styles.layerRow}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => setEnabledOverlays((current) => (on ? current.filter((id) => id !== layer.id) : [...current, layer.id]))}
                />
                <div>
                  <p className={styles.layerName}>{layer.name} <span className={styles.layerTag}>{layer.jurisdictionName}</span></p>
                  <p className={styles.layerNote}>{layer.authority}. {layer.standing}</p>
                </div>
              </label>
            );
          })}
          {!overlayLayers.length ? (
            <p className={styles.layerNote}>
              No certified special-area layer covers this view. North Ground adds one only where the authority publishes it.
            </p>
          ) : null}
        </div>
      ) : null}

      {panel === "zones" ? (
        <div id="hunt-zones-in-view" className={`${styles.mapPanel} ${styles.mapPanelLeft} ng-glass-popover`} role="group" aria-label="Zones in view" onKeyDown={closePanelOnEscape}>
          <label className={styles.mapPanelTitle} htmlFor="hunt-zone-filter">Zones in view</label>
          <input
            id="hunt-zone-filter"
            className={styles.zoneFilterInput}
            value={zoneFilterText}
            onChange={(event) => setZoneFilterText(event.target.value)}
            placeholder="Filter, e.g. 57"
            autoComplete="off"
          />
          <ul className={styles.zoneList}>
            {zonesForList.slice(0, 200).map((feature) => {
              const key = zoneKey(feature);
              const state = filterActive ? filterStates.get(key) : undefined;
              return (
                <li key={key}>
                  <button
                    type="button"
                    className={styles.zoneListItem}
                    aria-current={key === selectedKey || undefined}
                    onClick={() => {
                      setPanel(null);
                      dispatch({ type: "ZONE_SELECTED", zone: featureRef(feature), origin: "list" });
                    }}
                  >
                    <span>{feature.label}</span>
                    <span className={styles.zoneListMeta}>
                      {layerOf(feature.layerId)?.jurisdictionName ?? ""}
                      {state ? ` · ${EXPLORATION_WORDING[state].glyph} ${EXPLORATION_WORDING[state].label}` : feature.coverage === "VERIFIED" ? " · Certified" : " · Boundary only"}
                    </span>
                  </button>
                </li>
              );
            })}
            {!zonesForList.length ? <li className={styles.layerNote}>No drawn zone matches.</li> : null}
          </ul>
        </div>
      ) : null}

      {/* ── Sheets ────────────────────────────────────────────────────────── */}

      {pin ? (
        <PinPreviewCard
          mode={pin.mode}
          zone={pinZone}
          point={pin.point}
          onConfirm={onConfirmPin}
          onCancel={() => dispatch({ type: "PIN_CANCELLED" })}
        />
      ) : cardOpen && selection.kind === "zone" && summaryLoad ? (
        <ZoneCard
          load={summaryLoad}
          zoneLabel={selectedZoneLabel ?? selection.zone.designation}
          date={date}
          isToday={isToday}
          isHuntZone={selectedKey === huntKey}
          boundary={selectedKey === huntKey && zone?.nearBoundary
            ? { distanceMeters: zone.boundaryDistanceMeters, neighbourLabel: neighbour?.zone.label }
            : null}
          parts={selectedFeature?.parts}
          focusOnOpen={selection.origin === "list"}
          onClose={() => dispatch({ type: "CARD_CLOSED" })}
          onCheckHunt={checkHuntInZone}
        />
      ) : cardOpen && selectedOverlay ? (
        <OverlayCard
          feature={selectedOverlay}
          layer={overlayLayers.find((layer) => layer.id === selectedOverlay.layerId) ?? null}
          onClose={() => dispatch({ type: "CARD_CLOSED" })}
        />
      ) : null}

      {/* ── Bottom: legend and notices ────────────────────────────────────── */}

      <div className={styles.mapBottom}>
        {notice ? (
          <p className={`${styles.mapNotice} ng-glass-popover`} role="status">
            {notice === "self-denied"
              ? "Location access is off for this site, so your position can’t be shown. You can allow it in your browser’s site settings. Hunt works the same without it."
              : "This browser can’t share your location here. Hunt works the same without it — search a place or choose a spot on the map."}
            <button type="button" className={styles.noticeDismiss} onClick={() => dispatch({ type: "NOTICE_DISMISSED" })}>Dismiss</button>
          </p>
        ) : null}
        {liveFix && liveFix.accuracyMeters > 1_000 ? (
          <p className={`${styles.mapNotice} ng-glass-overlay`} data-compact="true" role="status">
            Your position is approximate (±{(liveFix.accuracyMeters / 1000).toFixed(1)} km)
          </p>
        ) : null}
        {zonesState === "error" || zonesState === "partial" ? (
          <p className={`${styles.mapNotice} ng-glass-popover`} role="status">{zonesMessage}</p>
        ) : null}
        {overlayNotice ? <p className={`${styles.mapNotice} ng-glass-popover`} role="status">{overlayNotice}</p> : null}
        {googleFailed ? (
          <p className={`${styles.mapNotice} ng-glass-popover`} role="status">
            The interactive basemap could not load. Official boundaries and every
            result below are unaffected.
          </p>
        ) : null}

        <p className={`${styles.mapLegend} ng-glass-overlay`}>
          {filterActive ? (
            statesInView.length ? statesInView.map((state) => (
              <span key={state} className={styles.legendItem}>
                <span className={styles.legendGlyph} data-state={state} aria-hidden="true">{EXPLORATION_WORDING[state].glyph}</span>
                {EXPLORATION_WORDING[state].label}
              </span>
            )) : <span>Reading the certified rules…</span>
          ) : (
            <>
              <span className={styles.legendSwatch} data-coverage="VERIFIED" aria-hidden="true" />
              <span>Certified rules</span>
              <span className={styles.legendSwatch} data-coverage="IN_DEVELOPMENT" aria-hidden="true" />
              <span>Boundary only</span>
              <span className={styles.legendPin} aria-hidden="true" />
              <span>Hunt</span>
              <span className={styles.legendSelf} aria-hidden="true" />
              <span>You</span>
            </>
          )}
        </p>

        {!useGoogle && !googleFailed ? (
          <p className={`${styles.mapNotice} ng-glass-overlay`} data-compact="true">
            Boundary view — no basemap
          </p>
        ) : null}
      </div>

      {/* The map is never the only interface. */}
      <p className="ng-visually-hidden" aria-live="polite">
        {hunt
          ? `Planned hunt location: ${hunt.label}` +
            (zone ? `, inside ${zone.officialName}.` : ", with no official zone resolved yet.") +
            (zone?.nearBoundary ? ` It is close to the mapped boundary${neighbour ? ` with ${neighbour.zone.label}` : ""}; verify your exact position.` : "")
          : `No hunt location chosen. ${features.length} official hunting-zone boundaries drawn` +
            (drawnLayerIds.length
              ? `, published by ${drawnLayerIds.map((id) => layerOf(id)).filter((meta): meta is LayerMeta => Boolean(meta))
                  .map((meta) => `${meta.authority} for ${meta.jurisdictionName}`).join(" and by ")}.`
              : ".")}
        {liveFix ? " Your device location is shown as a blue dot; it is not your hunt location." : ""}
        {filterActive ? ` Showing ${explorableSpecies.find((option) => option.id === filterSpeciesId)?.displayName ?? "one species"} by zone; the zones list gives each zone's status in words.` : ""}
      </p>
    </div>
  );
}
