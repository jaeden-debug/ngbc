import { legalTimeNotCertified } from "./legal-time.ts";
import { general } from "../limitation.ts";
import type { CanonicalId } from "../../content-contract/index.ts";
import type { RegulatoryResult, ZoneResolution } from "../types.ts";
import {
  answerFor, isAnswerValid, nextMissingDimension, ontarioMethodDimension,
  ontarioResidencyDimension, ontarioTagDimension,
  type HuntDimensionAnswers, type HuntDimensionId, type RequiredDimension,
} from "./dimensions.ts";
import { nextOpening, evaluateSeason, parseSeasonPhrase } from "./season.ts";
import { ontarioLegalTime } from "./ontario-legal-time.ts";
import type { IsoDate } from "../../content-contract/index.ts";
import bundle from "../../../../content/regulatory/ca-on-major-game-2026.json" with { type: "json" };

/**
 * Ontario major-game evaluation.
 *
 * Small game is answerable from location, date and species. Major game is not,
 * and pretending otherwise would mean publishing an answer that is wrong for
 * somebody. Ontario states deer seasons in three tables by implement, each with
 * separate resident and non-resident columns, and "None" in a non-resident cell
 * is a real closure. So this asks — one fact at a time, only what the applicable
 * rules actually disagree about, and it says why it is asking.
 *
 * Completeness is reported separately from regulatory status, on purpose:
 *
 *   NEEDS_INPUT  North Ground knows the law and needs a fact from you.
 *   UNKNOWN      North Ground does not know the law here.
 *
 * Collapsing those would turn "which implement are you carrying?" into "we have
 * not certified this", which is a different and much worse claim.
 */

interface BundleGroup {
  id: string;
  officialSpec: string;
  zoneIds: string[];
  officialIdentifiers: string[];
}

interface BundleRule {
  id: string;
  speciesId: string;
  regulatoryGroupId: string;
  appliesWhen: { permittedImplements: string[] } & Record<string, unknown>;
  seasonLabel: string;
  seasonPhrase: string | null;
  declaredNoSeason: boolean;
  caveats: string[];
  conditionIds: string[];
  sourceId: string;
  sourceSection: string;
  sourceVersion: string;
  sourceYear: number;
  reviewStatus: string;
}

interface BundleSource {
  id: string;
  authority: string;
  title: string;
  url: string;
  sourceVersion: string;
  conditions: Array<{ id: string; text: string; sourceSection: string; sourceId: string }>;
}

const GROUPS = new Map<string, BundleGroup>((bundle.groups as BundleGroup[]).map((group) => [group.id, group]));
const RULES = bundle.rules as BundleRule[];
const SOURCES = new Map<string, BundleSource>((bundle.sources as BundleSource[]).map((source) => [source.id, source]));
const PUBLISHABLE = new Set(["VERIFIED", "PUBLISHED"]);

/** Species this bundle can evaluate somewhere, given the right answers. */
export const ONTARIO_MAJOR_GAME_SPECIES: readonly string[] = [
  ...new Set(RULES.filter((rule) => PUBLISHABLE.has(rule.reviewStatus)).map((rule) => rule.speciesId)),
].sort();

export type EvaluationCompleteness = "RESOLVED" | "NEEDS_INPUT";

export interface MajorGameEvaluation {
  completeness: EvaluationCompleteness;
  /** Present only when `completeness` is NEEDS_INPUT. */
  required?: RequiredDimension;
  /** Present only when `completeness` is RESOLVED. */
  result?: RegulatoryResult;
  /** The dimensions this species and unit turn on, answered or not. */
  dimensions: RequiredDimension[];
  /*
   * The legal hunting window, present on BOTH branches.
   *
   * It turns on species, unit and date and nothing else — `ontarioHoursRules`
   * structurally cannot take a hunter's answers — so it is a fact we hold even
   * while another one is pending. Withholding it until the hunter answers a
   * question about their licence would hide wild turkey's 7 p.m. closing behind
   * an unrelated one, and turkey is the species the exception exists for.
   */
  legalTime?: RegulatoryResult["legalTime"];
}

function rulesFor(speciesId: string, zoneId: string): BundleRule[] {
  return RULES.filter(
    (rule) =>
      rule.speciesId === speciesId &&
      PUBLISHABLE.has(rule.reviewStatus) &&
      (GROUPS.get(rule.regulatoryGroupId)?.zoneIds.includes(zoneId) ?? false),
  );
}

