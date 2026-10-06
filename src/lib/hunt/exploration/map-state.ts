/**
 * The Hunt map's interaction state, as one explicit machine.
 *
 * Three locations exist on this map and must never be confused:
 *
 *   self   — where the DEVICE is. Optional, live, ephemeral map context. It is
 *            shown as the familiar blue dot and can centre the camera. It is
 *            never persisted, never sent to North Ground, and never becomes
 *            the hunt location by itself.
 *   hunt   — where the person PLANS TO HUNT. Set only by a deliberate act:
 *            choosing a search result, confirming a dropped pin, or the
 *            explicit "Hunt at my location" action. Zone resolution, the
 *            regulatory evaluation, weather, the Hunt Brief and the share
 *            snapshot all read this and nothing else.
 *   pin    — a PREVIEW of a point someone is considering. It becomes the hunt
 *            location only when they confirm it.
 *
 * A future "licence vendor near me" search reads `self` as its own input; it
 * is a separate field of its own and cannot overwrite either of these.
 *
 * The invariant the tests hold: no event whose name begins SELF_ or RECENTER
 * changes `hunt`, `selection` or `pin`, and only HUNT_SET and PIN_CONFIRMED
 * change `hunt` at all.
 */

import type { ZoneRef } from "./states.ts";

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface SelfFix extends GeoPoint {
  /** Radius of the device's own 68% confidence estimate, in metres. */
  accuracyMeters: number;
  /** Epoch milliseconds of the fix. */
  at: number;
}

export type SelfFailure = "denied" | "unsupported" | "insecure" | "position" | "timeout";

export type SelfLocation =
  | { status: "off" }
  | { status: "requesting" }
  | { status: "live"; fix: SelfFix }
  | { status: "failed"; reason: SelfFailure };

export type HuntOrigin = "search" | "device" | "map";

export interface HuntLocation extends GeoPoint {
  label: string;
  origin: HuntOrigin;
}

export type Selection =
  | { kind: "none" }
  /** `hunt`: the zone the hunt location resolved to. `map`/`list`: explored. `link`: named by a shared link. */
  | { kind: "zone"; zone: ZoneRef; origin: "hunt" | "map" | "list" | "link" }
  /** A special regulatory area (a refuge, closed lands) tapped on an overlay layer. */
  | { kind: "overlay"; layerId: string; objectId: number };

export interface PinPreview {
  point: GeoPoint;
  /** `pressed`: a long press or right-click chose it. `centre`: it follows the map centre. */
  mode: "pressed" | "centre";
}

export interface CameraRequest {
  /** Increments on every request, so the same target twice still moves the camera. */
  seq: number;
  /** `pin`: the spot being previewed, which the map then centres the crosshair on.
      `evidence`: where the chosen species' map lies, asked for from its legend. */
  target: "self" | "hunt" | "zone" | "pin" | "evidence";
}

export type MapNotice = null | "self-denied" | "self-unavailable";

export interface ExplorationState {
  self: SelfLocation;
  hunt: HuntLocation | null;
  /** The zone the hunt location resolved to, kept while other zones are explored. */
  huntZone: ZoneRef | null;
  selection: Selection;
  cardOpen: boolean;
  pin: PinPreview | null;
  camera: CameraRequest | null;
  notice: MapNotice;
  /** Recentring was asked for before a fix existed; the first fix fulfils it. */
  recenterPending: boolean;
}

