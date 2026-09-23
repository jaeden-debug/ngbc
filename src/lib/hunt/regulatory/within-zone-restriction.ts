/**
 * A restriction that applies inside a management unit rather than to it.
 *
 * `SpecialGeography` already carries identity, resolution and geometry hints,
 * and it works for the twelve British Columbia specials that name candidate
 * units. Three things it cannot express, each found in B.C. Reg. 76/84 and
 * each a different shape of failure:
 *
 *  1. **A jurisdiction-wide restriction has nowhere to live.** s.12 forbids
 *     shooting from a highway and within 15 m of one, province-wide. There is
 *     no unit to list, and `geography.ts` skips a special when the point
 *     resolves to no area at all — so the restriction cannot be expressed.
 *
 *  2. **An area naming no unit is INVISIBLE rather than unresolved.** The
 *     resolution reads `if (!entry.candidateAreas?.includes(area)) continue`,
 *     and for an entry with no `candidateAreas` that is `!undefined`, which is
 *     true. It does not fail; it silently never fires. That is the
 *     can-only-pass shape, in the data layer instead of the test layer, and
 *     BC's Schedule 1 areas name no management unit at all.
 *
 *  3. **One field cannot say WHAT is restricted.** ss.2, 4, 8 and 8.1 say
 *     "there is no open season"; ss.6 and 7.1 designate no-shooting areas and
 *     say nothing about the season; s.10 sets ammunition rules per area. Those
 *     are three different facts with three different consequences, and a
 *     hunter told "restricted" learns none of them.
 *
 * So kind is a dimension and scope admits jurisdiction-wide. Nothing here is
 * British Columbia-shaped: the model names no province, and B.C. Reg. 76/84 is
 * cited only as the evidence that each case is real.
 */

/**
 * WHAT the restriction does. Required — there is no sensible default, and a
 * wrong one is consequential in both directions: reading a no-shooting area as
 * a closed season tells a hunter the season is shut when it is open, and
 * reading a closed season as a no-shooting area tells them to hunt where there
 * is no season.
 */
export type RestrictionKind =
  /** No open season here. The season does not run inside this area. */
  | "NO_OPEN_SEASON"
  /** No discharge or shooting here. The season is untouched, and a hunter
   *  using a bow is NOT addressed by it. */
  | "NO_DISCHARGE"
  /**
   * No hunting here, by any method. Distinct from both neighbours, and Alberta
   * is why: its 11 road corridor wildlife sanctuaries say "it is unlawful to
   * HUNT within 365 metres of the centre-line", which closes no season and
   * does reach a bow hunter. Filed as NO_DISCHARGE it would tell an archer the
   * rule is not theirs; filed as NO_OPEN_SEASON it would claim the season is
   * shut everywhere in the unit.
   */
  | "NO_HUNTING"
  /** Ammunition or implement limits specific to this area. */
  | "AMMUNITION"
  /** Entry or access is restricted, whatever the season says. */
  | "ACCESS"
  /** Something else the authority states; `statedAs` carries it. */
  | "OTHER";

/**
 * WHERE it applies.
 *
 * `UNLISTED` exists so that an area naming no unit is a loud unknown rather
 * than a silent no-op. It is the one case the previous model turned into
 * nothing at all.
 */
export type RestrictionScope =
  /** Everywhere in the jurisdiction. No unit list, and none is expected. */
  | { kind: "JURISDICTION_WIDE"; statedAs: string }
  /** Wholly contains these units. */
  | { kind: "AREAS"; areas: string[] }
  /** Lies partly within these units; where inside is the open question. */
  | { kind: "CANDIDATE_AREAS"; candidateAreas: string[] }
  /** Real, and names no unit North Ground can match. NEVER silently dropped. */
  | { kind: "UNLISTED"; statedAs: string };

/**
 * OPEN QUESTION, deliberately not built: the model has NO DATE DIMENSION.
 *
 * A restriction that applies only between stated dates cannot be expressed
 * today, and the model reads every restriction as always-on. That is a real
 * limitation and it will matter for some jurisdiction.
 *
 * It is not built yet because the evidence that prompted it did not support
 * it: the claim was that British Columbia's seasonal schedules carry a period
 * PER AREA, and in the transcribed rows no month name appears anywhere in 405
 * records, while schedules 2, 4, 6, 8 and 10 each share ONE `effectStatedAs`
 * across every area. The periods may genuinely live in the metes-and-bounds
 * descriptions, which were correctly not transcribed — but that is a reason to
 * ask for citations, not to add a field.
 *
 * A field built on an unverified claim would be indistinguishable, once
 * populated, from a field whose data is merely missing. Build it when evidence
 * arrives, and let the evidence say whether it is per-area or per-schedule.
 */
