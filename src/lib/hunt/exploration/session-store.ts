/**
 * Where a hunter was, kept on their own device.
 *
 * Coming back to Hunt should not mean searching again. The URL carries the
 * shareable intent (§41A "Shareable Hunt state"); everything else — the place
 * they chose, the camera, the sheet, the layers they switched on, and the
 * places they searched recently — lives in this browser and nowhere else. It
 * is never sent to North Ground, never put in a URL, a Hunt Brief or analytics.
 *
 * Two rules keep it honest:
 *
 * - A hunt location set from the DEVICE is not stored. §41A keeps the device
 *   fix out of anything persistent, and a stored "Your location" would quietly
 *   keep a person's real position on disk. The zone it resolved to is stored,
 *   so the answer still comes back; the point does not.
 * - A stored day in the past is not restored. Seasons turn on the date, and
 *   silently evaluating a day that has gone would answer a question nobody
 *   asked. It falls back to today, and everything is evaluated again anyway.
 *
 * Storage can be absent, full, or blocked outright (Safari's private mode
 * throws on write). Every path here answers with defaults instead of throwing.
 */

import { isValidIso } from "../date.ts";

export interface StoredPlace {
  label: string;
  latitude: number;
  longitude: number;
  /** How it was chosen. "device" is never stored; see above. */
  origin: "search" | "map";
}

export interface StoredCamera {
  latitude: number;
  longitude: number;
  zoom: number;
}

export interface HuntSessionMemory {
  hunt: StoredPlace | null;
  zoneId: string | null;
  speciesId: string | null;
  date: string | null;
  camera: StoredCamera | null;
  overlays: string[];
  /** How strongly boundaries are drawn: a per-device preference, not a product decision. */
  emphasis: "light" | "standard" | "strong" | null;
  snap: "peek" | "half" | "full" | null;
  explore: boolean;
  recents: StoredPlace[];
}

export const EMPTY_SESSION: HuntSessionMemory = {
  hunt: null, zoneId: null, speciesId: null, date: null,
  camera: null, overlays: [], emphasis: null, snap: null, explore: false, recents: [],
};

const KEY = "north-ground.hunt.session.v1";
export const MAX_RECENTS = 6;

/** A storage that can be missing or throw on every call, as browsers' can. */
export interface MemoryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function readPlace(value: unknown): StoredPlace | null {
  if (!value || typeof value !== "object") return null;
  const place = value as Partial<StoredPlace>;
  if (typeof place.label !== "string" || !place.label.trim()) return null;
  if (!isFiniteNumber(place.latitude) || !isFiniteNumber(place.longitude)) return null;
  if (Math.abs(place.latitude) > 90 || Math.abs(place.longitude) > 180) return null;
  // Anything not chosen as a place — a device fix from an older build — is dropped.
  if (place.origin !== "search" && place.origin !== "map") return null;
  return { label: place.label, latitude: place.latitude, longitude: place.longitude, origin: place.origin };
}

/**
 * What was stored, as far as it can be trusted. A value that does not read
 * back as itself is dropped on its own; the rest of the session survives.
 */
export function parseSession(raw: string | null, today: string): HuntSessionMemory {
  if (!raw) return EMPTY_SESSION;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return EMPTY_SESSION;
  }
  if (!value || typeof value !== "object") return EMPTY_SESSION;
  const stored = value as Partial<HuntSessionMemory>;
  const camera = stored.camera && isFiniteNumber(stored.camera.latitude) && isFiniteNumber(stored.camera.longitude)
    && isFiniteNumber(stored.camera.zoom) && stored.camera.zoom >= 2 && stored.camera.zoom <= 20
    ? { latitude: stored.camera.latitude, longitude: stored.camera.longitude, zoom: stored.camera.zoom }
    : null;
  // A real calendar day, and not one that has gone.
  const date = isValidIso(stored.date) && stored.date >= today ? stored.date : null;
  return {
    hunt: readPlace(stored.hunt),
    zoneId: typeof stored.zoneId === "string" && stored.zoneId.startsWith("management_zone:") ? stored.zoneId : null,
    speciesId: typeof stored.speciesId === "string" && stored.speciesId.startsWith("species:") ? stored.speciesId : null,
    date,
    camera,
    overlays: Array.isArray(stored.overlays) ? stored.overlays.filter((id): id is string => typeof id === "string").slice(0, 12) : [],
    emphasis: stored.emphasis === "light" || stored.emphasis === "standard" || stored.emphasis === "strong" ? stored.emphasis : null,
    snap: stored.snap === "peek" || stored.snap === "half" || stored.snap === "full" ? stored.snap : null,
    explore: stored.explore === true,
    recents: Array.isArray(stored.recents)
      ? stored.recents.map(readPlace).filter((place): place is StoredPlace => place !== null).slice(0, MAX_RECENTS)
      : [],
  };
}

/** The places searched lately, newest first, without repeating one. */
export function withRecent(recents: readonly StoredPlace[], place: StoredPlace): StoredPlace[] {
  const same = (one: StoredPlace, other: StoredPlace) =>
    one.label === other.label
    || (Math.abs(one.latitude - other.latitude) < 0.0005 && Math.abs(one.longitude - other.longitude) < 0.0005);
  return [place, ...recents.filter((entry) => !same(entry, place))].slice(0, MAX_RECENTS);
}

/** What may be written: a device-origin hunt is dropped rather than stored. */
export function sessionToStore(session: HuntSessionMemory): HuntSessionMemory {
  return { ...session, hunt: session.hunt && session.hunt.origin !== "search" && session.hunt.origin !== "map" ? null : session.hunt };
}

export function readSession(storage: MemoryStorage | null | undefined, today: string): HuntSessionMemory {
  if (!storage) return EMPTY_SESSION;
  try {
    return parseSession(storage.getItem(KEY), today);
  } catch {
    return EMPTY_SESSION;
  }
}

/**
 * Whether there is anything here worth coming back to. A camera position on
 * its own is not: after "start over" the map is still somewhere, and a record
 * that only says where the map sits would make starting over leave a trace.
 */
export function isWorthRemembering(session: HuntSessionMemory): boolean {
  return Boolean(session.hunt || session.zoneId || session.speciesId || session.recents.length || session.overlays.length || (session.emphasis && session.emphasis !== "standard"));
}

export function writeSession(storage: MemoryStorage | null | undefined, session: HuntSessionMemory): void {
  if (!storage) return;
  try {
    if (!isWorthRemembering(session)) {
      storage.removeItem(KEY);
      return;
    }
    storage.setItem(KEY, JSON.stringify(sessionToStore(session)));
  } catch {
    // Full, blocked, or a private window: the session simply is not remembered.
  }
}

export function clearSession(storage: MemoryStorage | null | undefined): void {
  if (!storage) return;
  try {
    storage.removeItem(KEY);
  } catch {
    // Nothing to do: it was not readable anyway.
  }
}

/** The browser's own storage when it will answer, and nothing when it will not. */
export function browserStorage(): MemoryStorage | null {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return null;
    // Private windows throw only on write, so prove it now rather than later.
    const probe = `${KEY}.probe`;
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}
