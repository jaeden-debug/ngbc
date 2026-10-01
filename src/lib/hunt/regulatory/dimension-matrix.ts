/**
 * WHAT A HUNTING OPPORTUNITY IS MADE OF, AND WHETHER WE HAVE IT.
 *
 * A season is not a date range. The thing a hunter needs is a LEGAL HARVEST
 * OPPORTUNITY: a species, in a geography, on a date, of a stated legal animal
 * class, with a stated implement, under stated authorization and limits. Two
 * rows with the same dates can be entirely different opportunities — antlered
 * with a bow in October is not either-sex with a rifle in November — and
 * flattening them into "deer season: Oct 1 – Nov 20" destroys the answer.
 *
 * This file does not encode rules. It measures whether the rules we hold can
 * answer that question, per species and jurisdiction, dimension by dimension.
 *
 * THE RULE THAT MAKES IT WORTH HAVING: a fact that exists only in a display
 * string is NOT resolved. Québec's antler threshold lives in `classLabel` as
 * "Cerf de Virginie avec bois (7 cm ou plus)" — the actual legal test, in
 * French, unqueryable. A hunter cannot be told the threshold from it, no other
 * jurisdiction's equivalent can sit beside it, and no filter can use it. It
 * reads as coverage and computes as nothing.
 */

import conditionKinds from "../../../../content/regulatory/condition-kinds.json" with { type: "json" };
import { timeZoneAtPoint } from "../time-zone.ts";
import { classesFor, type LegalAnimalClass } from "./physical-criterion.ts";

const CONDITION_KINDS = (conditionKinds as { conditions: Record<string, { kind: string; scope: string }> }).conditions;

export type DimensionStatus =
  /** The fact is present as structured data the engine can compute on. */
  | "RESOLVED"
  /** The authority does not use this dimension for this species. Not a gap. */
  | "NOT_APPLICABLE"
  /** We looked and the authority did not settle it, or it is prose only. */
  | "UNRESOLVED"
  /** The authority's own source could not be read. A finding, not an absence. */
  | "BLOCKED_SOURCE"
  /** Nobody has looked. Never to be reported as NOT_APPLICABLE. */
  | "NOT_RESEARCHED";

export type Dimension =
  | "DATES"
  | "ANIMAL_CLASS"
  | "PHYSICAL_CRITERIA"
  | "IMPLEMENT"
  | "HUNTER_CLASS"
  | "AUTHORIZATION"
  | "LIMITS"
  | "LEGAL_HOURS"
  | "CONDITIONS"
  | "PROVENANCE";

/** Whether a dimension can change legality for a species — not whether we hold it. */
export type Materiality = "MATERIAL" | "POSSIBLE" | "NOT_NORMALLY_MATERIAL";

/**
 * Which dimensions MAY decide legality for a species.
 *
 * A declaration about the world, not about our data, and deliberately coarse:
 * it says where to look, never what the answer is. Only the authority decides
 * whether a class applies — a profile saying ANIMAL_CLASS is MATERIAL for deer
 * does not make any particular deer rule class-restricted.
 *
 * POSSIBLE is the honest middle: antler thresholds exist for deer in some
 * jurisdictions and not others, so their absence is only a gap where the
 * authority states one.
 */
export interface SpeciesDimensionProfile {
  readonly [dimension: string]: Materiality;
}

const BIG_GAME: SpeciesDimensionProfile = {
  DATES: "MATERIAL",
  ANIMAL_CLASS: "MATERIAL",
  PHYSICAL_CRITERIA: "POSSIBLE",
  IMPLEMENT: "MATERIAL",
  HUNTER_CLASS: "POSSIBLE",
  AUTHORIZATION: "MATERIAL",
  LIMITS: "MATERIAL",
  LEGAL_HOURS: "MATERIAL",
  CONDITIONS: "POSSIBLE",
  PROVENANCE: "MATERIAL",
};

