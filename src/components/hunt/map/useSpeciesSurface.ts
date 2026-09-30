"use client";

import { useEffect, useRef, useState } from "react";
import {
  boxContains, IDLE_SURFACE, paintedGround, surfaceRequestBox, surfaceStateFromReply, surfaceUrl,
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

interface Held { speciesId: string; box: GroundBox; state: SpeciesSurfaceState; seq: number }
interface Pending { speciesId: string; box: GroundBox; controller: AbortController; timer: number }

export function useSpeciesSurface(speciesId: string | null, view: GroundBox | null): SpeciesSurfaceState {
  /* The last answer received, with the species and box it answers. What is
     SHOWN is derived from it below, so a species change clears the map in the
     same render — the previous animal's evidence is never on screen under the
     new animal's name, not even for the length of one request. */
  const [held, setHeld] = useState<Held | null>(null);
  /* A reply that is shown but never held: a failure, or a refusal (413) that a
     smaller view must be free to ask again about. */
  const [transient, setTransient] = useState<Held | null>(null);
  /* The species on screen. A reply for any other is discarded by
     `surfaceStateFromReply`, never merged. */
  const wantedRef = useRef<string | null>(null);
  const heldRef = useRef<Held | null>(null);
  const pendingRef = useRef<Pending | null>(null);
  const seqRef = useRef(0);
  const cacheRef = useRef(new Map<string, Held>());

  useEffect(() => {
    wantedRef.current = speciesId;
    heldRef.current = held;
  });

  /* Only an unmount abandons a request outright; everything else supersedes. */
  useEffect(() => () => {
    const pending = pendingRef.current;
    if (pending) {
      window.clearTimeout(pending.timer);
      pending.controller.abort();
    }
  }, []);

  useEffect(() => {
    wantedRef.current = speciesId;
    const pending = pendingRef.current;
    const supersede = () => {
      if (!pending) return;
      window.clearTimeout(pending.timer);
      pending.controller.abort();
      pendingRef.current = null;
    };
    if (!speciesId || !view) {
      if (!speciesId) supersede();
      return;
    }
    const needed = paintedGround(view);
    const current = heldRef.current;
    /* The ground the renderer will paint is already answered: nothing to ask. */
    if (current && current.speciesId === speciesId && boxContains(current.box, needed)) return;
    /* A request already on its way covers it: let it land rather than abort it
       at every idle, which on a slow network meant nothing ever landed. */
    if (pending && pending.speciesId === speciesId && boxContains(pending.box, needed)) return;
    supersede();

    const box = surfaceRequestBox(view);
    const url = surfaceUrl(speciesId, box);
    const cached = cacheRef.current.get(url);
    if (cached) {
      queueMicrotask(() => { if (wantedRef.current === speciesId) setHeld(cached); });
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(url, { signal: controller.signal })
        .then(async (response) => {
          let payload: SurfaceReply | null = null;
          try { payload = (await response.json()) as SurfaceReply; } catch { payload = null; }
          /* Aborted while the body was being read: superseded, not failed. */
          if (controller.signal.aborted) return;
          const next = surfaceStateFromReply(wantedRef.current, speciesId, response.status, payload);
          if (!next) return;
          seqRef.current += 1;
          const entry: Held = { speciesId, box, state: next, seq: seqRef.current };
          if (next.outcome === "UNAVAILABLE" || response.status === 413) {
            setTransient(entry);
            return;
          }
          const cache = cacheRef.current;
          cache.delete(url);
          cache.set(url, entry);
          while (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
          heldRef.current = entry;
          setHeld(entry);
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          /* A failed request draws nothing new. It never draws a cold value,
             and it never leaves another species' evidence on screen. */
          const next = surfaceStateFromReply(wantedRef.current, speciesId, 0, null);
          if (!next) return;
          seqRef.current += 1;
          setTransient({ speciesId, box, state: next, seq: seqRef.current });
        })
        .finally(() => {
          if (pendingRef.current?.controller === controller) pendingRef.current = null;
        });
    }, DEBOUNCE_MS);
    pendingRef.current = { speciesId, box, controller, timer };
  }, [speciesId, view]);

  if (!speciesId) return IDLE_SURFACE;
  const own = (entry: Held | null) => (entry && entry.speciesId === speciesId ? entry : null);
  const drawn = own(held);
  const newer = own(transient);
  if (drawn && newer && newer.seq > drawn.seq) {
    /* The older reply is still right for its own ground; keep it, and say that
       the newer request did not arrive rather than letting the gap read as
       ground the surveys missed. */
    if (newer.state.outcome === "UNAVAILABLE") return { ...drawn.state, failure: newer.state.message };
    return newer.state;
  }
  if (drawn) return drawn.state;
  if (newer) return newer.state;
  return { ...IDLE_SURFACE, speciesId, outcome: "LOADING" };
}
