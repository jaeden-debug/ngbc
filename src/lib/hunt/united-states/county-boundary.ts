/**
 * Which county — or county equivalent — a point is in, asked of the U.S.
 * Census Bureau.
 *
 * WHY THIS EXISTS. In ten U.S. states the county IS the legal hunting unit, by
 * the authority's own words: Texas indexes its regulations "Seasons by County",
 * Ohio's own field is `County_Bag_Limit`, Virginia's unit is a LOCALITY — a
 * county or an independent city — and Georgia, Missouri and North Carolina
 * publish no management-unit system at all. For those rules there is nothing
 * for an authority to draw: a state wildlife agency's county polygon would only
 * be a redrawing of a boundary someone else already owns. So the resolver asks
 * the body that does own it.
 *
 * THIS IS NOT A SUBSTITUTE FOR A UNIT LAYER, AND THE DIFFERENCE IS THE WHOLE
 * POINT (CLAUDE.md §41A, "Resolving inside a jurisdiction is not drawing its
 * boundary"; §41B, "A legal rule's geography is not always a polygon"). A
 * county may RESOLVE a point for a rule whose own scope is that county, and
 * for nothing else:
 *
 *  - it is never drawn as a hunting zone and never becomes a zone id;
 *  - it is never the geography of a rule scoped to anything narrower — a
 *    part-county carve-out bounded by a highway waits for its own treatment,
 *    and Alabama's deer zones, which run along US Hwy. 80 through the middle
 *    of Sumter and Dallas counties, are exactly why that line is drawn here;
 *  - it is labelled as the Census Bureau's cartographic boundary, never as the
 *    authority's determination of where a hunting rule runs;
 *  - proximity is stated: a point near a county line is flagged as a point
 *    near a zone line is, because a bag limit can change across it.
 *
 * Source: TIGERweb, the Bureau's own published service, layer 1 of the same
 * State_County MapServer the state resolver already uses — so counties come
 * back at the same generalisation as the states they nest in. A work of the
 * United States government, in the public domain (17 U.S.C. § 105). North
 * Ground stores no copy of the geometry: the service is asked per point,
 * bounded and cached, exactly as the state boundary and the state hunting
 * layers are.
 *
 * COUNTY EQUIVALENTS ARE COUNTIES HERE, AND ONE STATE HAS NONE. The layer
 * answers with whatever the Bureau treats as a county equivalent, which is
 * what these authorities legislate in: Louisiana parishes, Alaska boroughs and
 * census areas, and Virginia's independent cities (Richmond city, GEOID 51760,
 * resolves distinctly from Henrico County) all come back correctly. But
 * Connecticut abolished county government, and the Bureau now answers a
 * Connecticut point with a PLANNING REGION — "Capitol Planning Region" for
 * Hartford — which is not a town and is not Connecticut's legal hunting
 * geography. Connecticut legislates by town, so it must not be declared on
 * this resolver; its division is a county subdivision, which is a different
 * service and is not built. Measured 2026-10-07.
 */

import type { CanonicalId, SourceRecord } from "../../content-contract/index.ts";

export const US_COUNTY_BOUNDARY_ENDPOINT =
  "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1/query";

export const US_COUNTY_BOUNDARY_SOURCE_ID = "source:us-census-tigerweb-counties" as CanonicalId<"source">;

/** The same budget PostGIS, the state services and the state boundary get. */
export const US_COUNTY_TIMEOUT_MS = 2_500;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX = 2_000;

export interface UnitedStatesCounty {
  /** The Bureau's five-digit FIPS code, state then county: `51760`. Joins rules to geography. */
  geoid: string;
  /** The Bureau's full name, as it answers: `Richmond city`, `Orleans Parish`, `Henrico County`. */
  name: string;
  /** The name without its type word: `Richmond`, `Orleans`, `Henrico`. What a regulation usually prints. */
  baseName: string;
  /** Two-digit state FIPS, `51`. */
  stateFips: string;
}

interface CacheEntry { at: number; county: UnitedStatesCounty | null }

const answers = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<UnitedStatesCounty | undefined>>();

export function clearUnitedStatesCountyCache(): void {
  answers.clear();
  inFlight.clear();
}

export function unitedStatesCountySource(retrievedAt: string): SourceRecord {
  return {
    id: US_COUNTY_BOUNDARY_SOURCE_ID,
    authority: "U.S. Census Bureau",
    title: "TIGERweb: Counties and equivalent entities",
    url: "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1",
    publisher: "U.S. Census Bureau",
    retrievedAt,
    type: "official",
    jurisdictionIds: [],
    verificationStatus: "verified",
  } as SourceRecord;
}

/**
 * The county or county equivalent containing the point, or undefined where the
 * Bureau places it in none (anywhere outside the United States, and offshore
 * water beyond a coastal county) or could not be asked. Undefined is never
 * read as "no county": it only means Hunt cannot say.
 */
export async function unitedStatesCountyAt(
  latitude: number,
  longitude: number,
  fetcher: typeof fetch = fetch,
): Promise<UnitedStatesCounty | undefined> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return undefined;
  const key = `${latitude.toFixed(6)}|${longitude.toFixed(6)}`;
  const cached = answers.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.county ?? undefined;
  const pending = inFlight.get(key);
  if (pending) return pending;

  const request = ask(latitude, longitude, fetcher)
    .then((result) => {
      // Only a determinate answer is remembered; a failure is asked again.
      if (result.ok) {
        if (answers.size >= CACHE_MAX) answers.delete(answers.keys().next().value!);
        answers.set(key, { at: Date.now(), county: result.county ?? null });
      }
      return result.county;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, request);
  return request;
}

