/**
 * Where a rule applies, decided for one point.
 *
 * Season tables do not always speak in the units a map is drawn in. Manitoba
 * sets grouse seasons by game bird hunting zone, a second geography built partly
 * from Game Hunting Areas and partly from parallels and a surveyed line; it
 * carves CFB Shilo and a waterfowl control area out of seasons; and it gives
 * one deer season only to "those parts of area 38 found within the R.M. of
 * Macdonald". Forcing all of that into "which GHA is the point in" would give
 * confident answers the law does not.
 *
 * What North Ground cannot establish about a point is modelled as a set of
 * possible WORLDS rather than as a vague "maybe" on each rule. The point is in
 * game bird zone 2 or in zone 3 — never both, never neither. It is inside CFB
 * Shilo or it is not. A disputed reading of the regulation holds or it does
 * not. The engine evaluates every consistent world and answers only if they
 * agree, and it names what it could not establish when they do not.
 */

export interface GeographyExpression {
  statedAs: string;
  include: { ghas: string[]; gbhz: number[]; special: string[] };
  exclude: { ghas: string[]; special: string[] };
}

export interface SpecialGeography {
  id: string;
  name: string;
  statedAs: string;
  /** OVERLAY: a published polygon, tested per point. AREA_SET: whole units.
   *  UNRESOLVED: known to exist, with no geometry North Ground can test. */
  resolution: "OVERLAY" | "AREA_SET" | "UNRESOLVED";
  candidateAreas?: string[];
  areas?: string[];
  reason?: string;
  /**
   * [west, south, east, north], proven to contain the whole geography. A point
   * outside it is certainly outside, whatever else is unknown.
   */
  envelope?: [number, number, number, number];
}

export interface GameBirdZones {
  zone1: { northOfLatitude: number; eastOfLongitude: number; andNorthOfLatitude: number };
  zone2Line: { southOfLineBelow: number; northOfLineAbove: number };
  zone4Areas: string[];
  possibleZonesByArea: Record<string, number[]>;
}

export interface GeographyData {
  units?: Array<{ identifier: string; zoneId: string }>;
  gameBirdZones?: GameBirdZones;
  specialGeographies?: SpecialGeography[];
}

export interface PlaceContext {
  zoneId: string;
  latitude: number;
  longitude: number;
  /**
   * Overlay geographies known to contain the point, by id. `null` means the
   * overlay lookup was not available — which is different from "none".
   */
  overlays: ReadonlySet<string> | null;
}

/** One consistent answer to everything North Ground could not establish. */
export interface PlaceWorld {
  area: string | null;
  gameBirdZone: number | null;
  /** Special geographies the point is inside in this world. */
  inside: ReadonlySet<string>;
  /** Whether readings the cross-check disputes hold in this world. */
  disputedReadingsHold: boolean;
}

export interface WorldSet {
  worlds: PlaceWorld[];
  /** Plain statements of what is unknown, for the answer to name. */
  unknowns: Array<{ kind: "GAME_BIRD_ZONE" | "SPECIAL" | "DISPUTE"; statedAs: string }>;
}

const ZONE_LINE_UNKNOWN =
  "This point lies in the band where the line between game bird hunting zones 2 and 3 runs (M.R. 220/86 s. 1.1: the 53rd parallel, " +
  "the east shore of Lake Winnipegosis and the north limit of Township 43). North Ground holds no survey of that line, so it cannot " +
  "place the point on either side of it.";

export function areaOf(data: GeographyData, zoneId: string): string | null {
  return data.units?.find((unit) => unit.zoneId === zoneId)?.identifier ?? null;
}

/**
 * The game bird hunting zones this point can be in, per M.R. 220/86 s. 1.1.
 *
 * Zone 4 is a list of Game Hunting Areas, so it is exact. Zone 1 is defined by
 * parallels and a meridian, so it is exact from the coordinate. The zone 2/3
 * line follows a lake shore and a township line North Ground holds no survey of;
 * inside the band the builder proved it lies in, both remain possible.
 */
export function gameBirdZonesAt(zones: GameBirdZones, area: string, latitude: number, longitude: number): number[] {
  if (zones.zone4Areas.includes(area)) return [4];
  const { zone1, zone2Line } = zones;
  const inZone1 = latitude > zone1.northOfLatitude || (longitude > zone1.eastOfLongitude && latitude > zone1.andNorthOfLatitude);
  let possible: number[];
  if (inZone1) possible = [1];
  else if (latitude > zone2Line.northOfLineAbove) possible = [2];
  else if (latitude < zone2Line.southOfLineBelow) possible = [3];
  else possible = [2, 3];
  // The area's own extent can only narrow what the point allows.
  const byArea = zones.possibleZonesByArea[area];
  if (byArea?.length) {
    const narrowed = possible.filter((zone) => byArea.includes(zone));
    if (narrowed.length) possible = narrowed;
  }
  return possible;
}

