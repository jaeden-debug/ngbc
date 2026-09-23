import { legalTimeNotCertified } from "./legal-time.ts";
import { nextOpening } from "./season.ts";
import { general, sourceDetail, type Limitation } from "../limitation.ts";
import type { CanonicalId } from "../../content-contract/index.ts";
import type { RegulatoryResult, RegulatoryStatus } from "../types.ts";
import {
  answerFor, isAnswerValid,
  type DimensionOption, type HuntDimensionAnswers, type HuntDimensionId, type RequiredDimension,
} from "./dimensions.ts";
import { appliesInWorld, placeWorlds, type GeographyData, type GeographyExpression, type PlaceContext, type PlaceWorld } from "./geography.ts";
import { authorizationContext, type DrawCycle } from "./allocation.ts";
import type { HuntCode } from "./hunt-codes.ts";
import { rulesInForce, type Amendment, type RuleAuthority } from "./precedence.ts";

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
  statedAs?: string;
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
  seasonPhrase: string;
  /**
   * The authority's own name for this season segment, where it names one.
   * Quoted, never translated or reformatted: it is the ministry's string.
   */
  implementLabel?: string;
  windows: ConditionalWindow[];
  declaredNoSeason: boolean;
  limits?: {
    daily?: number;
    possession?: number | null;
    combined?: boolean;
    combinedWithNames?: string[];
    statedAs?: string;
    bag?: number;
    animalClass?: string;
    section?: string;
  };
  conditionIds: string[];
  caveats: string[];
  /** Plain notes; a note naming a zone is shown only for that zone. */
  notes: Array<string | { zoneId?: string; text: string }>;
  disputes: Array<{ zoneId?: string; statedAs: string }>;
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
   * For a rule that declares no season: the authority's own words for why,
   * used as the answer when only such rules apply here ("closed … to the
   * hunting of upland game birds with the use of state licenses").
   */
  closureStatedAs?: string;
}

export interface ConditionalCondition {
  id: string;
  text: string;
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
   */
  valuesFrom?: "JURISDICTION" | "PLACE";
}

export interface ConditionalVocabulary {
  jurisdictionName: string;
  /** The authority's term for its units, for sentences ("Game Hunting Area"). */
  unitTerm: string;
  /** Asked in this order when more than one fact is outstanding. */
  dimensions: VocabularyDimension[];
  legalTime: RegulatoryResult["legalTime"];
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

/** What the absence of a rule means, and on whose authority. */
export interface AbsenceMeaning {
  meaning: "CLOSED" | "UNKNOWN";
  excludedCombination?: "CLOSED" | "UNKNOWN";
  statedAs?: string;
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
  restrictions?: Array<{ name: string; statedAs: string; sourceId: string }>;
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
}

const PUBLISHABLE = new Set(["VERIFIED", "PUBLISHED"]);
const METHOD = "HUNT_METHOD";
const IMPLEMENTS = "permittedImplements";

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
  return { status: "CLOSED", coarse: "CLOSED", fine: "CLOSED", inSeason: [], applicable: rules, absent: false };
}

/** The answer for one complete set of facts, across every world. */
interface Outcome {
  status: RegulatoryStatus;
  key: string;
  worlds: WorldOutcome[];
  /** Unknowns whose value changes the answer, when the worlds disagree. */
  reasons: string[];
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
    [...a.inside].sort().join(",") === [...b.inside].sort().join(",");
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
    return { status: perWorld[0].status, key: fine, worlds: perWorld, reasons: [] };
  }

  /* The worlds disagree. If two worlds that differ ONLY in whether a disputed
     reading holds disagree, the sources themselves conflict; otherwise it is
     geography North Ground could not establish. */
  const disputeMatters = worlds.some((world, index) => worlds.some((other, otherIndex) =>
    sameWorldApartFromReading(world, other) && perWorld[otherIndex].coarse !== perWorld[index].coarse));
  const status: RegulatoryStatus = disputeMatters ? "CONFLICT" : "NEEDS_VERIFICATION";
  const reasons = unknowns
    .filter((unknown) => disputeMatters || unknown.kind !== "DISPUTE")
    .map((unknown) => unknown.statedAs);
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
): string[] {
  const bySeason = new Map<string, ConditionalRule[]>();
  for (const rule of rules) {
    if (rule.declaredNoSeason) continue;
    const key = `${rule.seasonLabel} ${rule.seasonPhrase}`;
    bySeason.set(key, [...(bySeason.get(key) ?? []), rule]);
  }
  const out: string[] = [];
  for (const [season, group] of bySeason) {
    const qualifiers: string[] = [];
    const namedByLicence = new Set<string>();
    for (const dimension of vocabulary.dimensions) {
      const key = ruleKeyOf(dimension);
      if (key === IMPLEMENTS || answered[dimension.id] !== undefined) continue;
      if (group.some((rule) => rule.appliesWhen[key] === undefined)) continue;
      const values = [...new Set(group.map((rule) => rule.appliesWhen[key] as string))];
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
          !offered(entry).every((value) => group.some((rule) => rule.appliesWhen[key] === value));
      })[index];
      return !(dimension && namedByLicence.has(dimension.id));
    });
    const shown = kept.filter(Boolean);
    out.push(shown.length ? `${season} (${shown.join("; ")})` : season);
  }
  return out;
}