/**
 * The facts these rules can turn on, and the subset worth asking about.
 *
 * `availableDimensions` is the vocabulary: every dimension the candidate rules
 * carry, with the values they accept. An answer is applied when it is valid
 * here, whether or not a question was put — a person who says they have a rifle
 * has said something true about their hunt even in a unit where every season
 * permits the same implements, and discarding it would answer for a rifle hunter
 * with a rule that excludes rifles.
 *
 * `requiredDimensions` is the question list: the subset where the candidates
 * actually disagree, so nothing is asked that cannot change the outcome. That is
 * why a deer hunter is asked for residency and implement, a turkey hunter only
 * for implement, and a bear hunter in WMU 7A for nothing at all.
 *
 * Both are derived from the rules. No species declares a form.
 *
 * Asked in this order because it narrows fastest: residency can close a unit
 * outright, and the tag decides which table even applies.
 */
const DIMENSION_ORDER = ["RESIDENCY", "TAG_TYPE", "HUNT_METHOD"] as const;

function distinctValues(candidates: BundleRule[], key: string): string[] {
  return [
    ...new Set(
      candidates.map((rule) => rule.appliesWhen[key]).filter((value): value is string => typeof value === "string"),
    ),
  ];
}

function availableDimensions(candidates: BundleRule[], sourceId: string): RequiredDimension[] {
  const section = candidates[0]?.sourceSection ?? "";
  const built: Partial<Record<(typeof DIMENSION_ORDER)[number], RequiredDimension>> = {};

  if (distinctValues(candidates, "RESIDENCY").length) built.RESIDENCY = ontarioResidencyDimension(sourceId, section);

  const tags = distinctValues(candidates, "TAG_TYPE");
  if (tags.length) built.TAG_TYPE = ontarioTagDimension(tags, sourceId, section);

  if (candidates.some((rule) => rule.appliesWhen.permittedImplements?.length)) {
    built.HUNT_METHOD = ontarioMethodDimension(sourceId, section);
  }

  return DIMENSION_ORDER.map((id) => built[id]).filter((dimension): dimension is RequiredDimension => Boolean(dimension));
}

function requiredDimensions(candidates: BundleRule[], sourceId: string): RequiredDimension[] {
  // Implements are a set rather than a value, so they differ when the sets do.
  const implementSets = new Set(candidates.map((rule) => [...rule.appliesWhen.permittedImplements].sort().join("+")));

  return availableDimensions(candidates, sourceId).filter((dimension) => {
    if (dimension.id === "HUNT_METHOD") return implementSets.size > 1;
    return distinctValues(candidates, dimension.id).length > 1;
  });
}

const IMPLEMENT_NAMES: Record<string, string> = {
  RIFLE: "rifles", SHOTGUN: "shotguns", MUZZLELOADER: "muzzle-loading guns", BOW: "bows",
};

/**
 * State an implement restriction the person was never asked about.
 *
 * Where every applicable rule permits the same narrowed set, there is nothing to
 * ask — but there is something to say. WMU 7A allows only bows and muzzle-loading
 * guns for bear, and a rifle hunter reading CONDITIONAL without that line would
 * be reading a wrong answer.
 */
function restrictionNotes(rules: BundleRule[]): string[] {
  const open = rules.filter((rule) => !rule.declaredNoSeason);
  if (!open.length) return [];
  const permitted = [...new Set(open.flatMap((rule) => rule.appliesWhen.permittedImplements))];
  if (permitted.length >= 4) return [];
  const named = permitted.map((item) => IMPLEMENT_NAMES[item] ?? item.toLowerCase());
  const list = named.length > 1 ? `${named.slice(0, -1).join(", ")} and ${named.at(-1)}` : named[0];
  return [`Only ${list} are permitted for the season(s) that apply here.`];
}

/**
 * Apply the answers the person has given to a candidate set.
 *
 * Only answers the dimension itself offers are applied. Answers arrive from a
 * browser, and an unrecognised one must leave the question outstanding — never
 * narrow the rules. Filtering on an arbitrary string empties the candidate set,
 * and an empty set means "no season is open to you", which would turn a typo
 * or a tampered request into a confident CLOSED.
 */
