import { legalTimeNotCertified } from "./legal-time.ts";
import { bindingDailyAndPossession, harvestLimitsFrom, type BundleLimits } from "./harvest-limit.ts";
import { nextOpening } from "./season.ts";
import { authorityNote, general, labelledSourceDetail, type Limitation } from "../limitation.ts";
import { conditionId, conditionLine, type RegulatoryCondition } from "./condition.ts";
import { authored } from "../provenance.ts";
import { classificationOf } from "./condition-kinds.ts";
import type { CanonicalId, IsoDate } from "../../content-contract/index.ts";
import type { ClosureCause, ClosureDeclaration, RegulatoryResult, RegulatoryStatus, SeasonListing } from "../types.ts";
import {
  answerFor, isAnswerValid,
  type DimensionOption, type HuntDimensionAnswers, type HuntDimensionId, type RequiredDimension,
} from "./dimensions.ts";
import { appliesInWorld, isUnplacedZoneFact, placeWorlds, type GeographyData, type GeographyExpression, type PlaceContext, type PlaceWorld } from "./geography.ts";
import { authorizationContext, type DrawCycle } from "./allocation.ts";
import type { HuntCode } from "./hunt-codes.ts";
import { rulesInForce, type Amendment, type RuleAuthority } from "./precedence.ts";
import type { RestrictionRecord } from "../overlays.ts";
import { isQuotation, provenancedLine, quoting, type AuthorityQuotation, type NorthGroundStatement, type ProvenancedText } from "../provenance.ts";
import { opportunityRowsFrom } from "./opportunity-adapter.ts";
import type { ResolvedOpportunity } from "./opportunity-row.ts";

/**
 * The jurisdiction-neutral conditional evaluator.
 *
 * It knows nothing about any province. Everything that differs between
 * jurisdictions arrives as data: the BUNDLE (rules generated from the
 * authority's own publication, with their geography, windows and conditions)
 * and the VOCABULARY (the questions, in the authority's terms, and the
 * standing text every answer carries). Adding a jurisdiction is a builder and a
 * vocabulary, never a branch here.
 *
 * Three distinctions are held everywhere:
 *
 *  - NEEDS_INPUT is not UNKNOWN. North Ground knowing the law and needing a
 *    fact from the hunter is reported as completeness, separately from status.
 *
 *  - Absence has the meaning the law gives it, stated in the bundle with its
 *    section. Manitoba's regulation says a licence authorises hunting only
 *    where it designates (s. 3), so an undesignated place is CLOSED to that
 *    licence. Where no such provision exists, absence is UNKNOWN.
 *
 *  - Undetermined geography and disputed readings are never resolved by
 *    picking a side. The engine evaluates with and without them and answers
 *    only where both agree.
 *
 * Questions are outcome-sensitive: a fact is asked for only if some value of it
 * changes the answer for this place on this date. A grouse hunter is asked
 * nothing even though grouse rules are written per licence, because every
 * licence gives the same season. A deer hunter on a date no deer season is open
 * is told so without being asked which licence they hold.
 */

/* ── Bundle ─────────────────────────────────────────────────────────────── */

export interface ConditionalWindow {
  opensIso: string;
  closesIso: string;
  /** AUTHORITY: the source's own window wording, carried without normalization. */
  statedAs?: string;
  /**
   * Whether the season spans the turn of the calendar year.
   *
   * It was undeclared here while five bundles emitted it and four more did not,
   * which is how two definitions of one fact came to disagree: nothing obliged a
   * builder to set it and nothing could read it. A RESOLVED window is anchored to
   * its licence year and never wraps, so this is true exactly when the two dates
   * fall in different years — `crossesYear()` in `season.ts` decides the same
   * thing from month-and-day anchors before anchoring.
   *
   * Optional because four bundles predate the declaration;
   * `crossesYearAgreesWithTheBundle` records which, with counts, and refuses a
   * new one.
   */
  crossesYear?: boolean;
  /** Why the close falls in the following year, where the source leaves it implicit. */
  crossYearBasis?: string;
}

export interface ConditionalRule {
  id: string;
  speciesId: string;
  regulatoryGroupId: string;
  geography?: GeographyExpression;
  /**
   * What the rule is conditional on. A string value is a single-valued fact
   * (the rule applies only when the answer equals it); `permittedImplements`
   * is the set of methods it allows. A key the rule does not carry does not
   * constrain it.
   */
  appliesWhen: Record<string, string | string[]>;
  seasonLabel: string;
  /**
   * The regulatory animal classes this rule states — ANTLERED, ANTLERLESS,
   * BEARDED. Source-defined and never biological sex or age (§16).
   *
   * Bundles that are loaded and cast have carried this at runtime all along;
   * declaring it is what lets a consumer READ it. Québec's `engineRule` is the
   * only place a rule object is constructed, and it was dropping the field into
   * a prose note — the structured fact flattened on the way INTO the engine,
   * which is the same shape as everything else found this session.
   */
  animalClasses?: string[];
  /** AUTHORITY: the source table's exact season cell. */
  seasonPhrase: string;
  /**
   * The authority's own name for this season segment, where it names one.
   * Quoted, never translated or reformatted: it is the ministry's string.
   */
  implementLabel?: string;
  windows: ConditionalWindow[];
  declaredNoSeason: boolean;
  /** Including `alsoLimitedBy`: every further limit in force on the same harvest. */
  limits?: BundleLimits;
  conditionIds: string[];
  caveats: string[];
  /**
   * Notes; one naming a zone is shown only for that zone.
   *
   * A bare string, or `{ text }`, is NORTH GROUND'S OWN SENTENCE in English —
   * that is what the shape means, and it is why the shape is allowed to be
   * bare. An authority's own wording arrives as `{ words }`, an
   * `AuthorityQuotation`, which REQUIRES its language, its source and its
   * citation. A producer transcribing a ministry's note cannot therefore emit
   * it as though North Ground had written it in English, which is exactly what
   * Québec's `rules[].notes` were doing.
   */
  notes: Array<string | { zoneId?: string; text: string } | { zoneId?: string; words: AuthorityQuotation }>;
  /**
   * Where North Ground's cross-check found two defensible readings of the same
   * instrument. `words` is always OURS: a dispute exists because WE compared
   * two sources and found them capable of disagreeing, so the sentence
   * describing it is a reading, never a quotation. It was a bare `statedAs`,
   * which is the one name in this codebase that claims the opposite.
   */
  disputes: Array<{ zoneId?: string; words: NorthGroundStatement }>;
  sourceId: string;
  sourceSection: string;
  sourceVersion: string;
  reviewStatus: string;
  /**
   * The published hunt this season belongs to, where the jurisdiction
   * allocates seasons per hunt code or hunt number (`bundle.huntCodes`).
   */
  huntCodeId?: string;
  /** The instrument the rule is stated in, for amendment precedence. */
  authority?: RuleAuthority;
  /** Which reading of a dispute this rule is (see `appliesInWorld`). */
  reading?: "PRIMARY" | "ALTERNATIVE";
  /**
   * For a rule that declares no season: NORTH GROUND's own statement of why,
   * used as the answer when only such rules apply here.
   *
   * It said "the authority's own words", and it was not. All 23 values in the
   * corpus are ours: Montana's names the Commission in the third person and
   * adds what North Ground does not evaluate, Iowa's and three of Montana's
   * carry our own page or rule citation inside the sentence, and
   * Newfoundland's "no open season" describes an Order that names no season
   * at all — there are no words there to quote. The authority's actual
   * wording, where the bundle holds it, is in `notes`.
   *
   * Ownership is declared by the field rather than read off each value, so a
   * renderer cannot promote this to a quotation and a producer cannot leave
   * it ambiguous. A bundle that does hold the authority's closure wording
   * states it as an `AuthorityQuotation`, not here.
   */
  closureSummary?: string;
  /**
   * Days on which this rule's own source does not settle whether it runs.
   *
   * A window says when a season is open; outside every window the rule reads
   * as closed. That is right only where the source states the whole season.
   * Montana's 2026 booklet takes effect on March 1, 2026 and prints its
   * falconry season as "Sep. 01 - Mar. 31": it establishes the season that
   * opens in September, and is silent on whether falconry ran in March 2026,
   * the tail of a season the previous year's regulations opened. Reading that
   * silence as CLOSED is the false closure §8 names; inventing the window is
   * the inference it forbids.
   *
   * So on these days, where no rule that applies is in season, the answer for
   * this combination is NEEDS_VERIFICATION with the reason in North Ground's
   * own words — never CLOSED, and never a season.
   */
  unestablished?: Array<{ opensIso: string; closesIso: string; words: NorthGroundStatement }>;
}

export interface ConditionalCondition {
  id: string;
  text: string;
  /**
   * Whose words `text` is, DECLARED BY THE PRODUCER.
   *
   * Absent means North Ground's — most bundle conditions are a sentence we
   * wrote about an authority's rule. Québec's are not: they are the ministry's
   * own statements, transcribed, and they were reaching a hunter attributed to
   * North Ground and therefore rendered without the quotation marks that say
   * whose rule it is. A renderer must never decide this from the prose
   * (`limitation.ts`); only the transcriber knows.
   */
  owner?: "AUTHORITY" | "NORTH_GROUND";
  sourceId: string;
  sourceSection: string;
  zoneIds?: string[];
  speciesIds?: string[];
  activeWindows?: Array<{ opensIso: string; closesIso: string }>;
  activeWindowsByZone?: Record<string, Array<{ opensIso: string; closesIso: string }>>;
  caveats?: string[];
}

