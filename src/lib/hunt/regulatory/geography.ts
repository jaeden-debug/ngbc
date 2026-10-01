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
import type { NorthGroundStatement } from "../provenance.ts";

export interface GeographyExpression {
  statedAs: string;
  include: {
    ghas: string[];
    gbhz: number[];
    special: string[];
    /**
     * THE WHOLE JURISDICTION, as the rule's own scope: a canonical
     * jurisdiction id (`jurisdiction:us-ia`), never a zone or area id.
     *
     * Most United States take listings are statewide ("Entire state open"),
     * and a statewide rule has a geography — the jurisdiction itself. Listing
     * every unit would invent units for a state that publishes none, and a
     * synthetic area would put a zone id on ground no authority drew. So it is
     * its own term: the rule applies at any place North Ground has placed in
     * this jurisdiction — through a unit layer, or through the jurisdiction
     * boundary (§41A, "Resolving inside a jurisdiction is not drawing its
     * boundary") — less `exclude`.
     *
     * A rule scoped narrower than the jurisdiction never uses it. A unit,
     * county or district rule keeps `ghas`/`special` and waits for the
     * authority's own geometry, so a point placed only by the jurisdiction
     * boundary can never reach it.
     */
    jurisdiction?: string;
  };
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
  /**
   * An area a JURISDICTION-WIDE rule carves out or adds ("statewide except
   * …"), tested against the point itself rather than through the units it lies
   * in. Set to the jurisdiction's id. A point placed only by the jurisdiction
   * boundary has no unit to look such an area up by, and must still meet it:
   * without a boundary North Ground can test, it is an open world and the
   * answer is "needs a closer look", never the statewide answer.
   */
  withinJurisdiction?: string;
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
  /**
   * The official zone the point resolved to. ABSENT where the point was placed
   * only in a jurisdiction — by the jurisdiction boundary, for rules whose
   * scope is the whole jurisdiction — and never filled with a stand-in: no
   * authority drew a zone there, so there is none to name.
   */
  zoneId?: string;
  /**
   * The jurisdiction the point is in, read by rules whose geography is the
   * whole jurisdiction (`include.jurisdiction`). A zone point carries it too,
   * so a state's statewide rules and its unit rules compose at one point.
   */
  jurisdictionId?: string;
  latitude: number;
  longitude: number;
  /**
   * POINT (the default): the coordinate is where the hunter will be.
   * ZONE: the question is about the whole zone, so where inside it is unknown.
   * Everything that depends on the exact point — which side of a zone line,
   * whether a refuge or a base contains it — becomes an open world, and the
   * engine answers only where every part of the zone agrees. The coordinate is
   * then not read at all. This is how the map's zone summaries use the same
   * engine as a full Hunt without claiming a point-level answer for a zone.
   */
  scope?: "POINT" | "ZONE";
  /**
   * Overlay geographies known to contain the point, by id. `null` means the
   * overlay lookup was not available — which is different from "none".
   */
  overlays: ReadonlySet<string> | null;
}

/** One consistent answer to everything North Ground could not establish. */
export interface PlaceWorld {
  area: string | null;
  /**
   * The unit a point with NO AREA lies in, in this world — only ever a unit a
   * whole-jurisdiction rule excepts, and only where the point could not be
   * placed in a unit. `null` is the world where it lies in none of them.
   *
   * This is not a stand-in area: no rule is ever matched through it. It exists
   * so "statewide except Unit 5" cannot be read as "statewide" at a point
   * North Ground placed in the state but not in a unit. Unit rules read
   * `area` alone, which stays null.
   */
  unplacedUnit: string | null;
  gameBirdZone: number | null;
  /**
   * Special geographies the point is inside in this world. At a point with no
   * zone it may also hold `unplacedZoneFact(zoneId)`: the world where the point
   * lies in a zone in which a whole-jurisdiction rule's reading is disputed.
   */
  inside: ReadonlySet<string>;
  /** Whether readings the cross-check disputes hold in this world. */
  disputedReadingsHold: boolean;
}