export type ExplorationEvent =
  | { type: "SELF_REQUESTED" }
  | { type: "SELF_FIX"; fix: SelfFix }
  | { type: "SELF_FAILED"; reason: SelfFailure }
  | { type: "RECENTER" }
  /* The species layer's "Show where": the camera only. The hunt, the zone and
     the sheet stay exactly as they were — seeing where a map lies is not
     choosing a place. */
  | { type: "EVIDENCE_SHOWN" }
  | { type: "NOTICE_DISMISSED" }
  | { type: "ZONE_SELECTED"; zone: ZoneRef; origin: "map" | "list" | "link" }
  | { type: "OVERLAY_SELECTED"; layerId: string; objectId: number }
  | { type: "CARD_CLOSED" }
  /**
   * The species layer opened over the zone the hunter is already looking at.
   *
   * Distinct from `CARD_CLOSED` because closing a card and changing what is
   * selected are two different facts, and this needs only the first. §41B:
   * EXPLORE, FIND GAME and CHECK HUNT "share the same species, date, hunt
   * location, selected zone, camera and layer state" — so entering Find game
   * from a zone must not discard the zone.
   *
   * It did. `CARD_CLOSED` falls back to the hunt's own zone, and a deep link
   * carries a zone with no hunt POINT, so the fallback was "none": the
   * selection went, the URL lost `zone=`, and a reload of what looked like the
   * same link opened a different Hunt at the national camera.
   */
  | { type: "LAYER_OPENED_OVER_SELECTION" }
  | { type: "MAP_TAPPED_EMPTY" }
  | { type: "PIN_PRESSED"; point: GeoPoint }
  | { type: "PIN_CENTRE_STARTED"; point: GeoPoint }
  | { type: "PIN_CENTRE_MOVED"; point: GeoPoint }
  | { type: "PIN_CANCELLED" }
  | { type: "PIN_CONFIRMED"; label: string }
  | { type: "HUNT_SET"; location: HuntLocation }
  | { type: "HUNT_ZONE_RESOLVED"; zone: ZoneRef }
  /** A better name for the current hunt point arrived; ignored if the point has since changed. */
  | { type: "HUNT_LABELLED"; point: GeoPoint; label: string }
  | { type: "HUNT_CLEARED" };

export const INITIAL_EXPLORATION: ExplorationState = {
  self: { status: "off" },
  hunt: null,
  huntZone: null,
  selection: { kind: "none" },
  cardOpen: false,
  pin: null,
  camera: null,
  notice: null,
  recenterPending: false,
};

/** Six decimals (~0.1 m): the precision every hunt point is carried at. */
export function roundedPoint(point: GeoPoint): GeoPoint {
  return { latitude: Number(point.latitude.toFixed(6)), longitude: Number(point.longitude.toFixed(6)) };
}

function camera(state: ExplorationState, target: CameraRequest["target"]): CameraRequest {
  return { seq: (state.camera?.seq ?? 0) + 1, target };
}

function sameZone(a: ZoneRef, b: ZoneRef): boolean {
  return a.layerId === b.layerId && a.designation.toUpperCase() === b.designation.toUpperCase();
}

/** The hunt zone, if one is resolved, which a closed exploration falls back to. */
function huntSelection(state: ExplorationState): Selection {
  return state.huntZone ? { kind: "zone", zone: state.huntZone, origin: "hunt" } : { kind: "none" };
}

/**
 * THE clear-selection transition: no zone, no card, no hunt point, no preview
 * pin. Every path that returns the sheet to "Find your hunting zone" goes
 * through here, so the map cannot keep a highlight the sheet has stopped
 * describing.
 *
 * Two things are deliberately NOT touched. The CAMERA stays where it is: a
 * person who searched Maniwaki and closed the answer is still looking at
 * Maniwaki, and yanking the map back would be its own defect (owner,
 * 2026-09-29). And `self` is untouched, because the device dot is map context,
 * never part of a hunt selection (§41A).
 */
function cleared(state: ExplorationState): ExplorationState {
  return { ...state, hunt: null, huntZone: null, selection: { kind: "none" }, cardOpen: false, pin: null };
}

/**
 * Whether the card being closed IS the hunt's own answer rather than a zone
 * being read beside it.
 *
 * Closing your own answer clears it. Closing a zone you were only looking at
 * falls back to the answer you still have — clearing the hunt there would
 * throw away a location the person deliberately set, just because they
 * glanced at a neighbouring zone.
 */
function closingOwnHunt(state: ExplorationState): boolean {
  return state.selection.kind === "zone" && state.selection.origin === "hunt";
}

