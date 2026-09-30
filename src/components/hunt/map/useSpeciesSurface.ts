"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RenderableSurface, SurfacePlot } from "../../../lib/hunt/exploration/surface-paint";
import type { BBox } from "../../../lib/hunt/exploration/geometry-store";

/**
 * The animal layer's data path.
 *
 * WHAT THIS REPLACED, AND WHY IT HAD TO BE REPLACED RATHER THAN FIXED. The old
 * `useSpeciesHeat` posted the list of zones currently on screen and received a
 * value per zone. Every part of that is the choropleth: the request is keyed by
 * zone identity, so the reply can only ever be one value per hunting unit, and
 * the surface changed at a regulatory boundary because the DATA did. Scoping
 * that request to a viewport would not have helped — it would have been the
 * same one-value-per-zone answer for a different list of zones.
 *
 * So this asks a different question of a different resource: give me the
 * evidence over THIS RECTANGLE OF GROUND. No zone is named in the request and
 * none comes back.
 *
 * It never reads a date either. Animal evidence and hunting legality are
 * separate systems (§11), so changing the hunt date moves the green outlines
 * and the conditions and leaves the surface exactly where it was — because the
 * surface has no way to learn that the date changed.
 *
 * NOTHING HERE DECIDES HOW ANYTHING IS DRAWN. `continuity`, `unmappedGround`
 * and `effectiveResolution` are read from the reply and passed on. A client that
 * inferred continuity would eventually smooth a plot survey whose publisher says
 * it may not be smoothed.
 */

const DEBOUNCE_MS = 200;
/** Snap the request box outward, so small pans re-use the same reply. */
const SNAP_DEGREES = 0.5;

interface PackedCells {
  origin: [number, number];
  stepDegrees: [number, number];
  columns: number;
  rows: number;
  /** 0..1000, or null for ground nobody surveyed. */
  values: (number | null)[];
}

interface ReplyFeature {
  id: string;
  score: number;
  rawValue?: number;
  observedYear?: number;
  geometry?: { type: string; coordinates: number[][][] | number[][][][] };
}

interface ReplySurface {
  id: string;
  speciesId: string;
  geometryKind: string;
  continuity: "CONTINUOUS" | "DISCRETE";
  unmappedGround: "NOT_SURVEYED" | "NO_EVIDENCE_HELD";
  effectiveResolution: { metres: number; statedAs: string };
  evidence?: { tier: string; grade: string; measured: boolean };
  season?: { observedSeason: string; matchesHuntingSeason: boolean; warning?: string };
  scale?: { statedAs: string; unit: string; comparable: boolean };
  provenance?: Record<string, unknown>;
  features?: ReplyFeature[];
  cells?: PackedCells;
}

interface Reply {
  speciesId?: string;
  surfaces?: ReplySurface[];
  refusals?: Array<{ surfaceId?: string; reason?: string; message?: string }>;
  emptyMeans?: string;
  status?: string;
}

export interface SurfaceLegendState {
  /** Each drawn surface's own account of itself, in its own words. */
  layers: Array<{
    id: string;
    geometryKind: string;
    continuity: "CONTINUOUS" | "DISCRETE";
    unmappedGround: "NOT_SURVEYED" | "NO_EVIDENCE_HELD";
    resolutionStatedAs: string;
    scaleStatedAs: string;
    unit: string;
    seasonWarning: string | null;
    authority: string;
    title: string;
    url: string;
    licence: string;
    limitations: string[];
    measured: boolean;
  }>;
  /** What ground with nothing on it means, from the reply rather than from us. */
  emptyMeans: string;
  /** Why a request was refused, when one was. Never silently an empty map. */
  refusals: string[];
}

export interface SpeciesSurfaceState {
  surfaces: readonly RenderableSurface[];
  legend: SurfaceLegendState | null;
  /** True when the species has no spatial evidence here — a finding, not an error. */
  noSurface: boolean;
  loading: boolean;
}

const EMPTY: SpeciesSurfaceState = { surfaces: [], legend: null, noSurface: false, loading: false };

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

/** GeoJSON Polygon or MultiPolygon to rings of [lon, lat]. Anything else is skipped. */
function ringsOf(geometry: ReplyFeature["geometry"]): number[][][] | null {
  if (!geometry) return null;
  if (geometry.type === "Polygon") return geometry.coordinates as number[][][];
  if (geometry.type === "MultiPolygon") return (geometry.coordinates as number[][][][]).flat();
  return null;
}

