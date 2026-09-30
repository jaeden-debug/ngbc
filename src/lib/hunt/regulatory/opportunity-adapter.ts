/**
 * Certified rules into opportunity rows: the one place a bundle's shape is
 * turned into the contract every surface reads.
 *
 * WHY THIS IS THE WHOLE POINT. The same fact lives in three places today —
 * Québec keeps implements and classes at the top level, Ontario nests
 * implements under `appliesWhen` and keeps classes at the top, Alberta keeps
 * BOTH under `appliesWhen`. A card that read any one of those shapes would
 * work perfectly for one jurisdiction and show nothing for the others, and the
 * failure would look like missing data rather than a missing adapter.
 * `implementsOf` and `animalClassesOf` already normalise across the homes;
 * this file is where that normalisation becomes a row.
 *
 * NOTHING HERE DECIDES LEGALITY. It reshapes rules the engine already selected.
 * A row carries no status, and a surface wanting one still asks the engine.
 *
 * THE HARD PART IS NOT THE SHAPE, IT IS THE ABSENCE. A dimension a rule does
 * not state is in one of two states that must never be confused:
 *
 *   NOT_APPLICABLE  the authority does not use this dimension for this species
 *   UNRESOLVED      it could matter here and nobody has established it
 *
 * Guessing the first when it is the second is the dangerous direction: under a
 * filter it would show a hunter a green zone for a crossbow hunt on the
 * strength of our not knowing (owner, 2026-09-30). So the choice is not made
 * from whether a field is present — it is read from the SPECIES PROFILE in
 * `dimension-matrix.ts`, which is a declaration about the world rather than
 * about our data, and which already says where each dimension can decide
 * legality. Small game has no antler class, so an absent one there is the
 * authority not using the dimension. Big game does, so an absent one there is
 * a gap.
 */

import {
  animalClassesOf, implementsOf, profileFor, type Dimension, type RuleShape,
} from "./dimension-matrix.ts";
import {
  NOT_APPLICABLE, stated, UNRESOLVED,
  type OpportunityDimension, type OpportunityWindow, type ResolvedOpportunity,
} from "./opportunity-row.ts";

/**
 * What an absent dimension means for this species.
 *
 * `NOT_NORMALLY_MATERIAL` is the only materiality that licenses
 * NOT_APPLICABLE. `POSSIBLE` deliberately does not: it means the dimension
 * exists for this species in SOME jurisdictions, so its absence here is
 * precisely the case nobody has established, and reading it as "no restriction"
 * would be the guess this contract exists to prevent.
 */
export function absenceOf<T>(speciesId: string, dimension: Dimension): OpportunityDimension<T> {
  const profile = profileFor(speciesId);
  return profile?.[dimension] === "NOT_NORMALLY_MATERIAL" ? NOT_APPLICABLE : UNRESOLVED;
}

function windowsOf(rule: RuleShape): OpportunityWindow[] {
  const raw = (Array.isArray(rule.windows) ? rule.windows : rule.window ? [rule.window] : []) as Array<{
    opensIso?: string; closesIso?: string; opens?: string; closes?: string;
  }>;
  const out: OpportunityWindow[] = [];
  for (const window of raw) {
    const opens = window.opensIso ?? window.opens;
    const closes = window.closesIso ?? window.closes;
    /* A window missing an end is not a window. Emitting it with an invented
       bound would put a date on screen the authority never published. */
    if (opens && closes) out.push({ opens, closes, datesInclusive: true });
  }
  return out;
}

export interface AdapterInput {
  speciesId: string;
  rules: readonly (RuleShape & { id?: string; conditionIds?: unknown; sourceId?: unknown })[];
}

/**
 * The rows for one species, from the rules the engine holds for it.
 *
 * A rule that states no season at all (`declaredNoSeason`) yields no row: it is
 * a closure, and a closure is not an opportunity. The engine still reports it —
 * that is a status, and status is the engine's to give.
 */
export function opportunityRowsFrom({ speciesId, rules }: AdapterInput): ResolvedOpportunity[] {
  const rows: ResolvedOpportunity[] = [];
  for (const rule of rules) {
    if (rule.declaredNoSeason) continue;
    const windows = windowsOf(rule);
    if (!windows.length) continue;

    const classes = animalClassesOf(rule);
    const implementTokens = implementsOf(rule);
    rows.push({
      ruleId: String(rule.id ?? ""),
      speciesId,
      /*
       * ONE ROW PER CLASS WOULD BE A LIE IN THE OTHER DIRECTION. A rule stating
       * ["ANTLERED", "ANTLERLESS"] is one season in which either may be taken,
       * not two seasons. It is carried as the set the authority stated; a
       * filter matches when the selected class is in it.
       */
      animalClass: classes.length
        ? stated(classes.length === 1 ? classes[0] : classes.join(" or "))
        : absenceOf<string>(speciesId, "ANIMAL_CLASS"),
      /* No criterion is extracted here. Québec's 7 cm threshold lives in
         `classLabel` as French prose, and turning prose into a structured
         threshold is extraction with provenance, not a regex in an adapter. */
      criterion: null,
      implements: implementTokens.length
        ? stated(implementTokens)
        : absenceOf<readonly string[]>(speciesId, "IMPLEMENT"),
      windows,
      conditionIds: Array.isArray(rule.conditionIds) ? (rule.conditionIds as string[]) : [],
      ...(rule.sourceId ? { sourceId: String(rule.sourceId) } : {}),
    });
  }
  return rows;
}