/**
 * The world-fact "this point, which has no zone, lies in zone `zoneId`". Read
 * only to decide whether a dispute scoped to that zone reaches the point.
 */
export function unplacedZoneFact(zoneId: string): string {
  return `unplaced-zone:${zoneId}`;
}

export function isUnplacedZoneFact(id: string): boolean {
  return id.startsWith("unplaced-zone:");
}

export interface WorldSet {
  worlds: PlaceWorld[];
  /** Plain statements of what is unknown, for the answer to name. */
  unknowns: Array<{ kind: "GAME_BIRD_ZONE" | "SPECIAL" | "DISPUTE"; statedAs: string }>;
}

const ZONE_LINE_UNKNOWN_IN_ZONE =
  "Game bird hunting zones divide this Game Hunting Area (M.R. 220/86 s. 1.1), so which one applies depends on where in it you hunt.";

/** Game bird hunting zones some part of this area can be in, when the point is not known. */
function gameBirdZonesInArea(zones: GameBirdZones, area: string): number[] {
  if (zones.zone4Areas.includes(area)) return [4];
  const byArea = zones.possibleZonesByArea[area];
  return byArea?.length ? [...byArea] : [1, 2, 3];
}

const ZONE_LINE_UNKNOWN =
  "This point lies in the band where the line between game bird hunting zones 2 and 3 runs (M.R. 220/86 s. 1.1: the 53rd parallel, " +
  "the east shore of Lake Winnipegosis and the north limit of Township 43). North Ground holds no survey of that line, so it cannot " +
  "place the point on either side of it.";

