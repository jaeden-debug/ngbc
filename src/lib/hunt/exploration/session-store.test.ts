import assert from "node:assert/strict";
import test from "node:test";
import {
  browserStorage, clearSession, EMPTY_SESSION, isWorthRemembering, MAX_RECENTS, parseSession,
  readSession, sessionToStore, withRecent, writeSession,
  type HuntSessionMemory, type MemoryStorage, type StoredPlace,
} from "./session-store.ts";

const TODAY = "2026-09-22";
const DELEAGE: StoredPlace = { label: "Déléage, Québec", latitude: 46.37, longitude: -75.99, origin: "search" };
const SPOT: StoredPlace = { label: "Spot chosen on the map", latitude: 45.06, longitude: -77.85, origin: "map" };

function fakeStorage(initial: Record<string, string> = {}): MemoryStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => { data[key] = value; },
    removeItem: (key) => { delete data[key]; },
  };
}

const FULL: HuntSessionMemory = {
  hunt: DELEAGE, zoneId: "management_zone:ca-qc-zone-10o", speciesId: "species:moose",
  date: "2026-10-01", camera: { latitude: 46.3, longitude: -76, zoom: 9 },
  overlays: ["layer:ca-mb-refuges"], emphasis: "strong", snap: "half", explore: false, recents: [DELEAGE, SPOT],
};

test("a whole session survives a round trip", () => {
  const storage = fakeStorage();
  writeSession(storage, FULL);
  assert.deepEqual(readSession(storage, TODAY), FULL);
});

test("a hunt taken from the device is never written", () => {
  const storage = fakeStorage();
  const fromDevice = { ...FULL, hunt: { ...DELEAGE, label: "Your location", origin: "device" as unknown as StoredPlace["origin"] } };
  writeSession(storage, fromDevice);
  const read = readSession(storage, TODAY);
  assert.equal(read.hunt, null, "the device's own position does not persist");
  assert.equal(read.zoneId, FULL.zoneId, "the zone it resolved to still comes back");
  assert.equal(sessionToStore(fromDevice).hunt, null);
});

test("a stored day that has passed is not restored", () => {
  const storage = fakeStorage();
  writeSession(storage, { ...FULL, date: "2026-09-21" });
  assert.equal(readSession(storage, TODAY).date, null, "yesterday falls back to today's default");
  writeSession(storage, { ...FULL, date: TODAY });
  assert.equal(readSession(storage, TODAY).date, TODAY, "today is kept");
});

test("nonsense is dropped field by field, not wholesale", () => {
  const session = parseSession(JSON.stringify({
    hunt: { label: "", latitude: 46, longitude: -76, origin: "search" },
    zoneId: "57",
    speciesId: "moose",
    date: "2026-13-40",
    camera: { latitude: 46, longitude: -76, zoom: 99 },
    overlays: ["layer:ok", 7],
    snap: "enormous",
    emphasis: "blinding",
    explore: "yes",
    recents: [DELEAGE, { label: "bad" }],
  }), TODAY);
  assert.deepEqual(session, { ...EMPTY_SESSION, overlays: ["layer:ok"], recents: [DELEAGE] });
});

test("unreadable or blocked storage reads as an empty session and never throws", () => {
  const blocked: MemoryStorage = {
    getItem: () => { throw new Error("blocked"); },
    setItem: () => { throw new Error("blocked"); },
    removeItem: () => { throw new Error("blocked"); },
  };
  assert.deepEqual(readSession(blocked, TODAY), EMPTY_SESSION);
  assert.doesNotThrow(() => writeSession(blocked, FULL));
  assert.doesNotThrow(() => clearSession(blocked));
  assert.deepEqual(readSession(null, TODAY), EMPTY_SESSION);
  assert.deepEqual(parseSession("not json", TODAY), EMPTY_SESSION);
  assert.deepEqual(parseSession(null, TODAY), EMPTY_SESSION);
});

test("clearing leaves nothing behind, recents included", () => {
  const storage = fakeStorage();
  writeSession(storage, FULL);
  clearSession(storage);
  assert.deepEqual(readSession(storage, TODAY), EMPTY_SESSION);
  assert.deepEqual(Object.keys(storage.data), []);
});

test("recent places are newest first, never repeated, and bounded", () => {
  let recents = withRecent([], DELEAGE);
  recents = withRecent(recents, SPOT);
  assert.deepEqual(recents.map((place) => place.label), [SPOT.label, DELEAGE.label]);
  // Choosing the same place again moves it to the front rather than duplicating it.
  recents = withRecent(recents, DELEAGE);
  assert.deepEqual(recents.map((place) => place.label), [DELEAGE.label, SPOT.label]);
  // The same point under a different name counts as the same place.
  recents = withRecent(recents, { ...DELEAGE, label: "Déléage" });
  assert.equal(recents.length, 2);
  for (let index = 0; index < 10; index += 1) {
    recents = withRecent(recents, { label: `Place ${index}`, latitude: 50 + index, longitude: -100 - index, origin: "search" });
  }
  assert.equal(recents.length, MAX_RECENTS);
});

test("a browser without storage is simply a browser that does not remember", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, get: () => { throw new Error("blocked"); } });
  assert.equal(browserStorage(), null);
  if (original) Object.defineProperty(globalThis, "localStorage", original);
  else delete (globalThis as { localStorage?: unknown }).localStorage;
});

test("a session with nothing chosen is not stored, so starting over leaves no trace", () => {
  const storage = fakeStorage();
  writeSession(storage, FULL);
  assert.notDeepEqual(Object.keys(storage.data), []);
  // What the app writes right after "start over": a map position and today.
  const emptied = { ...EMPTY_SESSION, camera: { latitude: 52, longitude: -90, zoom: 4 }, date: TODAY, snap: "peek" as const };
  assert.equal(isWorthRemembering(emptied), false);
  writeSession(storage, emptied);
  assert.deepEqual(Object.keys(storage.data), []);
  assert.equal(isWorthRemembering({ ...emptied, zoneId: "management_zone:ca-on-wmu-57" }), true);
});

test("a boundary-strength preference is remembered, and only when it is not the default", () => {
  const storage = fakeStorage();
  writeSession(storage, { ...EMPTY_SESSION, emphasis: "light" });
  assert.equal(readSession(storage, TODAY).emphasis, "light");
  // Standard is the tuned default, so it is not worth a record of its own.
  writeSession(storage, { ...EMPTY_SESSION, emphasis: "standard" });
  assert.equal(readSession(storage, TODAY).emphasis, null);
});