const SMALL_GAME: SpeciesDimensionProfile = {
  DATES: "MATERIAL",
  ANIMAL_CLASS: "NOT_NORMALLY_MATERIAL",
  PHYSICAL_CRITERIA: "NOT_NORMALLY_MATERIAL",
  IMPLEMENT: "MATERIAL",
  HUNTER_CLASS: "POSSIBLE",
  AUTHORIZATION: "MATERIAL",
  LIMITS: "MATERIAL",
  LEGAL_HOURS: "MATERIAL",
  CONDITIONS: "POSSIBLE",
  PROVENANCE: "MATERIAL",
};

/** Bearded/unbearded is a regulatory class the way antlered is. */
const TURKEY: SpeciesDimensionProfile = { ...SMALL_GAME, ANIMAL_CLASS: "MATERIAL" };

const PROFILES: Readonly<Record<string, SpeciesDimensionProfile>> = {
  "species:white-tailed-deer": BIG_GAME,
  "species:mule-deer": BIG_GAME,
  "species:moose": BIG_GAME,
  "species:elk": BIG_GAME,
  "species:american-black-bear": BIG_GAME,
  "species:pronghorn": BIG_GAME,
  "species:caribou": BIG_GAME,
  "species:wild-turkey": TURKEY,
};

/**
 * The profile for a species, and NOT_RESEARCHED rather than a guess when we
 * have none. A species nobody has profiled must not inherit big game's answers.
 */
export function profileFor(speciesId: string): SpeciesDimensionProfile | null {
  return PROFILES[speciesId] ?? (speciesId.startsWith("species:") ? SMALL_GAME : null);
}

export function isProfiled(speciesId: string): boolean {
  return speciesId in PROFILES;
}

/* ── Reading the rules we actually hold ───────────────────────────────────── */

/**
 * One rule, in whichever of the three shapes the repository currently uses.
 *
 * Québec puts implements and classes at the top level; Ontario, Alberta and
 * Nova Scotia nest implements under `appliesWhen`; Manitoba states them as
 * prose in `equipmentStatedAs`. Normalising here rather than in each caller is
 * the point — a hunter asking "what is open to a crossbow" cannot be answered
 * while one fact lives in three places.
 */
export interface RuleShape {
  speciesId?: string;
  animalClasses?: unknown;
  /** The legal classes this rule invokes, by canonical id. See `criteriaOf`. */
  legalAnimalClassIds?: unknown;
  classLabel?: unknown;
  permittedImplements?: unknown;
  implementLabel?: unknown;
  equipmentStatedAs?: unknown;
  appliesWhen?: { permittedImplements?: unknown; [key: string]: unknown };
  limits?: unknown;
  windows?: unknown;
  window?: unknown;
  conditionIds?: unknown;
  jurisdictionId?: unknown;
  /** The authority's season as published prose, where no window was derived. */
  seasonPhrase?: unknown;
  sourceId?: unknown;
  declaredNoSeason?: unknown;
}

/**
 * Whether a field holds a fact.
 *
 * **`false` is not a fact, and admitting it certified prose as structured.**
 * `declaredNoSeason: false` means "this rule is not a declared closure" — it
 * says nothing about dates — and it passed every clause of the original test,
 * so 119 of Ontario's 135 major-game rules counted as having resolved dates
 * while their seasons sat in `seasonPhrase` as "September 19 to December 15",
 * without a year. The measure built to catch facts living in display strings
 * was reporting a display string as a fact.
 *
 * Rejecting `false` here rather than at the one call site is deliberate: the
 * next boolean field would have repeated it, and a negative flag never
 * establishes the positive fact a dimension asks for.
 */
const filled = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.length > 0;
  if (value === false) return false;
  return value !== undefined && value !== null && value !== "";
};

/** Implements, from wherever this bundle happens to keep them. */
export function implementsOf(rule: RuleShape): readonly string[] {
  const top = rule.permittedImplements;
  if (Array.isArray(top) && top.length) return top as string[];
  const nested = rule.appliesWhen?.permittedImplements;
  if (Array.isArray(nested) && nested.length) return nested as string[];
  return [];
}

