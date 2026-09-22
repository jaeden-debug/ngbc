import type { CanonicalId } from "../../content-contract/index.ts";
import { isValidIso } from "../date.ts";

/**
 * What of a Hunt belongs in its URL, and how it is read back.
 *
 *   /hunt?zone=ca-on-wmu-57&species=white-tailed-deer&date=2026-09-22&explore=1
 *
 * The URL carries the hunt's CONTEXT — which official zone, which species, which
 * day, and whether the map is coloured by that species — and nothing about the
 * person. It never carries a coordinate: a shared hunt names the zone, not the
 * spot, and a device position must never reach a URL at all.
 *
 * A zone is named by its canonical id, never by a label or a bare number. "57"
 * is a WMU in Ontario and could be a zone elsewhere; `ca-on-wmu-57` is one zone.
 * Labels are presentation and may change with locale; the id cannot.
 *
 * Every parameter is validated on its own and a bad one is dropped on its own,
 * so a link with a mistyped date still opens its zone and species. Nothing read
 * here is trusted further than its shape: whether the zone exists is decided by
 * the official geometry, and whether a species can be evaluated there is
 * decided by the regulatory registry.
 */

export interface HuntUrlState {
  /** Canonical management-zone id, `management_zone:ca-on-wmu-57`. */
  zoneId: CanonicalId<"management_zone"> | null;
  /** Canonical species id, `species:white-tailed-deer`. */
  speciesId: CanonicalId<"species"> | null;
  /** An explicitly chosen hunt day. Absent means "today", decided on the device. */
  date: string | null;
  /** Colour the map's zones by the selected species' season status. */
  explore: boolean;
}

export const EMPTY_HUNT_URL_STATE: HuntUrlState = { zoneId: null, speciesId: null, date: null, explore: false };

const ZONE_PREFIX = "management_zone:";
const SPECIES_PREFIX = "species:";
/** Lower-case slug segments, as every canonical id mints them. */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SLUG_LENGTH = 96;

type Params = URLSearchParams | Record<string, string | string[] | undefined>;

function read(params: Params, name: string): string | null {
  if (params instanceof URLSearchParams) return params.get(name);
  const value = params[name];
  // A repeated parameter is ambiguous; neither copy is chosen for the reader.
  if (Array.isArray(value)) return null;
  return typeof value === "string" ? value : null;
}

function slugOf(value: string | null, prefix: string): string | null {
  if (value === null) return null;
  const trimmed = value.trim().toLowerCase();
  const slug = trimmed.startsWith(prefix) ? trimmed.slice(prefix.length) : trimmed;
  return slug.length > 0 && slug.length <= MAX_SLUG_LENGTH && SLUG.test(slug) ? slug : null;
}

export interface HuntUrlValidators {
  /** Whether a canonical zone id belongs to a zone layer Hunt serves. Shape only; existence is the map's to confirm. */
  isServedZoneId(id: CanonicalId<"management_zone">): boolean;
  /** Whether a canonical species id is a published species. */
  isPublishedSpecies(id: CanonicalId<"species">): boolean;
}

export interface ParsedHuntUrl {
  state: HuntUrlState;
  /** Parameters present but refused, so the interface can say a link was only partly understood. */
  rejected: Array<keyof HuntUrlState>;
}

export function parseHuntUrlState(params: Params, validators: HuntUrlValidators): ParsedHuntUrl {
  const rejected: Array<keyof HuntUrlState> = [];

  const rawZone = read(params, "zone");
  const zoneSlug = slugOf(rawZone, ZONE_PREFIX);
  const zoneId = zoneSlug ? (`${ZONE_PREFIX}${zoneSlug}` as CanonicalId<"management_zone">) : null;
  const zone = zoneId && validators.isServedZoneId(zoneId) ? zoneId : null;
  if (rawZone !== null && !zone) rejected.push("zoneId");

  const rawSpecies = read(params, "species");
  const speciesSlug = slugOf(rawSpecies, SPECIES_PREFIX);
  const speciesCandidate = speciesSlug ? (`${SPECIES_PREFIX}${speciesSlug}` as CanonicalId<"species">) : null;
  const speciesId = speciesCandidate && validators.isPublishedSpecies(speciesCandidate) ? speciesCandidate : null;
  if (rawSpecies !== null && !speciesId) rejected.push("speciesId");

  const rawDate = read(params, "date");
  const date = rawDate !== null && isValidIso(rawDate.trim()) ? rawDate.trim() : null;
  if (rawDate !== null && !date) rejected.push("date");

  const rawExplore = read(params, "explore");
  const explore = rawExplore === "1" || rawExplore === "true";
  if (rawExplore !== null && !explore && rawExplore !== "0" && rawExplore !== "false") rejected.push("explore");

  return { state: { zoneId: zone, speciesId, date, explore }, rejected };
}

/**
 * The query string for a state, in a fixed order so equal states have equal
 * URLs. `explore` is written only when it has a species to colour by.
 */
export function serializeHuntUrlState(state: HuntUrlState): string {
  const params = new URLSearchParams();
  if (state.zoneId) params.set("zone", state.zoneId.slice(ZONE_PREFIX.length));
  if (state.speciesId) params.set("species", state.speciesId.slice(SPECIES_PREFIX.length));
  if (state.date) params.set("date", state.date);
  if (state.explore && state.speciesId) params.set("explore", "1");
  return params.toString();
}

/** A Hunt link, relative unless an origin is given. */
export function huntDeepLink(state: HuntUrlState, origin?: string): string {
  const query = serializeHuntUrlState(state);
  const path = query ? `/hunt?${query}` : "/hunt";
  return origin ? new URL(path, origin).toString() : path;
}

/** The zone a canonical id names, when a layer mints ids with a known prefix. */
export function zoneRefFromId(
  zoneId: string,
  layers: ReadonlyArray<{ id: string; zoneIdPrefix: string }>,
): { layerId: string; designation: string } | null {
  // The longest prefix wins, as in `layerOfZoneId`: a state with several
  // geographies can never have one mistaken for another.
  const layer = layers
    .filter((candidate) => zoneId.startsWith(candidate.zoneIdPrefix))
    .sort((a, b) => b.zoneIdPrefix.length - a.zoneIdPrefix.length)[0];
  if (!layer) return null;
  const suffix = zoneId.slice(layer.zoneIdPrefix.length);
  if (!SLUG.test(suffix)) return null;
  // Ids are minted by lower-casing the designation; every served authority
  // writes its designations in capitals (57, 64B, 69A-1, 10O). Whether the
  // designation exists is for the drawn geometry to confirm.
  return { layerId: layer.id, designation: suffix.toUpperCase() };
}
