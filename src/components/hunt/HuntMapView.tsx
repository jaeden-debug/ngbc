"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, type Dispatch } from "react";
import type { Emphasis } from "../../lib/hunt/exploration/cartography";
import type { BBox, DrawnZone } from "../../lib/hunt/exploration/geometry-store";
import type { ExplorationEvent, ExplorationState, GeoPoint, SelfFailure } from "../../lib/hunt/exploration/map-state";
import type { OverlayFeature } from "../../lib/hunt/exploration/overlay-layers";
import { servedJurisdictionList } from "../../lib/hunt/exploration/overview";
import { OPENING_CAMERA, posterFrame } from "../../lib/hunt/exploration/overview-poster";
import { mapLabelFor } from "../../lib/hunt/exploration/map-labels";
import { EXPLORATION_WORDING, type ExplorationState as ZoneState } from "../../lib/hunt/exploration/states";
import type { ZoneFeature } from "../../lib/hunt/zone-geometry";
import dynamic from "next/dynamic";
import type { LabelSource } from "./map/google-overlays";
import type { GoogleZoneMap, Padding } from "./map/GoogleZoneMap";
import { loadGoogleMaps, onGoogleAuthFailure } from "./map/google-loader";
import { fitViewport, viewportBounds, type Viewport } from "./map/viewport";
import styles from "./HuntApp.module.css";

/* The boundary view is the fallback when Google is unavailable: its own chunk. */
const ZoneCanvas = dynamic(() => import("./ZoneCanvas"), { ssr: false });

/* The Maps script starts downloading the moment this module is evaluated —
   before hydration — rather than after the first render. */
const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
if (typeof window !== "undefined" && MAPS_KEY) void loadGoogleMaps(MAPS_KEY).catch(() => { /* the component reports it */ });
const loadController = () => import("./map/GoogleZoneMap");

/**
 * The map surface: Google where a browser key is configured and accepted, the
 * basemap-free boundary view otherwise. Both draw the same official geometry
 * from the same store, and both report the settled view the same way.
 *
 * The device's own location is watched here and nowhere else. It draws the
 * blue dot and can move the camera; it never reaches the hunt location, the
 * evaluation or a share, which are built from `exploration.hunt` alone.
 */

/** A hunt or zone camera request, resolved by the page from geometry it holds. */
export interface CameraRequest {
  /** The map machine's own camera sequence number this resolves. */
  seq: number;
  /** Frame this box (a zone), or bring this point into view. */
  box: BBox | null;
  point: GeoPoint | null;
  minZoom: number;
}

interface HuntMapViewProps {
  googleMapsApiKey?: string;
  exploration: ExplorationState;
  dispatch: Dispatch<ExplorationEvent>;
  drawn: DrawnZone[];
  selectedKey: string | null;
  huntKey: string | null;
  filterStates: ReadonlyMap<string, ZoneState> | null;
  overlays: OverlayFeature[];
  mapMode: "terrain" | "hybrid" | "roadmap";
  camera: CameraRequest | null;
  /** On first load with location permission already granted, centre on the device (camera only). */
  locateOnStart: boolean;
  /** Everything Hunt draws. A wide screen opens framed on it; a phone opens on the middle of it. */
  startBox: BBox;
  /** The server-drawn official zones for the opening camera (a data URI), shown until the live map draws. */
  poster: string | null;
  padding: () => Padding;
  /** How strongly the boundaries are drawn over the basemap. */
  emphasis: Emphasis;
  /** Whether the official zones are drawn at all. */
  zonesVisible: boolean;
  onView: (view: { box: BBox; zoom: number }) => void;
  onZoneClick: (key: string, origin: "map") => void;
  onOverlayClick: (layerId: string, objectId: number) => void;
  onBasemap: (state: "loading" | "ready" | "fallback") => void;
}

const START: Viewport = { ...OPENING_CAMERA };
const POSTER = posterFrame();
const POSTER_ALT = `Official hunting-zone boundaries for ${servedJurisdictionList()}, shown while the interactive map loads.`;
const SELF_FAILURES: Record<number, SelfFailure> = { 1: "denied", 2: "position", 3: "timeout" };