/** The bundle a rule came from, for facts a rule references but does not hold. */
export interface ClassBundle {
  legalAnimalClasses?: readonly LegalAnimalClass[];
  /* Most bundles state the jurisdiction once, at the top. Ontario also puts it
     on each rule. One fact, two homes — so it is read from both. */
  jurisdictionId?: unknown;
}

/**
 * The criterion status behind each legal class this rule invokes.
 *
 * A rule does not carry the antler threshold; it names a class, and the class
 * carries the test. So the dimension cannot be read from the rule alone, which
 * is why this takes the bundle — and why the function returned a flat `false`
 * until the classes existed.
 *
 * **The link is `legalAnimalClassIds`, never the word in `animalClasses`.**
 * The first draft matched a class whose id ended in the flattened term, and it
 * was wrong on real data within the hour: Québec's eight zone 6 nord / 6 sud
 * rules flatten « avec bois (norme RTLB) » to ANTLERED, so they matched the
 * 7 cm class and would have handed a hunter a threshold from a standard the
 * rule does not apply — while the RTLB class sat in the same bundle carrying
 * its unresolved blocker, pointed at by nothing. Ontario's 7.5 cm and Québec's
 * 7 cm are both "ANTLERED" too. The word is a filter; it is not an identity.
 *
 * Three results that look alike and are not:
 *
 * - **A rule naming NO class** has no membership test to state. `[]`, and
 *   `every` on it is true. Not a gap.
 * - **A rule naming a class with no link, or a link nothing defines** —
 *   Alberta's, Manitoba's and Nova Scotia's deer rules today — is UNRESOLVED.
 *   A hunter told "antlered" by a system holding no definition of antlered has
 *   been told nothing.
 * - **A defined class** answers with its own status. Only UNRESOLVED is a
 *   shortfall: BY_NEGATION inherits its test and NOT_MEASURED has none to
 *   hold, and both are complete.
 */
function criteriaOf(rule: RuleShape, bundle?: ClassBundle): readonly string[] {
  if (!animalClassesOf(rule).length) {
    /* A class stated only as prose — Québec's « avec bois (7 cm ou plus) » in
       `classLabel` — is a class we hold no test for. Not "no class". */
    return filled(rule.classLabel) ? ["UNRESOLVED"] : [];
  }
  if (!rule.speciesId) return ["UNRESOLVED"];
  const linked = Array.isArray(rule.legalAnimalClassIds) ? (rule.legalAnimalClassIds as unknown[]) : [];
  if (!linked.length) return ["UNRESOLVED"];
  const classes = classesFor(bundle, rule.speciesId);
  return linked.map((id) => classes.find((entry) => entry.id === id)?.criterionStatus ?? "UNRESOLVED");
}

/**
 * The regulatory animal classes a rule states, from wherever the bundle keeps
 * them.
 *
 * THE ASYMMETRY THIS CORRECTS, and it was silently costing coverage.
 * `implementsOf` has always read BOTH homes — the top level and `appliesWhen` —
 * because Québec, Ontario and Alberta keep implements in different places.
 * Animal class had only ever been read from the top level, and Alberta keeps it
 * in `appliesWhen` as `ANIMAL_CLASS:ANTLER_CLASS`. So twenty Alberta
 * white-tailed deer rules that DO state a class counted as unresolved, and the
 * joint coverage metric understated Alberta at exactly zero.
 *
 * Measuring one field shape and concluding about the FACT is how that happened:
 * the earlier reading "Alberta's rules carry no animal-class field at all" was
 * true of `animalClasses` and `classLabel` and false of Alberta.
 */
export function animalClassesOf(rule: RuleShape): readonly string[] {
  const top = rule.animalClasses;
  if (Array.isArray(top) && top.length) return top as string[];
  const applies = rule.appliesWhen ?? {};
  /* The key is namespaced by the DIMENSION the class belongs to
     (`ANIMAL_CLASS:ANTLER_CLASS`), so a jurisdiction measuring a different one
     — bearded, horn — is read without being named here. */
  const classes = Object.entries(applies)
    .filter(([key]) => key.startsWith("ANIMAL_CLASS:"))
    .flatMap(([, value]) => (Array.isArray(value) ? value : typeof value === "string" ? [value] : []));
  return classes;
}

