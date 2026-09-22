/**
 * Location discovery and resolution.
 *
 * Google supplies place discovery and address resolution. It is NOT a hunting-zone,
 * regulatory or land-access authority — it turns a human phrase into a coordinate,
 * and North Ground's own PostGIS registry decides which official management zone that
 * coordinate falls in.
 *
 * Both providers are called server-side so the browser never holds a server key and
 * never talks to a database. The browser-visible Maps key is separate, referrer
 * restricted, and used only to render the basemap.
 */

import { googleRefusal, googleStatusRefusal, logGoogleFailure } from "./google-refusal.ts";
import { countryOfJurisdiction, ZONE_LAYERS, type ZoneLayer } from "./zone-layers.ts";

export type LocationProviderName = "google" | "nominatim";

export interface PlaceSuggestion {
  /** Provider place identifier, passed back to resolve the full place. */
  id: string;
  /** "Pembroke" */
  primary: string;
  /** "ON, Canada" */
  secondary?: string;
  /**
   * Present when the provider already returned a coordinate with the suggestion
   * (Nominatim does; Google deliberately does not, because resolving a prediction is
   * a separate billed step that also closes the autocomplete session).
   */
  latitude?: number;
  longitude?: number;
}

export interface ResolvedPlace {
  /** Human-readable label retained for display. Never treated as regulatory input. */
  label: string;
  latitude: number;
  longitude: number;
  provider: LocationProviderName;
}

export type SuggestResult =
  | { status: "OK"; suggestions: PlaceSuggestion[]; provider: LocationProviderName }
  | { status: "EMPTY"; suggestions: []; provider: LocationProviderName }
  | { status: "NOT_CONFIGURED" | "PROVIDER_ERROR"; suggestions: []; provider: LocationProviderName; message: string };

export type ResolveResult =
  | { status: "OK"; place: ResolvedPlace }
  | { status: "NOT_FOUND" | "NOT_CONFIGURED" | "PROVIDER_ERROR"; message: string };

export interface LocationRequestOptions {
  fetcher?: typeof fetch;
  provider?: LocationProviderName;
  googleApiKey?: string;
  /**
   * Google autocomplete session token. Predictions and the subsequent resolve call
   * that share a token are billed as one session, so the client generates one per
   * search and passes the same value to both endpoints.
   */
  sessionToken?: string;
  contactEmail?: string;
  signal?: AbortSignal;
}

const REQUEST_TIMEOUT_MS = 6_000;
const MAX_SUGGESTIONS = 6;

/**
 * Search only the countries North Ground serves hunting zones in, so a result
 * is a place Hunt can answer for. Canada is always served; the United States
 * joins the moment a U.S. state's zones are served, and not before.
 */
export function searchRegionCodes(layers: readonly Pick<ZoneLayer, "serving" | "jurisdictionId">[] = ZONE_LAYERS): string[] {
  const countries = new Set(["ca"]);
  for (const layer of layers) {
    const country = layer.serving ? countryOfJurisdiction(layer.jurisdictionId) : undefined;
    if (country) countries.add(country.toLowerCase());
  }
  return [...countries];
}

function selectedProvider(options: LocationRequestOptions): LocationProviderName {
  if (options.provider) return options.provider;
  return (process.env.GEOCODING_PROVIDER?.trim() as LocationProviderName) || "nominatim";
}

function timeout(signal?: AbortSignal): AbortSignal {
  return signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS);
}

function validCoordinate(latitude: unknown, longitude: unknown): boolean {
  return (
    typeof latitude === "number" && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 &&
    typeof longitude === "number" && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180
  );
}

/* ── Google Places (New) ─────────────────────────────────────────────────── */

interface GoogleAutocompleteResponse {
  suggestions?: Array<{
    placePrediction?: {
      placeId?: string;
      text?: { text?: string };
      structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } };
    };
  }>;
}

export async function suggestGooglePlaces(
  query: string,
  options: LocationRequestOptions = {},
): Promise<SuggestResult> {
  const key = options.googleApiKey ?? process.env.GOOGLE_MAPS_SERVER_API_KEY?.trim();
  if (!key) {
    return {
      status: "NOT_CONFIGURED",
      suggestions: [],
      provider: "google",
      message: "Google place search is not configured.",
    };
  }

  try {
    const response = await (options.fetcher ?? fetch)("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
      },
      body: JSON.stringify({
        input: query,
        includedRegionCodes: searchRegionCodes(),
        languageCode: "en-CA",
        ...(options.sessionToken ? { sessionToken: options.sessionToken } : {}),
      }),
      signal: timeout(options.signal),
      cache: "no-store",
    });
    if (!response.ok) throw await googleRefusal("Google Places", response);

    const payload = await response.json() as GoogleAutocompleteResponse;
    const suggestions = (payload.suggestions ?? [])
      .flatMap(({ placePrediction }) => {
        const id = placePrediction?.placeId;
        const primary = placePrediction?.structuredFormat?.mainText?.text ?? placePrediction?.text?.text;
        if (!id || !primary) return [];
        return [{
          id,
          primary,
          secondary: placePrediction?.structuredFormat?.secondaryText?.text,
        }];
      })
      .slice(0, MAX_SUGGESTIONS);

    if (!suggestions.length) return { status: "EMPTY", suggestions: [], provider: "google" };
    return { status: "OK", suggestions, provider: "google" };
  } catch (error) {
    // Logged by reason only; the query is user location intent.
    logGoogleFailure("hunt-location", "Google Places", error);
    return {
      status: "PROVIDER_ERROR",
      suggestions: [],
      provider: "google",
      message: "Google place search is temporarily unavailable.",
    };
  }
}

