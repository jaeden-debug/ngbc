import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  explorationReducer, INITIAL_EXPLORATION,
  type ExplorationEvent, type ExplorationState, type HuntLocation, type SelfFix,
} from "./map-state.ts";

const FIX: SelfFix = { latitude: 48.3809, longitude: -89.2477, accuracyMeters: 35, at: 1_000 };
const BANCROFT: HuntLocation = { label: "Bancroft, Ontario", latitude: 45.0573, longitude: -77.8546, origin: "search" };
const WMU_57 = { layerId: "layer:ca-on-wmu", designation: "57" };

function run(events: ExplorationEvent[], from: ExplorationState = INITIAL_EXPLORATION): ExplorationState {
  return events.reduce(explorationReducer, from);
}

test("device location never becomes the hunt location on its own", () => {
  const state = run([{ type: "SELF_REQUESTED" }, { type: "SELF_FIX", fix: FIX }, { type: "RECENTER" }, { type: "SELF_FIX", fix: { ...FIX, at: 2_000 } }]);
  assert.equal(state.self.status, "live");
  assert.equal(state.hunt, null);
  assert.deepEqual(state.selection, { kind: "none" });
  assert.equal(state.pin, null);
});

test("a device fix and recentring leave an existing hunt location, its zone and its card untouched", () => {
  const hunting = run([{ type: "HUNT_SET", location: BANCROFT }, { type: "HUNT_ZONE_RESOLVED", zone: WMU_57 }]);
  const after = run([
    { type: "SELF_REQUESTED" }, { type: "SELF_FIX", fix: FIX }, { type: "RECENTER" },
    { type: "SELF_FAILED", reason: "timeout" }, { type: "RECENTER" },
  ], hunting);
  assert.deepEqual(after.hunt, BANCROFT);
  assert.deepEqual(after.selection, hunting.selection);
  assert.equal(after.cardOpen, true);
  assert.equal(after.camera?.target, "self", "recentring moves the camera, and only the camera");
});

test("recentre: centres when live, asks for permission when never asked, explains when denied", () => {
  const live = run([{ type: "SELF_FIX", fix: FIX }, { type: "RECENTER" }]);
  assert.equal(live.camera?.target, "self");

  const asked = run([{ type: "RECENTER" }]);
  assert.equal(asked.self.status, "requesting");
  assert.equal(asked.recenterPending, true);
  const fulfilled = explorationReducer(asked, { type: "SELF_FIX", fix: FIX });
  assert.equal(fulfilled.camera?.target, "self", "the first fix after an explicit recentre centres the map");
  assert.equal(fulfilled.recenterPending, false);

  const denied = run([{ type: "RECENTER" }, { type: "SELF_FAILED", reason: "denied" }]);
  assert.equal(denied.notice, "self-denied");
  const again = explorationReducer(explorationReducer(denied, { type: "NOTICE_DISMISSED" }), { type: "RECENTER" });
  assert.equal(again.notice, "self-denied", "a denied permission is explained, never re-prompted in a loop");
  assert.equal(again.self.status, "failed");
});

test("a live dot survives a later timeout, but not a revoked permission", () => {
  const timedOut = run([{ type: "SELF_FIX", fix: FIX }, { type: "SELF_FAILED", reason: "timeout" }]);
  assert.equal(timedOut.self.status, "live");
  const revoked = run([{ type: "SELF_FIX", fix: FIX }, { type: "SELF_FAILED", reason: "denied" }]);
  assert.equal(revoked.self.status, "failed");
});

test("choosing a search result sets the hunt location, and its resolved zone opens the card", () => {
  const set = run([{ type: "HUNT_SET", location: BANCROFT }]);
  assert.deepEqual(set.hunt, BANCROFT);
  assert.equal(set.camera?.target, "hunt");
  const resolved = explorationReducer(set, { type: "HUNT_ZONE_RESOLVED", zone: WMU_57 });
  assert.deepEqual(resolved.selection, { kind: "zone", zone: WMU_57, origin: "hunt" });
  assert.equal(resolved.cardOpen, true);
  assert.equal(resolved.camera?.target, "zone");
});

test("a zone resolution with no hunt location opens nothing", () => {
  const state = run([{ type: "HUNT_ZONE_RESOLVED", zone: WMU_57 }]);
  assert.equal(state.cardOpen, false);
});

test("a confirmed map pin becomes the hunt location; a preview alone does not", () => {
  const point = { latitude: 49.1234567, longitude: -97.7654321 };
  const previewing = run([{ type: "PIN_PRESSED", point }]);
  assert.equal(previewing.hunt, null, "a preview is not a selection");
  const confirmed = explorationReducer(previewing, { type: "PIN_CONFIRMED", label: "Point chosen on the map" });
  assert.deepEqual(confirmed.hunt, { latitude: 49.123457, longitude: -97.765432, label: "Point chosen on the map", origin: "map" });
  assert.equal(confirmed.pin, null);
});

test("an accidental tap, a zone tap or a cancelled preview never selects a hunting location", () => {
  const point = { latitude: 49.1, longitude: -97.7 };
  const state = run([
    { type: "MAP_TAPPED_EMPTY" },
    { type: "ZONE_SELECTED", zone: WMU_57, origin: "map" },
    { type: "PIN_PRESSED", point },
    { type: "MAP_TAPPED_EMPTY" },
    { type: "PIN_CENTRE_STARTED", point },
    { type: "PIN_CENTRE_MOVED", point: { latitude: 49.2, longitude: -97.8 } },
    { type: "PIN_CANCELLED" },
    { type: "PIN_CONFIRMED", label: "nothing to confirm" },
  ]);
  assert.equal(state.hunt, null);
});

