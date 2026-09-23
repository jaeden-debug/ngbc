/**
 * What B.C. Reg. 76/84 does to an answer built from B.C. Reg. 190/84.
 *
 * PRECEDENCE IS MODELLED, NOT ORDERED. s. 1.1 says this regulation "prevails to
 * the extent of the conflict" over any other regulation under the Act — so a
 * 76/84 row does not overlay the 190/84 bundle, it OVERRIDES it where the two
 * disagree. Ordering that happens to produce the right answer is
 * indistinguishable from precedence that is modelled, right up to the first
 * case where it is not; so the governing instrument is named in the result and
 * carries the clause that makes it govern.
 *
 * THE THREE FACTS STAY THREE FACTS, and the majority one is the dangerous one.
 * Of the 325 rows, 193 are NO_DISCHARGE: they forbid shooting and say nothing
 * about the season. Rendering those as a closed season would tell a hunter a
 * running season is shut — and a bow hunter that a rule about discharging a
 * firearm is theirs. 103 are NO_OPEN_SEASON, which DOES close the season and
 * reaches every method. 29 are AMMUNITION, which changes neither.
 *
 * So this module returns one state per fact and never a single verdict. A
 * caller that wants "is it restricted here" has to say which restriction it
 * means, which is the point.
 *
 * WHAT THIS CAN AND CANNOT DO TODAY, stated up front because the ceiling is
 * lower than "the rows are encoded" sounds. Every one of the 325 rows is
 * either UNLISTED (134) or CANDIDATE_AREAS (191). Neither can ever produce
 * APPLIES: North Ground holds no boundary for any of these areas, and a unit
 * that CONTAINS a closed area is not the closed area. So 76/84 can tell a
 * hunter that a closed area may reach them and what it says — it cannot assert
 * that a season is shut.
 *
 * That is the honest ceiling, not a defect: asserting a closure from "your
 * unit contains one of these" would close a season across a whole management
 * unit on the strength of a name. `seasonIsOverriddenBy` is therefore
 * unreachable from this data today. It is kept, and tested, because the day an
 * area arrives with geometry the precedence must already be modelled — and
 * because a precedence built later, under pressure, is the one that gets built
 * as ordering.
 *
 * AN UNPLACEABLE AREA IS LOUD. 134 of the rows name no unit North Ground can
 * match, so they resolve to UNKNOWN rather than to nothing — `restrictionAt`
 * guarantees a verdict for every row, and this module keeps every UNKNOWN
 * rather than filtering to the ones it can decide. A restriction that cannot
 * be placed is a reason to say so, not a reason to be silent (§8).
 */

import type { WithinZoneArea, WithinZoneFactState, WithinZoneRestrictionFacts } from "../types.ts";
import bundle from "../../../../content/regulatory/ca-bc-closed-areas.json" with { type: "json" };
import {
  restrictionAt,
  type RestrictionKind,
  type RestrictionVerdict,
  type WithinZoneRestriction,
} from "./within-zone-restriction.ts";

export const BC_CLOSED_AREAS = bundle.restrictions as unknown as WithinZoneRestriction[];

/** The instrument that governs a fact, and the clause that makes it govern. */
export interface GoverningInstrument {
  citation: string;
  statedAs: string;
  sourceId: string;
}

/**
 * What 76/84 does to one fact here.
 *
 * `MAY_APPLY` is not a weaker `APPLIES`: it means North Ground cannot place the
 * area, and the honest answer is that the hunter must check. It never
 * downgrades to "no restriction".
 */
export type ClosedAreaState =
  | { state: "APPLIES"; rows: WithinZoneRestriction[]; governedBy: GoverningInstrument }
  | { state: "MAY_APPLY"; rows: WithinZoneRestriction[]; because: string[] }
  | { state: "NONE" };

export interface ClosedAreaEffect {
  /** Closes the season inside the area. Prevails over the 190/84 season. */
  season: ClosedAreaState;
  /** Forbids discharging. The season is untouched, and a bow may be too. */
  discharge: ClosedAreaState;
  /** Ammunition or implement limits specific to the area. */
  ammunition: ClosedAreaState;
  /** Every verdict considered, including the ones that do not apply. */
  verdicts: RestrictionVerdict[];
}

const KIND_OF: Record<"season" | "discharge" | "ammunition", RestrictionKind[]> = {
  /* NO_HUNTING closes the season AND reaches every method, so it is both a
     season fact and a discharge fact. It is not in this regulation today; it is
     mapped rather than omitted so a later row cannot fall through silently. */
  season: ["NO_OPEN_SEASON", "NO_HUNTING"],
  discharge: ["NO_DISCHARGE", "NO_HUNTING"],
  ammunition: ["AMMUNITION"],
};