export interface WithinZoneRestriction {
  id: string;
  name: string;
  /** The authority's own words. */
  statedAs: string;
  kind: RestrictionKind;
  scope: RestrictionScope;
  citation: string;
  sourceId: string;
  /**
   * The instrument's own precedence, where it states one. B.C. Reg. 76/84
   * s.1.1: "If there is a conflict between this regulation and another
   * regulation made under the Act, this regulation prevails to the extent of
   * the conflict." Recorded because a restriction that prevails over the
   * bundle's own source is not an ordinary overlay.
   */
  prevailsOverConflicting?: { statedAs: string; citation: string };
}

export type RestrictionVerdict =
  /** It applies here, and `kind` says what that means. */
  | { state: "APPLIES"; restriction: WithinZoneRestriction }
  /** It cannot reach this point. */
  | { state: "DOES_NOT_APPLY"; restriction: WithinZoneRestriction }
  /** It may reach this point and North Ground cannot tell. Never silence. */
  | { state: "UNKNOWN"; restriction: WithinZoneRestriction; because: string };

/**
 * Whether a restriction reaches a place.
 *
 * Every branch returns a verdict. There is deliberately no path that returns
 * nothing: a restriction that cannot be evaluated is UNKNOWN and says why,
 * because the failure this model exists to prevent is one that produced
 * silence.
 */
export function restrictionAt(
  restriction: WithinZoneRestriction,
  place: { area?: string; scope: "POINT" | "ZONE" },
): RestrictionVerdict {
  const scope = restriction.scope;

  if (scope.kind === "JURISDICTION_WIDE") {
    /* No area needed, and none is consulted. A point anywhere in the
       jurisdiction is inside it; whether the hunter is within 15 m of a
       highway is not something a zone lookup can answer, so it is APPLIES
       with the authority's words rather than a computed yes or no. */
    return { state: "APPLIES", restriction };
  }

  if (scope.kind === "UNLISTED") {
    return {
      state: "UNKNOWN",
      restriction,
      because: `${restriction.name} names no management unit North Ground can match, so it cannot be placed. ${scope.statedAs}`,
    };
  }

  if (!place.area) {
    return {
      state: "UNKNOWN",
      restriction,
      because: `${restriction.name} is listed by management unit, and this place resolved to none.`,
    };
  }

  if (scope.kind === "AREAS") {
    return scope.areas.includes(place.area)
      ? { state: "APPLIES", restriction }
      : { state: "DOES_NOT_APPLY", restriction };
  }

  if (!scope.candidateAreas.includes(place.area)) {
    return { state: "DOES_NOT_APPLY", restriction };
  }
  return {
    state: "UNKNOWN",
    restriction,
    because: place.scope === "ZONE"
      ? `${restriction.name} covers part of this area, so the answer depends on where in it you hunt.`
      : `${restriction.name} may include this point; North Ground holds no boundary for it.`,
  };
}

/**
 * What a hunter is told, by kind.
 *
 * Kept here rather than in a renderer so that the distinction the kind exists
 * to preserve cannot be flattened by a caller writing one sentence for all of
 * them.
 */
export function restrictionSummary(restriction: WithinZoneRestriction): string {
  switch (restriction.kind) {
    case "NO_OPEN_SEASON": return `No open season inside ${restriction.name}.`;
    case "NO_DISCHARGE": return `No shooting inside ${restriction.name}. The season itself is not closed here, and this does not reach a hunter using a bow.`;
    case "NO_HUNTING": return `No hunting of any kind inside ${restriction.name}, whatever the season says.`;
    case "AMMUNITION": return `Ammunition limits apply inside ${restriction.name}.`;
    case "ACCESS": return `Access is restricted inside ${restriction.name}.`;
    default: return `${restriction.name} restricts hunting here.`;
  }
}
