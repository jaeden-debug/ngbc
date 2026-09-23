"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  boxesIntersect, boxKey, levelForZoom, lodSpec, requestBoxFor, ZoneGeometryStore,
  type BBox, type DrawnZone, type LodLevel, type SourceZoneFeature, type StoredZone,
} from "../../../lib/hunt/exploration/geometry-store";
import { mergeSimplified } from "../../../lib/hunt/exploration/geometry-notices";
import type { OverlayLayerDescriptor } from "../../../lib/hunt/exploration/overlay-layers";
import { OPENING_BOX, openingBoxFor, overviewUrl, SERVED_EXTENT } from "../../../lib/hunt/exploration/overview";
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

/*
 * One overview request per page, however often the component mounts: a
 * remount (fast refresh, a strict-mode double effect) shares the request in
 * flight instead of asking again. A failed answer is forgotten, so a retry
 * really asks again.
 */
let overviewInFlight: Promise<ZonesResponse> | null = null;
let overviewInFlightUrl: string | null = null;
function fetchOverview(url: string): Promise<ZonesResponse> {
  // One request per URL: the species is part of it, so two species never share one.
  if (!overviewInFlight || overviewInFlightUrl !== url) {
    overviewInFlightUrl = url;
    overviewInFlight = fetch(url)
      .then((response) => response.json() as Promise<ZonesResponse>)
      .then((payload) => {
        if (payload.status !== "OK") overviewInFlight = null;
        return payload;
      }, (error: unknown) => {
        overviewInFlight = null;
        throw error;
      });
  }
  return overviewInFlight;
}

function authorityOf(layerId: string): string {
  return SERVED.find((layer) => layer.id === layerId)?.authority ?? "The authority";
}

/**
 * Whether the ground a link's zone lives on has been asked for yet.
 *
 * "asking" and "unreachable" are both "we do not know"; only "answered" lets a
 * caller conclude anything about a zone it cannot find.
 */
export type NeededGround = "idle" | "asking" | "answered" | "unreachable";

const NEED_RETRY_MS = [1_500, 5_000, 15_000];