function conditionsFor(
  bundle: ConditionalBundle,
  rules: ConditionalRule[],
  speciesId: string,
  zoneId: string,
  date: string,
): ConditionalCondition[] {
  const all = new Map(bundle.sources.flatMap((source) => source.conditions ?? []).map((condition) => [condition.id, condition]));
  const ids = [...new Set(rules.flatMap((rule) => rule.conditionIds))];
  const out: ConditionalCondition[] = [];
  for (const id of ids) {
    const condition = all.get(id);
    if (!condition) throw new Error(`Rule refers to unknown condition ${id}`);
    if (condition.speciesIds && !condition.speciesIds.includes(speciesId)) continue;
    if (condition.zoneIds && !condition.zoneIds.includes(zoneId)) continue;
    const windows = condition.activeWindowsByZone ? condition.activeWindowsByZone[zoneId] : condition.activeWindows;
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
      rules.filter((rule) => !rule.declaredNoSeason).map((rule) => ({
        verdict: "OUT_OF_SEASON" as const,
        windows: rule.windows.map((window) => ({
          opensIso: window.opensIso, closesIso: window.closesIso, crossesYear: window.closesIso < window.opensIso,
        })),
        span: bundle.certifiedPeriod,
      })),
      date,
    ),
    status: "UNKNOWN",
    summary: "",
    legalTime: vocabulary.legalTime,
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
      disputes: [...alternative.disputes, { statedAs: conflict.statedAs }],
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

  if (!rules.length) {
    if (absence.meaning === "CLOSED") {
      return {
        completeness: "RESOLVED",
        dimensions: [],
        result: base({
          status: "CLOSED",
          summary:
            `No ${vocabulary.jurisdictionName} licence authorises hunting ${species} in ${unit}. ` +
            `${absence.explanation ?? ""} (${absence.section ?? "source"})`.trim(),
        }, speciesRules.slice(0, 1)),
      };
    }
    return {
      completeness: "RESOLVED",
      dimensions: [],
      result: base({
        status: "UNKNOWN",
        summary:
          `No certified rule covers ${species} in ${unit}. The unit is not named by any season row North Ground has certified, ` +
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
    if (key === IMPLEMENTS) return dimension.options.map((option) => option.value);
    const scope = dimension.valuesFrom === "PLACE" ? rules : speciesRules;
    const stated = new Set(scope.map((rule) => rule.appliesWhen[key]).filter((value): value is string => typeof value === "string"));
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
    };
  }

  /* ── One answer, whatever the facts still unknown are ────────────── */

  const outcome = outcomes[0].outcome;
  const dimensions = answeredDimensions.map(asRequired);
  const allWorldOutcomes = outcomes.flatMap((entry) => entry.outcome.worlds);
  const everyApplicable = [...new Set(allWorldOutcomes.flatMap((entry) => entry.applicable))];
  const everyInSeason = [...new Set(allWorldOutcomes.flatMap((entry) => entry.inSeason))];
  const offered = (dimension: VocabularyDimension) => valuesFor(dimension).filter((value) => coherent({ ...known, [dimension.id]: value }));
  const seasons = describeSeasons(everyApplicable.length ? everyApplicable : rules, vocabulary, known, offered);
  const scope = answeredDimensions.length ? "this combination" : "any licence";
  const listing = seasons.length ? ` Seasons open to ${scope} here: ${seasons.join("; ")}.` : "";
  const cited = everyInSeason.length ? everyInSeason : everyApplicable.length ? everyApplicable : rules;

  const conditions = conditionsFor(bundle, everyInSeason, input.speciesId, place.zoneId, date);
  const requirements = [
    ...conditions.map((condition) => `${condition.text} (${condition.sourceSection})`),
    ...[...new Set(everyInSeason.map((rule) =>
      rule.limits?.statedAs && rule.limits.section ? `Bag limit: ${rule.limits.statedAs} (${rule.limits.section}).` : ""))].filter(Boolean),
  ];
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
    ...[...new Set(cited.flatMap((rule) => [
      ...rule.notes.flatMap((note) => typeof note === "string" ? [note] : !note.zoneId || note.zoneId === place.zoneId ? [note.text] : []),
      ...rule.caveats,
    ]))].map((text) => general(text)),
    ...[...new Set(conditions.flatMap((condition) => condition.caveats ?? []))].map((text) => general(text)),
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
    ...conditions.map((condition) => condition.sourceId),
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
    const limits = limitsRule.limits && typeof limitsRule.limits.daily === "number" && typeof limitsRule.limits.possession === "number"
      ? { daily: limitsRule.limits.daily, possession: limitsRule.limits.possession }
      : undefined;
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
          opens: windows.map((window) => window.opensIso).sort().at(-1)!,
          closes: windows[0].closesIso,
          datesInclusive: true,
          ...(label ? { label: { text: label, lang: vocabulary.lang ?? "en-CA", owner: "AUTHORITY" as const } } : {}),
        }
      : undefined;
    result = base({
      status: "CONDITIONAL",
      ...(season ? { season } : {}),
      ...(limits ? { limits } : {}),
      ...(authorization ? { authorization } : {}),
      summary:
        `The certified ${version} season for ${species} in ${unit} includes this date (${seasonsToday.join("; or ")}). ` +
        (authorization
          ? `It is open under ${authorization.huntCodes.map((huntCode) => `${huntCode.authorityTerm} ${huntCode.code}`).join(" or ")}, ` +
            "assuming you hold the licence or tag each requires. "
          : "") +
        "Licensing, legal hunting time and all overlapping restrictions still apply, and North Ground has not verified what you hold." +
        listing,
      requirements,
      limitations,
      sourceIds,
    }, cited);
  } else if (outcome.status === "CLOSED") {
    const nothing = allWorldOutcomes.every((entry) => entry.absent);
    /* Closed because the authority closes this place, in its own words, when
       only closure rules apply here — not "no season is open", which would
       hide why. */
    const closedBy = everyApplicable.length && everyApplicable.every((rule) => rule.declaredNoSeason && rule.closureStatedAs)
      ? [...new Set(everyApplicable.map((rule) => `${rule.seasonLabel}: ${rule.closureStatedAs}`))]
      : [];
    result = base({
      status: "CLOSED",
      summary: nothing
        ? `No ${vocabulary.jurisdictionName} licence ${answeredDimensions.length ? "matching what you described " : ""}authorises hunting ${species} in ${unit}. ${absence.explanation ?? ""} (${absence.section ?? "source"})`
        : closedBy.length
          ? `${species.charAt(0).toUpperCase()}${species.slice(1)} may not be hunted here. ${closedBy.join(" ")}`
          : `No ${species} season in ${unit} is open on this date for ${answeredDimensions.length ? "this combination" : "any licence or equipment"}.${listing}`,
      requirements,
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
        : `North Ground cannot state a ${species} season for this exact point, because the answer depends on something it could not establish.${listing}`,
      requirements,
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
      limits: undefined,
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
        ...input.restrictions.map((restriction) => sourceDetail(`${restriction.name}: “${restriction.statedAs}”`, restriction.sourceId as CanonicalId<"source">)),
        ...vocabulary.standingLimitations,
      ],
      sourceIds: [...new Set([...result.sourceIds, ...input.restrictions.map((restriction) => restriction.sourceId as CanonicalId<"source">)])],
    };
    return { completeness: "RESOLVED", dimensions, result };
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
        ...input.restrictions.map((restriction) => sourceDetail(`${restriction.name}: “${restriction.statedAs}”`, restriction.sourceId as CanonicalId<"source">)),
        ...result.limitations,
      ],
      sourceIds: [...new Set([...result.sourceIds, ...input.restrictions.map((restriction) => restriction.sourceId as CanonicalId<"source">)])],
    };
  }

  return { completeness: "RESOLVED", dimensions, result };
}

