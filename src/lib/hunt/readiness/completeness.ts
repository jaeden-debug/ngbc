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
import { certifies, hasEvidence, withinZoneRestrictions } from "./evidence.ts";
import { harvestLimitsFrom, limitKinds } from "../regulatory/harvest-limit.ts";
import { timeZoneAtPoint } from "../time-zone.ts";

/** The nine facts a hunt needs before Ready to Hunt is complete for it. */
export type ReadinessFact =
  | "SEASON" | "LICENCE" | "METHODS" | "AMMUNITION" | "HUNTER_ORANGE"
  | "LEGAL_HOURS"
  /**
   * "Have all applicable harvest limits for this hunt been resolved?" — NOT
   * "does this species have a daily limit?".
   *
   * The old pair asked the wrong question. A species with only a season limit
   * is completely answered, not two-thirds answered, and British Columbia
   * gives black bear exactly that. Asking per kind made a species incomplete
   * forever for lacking a kind its authority does not use.
   */
  | "HARVEST_LIMITS"
  | "CRITICAL_EXCEPTIONS";

export const READINESS_FACTS: readonly ReadinessFact[] = [
  "SEASON", "LICENCE", "METHODS", "AMMUNITION", "HUNTER_ORANGE",
  "LEGAL_HOURS", "HARVEST_LIMITS", "CRITICAL_EXCEPTIONS",
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
  | "EVIDENTIARY_CONFLICT"
  /**
   * North Ground COULD appear to answer this and deliberately does not,
   * because answering without a missing input risks the unsafe direction.
   *
   * Distinct from RESEARCH_REQUIRED and SOURCE_BLOCKED on purpose. Those say
   * nobody has looked, or the source cannot be used — both are things to go
   * and fix. This says the gate is working. Québec's hunter-orange exemption
   * turns on a gear class we cannot establish; the available "fix" is to
   * ignore the class and answer from the implement list, which would tell a
   * bow hunter no orange is required when it is.
   *
   * Without its own state it reads as a gap, and a gap invites closing. **A
   * number that goes up because a safety gate was loosened is worse than one
   * that does not move.**
   */
  | "SAFETY_GATED";

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

/**
 * A jurisdiction's own certified bundle and a research lane's evidence package
 * are BOTH the authority. Either may certify a fact; neither is a fallback.
 *
 * The old shape was `known ? bundle : evidenced ? evidence : nothing`, which
 * meant a jurisdiction that HAD a bundle could never be improved by evidence —
 * research into Ontario's regulations was read for other purposes and then
 * discarded for every fact the bundle already spoke to, including the ones it
 * spoke to by saying nothing. Ontario's four small-game species had no
 * ammunition record in the bundle and a certified one in O. Reg. 665/98, and
 * the ternary preferred the silence because the bundle existed.
 *
 * **A source that is consulted only when no other source exists is not a
 * source, it is a placeholder.** Both are asked; whichever states the fact,
 * states it.
 */
function either(
  bundle: { certified: boolean; reason: string },
  evidence: { certified: boolean; reason: string },
): { certified: boolean; reason: string } {
  if (bundle.certified) return bundle;
  if (evidence.certified) return evidence;
  return { certified: false, reason: bundle.reason || evidence.reason };
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
    /* Kinds the authority actually states, read through the canonical model so
       the matrix and the answer cannot disagree about what a bundle holds. */
    const evidenced = hasEvidence(jurisdictionId);
    const statedKinds = [...new Set(speciesLimits.flatMap((entryLimits) => limitKinds(harvestLimitsFrom(entryLimits))))];
    /* A jurisdiction's limits may come from its certified bundle OR from a
       lane's evidence — Québec states nine in its regulations and holds none
       in the bundle. Either is the authority; neither is a fallback. */
    const limitEvidence = evidenced ? certifies(jurisdictionId, row.speciesId, "LIMIT") : { certified: false, reason: "" };
    const anyLimit = statedKinds.length > 0 || limitEvidence.certified;
    /* CRITICAL_EXCEPTIONS is NOT fed from PLACE_CONDITION evidence, and the
       attempt is recorded because it was wrong in the flattering direction.
       The fact means restrictions that vary WITHIN a unit — refuges, closed
       lands, special areas a zone-level answer cannot see. Québec's only
       place-condition row is s.22, requiring a hunter be present when hunting
       with dogs: a real rule, about conduct, nowhere near the question. It
       took Québec to 74% and the number was wrong.
       
       Certifying a fact from a category that merely sounds adjacent is how a
       matrix flatters a landing. It stays on indexed special areas until
       evidence names them. */
    /* Not fed from PLACE_CONDITION category alone — that over-claimed once, on
       a Québec row about hunting with dogs. A row counts only when it carries
       the within-zone model's own fields, and only a PLACEABLE one certifies:
       a restriction we know of and cannot locate does not reach a point. */
    const restrictions = evidenced
      ? withinZoneRestrictions(jurisdictionId, row.speciesId)
      : { known: 0, placeable: 0, notYetPlaced: 0, notPlaceable: 0 };
    /* The note says what would actually close the gap, and it is DERIVED from
       the rows rather than written once. The generic sentence "what is needed
       is boundaries, not more reading" was true of Alberta's sanctuaries and
       false of Ontario the moment Ontario arrived: three of Ontario's four
       restrictions need an area LIST read out of another regulation, and one
       needs a dataset acquired. A note asserted about one jurisdiction becomes
       a false claim about the next — the same failure the Alberta cell was
       fixed for, one level up. */
    const remedy = [
      restrictions.notYetPlaced > 0 ? `${restrictions.notYetPlaced} await geography or a list that exists and has not been acquired` : "",
      restrictions.notPlaceable > 0 ? `${restrictions.notPlaceable} cannot be placed by anyone — the authority does not publish the geometry` : "",
      restrictions.known - restrictions.notYetPlaced - restrictions.notPlaceable > 0
        ? `${restrictions.known - restrictions.notYetPlaced - restrictions.notPlaceable} have not been triaged`
        : "",
    ].filter(Boolean).join("; ");
    const exceptions = {
      certified: restrictions.placeable > 0,
      reason: restrictions.placeable > 0
        ? `${restrictions.placeable} of ${restrictions.known} recorded within-zone restrictions can be placed.`
        : restrictions.known > 0
          ? `${restrictions.known} within-zone restrictions are recorded and none can be placed yet: ${remedy}. Recorded and unplaced is not unexamined.`
          : "",
    };
    const known = isOntario && ontarioSpecies.has(row.speciesId);

    /* Ontario's own bundle, or a lane's evidence package — one path, so a
       jurisdiction is covered by whatever evidence exists for it rather than
       by being Ontario. */
    const licence = known
      ? either({ certified: ontarioRequirements[row.speciesId] !== undefined, reason: ontarioRequirements[row.speciesId] !== undefined ? "Authorizations resolved from the certified requirement records." : "No requirement record has been read for this species." }, evidenced ? certifies(jurisdictionId, row.speciesId, "AUTHORIZATION") : { certified: false, reason: "" })
      : evidenced ? certifies(jurisdictionId, row.speciesId, "AUTHORIZATION")
      : { certified: false, reason: "No requirement record has been read for this species." };
    const methodsCertified = known && Object.keys(ontarioMethods[ontarioSpeciesMethods[row.speciesId]?.methods]?.allowed ?? {}).length > 0;
    const methods = known
      ? either({ certified: methodsCertified, reason: methodsCertified ? "Legal implements from the authority's own tables." : "No positive list of allowed methods has been read." }, evidenced ? certifies(jurisdictionId, row.speciesId, "METHOD") : { certified: false, reason: "" })
      : evidenced ? certifies(jurisdictionId, row.speciesId, "METHOD")
      : { certified: false, reason: "No positive list of allowed methods has been read. Prohibitions alone cannot certify this: the complement of a ban list is not a permission." };
    const ammoCertified = known && (ontarioSpeciesMethods[row.speciesId]?.ammunition.length ?? 0) > 0;
    const ammunition = known
      ? either({ certified: ammoCertified, reason: ammoCertified ? "Restrictions stated by the authority." : "No ammunition restriction has been read. Silence is not 'no restriction'." }, evidenced ? certifies(jurisdictionId, row.speciesId, "AMMUNITION") : { certified: false, reason: "" })
      : evidenced ? certifies(jurisdictionId, row.speciesId, "AMMUNITION")
      : { certified: false, reason: "No ammunition restriction has been read. Silence is not 'no restriction'." };
    const orangeEvidence = known
      ? either({ certified: ontarioOrangeRules > 0, reason: ontarioOrangeRules > 0 ? `${ontarioOrangeRules} certified rules, including the exemptions.` : "No hunter-orange rule has been read for this jurisdiction." }, evidenced ? certifies(jurisdictionId, row.speciesId, "VISIBILITY") : { certified: false, reason: "" })
      : evidenced ? certifies(jurisdictionId, row.speciesId, "VISIBILITY")
      : { certified: false, reason: "No hunter-orange rule has been read for this jurisdiction." };
    /* A refusal that names a gear class is the gate holding, not a gap. */
    const orange = { ...orangeEvidence, gated: !orangeEvidence.certified && orangeEvidence.reason.includes("gear class") };

    const facts: FactCell[] = [
      cell("SEASON", of > 0 ? "CERTIFIED" : "RESEARCH_REQUIRED",
        of > 0 ? `${of} of ${coverage.officialUnits ?? "?"} units carry a certified season.` : "No certified season.",
        has(of > 0), of),
      cell("LICENCE", licence.certified ? "CERTIFIED" : "RESEARCH_REQUIRED", licence.reason, has(licence.certified), of),
      /* METHODS certifies only from a POSITIVE list of what is allowed. An
         authority that packages methods as prohibitions — British Columbia
         states bans plus bow-only and youth-only segments, with no allowed
         list anywhere in its sources — cannot certify this fact, because
         "everything not banned" is a complement, and a complement over a set
         that does not describe the world is how a prohibition nobody
         legislated reaches a hunter. The prohibitions are still shown; they
         are simply not an ALLOWED answer. */
      cell("METHODS", methods.certified ? "CERTIFIED" : "RESEARCH_REQUIRED", methods.reason, has(methods.certified), of),
      cell("AMMUNITION", ammunition.certified ? "CERTIFIED" : "RESEARCH_REQUIRED", ammunition.reason, has(ammunition.certified), of),
      cell("HUNTER_ORANGE",
        orange.certified ? "CERTIFIED" : orange.gated ? "SAFETY_GATED" : "RESEARCH_REQUIRED",
        orange.reason, has(orange.certified), of),
      cell("LEGAL_HOURS", timezone ? "RESEARCH_REQUIRED" : "SOURCE_BLOCKED",
        timezone
          ? "A point timezone exists; the jurisdiction's own rule and its listed exceptions are unread."
          : "The point-timezone dataset is licence-blocked, so no clock time can be computed here. Held in Canada's legal-hours lane.",
        0, of),
      /* One fact, asking whether the APPLICABLE limits are resolved — so a
         species whose authority states only a season limit is complete rather
         than permanently two-thirds answered. Absence of a kind the authority
         does not use is not a gap; absence of ANY limit still is. */
      cell("HARVEST_LIMITS", anyLimit ? "CERTIFIED" : "RESEARCH_REQUIRED",
        statedKinds.length > 0
          ? `Stated by the authority: ${statedKinds.join(", ").toLowerCase()}.`
          : limitEvidence.certified
            ? limitEvidence.reason
            : "No harvest limit of any kind has been read. Absence of a record is not absence of a limit.",
        has(anyLimit), of),
      cell("CRITICAL_EXCEPTIONS",
        entry.specialAreasInZone || exceptions.certified ? "CERTIFIED" : "RESEARCH_REQUIRED",
        entry.specialAreasInZone
          ? "Published special areas inside a zone are indexed and reach the answer."
          : exceptions.certified
            ? exceptions.reason
            : exceptions.reason
              ? exceptions.reason
              : entry.pointOnlyChecks
              ? "Restrictions are checked only at an exact point; the zone-level answer says so but the areas are not indexed."
              : "Special areas within a zone have not been indexed for this jurisdiction.",
        has(Boolean(entry.specialAreasInZone) || exceptions.certified), of),
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
