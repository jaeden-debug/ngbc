"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { CanonicalId } from "../../lib/content-contract";
import { hasSpeciesCoverageIn, type SpeciesSelectorOption } from "../../lib/hunt/coverage";
import { todayIso } from "../../lib/hunt/date";
import { dateChipLabel, longDayLabel } from "../../lib/hunt/exploration/date-presets";
import { zoneKeyOf, type BBox } from "../../lib/hunt/exploration/geometry-store";
import { evaluateRequestBody } from "../../lib/hunt/answer-payload";
import { currentResult, evaluationKey, huntSessionReducer, initialSession } from "../../lib/hunt/exploration/hunt-session";
import { explorationReducer, INITIAL_EXPLORATION, roundedPoint, type ExplorationEvent } from "../../lib/hunt/exploration/map-state";
import type { OverlayFeature } from "../../lib/hunt/exploration/overlay-layers";
import { huntSharePayload, shareHunt } from "../../lib/hunt/exploration/share";
import { heightOf, mapBottomFor, sheetHeights, type SheetHeights, type SheetSnap } from "../../lib/hunt/exploration/sheet";
import { EXPLORATION_WORDING, type ExplorationState as ZoneState, type ZoneRef } from "../../lib/hunt/exploration/states";
import { serializeHuntUrlState, zoneRefFromId, type HuntUrlState } from "../../lib/hunt/exploration/url-state";
import type { HuntEvaluation } from "../../lib/hunt/types";
import { layerById, zoneIdFor, ZONE_LAYERS } from "../../lib/hunt/zone-layers";
import { presentZone } from "../../lib/hunt/zone-presentation";
import HuntMapView, { type CameraRequest } from "./HuntMapView";
import HuntSheet from "./HuntSheet";
import type { Padding } from "./map/GoogleZoneMap";
import { useZoneGeometry, type MapView } from "./map/useZoneGeometry";
import HuntAnswer, { statusWord } from "./sheet/HuntAnswer";
import type { ChosenPlace } from "./sheet/SearchPage";
import { InSeasonHere, StateChip, ZoneSpeciesAnswer, ZoneSummaryDetail, type SummaryLoad } from "./sheet/ZoneContext";
import styles from "./HuntApp.module.css";

/* Pages open on demand, so each is its own chunk; they are fetched once the
   map is up (see below) so a tap never waits on the network. */
const pageLoading = () => <p className={styles.answerLoading} role="status"><span className={styles.spinner} aria-hidden="true" /> Loading…</p>;
const loadSearch = () => import("./sheet/SearchPage");
const loadSpecies = () => import("./sheet/SpeciesPage");
const loadDate = () => import("./sheet/DatePage");
const loadLayers = () => import("./sheet/LayersPage");
const loadZones = () => import("./sheet/ZonesPage");
const SearchPage = dynamic(loadSearch, { ssr: false, loading: pageLoading });
const SpeciesPage = dynamic(loadSpecies, { ssr: false, loading: pageLoading });
const DatePage = dynamic(loadDate, { ssr: false, loading: pageLoading });
const LayersPage = dynamic(loadLayers, { ssr: false, loading: pageLoading });
const ZonesPage = dynamic(loadZones, { ssr: false, loading: pageLoading });

/**
 * North Ground Hunt: the map is the application.
 *
 * Location, species and date are the question; the answer assembles as each
 * arrives, with no submit. A place resolves its official zone. A zone says
 * what the certified rules say across it. A species and a day at an exact
 * spot ask the regulatory engine, automatically, and the answer shown is only
 * ever the answer to the question currently on screen.
 *
 * Three locations stay separate: the device's own position (the blue dot,
 * watched only inside the map view and never sent anywhere), the hunt location
 * (set only by a search result, a confirmed pin or "Use my location"), and a
 * licence-vendor search inside Ready to Hunt. Only the hunt location resolves a
 * zone, is evaluated or reaches a share.
 */

type Page = "main" | "search" | "species" | "date" | "layers" | "zones";

type HuntZone =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "resolved"; ref: ZoneRef; nearBoundary: boolean; boundaryDistanceMeters?: number }
  | { kind: "unresolved"; message: string };

type LocateState = { kind: "idle" } | { kind: "locating" } | { kind: "error"; message: string };

type PinZone = { kind: "loading" } | { kind: "resolved"; label: string; jurisdiction: string } | { kind: "none"; message: string };

const SERVED = ZONE_LAYERS.filter((layer) => layer.serving);
const LOCATE_MESSAGES: Record<number, string> = {
  1: "Location is off for this site. Search for a place instead — the answer is the same.",
  2: "Your device could not find its location. Search for a place instead.",
  3: "Finding your location took too long. Try again, or search for a place.",
};
const RESULT_TTL_MS = 5 * 60 * 1000;

function subscribeMedia(query: string) {
  return (notify: () => void) => {
    const list = window.matchMedia(query);
    list.addEventListener("change", notify);
    return () => list.removeEventListener("change", notify);
  };
}

function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(subscribeMedia(query), () => window.matchMedia(query).matches, () => false);
}

const PANEL_QUERY = "(min-width: 700px), (min-width: 560px) and (orientation: landscape)";

export interface HuntAppProps {
  googleMapsApiKey?: string;
  speciesOptions: SpeciesSelectorOption[];
  /** The day to start from: the link's day if it named one, else the jurisdiction's today. */
  initialDate: string;
  initialUrl: HuntUrlState;
  /** Parameters in the link that were not understood, so the page can say so. */
  linkIssues: number;
  /** Server-rendered explanation of what Hunt is and covers. */
  about: ReactNode;
  /** The official zones drawn for the opening camera, as a data URI, when the server has it ready. */
  poster: string | null;
}

