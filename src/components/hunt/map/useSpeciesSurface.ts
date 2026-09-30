"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RenderableSurface } from "../../../lib/hunt/exploration/surface-paint";
import type { BBox } from "../../../lib/hunt/exploration/geometry-store";

/**
 * The animal layer's data path.
 *
 * WHAT THIS REPLACED, AND WHY IT HAD TO BE REPLACED RATHER THAN FIXED. The old
 * `useSpeciesHeat` posted the list of zones currently on screen and received a
 * value per zone. Every part of that is the choropleth: the request is keyed by
 * zone identity, so the reply can only ever be one value per hunting unit, and
 * the surface would change at a regulatory boundary because the DATA changed
 * there. Scoping that request to a viewport would not have helped — it would
 * have been the same one-value-per-zone answer for a different list of zones.
 *
 * So this asks a different question of a different resource: give me the field
 * over THIS RECTANGLE OF GROUND. No zone is named in the request and none comes
 * back. That is the §2 invariant in the data path, where the moderator was
 * right that it had to be, and not only in the renderer.
 *
 * It also never reads a date. Animal evidence and hunting legality are separate
 * systems (§11), so changing the hunt date moves the green outlines and the
 * conditions and leaves the surface exactly where it was — because the surface
 * has no way to learn that the date changed.
 */

const DEBOUNCE_MS = 200;
/** Snap the request box outward, so small pans re-use the same reply. */
const SNAP_DEGREES = 0.5;

interface PackedReply {
  status?: string;
  continuity?: "CONTINUOUS" | "DISCRETE";
  metricLabel?: string;
  unit?: string;
  emptyMeans?: string;
  zeroMeans?: string;
  metricMeaning?: string;
  effectiveResolution?: { metres: number; statedAs: string };
  provenance?: Record<string, unknown>;
  cells?: { origin: [number, number]; stepDegrees: [number, number]; columns: number; values: (number | null)[] };
  counts?: { surveyed: number; detected: number };
}

export interface SpeciesSurfaceState {
  surface: RenderableSurface | null;
  /** Everything the legend needs to say what it is showing, in the source's words. */
  legend: {
    metricLabel: string;
    metricMeaning: string;
    unit: string;
    emptyMeans: string;
    zeroMeans: string;
    resolutionStatedAs: string;
    continuity: "CONTINUOUS" | "DISCRETE";
    provenance: Record<string, unknown> | null;
    surveyed: number;
    detected: number;
  } | null;
  /** True when the species has no spatial evidence anywhere — a finding, not an error. */
  noSurface: boolean;
  loading: boolean;
}

const EMPTY: SpeciesSurfaceState = { surface: null, legend: null, noSurface: false, loading: false };

function snap(box: BBox) {
  const out = (value: number, direction: 1 | -1) =>
    direction > 0 ? Math.ceil(value / SNAP_DEGREES) * SNAP_DEGREES : Math.floor(value / SNAP_DEGREES) * SNAP_DEGREES;
  return {
    west: Math.max(-180, out(box.west, -1)),
    south: Math.max(-90, out(box.south, -1)),
    east: Math.min(180, out(box.east, 1)),
    north: Math.min(90, out(box.north, 1)),
  };
}

export function useSpeciesSurface(speciesId: string | null, box: BBox | null): SpeciesSurfaceState {
  const [state, setState] = useState<SpeciesSurfaceState>(EMPTY);
  /* The species the state on screen belongs to. A reply that arrives after the
     hunter has changed species is DISCARDED, never merged: §12 requires no
     stale hotspot from the previous animal to survive the switch, and an
     out-of-order response is the way one would. */
  const wantedRef = useRef<string | null>(null);

  const key = useMemo(() => {
    if (!speciesId || !box) return null;
    const s = snap(box);
    return `${speciesId}|${s.west},${s.south},${s.east},${s.north}`;
  }, [speciesId, box]);

  useEffect(() => {
    wantedRef.current = speciesId;
    if (!speciesId) {
      setState(EMPTY);
      return;
    }
    /* Clear IMMEDIATELY on a species change, before the new reply lands, so the
       previous animal's field is never on screen under the new animal's name. */
    setState((previous) => (previous.surface?.speciesId === speciesId ? { ...previous, loading: true } : { ...EMPTY, loading: true }));
    if (!key) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const [, bbox] = key.split("|");
      fetch(`/api/hunt/species-surface?speciesId=${encodeURIComponent(speciesId)}&bbox=${bbox}`, { signal: controller.signal })
        .then(async (response) => {
          const payload = (await response.json()) as PackedReply;
          if (wantedRef.current !== speciesId) return;
          if (response.status === 404 || payload.status === "NO_SURFACE") {
            setState({ ...EMPTY, noSurface: true });
            return;
          }
          if (payload.status !== "OK" || !payload.cells || !payload.effectiveResolution) {
            setState({ ...EMPTY, loading: false });
            return;
          }
          const { origin, stepDegrees, columns, values } = payload.cells;
          const rows = Math.ceil(values.length / columns);
          /* Dense window to a sparse map. `null` NEVER becomes a key: an absent
             entry is what makes unsurveyed ground undrawable downstream, and a
             zero entry is what makes surveyed-and-none-found drawable. The two
             stay different all the way from the survey file to the pixel. */
          const cells = new Map<number, number>();
          for (let i = 0; i < values.length; i += 1) {
            const value = values[i];
            if (value === null || value === undefined) continue;
            cells.set(i, value);
          }
          setState({
            surface: {
              speciesId,
              continuity: payload.continuity ?? "DISCRETE",
              metricLabel: payload.metricLabel ?? "",
              effectiveResolutionMetres: payload.effectiveResolution.metres,
              emptyMeans: payload.emptyMeans ?? "",
              grid: {
                latStep: stepDegrees[1],
                lonStep: stepDegrees[0],
                south: origin[1],
                west: origin[0],
                rows,
                cols: columns,
              },
              cells,
            },
            legend: {
              metricLabel: payload.metricLabel ?? "",
              metricMeaning: payload.metricMeaning ?? "",
              unit: payload.unit ?? "",
              emptyMeans: payload.emptyMeans ?? "",
              zeroMeans: payload.zeroMeans ?? "",
              resolutionStatedAs: payload.effectiveResolution.statedAs,
              continuity: payload.continuity ?? "DISCRETE",
              provenance: payload.provenance ?? null,
              surveyed: payload.counts?.surveyed ?? 0,
              detected: payload.counts?.detected ?? 0,
            },
            noSurface: false,
            loading: false,
          });
        })
        .catch(() => {
          /* A failed request draws nothing. It never draws a cold value, and it
             never leaves the previous species' field on screen. */
          if (wantedRef.current === speciesId) setState((previous) => ({ ...previous, loading: false }));
        });
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [speciesId, key]);

  return state;
}