test("a tap cancels a pressed preview but keeps a centre-follow preview the person is steering", () => {
  const point = { latitude: 49.1, longitude: -97.7 };
  assert.equal(run([{ type: "PIN_PRESSED", point }, { type: "MAP_TAPPED_EMPTY" }]).pin, null);
  assert.notEqual(run([{ type: "PIN_CENTRE_STARTED", point }, { type: "MAP_TAPPED_EMPTY" }]).pin, null);
});

test("closing an explored zone falls back to the hunt zone, never to nothing", () => {
  const state = run([
    { type: "HUNT_SET", location: BANCROFT },
    { type: "HUNT_ZONE_RESOLVED", zone: WMU_57 },
    { type: "ZONE_SELECTED", zone: { layerId: "layer:ca-mb-gha", designation: "26" }, origin: "map" },
    { type: "CARD_CLOSED" },
  ]);
  assert.deepEqual(state.selection, { kind: "zone", zone: WMU_57, origin: "hunt" });
  assert.equal(state.cardOpen, false);
});

test("a late place name only relabels the point it was asked for", () => {
  const point = { latitude: 49.1, longitude: -97.7 };
  const confirmed = run([{ type: "PIN_PRESSED", point }, { type: "PIN_CONFIRMED", label: "Point chosen on the map" }]);
  assert.equal(explorationReducer(confirmed, { type: "HUNT_LABELLED", point, label: "Near Carman" }).hunt?.label, "Near Carman");
  const moved = explorationReducer(confirmed, { type: "HUNT_SET", location: BANCROFT });
  assert.equal(explorationReducer(moved, { type: "HUNT_LABELLED", point, label: "Near Carman" }).hunt?.label, BANCROFT.label);
});

test("without geolocation the map still explores, previews and selects", () => {
  const state = run([
    { type: "RECENTER" }, { type: "SELF_FAILED", reason: "unsupported" },
    { type: "ZONE_SELECTED", zone: WMU_57, origin: "list" },
    { type: "PIN_PRESSED", point: { latitude: 45.1, longitude: -77.9 } },
    { type: "PIN_CONFIRMED", label: "Point chosen on the map" },
  ]);
  assert.equal(state.notice, "self-unavailable");
  assert.equal(state.hunt?.origin, "map");
});

test("only HUNT_SET, PIN_CONFIRMED, HUNT_LABELLED and HUNT_CLEARED ever change the hunt location", () => {
  const events: ExplorationEvent[] = [
    { type: "SELF_REQUESTED" }, { type: "SELF_FIX", fix: FIX }, { type: "SELF_FAILED", reason: "denied" },
    { type: "SELF_FAILED", reason: "timeout" }, { type: "RECENTER" }, { type: "NOTICE_DISMISSED" },
    { type: "ZONE_SELECTED", zone: WMU_57, origin: "map" }, { type: "OVERLAY_SELECTED", layerId: "overlay:ca-mb-refuges", objectId: 1 },
    { type: "CARD_CLOSED" }, { type: "MAP_TAPPED_EMPTY" }, { type: "PIN_PRESSED", point: { latitude: 50, longitude: -97 } },
    { type: "PIN_CENTRE_STARTED", point: { latitude: 50, longitude: -97 } }, { type: "PIN_CENTRE_MOVED", point: { latitude: 51, longitude: -98 } },
    { type: "PIN_CANCELLED" }, { type: "HUNT_ZONE_RESOLVED", zone: WMU_57 },
  ];
  const allowed = new Set(["HUNT_SET", "PIN_CONFIRMED", "HUNT_LABELLED", "HUNT_CLEARED"]);
  // A deterministic walk through many orderings, starting from a state that has a hunt location.
  let seed = 7;
  const next = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
  let state = run([{ type: "HUNT_SET", location: BANCROFT }]);
  for (let step = 0; step < 5_000; step += 1) {
    const event = events[Math.floor(next() * events.length)];
    const after = explorationReducer(state, event);
    if (!allowed.has(event.type)) assert.deepEqual(after.hunt, state.hunt, `${event.type} changed the hunt location`);
    if (event.type.startsWith("SELF_") || event.type === "RECENTER") {
      assert.deepEqual(after.selection, state.selection, `${event.type} changed the selection`);
      assert.deepEqual(after.pin, state.pin, `${event.type} changed the pin`);
    }
    state = after;
  }
});

test("the device location never reaches the evaluation, the result or a Hunt Brief", () => {
  /* The composer is the only place that builds evaluation and share payloads.
     It reads the hunt location and nothing else; the device fix lives in the
     map's state and has no path into either. */
  const composer = readFileSync(new URL("../../../components/hunt/HuntComposer.tsx", import.meta.url), "utf8");
  const result = readFileSync(new URL("../../../components/hunt/HuntResult.tsx", import.meta.url), "utf8");
  const code = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  for (const [name, source] of [["HuntComposer", composer], ["HuntResult", result]] as const) {
    assert.doesNotMatch(code(source), /exploration\.self|\.fix\b|SelfFix|selfFix/, `${name} must not read the device location`);
  }
  assert.match(composer, /const location: HuntLocation \| null = exploration\.hunt;/);
});