function narrow(
  rules: BundleRule[],
  answers: HuntDimensionAnswers,
  offered: RequiredDimension[],
): BundleRule[] {
  const validated = (id: HuntDimensionId): string | undefined => {
    const dimension = offered.find((entry) => entry.id === id);
    const value = answerFor(answers, id);
    return dimension && isAnswerValid(dimension, value) ? value : undefined;
  };

  let out = rules;
  for (const key of ["RESIDENCY", "TAG_TYPE"] as const) {
    const answer = validated(key);
    if (answer) out = out.filter((rule) => !rule.appliesWhen[key] || rule.appliesWhen[key] === answer);
  }
  const method = validated("HUNT_METHOD");
  // A rule applies when it permits the implement the person named — not when it
  // sits under a table whose heading mentions it.
  if (method) out = out.filter((rule) => rule.appliesWhen.permittedImplements.includes(method));
  return out;
}

function baseResult(overrides: Partial<RegulatoryResult>, rules: BundleRule[] = []): RegulatoryResult {
  const rule = rules[0];
  const source = rule ? SOURCES.get(rule.sourceId) : undefined;
  const conditions = rule
    ? (source?.conditions ?? []).filter((condition) => rule.conditionIds.includes(condition.id))
    : [];
  const caveats = [...new Set(rules.flatMap((entry) => entry.caveats))];

  return {
    /* No certified basis for a next opening from this path. Never "none". */
    next: { kind: "NOT_CERTIFIED" },
    legalTime: legalTimeNotCertified(
      "Ontario's general rule permits hunting from 30 minutes before local sunrise to 30 minutes " +
        "after local sunset, subject to listed exceptions. North Ground has not certified exact " +
        "astronomical times for this result.",
      "Ontario Ministry of Natural Resources",
    ),
    // Each condition keeps the section it came from, so a reader can check the
    // licence requirement and the season against different parts of the source.
    requirements: [
      ...restrictionNotes(rules),
      ...conditions.map((condition) => `${condition.text} (${condition.sourceSection})`),
    ],
    limitations: [
      ...caveats.map((caveat) => general(
        `${caveat} North Ground holds wildlife management unit boundaries, not this one, and cannot tell you which side of it you are on.`,
      )),
      general("The Ontario Hunting Regulations Summary is a convenient reference, not the complete law."),
      general("Being inside a wildlife management unit is not permission to hunt there: land access, ownership and local restrictions are separate questions North Ground has not resolved."),
    ],
    sourceIds: rule ? [rule.sourceId as CanonicalId<"source">] : [],
    verifiedAt: bundle.retrievedAt as string,
    status: "UNKNOWN",
    summary: "",
    ...overrides,
  };
}

/**
 * Evaluate an Ontario major-game hunt.
 *
 * `answers` carries what the person has told us. It is self-reported context that
 * selects which published rule applies; it is never treated as proof, and no
 * result produced here states that a licence, tag or residency has been verified.
 */