interface GooglePlaceDetailsResponse {
  displayName?: { text?: string };
  formattedAddress?: string;
  shortFormattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
}

export async function resolveGooglePlace(
  placeId: string,
  options: LocationRequestOptions = {},
): Promise<ResolveResult> {
  const key = options.googleApiKey ?? process.env.GOOGLE_MAPS_SERVER_API_KEY?.trim();
  if (!key) return { status: "NOT_CONFIGURED", message: "Google place resolution is not configured." };

  try {
    const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`);
    url.searchParams.set("languageCode", "en-CA");
    // Passing the session token here closes the autocomplete session, so the whole
    // search is billed once rather than per keystroke.
    if (options.sessionToken) url.searchParams.set("sessionToken", options.sessionToken);

    const response = await (options.fetcher ?? fetch)(url, {
      headers: {
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "displayName,formattedAddress,shortFormattedAddress,location",
      },
      signal: timeout(options.signal),
      cache: "no-store",
    });
    if (!response.ok) throw await googleRefusal("Google Place Details", response);

    const payload = await response.json() as GooglePlaceDetailsResponse;
    const latitude = payload.location?.latitude;
    const longitude = payload.location?.longitude;
    if (!validCoordinate(latitude, longitude)) return { status: "NOT_FOUND", message: "That place has no usable coordinate." };

    const label = payload.shortFormattedAddress
      ?? payload.formattedAddress
      ?? payload.displayName?.text
      ?? "Selected location";
    return { status: "OK", place: { label, latitude: latitude as number, longitude: longitude as number, provider: "google" } };
  } catch (error) {
    logGoogleFailure("hunt-location", "Google Place Details", error);
    return { status: "PROVIDER_ERROR", message: "Google place resolution is temporarily unavailable." };
  }
}

interface GoogleGeocodeResponse {
  status?: string;
  results?: Array<{ formatted_address?: string }>;
}

export async function reverseGoogleGeocode(
  latitude: number,
  longitude: number,
  options: LocationRequestOptions = {},
): Promise<ResolveResult> {
  const key = options.googleApiKey ?? process.env.GOOGLE_MAPS_SERVER_API_KEY?.trim();
  if (!key) return { status: "NOT_CONFIGURED", message: "Google geocoding is not configured." };
  if (!validCoordinate(latitude, longitude)) return { status: "NOT_FOUND", message: "That coordinate is not valid." };

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("latlng", `${latitude},${longitude}`);
    url.searchParams.set("language", "en-CA");
    url.searchParams.set("result_type", "locality|administrative_area_level_3|administrative_area_level_2|postal_code");
    url.searchParams.set("key", key);

    const response = await (options.fetcher ?? fetch)(url, { signal: timeout(options.signal), cache: "no-store" });
    if (!response.ok) throw await googleRefusal("Google Geocoding", response);

    const payload = await response.json() as GoogleGeocodeResponse;
    // This API refuses a key with HTTP 200 and `REQUEST_DENIED`. That is an outage
    // to fall back from, not a coordinate with no named place near it.
    if (payload.status !== "OK" && payload.status !== "ZERO_RESULTS") throw googleStatusRefusal("Google Geocoding", payload.status);
    const label = payload.results?.[0]?.formatted_address;
    if (payload.status !== "OK" || !label) {
      // A coordinate with no nearby named place is normal in the backcountry and is
      // not an error: the coordinate still resolves a zone.
      return { status: "NOT_FOUND", message: "No named place was found near that coordinate." };
    }
    return { status: "OK", place: { label, latitude, longitude, provider: "google" } };
  } catch (error) {
    logGoogleFailure("hunt-location", "Google Geocoding", error);
    return { status: "PROVIDER_ERROR", message: "Google geocoding is temporarily unavailable." };
  }
}

/* ── Nominatim (keyless development and fallback) ────────────────────────── */

interface NominatimPlace {
  place_id?: number | string;
  lat?: string;
  lon?: string;
  name?: string;
  display_name?: string;
  address?: Record<string, string>;
}

function nominatimHeaders(options: LocationRequestOptions): HeadersInit {
  const contact = options.contactEmail
    ?? process.env.GEOCODING_CONTACT_EMAIL?.trim()
    ?? "contact@northgroundbushcraft.com";
  // Nominatim's usage policy requires a genuine identifying User-Agent.
  return { accept: "application/json", "user-agent": `NorthGroundHunt/1.0 (+${contact})` };
}

function splitDisplayName(place: NominatimPlace): { primary: string; secondary?: string } {
  const address = place.address ?? {};
  const primary = place.name
    || address.city || address.town || address.village || address.hamlet
    || address.municipality || address.postcode
    || place.display_name?.split(",")[0]?.trim()
    || "Location";
  const secondary = place.display_name
    ?.split(",")
    .slice(1)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(", ");
  return { primary, secondary: secondary || undefined };
}

export async function suggestNominatimPlaces(
  query: string,
  options: LocationRequestOptions = {},
): Promise<SuggestResult> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", query);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("countrycodes", searchRegionCodes().join(","));
    url.searchParams.set("limit", String(MAX_SUGGESTIONS));

    const response = await (options.fetcher ?? fetch)(url, {
      headers: nominatimHeaders(options),
      signal: timeout(options.signal),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Nominatim returned ${response.status}`);

    const payload = await response.json() as NominatimPlace[];
    const suggestions = (payload ?? []).flatMap((place) => {
      const latitude = Number(place.lat);
      const longitude = Number(place.lon);
      if (!validCoordinate(latitude, longitude)) return [];
      const { primary, secondary } = splitDisplayName(place);
      // Nominatim returns the coordinate with the suggestion, so no second call
      // is needed and no place id has to round-trip.
      return [{ id: `nominatim:${place.place_id ?? `${latitude},${longitude}`}`, primary, secondary, latitude, longitude }];
    });

    if (!suggestions.length) return { status: "EMPTY", suggestions: [], provider: "nominatim" };
    return { status: "OK", suggestions, provider: "nominatim" };
  } catch {
    return {
      status: "PROVIDER_ERROR",
      suggestions: [],
      provider: "nominatim",
      message: "Place search is temporarily unavailable.",
    };
  }
}

