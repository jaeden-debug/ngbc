/**
 * Finding somewhere to buy a licence in person.
 *
 * Three locations exist in Hunt and must never be confused (see the header of
 * `exploration/map-state.ts`):
 *
 *   hunt location          where the hunt is — decides the zone, the law, the
 *                          weather, the Hunt Brief. Set only by the hunter.
 *   device location        where the phone is. Optional, ephemeral.
 *   vendor-search location where to look for a licence issuer.
 *
 * This module holds only the third, and it is a different TYPE from the hunt
 * location, not a differently named variable of the same one. Nothing here can
 * express a hunt location, so no event in the vendor search can change one: the
 * separation is structural, not a matter of discipline.
 *
 * Distance is computed in the browser against the province's published issuer
 * list, so a device position used for this never leaves the page. Nothing in
 * this module performs a request.
 */

export interface LicenceIssuer {
  name: string;
  type?: string;
  typeFr?: string;
  address?: string;
  addressFr?: string;
  city: string;
  postalCode?: string;
  webLink?: string;
  latitude: number;
  longitude: number;
}

export interface IssuerDirectory {
  directoryId: string;
  attribution: string;
  licenceUrl: string;
  retrievedAt: string;
  issuers: LicenceIssuer[];
}

/**
 * Where to search for a vendor. Branded so that it cannot be passed where a
 * hunt location is expected, or the reverse, without a deliberate conversion
 * — and there is no such conversion anywhere in Hunt.
 */
export interface VendorSearchLocation {
  readonly kind: "VENDOR_SEARCH";
  readonly latitude: number;
  readonly longitude: number;
  readonly label: string;
  /** Where the point came from, so the interface can say it honestly. */
  readonly origin: "DEVICE" | "SEARCH";
}

export function vendorSearchLocation(
  latitude: number,
  longitude: number,
  label: string,
  origin: VendorSearchLocation["origin"],
): VendorSearchLocation {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    throw new Error("A vendor search location needs a valid coordinate");
  }
  return Object.freeze({ kind: "VENDOR_SEARCH", latitude, longitude, label, origin });
}

const EARTH_RADIUS_KM = 6371.0088;

export function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface NearbyIssuer {
  issuer: LicenceIssuer;
  distanceKm: number;
}

/** The nearest issuers to a vendor-search location. Pure: reads, never writes. */
export function nearestIssuers(location: VendorSearchLocation, issuers: readonly LicenceIssuer[], limit = 5): NearbyIssuer[] {
  return issuers
    .map((issuer) => ({ issuer, distanceKm: distanceKm(location, issuer) }))
    .sort((a, b) => a.distanceKm - b.distanceKm || a.issuer.name.localeCompare(b.issuer.name))
    .slice(0, limit);
}

/**
 * A map link for an issuer. It names the issuer and its address — never the
 * searcher's position, so following it does not hand the device location to
 * anyone.
 */
export function issuerMapUrl(issuer: LicenceIssuer): string {
  const query = [issuer.name, issuer.address, issuer.city, issuer.postalCode, "Ontario"].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** A seasonal issuer may be closed when someone arrives; say so rather than let them find out. */
export function issuerAdvice(issuer: LicenceIssuer): string | undefined {
  if (/seasonal/i.test(issuer.type ?? "")) return "Seasonal issuer: call ahead to check it is open.";
  if (/^po box/i.test(issuer.address ?? "")) return "Listed with a mailing address only: call ahead for directions.";
  return undefined;
}

/* ── The search, as a state machine ──────────────────────────────────────── */

export type VendorSearchState =
  | { phase: "IDLE" }
  | { phase: "LOCATING" }
  | { phase: "SEARCHING"; reason?: "DENIED" | "UNAVAILABLE" }
  | { phase: "RESULTS"; location: VendorSearchLocation };

export type VendorSearchEvent =
  | { type: "USE_DEVICE" }
  | { type: "DEVICE_LOCATED"; latitude: number; longitude: number }
  | { type: "DEVICE_FAILED"; code: number }
  | { type: "SEARCH_ANOTHER_PLACE" }
  | { type: "PLACE_CHOSEN"; latitude: number; longitude: number; label: string }
  | { type: "RESET" };

/** GeolocationPositionError.PERMISSION_DENIED. */
const PERMISSION_DENIED = 1;

/**
 * Every transition of the vendor search. Its states hold only a vendor-search
 * location, so none of them can carry, replace or clear a hunt location.
 *
 * A refused or failed device location never strands the hunter: it opens place
 * search, which needs no permission at all.
 */
export function vendorSearchReducer(state: VendorSearchState, event: VendorSearchEvent): VendorSearchState {
  switch (event.type) {
    case "USE_DEVICE":
      return { phase: "LOCATING" };
    case "DEVICE_LOCATED":
      if (state.phase !== "LOCATING") return state;
      return { phase: "RESULTS", location: vendorSearchLocation(event.latitude, event.longitude, "Your current location", "DEVICE") };
    case "DEVICE_FAILED":
      if (state.phase !== "LOCATING") return state;
      return { phase: "SEARCHING", reason: event.code === PERMISSION_DENIED ? "DENIED" : "UNAVAILABLE" };
    case "SEARCH_ANOTHER_PLACE":
      return { phase: "SEARCHING" };
    case "PLACE_CHOSEN":
      return { phase: "RESULTS", location: vendorSearchLocation(event.latitude, event.longitude, event.label, "SEARCH") };
    case "RESET":
      return { phase: "IDLE" };
  }
}

/**
 * The published issuer directories, loaded only when someone asks. The list
 * never ships with the page, and nothing about the searcher is sent to fetch it.
 */
export const ISSUER_DIRECTORIES: Record<string, () => Promise<IssuerDirectory>> = {
  "ca-on-licence-issuers": async () => {
    const data = (await import("../../../../content/regulatory/readiness/ca-on-licence-issuers.json", { with: { type: "json" } })).default as unknown as {
      directoryId: string; attribution: string; licenceUrl: string; retrievedAt: string; issuers: LicenceIssuer[];
    };
    return {
      directoryId: data.directoryId,
      attribution: data.attribution,
      licenceUrl: data.licenceUrl,
      retrievedAt: data.retrievedAt,
      issuers: data.issuers,
    };
  },
};