export function evaluateOntarioMajorGame(
  /*
   * The coordinate is optional and the registry supplies it. It was being
   * discarded one line before this call — see the note there — while the small
   * game path passed the same field through intact.
   */
  input: { speciesId: string; date: string; latitude?: number; longitude?: number },
  zone: ZoneResolution,
  answers: HuntDimensionAnswers = {},
): MajorGameEvaluation {
  /* The legal window for this answer, resolved once. Wild turkey is major game
     in Ontario, so this is the path its 7 p.m. closing actually reaches. */
  const legalTime = ontarioLegalTime(
    input.speciesId,
    zone.status === "RESOLVED" && zone.zoneId
      ? String(zone.zoneId).replace(/^management_zone:ca-on-wmu-/, "")
      : undefined,
    { latitude: input.latitude ?? Number.NaN, longitude: input.longitude ?? Number.NaN },
    input.date as IsoDate,
  );

  if (zone.status !== "RESOLVED" || !zone.zoneId) {
    return {
      completeness: "RESOLVED",
      dimensions: [],
      result: baseResult({ legalTime,
        status: "NEEDS_VERIFICATION",
        summary: "North Ground could not certify the wildlife management unit, so it will not infer a hunting status.",
      }),
    };
  }

  const zoneId = String(zone.zoneId);
  const unitName = zone.officialName ?? zoneId;
  const candidates = rulesFor(input.speciesId, zoneId);

  if (!candidates.length) {
    return {
      completeness: "RESOLVED",
      dimensions: [],
      result: baseResult({ legalTime,
        status: "UNKNOWN",
        summary:
          `No certified rule covers this species in ${unitName}. The unit is not named by any season ` +
          "row North Ground has certified, and an absent row is not evidence that the season is closed.",
      }),
    };
  }

  const sourceId = candidates[0].sourceId;

  // Everything this hunt turns on, answered or not, so an interface can show
  // the whole progressive sequence rather than one question at a time.
  const dimensions = requiredDimensions(candidates, sourceId);

  // Narrowing validates against the full vocabulary, not the question list: an
  // answer stays meaningful even where no question was put.
  const matching = narrow(candidates, answers, availableDimensions(candidates, sourceId));
  const missing = nextMissingDimension(requiredDimensions(matching, sourceId), answers);
  if (missing) return { completeness: "NEEDS_INPUT", required: missing, dimensions, legalTime };

  if (!matching.length) {
    // Every published rule for this unit excludes what was described. That is a
    // real answer, and the footnotes are what make it possible under a heading
    // that appears to permit the implement.
    return {
      completeness: "RESOLVED",
      dimensions,
      result: baseResult({ legalTime,
        status: "CLOSED",
        summary:
          `No published season in ${unitName} is open to this combination. The tables covering ` +
          "this unit do not permit the implement and residency described.",
      }, [candidates[0]]),
    };
  }

  const open = matching.filter((rule) => !rule.declaredNoSeason);
  if (!open.length) {
    return {
      completeness: "RESOLVED",
      dimensions,
      result: baseResult({ legalTime,
        status: "CLOSED",
        summary:
          `The official table states no season for this combination in ${unitName}. ` +
          "Ontario publishes \u201cNone\u201d for it rather than dates.",
      }, matching),
    };
  }

  // Two rules with the SAME implement set and residency reaching one unit would
  // mean the source contradicts itself about it. The build shows none today, so
  // this is a guard against a future source change rather than a live branch.
  const signatures = new Map<string, BundleRule>();
  for (const rule of open) {
    // Keyed by the published table as well as the conditions: two rules in
    // different tables are different seasons, and a person may qualify for
    // both. Two rules in ONE table reaching one unit means the source names
    // that unit twice, which is a contradiction to review.
    const signature = JSON.stringify([
      rule.sourceSection,
      Object.keys(rule.appliesWhen).sort().map((key) => [key, rule.appliesWhen[key]]),
    ]);
    const existing = signatures.get(signature);
    if (existing && existing.seasonPhrase !== rule.seasonPhrase) {
      return {
        completeness: "RESOLVED",
        dimensions,
        result: baseResult({ legalTime,
          status: "CONFLICT",
          summary:
            `Two published rules that apply to the same hunter give ${unitName} different ` +
            `seasons ("${existing.seasonPhrase}" and "${rule.seasonPhrase}"). North Ground will not choose between them.`,
        }, [existing, rule]),
      };
    }
    signatures.set(signature, rule);
  }

  // One implement can qualify for several published seasons at once — a bow is
  // legal in the gun, muzzle-loader and archery seasons — so the open dates are
  // the union of every rule that permits it.
  const evaluated = [];
  for (const rule of open) {
    const windows = rule.seasonPhrase ? parseSeasonPhrase(rule.seasonPhrase) : null;
    if (!windows) {
      return {
        completeness: "RESOLVED",
        dimensions,
        result: baseResult({ legalTime,
          status: "NEEDS_VERIFICATION",
          summary: `North Ground cannot interpret the published season wording for ${unitName} ("${rule.seasonPhrase}").`,
        }, [rule]),
      };
    }
    evaluated.push({ rule, season: evaluateSeason(windows, rule.sourceYear, input.date) });
  }

  /** Every applicable season, named by the implements each one permits. */
  const applicable = evaluated
    .map(({ rule }) => `${rule.seasonLabel} ${rule.seasonPhrase}`)
    .join("; ");

  /*
   * The next opening, read from the SAME resolved windows this answer is built
   * from, so a next date cannot disagree with the season beside it. Computed
   * once and shared by the in-season and closed paths — a hunter asks "when can
   * I next go" in both.
   */
  const next = nextOpening(evaluated.map(({ season }) => season), input.date);

  const inSeason = evaluated.find(({ season }) => season.verdict === "IN_SEASON");
  if (inSeason) {
    const containing = inSeason.season.window!;
    return {
      completeness: "RESOLVED",
      dimensions,
      result: baseResult({ legalTime,
        status: "CONDITIONAL",
        next,
        season: { opens: containing.opensIso, closes: containing.closesIso, datesInclusive: true },
        summary:
          `The certified ${inSeason.rule.sourceVersion} season for ${unitName} includes this date ` +
          `(${inSeason.rule.seasonLabel}, ${inSeason.rule.seasonPhrase}). Licensing, tags, legal hunting time and all overlapping ` +
          "restrictions still apply, and North Ground has not verified what you hold. " +
          `Seasons open to this combination here: ${applicable}.`,
      }, [inSeason.rule, ...open.filter((entry) => entry !== inSeason.rule)]),
    };
  }

  // Closed only where the source speaks to the date. A date outside every rule's
  // certified period belongs to a summary North Ground has not read.
  const withinCertified = evaluated.find(({ season }) => season.verdict === "OUT_OF_SEASON");
  if (withinCertified) {
    // No single window here. Several seasons may apply to this person and none
    // contains the date, so promoting one of them to "the season" would put a
    // spring window beside an October closure.
    return {
      completeness: "RESOLVED",
      dimensions,
      result: baseResult({ legalTime,
        status: "CLOSED",
        next,
        summary:
          `No certified ${withinCertified.rule.sourceVersion} season for ${unitName} covers this date. ` +
          `Seasons open to this combination here: ${applicable}.`,
      }, [withinCertified.rule, ...open.filter((entry) => entry !== withinCertified.rule)]),
    };
  }

  const outside = evaluated[0];
  return {
    completeness: "RESOLVED",
    dimensions,
    result: baseResult({ legalTime,
      status: "NEEDS_VERIFICATION",
      summary:
        `The selected date falls outside the period the ${outside.rule.sourceVersion} summary certifies for ` +
        `${unitName} (${outside.season.span.from} to ${outside.season.span.to}).`,
    }, [outside.rule]),
  };
}