/**
 * The hunter dimensions a rule is scoped by.
 *
 * Read from `appliesWhen` against the engine's own declared vocabulary
 * (`dimensions.ts`), never a regex over key names: a key matching /HUNTER/ is a
 * field shape, and which dimensions describe a hunter is a fact the engine
 * already declares.
 */
export const HUNTER_DIMENSIONS: readonly string[] = ["RESIDENCY", "HUNTER_AGE", "LICENCE_TYPE", "HUNT_CODE"];

export function hunterDimensionsOf(rule: RuleShape): readonly string[] {
  const applies = rule.appliesWhen ?? {};
  return HUNTER_DIMENSIONS.filter((dimension) => filled(applies[dimension]));
}

/**
 * The conditions on a rule whose DECLARED kind is an authorization.
 *
 * `condition-kinds.json` declares a kind per condition id — the same table
 * §41A's `!` marker reads — so a rule linking a LICENCE, TAG_OR_DRAW or
 * ADDITIONAL_PERMIT condition has settled that an authorization is required,
 * with provenance, as structured data. The prose naming WHICH licence lives in
 * the condition's text and in Ready to Hunt; that is a different question from
 * whether the dimension is resolved.
 *
 * Reading the kind from the id's spelling would be the field-shape defect
 * again, so an id with no declared kind counts for nothing and is reported as
 * its own gap (`undeclaredConditionKinds`).
 */
const AUTHORIZATION_KINDS = new Set(["LICENCE", "TAG_OR_DRAW", "ADDITIONAL_PERMIT", "STAMP", "VALIDATION"]);

export function authorizationConditionsOf(rule: RuleShape): readonly string[] {
  const ids = Array.isArray(rule.conditionIds) ? (rule.conditionIds as string[]) : [];
  return ids.filter((id) => AUTHORIZATION_KINDS.has(CONDITION_KINDS[id]?.kind ?? ""));
}

/** Condition ids a rule links that no kind has been declared for. */
export function undeclaredConditionKinds(rule: RuleShape): readonly string[] {
  const ids = Array.isArray(rule.conditionIds) ? (rule.conditionIds as string[]) : [];
  return ids.filter((id) => !CONDITION_KINDS[id]);
}

/**
 * Whether one rule settles a dimension AS STRUCTURED DATA.
 *
 * `equipmentStatedAs` and a lone `classLabel` are deliberately NOT accepted.
 * They are the authority's words, which is worth keeping, and they are not a
 * fact the engine can filter, compare or convert. Counting them as resolved is
 * how a display string comes to stand in for coverage.
 */