async function ask(
  latitude: number,
  longitude: number,
  fetcher: typeof fetch,
): Promise<{ ok: boolean; county?: UnitedStatesCounty }> {
  const parameters = new URLSearchParams({
    geometry: `${longitude},${latitude}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    /* STUSAB is NOT a field on the counties layer; asking for it returns HTTP
       400 with "Failed to execute query", which reads exactly like an empty
       county. The state comes from STATE (its FIPS), never from this layer's
       absent abbreviation. Measured 2026-10-07. */
    outFields: "NAME,BASENAME,GEOID,STATE",
    returnGeometry: "false",
    f: "json",
  });
  try {
    const response = await fetcher(`${US_COUNTY_BOUNDARY_ENDPOINT}?${parameters}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(US_COUNTY_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) return { ok: false };
    const payload = await response.json() as {
      features?: Array<{ attributes?: Record<string, unknown> }>;
      error?: unknown;
    };
    /* An ArcGIS error arrives with HTTP 200 and no features, which would
       otherwise be indistinguishable from a point outside the country. */
    if (payload.error) return { ok: false };
    if (!Array.isArray(payload.features)) return { ok: false };
    // Outside the United States the Bureau returns nothing: a real answer.
    if (!payload.features.length) return { ok: true };
    // Two counties at one point is a boundary question for a person, not a pick.
    if (payload.features.length > 1) return { ok: true };
    const attributes = payload.features[0].attributes ?? {};
    const { NAME: name, BASENAME: baseName, GEOID: geoid, STATE: stateFips } = attributes;
    if (typeof name !== "string" || typeof baseName !== "string") return { ok: false };
    if (typeof geoid !== "string" || !/^\d{5}$/.test(geoid)) return { ok: false };
    if (typeof stateFips !== "string" || !/^\d{2}$/.test(stateFips)) return { ok: false };
    /* The five-digit code begins with its own state's two digits. A mismatch
       means the service changed shape, not that a county moved state. */
    if (!geoid.startsWith(stateFips)) return { ok: false };
    return { ok: true, county: { geoid, name, baseName, stateFips } };
  } catch {
    return { ok: false };
  }
}

/* ── Proximity to the county line ────────────────────────────────────────── */

/**
 * How close to a county line a point may be before an answer resting on the
 * county says so. North Ground's declared margin, not the Bureau's.
 *
 * It is the state line's margin, for the same reason: TIGER/Line boundaries are
 * cartographic rather than a legal survey, so the margin is wider than the
 * 150 m used where an authority's own zone geometry decides. A county line
 * carries real consequence — a bag limit, a season length, whether a weapon is
 * lawful can all change across it — so the bracket is stated rather than
 * smoothed.
 */
export const COUNTY_LINE_MARGIN_METRES = 500;

/**
 * CLEAR: the whole circle of `COUNTY_LINE_MARGIN_METRES` around the point lies
 * inside the county. NEAR_LINE: it does not — a neighbouring county, the sea,
 * a lake or a state line is within the margin. NOT_MEASURED: the Bureau could
 * not be asked, which is never read as clear.
 */
export type CountyLineProximity = "CLEAR" | "NEAR_LINE" | "NOT_MEASURED";

const proximityAnswers = new Map<string, { at: number; proximity: CountyLineProximity }>();

export function clearCountyLineProximityCache(): void {
  proximityAnswers.clear();
}

/**
 * Whether the point is within the margin of its county's edge, asked of the
 * same service: "which county CONTAINS the circle of this radius around the
 * point" (`esriSpatialRelWithin` with a buffer distance). The county itself
 * comes back only when the whole circle is inside it, so the test holds as well
 * against a coast or a state line as against a neighbouring county, and no
 * geometry is downloaded or stored.
 *
 * A distance in metres is not computed: the service answers inside-or-not for a
 * radius, and inventing a figure from that would be precision nobody measured.
 */
export async function unitedStatesCountyLineProximity(
  latitude: number,
  longitude: number,
  geoid: string,
  fetcher: typeof fetch = fetch,
): Promise<CountyLineProximity> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !/^\d{5}$/.test(geoid)) return "NOT_MEASURED";
  const key = `${latitude.toFixed(6)}|${longitude.toFixed(6)}|${geoid}`;
  const cached = proximityAnswers.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.proximity;
  const parameters = new URLSearchParams({
    geometry: `${longitude},${latitude}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelWithin",
    distance: String(COUNTY_LINE_MARGIN_METRES),
    units: "esriSRUnit_Meter",
    outFields: "GEOID",
    returnGeometry: "false",
    f: "json",
  });
  try {
    const response = await fetcher(`${US_COUNTY_BOUNDARY_ENDPOINT}?${parameters}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(US_COUNTY_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) return "NOT_MEASURED";
    const payload = await response.json() as { features?: Array<{ attributes?: { GEOID?: unknown } }>; error?: unknown };
    if (payload.error || !Array.isArray(payload.features)) return "NOT_MEASURED";
    const proximity: CountyLineProximity = payload.features.some((feature) => feature.attributes?.GEOID === geoid)
      ? "CLEAR" : "NEAR_LINE";
    if (proximityAnswers.size >= CACHE_MAX) proximityAnswers.delete(proximityAnswers.keys().next().value!);
    proximityAnswers.set(key, { at: Date.now(), proximity });
    return proximity;
  } catch {
    return "NOT_MEASURED";
  }
}