export function majorGameCoverageReport() {
  const officialUnits = bundle.officialUnitCount as number;
  return {
    sourceVersion: bundle.sourceVersion as string,
    retrievedAt: bundle.retrievedAt as string,
    officialUnits,
    species: ONTARIO_MAJOR_GAME_SPECIES.map((speciesId) => {
      const forSpecies = RULES.filter((rule) => rule.speciesId === speciesId);
      const units = new Set(
        forSpecies
          .filter((rule) => !rule.declaredNoSeason)
          .flatMap((rule) => GROUPS.get(rule.regulatoryGroupId)?.officialIdentifiers ?? []),
      );
      return {
        speciesId,
        rules: forSpecies.length,
        rulesWithSeason: forSpecies.filter((rule) => !rule.declaredNoSeason).length,
        rulesStatingNone: forSpecies.filter((rule) => rule.declaredNoSeason).length,
        unitsReached: units.size,
        unitsNotReached: officialUnits - units.size,
        rulesWithUninterpretedCaveat: forSpecies.filter((rule) => rule.caveats.length > 0).length,
      };
    }),
  };
}

/* ── Read-only facts for other layers ────────────────────────────────────── */

/**
 * One of Ontario's general deer, moose or bear seasons as it stands on a date.
 *
 * Exposed for Ready to Hunt, which needs two facts only this bundle holds: which
 * implements the law allows on the hunt being planned, and which OTHER big-game
 * seasons are open in the unit — because those decide whether a grouse hunter
 * must wear hunter orange (O. Reg. 665/98 s. 26) and what shot they may carry.
 */
export interface MajorGameSeasonOnDate {
  speciesId: string;
  seasonLabel: string;
  permittedImplements: string[];
  residency?: string;
  tagType?: string;
  /** Restricted to bows only — the one kind s. 26(1)(a) exempts from orange. */
  bowsOnly: boolean;
}

export interface MajorGameSeasonsInUnit {
  open: MajorGameSeasonOnDate[];
  /**
   * True when a season in this unit cannot be placed on this date because the
   * date is outside the period the summary certifies. Nothing about orange may
   * be said as settled while it is.
   */
  uncertain: boolean;
}

function seasonOnDate(rule: BundleRule, date: string): "OPEN" | "CLOSED" | "UNCERTAIN" {
  if (rule.declaredNoSeason || !rule.seasonPhrase) return "CLOSED";
  const windows = parseSeasonPhrase(rule.seasonPhrase);
  if (!windows) return "UNCERTAIN";
  const { verdict } = evaluateSeason(windows, rule.sourceYear, date);
  return verdict === "IN_SEASON" ? "OPEN" : verdict === "OUT_OF_SEASON" ? "CLOSED" : "UNCERTAIN";
}