export function resolves(rule: RuleShape, dimension: Dimension, bundle?: ClassBundle): boolean {
  switch (dimension) {
    case "DATES":
      /*
       * `declaredNoSeason` is a BOOLEAN, and `filled` accepts `false` — it
       * only rejects undefined, null and the empty string. So every rule
       * carrying `declaredNoSeason: false` counted as having resolved dates,
       * including 86 of Ontario's 100 white-tailed deer rules, which have no
       * `windows` at all and state their season as prose:
       * "September 19 to December 15".
       *
       * That is the exact failure this file opens by naming — "a fact that
       * exists only in a display string is NOT resolved" — committed by the
       * measurement itself, and it inflated the coverage metric the product
       * now reports.
       *
       * A DECLARED closure is a real resolution: the authority said there is no
       * season. `false` says only that no closure was declared, which is not a
       * date.
       */
      return filled(rule.windows) || filled(rule.window) || rule.declaredNoSeason === true;
    case "ANIMAL_CLASS":
      return animalClassesOf(rule).length > 0;
    case "PHYSICAL_CRITERIA":
      return criteriaOf(rule, bundle).every((entry) => entry !== "UNRESOLVED");
    case "IMPLEMENT":
      return implementsOf(rule).length > 0;
    case "HUNTER_CLASS":
      return hunterDimensionsOf(rule).length > 0;
    case "AUTHORIZATION":
      return authorizationConditionsOf(rule).length > 0;
    case "LEGAL_HOURS":
      /*
       * NOT A PER-RULE FACT, AND COUNTING IT AS ONE WAS WRONG IN BOTH
       * DIRECTIONS.
       *
       * A legal window is a wall-clock time at a POINT on a DATE:
       * `legalTimeFor` takes the jurisdiction's rule, the coordinates and the
       * timezone, and the result is rendered by `LegalHours.tsx`. Eight
       * jurisdictions have a certified hours rule and 453 of 466 big-game rules
       * sit in one — so reporting 0 understated a capability that ships, which
       * §8 forbids as firmly as overstating one.
       *
       * It stays `false` here because a RULE genuinely does not carry it, and
       * `legalHoursDelivery()` reports it at the level it is delivered. The
       * distinction is the point: not a gap in the data, a dimension measured
       * in the wrong unit.
       */
      return false;
    case "LIMITS":
      return filled(rule.limits);
    case "CONDITIONS":
      return filled(rule.conditionIds);
    case "PROVENANCE":
      return filled(rule.sourceId);
    default:
      return false;
  }
}

/* ── The row the interface actually renders ──────────────────────────────── */

/**
 * Why a dimension is not resolved, which a boolean cannot say.
 *
 * `animalClasses: null` on 92 Québec rules means either "the authority states
 * no class restriction" — NOT_APPLICABLE, not a gap — or "nobody extracted it"
 * — NOT_RESEARCHED, a real one. The scannable row must print either the class
 * or "any deer", and nothing in the data currently knows which. Reporting the
 * second as the first is the failure §9 names, so an explicit null is ABSENT
 * rather than silently either.
 */
export type DimensionReading = "PRESENT" | "ABSENT" | "PROSE_ONLY";

export function read(rule: RuleShape, dimension: Dimension, bundle?: ClassBundle): DimensionReading {
  if (resolves(rule, dimension, bundle)) return "PRESENT";
  if (dimension === "ANIMAL_CLASS" && filled(rule.classLabel)) return "PROSE_ONLY";
  if (dimension === "IMPLEMENT" && filled(rule.equipmentStatedAs)) return "PROSE_ONLY";
  /* Ontario's "September 19 to December 15", with no year. The authority's own
     words, and not a window anything can evaluate. */
  if (dimension === "DATES" && filled(rule.seasonPhrase)) return "PROSE_ONLY";
  return "ABSENT";
}

/**
 * Whether a rule can render the answer a hunter scans: status, legal animal
 * class, dates and implement, together.
 *
 * Per-dimension coverage invites the wrong inference and the numbers prove it.
 * Across 437 big-game rules: dates 100%, implements 82%, animal class 20% —
 * which reads as "most places are partly scannable". They are not. The rules
 * where all three hold are 88, and **every one of them is Québec's**. Outside
 * Québec the joint figure is zero.
 *
 * §8 requires capability reporting to measure deliverable answers, and a
 * number that cannot tell 88-in-Québec from 88-spread-nationally is not
 * measuring one. So coverage is reported over the tuple the UX renders, never
 * over dimensions counted apart.
 */
export function rendersScannableRow(rule: RuleShape, speciesId: string, bundle?: ClassBundle): boolean {
  const profile = profileFor(speciesId);
  if (!profile) return false;
  const needed: Dimension[] = ["DATES", "IMPLEMENT"];
  if (profile.ANIMAL_CLASS === "MATERIAL") needed.push("ANIMAL_CLASS");
  return needed.every((dimension) => resolves(rule, dimension, bundle));
}

/* ── Dimensions delivered at a level other than the rule ─────────────────── */

