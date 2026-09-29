"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { zoneKeyOf } from "../../../lib/hunt/exploration/geometry-store";
import type { ZoneHeat } from "../../../lib/hunt/exploration/species-layer";

/**
 * The heat half of the species layer.
 *
 * It is deliberately a SEPARATE request from `/api/hunt/zone-status`, which
 * carries the season states. §41B keeps species opportunity and legal status in
 * different lanes, and one response carrying both is how they get blended: a
 * caller that receives them together will eventually read one from the other.
 * Here, a zone can be hot and shut, or open and cold, and neither request can
 * see the other's answer.
 *
 * A zone that never appears in a response holds NO CERTIFIED EVIDENCE. It stays
 * out of the map entirely; it is never given a low value, because absent
 * evidence is not evidence of absence.
 */

export interface HeatZoneRef {
  key: string;
  layerId: string;
  name: string;
}

/** §41B: the ceiling is part of the question, not an optimisation. */
const MAX_ZONES = 450;
const DEBOUNCE_MS = 250;

interface HeatReply {
  status?: string;
  zones?: Array<{ layerId: string; designation: string } & ZoneHeat>;
}

/**
 * @param speciesId the chosen species, or null when the layer is off.
 * @param zonesInView the official zones the map is currently drawing.
 */
export function useSpeciesHeat(speciesId: string | null, zonesInView: readonly HeatZoneRef[]): ReadonlyMap<string, ZoneHeat> | null {
  const [heat, setHeat] = useState<Map<string, ZoneHeat> | null>(null);
  /* Answers are immutable for a deployment — the bundles are committed files —
     so a zone answered once is never asked about again. */
  const cacheRef = useRef(new Map<string, ZoneHeat>());
  /* Asked and told "nothing here": remembered too, or panning would re-ask
     about the same evidence-less zones on every move. */
  const emptyRef = useRef(new Set<string>());

  const inViewKey = useMemo(() => zonesInView.map((zone) => zone.key).sort().join(","), [zonesInView]);

  useEffect(() => {
    if (!speciesId) {
      setHeat(null);
      return;
    }
    const prefix = `${speciesId}|`;
    const known = new Map<string, ZoneHeat>();
    const missing: HeatZoneRef[] = [];
    for (const zone of zonesInView) {
      const cached = cacheRef.current.get(prefix + zone.key);
      if (cached) known.set(zone.key, cached);
      else if (!emptyRef.current.has(prefix + zone.key)) missing.push(zone);
    }
    setHeat(known);
    if (!missing.length) return;

    const asked = missing.slice(0, MAX_ZONES);
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch("/api/hunt/opportunity/heat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ speciesId, zones: asked.map((zone) => ({ layerId: zone.layerId, designation: zone.name })) }),
        signal: controller.signal,
      })
        .then(async (response) => {
          const payload = await response.json() as HeatReply;
          if (payload.status !== "OK" || !payload.zones) throw new Error("opportunity unavailable");
          const next = new Map(known);
          const answered = new Set<string>();
          for (const entry of payload.zones) {
            /* The same minting rule the geometry store uses, so a heat entry and
               a polygon can never disagree about which zone they describe. */
            const key = zoneKeyOf({ layerId: entry.layerId, designation: entry.designation });
            answered.add(key);
            const zoneHeat: ZoneHeat = {
              classification: entry.classification,
              intensity: entry.intensity,
              strength: entry.strength,
              renderKind: entry.renderKind,
            };
            cacheRef.current.set(prefix + key, zoneHeat);
            next.set(key, zoneHeat);
          }
          /* Everything asked about and not answered holds no evidence. That is
             a real answer, so it is recorded — but it is recorded as ABSENCE,
             never as a class. */
          for (const zone of asked) if (!answered.has(zone.key)) emptyRef.current.add(prefix + zone.key);
          setHeat(next);
        })
        .catch(() => { /* A zone without evidence stays unshaded: no value is ever guessed. */ });
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
    // `inViewKey` stands for `zonesInView`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speciesId, inViewKey]);

  return heat;
}