function HuntMapView({
  googleMapsApiKey, exploration, dispatch, drawn, selectedKey, huntKey, filterStates, overlays, mapMode, camera,
  locateOnStart, startBox, poster, padding, emphasis, zonesVisible, onView, onZoneClick, onOverlayClick, onBasemap,
}: HuntMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<GoogleZoneMap | null>(null);
  const [googleFailed, setGoogleFailed] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const useGoogle = Boolean(googleMapsApiKey) && !googleFailed;
  const { self, hunt, pin } = exploration;

  /* Callbacks the imperative map holds are read through a ref, so the map is
     built once and never torn down because a parent re-rendered. */
  const handlers = useRef({ onView, onZoneClick, onOverlayClick, dispatch });
  handlers.current = { onView, onZoneClick, onOverlayClick, dispatch };
  const pinModeRef = useRef<"pressed" | "centre" | null>(null);
  pinModeRef.current = pin?.mode ?? null;

  useEffect(() => {
    onBasemap(useGoogle ? (googleReady ? "ready" : "loading") : "fallback");
  }, [useGoogle, googleReady, onBasemap]);

  /* ── Google ──────────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!useGoogle) return;
    return onGoogleAuthFailure(() => {
      setGoogleReady(false);
      setGoogleFailed(true);
    });
  }, [useGoogle]);

  useEffect(() => {
    if (!useGoogle || !containerRef.current || controllerRef.current) return;
    let cancelled = false;
    Promise.all([loadGoogleMaps(googleMapsApiKey!), loadController()])
      .then(([maps, { GoogleZoneMap }]) => {
        if (cancelled || !containerRef.current) return;
        const fine = window.matchMedia?.("(pointer: fine)").matches ?? false;
        controllerRef.current = new GoogleZoneMap(containerRef.current, maps, {
          onZoneClick: (key) => handlers.current.onZoneClick(key, "map"),
          onEmptyClick: () => handlers.current.dispatch({ type: "MAP_TAPPED_EMPTY" }),
          onLongPress: (point) => handlers.current.dispatch({ type: "PIN_PRESSED", point }),
          onOverlayClick: (layerId, objectId) => handlers.current.onOverlayClick(layerId, objectId),
          onViewChange: (view) => {
            handlers.current.onView(view);
            if (pinModeRef.current === "centre") {
              const centre = controllerRef.current?.centre();
              if (centre) handlers.current.dispatch({ type: "PIN_CENTRE_MOVED", point: centre });
            }
          },
        }, {
          center: { latitude: START.latitude, longitude: START.longitude },
          zoom: START.zoom,
          fineControls: fine,
          labelClass: styles.mapZoneLabel,
          selfClass: styles.selfDot,
          pinClass: styles.mapPin,
        });
        // A wide screen has room for every served jurisdiction at once; a phone starts on the middle of them.
        if (containerRef.current.clientWidth >= 700) {
          controllerRef.current.map.fitBounds(
            { west: startBox.west, south: startBox.south, east: startBox.east, north: startBox.north },
            padding(),
          );
        }
        setGoogleReady(true);
      })
      .catch(() => { if (!cancelled) setGoogleFailed(true); });
    return () => { cancelled = true; };
    // Built once; the start box and padding are read at that moment only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useGoogle, googleMapsApiKey]);

  useEffect(() => () => {
    controllerRef.current?.destroy();
    controllerRef.current = null;
  }, []);

  useEffect(() => {
    // A map that failed after it was built is still referenced; it must not be driven.
    if (googleFailed) {
      controllerRef.current?.destroy();
      controllerRef.current = null;
    }
  }, [googleFailed]);

  const live = useGoogle && googleReady ? controllerRef.current : null;

  useEffect(() => { live?.setZones(drawn); live?.setLabels(drawn); }, [live, drawn]);
  useEffect(() => {
    if (!live) return;
    live.setStyleState({ selectedKey, huntKey, filterStates, emphasis });
    live.setLabels(drawn);
    // `drawn` is applied above; this effect only restyles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, selectedKey, huntKey, filterStates, emphasis]);
  useEffect(() => { live?.setOverlays(overlays); }, [live, overlays]);
  useEffect(() => { live?.setZonesVisible(zonesVisible); }, [live, zonesVisible]);
  useEffect(() => { live?.setMapType(mapMode); }, [live, mapMode]);
  useEffect(() => { live?.setHuntPin(hunt, hunt?.label ?? null); }, [live, hunt]);
  useEffect(() => { live?.setPreviewPin(pin?.mode === "pressed" ? pin.point : null); }, [live, pin]);
  useEffect(() => { live?.setSelf(self.status === "live" ? self.fix : null); }, [live, self]);

  /* ── Self location: watched only after an explicit request ───────────── */

  const watchRef = useRef<number | null>(null);

  /* Permission already held: the dot appears without a prompt, and on a first
     visit with nothing chosen the camera goes to it. Nobody is ever asked for
     location until they press a location control. */
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) return;
    let cancelled = false;
    navigator.permissions.query({ name: "geolocation" as PermissionName })
      .then((status) => {
        if (cancelled || status.state !== "granted") return;
        dispatch({ type: locateOnStart ? "RECENTER" : "SELF_REQUESTED" });
      })
      .catch(() => { /* No Permissions API: wait for an explicit request. */ });
    return () => { cancelled = true; };
    // First mount only: a later change of `locateOnStart` is not a new visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        dispatch({ type: "SELF_FIX", fix: { latitude: coords.latitude, longitude: coords.longitude, accuracyMeters: coords.accuracy, at: timestamp } });
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

  /* ── Boundary view (no basemap) ──────────────────────────────────────── */

  const [viewport, setViewport] = useState<Viewport>(START);
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (useGoogle || !canvasSize) return;
    const timer = window.setTimeout(() => {
      handlers.current.onView({ box: viewportBounds(viewport, canvasSize), zoom: viewport.zoom });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [useGoogle, viewport, canvasSize]);

  /* ── Camera: only in response to an explicit request ─────────────────── */

  const lastCameraRef = useRef(0);
  const request = exploration.camera;
  useEffect(() => {
    if (!request || request.seq <= lastCameraRef.current) return;
    let box: BBox | null = null;
    let point: GeoPoint | null = null;
    let minZoom = 9;
    if (request.target === "self") {
      // The device's own position moves the camera, and only the camera.
      if (self.status !== "live") return;
      point = self.fix;
      minZoom = 12;
    } else {
      // Hunt and zone targets are resolved by the page, which knows the geometry; wait for it.
      if (!camera || camera.seq !== request.seq || (!camera.box && !camera.point)) return;
      box = camera.box;
      point = camera.point;
      minZoom = camera.minZoom;
    }
    if (useGoogle) {
      if (!live) return;
      lastCameraRef.current = request.seq;
      if (box) live.showBox(box, padding());
      else if (point) live.showPoint(point, minZoom, padding());
      return;
    }
    if (!canvasSize) return;
    lastCameraRef.current = request.seq;
    if (box) {
      setViewport(fitViewport(box, canvasSize, padding()));
    } else if (point) {
      const at = point;
      setViewport((current) => ({ latitude: at.latitude, longitude: at.longitude, zoom: Math.max(current.zoom, Math.min(minZoom, 11)) }));
    }
  }, [request, camera, useGoogle, live, canvasSize, padding, self]);

  /* The boundary view frames the drawn zones once, until something is chosen. */
  const framedRef = useRef(false);
  useEffect(() => {
    if (useGoogle || framedRef.current || !canvasSize || !drawn.length || request) return;
    framedRef.current = true;
    let west = 180, east = -180, south = 90, north = -90;
    for (const zone of drawn) for (const ring of zone.piece.rings) for (const [lng, lat] of ring) {
      west = Math.min(west, lng); east = Math.max(east, lng); south = Math.min(south, lat); north = Math.max(north, lat);
    }
    if (west < east && south < north) setViewport(fitViewport({ west, south, east, north }, canvasSize, padding()));
  }, [useGoogle, canvasSize, drawn, request, padding]);

  const canvasFeatures = useMemo<ZoneFeature[]>(() => (useGoogle ? [] : drawn.map((zone) => ({
    layerId: zone.layerId,
    name: zone.name,
    label: zone.label,
    compactLabel: zone.compactLabel,
    accessibleLabel: zone.accessibleLabel,
    coverage: zone.coverage as ZoneFeature["coverage"],
    rings: zone.piece.rings,
    ...(zone.piece.labelPoint ? { labelPoint: zone.piece.labelPoint } : {}),
    ...(zone.piece.labelSpan ? { labelSpan: zone.piece.labelSpan } : {}),
  }))), [useGoogle, drawn]);

  const canvasLabels = useMemo<LabelSource[]>(() => (useGoogle ? [] : drawn.flatMap((zone) => {
    const { labelPoint, labelSpan } = zone.piece;
    const text = mapLabelFor(zone);
    if (!labelPoint || !labelSpan || !text) return [];
    const state = filterStates?.get(zone.key);
    const selected = zone.key === selectedKey || zone.key === huntKey;
    return [{
      key: zone.key, text, short: text, labelPoint, labelSpan,
      priority: selected ? 100 : zone.coverage === "VERIFIED" ? 2 : 1, selected,
      ...(state ? { glyph: EXPLORATION_WORDING[state].glyph, state } : {}),
    }];
  })), [useGoogle, drawn, filterStates, selectedKey, huntKey]);

  const zoneKeyOfFeature = useCallback((feature: ZoneFeature) => `${feature.layerId}|${feature.name.toUpperCase()}`, []);
  const selectedFeatureLabel = selectedKey ? drawn.find((zone) => zone.key === selectedKey)?.accessibleLabel ?? null : null;

  return (
    /* `data-zones` states how many official zones are on the map right now, for
       certification and monitoring: it must never fall to zero while the map moves. */
    <div className={styles.mapSurface} data-basemap={useGoogle ? (googleReady ? "google" : "loading") : "boundary"} data-zones={drawn.length}>
      {useGoogle ? (
        <div ref={containerRef} className={styles.mapCanvas} />
      ) : (
        <ZoneCanvas
          features={canvasFeatures}
          viewport={viewport}
          onViewportChange={(next) => {
            setViewport(next);
            if (pin?.mode === "centre") dispatch({ type: "PIN_CENTRE_MOVED", point: { latitude: next.latitude, longitude: next.longitude } });
          }}
          onResize={setCanvasSize}
          huntPoint={hunt}
          selfFix={self.status === "live" ? self.fix : null}
          previewPoint={pin?.mode === "pressed" ? pin.point : null}
          selectedZoneKey={selectedKey ?? huntKey}
          selectedZoneLabel={selectedFeatureLabel}
          labels={canvasLabels}
          filterStates={filterStates}
          zoneKeyOf={zoneKeyOfFeature}
          onZoneClick={(feature) => onZoneClick(zoneKeyOfFeature(feature), "map")}
          onEmptyClick={() => dispatch({ type: "MAP_TAPPED_EMPTY" })}
          onLongPress={(point) => dispatch({ type: "PIN_PRESSED", point })}
          overlays={overlays}
          onOverlayClick={(feature) => onOverlayClick(feature.layerId, feature.objectId)}
        />
      )}

      {/* The official zones as a picture until the live map has drawn them, lying exactly under where it will.
          A plain <img>: an SVG gains nothing from the image optimiser, and its fixed frame must not be resized. */}
      {poster ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className={styles.poster}
        src={poster}
        alt={POSTER_ALT}
        width={POSTER.width}
        height={POSTER.height}
        decoding="sync"
        draggable={false}
        data-hidden={(useGoogle ? googleReady && drawn.length > 0 : true) || undefined}
        style={{ transform: `translate(${-POSTER.centreX}px, ${-POSTER.centreY}px)` }}
        onError={(event) => { event.currentTarget.hidden = true; }}
      />
      ) : null}

      {pin?.mode === "centre" ? (
        <div className={styles.pinCrosshair} aria-hidden="true">
          <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
            <circle cx="22" cy="22" r="9" stroke="currentColor" strokeWidth="2" />
            <path d="M22 3v11M22 30v11M3 22h11M30 22h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      ) : null}

      {googleFailed ? (
        <p className={`${styles.mapNotice} ng-glass-overlay`} data-position="top" role="status">
          The basemap could not load. Official boundaries and every answer are unaffected.
        </p>
      ) : !useGoogle ? (
        <p className={`${styles.mapNotice} ng-glass-overlay`} data-position="top" data-compact="true">
          Boundary view · no basemap
        </p>
      ) : null}
    </div>
  );
}

export default memo(HuntMapView);
