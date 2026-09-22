/**
 * The one URL the Maps JavaScript API is loaded from.
 *
 * Shared by the page, which asks the browser to fetch it while the HTML is
 * still being parsed, and the loader, which executes it — so the early fetch
 * is the one that is used, never a second download.
 */
export const MAPS_READY_CALLBACK = "__northGroundMapsReady";

export function mapsScriptUrl(apiKey: string): string {
  return `https://maps.googleapis.com/maps/api/js?${new URLSearchParams({
    key: apiKey, v: "weekly", loading: "async", callback: MAPS_READY_CALLBACK,
  })}`;
}