export interface ConditionalBundle extends GeographyData {
  bundleId: string;
  jurisdictionId: string;
  sourceVersion: string;
  retrievedAt: string;
  certifiedPeriod: { from: string; to: string; reason?: string };
  /**
   * What silence means, as the law says it. `meaning` covers a place no rule
   * names for the species at all. `excludedCombination` covers a place the
   * rules DO name for the species, where no rule fits the hunter's combination
   * (a rifle where only archery is published). They can differ: Alberta's
   * tables are complete for every unit they name, so an excluded combination is
   * closed there, while an unnamed unit is not something its guide speaks to.
   * Defaults to `meaning`.
   */
  absence: AbsenceMeaning & {
    /*
     * WHAT AN UNLISTED PLACE MEANS IS NOT ALWAYS ONE FACT PER JURISDICTION.
     *
     * British Columbia's Hunting Regulation is closed-world — s. 4 says the
     * open seasons ARE those set forth in the Schedules — so an unlisted unit
     * is CLOSED. But a SECOND instrument, the Limited Entry Hunting Regulation,
     * can set seasons for the species it names, and for those species North
     * Ground cannot say an unlisted unit is closed.
     *
     * Declared per species, because the alternative is what BC had: one
     * caveat, true of black bear alone, suppressing a certified CLOSED for six
     * other species across 391 unit combinations. A refusal that looks
     * principled, applied where its reason does not hold.
     *
     * Each exception states its OWN authority — it is a different instrument,
     * so it is a different citation.
     */
    speciesExceptions?: Record<string, AbsenceMeaning>;
  };
  sources: Array<{ id: string; conditions?: ConditionalCondition[] }>;
  groups: Array<{ id: string; officialSpec: string; zoneIds: string[]; partialZoneIds?: string[] }>;
  rules: ConditionalRule[];
  /** Published hunts the rules belong to, where the jurisdiction has them. */
  huntCodes?: HuntCode[];
  /** Published draw calendars the hunts' allocations refer to. */
  drawCycles?: DrawCycle[];
  /**
   * Later instruments that change rules for an interval — corrections,
   * closures, orders. Kept apart from the rules they amend, and applied per
   * date by `rulesInForce`, so what the law was on any day stays readable.
   */
  amendments?: Amendment[];
}

/* ── Vocabulary ─────────────────────────────────────────────────────────── */

export interface VocabularyDimension extends Omit<RequiredDimension, "options"> {
  /** Every value the jurisdiction recognises, in the order to offer them. */
  options: DimensionOption[];
  /**
   * Which rule key this dimension answers. Defaults to the dimension id;
   * HUNT_METHOD answers `permittedImplements`, which is a set.
   */
  ruleKey?: string;
  /**
   * Facts an answer fixes, declared rather than inferred: a Manitoba resident
   * licence implies Manitoba residency. Inferring this from which keys rules
   * happen to share would couple unrelated facts (every rule names a licence,
   * which would wrongly make age depend on it).
   */
  implies?: Record<string, Record<string, string>>;
  /**
   * Where the values offered come from. JURISDICTION (the default): every value
   * this species' law recognises anywhere, because a resident is still a
   * resident where only non-residents' seasons reach. PLACE: only values the
   * rules reaching this place name — for a hunt code, which is meaningful only
   * where its hunt is, and of which a state publishes hundreds.
   *
   * SPECIES, for HUNT_METHOD only: the methods some season for THIS species
   * permits somewhere in the jurisdiction. By default a method is offered
   * whatever the species, because a hunter may carry what no season permits —
   * and then the answer is CLOSED. Where the authority states one method list
   * for a species everywhere ("All other means of taking are prohibited",
   * Montana), offering a crossbow for pheasant makes a species-wide method rule
   * gate every zone, and §41A (2026-09-30) says a species-wide method rule is
   * said once in the card, never as the map's `!`. The rule is still said: it
   * is the species' methods condition, on every answer. An answer naming a
   * method this species is never hunted with is not applied, so the question
   * stays open rather than narrowing into a closure.
   */
  valuesFrom?: "JURISDICTION" | "PLACE" | "SPECIES";
}

export interface ConditionalVocabulary {
  jurisdictionName: string;
  /** The authority's term for its units, for sentences ("Game Hunting Area"). */
  unitTerm: string;
  /** Asked in this order when more than one fact is outstanding. */
  dimensions: VocabularyDimension[];
  legalTime: RegulatoryResult["legalTime"];
  /**
   * The legal window computed AT a point, where the jurisdiction can.
   *
   * Returns undefined to fall back to `legalTime` above — for a ZONE-scoped
   * question, where no point is known, or where the point's timezone cannot be
   * established. Each jurisdiction resolves its own timezone, because each
   * knows its own extent; the engine does not learn a jurisdiction lookup.
   */
  /**
   * `zoneId` is part of this because a jurisdiction's timezone can vary BY UNIT.
   * Idaho is the case: 49 CFR § 71.9(a) runs the mountain/Pacific line along a
   * county boundary and then the main channel of the Salmon River, so the state
   * has no single clock and the answer depends on which unit the point is in.
   * The caller already passes the whole place; the narrower type just hid the
   * field, and hiding it forced a per-STATE answer to a per-UNIT question.
   */
  legalTimeAt?: (
    speciesId: string,
    /* `zoneId` is absent at a point placed only in its jurisdiction (§41A). */
    place: { zoneId?: string; jurisdictionId?: string; latitude: number; longitude: number; scope?: "POINT" | "ZONE" },
    date: string,
    /*
     * The facts the hunter has stated. Hours can belong to a method rather
     * than to a species — Iowa states shooting hours for each species' regular
     * season and none for falconry — and without the answers a falconer would
     * be shown the gun season's clock as their own.
     */
    answers?: HuntDimensionAnswers,
  ) => RegulatoryResult["legalTime"] | undefined;
  /** Carried by every answer, because every answer is subject to them. */
  standingLimitations: Limitation[];
  /** The language the authority publishes its own labels in. */
  lang?: "en-CA" | "fr-CA";
  /** Source cited alongside every answer (for example the boundary layer). */
  standingSourceIds: string[];
  /** Readable name for a single-valued answer, for "open to this combination". */
  describe?: (dimension: string, value: string) => string;
}

/* ── Input ──────────────────────────────────────────────────────────────── */

/**
 * What the absence of a rule means, and on whose authority.
 *
 * `words` replaced a bare `statedAs`, and the reason is the whole provenance
 * split in miniature. That field sat beside `sourceId` and `section` under a
 * doc comment saying "on whose authority" — and **three of its five values
 * were North Ground's own reasoning**, not any authority's:
 *
 * - British Columbia and Manitoba hold regulation text their generators verify
 *   VERBATIM against the live instrument (`containsVerbatim`, `requireProvision`
 *   throw if the wording moves). Those are quotations.
 * - Alberta, Idaho and Montana hold hand-written constants that say things like
 *   "so North Ground reports UNKNOWN rather than CLOSED". Those are ours.
 *
 * Nothing rendered the field, so nothing was misattributed — but it is exactly
 * the generic string field the invariant names: its name, its neighbours and
 * its doc comment all invite a future consumer to quote it against `sourceId`.
 * Declaring authorship is what stops that, and the discriminator is evidence
 * (does a generator verify it against the source?) rather than a reading of
 * the prose.
 *
 * `section` and `sourceId` stay: they cite the provision the absence RULE rests
 * on, which is a fact about the bundle even where the sentence explaining it is
 * ours.
 */
/**
 * The explanatory clause for an absence, in prose North Ground may write.
 *
 * `explanation` is our explanation and `words` is whose words state the rule;
 * they are different texts, and 5 of the 13 bundles hold only one of them.
 *
 * The fallback below changes NO answer today, and saying otherwise was the
 * first thing measurement refuted: the four bundles that state the rule in
 * `words` with no `explanation` — Alberta, Idaho, Montana, Wyoming — all mean
 * UNKNOWN, and the UNKNOWN sentence does not come through here. Every bundle
 * whose absence means CLOSED holds an `explanation` (measured 2026-10-07). So
 * this is a guard against the next CLOSED-absence bundle that states its rule
 * only in `words`, which would render an empty slot before a bare citation.
 *
 * An AUTHORITY quotation is never returned here. Splicing it into our sentence
 * unmarked is the §47 defect this milestone already fixed in the seasons
 * listing; it travels tagged on `ClosureCause.basis` instead, where a renderer
 * can quote it properly.
 */
function absenceText(absence: AbsenceMeaning): string {
  if (absence.explanation) return absence.explanation;
  return absence.words?.owner === "NORTH_GROUND" ? absence.words.text : "";
}

/** The cause for a place the law does not list, with the bundle's own provenance. */
function unlistedPlace(absence: AbsenceMeaning): ClosureCause {
  return {
    kind: "UNLISTED_PLACE",
    ...(absence.words ? { basis: absence.words } : {}),
    ...(absence.section ? { section: absence.section } : {}),
    ...(absence.sourceId ? { sourceId: absence.sourceId } : {}),
  };
}

