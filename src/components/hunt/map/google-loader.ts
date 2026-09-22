"use client";

/**
 * Loading the Maps JavaScript API, once.
 *
 * `loading=async` is the recommended bootstrap, and with it the script's own
 * `onload` fires BEFORE `google.maps` exists — resolving there reported every
 * load as a failure and dropped Hunt to its boundary view. The documented
 * signal is the `callback` parameter, which fires when the library is usable.
 *
 * A refused key (wrong referrer, disabled API, billing) is reported through
 * `gm_authFailure` AFTER the library has loaded, leaving a grey map behind.
 * Hunt listens for it and falls back to its own boundary view instead.
 */

import { MAPS_READY_CALLBACK as READY_CALLBACK, mapsScriptUrl } from "./maps-script";

let googleMapsPromise: Promise<typeof google.maps> | null = null;
const authFailureListeners = new Set<() => void>();
let authFailed = false;

export function onGoogleAuthFailure(listener: () => void): () => void {
  if (authFailed) listener();
  authFailureListeners.add(listener);
  return () => authFailureListeners.delete(listener);
}

export function loadGoogleMaps(apiKey: string): Promise<typeof google.maps> {
  if (googleMapsPromise) return googleMapsPromise;
  googleMapsPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("Google Maps needs a browser"));
    if (window.google?.maps?.Map) return resolve(window.google.maps);

    const globals = window as unknown as Record<string, unknown>;
    globals.gm_authFailure = () => {
      authFailed = true;
      for (const listener of authFailureListeners) listener();
    };
    const fail = (reason: string) => {
      googleMapsPromise = null;
      delete globals[READY_CALLBACK];
      reject(new Error(reason));
    };
    globals[READY_CALLBACK] = () => {
      delete globals[READY_CALLBACK];
      if (window.google?.maps) resolve(window.google.maps);
      else fail("Google Maps signalled ready without an API");
    };

    const script = document.createElement("script");
    script.src = mapsScriptUrl(apiKey);
    script.async = true;
    script.onerror = () => fail("Google Maps failed to load");
    document.head.appendChild(script);
  });
  return googleMapsPromise;
}

/**
 * A muted natural basemap: land and water stay distinct and roads legible, so
 * the regulatory overlay is the brightest thing on the map without the ground
 * underneath it disappearing.
 */
export const BASEMAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#20261f" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#a7ae9e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#11140f" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#3a4038" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#232b21" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#26331f" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#33382f" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#99a08f" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#4a4a36" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#13212b" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#5c7b8c" }] },
];