/* ── Coverage ───────────────────────────────────────────────────────────── */

/** Units a species' certified rules reach, fully or in part, for the coverage report. */
export function conditionalCoverage(bundle: ConditionalBundle & { officialUnitCount?: number }) {
  const groups = new Map(bundle.groups.map((group) => [group.id, group]));
  const species = [...new Set(bundle.rules.filter((rule) => PUBLISHABLE.has(rule.reviewStatus)).map((rule) => rule.speciesId))].sort();
  return species.map((speciesId) => {
    const rules = bundle.rules.filter((rule) => rule.speciesId === speciesId && PUBLISHABLE.has(rule.reviewStatus));
    const reached = new Set<string>();
    for (const rule of rules) {
      const group = groups.get(rule.regulatoryGroupId);
      for (const zone of [...(group?.zoneIds ?? []), ...(group?.partialZoneIds ?? [])]) reached.add(zone);
    }
    const officialUnits = bundle.officialUnitCount ?? reached.size;
    return {
      speciesId,
      rules: rules.length,
      unitsReached: reached.size,
      /* Where the law makes an unlisted unit closed, the rest are closed by
         that provision rather than unknown. */
      unitsClosedByAbsence: absenceFor(bundle, speciesId).meaning === "CLOSED" ? officialUnits - reached.size : 0,
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
