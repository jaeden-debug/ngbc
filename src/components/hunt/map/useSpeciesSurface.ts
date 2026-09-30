"use client";

import { useEffect, useRef, useState } from "react";
import {
  boxContains, IDLE_SURFACE, surfaceRequestBox, surfaceStateFromReply, surfaceUrl,
  type GroundBox, type SpeciesSurfaceState, type SurfaceReply,
} from "../../../lib/hunt/exploration/surface-request";

export type { SpeciesSurfaceState, SurfaceLegendState } from "../../../lib/hunt/exploration/surface-request";

/**
 * The animal layer's data path.
 *
 * WHAT THIS REPLACED, AND WHY IT HAD TO BE REPLACED RATHER THAN FIXED. The old
 * `useSpeciesHeat` posted the list of zones currently on screen and received a
 * value per zone. Every part of that is the choropleth: the request is keyed by
 * zone identity, so the reply can only ever be one value per hunting unit, and
 * the surface changed at a regulatory boundary because the DATA did.
 *
 * So this asks a different question of a different resource: give me the
 * evidence over THIS RECTANGLE OF GROUND. No zone is named in the request and
 * none comes back, and it needs no zone geometry to be drawn first — a map
 * whose provincial services are all down still gets the animal layer.
 *
 * Every decision (the box, the leak guard, the four outcomes) is in
 * `surface-request.ts`, where the node test runner can reach it.
 */

const DEBOUNCE_MS = 150;
/** Replies kept per session: a hunter flicking between two species re-uses both. */
const CACHE_LIMIT = 12;

interface Held { speciesId: string; box: GroundBox; state: SpeciesSurfaceState }

export function useSpeciesSurface(speciesId: string | null, view: GroundBox | null): SpeciesSurfaceState {
  /* The last answer received, with the species and box it answers. What is
     SHOWN is derived from it below, so a species change clears the map in the
     same render — the previous animal's evidence is never on screen under the
     new animal's name, not even for the length of one request. */
  const [held, setHeld] = useState<Held | null>(null);
  const [failed, setFailed] = useState<SpeciesSurfaceState | null>(null);
  /* The species on screen. A reply for any other is discarded by
     `surfaceStateFromReply`, never merged. */
  const wantedRef = useRef<string | null>(null);
  const heldRef = useRef<Held | null>(null);
  const cacheRef = useRef(new Map<string, Held>());

  useEffect(() => {
    wantedRef.current = speciesId;
    heldRef.current = held;
  });

  useEffect(() => {
    if (!speciesId || !view) return;
    wantedRef.current = speciesId;
    const current = heldRef.current;
    const wantedView: GroundBox = { west: view.west, south: view.south, east: view.east, north: view.north };
    /* What is on screen is already answered: nothing to ask. */
    if (current && current.speciesId === speciesId && boxContains(current.box, wantedView)) return;

    const box = surfaceRequestBox(wantedView);
    const url = surfaceUrl(speciesId, box);
    const cached = cacheRef.current.get(url);
    let cancelled = false;
    if (cached) {
      queueMicrotask(() => { if (!cancelled && wantedRef.current === speciesId) setHeld(cached); });
      return () => { cancelled = true; };
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(url, { signal: controller.signal })
        .then(async (response) => {
          let payload: SurfaceReply | null = null;
          try { payload = (await response.json()) as SurfaceReply; } catch { payload = null; }
          const next = surfaceStateFromReply(wantedRef.current, speciesId, response.status, payload);
          if (!next) return;
          if (next.outcome === "UNAVAILABLE") {
            setFailed(next);
            return;
          }
          const entry = { speciesId, box, state: next };
          const cache = cacheRef.current;
          cache.delete(url);
          cache.set(url, entry);
          while (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
          heldRef.current = entry;
          setFailed(null);
          setHeld(entry);
        })
        .catch((error: unknown) => {
          if ((error as { name?: string })?.name === "AbortError") return;
          /* A failed request draws nothing. It never draws a cold value, and it
             never leaves the previous species' evidence on screen. */
          const next = surfaceStateFromReply(wantedRef.current, speciesId, 0, null);
          if (next) setFailed(next);
        });
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [speciesId, view]);

  if (!speciesId) return IDLE_SURFACE;
  if (held && held.speciesId === speciesId) return held.state;
  if (failed && failed.speciesId === speciesId) return failed;
  return { ...IDLE_SURFACE, speciesId, outcome: "LOADING" };
}