export function areaOf(data: GeographyData, zoneId: string | undefined): string | null {
  if (!zoneId) return null;
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
  rules: ReadonlyArray<{ geography?: GeographyExpression; disputes?: Array<{ zoneId?: string; words: NorthGroundStatement }> }>,
): WorldSet {
  const area = areaOf(data, place.zoneId);
  const unknowns: WorldSet["unknowns"] = [];

  /*
   * THE RULES WHOSE GEOGRAPHY IS THIS POINT'S WHOLE JURISDICTION, and what
   * they carve out. Every exception a statewide rule makes is tested AT THIS
   * POINT or left open. A point placed only by the jurisdiction boundary has
   * no unit, so an exception stated by unit, or by an area North Ground finds
   * through units, cannot be looked up there — and skipping it handed out
   * "statewide" inside the very place the authority excepted. That failed
   * OPEN: nothing errored, the exception simply never fired.
   */
  const wholeJurisdiction = place.jurisdictionId
    ? rules.filter((rule) => rule.geography?.include.jurisdiction === place.jurisdictionId)
    : [];
  const exceptedSpecials = new Set(wholeJurisdiction.flatMap((rule) => rule.geography!.exclude.special));
  const unplacedUnits = area
    ? []
    : [...new Set(wholeJurisdiction.flatMap((rule) => rule.geography!.exclude.ghas))].sort();
  if (unplacedUnits.length) {
    const statedAs = [...new Set(wholeJurisdiction
      .filter((rule) => rule.geography!.exclude.ghas.length)
      .map((rule) => rule.geography!.statedAs))];
    unknowns.push({
      kind: "SPECIAL",
      statedAs:
        `A rule for the whole jurisdiction excepts unit ${unplacedUnits.join(", ")} (${statedAs.join("; ")}). ` +
        "North Ground placed this point in the jurisdiction, not in a unit, so it cannot say whether the point lies in an excepted unit.",
    });
  }
  /* Disputes a whole-jurisdiction rule carries for one zone. At a point with
     no zone, whether the point is in that zone is itself unknown. */
  const unplacedDisputeZones = place.zoneId
    ? []
    : [...new Set(wholeJurisdiction.flatMap((rule) => (rule.disputes ?? [])
      .map((dispute) => dispute.zoneId)
      .filter((zoneId): zoneId is string => Boolean(zoneId))))].sort();

  let zones: Array<number | null> = [null];
  if (area && rules.some((rule) => rule.geography?.include.gbhz.length)) {
    if (!data.gameBirdZones) throw new Error("A rule is set by game bird hunting zone, but the bundle defines none");
    const wholeZone = place.scope === "ZONE";
    zones = wholeZone
      ? gameBirdZonesInArea(data.gameBirdZones, area)
      : gameBirdZonesAt(data.gameBirdZones, area, place.latitude, place.longitude);
    if (zones.length > 1) unknowns.push({ kind: "GAME_BIRD_ZONE", statedAs: wholeZone ? ZONE_LINE_UNKNOWN_IN_ZONE : ZONE_LINE_UNKNOWN });
  }

  const referenced = new Set(rules.flatMap((rule) => [...(rule.geography?.include.special ?? []), ...(rule.geography?.exclude.special ?? [])]));
  const known = new Set<string>();
  const open: string[] = [];
  for (const id of [...referenced].sort()) {
    const entry = specialById(data, id);
    /* Tested against the point itself, never through a unit: a proven
       envelope can put the point outside, a published boundary read at the
       point says which side it is on, and anything else is an open world. */
    const testAtPoint = (unresolved: string) => {
      if (place.scope !== "ZONE" && entry.envelope) {
        const [west, south, east, north] = entry.envelope;
        if (place.longitude < west || place.longitude > east || place.latitude < south || place.latitude > north) return;
      }
      if (place.scope !== "ZONE" && entry.resolution === "OVERLAY" && place.overlays !== null) {
        if (place.overlays.has(id)) known.add(id);
        return;
      }
      open.push(id);
      unknowns.push({ kind: "SPECIAL", statedAs: unresolved });
    };
    /* An area a jurisdiction-wide rule names is tested against the point, not
       through a unit: a point placed only by the jurisdiction boundary has no
       unit to look it up by, and must still meet the exception. */
    if (entry.withinJurisdiction) {
      if (place.jurisdictionId !== entry.withinJurisdiction) continue;
      testAtPoint(`${entry.name} may include this point. ${entry.reason ?? "North Ground holds no boundary for it that it can test, so it cannot say which side of it you are on."}`);
      continue;
    }
    if (!area) {
      /* No unit, so nothing found through units can be ruled out. Only an
         exception a whole-jurisdiction rule makes matters here — a unit rule
         never reaches a point with no unit, so what it names cannot change
         the answer. */
      if (exceptedSpecials.has(id)) {
        testAtPoint(
          `${entry.name} is excepted from a rule for the whole jurisdiction, and North Ground placed this point in the jurisdiction rather than in a unit, ` +
          `so it cannot say whether the point lies inside it. ${entry.reason ?? ""}`.trim(),
        );
      }
      continue;
    }
    if (entry.resolution === "AREA_SET") {
      if (entry.areas?.includes(area)) known.add(id);
      continue;
    }
    /* An entry with NO candidate areas must not vanish. `!undefined?.includes()`
       is `!undefined`, which is true, so the old guard skipped it silently —
       it did not fail, it never fired. That is the can-only-pass shape in the
       data layer, and British Columbia's Closed Areas Regulation Schedule 1
       names no management unit at all, so every one of its areas would have
       been invisible rather than unresolved. */
    if (!entry.candidateAreas) {
      open.push(id);
      unknowns.push({
        kind: "SPECIAL",
        statedAs: `${entry.name} names no management unit North Ground can match, so it cannot be placed. ${entry.reason ?? "Its boundary is described in words."}`,
      });
      continue;
    }
    if (!entry.candidateAreas.includes(area)) continue;
    if (place.scope === "ZONE") {
      // Part of the zone may be inside it; which part is the whole question.
      open.push(id);
      unknowns.push({ kind: "SPECIAL", statedAs: `${entry.name} covers part of this area, so the answer depends on where in it you hunt.` });
      continue;
    }
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
  const readings = disputed.length || unplacedDisputeZones.length ? [true, false] : [true];
  for (const dispute of disputed) {
    if (!unknowns.some((unknown) => unknown.statedAs === dispute.words.text)) unknowns.push({ kind: "DISPUTE", statedAs: dispute.words.text });
  }
  /* Said as what it is: not a conflict AT this point, but a conflict in a zone
     North Ground cannot say this point is in. */
  for (const zoneId of unplacedDisputeZones) {
    const words = [...new Set(wholeJurisdiction.flatMap((rule) => (rule.disputes ?? [])
      .filter((dispute) => dispute.zoneId === zoneId)
      .map((dispute) => dispute.words.text)))];
    open.push(unplacedZoneFact(zoneId));
    unknowns.push({
      kind: "SPECIAL",
      statedAs: `The sources disagree about a rule for the whole jurisdiction within one zone (${words.join(" ")}). ` +
        "North Ground placed this point in the jurisdiction, not in a zone, so it cannot say whether that disagreement reaches it.",
    });
  }

  const worlds: PlaceWorld[] = [];
  const subsets = 1 << open.length;
  for (const gameBirdZone of zones) {
    /* One unit at a time: a point lies in one unit or in none. */
    for (const unplacedUnit of [null, ...unplacedUnits]) {
      for (let mask = 0; mask < subsets; mask += 1) {
        const inside = new Set(known);
        open.forEach((id, index) => { if (mask & (1 << index)) inside.add(id); });
        for (const disputedReadingsHold of readings) worlds.push({ area, unplacedUnit, gameBirdZone, inside, disputedReadingsHold });
      }
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
    disputes?: Array<{ zoneId?: string; words: NorthGroundStatement }>;
    /**
     * Which side of a dispute this rule is. A disputed rule is ordinarily the
     * reading that holds only if the disputed text holds (PRIMARY). Where two
     * sources each state a different version of the same rule — a correction
     * notice and the regulation it disagrees with — the second version is the
     * ALTERNATIVE, in force exactly in the worlds where the first is not.
     */
    reading?: "PRIMARY" | "ALTERNATIVE";
  },
  groups: ReadonlyMap<string, { zoneIds: string[] }>,
  place: PlaceContext,
  world: PlaceWorld,
): boolean {
  /* A dispute scoped to a zone reaches a point with no zone only in the world
     where that point lies in the zone. */
  const disputedHere = (rule.disputes ?? []).some((dispute) =>
    !dispute.zoneId || dispute.zoneId === place.zoneId || (!place.zoneId && world.inside.has(unplacedZoneFact(dispute.zoneId))));
  if (disputedHere && (rule.reading === "ALTERNATIVE" ? world.disputedReadingsHold : !world.disputedReadingsHold)) return false;

  const expression = rule.geography;
  if (!expression) return place.zoneId ? groups.get(rule.regulatoryGroupId)?.zoneIds.includes(place.zoneId) ?? false : false;
  const area = world.area;

  /* A jurisdiction-wide rule reaches every place in its jurisdiction, by
     whatever geography placed it there, less what it excludes. */
  if (expression.include.jurisdiction) {
    if (!place.jurisdictionId || place.jurisdictionId !== expression.include.jurisdiction) return false;
    /* The unit the point is in — or, where it has none, the excepted unit it
       lies in in this world. Never "no unit, so no exception". */
    const unit = area ?? world.unplacedUnit;
    if (unit && expression.exclude.ghas.includes(unit)) return false;
    return !expression.exclude.special.some((id) => world.inside.has(id));
  }
  /* A rule narrower than the jurisdiction — a unit, a group of units, a game
     bird zone, a named area — is matched through a unit. A point with none
     never reaches it. */
  if (!area) return false;

  const included =
    expression.include.ghas.includes(area) ||
    (world.gameBirdZone !== null && expression.include.gbhz.includes(world.gameBirdZone)) ||
    expression.include.special.some((id) => world.inside.has(id));
  if (!included) return false;
  if (expression.exclude.ghas.includes(area)) return false;
  return !expression.exclude.special.some((id) => world.inside.has(id));
}