export function useZoneGeometry(view: MapView | null, speciesId?: string | null, need?: BBox | null) {
  const storeRef = useRef<ZoneGeometryStore | null>(null);
  if (!storeRef.current) storeRef.current = new ZoneGeometryStore({ isClippedLayer: (layerId) => CLIPPED.has(layerId) });
  const store = storeRef.current;

  const [version, setVersion] = useState(0);
  const [overview, setOverview] = useState<"loading" | "ready" | "failed">("loading");
  const [missingLayers, setMissingLayers] = useState<string[]>([]);
  const [simplifiedLayers, setSimplifiedLayers] = useState<string[]>([]);
  const speciesRef = useRef<string | null>(speciesId ?? null);
  /** When each box last answered, so a settled view does not ask again. */
  const answeredRef = useRef(new Map<string, number>());
  /** The boxes an answer has actually covered, newest last. */
  const askedBoxesRef = useRef<BBox[]>([]);
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
    try {
      /* What this screen opens on, not what the country is: the reference box
         is only what the page could preload without knowing the screen. */
      const opening = typeof window === "undefined"
        ? OPENING_BOX
        : openingBoxFor({ width: window.innerWidth, height: window.innerHeight });
      const payload = await fetchOverview(overviewUrl(speciesRef.current, opening));
      if (!aliveRef.current) return;
      if (payload.features?.length) store.apply(0, opening, seq, payload.features);
      askedBoxesRef.current = [...askedBoxesRef.current.slice(-11), opening];
      /* Recorded the way a detail request records itself, so the opening view
         is not asked for a second time by the level-0 path below. */
      answeredRef.current.set(`0|${boxKey(opening)}`, Date.now());
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

  /* Changing the species changes which geography is official, so the drawings
     are asked for again rather than left as another species' areas. */
  useEffect(() => {
    const next = speciesId ?? null;
    if (speciesRef.current === next) return;
    speciesRef.current = next;
    answeredRef.current.clear();
    failedRef.current.clear();
    askedBoxesRef.current = [];
    store.reset();
    setVersion(store.version);
    void loadOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speciesId]);

  /* ── Detail for the settled view ──────────────────────────────────────── */

  /** When each detail box last answered, so a settled view does not ask again. */
  const failedRef = useRef(new Map<string, number>());
  const inFlightRef = useRef(new Map<string, { controller: AbortController; box: BBox }>());
  /* A map nobody moves asks for nothing, so a failed request has to come back
     on its own; otherwise one transient outage is permanent on screen. */
  const detailRetryRef = useRef(0);
  const requestDetailRef = useRef<(level: LodLevel, box: BBox) => void>(() => {});
  const scheduleDetailRetry = useCallback((level: LodLevel, box: BBox) => {
    window.clearTimeout(detailRetryRef.current);
    detailRetryRef.current = window.setTimeout(() => {
      if (aliveRef.current) requestDetailRef.current(level, box);
    }, DETAIL_RETRY_MS + 250);
  }, []);

  const requestDetail = useCallback(async (level: LodLevel, box: BBox) => {
    const key = `${level}|${boxKey(box)}`;
    if (inFlightRef.current.has(key)) return;
    const answeredAt = answeredRef.current.get(key);
    if (answeredAt && Date.now() - answeredAt < ANSWERED_TTL_MS) return;
    const failedAt = failedRef.current.get(key);
    if (failedAt && Date.now() - failedAt < DETAIL_RETRY_MS) return;

    // A request for ground the view has left is no longer worth waiting for.
    for (const [otherKey, entry] of inFlightRef.current) {
      if (!boxesIntersect(entry.box, box)) {
        entry.controller.abort();
        inFlightRef.current.delete(otherKey);
      }
    }
    if (inFlightRef.current.size >= MAX_IN_FLIGHT) {
      const [oldest, entry] = inFlightRef.current.entries().next().value as [string, { controller: AbortController; box: BBox }];
      entry.controller.abort();
      inFlightRef.current.delete(oldest);
    }
    const controller = new AbortController();
    inFlightRef.current.set(key, { controller, box });
    const seq = store.nextSeq();
    try {
      /* A jurisdiction whose seasons are written in species geographies
         (Newfoundland's moose, caribou and bear areas) must be drawn in the
         geography of the species in hand, or the boundary under the answer is
         the wrong one. The species travels with every geometry request. */
      const species = speciesRef.current ? `&species=${encodeURIComponent(speciesRef.current)}` : "";
      const response = await fetch(`/api/hunt/zones?bounds=${boxKey(box)}&zoom=${lodSpec(level).requestZoom}${species}`, { signal: controller.signal });
      const payload = await response.json() as ZonesResponse;
      if (!aliveRef.current) return;
      if (payload.features?.length) store.apply(level, box, seq, payload.features);
      const failed = (payload.layers ?? []).filter((layer) => layer.status === "PROVIDER_ERROR").map((layer) => layer.id ?? "").filter(Boolean);
      if (payload.status === "OK" || payload.status === "EMPTY") {
        answeredRef.current.set(key, Date.now());
        askedBoxesRef.current = [...askedBoxesRef.current.slice(-11), box];
      }
      else failedRef.current.set(key, Date.now());
      // Per layer, from what this answer actually says about each one.
      setSimplifiedLayers((current) => mergeSimplified(current, payload.layers));
      setVersion(store.version);
      if (failed.length || !(payload.status === "OK" || payload.status === "EMPTY")) scheduleDetailRetry(level, box);
    } catch (error) {
      if ((error as Error).name === "AbortError" || !aliveRef.current) return;
      failedRef.current.set(key, Date.now());
      scheduleDetailRetry(level, box);
    } finally {
      inFlightRef.current.delete(key);
    }
  }, [store, scheduleDetailRetry]);
  useEffect(() => { requestDetailRef.current = (level, box) => { void requestDetail(level, box); }; }, [requestDetail]);

  useEffect(() => {
    if (!view) return;
    const level = levelForZoom(view.zoom);
    const box = requestBoxFor(view.box, level, SERVED_EXTENT);
    if (!box) return;
    /* Ground nothing has been asked about is not ground with no zones in it
       (§41B): panning past the boxes already answered has to ask, or the map
       draws an empty country it simply never requested. */
    const unasked = store.hasUnaskedGround(view.box, askedBoxesRef.current);
    const layerWithoutOverview = missingLayers.length > 0;
    if (!unasked && !layerWithoutOverview && overview === "ready" && !store.needsDetail(view.box, level)) return;
    const timer = window.setTimeout(() => { void requestDetail(level, box); }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [view, requestDetail, store, missingLayers, overview]);

  /* ── Ground a link needs, wherever the map happens to be looking ──────
   *
   * A link names a zone; the map opens on a viewport. Those are different
   * places, and a phone's opening viewport is a fraction of the country. Until
   * this was asked for, a link to a British Columbia unit opened on a phone,
   * failed to find the zone in what the phone had drawn, and told the hunter
   * it was "not one North Ground draws" — about a zone North Ground draws.
   * Not asked is not absent (§41A).
   */
  const [neededGround, setNeededGround] = useState<NeededGround>("idle");
  const needBox = useMemo(() => (need ? requestBoxFor(need, 0, SERVED_EXTENT) : null), [need]);
  const needKey = needBox ? boxKey(needBox) : null;
  useEffect(() => {
    if (!needBox || !needKey) { setNeededGround("idle"); return; }
    let cancelled = false;
    let attempt = 0;
    let timer = 0;
    setNeededGround("asking");
    const ask = async () => {
      await requestDetail(0, needBox);
      if (cancelled) return;
      if (answeredRef.current.has(`0|${needKey}`)) { setNeededGround("answered"); return; }
      // Already in flight, or the authority did not answer: look again, then stop.
      if (attempt >= NEED_RETRY_MS.length) { setNeededGround("unreachable"); return; }
      timer = window.setTimeout(() => { void ask(); }, NEED_RETRY_MS[attempt]);
      attempt += 1;
    };
    void ask();
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [needBox, needKey, requestDetail]);

  useEffect(() => () => {
    window.clearTimeout(detailRetryRef.current);
    for (const entry of inFlightRef.current.values()) entry.controller.abort();
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

  return { drawn, version, overview, notices, inView, zone, overlayLayers, neededGround, extent: SERVED_EXTENT };
}