function stateFor(verdicts: readonly RestrictionVerdict[], kinds: readonly RestrictionKind[]): ClosedAreaState {
  const mine = verdicts.filter((verdict) => kinds.includes(verdict.restriction.kind));
  const applies = mine.filter((verdict) => verdict.state === "APPLIES").map((verdict) => verdict.restriction);
  if (applies.length) {
    const prevails = applies.find((row) => row.prevailsOverConflicting);
    return {
      state: "APPLIES",
      rows: applies,
      governedBy: {
        citation: prevails?.prevailsOverConflicting?.citation ?? applies[0].citation,
        statedAs:
          prevails?.prevailsOverConflicting?.statedAs ??
          "This restriction is stated by the authority for this area.",
        sourceId: applies[0].sourceId,
      },
    };
  }
  const unknown = mine.filter((verdict): verdict is Extract<RestrictionVerdict, { state: "UNKNOWN" }> => verdict.state === "UNKNOWN");
  if (unknown.length) {
    return {
      state: "MAY_APPLY",
      rows: unknown.map((verdict) => verdict.restriction),
      because: unknown.map((verdict) => verdict.because),
    };
  }
  return { state: "NONE" };
}

/**
 * Everything 76/84 says about a place, one state per fact.
 *
 * Every row is asked, and every verdict is kept — including DOES_NOT_APPLY, so
 * a caller can show that the regulation was consulted and did not reach here,
 * which is a different answer from never having looked.
 */
export function closedAreaEffectAt(place: { area?: string; scope: "POINT" | "ZONE" }): ClosedAreaEffect {
  const verdicts = BC_CLOSED_AREAS.map((restriction) => restrictionAt(restriction, place));
  return {
    season: stateFor(verdicts, KIND_OF.season),
    discharge: stateFor(verdicts, KIND_OF.discharge),
    ammunition: stateFor(verdicts, KIND_OF.ammunition),
    verdicts,
  };
}

/**
 * Whether the 190/84 season answer still stands here.
 *
 * The only place precedence is exercised, and it is deliberately the narrowest
 * possible surface: a season is overridden ONLY by a season fact. A
 * no-shooting area never reaches this function, which is what stops 193 rows
 * from closing a season between them.
 */
export function seasonIsOverriddenBy(effect: ClosedAreaEffect): GoverningInstrument | undefined {
  return effect.season.state === "APPLIES" ? effect.season.governedBy : undefined;
}

/**
 * The resolver's output in the shape a result object carries.
 *
 * Every row that bears on this place travels with its name, the authority's
 * own words, its pinpoint and how well it could be placed — so a surface can
 * say "in season outside restricted areas" and NAME them (§41A) without
 * reaching back into the regulation.
 *
 * Nothing here decides how many to show or how to group them. That is a
 * surface judgement with volume constraints the engine cannot see, and a
 * warning that fires everywhere is a warning nobody reads.
 */
function areasOf(state: ClosedAreaState, verdicts: readonly RestrictionVerdict[]): WithinZoneArea[] {
  if (state.state === "NONE") return [];
  const because = new Map(
    verdicts
      .filter((verdict): verdict is Extract<RestrictionVerdict, { state: "UNKNOWN" }> => verdict.state === "UNKNOWN")
      .map((verdict) => [verdict.restriction.id, verdict.because]),
  );
  return state.rows.map((row) => ({
    name: row.name,
    statedAs: row.statedAs,
    citation: row.citation,
    sourceId: row.sourceId,
    placement: row.scope.kind === "CANDIDATE_AREAS" ? "CONTAINED_BY_UNIT" : "UNPLACEABLE",
    ...(because.has(row.id) ? { because: because.get(row.id) } : {}),
  }));
}

function factOf(state: ClosedAreaState, verdicts: readonly RestrictionVerdict[]): WithinZoneFactState {
  return {
    state: state.state,
    areas: areasOf(state, verdicts),
    ...(state.state === "APPLIES" ? { governedBy: state.governedBy } : {}),
  };
}

/** Everything a result object needs, with the closure question already answered. */
export function withinZoneFactsAt(place: { area?: string; scope: "POINT" | "ZONE" }): WithinZoneRestrictionFacts {
  const effect = closedAreaEffectAt(place);
  return {
    season: factOf(effect.season, effect.verdicts),
    discharge: factOf(effect.discharge, effect.verdicts),
    ammunition: factOf(effect.ammunition, effect.verdicts),
    /* Asserted here so no renderer derives a closure from the mere presence
       of restrictions. */
    closesSeasonHere: seasonIsOverriddenBy(effect) !== undefined,
  };
}