/** One declaration per distinct label-and-reason pair, in bundle order. */
export function dedupeDeclarations(declarations: ClosureDeclaration[]): ClosureDeclaration[] {
  const seen = new Set<string>();
  return declarations.filter((entry) => {
    const key = `${entry.about}\u0000${entry.why.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export interface AbsenceMeaning {
  meaning: "CLOSED" | "UNKNOWN";
  excludedCombination?: "CLOSED" | "UNKNOWN";
  /** Whose words explain the absence. Never a bare string. */
  words?: ProvenancedText;
  section?: string;
  sourceId?: string;
  explanation?: string;
}

/**
 * What an unlisted place means FOR THIS SPECIES.
 *
 * The jurisdiction's own rule, unless another instrument reaches this species
 * — in which case that instrument's statement replaces it whole rather than
 * being merged, so a citation can never be half one authority and half
 * another.
 */
export function absenceFor(
  bundle: Pick<ConditionalBundle, "absence">,
  speciesId: string,
): AbsenceMeaning {
  return bundle.absence.speciesExceptions?.[speciesId] ?? bundle.absence;
}

export interface ConditionalInput {
  speciesId: string;
  speciesName: string;
  date: string;
  place: PlaceContext & { zoneName: string };
  answers: HuntDimensionAnswers;
  /**
   * Published restrictions on overlapping land (refuges, closed lands) that
   * affect this species at this point. Supplied by the caller; a restriction
   * North Ground has not certified means the season status cannot be stated.
   */
  restrictions?: RestrictionRecord[];
  /**
   * True when every restriction supplied comes from a layer the authority
   * publishes as closed to ALL hunting (Québec's « Territoires où toute
   * activité de chasse est interdite »). The zone's seasons then say nothing
   * about this point, so none of them — dates, listings, bag limits — is shown.
   */
  restrictionsProhibitAllHunting?: boolean;
}

export interface ConditionalEvaluation {
  completeness: "RESOLVED" | "NEEDS_INPUT";
  required?: RequiredDimension;
  dimensions: RequiredDimension[];
  result?: RegulatoryResult;
  /**
   * The distinct legal harvest opportunities behind this answer.
   *
   * The engine has always computed these — `everyApplicable` — and then
   * rendered them to a prose sentence through `describeSeasons` and discarded
   * the structure. `result.season` is what survived: ONE season, no animal
   * class, no implement. That is the flattening `dimension-matrix.ts` opens by
   * refusing, and it is why a card could not show "antlered with a bow in
   * October" beside "either sex with a rifle in November".
   *
   * Emitted from the SAME selection the answer was computed from, so a surface
   * rendering them cannot disagree with the status beside them, and no consumer
   * has to re-derive which rules apply to a zone — which would be a second
   * place deciding legality.
   */
  opportunities?: ResolvedOpportunity[];
}

const PUBLISHABLE = new Set(["VERIFIED", "PUBLISHED"]);
const METHOD = "HUNT_METHOD";
const IMPLEMENTS = "permittedImplements";

function restrictionLimitation(restriction: RestrictionRecord): Limitation {
  return isQuotation(restriction.words)
    ? labelledSourceDetail(restriction.name, restriction.words)
    : general(provenancedLine(restriction.name, restriction.words));
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

function ruleKeyOf(dimension: VocabularyDimension): string {
  return dimension.ruleKey ?? (dimension.id === METHOD ? IMPLEMENTS : dimension.id);
}

/** The question as the interface receives it: engine-only fields left behind. */
function toRequired(dimension: VocabularyDimension, options: DimensionOption[]): RequiredDimension {
  return {
    id: dimension.id,
    question: dimension.question,
    reason: dimension.reason,
    options,
    multiple: dimension.multiple,
    allowsUnsure: dimension.allowsUnsure,
    sourceId: dimension.sourceId,
    ...(dimension.sourceSection ? { sourceSection: dimension.sourceSection } : {}),
  };
}

function matches(rule: ConditionalRule, key: string, value: string): boolean {
  const stated = rule.appliesWhen[key];
  if (stated === undefined) return true;
  return Array.isArray(stated) ? stated.includes(value) : stated === value;
}

/**
 * The values a rule names for one key, however it names them.
 *
 * `appliesWhen` has always allowed `string | string[]` and `matches` has always
 * honoured both — but three other sites read the field directly, two of them
 * comparing it with `===` and one casting it `as string`. Every one of those is
 * wrong for an array: the comparison silently never matches, and the cast reaches
 * a renderer as an array where a label is expected.
 *
 * Saskatchewan is the first bundle to name several values for a non-method key,
 * because its seasons are written for named licence classes and one subsection
 * routinely names two or three — "the holder of a First Saskatchewan Resident
 * White-tailed Deer Licence or a First Saskatchewan Resident Veteran White-tailed
 * Deer Licence". Splitting those into one rule per licence would have worked
 * around it by discarding the regulation's own grouping, so the readers are fixed
 * instead, and they all read through here so the next one cannot drift.
 */
function statedValues(rule: ConditionalRule, key: string): string[] {
  const stated = rule.appliesWhen[key];
  return typeof stated === "string" ? [stated] : Array.isArray(stated) ? stated : [];
}

/** Whether a rule names this value for this key. Never true for a key it omits. */
function statesValue(rule: ConditionalRule, key: string, value: string): boolean {
  return statedValues(rule, key).includes(value);
}

type Assignment = Record<string, string>;

function applicable(rules: ConditionalRule[], assignment: Assignment, vocabulary: ConditionalVocabulary): ConditionalRule[] {
  return rules.filter((rule) =>
    vocabulary.dimensions.every((dimension) => {
      const value = assignment[dimension.id];
      return value === undefined || matches(rule, ruleKeyOf(dimension), value);
    }));
}

function containing(rule: ConditionalRule, date: string): ConditionalWindow | undefined {
  return rule.windows.find((window) => date >= window.opensIso && date <= window.closesIso);
}

function limitsKey(rule: ConditionalRule): string {
  return JSON.stringify(rule.limits ?? null);
}

/** The answer in one world, from the rules that certainly apply there. */
interface WorldOutcome {
  status: RegulatoryStatus;
  /** Status and limits: what must agree across worlds for an answer to stand. */
  coarse: string;
  /** Plus the window containing the date: what a question has to be able to change. */
  fine: string;
  inSeason: ConditionalRule[];
  applicable: ConditionalRule[];
  /** True when no rule designates this place for this combination at all. */
  absent: boolean;
  /** Why the answer is NEEDS_VERIFICATION, where a rule's own days are unestablished. */
  reasons?: string[];
}

function settle(rules: ConditionalRule[], date: string, emptyMeaning: "CLOSED" | "UNKNOWN"): WorldOutcome {
  const open = rules.filter((rule) => !rule.declaredNoSeason);
  const inSeason = open.filter((rule) => containing(rule, date));
  if (inSeason.length) {
    const windows = [...new Set(inSeason.map((rule) => {
      const window = containing(rule, date)!;
      return `${window.opensIso}/${window.closesIso}`;
    }))].sort();
    const limits = [...new Set(inSeason.map(limitsKey))].sort();
    /* What a question must be able to change is when the season ends for this
       hunter, not when it began: two windows that are both open today and close
       on the same day are the same answer. */
    const closes = windows.map((window) => window.split("/")[1]).sort().at(-1);
    return {
      status: "CONDITIONAL",
      coarse: `CONDITIONAL|${limits.join(",")}`,
      fine: `CONDITIONAL|closes ${closes}|${limits.join(",")}`,
      inSeason,
      applicable: rules,
      absent: false,
    };
  }
  if (!rules.length) {
    // What "no rule here" means is the law's call, recorded in the bundle.
    return { status: emptyMeaning, coarse: emptyMeaning, fine: emptyMeaning, inSeason: [], applicable: [], absent: true };
  }
  /* Nothing is in season, but a rule's own source does not settle whether it
     runs today: not CLOSED (see `ConditionalRule.unestablished`). */
  const reasons = [...new Set(open.flatMap((rule) => (rule.unestablished ?? [])
    .filter((entry) => date >= entry.opensIso && date <= entry.closesIso)
    .map((entry) => entry.words.text)))].sort();
  if (reasons.length) {
    const key = `NEEDS_VERIFICATION|${reasons.join("|")}`;
    return { status: "NEEDS_VERIFICATION", coarse: key, fine: key, inSeason: [], applicable: rules, absent: false, reasons };
  }
  return { status: "CLOSED", coarse: "CLOSED", fine: "CLOSED", inSeason: [], applicable: rules, absent: false };
}

/** The answer for one complete set of facts, across every world. */
interface Outcome {
  status: RegulatoryStatus;
  key: string;
  worlds: WorldOutcome[];
  /** Unknowns whose value changes the answer, when the worlds disagree. */
  reasons: string[];
  /** True when the reasons are days a rule's own source leaves unsettled, not geography. */
  unestablished?: boolean;
}

interface OutcomeContext {
  date: string;
  place: PlaceContext;
  groups: ReadonlyMap<string, { zoneIds: string[] }>;
  absence: ConditionalBundle["absence"];
  vocabulary: ConditionalVocabulary;
}

function sameWorldApartFromReading(a: PlaceWorld, b: PlaceWorld): boolean {
  return a.disputedReadingsHold !== b.disputedReadingsHold &&
    a.gameBirdZone === b.gameBirdZone &&
    a.unplacedUnit === b.unplacedUnit &&
    /* A reading disputed only in a zone this point may or may not be in is not
       a conflict AT this point: whether it reaches the point is the unknown,
       so the answer is "needs a closer look", not "the sources disagree here". */
    ![...a.inside].some(isUnplacedZoneFact) &&
    [...a.inside].sort().join(",") === [...b.inside].sort().join(",");
}

/**
 * WHAT A POINT WITH NO ZONE CANNOT BE PLACED AGAINST.
 *
 * A point placed only in its jurisdiction (§41A, "Resolving inside a
 * jurisdiction is not drawing its boundary") is reached by whole-jurisdiction
 * rules alone, and a rule scoped narrower never matches it. That is right,
 * and it is not the whole answer: the narrower rule still exists, and the
 * point may lie inside its geography. Two things follow, both found by asking
 * the engine rather than the bundle:
 *
 *  - a season the narrower rule opens TODAY could make the point open, so a
 *    statewide CLOSED there was an absence of evidence drawn as a closure, and
 *    a statewide open season could be one of two with different limits;
 *  - a condition the bundle scopes to named zones has no zone to apply to at
 *    such a point, and dropping it handed out the statewide answer without a
 *    requirement that may bind the hunter where they stand.
 *
 * Each is something the engine cannot test, so each is a reason the answer
 * needs a closer look. The narrower rule is NEVER the answer: it is named,
 * never matched, and contributes no season, limit or condition.
 */
function unplaceableAtJurisdictionPoint(
  bundle: ConditionalBundle,
  inForceRules: ConditionalRule[],
  inSeason: ConditionalRule[],
  speciesId: string,
  known: Assignment,
  vocabulary: ConditionalVocabulary,
  date: string,
): string[] {
  const narrower = inForceRules.filter((rule) =>
    !rule.geography?.include.jurisdiction &&
    !rule.declaredNoSeason &&
    containing(rule, date) &&
    applicable([rule], known, vocabulary).length > 0);
  const seasons = [...new Set(narrower.map((rule) => `${rule.seasonLabel}, ${rule.seasonPhrase} (${rule.geography?.statedAs ?? bundle.groups.find((group) => group.id === rule.regulatoryGroupId)?.officialSpec ?? rule.regulatoryGroupId})`))];
  const all = new Map(bundle.sources.flatMap((source) => source.conditions ?? []).map((condition) => [condition.id, condition]));
  const zoneScoped = [...new Set(inSeason.flatMap((rule) => rule.conditionIds))]
    .map((id) => all.get(id))
    .filter((condition): condition is NonNullable<typeof condition> => Boolean(condition))
    .filter((condition) => (!condition.speciesIds || condition.speciesIds.includes(speciesId)) && (condition.zoneIds?.length || condition.activeWindowsByZone));
  return [
    ...(seasons.length
      ? [`${vocabulary.jurisdictionName} also sets a season for part of the jurisdiction that is open on this date: ${seasons.join("; ")}. ` +
        "North Ground placed this point in the jurisdiction, not in a unit, so it cannot say whether that season reaches it."]
      : []),
    ...zoneScoped.map((condition) =>
      `A requirement applies in named units only (${condition.text}). North Ground placed this point in the jurisdiction, not in a unit, so it cannot say whether it applies here.`),
  ];
}

function outcomeFor(
  rules: ConditionalRule[],
  assignment: Assignment,
  worlds: PlaceWorld[],
  unknowns: Array<{ kind: string; statedAs: string }>,
  context: OutcomeContext,
): Outcome {
  const perWorld = worlds.map((world) => {
    const here = rules.filter((rule) => appliesInWorld(rule, context.groups, context.place, world));
    /* No rule for the species here at all is the law's silence about the place;
       rules here that do not fit this combination are its silence about the
       combination. The bundle says what each means. */
    const emptyMeaning = here.length ? context.absence.excludedCombination ?? context.absence.meaning : context.absence.meaning;
    return settle(applicable(here, assignment, context.vocabulary), context.date, emptyMeaning);
  });

  if (new Set(perWorld.map((outcome) => outcome.coarse)).size === 1) {
    const fine = [...new Set(perWorld.map((outcome) => outcome.fine))].sort().join(" or ");
    const reasons = [...new Set(perWorld.flatMap((outcome) => outcome.reasons ?? []))];
    return { status: perWorld[0].status, key: fine, worlds: perWorld, reasons, ...(reasons.length ? { unestablished: true } : {}) };
  }

  /* The worlds disagree. If two worlds that differ ONLY in whether a disputed
     reading holds disagree, the sources themselves conflict; otherwise it is
     geography North Ground could not establish. */
  const disputeMatters = worlds.some((world, index) => worlds.some((other, otherIndex) =>
    sameWorldApartFromReading(world, other) && perWorld[otherIndex].coarse !== perWorld[index].coarse));
  const status: RegulatoryStatus = disputeMatters ? "CONFLICT" : "NEEDS_VERIFICATION";
  const reasons = [...new Set([
    ...unknowns
      .filter((unknown) => disputeMatters || unknown.kind !== "DISPUTE")
      .map((unknown) => unknown.statedAs),
    ...perWorld.flatMap((outcome) => outcome.reasons ?? []),
  ])];
  return { status, key: `${status}|${reasons.join("|")}`, worlds: perWorld, reasons };
}

/**
 * Every combination of the facts still unknown, restricted to combinations the
 * vocabulary says can occur: a Manitoba resident licence is never combined
 * with non-Canadian residency.
 */
function assignments(
  dimensions: VocabularyDimension[],
  known: Assignment,
  valuesFor: (dimension: VocabularyDimension) => string[],
  coherent: (assignment: Assignment) => boolean,
): Assignment[] {
  let out: Assignment[] = [{ ...known }];
  for (const dimension of dimensions) {
    if (known[dimension.id] !== undefined) continue;
    const next: Assignment[] = [];
    for (const partial of out) {
      for (const value of valuesFor(dimension)) {
        const candidate = { ...partial, [dimension.id]: value };
        if (coherent(candidate)) next.push(candidate);
      }
    }
    out = next;
  }
  return out;
}

/**
 * The seasons that could apply, each named once, with the conditions the
 * hunter has not already stated — so an unasked fact (under 18, a particular
 * licence) is never silently assumed, and a season every licence shares is not
 * listed three times.
 */
function describeSeasons(
  rules: ConditionalRule[],
  vocabulary: ConditionalVocabulary,
  answered: Assignment,
  offered: (dimension: VocabularyDimension) => string[],
): SeasonListing[] {
  const bySeason = new Map<string, ConditionalRule[]>();
  for (const rule of rules) {
    if (rule.declaredNoSeason) continue;
    const key = `${rule.seasonLabel} ${rule.seasonPhrase}`;
    bySeason.set(key, [...(bySeason.get(key) ?? []), rule]);
  }
  const out: SeasonListing[] = [];
  for (const [season, group] of bySeason) {
    const qualifiers: string[] = [];
    const namedByLicence = new Set<string>();
    for (const dimension of vocabulary.dimensions) {
      const key = ruleKeyOf(dimension);
      if (key === IMPLEMENTS || answered[dimension.id] !== undefined) continue;
      if (group.some((rule) => rule.appliesWhen[key] === undefined)) continue;
      const values = [...new Set(group.flatMap((rule) => statedValues(rule, key)))];
      if (offered(dimension).every((value) => values.includes(value))) continue;
      const labels = values.map((value) =>
        vocabulary.describe?.(dimension.id, value) ?? dimension.options.find((option) => option.value === value)?.label ?? value);
      // Already said by the season's own label ("(under age 18 only)").
      qualifiers.push(labels.every((label) => season.toLowerCase().includes(label.toLowerCase())) ? "" : labels.join(" or "));
      if (dimension.implies) for (const implied of Object.values(dimension.implies)) for (const other of Object.keys(implied)) namedByLicence.add(other);
    }
    // A named licence already says who may hold it; drop the facts it implies.
    const kept = qualifiers.filter((_label, index) => {
      const dimension = vocabulary.dimensions.filter((entry) => {
        const key = ruleKeyOf(entry);
        return key !== IMPLEMENTS && answered[entry.id] === undefined && !group.some((rule) => rule.appliesWhen[key] === undefined) &&
          !offered(entry).every((value) => group.some((rule) => statesValue(rule, key, value)));
      })[index];
      return !(dimension && namedByLicence.has(dimension.id));
    });
    const shown = kept.filter(Boolean);
    /*
     * THE AUTHORITY'S WORDS AND OURS, SEPARATED AT THE POINT THEY WERE BEING
     * JOINED. `seasonPhrase` is the authority's own window wording and carries
     * the source and section that cite it, so it is quotable. The qualifiers
     * are North Ground's own. The composed heading is NEITHER, and is carried
     * untagged rather than claimed: Québec builds it from the ministry's
     * implement wording and its own word for the youth weekend, so calling it
     * our framing would put a ministry's words in our mouth. Ownership is
     * DECLARED by the producer, never read off the prose — the same rule
     * `structuredConditions` states below.
     */
    const first = group[0];
    out.push({
      stated: quoting(
        first.seasonPhrase,
        first.sourceId as CanonicalId<"source">,
        first.sourceSection ?? vocabulary.jurisdictionName,
        vocabulary.lang ?? "en-CA",
      ),
      ...(first.seasonLabel ? { composedLabel: first.seasonLabel } : {}),
      framing: { qualifiers: shown },
    });
  }
  return out;
}

/**
 * The listing sentence, DERIVED from the structured listings rather than
 * authored beside them, so the sentence and the citations cannot drift apart.
 * The words are byte-identical to what this produced as a string.
 */
function listingSentence(listings: SeasonListing[], scope: string): string {
  if (!listings.length) return "";
  const parts = listings.map(({ stated, composedLabel, framing }) => {
    const season = composedLabel ? `${composedLabel} ${stated.text}` : stated.text;
    return framing.qualifiers.length ? `${season} (${framing.qualifiers.join("; ")})` : season;
  });
  return ` Seasons open to ${scope} here: ${parts.join("; ")}.`;
}

function conditionsFor(
  bundle: ConditionalBundle,
  rules: ConditionalRule[],
  speciesId: string,
  /* Absent at a point placed only in its jurisdiction: a condition scoped to
     named zones then has no zone to apply to, and does not. */
  zoneId: string | undefined,
  date: string,
): ConditionalCondition[] {
  const all = new Map(bundle.sources.flatMap((source) => source.conditions ?? []).map((condition) => [condition.id, condition]));
  const ids = [...new Set(rules.flatMap((rule) => rule.conditionIds))];
  const out: ConditionalCondition[] = [];
  for (const id of ids) {
    const condition = all.get(id);
    if (!condition) throw new Error(`Rule refers to unknown condition ${id}`);
    if (condition.speciesIds && !condition.speciesIds.includes(speciesId)) continue;
    if (condition.zoneIds && (!zoneId || !condition.zoneIds.includes(zoneId))) continue;
    const windows = condition.activeWindowsByZone ? (zoneId ? condition.activeWindowsByZone[zoneId] : undefined) : condition.activeWindows;
    if ((condition.activeWindowsByZone || condition.activeWindows) && !windows?.some((window) => date >= window.opensIso && date <= window.closesIso)) continue;
    out.push(condition);
  }
  return out;
}

/* ── Evaluation ─────────────────────────────────────────────────────────── */

export function evaluateConditional(
  bundle: ConditionalBundle,
  vocabulary: ConditionalVocabulary,
  input: ConditionalInput,
): ConditionalEvaluation {
  const { place, date } = input;
  const unit = place.zoneName;
  const species = input.speciesName;
  const groups = new Map(bundle.groups.map((group) => [group.id, group]));

  /*
   * The facts the hunter has established, once the engine has read them. Held
   * here so `base` can see them; empty until then.
   */
  let established: Assignment = {};
  /*
   * WHICH RULES A "NEXT SEASON" MAY BE TAKEN FROM.
   *
   * Found on Iowa's pheasant: an adult who had said only "not by falconry"
   * was shown NEXT SEASON OPENS 24 October — the resident youth weekend —
   * when their own season opens on the 31st. A date shown without its
   * condition is read as everyone's, so a season for a class of hunter the
   * answer has not established (residency, age, licence, hunt) is not offered
   * as the next opening while a season open to everyone the answers allow
   * exists. Where every candidate turns on such a fact, they all stay —
   * dropping them would say nothing opens at all. Method is not filtered: a
   * bow-only opening is a fact about what the hunter carries, and its label
   * travels with the season.
   */
  const openingRules = (rules: ConditionalRule[]): ConditionalRule[] => {
    const unconditional = rules.filter((rule) => Object.entries(rule.appliesWhen).every(([key, value]) => {
      if (key === IMPLEMENTS) return true;
      const dimension = vocabulary.dimensions.find((entry) => ruleKeyOf(entry) === key);
      if (!dimension || dimension.id === METHOD) return true;
      const answer = established[dimension.id];
      return answer !== undefined && (Array.isArray(value) ? value.includes(answer) : value === answer);
    }));
    return unconditional.length ? unconditional : rules;
  };

  const base = (overrides: Partial<RegulatoryResult>, rules: ConditionalRule[] = []): RegulatoryResult => ({
    /*
     * The next opening, from the rules THIS answer was built from.
     *
     * Reuses the one `nextOpening` rather than repeating the search here: a
     * second implementation is how a next date comes to disagree with the
     * season beside it. The windows are already resolved to ISO days by the
     * bundle, and the certified period is the bundle's own — so where nothing
     * further opens inside it the answer is NONE_IN_CERTIFIED_PERIOD with that
     * horizon, which is the right answer for a time-bounded provincial
     * publication and the wrong one for a standing federal regulation.
     *
     * Rules are passed to `base` at every site that has them; a site with none
     * yields NOT_CERTIFIED, which is what having no basis means.
     */
    next: nextOpening(
      openingRules(rules.filter((rule) => !rule.declaredNoSeason)).map((rule) => ({
        verdict: "OUT_OF_SEASON" as const,
        /*
         * `crossesYear` means the season spans the turn of the calendar year —
         * `crossesYear()` in `season.ts` decides it by comparing MONTH-AND-DAY
         * anchors, so 15 October to 15 March crosses. A resolved window is
         * already anchored to its licence year and so never wraps: this was
         * `closesIso < opensIso`, which is false for every resolved window, and
         * therefore told a consumer that a 15 October to 15 March season does
         * not cross the year. From resolved dates the same fact is whether the
         * two years differ, and `crossesYearAgreesWithTheBundle` in
         * `engine-answers-somewhere.test.ts` pins it against each bundle's own
         * flag so the two definitions cannot drift apart again.
         */
        windows: rule.windows.map((window) => ({
          opensIso: window.opensIso, closesIso: window.closesIso,
          crossesYear: window.opensIso.slice(0, 4) !== window.closesIso.slice(0, 4),
        })),
        span: bundle.certifiedPeriod,
      })),
      date,
    ),
    status: "UNKNOWN",
    summary: "",
    legalTime: vocabulary.legalTimeAt?.(input.speciesId, place, date, input.answers) ?? vocabulary.legalTime,
    requirements: [],
    limitations: [...vocabulary.standingLimitations],
    sourceIds: [...new Set([...rules.map((rule) => rule.sourceId), ...vocabulary.standingSourceIds])] as CanonicalId<"source">[],
    verifiedAt: bundle.retrievedAt,
    ...overrides,
  });

  const speciesRules = bundle.rules.filter((rule) => rule.speciesId === input.speciesId && PUBLISHABLE.has(rule.reviewStatus));
  if (!speciesRules.length) {
    return {
      completeness: "RESOLVED",
      dimensions: [],
      result: base({
        status: "UNKNOWN",
        summary: `North Ground has not certified ${vocabulary.jurisdictionName} rules for ${species}. That is a gap in North Ground's coverage, not a statement that there is no season.`,
      }),
    };
  }

  if (date < bundle.certifiedPeriod.from || date > bundle.certifiedPeriod.to) {
    return {
      completeness: "RESOLVED",
      dimensions: [],
      result: base({
        status: "NEEDS_VERIFICATION",
        summary:
          `North Ground has certified ${vocabulary.jurisdictionName}'s rules for ${bundle.certifiedPeriod.from} to ${bundle.certifiedPeriod.to}. ` +
          "The selected date falls outside that period, so a version of the law North Ground has not read governs it.",
        limitations: [...vocabulary.standingLimitations, ...(bundle.certifiedPeriod.reason ? [general(bundle.certifiedPeriod.reason)] : [])],
      }, speciesRules.slice(0, 1)),
    };
  }

  /* ── The rules in force on this date, after amendments ───────────── */

  const speciesRuleIds = new Set(speciesRules.map((rule) => rule.id));
  const amendments = (bundle.amendments ?? [])
    .map((amendment) => ({ ...amendment, amends: amendment.amends.filter((id) => speciesRuleIds.has(id)) }))
    .filter((amendment) => amendment.amends.length);
  const inForce = rulesInForce(speciesRules, amendments, date);
  /* Two instruments that disagree about a rule on this date are both kept, as
     the two readings of a dispute. The engine answers only where they agree,
     and CONFLICT where they do not — it never picks the newer page. */
  const ruleVersions: ConditionalRule[] = [
    ...inForce.rules,
    ...inForce.conflicts.flatMap((conflict) => conflict.alternatives.map((alternative, index) => ({
      ...alternative,
      id: `${alternative.id}#${index === 0 ? "reading-a" : "reading-b"}`,
      disputes: [...alternative.disputes, { words: conflict.words }],
      reading: index === 0 ? "PRIMARY" as const : "ALTERNATIVE" as const,
    }))),
  ];
  const amendedBy = inForce.applied.map((entry) => `${entry.statedAs} (${entry.sourceSection})`);
  const amendmentSources = inForce.applied.map((entry) => entry.sourceId);

  /* ── The worlds this point could be in, and the rules that can reach it ── */

  const { worlds, unknowns } = placeWorlds(bundle, place, ruleVersions);
  const rules = ruleVersions.filter((rule) => worlds.some((world) => appliesInWorld(rule, groups, place, world)));
  /* What an unlisted place means FOR THIS SPECIES — see `absenceFor`. */
  const absence = absenceFor(bundle, input.speciesId);
  const context: OutcomeContext = { date, place, groups, absence, vocabulary };

  /* No rule reaches a point with no zone, but rules scoped narrower than the
     jurisdiction exist and the point may lie in one: the bundle's "an
     unlisted place is closed" is about places the law does not list, and
     this point has not been shown to be one. Silence is not a closure here. */
  const unplacedNarrower = !place.zoneId && ruleVersions.some((rule) => !rule.geography?.include.jurisdiction && !rule.declaredNoSeason);
  if (!rules.length) {
    if (absence.meaning === "CLOSED" && !unplacedNarrower) {
      return {
        completeness: "RESOLVED",
        dimensions: [],
        result: base({
          status: "CLOSED",
          summary:
            `No ${vocabulary.jurisdictionName} licence authorises hunting ${species} in ${unit}. ` +
            `${absenceText(absence)} (${absence.section ?? "source"})`.trim(),
          closure: unlistedPlace(absence),
        }, speciesRules.slice(0, 1)),
      };
    }
    return {
      completeness: "RESOLVED",
      dimensions: [],
      result: base({
        status: "UNKNOWN",
        summary: unplacedNarrower
          ? `${vocabulary.jurisdictionName}'s certified ${species} seasons are set for parts of the jurisdiction, and North Ground placed this point ` +
            "in the jurisdiction rather than in a unit, so it cannot say whether any of them reaches it. That is not evidence that the season is closed."
          : `No certified rule covers ${species} in ${unit}. The unit is not named by any season row North Ground has certified, ` +
            "and an absent row is not evidence that the season is closed.",
      }),
    };
  }

  /* ── Which facts matter, and which are already known ─────────────── */

  const relevant = vocabulary.dimensions.filter((dimension) =>
    rules.some((rule) => rule.appliesWhen[ruleKeyOf(dimension)] !== undefined));

  /* The values a fact can take are what this species' law recognises, not what
     the rules here happen to name. A Manitoba resident at a place only
     non-residents' licences reach is still a Manitoba resident, and the answer
     for them (closed, by s. 3) is a real answer. */
  const valuesFor = (dimension: VocabularyDimension): string[] => {
    const key = ruleKeyOf(dimension);
    // A method is a fact about the hunter: someone may carry what no season permits.
    if (key === IMPLEMENTS) {
      const every = dimension.options.map((option) => option.value);
      if (dimension.valuesFrom !== "SPECIES") return every;
      /* Except where the jurisdiction declares the species' own method list
         is the whole question (`valuesFrom`). A season stating no method
         permits every one. */
      const seasons = speciesRules.filter((rule) => !rule.declaredNoSeason);
      if (seasons.some((rule) => rule.appliesWhen[key] === undefined)) return every;
      const permitted = new Set(seasons.flatMap((rule) => [rule.appliesWhen[key]].flat()));
      return every.filter((value) => permitted.has(value));
    }
    const scope = dimension.valuesFrom === "PLACE" ? rules : speciesRules;
    /*
     * A RULE MAY NAME SEVERAL VALUES FOR ONE KEY, AND THIS USED TO HARVEST ONLY
     * THE SINGLE ONES.
     *
     * `matches` has always accepted an array for ANY key — "the rule applies when
     * the answer is any of these" — but this only collected values whose
     * `appliesWhen[key]` was a string. A dimension every one of whose rules names
     * its values as an array therefore offered NOTHING, which made the assignment
     * space empty and crashed on `outcomes[0]` further down.
     *
     * Saskatchewan is the first bundle to hit it, because its seasons are written
     * for named licence classes and a single subsection routinely names two or
     * three of them: "a person who is the holder of a First Saskatchewan Resident
     * White-tailed Deer Licence OR a First Saskatchewan Resident Veteran
     * White-tailed Deer Licence may hunt …". Splitting those into one rule per
     * licence would have worked around it by discarding the regulation's own
     * grouping, so the harvest is fixed instead.
     */
    const stated = new Set(scope.flatMap((rule) => statedValues(rule, key)));
    // A rule without the key applies to every value, including values no rule
    // names, such as an adult where only a youth season names age.
    const unconstrained = scope.some((rule) => rule.appliesWhen[key] === undefined);
    return dimension.options.map((option) => option.value).filter((value) => stated.has(value) || unconstrained);
  };

  /* A combination the vocabulary says cannot occur is not a real one. */
  const coherent = (assignment: Assignment): boolean => {
    for (const dimension of vocabulary.dimensions) {
      const value = assignment[dimension.id];
      const implied = value === undefined ? undefined : dimension.implies?.[value];
      if (!implied) continue;
      for (const [other, required] of Object.entries(implied)) {
        if (assignment[other] !== undefined && assignment[other] !== required) return false;
      }
    }
    return true;
  };

  const known: Assignment = {};
  for (const dimension of relevant) {
    const value = answerFor(input.answers, dimension.id as HuntDimensionId);
    const offeredHere = toRequired(dimension, dimension.options.filter((option) => valuesFor(dimension).includes(option.value)));
    // Answers arrive from a browser. Only a value this dimension offers here,
    // consistent with the other answers, is applied; anything else leaves the
    // question open rather than narrowing the rules into a false closure.
    if (value !== undefined && isAnswerValid(offeredHere, value) && coherent({ ...known, [dimension.id]: value })) {
      known[dimension.id] = value;
      continue;
    }
    /* A value the jurisdiction publishes but this place does not offer is a
       fact about the hunter, not a bad answer: a tag for a hunt whose area is
       somewhere else does not authorise anything here. Dropping it would
       answer for the hunts that ARE here and tell that hunter the season is
       open. Only a PLACE-scoped dimension can say this — a residency or age
       the local rules never name is still a real person, answered by the
       rules that do apply. */
    if (dimension.valuesFrom === "PLACE" && value !== undefined && dimension.options.some((option) => option.value === value)) {
      const elsewhere = bundle.huntCodes?.find((huntCode) => huntCode.code === value);
      const named = vocabulary.describe?.(dimension.id, value) ?? value;
      return {
        completeness: "RESOLVED",
        dimensions: [],
        result: base({
          status: "CLOSED",
          closure: {
            kind: "AUTHORIZATION_COVERS_ANOTHER_AREA",
            authorization: named,
            ...(elsewhere ? { statedArea: elsewhere.geography.statedAs } : {}),
          },
          summary:
            `${named.charAt(0).toUpperCase()}${named.slice(1)} does not cover ${unit}` +
            `${elsewhere ? `: its area is ${elsewhere.geography.statedAs}` : ""}. ` +
            "A tag for it does not authorise hunting here, whatever is open here under another hunt.",
          limitations: [
            ...vocabulary.standingLimitations,
            general(`Hunts whose area does reach ${unit} are listed when the question is asked again without this answer.`),
          ],
        }, elsewhere ? bundle.rules.filter((rule) => rule.huntCodeId === elsewhere.id).slice(0, 1) : []),
      };
    }
  }

  established = known;
  const space = assignments(relevant, known, valuesFor, coherent);
  const outcomes = space.map((assignment) => ({ assignment, outcome: outcomeFor(rules, assignment, worlds, unknowns, context) }));
  const answeredDimensions = relevant.filter((dimension) => known[dimension.id] !== undefined);
  const asRequired = (dimension: VocabularyDimension) => {
    const values = new Set(space.map((assignment) => assignment[dimension.id]));
    return toRequired(dimension, dimension.options.filter((option) => values.has(option.value)));
  };

  if (new Set(outcomes.map((entry) => entry.outcome.key)).size > 1) {
    /* Ask the first fact, in the vocabulary's order, whose answer changes
       which outcomes remain possible. Residency is asked before licence
       because knowing it narrows the answer even though a licence implies it. */
    const unanswered = relevant.filter((dimension) => known[dimension.id] === undefined);
    const informative = unanswered.find((dimension) => {
      const reachable = new Map<string, Set<string>>();
      for (const { assignment, outcome } of outcomes) {
        const value = assignment[dimension.id];
        const set = reachable.get(value) ?? new Set<string>();
        set.add(outcome.key);
        reachable.set(value, set);
      }
      return new Set([...reachable.values()].map((set) => [...set].sort().join(" | "))).size > 1;
    }) ?? unanswered[0];
    const required = asRequired(informative);
    return {
      completeness: "NEEDS_INPUT",
      required,
      dimensions: [...answeredDimensions.map(asRequired), required],
      /*
       * THE OPPORTUNITIES ARE EMITTED HERE TOO, and this is the case they
       * matter most in. The engine asks a question precisely BECAUSE the
       * seasons differ — archery in September, rifle in November — so a hunter
       * who has answered nothing yet is exactly the one who should be able to
       * see what exists rather than being asked to name a method first.
       *
       * Scoped to `rules`, the zone's own rules, because no answer has narrowed
       * them: with nothing known, every rule that reaches this place is a real
       * opportunity. Narrowing them to one world's `applicable` would answer
       * the question the engine is still asking.
       */
      opportunities: opportunityRowsFrom({ speciesId: input.speciesId, rules }),
    };
  }

  /* ── One answer, whatever the facts still unknown are ────────────── */

  /*
   * AN EMPTY ASSIGNMENT SPACE IS AN ANSWER, NOT A CRASH.
   *
   * `outcomes[0]` was read unguarded, so a vocabulary that offered no value for
   * some dimension threw a TypeError out of the engine rather than answering.
   * That is reachable whenever a dimension's values are derived from the rules and
   * none of them yields one — which is how the array-harvest defect above
   * surfaced, and which a future vocabulary can reach again by other means.
   *
   * What it means is real and sayable: no combination of facts this jurisdiction
   * recognises reaches this place, so North Ground cannot evaluate rather than
   * cannot answer. UNKNOWN with the reason, never CLOSED.
   */
  if (!outcomes.length) {
    const offering = relevant.filter((dimension) => known[dimension.id] === undefined && valuesFor(dimension).length === 0);
    return {
      completeness: "RESOLVED",
      dimensions: [],
      result: base({
        status: "UNKNOWN",
        summary:
          `North Ground cannot evaluate ${species} in ${unit}: the certified ${vocabulary.jurisdictionName} rules ` +
          `reaching here offer no value for ` +
          `${offering.length ? offering.map((dimension) => dimension.question).join("; ") : "a fact the answer depends on"}` +
          `. That is a gap in North Ground's model of this jurisdiction, not a statement that there is no season.`,
      }, rules),
    };
  }

  let outcome = outcomes[0].outcome;
  const dimensions = answeredDimensions.map(asRequired);
  const allWorldOutcomes = outcomes.flatMap((entry) => entry.outcome.worlds);
  const everyApplicable = [...new Set(allWorldOutcomes.flatMap((entry) => entry.applicable))];
  const everyInSeason = [...new Set(allWorldOutcomes.flatMap((entry) => entry.inSeason))];
  if (!place.zoneId && (outcome.status === "CONDITIONAL" || outcome.status === "CLOSED")) {
    const reasons = unplaceableAtJurisdictionPoint(bundle, ruleVersions, everyInSeason, input.speciesId, known, vocabulary, date);
    if (reasons.length) outcome = { ...outcome, status: "NEEDS_VERIFICATION", key: `NEEDS_VERIFICATION|${reasons.join("|")}`, reasons };
  }
  const offered = (dimension: VocabularyDimension) => valuesFor(dimension).filter((value) => coherent({ ...known, [dimension.id]: value }));
  const seasons = describeSeasons(everyApplicable.length ? everyApplicable : rules, vocabulary, known, offered);
  const scope = answeredDimensions.length ? "this combination" : "any licence";
  const listing = listingSentence(seasons, scope);
  const cited = everyInSeason.length ? everyInSeason : everyApplicable.length ? everyApplicable : rules;
  /*
   * The same rules, kept as structure instead of only as the sentence
   * `describeSeasons` makes of them. One line, because the selection was
   * already done — that is the point: nothing downstream re-decides which rules
   * reach this zone, which would be a second place deciding legality.
   */
  const opportunities = opportunityRowsFrom({ speciesId: input.speciesId, rules: everyApplicable });

  const bundleConditions = conditionsFor(bundle, everyInSeason, input.speciesId, place.zoneId, date);
  /*
   * The conditions, structured, each keeping the source that supports it.
   *
   * These used to be built straight into strings with the citation glued on,
   * which made them impossible to group under one source affordance and
   * impossible to test for HAVING a source. The strings are still produced —
   * `requirements` below — but they are now DERIVED from these rather than
   * authored alongside them, so a line and its citation cannot drift apart.
   */
  const structuredConditions: RegulatoryCondition[] = [
    ...bundleConditions.map((condition) => ({
      id: condition.id,
      text: condition.text,
      /* The bundle's own language. A jurisdiction publishing in French keeps
         its words in French and is tagged, never translated (§47). */
      lang: vocabulary.lang ?? ("en-CA" as const),
      /*
       * NORTH_GROUND, and deliberately not inferred. Every bundle condition
       * today is a sentence North Ground wrote about an authority's rule —
       * several say so outright ("North Ground cannot verify what you hold") —
       * and marking the whole line AUTHORITY would put our caution in a
       * ministry's mouth. A bundle that starts carrying the authority's own
       * wording declares it there; a renderer never decides it from the prose.
       */
      owner: condition.owner ?? ("NORTH_GROUND" as const),
      sourceSection: condition.sourceSection,
      sourceId: condition.sourceId as CanonicalId<"source">,
      /* Declared, never read from the text: `condition-kinds.json`. A row
         that names its own zones is zone-scoped by its structure. */
      ...classificationOf(condition.id, Boolean(condition.zoneIds?.length || condition.activeWindowsByZone)),
    })),
    /*
     * The harvest limit, which the engine composes rather than reads — so it
     * is the one line whose KIND the producer actually knows, and the only one
     * that carries one.
     */
    /* One line per limit in force, a further limit (`alsoLimitedBy`) included:
       a falconer held to the species' own limit as well as the falconry pool
       is told both. */
    ...[...new Map(everyInSeason
      .flatMap((rule) => (rule.limits ? [rule.limits, ...(rule.limits.alsoLimitedBy ?? [])] : []).map((limits) => ({ rule, limits })))
      .filter(({ limits }) => limits.statedAs && limits.section)
      .map(({ rule, limits }) => [
        `${limits.statedAs}|${limits.section}`,
        {
          id: conditionId(`limit:${limits.statedAs}|${limits.section}`),
          text: `Bag limit: ${limits.statedAs}.`,
          /* NORTH GROUND'S OWN ENGLISH SENTENCE, whatever the bundle's language
             is. It took `vocabulary.lang`, so Québec's bag limits were tagged
             French — the inverse mislabel, and the quieter one: nothing looks
             wrong and a screen reader pronounces English with French
             phonetics. The authority's figure inside it is a quoted fragment,
             which `limitation.ts` already settles: a mixed line is tagged by
             its OUTER author. */
          lang: "en-CA" as const,
          owner: "NORTH_GROUND" as const,
          sourceSection: limits.section!,
          sourceId: rule.sourceId as CanonicalId<"source">,
          kind: "HARVEST_LIMIT" as const,
        },
      ] as const)).values()],
  ];
  const requirements = structuredConditions.map(conditionLine);
  /* When the point's worlds agreed, say what could not be established and that
     it does not change the answer, so the reader need not take on trust that it
     was considered. */
  const agreedDespite = worlds.length > 1 && outcome.status !== "NEEDS_VERIFICATION" && outcome.status !== "CONFLICT"
    ? unknowns.map((unknown) => `${unknown.statedAs} The answer is the same either way.`)
    : [];
  /* Everything authored as a bare string defaults to GENERAL, untriaged. The
     wall collapses into one said-once section the moment the shape lands; each
     jurisdiction's owner promotes its own lines afterwards, and nobody
     classifies a jurisdiction they do not own. */
  const limitations: Limitation[] = [
    ...amendedBy.map((text) => general(text)),
    ...agreedDespite.map((text) => general(text)),
    /* Deduplicated by the TEXT, because an authority's note is an object now
       and two transcriptions of one ministry sentence are not the same object.
       A `Set` of them would have printed the line once per citing rule. */
    ...[...new Map(cited.flatMap((rule): Array<[string, string | AuthorityQuotation]> => [
      ...rule.notes.flatMap((note): Array<[string, string | AuthorityQuotation]> => typeof note === "string"
        ? [[note, note]]
        : note.zoneId && note.zoneId !== place.zoneId ? []
        : "words" in note ? [[note.words.text, note.words]] : [[note.text, note.text]]),
      ...rule.caveats.map((caveat): [string, string] => [caveat, caveat]),
    ])).values()].map((entry) => typeof entry === "string" ? general(entry) : authorityNote(entry)),
    ...[...new Set(bundleConditions.flatMap((condition) => condition.caveats ?? []))].map((text) => general(text)),
    ...vocabulary.standingLimitations,
  ];
  /* Hunts the answer rests on, with how each is licensed. Only for seasons
     that are open (or would be, in some world) today: a season that is not
     open is not a reason to name its licence. */
  const huntCodesById = new Map((bundle.huntCodes ?? []).map((huntCode) => [huntCode.id, huntCode]));
  const huntCodesCited = [...new Set(everyInSeason.map((rule) => rule.huntCodeId).filter((id): id is string => Boolean(id)))].map((id) => {
    const huntCode = huntCodesById.get(id);
    if (!huntCode) throw new Error(`Rule refers to unknown hunt code ${id}`);
    return huntCode;
  });
  const authorization = authorizationContext(huntCodesCited, bundle.drawCycles ?? [], date);

  const sourceIds = [...new Set([
    ...cited.map((rule) => rule.sourceId),
    ...bundleConditions.map((condition) => condition.sourceId),
    ...amendmentSources,
    ...huntCodesCited.map((huntCode) => huntCode.sourceId),
    ...(authorization?.draws.map((draw) => draw.sourceId) ?? []),
    ...vocabulary.standingSourceIds,
  ])] as CanonicalId<"source">[];
  const version = cited[0]?.sourceVersion ?? bundle.sourceVersion;

  let result: RegulatoryResult;
  if (outcome.status === "CONDITIONAL") {
    const windows = [...new Map(everyInSeason.map((rule) => {
      const window = containing(rule, date)!;
      return [`${window.opensIso}/${window.closesIso}`, window] as const;
    })).values()];
    const seasonsToday = [...new Set(everyInSeason.map((rule) => `${rule.seasonLabel}, ${rule.seasonPhrase}`))];
    const limitsRule = everyInSeason[0];
    /* Both kinds were required together, so a season limit could not be
       expressed and a daily limit with no possession figure was dropped
       entirely. `harvestLimits` below carries each kind the authority states,
       on its own. This pair is kept until every consumer has moved; it is the
       figure that binds for this species, so a pool shared across species
       never shows above the species' own lower limit. */
    const limits = bindingDailyAndPossession(limitsRule.limits);
    /* The season shown is the one that is open whatever the unknown facts
       are: when every possible window closes on the same day, it runs from the
       latest of their openings. Otherwise none is promoted, and the summary
       names each. */
    const commonClose = new Set(windows.map((window) => window.closesIso)).size === 1;
    /*
     * The authority's own name for the segment, carried only when every rule
     * behind this season agrees on it. Where they differ the season is a
     * combination the authority did not name, and inventing a label for it —
     * or picking one of them — would attribute a name to a ministry that did
     * not write it.
     */
    const labels = new Set(cited.map((rule) => rule.implementLabel).filter((label): label is string => Boolean(label)));
    const label = labels.size === 1 ? [...labels][0] : undefined;
    const season = commonClose
      ? {
          kind: "ABSOLUTE" as const,
          opens: windows.map((window) => window.opensIso).sort().at(-1)! as IsoDate,
          closes: windows[0].closesIso as IsoDate,
          datesInclusive: true,
          ...(label ? { label: { text: label, lang: vocabulary.lang ?? "en-CA", owner: "AUTHORITY" as const } } : {}),
        }
      : undefined;
    result = base({
      status: "CONDITIONAL",
      ...(season ? { season } : {}),
      ...(limits ? { limits } : {}),
      harvestLimits: harvestLimitsFrom(limitsRule.limits),
      ...(authorization ? { authorization } : {}),
      summary:
        `The certified ${version} season for ${species} in ${unit} includes this date (${seasonsToday.join("; or ")}). ` +
        (authorization
          ? `It is open under ${authorization.huntCodes.map((huntCode) => `${huntCode.authorityTerm} ${huntCode.code}`).join(" or ")}, ` +
            "assuming you hold the licence or tag each requires. "
          : "") +
        "Licensing, legal hunting time and all overlapping restrictions still apply, and North Ground has not verified what you hold." +
        listing,
      /* The same listings the sentence above was derived from, so a
         consumer reads the authority's wording tagged rather than parsing it
         back out of our prose. */
      ...(seasons.length ? { seasonsHere: seasons } : {}),
      requirements,
      conditions: structuredConditions,
      limitations,
      sourceIds,
    }, cited);
  } else if (outcome.status === "CLOSED") {
    const nothing = allWorldOutcomes.every((entry) => entry.absent);
    /* Closed because the authority closes this place, in its own words, when
       only closure rules apply here — not "no season is open", which would
       hide why. */
    const declaredClosures: ClosureDeclaration[] = everyApplicable.length
      && everyApplicable.every((rule) => rule.declaredNoSeason && rule.closureSummary)
      ? dedupeDeclarations(everyApplicable.map((rule) => ({
          about: rule.seasonLabel,
          why: authored(rule.closureSummary!),
        })))
      : [];
    /*
     * Why this is closed, as a fact rather than as a sentence.
     *
     * The three branches below are three different causes citing three
     * different things, and the sentence is derived from the cause so the two
     * cannot drift apart.
     */
    const closure: ClosureCause = nothing
      ? unlistedPlace(absence)
      : declaredClosures.length
        ? { kind: "DECLARED_NO_SEASON", declarations: declaredClosures }
        : { kind: "NO_SEASON_OPEN_ON_DATE" };
    result = base({
      status: "CLOSED",
      closure,
      summary: closure.kind === "UNLISTED_PLACE"
        ? `No ${vocabulary.jurisdictionName} licence ${answeredDimensions.length ? "matching what you described " : ""}authorises hunting ${species} in ${unit}. ${absenceText(absence)} (${absence.section ?? "source"})`
        : closure.kind === "DECLARED_NO_SEASON"
          ? `${species.charAt(0).toUpperCase()}${species.slice(1)} may not be hunted here. ${closure.declarations.map((entry) => `${entry.about}: ${entry.why.text}`).join(" ")}`
          : `No ${species} season in ${unit} is open on this date for ${answeredDimensions.length ? "this combination" : "any licence or equipment"}.${listing}`,
      /* The same listings the sentence above was derived from, so a
         consumer reads the authority's wording tagged rather than parsing it
         back out of our prose. */
      ...(seasons.length ? { seasonsHere: seasons } : {}),
      requirements,
      conditions: structuredConditions,
      limitations,
      sourceIds,
    }, cited);
  } else if (outcome.status === "UNKNOWN") {
    result = base({
      status: "UNKNOWN",
      summary: `No certified rule covers ${species} in ${unit} for this combination, and an absent row is not evidence that the season is closed.`,
      limitations,
      sourceIds,
    }, cited);
  } else {
    result = base({
      status: outcome.status,
      ...(authorization ? { authorization } : {}),
      summary: outcome.status === "CONFLICT"
        ? `The official sources disagree about ${species} in ${unit} for this combination, and North Ground will not choose between them.${listing}`
        : outcome.unestablished
          ? `North Ground cannot state whether a ${species} season is open in ${unit} on this date for ${scope === "any licence" ? "any licence or equipment" : scope}, because the source does not settle it (below). It is not stated as closed.${listing}`
          : `North Ground cannot state a ${species} season for this exact point, because the answer depends on something it could not establish.${listing}`,
      /* The same listings the sentence above was derived from, so a
         consumer reads the authority's wording tagged rather than parsing it
         back out of our prose. */
      ...(seasons.length ? { seasonsHere: seasons } : {}),
      requirements,
      conditions: structuredConditions,
      limitations: [...outcome.reasons.map((reason) => general(reason)), ...limitations],
      sourceIds,
    }, cited);
  }

  /* Inside a territory the authority closes to all hunting, the zone's seasons
     are not what applies at the point, whatever their status. No dates, season
     listing, bag limit or legal hours are stated there — any of them would read
     as a season inside a park. A season the zone would have open becomes
     NEEDS_VERIFICATION (the prohibition is quoted, not certified as CLOSED); a
     zone answer that was already CLOSED or UNKNOWN keeps that status. */
  if (input.restrictions?.length && input.restrictionsProhibitAllHunting) {
    const names = input.restrictions.map((restriction) => restriction.name).join(" and ");
    const where = `This point is inside ${names}, in ${vocabulary.jurisdictionName}'s published layer of territories where all hunting is prohibited (quoted below).`;
    const status = result.status === "CLOSED" || result.status === "UNKNOWN" ? result.status : "NEEDS_VERIFICATION";
    result = {
      ...result,
      status,
      season: undefined,
      /* The bundle holds the distinction in the authority's words — BC's
         {"bag":2,"statedAs":"2 (season bag limit)"} versus
         {"daily":5,"possession":15}. The old pair could not express a season
         limit, so it stayed prose; it is structured now and the prose stays
         too. */
      limits: undefined,
      harvestLimits: harvestLimitsFrom(rules[0]?.limits),
      legalTime: legalTimeNotCertified(
      "Legal hunting hours are not stated for a point inside a territory closed to all hunting.",
      "the responsible authority",
    ),
      summary: status === "UNKNOWN"
        ? `${where} ${result.summary}`
        : status === "CLOSED"
          ? `${where} Separately, no ${species} season in ${unit} is open on this date for ${scope === "any licence" ? "any licence or equipment" : scope}.`
          : `${where} North Ground has not certified how that prohibition applies to this hunt, so it states no season status, season dates or bag limit for this point. ${unit}'s seasons apply only outside it.`,
      requirements: [],
      /* The prohibition, then only what holds anywhere in the jurisdiction. A
         rule's own notes ("this season allows …") describe a season and are
         not carried inside a territory where none applies. */
      limitations: [
        ...input.restrictions.map(restrictionLimitation),
        ...vocabulary.standingLimitations,
      ],
      sourceIds: [...new Set([...result.sourceIds, ...input.restrictions.map((restriction) => restriction.sourceId as CanonicalId<"source">)])],
    };
    return { completeness: "RESOLVED", dimensions, result, opportunities };
  }

  /* Overlapping published restrictions North Ground has not certified. The
     zone's season is not the answer at this point, so it is not carried as
     one: a result that still held `season` would print "Season dates" inside
     a national park. The dates remain in the summary, as what applies outside. */
  if (input.restrictions?.length && result.status === "CONDITIONAL") {
    result = {
      ...result,
      season: undefined,
      status: "NEEDS_VERIFICATION",
      summary:
        `This point is inside ${input.restrictions.map((restriction) => restriction.name).join(" and ")}, where ${vocabulary.jurisdictionName} publishes a hunting restriction. ` +
        `North Ground has not certified how it applies to this hunt, so it will not state a season status here. Outside it: ${result.summary}`,
      limitations: [
        ...input.restrictions.map(restrictionLimitation),
        ...result.limitations,
      ],
      sourceIds: [...new Set([...result.sourceIds, ...input.restrictions.map((restriction) => restriction.sourceId as CanonicalId<"source">)])],
    };
  }

  return { completeness: "RESOLVED", dimensions, result, opportunities };
}