function asSeason(rule: BundleRule): MajorGameSeasonOnDate {
  const implementsList = rule.appliesWhen.permittedImplements;
  return {
    speciesId: rule.speciesId,
    seasonLabel: rule.seasonLabel,
    permittedImplements: implementsList,
    ...(typeof rule.appliesWhen.RESIDENCY === "string" ? { residency: rule.appliesWhen.RESIDENCY } : {}),
    ...(typeof rule.appliesWhen.TAG_TYPE === "string" ? { tagType: rule.appliesWhen.TAG_TYPE } : {}),
    bowsOnly: implementsList.length === 1 && implementsList[0] === "BOW",
  };
}

/** Every general deer, moose and bear season open in a unit on a date, for anyone. */
export function majorGameSeasonsInUnit(zoneId: string, date: string): MajorGameSeasonsInUnit {
  const open: MajorGameSeasonOnDate[] = [];
  let uncertain = false;
  for (const rule of RULES) {
    if (!PUBLISHABLE.has(rule.reviewStatus)) continue;
    if (!(GROUPS.get(rule.regulatoryGroupId)?.zoneIds.includes(zoneId) ?? false)) continue;
    const state = seasonOnDate(rule, date);
    if (state === "OPEN") open.push(asSeason(rule));
    else if (state === "UNCERTAIN") uncertain = true;
  }
  return { open, uncertain };
}

/**
 * The implements the law allows for THIS hunt: the species' seasons open in the
 * unit on the date, narrowed by residency and tag where the hunter has said.
 * The chosen implement is deliberately NOT applied, so a hunter sees everything
 * they could legally use, not only what they happened to pick.
 */
/**
 * Whether Ontario's certified seasons can speak about this species in this
 * unit at all, and which sources would be speaking.
 *
 * `majorGameImplementsOnDate` returns the implements with an open season. An
 * empty answer from it is ambiguous on its own: it means either "the seasons
 * say none today" or "North Ground holds no season for this species here".
 * Those are opposite facts about what we know, and a caller that cannot tell
 * them apart will eventually present the second as the first — which is how
 * Ready to Hunt came to assert four unsourced prohibitions to a hunter in a
 * unit it had no rules for.
 *
 * `certified` is false when no publishable rule covers the species and unit.
 * Nothing about what is NOT permitted may be stated while it is false.
 */
export interface MajorGameImplementBasis {
  certified: boolean;
  permitted: string[];
  /** The sources the certified seasons cite, for a caller that must show them. */
  sources: { sourceId: string; url: string; title: string; authority: string; sourceVersion: string }[];
}

export function majorGameImplementBasis(
  speciesId: string,
  zoneId: string,
  date: string,
  answers: HuntDimensionAnswers = {},
): MajorGameImplementBasis {
  const rules = rulesFor(speciesId, zoneId);
  const sources = [...new Set(rules.map((rule) => rule.sourceId))]
    .map((id) => SOURCES.get(id))
    .filter((source): source is BundleSource => source !== undefined)
    .map((source) => ({
      sourceId: source.id, url: source.url, title: source.title,
      authority: source.authority, sourceVersion: source.sourceVersion,
    }));
  return {
    certified: rules.length > 0,
    permitted: majorGameImplementsOnDate(speciesId, zoneId, date, answers),
    sources,
  };
}

export function majorGameImplementsOnDate(
  speciesId: string,
  zoneId: string,
  date: string,
  answers: HuntDimensionAnswers = {},
): string[] {
  const residency = answerFor(answers, "RESIDENCY");
  const tag = answerFor(answers, "TAG_TYPE");
  const allowed = new Set<string>();
  for (const rule of rulesFor(speciesId, zoneId)) {
    if (residency && typeof rule.appliesWhen.RESIDENCY === "string" && rule.appliesWhen.RESIDENCY !== residency) continue;
    if (tag && typeof rule.appliesWhen.TAG_TYPE === "string" && rule.appliesWhen.TAG_TYPE !== tag) continue;
    if (seasonOnDate(rule, date) !== "OPEN") continue;
    for (const implement of rule.appliesWhen.permittedImplements) allowed.add(implement);
  }
  return [...allowed];
}