export function explorationReducer(state: ExplorationState, event: ExplorationEvent): ExplorationState {
  switch (event.type) {
    /* ── Self: map context only ─────────────────────────────────────── */
    case "SELF_REQUESTED":
      return state.self.status === "live" ? state : { ...state, self: { status: "requesting" }, notice: null };
    case "SELF_FIX": {
      const next: ExplorationState = { ...state, self: { status: "live", fix: event.fix }, notice: null };
      return state.recenterPending ? { ...next, recenterPending: false, camera: camera(state, "self") } : next;
    }
    case "SELF_FAILED":
      return {
        ...state,
        // A live fix that later times out stays live: the dot is still the last known position.
        self: state.self.status === "live" && event.reason !== "denied" ? state.self : { status: "failed", reason: event.reason },
        notice: state.recenterPending || event.reason === "denied"
          ? (event.reason === "denied" ? "self-denied" : "self-unavailable")
          : state.notice,
        recenterPending: false,
      };
    case "RECENTER":
      if (state.self.status === "live") return { ...state, camera: camera(state, "self"), notice: null };
      if (state.self.status === "failed" && state.self.reason === "denied") return { ...state, notice: "self-denied" };
      if (state.self.status === "failed" && (state.self.reason === "unsupported" || state.self.reason === "insecure")) {
        return { ...state, notice: "self-unavailable" };
      }
      return { ...state, self: { status: "requesting" }, recenterPending: true, notice: null };
    case "EVIDENCE_SHOWN":
      return { ...state, camera: camera(state, "evidence") };
    case "NOTICE_DISMISSED":
      return { ...state, notice: null };

    /* ── Exploring zones ────────────────────────────────────────────── */
    case "ZONE_SELECTED":
      return {
        ...state,
        selection: state.selection.kind === "zone" && state.selection.origin === "hunt" && sameZone(state.selection.zone, event.zone)
          ? state.selection
          : { kind: "zone", zone: event.zone, origin: event.origin },
        cardOpen: true,
        pin: null,
        camera: camera(state, "zone"),
      };
    case "OVERLAY_SELECTED":
      return { ...state, selection: { kind: "overlay", layerId: event.layerId, objectId: event.objectId }, cardOpen: true, pin: null };
    case "CARD_CLOSED":
      return closingOwnHunt(state) ? cleared(state) : { ...state, cardOpen: false, selection: huntSelection(state) };
    case "LAYER_OPENED_OVER_SELECTION":
      /* The card goes; the zone stays exactly as it was. */
      return state.cardOpen ? { ...state, cardOpen: false } : state;
    case "MAP_TAPPED_EMPTY":
      /* A plain tap never selects a hunting location. It closes what is open
         and cancels a pressed preview; a centre-follow preview is kept, because
         the person is moving the map under it on purpose. */
      return {
        ...state,
        cardOpen: false,
        selection: huntSelection(state),
        pin: state.pin?.mode === "centre" ? state.pin : null,
      };

    /* ── Dropping a pin: preview, then an explicit confirmation ─────── */
    case "PIN_PRESSED":
      return { ...state, pin: { point: event.point, mode: "pressed" }, cardOpen: false, selection: huntSelection(state) };
    case "PIN_CENTRE_STARTED":
      /* The crosshair IS the map centre, so the camera goes to the offered
         point; otherwise the spot would be wherever the map already sat. */
      return {
        ...state,
        pin: { point: event.point, mode: "centre" },
        cardOpen: false,
        selection: huntSelection(state),
        camera: camera(state, "pin"),
      };
    case "PIN_CENTRE_MOVED":
      return state.pin?.mode === "centre" ? { ...state, pin: { point: event.point, mode: "centre" } } : state;
    case "PIN_CANCELLED":
      return { ...state, pin: null };
    case "PIN_CONFIRMED":
      if (!state.pin) return state;
      return {
        ...state,
        hunt: { ...roundedPoint(state.pin.point), label: event.label, origin: "map" },
        huntZone: null,
        pin: null,
        selection: { kind: "none" },
        cardOpen: false,
        camera: camera(state, "hunt"),
      };

    /* ── The hunt location ──────────────────────────────────────────── */
    case "HUNT_SET":
      return {
        ...state,
        hunt: event.location,
        huntZone: null,
        pin: null,
        selection: { kind: "none" },
        cardOpen: false,
        camera: camera(state, "hunt"),
      };
    case "HUNT_ZONE_RESOLVED":
      if (!state.hunt) return state;
      return {
        ...state,
        huntZone: event.zone,
        selection: { kind: "zone", zone: event.zone, origin: "hunt" },
        cardOpen: true,
        camera: camera(state, "zone"),
      };
    case "HUNT_LABELLED":
      return state.hunt && state.hunt.latitude === event.point.latitude && state.hunt.longitude === event.point.longitude
        ? { ...state, hunt: { ...state.hunt, label: event.label } }
        : state;
    case "HUNT_CLEARED":
      return cleared(state);
    default:
      return state;
  }
}