/* ── Coverage ───────────────────────────────────────────────────────────── */

/**
 * Units a species' certified rules reach, fully or in part, for the coverage
 * report.
 *
 * `officialUnitCountBySpecies` exists because ONE JURISDICTION'S UNIT COUNT IS
 * NOT ALWAYS ONE NUMBER. Every province wired before Newfoundland and Labrador
 * draws one geography that every species is managed in, so the province's unit
 * count is the denominator for all of them. Newfoundland and Labrador manages
 * each big-game species in its OWN areas — 74 moose, 19 caribou, 7 black bear,
 * 100 polygons over the same ground — and a single denominator then reports
 * moose as CLOSED in 26 units that are caribou and black bear areas, and
 * caribou as CLOSED in 81 that are not caribou areas at all.
 *
 * Those numbers are unreachable by construction, because the layers are
 * species-scoped and a caribou question never resolves to a moose area. §8's
 * capability rule is what makes this worth a field rather than a footnote:
 * "capability reporting must measure deliverable answers, not merely encoded
 * records", and a closure nobody can ever be shown is not a deliverable answer.
 * It is also the more dangerous direction to leave wrong, since it inflates a
 * count of certified CLOSED verdicts.
 *
 * Where a bundle declares it, each species is measured against its own
 * authority's own count. Where it does not, nothing changes.
 */
