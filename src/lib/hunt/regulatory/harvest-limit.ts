/**
 * How much may be taken — with the KIND of limit as a dimension, never as a
 * field name.
 *
 * `RegulatoryResult.limits` was `{ daily, possession }` with both required, so
 * a SEASON limit could not be expressed at all. British Columbia gives black
 * bear a season bag of 2 and no daily figure; its bundle held that correctly
 * in the authority's own words and the engine could only carry it as prose,
 * because the result type had nowhere to put it. Nothing was lost — it was
 * unstructured.
 *
 * Three prohibitions, from the owner's ruling, and each is a thing the old
 * shape made easy:
 *
 *  1. Never manufacture a possession limit because a daily or season one exists.
 *  2. Never manufacture a daily limit from a season limit.
 *  3. Never let the ABSENCE of one kind imply incomplete certification when
 *     that kind does not apply.
 *
 * The third is why the completeness question is "have all applicable harvest
 * limits been resolved?" rather than "does this species have a daily limit?".
 * A species with only a season limit is completely answered, not two-thirds
 * answered.
 */

/**
 * Extensible by design. An authority that periodises a limit in a way none of
 * the first three name — Québec's *"par séjour"* — uses AS_STATED and carries
 * its own word, rather than being pushed into the nearest of the three.
 */
export type HarvestLimitKind = "DAILY" | "SEASON" | "POSSESSION" | "AS_STATED";

export interface HarvestLimit {
  kind: HarvestLimitKind;
  /** The authority's own period word. REQUIRED when kind is AS_STATED. */
  periodStatedAs?: string;
  /**
   * The figure, or null where the authority states a rule without one — a
   * limit expressed as a formula ("3 times the daily bag limit") has a rule
   * and no number until its base is certified.
   */
  count: number | null;
  /** The authority's own words. Never normalised, never translated. */
  statedAs: string;
  section?: string;
  /**
   * Whether the figure is one pool across species. Required, because a
   * default of "this species" is how an aggregate becomes wrong by its member
   * count — Québec's five-bird limit is shared across four species.
   */
  appliesAcross: { scope: "THIS_SPECIES" | "AGGREGATE"; speciesNames?: string[] };
  /**
   * Whom the figure is for. Absent means the authority did not say, which is
   * NOT the same as "each hunter": Québec allows one moose per TWO hunters.
   */
  allocatedTo?: { scope: "EACH_HUNTER" | "SHARED_BY_GROUP"; hunters?: number };
  /** The authority's own class, kept as written ("antlered", « avec bois »). */
  animalClass?: string;
}

/** The bundle shape the conditional engine already holds, per jurisdiction. */
export interface BundleLimits {
  daily?: number;
  possession?: number | null;
  combined?: boolean;
  combinedWithNames?: string[];
  statedAs?: string;
  bag?: number;
  animalClass?: string;
  section?: string;
}

/**
 * A bundle's limits as canonical rows — one per kind the authority states, and
 * none for a kind it does not.
 *
 * This reads only what is present. A bundle carrying `bag` produces a SEASON
 * row and NO daily row, because British Columbia's schedule states a season
 * limit and is silent on a daily one; inventing the second is prohibition 2.
 */
export function harvestLimitsFrom(limits: BundleLimits | undefined): HarvestLimit[] {
  if (!limits) return [];
  const across: HarvestLimit["appliesAcross"] = limits.combined
    ? { scope: "AGGREGATE", ...(limits.combinedWithNames?.length ? { speciesNames: limits.combinedWithNames } : {}) }
    : { scope: "THIS_SPECIES" };
  const shared = {
    statedAs: limits.statedAs ?? "",
    ...(limits.section ? { section: limits.section } : {}),
    ...(limits.animalClass ? { animalClass: limits.animalClass } : {}),
    appliesAcross: across,
  };
  const rows: HarvestLimit[] = [];
  if (typeof limits.daily === "number") rows.push({ kind: "DAILY", count: limits.daily, ...shared });
  if (typeof limits.possession === "number") rows.push({ kind: "POSSESSION", count: limits.possession, ...shared });
  if (typeof limits.bag === "number") rows.push({ kind: "SEASON", count: limits.bag, ...shared });
  return rows;
}

/** Every kind the authority actually states here. */
export function limitKinds(limits: readonly HarvestLimit[]): HarvestLimitKind[] {
  return [...new Set(limits.map((limit) => limit.kind))];
}

/**
 * One line per limit, in the authority's own words where it has them.
 *
 * Deliberately not "5 / 15": that format presumes daily-then-possession and
 * silently mislabels a season limit as a daily one, which is the failure the
 * kind dimension exists to prevent.
 */
export function limitSummary(limit: HarvestLimit): string {
  const label = limit.kind === "AS_STATED" ? (limit.periodStatedAs ?? "as stated") : limit.kind.toLowerCase();
  const pool = limit.appliesAcross.scope === "AGGREGATE"
    ? ` (combined${limit.appliesAcross.speciesNames?.length ? ` with ${limit.appliesAcross.speciesNames.join(", ")}` : ""})`
    : "";
  const shared = limit.allocatedTo?.scope === "SHARED_BY_GROUP" && limit.allocatedTo.hunters
    ? ` per ${limit.allocatedTo.hunters} hunters`
    : "";
  return limit.count === null
    ? `${label}: ${limit.statedAs}`
    : `${label}: ${limit.count}${shared}${pool}`;
}
