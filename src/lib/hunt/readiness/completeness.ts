/**
 * What Hunt can actually answer, per jurisdiction × species × fact.
 *
 * The owner's test for this file: **"What remains before Québec ruffed grouse
 * is Ready to Hunt complete?" must return an exact list.** `remainingFor`
 * answers it.
 *
 * Two rules decide the shape:
 *
 * **It measures deliverable answers, never encoded records** (CLAUDE.md §8).
 * The unit is the SPECIES-UNIT PAIR, because that is what a hunter occupies.
 * Reporting species counts hid a real gap on this very lane: Ontario's
 * authorizations are complete for 8 of 8 species and deliverable in 874 of
 * 1208 pairs. "Complete for 8 of 8 species" is a TRUE sentence that produces a
 * FALSE impression, which is the hardest kind of wrong number to notice
 * because nothing in it is inaccurate. So species counts do not appear here at
 * all.
 *
 * **A fact is never certified by absence.** A bundle with no bag limit does
 * not mean there is no bag limit; it means nobody has read for one. That is
 * RESEARCH_REQUIRED — a queue item, not a property of the law.
 */

import bundle from "../../../../content/regulatory/readiness/ca-on-2026.json" with { type: "json" };
import { REGULATORY_REGISTRY } from "../regulatory/registry.ts";
import { timeZoneAtPoint } from "../time-zone.ts";

/** The nine facts a hunt needs before Ready to Hunt is complete for it. */
export type ReadinessFact =
  | "SEASON" | "LICENCE" | "METHODS" | "AMMUNITION" | "HUNTER_ORANGE"
  | "LEGAL_HOURS" | "DAILY_LIMIT" | "POSSESSION_LIMIT" | "CRITICAL_EXCEPTIONS";

export const READINESS_FACTS: readonly ReadinessFact[] = [
  "SEASON", "LICENCE", "METHODS", "AMMUNITION", "HUNTER_ORANGE",
  "LEGAL_HOURS", "DAILY_LIMIT", "POSSESSION_LIMIT", "CRITICAL_EXCEPTIONS",
];

export type FactState =
  /** Hunt can answer this correctly for this species here. */
  | "CERTIFIED"
  /**
   * The authority's scheme has no such fact here, AND SAYS SO.
   *
   * This requires a POSITIVE statement from the authority, or a closed-world
   * clause covering the requirement class. A measured absence does not reach
   * it: "we searched five instruments and found no provision" is a claim about
   * our SEARCH, and "this jurisdiction imposes no such requirement" is a claim
   * about the LAW. The second does not follow from the first, because the
   * search space may be incomplete — a provision can live in an act, a
   * regional order or a park regulation that was not among the five.
   *
   * A measured absence stays RESEARCH_REQUIRED and carries its evidence, so
   * the work is not repeated and the next lane knows exactly what would close
   * it. See `absenceEvidence`.
   */
  | "NOT_APPLICABLE"
  /** Nobody has read the authority for it yet. A queue item, not a property of the law. */
  | "RESEARCH_REQUIRED"
  /** The source exists and cannot lawfully or technically be used. */
  | "SOURCE_BLOCKED"
  /** Two authoritative readings disagree and a person must settle it. */
  | "EVIDENTIARY_CONFLICT";

export interface FactCell {
  fact: ReadinessFact;
  state: FactState;
  /** Why, in words. A bare state is not actionable by a research lane. */
  note: string;
  /** Species-unit pairs this fact can actually be delivered in, of those possible. */
  deliverable: { pairs: number; of: number };
  /**
   * A search that was run and found nothing — recorded so it is not repeated,
   * and so the negative result is not mistaken for nobody having looked.
   *
   * It does NOT promote the cell to NOT_APPLICABLE. What would: a positive
   * statement from the authority, or a closed-world clause reaching this
   * requirement class. `closedBy` names which is missing.
   *
   * `control` is what makes the zero trustworthy — a term known to be present
   * in the same text, matched by the same method. Without it a zero is
   * indistinguishable from a broken search, and BC's lane ran one
   * ("Blazed Creek" matched, so the search works on that text).
   */
  absenceEvidence?: {
    searchedOn: string;
    /**
     * How terms were matched. SUBSTRING is its own false-positive class and
     * the mirror of the false negative: `vest` matches *harvest*, *livestock*,
     * *invested* — 112 hits in one document — and "112 hits, requirement
     * present" is as easy to report as missing `orangé` by searching only
     * `orange`. Word boundaries, or every hit classified.
     */
    matching: "WORD_BOUNDARY" | "SUBSTRING";
    control: { term: string; instrument: string; matched: boolean };
    /**
     * Per term, per instrument, with every non-zero hit classified.
     *
     * Not a term list and a count: "zero matches across five instruments"
     * collapses five results into one claim, and that claim can be false while
     * the conclusion holds — which is what happened here, caught by the lane
     * checking its own report. A summary nobody can check is not evidence.
     */
    results: Array<{
      term: string;
      instrument: string;
      hits: number;
      /** Required whenever hits > 0: what they actually were. */
      classified?: string;
      /** An honestly flagged gap beats a tidy list. */
      uninspected?: string;
    }>;
    closedBy: string;
  };
}

