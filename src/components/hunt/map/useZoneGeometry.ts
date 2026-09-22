"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  boxKey, levelForZoom, lodSpec, requestBoxFor, ZoneGeometryStore,
  type BBox, type DrawnZone, type LodLevel, type SourceZoneFeature, type StoredZone,
} from "../../../lib/hunt/exploration/geometry-store";
import type { OverlayLayerDescriptor } from "../../../lib/hunt/exploration/overlay-layers";
import { ZONE_LAYERS } from "../../../lib/hunt/zone-layers";

/**
 * Official zone geometry for the map, as a store that only ever gains detail.
 *
 * The overview of every served zone is asked for once; finer drawings are asked
 * for when a view settles at a zoom that wants them. A failed request never
 * removes a drawing — the zone keeps the one it had — but it is never hidden
 * either: where an authority genuinely did not answer, the notice says so.
 */

const SERVED = ZONE_LAYERS.filter((layer) => layer.serving);
const SERVED_EXTENT: BBox = {
  west: Math.min(...SERVED.map((layer) => layer.bounds.minLongitude)),
  south: Math.min(...SERVED.map((layer) => layer.bounds.minLatitude)),
  east: Math.max(...SERVED.map((layer) => layer.bounds.maxLongitude)),
  north: Math.max(...SERVED.map((layer) => layer.bounds.maxLatitude)),
};
const CLIPPED = new Set(SERVED.filter((layer) => layer.mapGeometry === "stored").map((layer) => layer.id));
const RETRY_MS = [15_000, 45_000, 120_000];
const DETAIL_RETRY_MS = 60_000;
const ANSWERED_TTL_MS = 120_000;
const DEBOUNCE_MS = 220;
const MAX_IN_FLIGHT = 3;

interface ZonesResponse {
  status: "OK" | "EMPTY" | "PROVIDER_ERROR" | "PARTIAL" | "RATE_LIMITED" | "INVALID";
  message?: string;
  features?: SourceZoneFeature[];
  layers?: Array<{ id?: string; status: string; authority?: string; jurisdictionName?: string }>;
  overlays?: OverlayLayerDescriptor[];
}

export interface GeometryNotice {
  layerId: string;
  /** Overview failures mean the zones are not drawn; detail failures mean they are drawn simplified. */
  kind: "missing" | "simplified";
  message: string;
}

export interface MapView {
  box: BBox;
  zoom: number;
}

function authorityOf(layerId: string): string {
  return SERVED.find((layer) => layer.id === layerId)?.authority ?? "The authority";
}