export async function reverseNominatimGeocode(
  latitude: number,
  longitude: number,
  options: LocationRequestOptions = {},
): Promise<ResolveResult> {
  if (!validCoordinate(latitude, longitude)) return { status: "NOT_FOUND", message: "That coordinate is not valid." };
  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("lat", String(latitude));
    url.searchParams.set("lon", String(longitude));
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("zoom", "12");

    const response = await (options.fetcher ?? fetch)(url, {
      headers: nominatimHeaders(options),
      signal: timeout(options.signal),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Nominatim returned ${response.status}`);

    const place = await response.json() as NominatimPlace & { error?: string };
    if (place.error || !place.display_name) return { status: "NOT_FOUND", message: "No named place was found near that coordinate." };
    return { status: "OK", place: { label: place.display_name, latitude, longitude, provider: "nominatim" } };
  } catch {
    return { status: "PROVIDER_ERROR", message: "Reverse geocoding is temporarily unavailable." };
  }
}

/* ── Provider selection ──────────────────────────────────────────────────── */

/**
 * Falling back changes availability, never regulatory truth: these providers only
 * produce a coordinate and a display label. The zone, the season and the rule all
 * come from North Ground's own certified registry regardless of which one answered.
 */
export async function suggestPlaces(query: string, options: LocationRequestOptions = {}): Promise<SuggestResult> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return { status: "EMPTY", suggestions: [], provider: selectedProvider(options) };

  if (selectedProvider(options) === "google") {
    const result = await suggestGooglePlaces(trimmed, options);
    if (result.status === "OK" || result.status === "EMPTY") return result;
    return suggestNominatimPlaces(trimmed, options);
  }
  return suggestNominatimPlaces(trimmed, options);
}

export async function resolvePlace(placeId: string, options: LocationRequestOptions = {}): Promise<ResolveResult> {
  if (placeId.startsWith("nominatim:")) {
    return { status: "NOT_FOUND", message: "That suggestion already carries its coordinate." };
  }
  if (selectedProvider(options) === "google") return resolveGooglePlace(placeId, options);
  return { status: "NOT_CONFIGURED", message: "The configured provider cannot resolve a place identifier." };
}

export async function describeCoordinate(
  latitude: number,
  longitude: number,
  options: LocationRequestOptions = {},
): Promise<ResolveResult> {
  if (selectedProvider(options) === "google") {
    const result = await reverseGoogleGeocode(latitude, longitude, options);
    if (result.status === "OK" || result.status === "NOT_FOUND") return result;
    return reverseNominatimGeocode(latitude, longitude, options);
  }
  return reverseNominatimGeocode(latitude, longitude, options);
}