export interface SpeciesCompleteness {
  jurisdictionId: string;
  jurisdictionName: string;
  speciesId: string;
  /** Units where a certified season exists — the ceiling on every other fact. */
  unitsCovered: number;
  officialUnits: number | null;
  facts: FactCell[];
  /** True when every fact is CERTIFIED or NOT_APPLICABLE. */
  complete: boolean;
}

type Limits = { daily?: number; possession?: number; bag?: number };
type Rule = { speciesId: string; limits?: Limits };

const ONTARIO = "jurisdiction:ca-on";

/* Ontario's readiness bundle is the only requirement data that exists today. */
const ontarioSpecies = new Set(Object.keys(bundle.speciesMethods));
const ontarioRequirements = bundle.requirements as Record<string, unknown>;
const ontarioMethods = bundle.methods as Record<string, { allowed?: Record<string, unknown> }>;
const ontarioSpeciesMethods = bundle.speciesMethods as Record<string, { methods: string; ammunition: string[] }>;
const ontarioOrangeRules = Object.keys(
  (bundle.orange as unknown as { provenance?: Record<string, unknown> }).provenance ?? {},
).length;

/** Every certified bundle's rules, so limits can be read without guessing. */
async function limitsBySpecies(jurisdictionId: string): Promise<Map<string, Limits[]>> {
  const files: Record<string, string[]> = {
    "jurisdiction:ca-on": ["ca-on-small-game-2026", "ca-on-major-game-2026"],
    "jurisdiction:ca-qc": ["ca-qc-2026"],
    "jurisdiction:ca-mb": ["ca-mb-2026"],
    "jurisdiction:ca-ab": ["ca-ab-2026"],
    "jurisdiction:ca-bc": ["ca-bc-2026"],
    "jurisdiction:us-mt": ["us-mt-upland-2026"],
    "jurisdiction:us-id": ["us-id-pronghorn-2026"],
  };
  const out = new Map<string, Limits[]>();
  for (const name of files[jurisdictionId] ?? []) {
    const loaded = await import(`../../../../content/regulatory/${name}.json`, { with: { type: "json" } })
      .then((module) => module.default as { rules?: Rule[] })
      .catch(() => ({ rules: [] as Rule[] }));
    for (const rule of loaded.rules ?? []) {
      if (!rule.limits) continue;
      out.set(rule.speciesId, [...(out.get(rule.speciesId) ?? []), rule.limits]);
    }
  }
  return out;
}

function cell(fact: ReadinessFact, state: FactState, note: string, pairs: number, of: number): FactCell {
  return { fact, state, note, deliverable: { pairs, of } };
}

/**
 * The matrix for one jurisdiction, computed from its certified bundles and
 * whatever requirement data exists. Nothing here is typed by hand.
 */