export function useZoneGeometry(view: MapView | null) {
  const storeRef = useRef<ZoneGeometryStore | null>(null);
  if (!storeRef.current) storeRef.current = new ZoneGeometryStore({ isClippedLayer: (layerId) => CLIPPED.has(layerId) });
  const store = storeRef.current;

  const [version, setVersion] = useState(0);
  const [overview, setOverview] = useState<"loading" | "ready" | "failed">("loading");
  const [missingLayers, setMissingLayers] = useState<string[]>([]);
  const [simplifiedLayers, setSimplifiedLayers] = useState<string[]>([]);
  /** Special regulatory layers the authorities serve, from the overview's own answer. */
  const [overlayLayers, setOverlayLayers] = useState<OverlayLayerDescriptor[]>([]);

  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  /* ── The overview: every served zone, whole, once ─────────────────────── */

  const attemptRef = useRef(0);
  const loadOverview = useCallback(async () => {
    const seq = store.nextSeq();
    const bounds = boxKey(SERVED_EXTENT);
    try {
      const response = await fetch(`/api/hunt/zones?bounds=${bounds}&zoom=${lodSpec(0).requestZoom}`);
      const payload = await response.json() as ZonesResponse;
      if (!aliveRef.current) return;
      if (payload.features?.length) store.apply(0, SERVED_EXTENT, seq, payload.features);
      if (payload.overlays) setOverlayLayers(payload.overlays);
      const failed = (payload.layers ?? []).filter((layer) => layer.status === "PROVIDER_ERROR").map((layer) => layer.id ?? "");
      const answered = payload.status === "OK" || payload.status === "PARTIAL" || payload.status === "EMPTY";
      setMissingLayers(answered ? failed.filter(Boolean) : SERVED.map((layer) => layer.id));
      setOverview(payload.features?.length ? "ready" : "failed");
      setVersion(store.version);
      if (!answered || failed.length) scheduleRetry();
    } catch {
      if (!aliveRef.current) return;
      setOverview((current) => (current === "ready" ? current : "failed"));
      setMissingLayers(SERVED.map((layer) => layer.id).filter((id) => ![...store.all()].some((zone) => zone.layerId === id)));
      scheduleRetry();
    }
    // `scheduleRetry` is hoisted below and stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);

  const retryTimerRef = useRef(0);
  function scheduleRetry() {
    const attempt = attemptRef.current;
    if (attempt >= RETRY_MS.length) return;
    attemptRef.current = attempt + 1;
    window.clearTimeout(retryTimerRef.current);
    retryTimerRef.current = window.setTimeout(() => { void loadOverview(); }, RETRY_MS[attempt]);
  }

  useEffect(() => {
    void loadOverview();
    return () => window.clearTimeout(retryTimerRef.current);
  }, [loadOverview]);

  /* ── Detail for the settled view ──────────────────────────────────────── */

  /** When each detail box last answered, so a settled view does not ask again. */
  const answeredRef = useRef(new Map<string, number>());
  const failedRef = useRef(new Map<string, number>());
  const inFlightRef = useRef(new Map<string, AbortController>());

  const requestDetail = useCallback(async (level: LodLevel, box: BBox) => {
    const key = `${level}|${boxKey(box)}`;
    if (inFlightRef.current.has(key)) return;
    const answeredAt = answeredRef.current.get(key);
    if (answeredAt && Date.now() - answeredAt < ANSWERED_TTL_MS) return;
    const failedAt = failedRef.current.get(key);
    if (failedAt && Date.now() - failedAt < DETAIL_RETRY_MS) return;

    // A view that has moved on does not need every request it started.
    if (inFlightRef.current.size >= MAX_IN_FLIGHT) {
      const [oldest, controller] = inFlightRef.current.entries().next().value as [string, AbortController];
      controller.abort();
      inFlightRef.current.delete(oldest);
    }
    const controller = new AbortController();
    inFlightRef.current.set(key, controller);
    const seq = store.nextSeq();
    try {
      const response = await fetch(`/api/hunt/zones?bounds=${boxKey(box)}&zoom=${lodSpec(level).requestZoom}`, { signal: controller.signal });
      const payload = await response.json() as ZonesResponse;
      if (!aliveRef.current) return;
      if (payload.features?.length) store.apply(level, box, seq, payload.features);
      const failed = (payload.layers ?? []).filter((layer) => layer.status === "PROVIDER_ERROR").map((layer) => layer.id ?? "").filter(Boolean);
      if (payload.status === "OK" || payload.status === "EMPTY") answeredRef.current.set(key, Date.now());
      else failedRef.current.set(key, Date.now());
      setSimplifiedLayers(failed);
      setVersion(store.version);
    } catch (error) {
      if ((error as Error).name === "AbortError" || !aliveRef.current) return;
      failedRef.current.set(key, Date.now());
    } finally {
      inFlightRef.current.delete(key);
    }
  }, [store]);

  useEffect(() => {
    if (!view) return;
    const level = levelForZoom(view.zoom);
    if (level === 0) {
      setSimplifiedLayers([]);
      return;
    }
    const box = requestBoxFor(view.box, level, SERVED_EXTENT);
    if (!box) return;
    // Nothing to ask when every zone in view already has a drawing at this level.
    const layerWithoutOverview = missingLayers.length > 0;
    if (!layerWithoutOverview && overview === "ready" && !store.needsDetail(view.box, level)) return;
    const timer = window.setTimeout(() => { void requestDetail(level, box); }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [view, requestDetail, store, missingLayers, overview]);

  useEffect(() => () => {
    for (const controller of inFlightRef.current.values()) controller.abort();
  }, []);

  /* ── What to draw now ─────────────────────────────────────────────────── */

  const drawn = useMemo<DrawnZone[]>(() => {
    const box = view?.box ?? SERVED_EXTENT;
    return store.drawn(box, view ? levelForZoom(view.zoom) : 0);
    // `version` stands for the store's contents.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, version, view]);

  const inView = useCallback((box: BBox): StoredZone[] => store.inView(box), [store]);
  const zone = useCallback((key: string): StoredZone | undefined => store.get(key), [store]);

  const notices = useMemo<GeometryNotice[]>(() => [
    ...missingLayers.map((layerId) => ({
      layerId, kind: "missing" as const,
      message: `${authorityOf(layerId)}'s zone service is not answering, so its zones are not drawn. North Ground will not draw an approximate boundary.`,
    })),
    ...simplifiedLayers.filter((layerId) => !missingLayers.includes(layerId)).map((layerId) => ({
      layerId, kind: "simplified" as const,
      message: `${authorityOf(layerId)}'s detailed boundaries did not load for this view. Its simplified official boundaries are shown.`,
    })),
  ], [missingLayers, simplifiedLayers]);

  return { drawn, version, overview, notices, inView, zone, overlayLayers, extent: SERVED_EXTENT };
}