export default function HuntApp({ googleMapsApiKey, speciesOptions, initialDate, initialUrl, linkIssues, about, poster }: HuntAppProps) {
  const [exploration, dispatchMap] = useReducer(explorationReducer, INITIAL_EXPLORATION);
  const [session, dispatchSession] = useReducer(huntSessionReducer, undefined, () => initialSession({
    speciesId: initialUrl.speciesId, date: initialDate, dateExplicit: Boolean(initialUrl.date), explore: initialUrl.explore,
  }));
  const hunt = exploration.hunt;
  const selection = exploration.selection;

  const layout = useMediaQuery(PANEL_QUERY) ? "panel" : "sheet";
  const [page, setPage] = useState<Page>("main");
  const [snap, setSnap] = useState<SheetSnap>(initialUrl.zoneId ? "half" : "peek");
  const [heights, setHeights] = useState<SheetHeights | null>(null);
  const [view, setView] = useState<MapView | null>(null);
  const [basemap, setBasemap] = useState<"loading" | "ready" | "fallback">("loading");
  const [mapMode, setMapMode] = useState<"terrain" | "hybrid">("terrain");
  const [huntZone, setHuntZone] = useState<HuntZone>({ kind: "idle" });
  const [locate, setLocate] = useState<LocateState>({ kind: "idle" });
  const [deviceToday, setDeviceToday] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [linkNotice, setLinkNotice] = useState<string | null>(linkIssues ? "Part of this link could not be read, so only what it named clearly is shown." : null);

  const rootRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const safeProbeRef = useRef<HTMLDivElement>(null);
  const previousSnapRef = useRef<SheetSnap>("peek");

  const geometry = useZoneGeometry(view);

  /* Warm the on-demand pages once the browser is idle after the first paint. */
  useEffect(() => {
    const warm = () => { void loadSearch(); void loadSpecies(); void loadDate(); void import("./sheet/AnswerDetail"); };
    const idle = (window as Window & { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number }).requestIdleCallback;
    if (idle) idle(warm, { timeout: 4_000 });
    else window.setTimeout(warm, 2_500);
  }, []);

  /* ── The device's own calendar day, once mounted ──────────────────────── */

  useEffect(() => {
    const today = todayIso();
    setDeviceToday(today);
    dispatchSession({ type: "DEFAULT_DATE_CORRECTED", iso: today });
  }, []);

  /* The shell never scrolls. Browsers without `overflow: clip` can still
     scroll a hidden overflow to reveal a focused control; undo that at once. */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reset = () => { if (root.scrollTop || root.scrollLeft) root.scrollTo(0, 0); };
    root.addEventListener("scroll", reset);
    return () => root.removeEventListener("scroll", reset);
  }, []);

  /* ── Sheet geometry: measured, never assumed ─────────────────────────── */

  useEffect(() => {
    const measure = () => {
      const headerBottom = headerRef.current?.getBoundingClientRect().bottom ?? 60;
      const safeBottom = safeProbeRef.current?.getBoundingClientRect().height ?? 0;
      setHeights(sheetHeights({ viewportHeight: window.innerHeight, headerBottom, safeBottom }));
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, []);

  /* The map is sized to what the sheet leaves, so the sheet never covers its
     attribution. Lowering the sheet grows the map at once; raising it shrinks
     the map only once the sheet has risen over that ground, so no gap opens. */
  const targetMapBottom = heights && layout === "sheet" ? mapBottomFor(snap, heights) : null;
  const [mapBottom, setMapBottom] = useState<number | null>(null);
  useEffect(() => {
    if (targetMapBottom === null || mapBottom === null || targetMapBottom <= mapBottom) {
      setMapBottom(targetMapBottom);
      return;
    }
    const timer = window.setTimeout(() => setMapBottom(targetMapBottom), 300);
    return () => window.clearTimeout(timer);
    // Only a new target schedules a change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetMapBottom]);

  const rootStyle = useMemo(() => {
    if (!heights || layout !== "sheet") return undefined;
    return {
      "--sheet-peek": `${heights.peek}px`,
      "--sheet-half": `${heights.half}px`,
      "--sheet-full": `${heights.full}px`,
      "--sheet-h": `${heightOf(snap, heights)}px`,
      ...(mapBottom !== null ? { "--map-bottom": `${mapBottom}px` } : {}),
    } as React.CSSProperties;
  }, [heights, layout, snap, mapBottom]);

  /* ── Selection, zones, presentation ──────────────────────────────────── */

  const selectedRef = selection.kind === "zone" ? selection.zone : null;
  const selectedKey = selectedRef ? zoneKeyOf(selectedRef) : null;
  const huntRef = exploration.huntZone;
  const huntKey = huntRef ? zoneKeyOf(huntRef) : null;
  const isHuntZone = Boolean(selectedKey && selectedKey === huntKey);
  const selectedLayer = selectedRef ? layerById(selectedRef.layerId) ?? null : null;
  const presented = useMemo(() => selectedRef && selectedLayer
    ? presentZone({ designation: selectedRef.designation, layerId: selectedLayer.id, zoneId: zoneIdFor(selectedLayer, selectedRef.designation) })
    : null, [selectedRef, selectedLayer]);
  const selectedZoneId = selectedRef && selectedLayer ? zoneIdFor(selectedLayer, selectedRef.designation) : null;
  const storedSelected = selectedKey ? geometry.zone(selectedKey) : undefined;

  const species = speciesOptions.find((option) => option.id === session.speciesId) ?? null;
  const speciesCertifiedHere = species && selectedLayer ? hasSpeciesCoverageIn(species, selectedLayer.jurisdictionId) : false;
  const explorable = useMemo(() => speciesOptions.filter((option) => option.regulatoryJurisdictions.length > 0), [speciesOptions]);

  /* ── Hunt location → official zone ───────────────────────────────────── */

  const zoneRequestRef = useRef(0);
  useEffect(() => {
    dispatchSession({ type: "LOCATION_CHANGED" });
    if (!hunt) {
      setHuntZone({ kind: "idle" });
      return;
    }
    const id = ++zoneRequestRef.current;
    setHuntZone({ kind: "loading" });
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/hunt/zone", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ latitude: hunt.latitude, longitude: hunt.longitude }),
          signal: controller.signal,
        });
        const payload = await response.json() as {
          status: string; message?: string;
          zone?: { layerId?: string; designation?: string; nearBoundary?: boolean; boundaryDistanceMeters?: number };
        };
        if (id !== zoneRequestRef.current) return;
        if (payload.status === "RESOLVED" && payload.zone?.layerId && payload.zone.designation) {
          const ref = { layerId: payload.zone.layerId, designation: payload.zone.designation };
          setHuntZone({ kind: "resolved", ref, nearBoundary: Boolean(payload.zone.nearBoundary), boundaryDistanceMeters: payload.zone.boundaryDistanceMeters });
          dispatchMap({ type: "HUNT_ZONE_RESOLVED", zone: ref });
          return;
        }
        setHuntZone({ kind: "unresolved", message: payload.message ?? "No official hunting zone could be found for this spot." });
      } catch (error) {
        if ((error as Error).name === "AbortError" || id !== zoneRequestRef.current) return;
        setHuntZone({ kind: "unresolved", message: "The official zone service could not be reached. North Ground will not guess a zone." });
      }
    })();
    return () => controller.abort();
    // Keyed on the point: a better label for the same point does not re-resolve it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hunt?.latitude, hunt?.longitude]);

  /** A place name for a point, where the geocoder has one. Never blocks the point itself. */
  const describePoint = useCallback(async (latitude: number, longitude: number): Promise<string | null> => {
    try {
      const response = await fetch("/api/hunt/location", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "describe", latitude, longitude }),
      });
      const payload = await response.json() as { status?: string; place?: { label: string } };
      return payload.status === "OK" && payload.place?.label ? payload.place.label : null;
    } catch {
      return null;
    }
  }, []);

  /* ── Pages and the sheet ─────────────────────────────────────────────── */

  const openPage = useCallback((next: Page) => {
    if (next !== "main" && page === "main") previousSnapRef.current = snap;
    setPage(next);
    if (next !== "main") setSnap("full");
  }, [page, snap]);

  const closePage = useCallback(() => {
    setPage("main");
    setSnap(previousSnapRef.current === "full" ? "half" : previousSnapRef.current);
  }, []);

  /* ── Choosing a hunt location ────────────────────────────────────────── */

  const chooseSearchResult = useCallback((place: ChosenPlace) => {
    dispatchMap({ type: "HUNT_SET", location: { label: place.label, latitude: place.latitude, longitude: place.longitude, origin: "search" } });
    setLocate({ kind: "idle" });
    setPage("main");
    setSnap("half");
  }, []);

  const useMyLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setLocate({ kind: "error", message: "This browser does not share location. Search for a place instead." });
      return;
    }
    if (!window.isSecureContext) {
      setLocate({ kind: "error", message: "Location needs a secure connection. Search for a place instead." });
      return;
    }
    setLocate({ kind: "locating" });
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const point = roundedPoint({ latitude: coords.latitude, longitude: coords.longitude });
        // An explicit act: the device's position at this moment becomes the hunt location.
        dispatchMap({ type: "HUNT_SET", location: { ...point, label: "Your location", origin: "device" } });
        // Permission is now held, so the live dot can follow without asking again.
        dispatchMap({ type: "SELF_REQUESTED" });
        setLocate(coords.accuracy > 1_000
          ? { kind: "error", message: `Your device placed you within about ${(coords.accuracy / 1000).toFixed(1)} km. Near a boundary, check the zone on the map.` }
          : { kind: "idle" });
        setPage("main");
        setSnap("half");
        void describePoint(point.latitude, point.longitude).then((label) => {
          if (label) dispatchMap({ type: "HUNT_LABELLED", point, label: `Near ${label}` });
        });
      },
      (error) => setLocate({ kind: "error", message: LOCATE_MESSAGES[error.code] ?? "Your location was unavailable. Search for a place instead." }),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  }, [describePoint]);

  const chooseOnMap = useCallback(() => {
    setPage("main");
    setSnap("peek");
    dispatchMap({ type: "PIN_CENTRE_STARTED", point: view ? { latitude: (view.box.north + view.box.south) / 2, longitude: (view.box.east + view.box.west) / 2 } : { latitude: 50, longitude: -85 } });
  }, [view]);

  const confirmPin = useCallback(() => {
    const pin = exploration.pin;
    if (!pin) return;
    const point = roundedPoint(pin.point);
    dispatchMap({ type: "PIN_CONFIRMED", label: "Spot chosen on the map" });
    setSnap("half");
    void describePoint(point.latitude, point.longitude).then((label) => {
      if (label) dispatchMap({ type: "HUNT_LABELLED", point, label: `Near ${label}` });
    });
  }, [exploration.pin, describePoint]);

  /* ── Pin preview: which zone would this point be in? ─────────────────── */

  const [pinZone, setPinZone] = useState<PinZone>({ kind: "loading" });
  const pin = exploration.pin;
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
          const payload = await response.json() as { status: string; message?: string; zone?: { layerId?: string; designation?: string }; layer?: { jurisdictionName: string } };
          if (payload.status === "RESOLVED" && payload.zone?.designation) {
            const label = presentZone({ designation: payload.zone.designation, layerId: payload.zone.layerId }).fullLabel;
            setPinZone({ kind: "resolved", label, jurisdiction: payload.layer?.jurisdictionName ?? "" });
          } else {
            setPinZone({ kind: "none", message: payload.message ?? "No official hunting zone could be found for this spot." });
          }
        })
        .catch(() => { if (!controller.signal.aborted) setPinZone({ kind: "none", message: "The official zone service could not be reached." }); });
    }, pin.mode === "centre" ? 450 : 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [pin]);

  useEffect(() => {
    if (pin) setSnap((current) => (current === "full" ? "half" : current === "peek" && pin.mode === "pressed" ? "half" : current));
  }, [pin]);

  /* ── Deep link: select the zone it names, once the geometry confirms it exists ── */

  const [linkZone, setLinkZone] = useState<{ ref: ZoneRef; status: "pending" | "done" | "missing" } | null>(() => {
    const ref = initialUrl.zoneId ? zoneRefFromId(initialUrl.zoneId, SERVED) : null;
    return ref ? { ref, status: "pending" } : null;
  });

  useEffect(() => {
    if (!linkZone || linkZone.status !== "pending") return;
    const key = zoneKeyOf(linkZone.ref);
    if (geometry.zone(key)) {
      dispatchMap({ type: "ZONE_SELECTED", zone: linkZone.ref, origin: "link" });
      setLinkZone({ ...linkZone, status: "done" });
      setSnap("half");
      return;
    }
    const layerMissing = geometry.notices.some((notice) => notice.layerId === linkZone.ref.layerId && notice.kind === "missing");
    if (geometry.overview === "ready" && !layerMissing) {
      setLinkZone({ ...linkZone, status: "missing" });
      setLinkNotice("The zone in this link is not one North Ground draws, so the link opened on the map instead.");
    }
  }, [linkZone, geometry]);

  /* ── The URL follows the hunt's context (never a coordinate) ─────────── */

  useEffect(() => {
    if (linkZone?.status === "pending") return; // not yet: the link's zone has not been read
    const state: HuntUrlState = {
      zoneId: selectedZoneId as CanonicalId<"management_zone"> | null,
      speciesId: session.speciesId,
      date: session.date.explicit ? session.date.iso : null,
      explore: session.explore,
    };
    const query = serializeHuntUrlState(state);
    const next = query ? `/hunt?${query}` : "/hunt";
    if (`${window.location.pathname}${window.location.search}` !== next) {
      window.history.replaceState(window.history.state, "", next);
    }
  }, [linkZone, selectedZoneId, session.speciesId, session.date, session.explore]);

  /* ── Zone summary: what the certified rules say across the zone ──────── */

  const summaryCacheRef = useRef(new Map<string, SummaryLoad & { kind: "ready" }>());
  const [summary, setSummary] = useState<SummaryLoad | null>(null);
  useEffect(() => {
    if (!selectedRef) {
      setSummary(null);
      return;
    }
    const cacheKey = `${zoneKeyOf(selectedRef)}|${session.date.iso}`;
    const cached = summaryCacheRef.current.get(cacheKey);
    if (cached) {
      setSummary(cached);
      return;
    }
    const controller = new AbortController();
    setSummary({ kind: "loading" });
    fetch(`/api/hunt/zone-summary?${new URLSearchParams({ layer: selectedRef.layerId, zone: selectedRef.designation, date: session.date.iso })}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as { status: string; summary?: import("../../lib/hunt/exploration/states").ZoneSummary; message?: string };
        if (payload.status !== "OK" || !payload.summary) throw new Error(payload.message ?? "This zone could not be summarised.");
        const ready = { kind: "ready" as const, summary: payload.summary };
        summaryCacheRef.current.set(cacheKey, ready);
        setSummary(ready);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setSummary({ kind: "error", message: `${error instanceof Error ? error.message : "This zone could not be summarised."} North Ground will not infer what applies.` });
      });
    return () => controller.abort();
  }, [selectedRef, session.date.iso]);

  const zoneStates = useMemo(() => summary?.kind === "ready"
    ? new Map(summary.summary.species.map((entry) => [entry.speciesId as string, entry.state]))
    : null, [summary]);

  /* ── The point-level evaluation, automatic, with stale answers dropped ── */

  const pointForEvaluation = isHuntZone && hunt && huntZone.kind === "resolved" ? hunt : null;
  const evalKey = pointForEvaluation && species && speciesCertifiedHere
    ? evaluationKey({ point: pointForEvaluation, speciesId: species.id, date: session.date.iso, answers: session.answers })
    : null;
  const resultCacheRef = useRef(new Map<string, { at: number; result: HuntEvaluation }>());
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!evalKey || !pointForEvaluation || !species) return;
    const cached = resultCacheRef.current.get(evalKey);
    if (cached && Date.now() - cached.at < RESULT_TTL_MS) {
      dispatchSession({ type: "EVALUATION_STARTED", key: evalKey });
      dispatchSession({ type: "EVALUATION_SUCCEEDED", key: evalKey, result: cached.result });
      return;
    }
    const controller = new AbortController();
    dispatchSession({ type: "EVALUATION_STARTED", key: evalKey });
    const key = evalKey;
    // Answers travel in the shape the endpoint accepts (animal classes as a list), from the one shared converter.
    const body = JSON.stringify(evaluateRequestBody({
      latitude: pointForEvaluation.latitude,
      longitude: pointForEvaluation.longitude,
      date: session.date.iso,
      speciesId: species.id,
    }, session.answers));
    // Coalesces a burst of changes (species, then date) into one request.
    const timer = window.setTimeout(() => {
      fetch("/api/hunt/evaluate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        signal: controller.signal,
      })
        .then(async (response) => {
          const payload = await response.json() as HuntEvaluation | { error: string };
          if (!response.ok || "error" in payload) throw new Error("error" in payload ? payload.error : "The hunt could not be checked.");
          resultCacheRef.current.set(key, { at: Date.now(), result: payload });
          dispatchSession({ type: "EVALUATION_SUCCEEDED", key, result: payload });
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          dispatchSession({ type: "EVALUATION_FAILED", key, message: error instanceof Error ? error.message : "The hunt could not be checked." });
        });
    }, 120);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
    // `evalKey` stands for the point, species, date and answers together.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evalKey, retryCount]);

  const result = currentResult(session, evalKey);

  /* A question is the next step, so it is shown whole: the sheet rises for each
     new question the engine asks, never for anything else. */
  const questionId = result?.completeness === "NEEDS_INPUT" ? result.required?.id ?? null : null;
  useEffect(() => {
    if (questionId && layout === "sheet") setSnap("full");
  }, [questionId, layout]);
  const answered = useMemo(() => {
    const dimensions = result?.dimensions ?? (session.evaluation.kind === "ready" ? session.evaluation.result.dimensions : []);
    return dimensions.flatMap((dimension) => {
      const option = dimension.options.find((candidate) => candidate.value === session.answers[dimension.id]);
      return option ? [{ question: dimension.question, answer: option.label }] : [];
    });
  }, [result, session.evaluation, session.answers]);

  /* ── Explore: the chosen species' status across the zones in view ────── */

  const exploreSpecies = session.explore && species && species.regulatoryJurisdictions.length ? species : null;
  const [filterStates, setFilterStates] = useState<Map<string, ZoneState> | null>(null);
  const filterCacheRef = useRef(new Map<string, ZoneState>());
  const zonesInView = useMemo(() => (view ? geometry.inView(view.box) : []),
    // `geometry.version` stands for the store's contents.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [view, geometry.version]);
  const inViewKey = useMemo(() => zonesInView.map((zone) => zone.key).sort().join(","), [zonesInView]);

  useEffect(() => {
    if (!exploreSpecies) {
      setFilterStates(null);
      return;
    }
    const prefix = `${exploreSpecies.id}|${session.date.iso}|`;
    const known = new Map<string, ZoneState>();
    const missing: ZoneRef[] = [];
    for (const zone of zonesInView) {
      const cached = filterCacheRef.current.get(prefix + zone.key);
      if (cached) known.set(zone.key, cached);
      else missing.push({ layerId: zone.layerId, designation: zone.name });
    }
    setFilterStates(known);
    if (!missing.length) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch("/api/hunt/zone-status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ speciesId: exploreSpecies.id, date: session.date.iso, zones: missing.slice(0, 450) }),
        signal: controller.signal,
      })
        .then(async (response) => {
          const payload = await response.json() as { status: string; states?: Array<ZoneRef & { state: ZoneState }> };
          if (payload.status !== "OK" || !payload.states) throw new Error("status unavailable");
          const next = new Map(known);
          for (const entry of payload.states) {
            const key = zoneKeyOf(entry);
            filterCacheRef.current.set(prefix + key, entry.state);
            next.set(key, entry.state);
          }
          setFilterStates(next);
        })
        .catch(() => { /* A zone without a state stays unfilled: no state is ever guessed. */ });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
    // `inViewKey` stands for `zonesInView`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exploreSpecies, session.date.iso, inViewKey]);

  /* ── Special areas, only when switched on ────────────────────────────── */

  const [overlaysOn, setOverlaysOn] = useState<string[]>([]);
  const [overlayFeatures, setOverlayFeatures] = useState<OverlayFeature[]>([]);
  const [overlayNotice, setOverlayNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!overlaysOn.length || !view) {
      if (!overlaysOn.length) setOverlayFeatures([]);
      return;
    }
    const controller = new AbortController();
    const bounds = [view.box.west, view.box.south, view.box.east, view.box.north].map((value) => value.toFixed(3)).join(",");
    const failures: string[] = [];
    const timer = window.setTimeout(() => {
      Promise.all(overlaysOn.map(async (id) => {
        try {
          const response = await fetch(`/api/hunt/overlays?${new URLSearchParams({ layer: id, bounds, zoom: String(Math.round(view.zoom)) })}`, { signal: controller.signal });
          const payload = await response.json() as { status: string; message?: string; features?: OverlayFeature[] };
          if (payload.status === "PROVIDER_ERROR" && payload.message) failures.push(payload.message);
          return payload.features ?? [];
        } catch {
          return [] as OverlayFeature[];
        }
      })).then((lists) => {
        if (controller.signal.aborted) return;
        setOverlayFeatures(lists.flat());
        setOverlayNotice(failures.length ? failures.join(" ") : null);
      });
    }, 220);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [overlaysOn, view]);

  const overlayLayersInView = useMemo(() => geometry.overlayLayers.filter((layer) => !view ||
    (view.box.west <= layer.extent.east && view.box.east >= layer.extent.west && view.box.south <= layer.extent.north && view.box.north >= layer.extent.south)),
  [geometry.overlayLayers, view]);
  const selectedOverlay = selection.kind === "overlay"
    ? overlayFeatures.find((feature) => feature.layerId === selection.layerId && feature.objectId === selection.objectId) ?? null
    : null;

  /* ── Camera requests the page can resolve (zone and hunt) ────────────── */

  const camera = exploration.camera;
  const cameraRequest = useMemo<CameraRequest | null>(() => {
    if (!camera || camera.target === "self") return null;
    if (camera.target === "hunt") return hunt ? { seq: camera.seq, box: null, point: hunt, minZoom: 9 } : null;
    if (selection.kind !== "zone") return null;
    const extent = geometry.zone(zoneKeyOf(selection.zone))?.extent ?? null;
    let box: BBox | null = extent;
    if (box && isHuntZone && hunt) {
      box = {
        west: Math.min(box.west, hunt.longitude), east: Math.max(box.east, hunt.longitude),
        south: Math.min(box.south, hunt.latitude), north: Math.max(box.north, hunt.latitude),
      };
    }
    return { seq: camera.seq, box, point: box ? null : isHuntZone ? hunt : null, minZoom: 9 };
    // `geometry.version` stands for the store's contents.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, hunt, selection, isHuntZone, geometry.version]);

  const padding = useCallback((): Padding => {
    if (layout === "panel") {
      const panel = rootRef.current?.querySelector("[data-layout='panel']")?.getBoundingClientRect();
      return { top: 24, right: 72, bottom: 48, left: Math.round((panel?.right ?? 420) + 24) };
    }
    const header = headerRef.current?.getBoundingClientRect().bottom ?? 60;
    return { top: Math.round(header + 12), right: 64, bottom: 24, left: 20 };
  }, [layout]);

  /* ── Selecting a zone from the map or the list ───────────────────────── */

  const selectZone = useCallback((key: string, origin: "map" | "list") => {
    const zone = geometry.zone(key);
    if (!zone) return;
    dispatchMap({ type: "ZONE_SELECTED", zone: { layerId: zone.layerId, designation: zone.name }, origin });
    setPage("main");
    setSnap((current) => (layout === "sheet" && current === "peek" ? "half" : current === "full" ? "half" : current));
  }, [geometry, layout]);

  const onOverlayClick = useCallback((layerId: string, objectId: number) => {
    dispatchMap({ type: "OVERLAY_SELECTED", layerId, objectId });
    setSnap((current) => (current === "peek" ? "half" : current));
  }, []);

  /* A plain tap on empty map lowers the sheet with whatever it closed. */
  const mapDispatch = useCallback((event: ExplorationEvent) => {
    dispatchMap(event);
    if (event.type === "MAP_TAPPED_EMPTY") {
      setPage("main");
      setSnap("peek");
    }
  }, []);

  /* ── Announcements for assistive technology ──────────────────────────── */

  const zoneLabel = presented?.fullLabel ?? null;
  const jurisdictionName = selectedLayer?.jurisdictionName ?? null;
  useEffect(() => {
    if (zoneLabel && jurisdictionName) setAnnouncement(`${zoneLabel}, ${jurisdictionName} selected.`);
  }, [zoneLabel, jurisdictionName]);
  useEffect(() => {
    if (!result || !species || !zoneLabel) return;
    const status = result.completeness === "NEEDS_INPUT" ? `One more fact needed: ${result.required?.question ?? ""}` : statusWord(result.regulation.status);
    setAnnouncement(`${species.displayName} in ${zoneLabel} on ${longDayLabel(session.date.iso)}: ${status}`);
  }, [result, species, zoneLabel, session.date.iso]);

  /* ── Escape steps back one level ─────────────────────────────────────── */

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (document.querySelector("dialog[open]")) return;
      if (page !== "main") { closePage(); return; }
      if (exploration.pin) { dispatchMap({ type: "PIN_CANCELLED" }); return; }
      if (layout === "sheet" && snap === "full") { setSnap("half"); return; }
      if (exploration.cardOpen) { dispatchMap({ type: "CARD_CLOSED" }); setSnap("peek"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [page, closePage, exploration.pin, exploration.cardOpen, layout, snap]);

  /* ── Share ───────────────────────────────────────────────────────────── */

  const share = useCallback(async () => {
    if (!presented || !selectedLayer) return;
    const payload = huntSharePayload({
      zone: { fullLabel: presented.fullLabel, jurisdictionName: selectedLayer.jurisdictionName },
      species: species ? { displayName: species.displayName } : null,
      date: session.date.iso,
      state: { zoneId: selectedZoneId as CanonicalId<"management_zone">, speciesId: session.speciesId, date: session.date.iso, explore: false },
    }, window.location.origin);
    const outcome = await shareHunt(window.navigator, payload);
    setToast(outcome === "copied" ? "Link copied" : outcome === "shared" ? "Shared" : outcome === "failed" ? "Couldn't share. Copy the address bar instead." : null);
  }, [presented, selectedLayer, species, session.date.iso, session.speciesId, selectedZoneId]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  /* ── Content ─────────────────────────────────────────────────────────── */

  const detailed = layout === "panel" || snap === "full";
  const dateLabel = deviceToday ? dateChipLabel(session.date.iso, new Date(`${deviceToday}T12:00:00`)) : session.date.explicit ? longDayLabel(session.date.iso) : "Today";
  const chooseSpecies = (id: CanonicalId<"species">) => {
    dispatchSession({ type: "SPECIES_CHOSEN", speciesId: id });
    if (page !== "main") closePage();
  };

  const chips = (
    <div className={styles.chips} role="group" aria-label="Your hunt">
      <button type="button" className={styles.chip} data-kind="species" data-empty={!species || undefined} onClick={() => openPage("species")} aria-haspopup="dialog">
        <span className={styles.chipLabel}>{species ? species.displayName : "What are you hunting?"}</span>
        <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true" fill="none"><path d="m3 5 4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <button type="button" className={styles.chip} data-kind="date" onClick={() => openPage("date")} aria-haspopup="dialog">
        <span className={styles.chipLabel}>{dateLabel}</span>
        <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true" fill="none"><path d="m3 5 4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
    </div>
  );

  let header: ReactNode;
  let body: ReactNode;

  if (page !== "main") {
    const titles: Record<Exclude<Page, "main">, string> = {
      search: "Where are you hunting?", species: "What are you hunting?", date: "When are you hunting?", layers: "Map layers", zones: "Zones in view",
    };
    header = (
      <div className={styles.titleRow}>
        <button type="button" className={styles.iconButton} onClick={closePage} aria-label="Back">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none"><path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <h2 className={styles.pageTitle}>{titles[page]}</h2>
      </div>
    );
    body = page === "search" ? (
      <SearchPage onChoose={chooseSearchResult} onUseMyLocation={useMyLocation} onChooseOnMap={chooseOnMap} locating={locate.kind === "locating"} locateMessage={locate.kind === "error" ? locate.message : null} autoFocus />
    ) : page === "species" ? (
      <SpeciesPage options={speciesOptions} value={session.speciesId} jurisdictionId={selectedLayer?.jurisdictionId} jurisdictionName={selectedLayer?.jurisdictionName} zoneStates={isHuntZone || selectedRef ? zoneStates : null} onChoose={chooseSpecies} autoFocus={layout === "panel"} />
    ) : page === "date" ? (
      <DatePage value={session.date.iso} today={deviceToday} onChoose={(iso) => { dispatchSession({ type: "DATE_CHOSEN", iso }); closePage(); }} />
    ) : page === "layers" ? (
      <LayersPage
        basemap={basemap} mapMode={mapMode} onMapMode={setMapMode}
        explorable={explorable} speciesId={session.speciesId} explore={session.explore}
        onExplore={(on) => dispatchSession({ type: "EXPLORE_SET", on })}
        onExploreSpecies={(id) => { dispatchSession({ type: "SPECIES_CHOSEN", speciesId: id }); dispatchSession({ type: "EXPLORE_SET", on: true }); }}
        overlayLayers={overlayLayersInView} overlaysOn={overlaysOn}
        onToggleOverlay={(id) => setOverlaysOn((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]))}
        onOpenZones={() => setPage("zones")} zonesInView={zonesInView.length}
      />
    ) : (
      <ZonesPage zones={zonesInView} states={filterStates} onChoose={(key) => selectZone(key, "list")} autoFocus />
    );
  } else if (pin) {
    // The confirm action lives in the header row, so it is reachable while the sheet is lowered over the map.
    header = (
      <div className={styles.titleRow}>
        <div className={styles.titleText}>
          <p className={styles.eyebrow}>Hunt here? · not chosen yet</p>
          <h2 className={styles.title} data-size="lead" aria-live="polite">
            {pinZone.kind === "loading" ? "Finding the zone…" : pinZone.kind === "resolved" ? `${pinZone.label} · ${pinZone.jurisdiction}` : "No official zone here"}
          </h2>
        </div>
        <button type="button" className={`ng-action ${styles.headerAction}`} onClick={confirmPin} disabled={pinZone.kind === "none"}>
          Check this spot
        </button>
        <button type="button" className={styles.iconButton} onClick={() => dispatchMap({ type: "PIN_CANCELLED" })} aria-label="Cancel choosing a spot">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" fill="none"><path d="m2 2 8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        </button>
      </div>
    );
    body = (
      <div className={styles.page}>
        <p className={styles.quiet}>
          {pinZone.kind === "none" ? `${pinZone.message} ` : ""}
          {pin.mode === "centre" ? "Move the map to put the crosshair on your spot." : "This point is only a preview until you check it."}
        </p>
        <details className={styles.disclosure}>
          <summary>Coordinates</summary>
          <p className="ng-numeric">{pin.point.latitude.toFixed(5)}, {pin.point.longitude.toFixed(5)}</p>
        </details>
      </div>
    );
  } else if (selection.kind === "overlay" && exploration.cardOpen) {
    const layer = geometry.overlayLayers.find((entry) => entry.id === selection.layerId) ?? null;
    header = (
      <div className={styles.titleRow}>
        <div className={styles.titleText}>
          <p className={styles.eyebrow}>{selectedOverlay?.type ?? layer?.name ?? "Special area"}{layer ? ` · ${layer.jurisdictionName}` : ""}</p>
          <h2 className={styles.title}>{selectedOverlay?.name ?? "Special area"}</h2>
        </div>
        <button type="button" className={styles.iconButton} onClick={() => { dispatchMap({ type: "CARD_CLOSED" }); setSnap("peek"); }} aria-label="Close">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" fill="none"><path d="m2 2 8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        </button>
      </div>
    );
    body = (
      <div className={styles.page}>
        {selectedOverlay?.statedAs ? (
          <blockquote className={styles.quote}>“{selectedOverlay.statedAs}”{selectedOverlay.regulation ? <cite>{selectedOverlay.regulation}</cite> : null}</blockquote>
        ) : <p className={styles.quiet}>The authority publishes no restriction text for this area in its layer.</p>}
        {layer ? (
          <dl className={styles.facts}>
            <div><dt>Authority</dt><dd>{layer.authority}</dd></div>
            <div><dt>Standing</dt><dd>{layer.standing}</dd></div>
          </dl>
        ) : null}
      </div>
    );
  } else if (selectedRef && exploration.cardOpen && presented && selectedLayer) {
    // The place's own name, not its whole address: "Bancroft is in this zone".
    const placeName = hunt?.label.split(",")[0]?.trim() || hunt?.label;
    const relation = isHuntZone && hunt
      ? hunt.origin === "device" ? "You are in this zone" : hunt.origin === "map" ? "Your chosen spot is in this zone" : `${placeName} is in this zone`
      : null;
    const summaryReady = summary?.kind === "ready" ? summary.summary : null;
    const entry = species && summaryReady ? summaryReady.species.find((candidate) => candidate.speciesId === species.id) ?? null : null;
    header = (
      <div className={styles.titleRow}>
        <div className={styles.titleText}>
          <p className={styles.eyebrow}>{selectedLayer.jurisdictionName} · {presented.termLong ?? selectedLayer.officialTerm}</p>
          <h2 className={styles.title} id="hunt-zone-title" tabIndex={-1}>{presented.fullLabel}</h2>
        </div>
        <button type="button" className={styles.iconButton} onClick={() => void share()} aria-label={`Share ${presented.fullLabel}${species ? `, ${species.displayName}` : ""}`}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none"><path d="M8 10V2M5 5l3-3 3 3M3 8v5h10V8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <button type="button" className={styles.iconButton} onClick={() => { dispatchMap({ type: "CARD_CLOSED" }); setSnap("peek"); }} aria-label={`Close ${presented.fullLabel}`}>
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" fill="none"><path d="m2 2 8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        </button>
      </div>
    );
    body = (
      <div className={styles.page}>
        {relation ? <p className={styles.relation} data-origin={hunt?.origin}>{relation}</p> : null}
        {isHuntZone && huntZone.kind === "resolved" && huntZone.nearBoundary ? (
          <p className={styles.warning} role="note">
            <strong>Near a zone boundary.</strong>{" "}
            {huntZone.boundaryDistanceMeters !== undefined ? `About ${huntZone.boundaryDistanceMeters.toLocaleString("en-CA")} m from the mapped line. ` : ""}
            Rules can differ on the other side. The map and consumer GPS are not a legal survey.
          </p>
        ) : null}
        {chips}
        {!species ? (
          summary?.kind === "ready" ? (
            <InSeasonHere summary={summary.summary} onChoose={chooseSpecies} />
          ) : summary?.kind === "error" ? (
            <p className={styles.problem} role="status">{summary.message}</p>
          ) : (
            <p className={styles.answerLoading} role="status"><span className={styles.spinner} aria-hidden="true" /> Reading the certified rules for this zone…</p>
          )
        ) : !speciesCertifiedHere ? (
          summaryReady ? (
            <ZoneSpeciesAnswer entry={null} species={species} summary={summaryReady} zoneLabel={presented.fullLabel} action={null} />
          ) : (
            <p className={styles.quiet}>North Ground has not certified {species.displayName.toLowerCase()} rules in {selectedLayer.jurisdictionName}.</p>
          )
        ) : pointForEvaluation ? (
          <HuntAnswer
            evaluation={session.evaluation}
            result={result}
            species={species}
            answered={answered}
            onAnswer={(dimensionId, value) => dispatchSession({ type: "ANSWERED", dimensionId, value })}
            onRetry={() => setRetryCount((count) => count + 1)}
            placeLabel={hunt?.label ?? null}
            jurisdiction={{ id: selectedLayer.jurisdictionId, displayName: selectedLayer.jurisdictionName }}
            detailed={detailed}
            onShowDetails={() => setSnap("full")}
          />
        ) : isHuntZone && huntZone.kind === "loading" ? (
          <p className={styles.answerLoading} role="status"><span className={styles.spinner} aria-hidden="true" /> Finding the official zone…</p>
        ) : summaryReady ? (
          <ZoneSpeciesAnswer
            entry={entry}
            species={species}
            summary={summaryReady}
            zoneLabel={presented.fullLabel}
            action={
              <div className={styles.actionsRow}>
                <button type="button" className="ng-action" onClick={chooseOnMap}>Check an exact spot</button>
                <button type="button" className="ng-action-quiet" onClick={useMyLocation} disabled={locate.kind === "locating"}>
                  {locate.kind === "locating" ? "Finding you…" : "Use my location"}
                </button>
              </div>
            }
          />
        ) : summary?.kind === "error" ? (
          <p className={styles.problem} role="status">{summary.message}</p>
        ) : (
          <p className={styles.answerLoading} role="status"><span className={styles.spinner} aria-hidden="true" /> Reading the certified rules for this zone…</p>
        )}
        {locate.kind === "error" && isHuntZone ? <p className={styles.quiet} role="status">{locate.message}</p> : null}
        {detailed && summaryReady && !pointForEvaluation ? <ZoneSummaryDetail summary={summaryReady} parts={storedSelected?.parts} /> : null}
        {!detailed && summaryReady && !pointForEvaluation ? (
          <button type="button" className={styles.moreButton} onClick={() => setSnap("full")}>
            Everything the rules say about {presented.fullLabel}
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" fill="none"><path d="m3 9 4-4 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        ) : null}
      </div>
    );
  } else if (hunt && huntZone.kind !== "resolved") {
    header = (
      <div className={styles.titleRow}>
        <div className={styles.titleText}>
          <p className={styles.eyebrow}>{hunt.origin === "device" ? "Your location" : "Hunt location"}</p>
          <h2 className={styles.title}>{hunt.origin === "device" ? "Finding your zone" : hunt.label}</h2>
        </div>
        <button type="button" className={styles.iconButton} onClick={() => { dispatchMap({ type: "HUNT_CLEARED" }); setSnap("peek"); }} aria-label="Clear the hunt location">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" fill="none"><path d="m2 2 8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        </button>
      </div>
    );
    body = (
      <div className={styles.page}>
        {huntZone.kind === "unresolved" ? (
          <>
            <p className={styles.lead}>{huntZone.message}</p>
            <div className={styles.actionsRow}>
              <button type="button" className="ng-action" onClick={() => openPage("search")}>Search another place</button>
              <button type="button" className="ng-action-quiet" onClick={chooseOnMap}>Choose on the map</button>
            </div>
          </>
        ) : (
          <p className={styles.answerLoading} role="status"><span className={styles.spinner} aria-hidden="true" /> Finding the official zone…</p>
        )}
      </div>
    );
  } else if (exploreSpecies) {
    const counts = new Map<ZoneState, number>();
    for (const state of filterStates?.values() ?? []) counts.set(state, (counts.get(state) ?? 0) + 1);
    header = (
      <div className={styles.titleRow}>
        <div className={styles.titleText}>
          <p className={styles.eyebrow}>Season status · {dateLabel}</p>
          <h2 className={styles.title}>{exploreSpecies.displayName}</h2>
        </div>
        <button type="button" className={styles.iconButton} onClick={() => dispatchSession({ type: "EXPLORE_SET", on: false })} aria-label="Stop colouring zones">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" fill="none"><path d="m2 2 8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        </button>
      </div>
    );
    body = (
      <div className={styles.page}>
        {chips}
        <p className={styles.quiet}>Zones in view are coloured by what the certified rules say across each zone. Tap one for its details.</p>
        <ul className={styles.legendList} aria-label="Zones in view by status">
          {[...counts.entries()].sort((a, b) => b[1] - a[1]).map(([state, count]) => (
            <li key={state}><StateChip state={state} /> <span className={styles.count}>{count} {count === 1 ? "zone" : "zones"}</span></li>
          ))}
          {!counts.size ? <li className={styles.quiet}>Reading the certified rules for the zones in view…</li> : null}
        </ul>
        <button type="button" className={styles.linkButton} onClick={() => openPage("zones")}>List these zones in words</button>
      </div>
    );
  } else {
    header = (
      <div className={styles.titleRow}>
        <div className={styles.titleText}>
          <h2 className={styles.title} data-size="lead">Find your hunting zone</h2>
        </div>
      </div>
    );
    body = (
      <div className={styles.page}>
        <div className={styles.startActions}>
          <button type="button" className={styles.startButton} data-primary="true" onClick={useMyLocation} disabled={locate.kind === "locating"} aria-busy={locate.kind === "locating" || undefined}>
            {locate.kind === "locating" ? <span className={styles.spinner} aria-hidden="true" /> : (
              <svg width="17" height="17" viewBox="0 0 16 16" aria-hidden="true" fill="none"><path d="M14.5 1.5 9 14.5l-1.7-5.8L1.5 7 14.5 1.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
            )}
            {locate.kind === "locating" ? "Finding you…" : "Use my location"}
          </button>
          <button type="button" className={styles.startButton} onClick={() => openPage("search")}>
            <svg width="17" height="17" viewBox="0 0 20 20" aria-hidden="true" fill="none"><circle cx="8.5" cy="8.5" r="5.75" stroke="currentColor" strokeWidth="1.8" /><path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            Search a place
          </button>
        </div>
        {locate.kind === "error" ? <p className={styles.problem} role="status">{locate.message}</p> : null}
        <p className={styles.quiet}>Or tap any zone on the map to see what&apos;s in season there. Your location is used only to find your zone; it is never stored or shared.</p>
        {species ? (
          <div className={styles.startSpecies}>
            {chips}
            {species.regulatoryJurisdictions.length ? (
              <button type="button" className="ng-action-quiet" onClick={() => dispatchSession({ type: "EXPLORE_SET", on: true })}>
                Show where {species.displayName.toLowerCase()} season is open
              </button>
            ) : null}
          </div>
        ) : null}
        {about}
      </div>
    );
  }

  const noticeList = [
    ...geometry.notices.map((notice) => notice.message),
    ...(overlayNotice ? [overlayNotice] : []),
  ];

  return (
    <div className={styles.app} ref={rootRef} style={rootStyle} data-layout={layout} data-snap={layout === "sheet" ? snap : undefined}>
      <div className={styles.safeProbe} ref={safeProbeRef} aria-hidden="true" />

      <div className={styles.mapRegion}>
        <HuntMapView
          googleMapsApiKey={googleMapsApiKey}
          exploration={exploration}
          dispatch={mapDispatch}
          drawn={geometry.drawn}
          selectedKey={selectedKey}
          huntKey={huntKey}
          filterStates={filterStates}
          overlays={overlayFeatures}
          mapMode={mapMode}
          camera={cameraRequest}
          locateOnStart={!initialUrl.zoneId}
          startBox={geometry.extent}
          poster={poster}
          padding={padding}
          onView={setView}
          onZoneClick={selectZone}
          onOverlayClick={onOverlayClick}
          onBasemap={setBasemap}
        />

        <div className={styles.mapControls}>
          <button type="button" className={`${styles.mapControl} ng-glass-control`} onClick={() => dispatchMap({ type: "RECENTER" })} aria-label="Show my location on the map">
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" fill="none">
              <circle cx="10" cy="10" r="5.2" stroke="currentColor" strokeWidth="1.6" />
              <circle cx="10" cy="10" r="1.9" fill="currentColor" />
              <path d="M10 1.5v3M10 15.5v3M1.5 10h3M15.5 10h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
          <button type="button" className={`${styles.mapControl} ng-glass-control`} onClick={() => openPage("layers")} aria-label="Map layers and season colours" aria-pressed={session.explore || overlaysOn.length > 0 || undefined}>
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" fill="none">
              <path d="m10 2.5 8 4.2-8 4.2-8-4.2 8-4.2Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              <path d="m2 10.4 8 4.2 8-4.2M2 13.9l8 4.2 8-4.2" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {exploreSpecies && filterStates?.size ? (
          <button type="button" className={`${styles.legendChip} ng-glass-overlay`} onClick={() => openPage("layers")} aria-label={`Colours show ${exploreSpecies.displayName} season status. Open layers for the key.`}>
            {[...new Set(filterStates.values())].slice(0, 4).map((state) => (
              <span key={state} className={styles.legendChipItem} data-state={state}>
                <span aria-hidden="true">{EXPLORATION_WORDING[state].glyph}</span> {EXPLORATION_WORDING[state].label}
              </span>
            ))}
          </button>
        ) : null}

        {noticeList.length || exploration.notice || linkNotice ? (
          <div className={styles.noticeStack} role="status">
            {exploration.notice ? (
              <p className={`${styles.notice} ng-glass-overlay`}>
                {exploration.notice === "self-denied"
                  ? "Location is off for this site, so your position can’t be shown. You can allow it in the browser’s site settings; search works the same."
                  : "This browser can’t share your location here. Search for a place or choose a spot on the map."}
                <button type="button" className={styles.noticeDismiss} onClick={() => dispatchMap({ type: "NOTICE_DISMISSED" })}>Dismiss</button>
              </p>
            ) : null}
            {linkNotice ? (
              <p className={`${styles.notice} ng-glass-overlay`}>
                {linkNotice}
                <button type="button" className={styles.noticeDismiss} onClick={() => setLinkNotice(null)}>Dismiss</button>
              </p>
            ) : null}
            {noticeList.map((message) => <p key={message} className={`${styles.notice} ng-glass-overlay`}>{message}</p>)}
          </div>
        ) : null}
      </div>

      <header className={styles.topBar} ref={headerRef}>
        <Link className={`${styles.brand} ng-glass-overlay`} href="/" aria-label="North Ground — home">
          <Image className={styles.brandMark} src="/logo-mark.webp" alt="" width={820} height={862} sizes="30px" priority draggable={false} />
          <span className={styles.brandText}>North Ground <span>Hunt</span></span>
        </Link>
        <button type="button" className={`${styles.topBarButton} ng-glass-control`} data-role="search" onClick={() => openPage("search")} aria-label="Search a place">
          <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true" fill="none"><circle cx="8.5" cy="8.5" r="5.75" stroke="currentColor" strokeWidth="1.8" /><path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        </button>
        <SiteMenu />
      </header>

      <HuntSheet layout={layout} snap={snap} heights={heights} onSnap={setSnap} label="Hunt details" header={header}>
        {layout === "panel" && page === "main" && !pin ? (
          <button type="button" className={styles.panelSearch} onClick={() => openPage("search")}>
            <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true" fill="none"><circle cx="8.5" cy="8.5" r="5.75" stroke="currentColor" strokeWidth="1.8" /><path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            {hunt ? hunt.label : "Search a place, town or postal code"}
          </button>
        ) : null}
        {body}
      </HuntSheet>

      {toast ? <p className={`${styles.toast} ng-glass-overlay`} role="status">{toast}</p> : null}
      <p className="ng-visually-hidden" aria-live="polite">{announcement}</p>
    </div>
  );
}

const MENU_LINKS: Array<{ href: string; label: string }> = [
  { href: "/", label: "North Ground home" },
  { href: "/hunt", label: "Hunt" },
  { href: "/hunting/species", label: "Species library" },
];

/** Compact site menu: a disclosure with Escape and focus return. */
function SiteMenu() {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      toggleRef.current?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || toggleRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);
  return (
    <>
      <button ref={toggleRef} type="button" className={`${styles.topBarButton} ng-glass-control`} aria-expanded={open} aria-controls="hunt-site-menu" onClick={() => setOpen((value) => !value)}>
        <span className="ng-visually-hidden">{open ? "Close menu" : "Menu"}</span>
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" fill="none">
          {open ? <path d="m4 4 10 10M14 4 4 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /> : <path d="M2.5 5h13M2.5 9h13M2.5 13h13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
        </svg>
      </button>
      {open ? (
        <div className={`${styles.menu} ng-glass-popover`} id="hunt-site-menu" ref={menuRef}>
          <nav aria-label="North Ground">
            {MENU_LINKS.map((link) => (
              <Link key={link.href} className={styles.menuLink} href={link.href} aria-current={link.href === "/hunt" ? "page" : undefined} onClick={() => setOpen(false)}>
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      ) : null}
    </>
  );
}