function specialById(data: GeographyData, id: string): SpecialGeography {
  const entry = data.specialGeographies?.find((candidate) => candidate.id === id);
  if (!entry) throw new Error(`Rule refers to unknown special geography ${id}`);
  return entry;
}

/**
 * Every consistent world for this point, given the rules that could apply.
 *
 * Only facts some rule actually turns on multiply the worlds: a point far from
 * CFB Shilo is never "maybe inside" it, and a deer rule never asks which game
 * bird zone a point is in.
 */
export function placeWorlds(
  data: GeographyData,
  place: PlaceContext,
  rules: ReadonlyArray<{ geography?: GeographyExpression; disputes?: Array<{ zoneId?: string; statedAs: string }> }>,
): WorldSet {
  const area = areaOf(data, place.zoneId);
  const unknowns: WorldSet["unknowns"] = [];

  let zones: Array<number | null> = [null];
  if (area && rules.some((rule) => rule.geography?.include.gbhz.length)) {
    if (!data.gameBirdZones) throw new Error("A rule is set by game bird hunting zone, but the bundle defines none");
    zones = gameBirdZonesAt(data.gameBirdZones, area, place.latitude, place.longitude);
    if (zones.length > 1) unknowns.push({ kind: "GAME_BIRD_ZONE", statedAs: ZONE_LINE_UNKNOWN });
  }

  const referenced = new Set(rules.flatMap((rule) => [...(rule.geography?.include.special ?? []), ...(rule.geography?.exclude.special ?? [])]));
  const known = new Set<string>();
  const open: string[] = [];
  for (const id of [...referenced].sort()) {
    const entry = specialById(data, id);
    if (!area) continue;
    if (entry.resolution === "AREA_SET") {
      if (entry.areas?.includes(area)) known.add(id);
      continue;
    }
    if (!entry.candidateAreas?.includes(area)) continue;
    if (entry.envelope) {
      const [west, south, east, north] = entry.envelope;
      if (place.longitude < west || place.longitude > east || place.latitude < south || place.latitude > north) continue;
    }
    if (entry.resolution === "OVERLAY" && place.overlays !== null) {
      if (place.overlays.has(id)) known.add(id);
      continue;
    }
    open.push(id);
    unknowns.push({
      kind: "SPECIAL",
      statedAs: entry.resolution === "UNRESOLVED"
        ? `${entry.name} may include this point. ${entry.reason ?? "North Ground holds no boundary for it."}`
        : `${entry.name} lies partly in this Game Hunting Area, and its boundary could not be checked for this point.`,
    });
  }

  const disputed = rules.flatMap((rule) => (rule.disputes ?? []).filter((dispute) => !dispute.zoneId || dispute.zoneId === place.zoneId));
  const readings = disputed.length ? [true, false] : [true];
  for (const dispute of disputed) {
    if (!unknowns.some((unknown) => unknown.statedAs === dispute.statedAs)) unknowns.push({ kind: "DISPUTE", statedAs: dispute.statedAs });
  }

  const worlds: PlaceWorld[] = [];
  const subsets = 1 << open.length;
  for (const gameBirdZone of zones) {
    for (let mask = 0; mask < subsets; mask += 1) {
      const inside = new Set(known);
      open.forEach((id, index) => { if (mask & (1 << index)) inside.add(id); });
      for (const disputedReadingsHold of readings) worlds.push({ area, gameBirdZone, inside, disputedReadingsHold });
    }
  }
  return { worlds, unknowns };
}

/**
 * Whether a rule applies in one world. Always a yes or a no: the uncertainty
 * lives in how many worlds there are, never inside a single one.
 */
export function appliesInWorld(
  rule: {
    geography?: GeographyExpression;
    regulatoryGroupId: string;
    disputes?: Array<{ zoneId?: string; statedAs: string }>;
  },
  groups: ReadonlyMap<string, { zoneIds: string[] }>,
  place: PlaceContext,
  world: PlaceWorld,
): boolean {
  const disputedHere = (rule.disputes ?? []).some((dispute) => !dispute.zoneId || dispute.zoneId === place.zoneId);
  if (disputedHere && !world.disputedReadingsHold) return false;

  const expression = rule.geography;
  if (!expression) return groups.get(rule.regulatoryGroupId)?.zoneIds.includes(place.zoneId) ?? false;
  const area = world.area;
  if (!area) return false;

  const included =
    expression.include.ghas.includes(area) ||
    (world.gameBirdZone !== null && expression.include.gbhz.includes(world.gameBirdZone)) ||
    expression.include.special.some((id) => world.inside.has(id));
  if (!included) return false;
  if (expression.exclude.ghas.includes(area)) return false;
  return !expression.exclude.special.some((id) => world.inside.has(id));
}