export async function completenessFor(jurisdictionId: string): Promise<SpeciesCompleteness[]> {
  const entry = REGULATORY_REGISTRY.find((row) => row.jurisdictionId === jurisdictionId);
  if (!entry) return [];
  const coverage = entry.coverage();
  const limits = await limitsBySpecies(jurisdictionId);
  const isOntario = jurisdictionId === ONTARIO;
  /* Legal hours need a timezone AT THE POINT. Where our point-timezone data is
     licence-blocked the source exists and cannot be used, which is
     SOURCE_BLOCKED rather than unresearched — a different queue. */
  const timezone = timeZoneAtPoint(jurisdictionId);

  return coverage.species.map((row) => {
    const of = row.unitsCovered;
    const has = (yes: boolean) => (yes ? of : 0);
    const speciesLimits = limits.get(row.speciesId) ?? [];
    const daily = speciesLimits.some((entryLimits) => typeof entryLimits.daily === "number");
    const possession = speciesLimits.some((entryLimits) => typeof entryLimits.possession === "number");
    const seasonBagOnly = !daily && !possession && speciesLimits.some((entryLimits) => typeof entryLimits.bag === "number");
    const known = isOntario && ontarioSpecies.has(row.speciesId);

    const facts: FactCell[] = [
      cell("SEASON", of > 0 ? "CERTIFIED" : "RESEARCH_REQUIRED",
        of > 0 ? `${of} of ${coverage.officialUnits ?? "?"} units carry a certified season.` : "No certified season.",
        has(of > 0), of),
      cell("LICENCE", known && ontarioRequirements[row.speciesId] !== undefined ? "CERTIFIED" : "RESEARCH_REQUIRED",
        known && ontarioRequirements[row.speciesId] !== undefined
          ? "Authorizations resolved from the certified requirement records."
          : "No requirement record has been read for this species.",
        has(known && ontarioRequirements[row.speciesId] !== undefined), of),
      cell("METHODS",
        known && Object.keys(ontarioMethods[ontarioSpeciesMethods[row.speciesId]?.methods]?.allowed ?? {}).length > 0
          ? "CERTIFIED" : "RESEARCH_REQUIRED",
        known ? "Legal implements from the authority's own tables." : "No method table has been read for this species.",
        has(known && Object.keys(ontarioMethods[ontarioSpeciesMethods[row.speciesId]?.methods]?.allowed ?? {}).length > 0), of),
      cell("AMMUNITION",
        known && (ontarioSpeciesMethods[row.speciesId]?.ammunition.length ?? 0) > 0 ? "CERTIFIED" : "RESEARCH_REQUIRED",
        known && (ontarioSpeciesMethods[row.speciesId]?.ammunition.length ?? 0) > 0
          ? "Restrictions stated by the authority."
          : "No ammunition restriction has been read. Silence is not 'no restriction'.",
        has(known && (ontarioSpeciesMethods[row.speciesId]?.ammunition.length ?? 0) > 0), of),
      cell("HUNTER_ORANGE", known && ontarioOrangeRules > 0 ? "CERTIFIED" : "RESEARCH_REQUIRED",
        known && ontarioOrangeRules > 0
          ? `${ontarioOrangeRules} certified rules, including the exemptions.`
          : "No hunter-orange rule has been read for this jurisdiction.",
        has(known && ontarioOrangeRules > 0), of),
      cell("LEGAL_HOURS", timezone ? "RESEARCH_REQUIRED" : "SOURCE_BLOCKED",
        timezone
          ? "A point timezone exists; the jurisdiction's own rule and its listed exceptions are unread."
          : "The point-timezone dataset is licence-blocked, so no clock time can be computed here. Held in Canada's legal-hours lane.",
        0, of),
      cell("DAILY_LIMIT", daily ? "CERTIFIED" : "RESEARCH_REQUIRED",
        daily ? "Daily limit stated by the authority."
          : seasonBagOnly
            ? "The schedule states a SEASON bag limit; whether a daily limit also applies is unread."
            : "No daily limit has been read. Absence of a record is not absence of a limit.",
        has(daily), of),
      cell("POSSESSION_LIMIT", possession ? "CERTIFIED" : "RESEARCH_REQUIRED",
        possession ? "Possession limit stated by the authority."
          : seasonBagOnly
            ? "The schedule states a SEASON bag limit; whether a possession limit also applies is unread."
            : "No possession limit has been read.",
        has(possession), of),
      cell("CRITICAL_EXCEPTIONS", entry.specialAreasInZone ? "CERTIFIED" : "RESEARCH_REQUIRED",
        entry.specialAreasInZone
          ? "Published special areas inside a zone are indexed and reach the answer."
          : entry.pointOnlyChecks
            ? "Restrictions are checked only at an exact point; the zone-level answer says so but the areas are not indexed."
            : "Special areas within a zone have not been indexed for this jurisdiction.",
        has(Boolean(entry.specialAreasInZone)), of),
    ];

    return {
      jurisdictionId,
      jurisdictionName: entry.jurisdictionName,
      speciesId: row.speciesId,
      unitsCovered: of,
      officialUnits: coverage.officialUnits,
      facts,
      complete: facts.every((factCell) => factCell.state === "CERTIFIED" || factCell.state === "NOT_APPLICABLE"),
    };
  });
}

/** Every rules-certified jurisdiction. */
export async function completenessMatrix(): Promise<SpeciesCompleteness[]> {
  const rows = await Promise.all(REGULATORY_REGISTRY.map((entry) => completenessFor(entry.jurisdictionId)));
  return rows.flat();
}

/**
 * What remains before this species is Ready to Hunt complete here — the exact
 * list, which is the question this file exists to answer.
 */
export async function remainingFor(
  jurisdictionId: string,
  speciesId: string,
): Promise<{ found: boolean; remaining: FactCell[] }> {
  const rows = await completenessFor(jurisdictionId);
  const row = rows.find((entry) => entry.speciesId === speciesId);
  if (!row) return { found: false, remaining: [] };
  return {
    found: true,
    remaining: row.facts.filter((factCell) => factCell.state !== "CERTIFIED" && factCell.state !== "NOT_APPLICABLE"),
  };
}