export function conditionalCoverage(bundle: ConditionalBundle & {
  officialUnitCount?: number;
  officialUnitCountBySpecies?: Record<string, number>;
}) {
  const groups = new Map(bundle.groups.map((group) => [group.id, group]));
  const species = [...new Set(bundle.rules.filter((rule) => PUBLISHABLE.has(rule.reviewStatus)).map((rule) => rule.speciesId))].sort();
  return species.map((speciesId) => {
    const rules = bundle.rules.filter((rule) => rule.speciesId === speciesId && PUBLISHABLE.has(rule.reviewStatus));
    const reached = new Set<string>();
    for (const rule of rules) {
      const group = groups.get(rule.regulatoryGroupId);
      for (const zone of [...(group?.zoneIds ?? []), ...(group?.partialZoneIds ?? [])]) reached.add(zone);
    }
    /*
     * UNITS AN EXPLICIT RULE CLOSES, which is not the same as units closed by
     * absence and must not be folded into either "covered" or "unknown".
     *
     * Newfoundland and Labrador is the first bundle to carry closures INSIDE its
     * own geography: NLR 43/26 s. 9(2) names no season for caribou areas 63, 65,
     * 69, 73, 74 and 75, so they are encoded as one `declaredNoSeason` rule over
     * those six areas. They are reached by a certified rule, so `reached` counts
     * them — and reporting them as covered with nothing closed would hide six
     * closed areas in a jurisdiction whose own guide already under-reports them
     * as three. A closure the authority states is the most useful thing a
     * coverage report can show, and §8 requires it to be visible in both
     * directions.
     *
     * Measured from the rule's own geography rather than from its group, because
     * a declared closure covers part of a group, never all of it — the same
     * group also carries the areas that ARE open.
     */
    const declaredClosed = new Set<string>();
    for (const rule of rules) {
      if (!rule.declaredNoSeason) continue;
      const group = groups.get(rule.regulatoryGroupId);
      const byDesignation = new Map((bundle.units ?? []).map((unit) => [unit.identifier, unit.zoneId]));
      const named = rule.geography?.include.ghas.map((identifier) => byDesignation.get(identifier)).filter((id): id is string => Boolean(id));
      for (const zone of named?.length ? named : [...(group?.zoneIds ?? [])]) declaredClosed.add(zone);
    }
    /* A unit an open rule also reaches is not closed: the closure rule and an
       open rule can share a group, and the open one wins for that unit. */
    for (const rule of rules) {
      if (rule.declaredNoSeason) continue;
      const byDesignation = new Map((bundle.units ?? []).map((unit) => [unit.identifier, unit.zoneId]));
      for (const identifier of rule.geography?.include.ghas ?? []) {
        const zoneId = byDesignation.get(identifier);
        if (zoneId) declaredClosed.delete(zoneId);
      }
    }
    const officialUnits = bundle.officialUnitCountBySpecies?.[speciesId] ?? bundle.officialUnitCount ?? reached.size;
    return {
      speciesId,
      rules: rules.length,
      unitsReached: reached.size,
      /* Where the law makes an unlisted unit closed, the rest are closed by
         that provision rather than unknown. */
      unitsClosedByAbsence: absenceFor(bundle, speciesId).meaning === "CLOSED" ? officialUnits - reached.size : 0,
      /** Units a certified rule closes outright, separate from silence. */
      unitsDeclaredClosedByRule: declaredClosed.size,
      unitsUnknown: absenceFor(bundle, speciesId).meaning === "CLOSED" ? 0 : officialUnits - reached.size,
      /* Whether evaluating can ever ask anything: true only if two rules for
         the same place disagree about dates or limits. Grouse rules are keyed
         by licence but every licence gives the same season, so grouse asks
         nothing. */
      requiresInput: [...groups.keys()].some((groupId) => {
        const inGroup = rules.filter((rule) => rule.regulatoryGroupId === groupId);
        return new Set(inGroup.map((rule) => JSON.stringify([rule.windows.map((w) => [w.opensIso, w.closesIso]), rule.limits ?? null, rule.appliesWhen.permittedImplements ?? null]))).size > 1;
      }),
    };
  });
}
