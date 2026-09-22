/**
 * Which state or territory a point is in — asked of the U.S. Census Bureau,
 * never inferred from a hunting layer's extent.
 *
 * A hunting-unit layer answers "which unit", not "which state". Its extent is
 * a rectangle: Idaho's reaches across the Bitterroots into Montana, so a point
 * the state's own unit layer does not place (a reservation, a gap, a closure)
 * would otherwise be left with no jurisdiction at all, and Hunt would forget
 * which state the hunter is standing in. State identity and hunting coverage
 * are separate facts:
 *
 *   point → state/territory → hunting geography and overlays → rules
 *
 * so a Montana reservation is "Montana, and these rules do not apply here",
 * never "no jurisdiction".
 *
 * Source: TIGERweb, the U.S. Census Bureau's own published service for its
 * TIGER/Line boundaries. A work of the United States government, in the public
 * domain (17 U.S.C. § 105); the Bureau asks to be cited, which every answer
 * carrying this source does. North Ground stores no copy of the geometry: the
 * service is asked per point, bounded and cached, exactly as the state hunting
 * layers are.
 *
 * This is ATTRIBUTION ONLY. It is never drawn as a hunting zone, never a zone
 * id, and never an input to a rule.
 */

import type { CanonicalId, SourceRecord } from "../../content-contract/index.ts";

export const US_STATE_BOUNDARY_ENDPOINT =
  "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/0/query";

export const US_STATE_BOUNDARY_SOURCE_ID = "source:us-census-tigerweb-states" as CanonicalId<"source">;

/** The same budget PostGIS and the state services get. */
export const US_STATE_TIMEOUT_MS = 2_500;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX = 2_000;

export interface UnitedStatesPlace {
  /** `jurisdiction:us-mt`. */
  jurisdictionId: string;
  /** The Bureau's own name ("Montana"). */
  name: string;
  /** Its two-letter code ("MT"). */
  code: string;
}

interface CacheEntry { at: number; place: UnitedStatesPlace | null }

const answers = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<UnitedStatesPlace | undefined>>();

export function clearUnitedStatesStateCache(): void {
  answers.clear();
  inFlight.clear();
}

export function unitedStatesStateSource(retrievedAt: string): SourceRecord {
  return {
    id: US_STATE_BOUNDARY_SOURCE_ID,
    authority: "U.S. Census Bureau",
    title: "TIGERweb: States and equivalent entities",
    url: "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/0",
    publisher: "U.S. Census Bureau",
    retrievedAt,
    type: "official",
    jurisdictionIds: [],
    verificationStatus: "verified",
  } as SourceRecord;
}

/**
 * The state or territory containing the point, or undefined where the Bureau
 * places it in none (anywhere outside the United States) or could not be
 * asked. Undefined is never read as "no state": it only means Hunt cannot say.
 */
export async function unitedStatesStateAt(
  latitude: number,
  longitude: number,
  fetcher: typeof fetch = fetch,
): Promise<UnitedStatesPlace | undefined> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return undefined;
  const key = `${latitude.toFixed(6)}|${longitude.toFixed(6)}`;
  const cached = answers.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.place ?? undefined;
  const pending = inFlight.get(key);
  if (pending) return pending;

  const request = ask(latitude, longitude, fetcher)
    .then((result) => {
      // Only a determinate answer is remembered; a failure is asked again.
      if (result.ok) {
        if (answers.size >= CACHE_MAX) answers.delete(answers.keys().next().value!);
        answers.set(key, { at: Date.now(), place: result.place ?? null });
      }
      return result.place;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, request);
  return request;
}

async function ask(
  latitude: number,
  longitude: number,
  fetcher: typeof fetch,
): Promise<{ ok: boolean; place?: UnitedStatesPlace }> {
  const parameters = new URLSearchParams({
    geometry: `${longitude},${latitude}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "NAME,STUSAB",
    returnGeometry: "false",
    f: "json",
  });
  try {
    const response = await fetcher(`${US_STATE_BOUNDARY_ENDPOINT}?${parameters}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(US_STATE_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) return { ok: false };
    const payload = await response.json() as { features?: Array<{ attributes?: { NAME?: unknown; STUSAB?: unknown } }> };
    const features = payload.features ?? [];
    // Outside the United States the Bureau returns nothing: a real answer.
    if (!features.length) return { ok: true };
    // Two states at one point is a boundary question for a person, not a pick.
    if (features.length > 1) return { ok: true };
    const { NAME: name, STUSAB: code } = features[0].attributes ?? {};
    if (typeof name !== "string" || typeof code !== "string" || !/^[A-Z]{2}$/.test(code)) return { ok: false };
    return { ok: true, place: { jurisdictionId: `jurisdiction:us-${code.toLowerCase()}`, name, code } };
  } catch {
    return { ok: false };
  }
}
