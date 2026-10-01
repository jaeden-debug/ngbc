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
 * WHAT IT MAY DO, AND WHAT IT NEVER MAY (CLAUDE.md §41A, "Resolving inside a
 * jurisdiction is not drawing its boundary", decided 2026-09-30). The state
 * boundary may RESOLVE a point for a rule whose own scope is the whole state —
 * a season the authority states as "Entire state open." — and for nothing
 * else:
 *
 *  - it is never drawn as a hunting zone and never becomes a zone id;
 *  - it is never the geography of a rule scoped narrower than the state (a
 *    unit, district or county rule waits for the authority's own geometry);
 *  - it is labelled as the Census Bureau's cartographic boundary, never as the
 *    authority's determination of where its hunting jurisdiction runs;
 *  - proximity is stated (`unitedStatesStateLineProximity`): a point near a
 *    state line is flagged as a zone line's point is, and known differences —
 *    water boundaries, federal and tribal land — are said rather than smoothed.
 *
 * Everywhere else it is attribution only: which state a point is in, so a
 * point the state's unit layer does not place still names its state.
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
 * A cheap request guard, not a jurisdiction answer. The rectangles are
 * deliberately generous around the contiguous states, Alaska (including the
 * Aleutians across the antimeridian) and Hawaii. Census still decides whether
 * the point is in a state; this only keeps an unrelated world point from
 * waiting on Census before receiving the generic unsupported response.
 */
export function couldBeUnitedStatesState(latitude: number, longitude: number): boolean {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  const contiguous = latitude >= 24.2 && latitude <= 49.5 && longitude >= -125.1 && longitude <= -66.7;
  const alaska = latitude >= 51 && latitude <= 72 && (longitude >= 172 || longitude <= -129);
  const hawaii = latitude >= 18 && latitude <= 29 && longitude >= -180 && longitude <= -154;
  return contiguous || alaska || hawaii;
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

/* ── Proximity to the state line ─────────────────────────────────────────── */

/**
 * How close to a state line a point may be before an answer that rests on the
 * state boundary says so. North Ground's declared margin, not the Bureau's:
 * TIGER/Line boundaries are cartographic, not a legal survey, so the margin is
 * wider than the 150 m used where an authority's own zone geometry decides.
 */
export const STATE_LINE_MARGIN_METRES = 500;

/**
 * CLEAR: the whole circle of `STATE_LINE_MARGIN_METRES` around the point lies
 * inside the state. NEAR_LINE: it does not — a neighbouring state, the sea, a
 * lake or a national border is within the margin. NOT_MEASURED: the Bureau
 * could not be asked, which is never read as clear.
 */
export type StateLineProximity = "CLEAR" | "NEAR_LINE" | "NOT_MEASURED";

const proximityAnswers = new Map<string, { at: number; proximity: StateLineProximity }>();

export function clearStateLineProximityCache(): void {
  proximityAnswers.clear();
}

/**
 * Whether the point is within the margin of its state's edge, asked of the
 * same Census service: "which state CONTAINS the circle of this radius around
 * the point" (`esriSpatialRelWithin` with a buffer distance). The state itself
 * comes back only when the whole circle is inside it, so the test holds as
 * well against a coast or a national border as against a neighbouring state,
 * and no geometry is downloaded or stored.
 *
 * A distance in metres is not computed: the service answers inside-or-not for
 * a radius, and inventing a figure from that would be precision nobody
 * measured. So the answer is a bracket — within the margin, or not.
 */
export async function unitedStatesStateLineProximity(
  latitude: number,
  longitude: number,
  code: string,
  fetcher: typeof fetch = fetch,
): Promise<StateLineProximity> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !/^[A-Z]{2}$/.test(code)) return "NOT_MEASURED";
  const key = `${latitude.toFixed(6)}|${longitude.toFixed(6)}|${code}`;
  const cached = proximityAnswers.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.proximity;
  const parameters = new URLSearchParams({
    geometry: `${longitude},${latitude}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelWithin",
    distance: String(STATE_LINE_MARGIN_METRES),
    units: "esriSRUnit_Meter",
    outFields: "STUSAB",
    returnGeometry: "false",
    f: "json",
  });
  try {
    const response = await fetcher(`${US_STATE_BOUNDARY_ENDPOINT}?${parameters}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(US_STATE_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) return "NOT_MEASURED";
    const payload = await response.json() as { features?: Array<{ attributes?: { STUSAB?: unknown } }>; error?: unknown };
    if (payload.error || !Array.isArray(payload.features)) return "NOT_MEASURED";
    const proximity: StateLineProximity = payload.features.some((feature) => feature.attributes?.STUSAB === code) ? "CLEAR" : "NEAR_LINE";
    if (proximityAnswers.size >= CACHE_MAX) proximityAnswers.delete(proximityAnswers.keys().next().value!);
    proximityAnswers.set(key, { at: Date.now(), proximity });
    return proximity;
  } catch {
    return "NOT_MEASURED";
  }
}