function toRenderable(surface: ReplySurface): RenderableSurface | null {
  const common = {
    id: surface.id,
    speciesId: surface.speciesId,
    continuity: surface.continuity,
    effectiveResolutionMetres: surface.effectiveResolution.metres,
  };
  if (surface.cells) {
    const { origin, stepDegrees, columns, rows, values } = surface.cells;
    /* Dense window to a sparse map. `null` NEVER becomes a key: an absent entry
       is what makes unsurveyed ground undrawable downstream, and a 0 entry is
       what makes surveyed-and-none-found drawable. For ruffed grouse the second
       is 11,733 of 22,873 cells — half of what the surface knows is a negative
       finding, and flattening it into the first would throw that away. */
    const cells = new Map<number, number>();
    for (let i = 0; i < values.length; i += 1) {
      const value = values[i];
      if (value === null || value === undefined) continue;
      cells.set(i, value / 1000);
    }
    if (!cells.size) return null;
    return {
      ...common,
      grid: { lonStep: stepDegrees[0], latStep: stepDegrees[1], west: origin[0], south: origin[1], cols: columns, rows },
      cells,
    };
  }
  const plots: SurfacePlot[] = [];
  for (const feature of surface.features ?? []) {
    const rings = ringsOf(feature.geometry);
    if (rings) plots.push({ id: feature.id, score: feature.score, rings });
  }
  return plots.length ? { ...common, plots } : null;
}

export function useSpeciesSurface(speciesId: string | null, box: BBox | null): SpeciesSurfaceState {
  const [state, setState] = useState<SpeciesSurfaceState>(EMPTY);
  /* The species the state on screen belongs to. A reply that arrives after the
     hunter has changed species is DISCARDED, never merged: §12 requires no
     stale hotspot from the previous animal to survive the switch, and an
     out-of-order response is exactly how one would. */
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
       previous animal's evidence is never on screen under the new animal's name. */
    setState((previous) => (
      previous.surfaces[0]?.speciesId === speciesId ? { ...previous, loading: true } : { ...EMPTY, loading: true }
    ));
    if (!key) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const bbox = key.slice(key.indexOf("|") + 1);
      fetch(`/api/hunt/species-surface?speciesId=${encodeURIComponent(speciesId)}&bbox=${bbox}`, { signal: controller.signal })
        .then(async (response) => {
          const payload = (await response.json()) as Reply;
          if (wantedRef.current !== speciesId) return;

          const refusals = (payload.refusals ?? []).map((r) => r.message ?? r.reason ?? "").filter(Boolean);
          const replySurfaces = payload.surfaces ?? [];
          if (!replySurfaces.length) {
            /* Nothing held here is a FINDING, and a refusal is a different one.
               Neither is an empty map with no explanation: a blank map reads to
               a hunter as "there are no animals here". */
            setState({
              surfaces: [],
              legend: { layers: [], emptyMeans: payload.emptyMeans ?? "", refusals },
              noSurface: true,
              loading: false,
            });
            return;
          }
          const renderable = replySurfaces.map(toRenderable).filter((s): s is RenderableSurface => s !== null);
          setState({
            surfaces: renderable,
            legend: {
              layers: replySurfaces.map((surface) => ({
                id: surface.id,
                geometryKind: surface.geometryKind,
                continuity: surface.continuity,
                unmappedGround: surface.unmappedGround,
                resolutionStatedAs: surface.effectiveResolution.statedAs,
                scaleStatedAs: surface.scale?.statedAs ?? "",
                unit: surface.scale?.unit ?? "",
                seasonWarning: surface.season?.matchesHuntingSeason === false ? surface.season.warning ?? null : null,
                authority: String(surface.provenance?.authority ?? ""),
                title: String(surface.provenance?.title ?? ""),
                url: String(surface.provenance?.url ?? ""),
                licence: String(surface.provenance?.licence ?? ""),
                limitations: Array.isArray(surface.provenance?.limitations) ? (surface.provenance.limitations as string[]) : [],
                measured: surface.evidence?.measured === true,
              })),
              emptyMeans: payload.emptyMeans ?? "",
              refusals,
            },
            noSurface: false,
            loading: false,
          });
        })
        .catch(() => {
          /* A failed request draws nothing. It never draws a cold value, and it
             never leaves the previous species' evidence on screen. */
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