/**
 * The jurisdictions with a certified legal-hours module.
 *
 * LEGAL_HOURS is MATERIAL for every species and is not a field on a rule, so a
 * per-rule count of it can only be 0 — which read as "North Ground has no legal
 * hours anywhere" while the interface was rendering windows.
 *
 * A hand-kept list asserting a capability is exactly what §9 says must be
 * computed rather than typed, so the test asserts this list against the modules
 * that exist on disk: adding a jurisdiction here without a module fails.
 */
export const LEGAL_HOURS_JURISDICTIONS: readonly string[] = [
  "jurisdiction:ca-ab",
  "jurisdiction:ca-bc",
  "jurisdiction:ca-mb",
  "jurisdiction:ca-nl",
  "jurisdiction:ca-on",
  "jurisdiction:ca-qc",
  "jurisdiction:us-id",
  "jurisdiction:us-mt",
  "jurisdiction:us-wy",
];

export type DeliveryLevel = "PER_RULE" | "PER_JURISDICTION_AND_POINT";

/**
 * The unit each dimension is actually delivered in.
 *
 * Declared rather than inferred, because measuring a dimension in the wrong
 * unit is not a small reporting error: it produced a 0% on a shipping
 * capability, and it would produce a 100% on one that does not ship.
 */
export const DELIVERY_LEVEL: Readonly<Record<Dimension, DeliveryLevel>> = {
  DATES: "PER_RULE",
  ANIMAL_CLASS: "PER_RULE",
  PHYSICAL_CRITERIA: "PER_RULE",
  IMPLEMENT: "PER_RULE",
  HUNTER_CLASS: "PER_RULE",
  AUTHORIZATION: "PER_RULE",
  LIMITS: "PER_RULE",
  CONDITIONS: "PER_RULE",
  PROVENANCE: "PER_RULE",
  LEGAL_HOURS: "PER_JURISDICTION_AND_POINT",
};

/**
 * Whether a rule's jurisdiction can actually be given a legal window on a date.
 *
 * TWO NECESSARY CONDITIONS, AND THE FIRST VERSION OF THIS CHECKED ONE.
 *
 * It asked only whether a certified hours MODULE exists and reported 453 of 466
 * rules as delivered. A window is a wall-clock time, so `legalTimeFor` refuses
 * without a point timezone — and `timeZoneAtPoint` returns undefined for
 * Ontario, Québec, British Columbia, Newfoundland and Idaho, each of which
 * genuinely spans zones whose clocks differ and for which no licensed
 * point-timezone dataset exists. The true figure is three jurisdictions:
 * Alberta, Manitoba and Montana.
 *
 * So the correction to a 0% became an overstatement inside the same work. The
 * failure direction flipped and the shape did not: a capability was measured by
 * one of the things it needs. §8 counts both as false claims, and this one is
 * the worse of the two, because a hunter shown a window that does not exist is
 * worse off than one shown none.
 *
 * The three outcomes go to three different places, which is why they are not
 * collapsed into a boolean: a missing module is a research queue, a missing
 * point timezone is a licensed-data blocker nobody can clear by reading, and a
 * delivered window is neither.
 */
export type LegalHoursDelivery =
  /** The rule is read and a clock time can be computed at the hunt point. */
  | "DELIVERED"
  /** The rule is read; no point timezone can be established, so no clock. */
  | "RULE_READ_NO_POINT_TIMEZONE"
  /** No certified hours rule for this jurisdiction. */
  | "NOT_CERTIFIED"
  | "UNKNOWN_JURISDICTION";

export function legalHoursDelivery(rule: RuleShape, bundle?: ClassBundle): LegalHoursDelivery {
  const fromRule = typeof rule.jurisdictionId === "string" ? rule.jurisdictionId : null;
  const fromBundle = typeof bundle?.jurisdictionId === "string" ? bundle.jurisdictionId : null;
  const jurisdiction = fromRule ?? fromBundle;
  if (!jurisdiction) return "UNKNOWN_JURISDICTION";
  if (!LEGAL_HOURS_JURISDICTIONS.includes(jurisdiction)) return "NOT_CERTIFIED";
  return timeZoneAtPoint(jurisdiction) ? "DELIVERED" : "RULE_READ_NO_POINT_TIMEZONE";
}
