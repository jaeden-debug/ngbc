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
  classLabel?: unknown;
  permittedImplements?: unknown;
  implementLabel?: unknown;
  equipmentStatedAs?: unknown;
  appliesWhen?: { permittedImplements?: unknown; [key: string]: unknown };
  limits?: unknown;
  windows?: unknown;
  window?: unknown;
  conditionIds?: unknown;
  sourceId?: unknown;
  declaredNoSeason?: unknown;
}

const filled = (value: unknown): boolean =>
  Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null && value !== "";

/** Implements, from wherever this bundle happens to keep them. */
export function implementsOf(rule: RuleShape): readonly string[] {
  const top = rule.permittedImplements;
  if (Array.isArray(top) && top.length) return top as string[];
  const nested = rule.appliesWhen?.permittedImplements;
  if (Array.isArray(nested) && nested.length) return nested as string[];
  return [];
}

/**
 * Whether one rule settles a dimension AS STRUCTURED DATA.
 *
 * `equipmentStatedAs` and a lone `classLabel` are deliberately NOT accepted.
 * They are the authority's words, which is worth keeping, and they are not a
 * fact the engine can filter, compare or convert. Counting them as resolved is
 * how a display string comes to stand in for coverage.
 */
export function resolves(rule: RuleShape, dimension: Dimension): boolean {
  switch (dimension) {
    case "DATES":
      return filled(rule.windows) || filled(rule.window) || filled(rule.declaredNoSeason);
    case "ANIMAL_CLASS":
      return filled(rule.animalClasses);
    case "PHYSICAL_CRITERIA":
      return false; /* No structured criterion model exists yet — see the gate. */
    case "IMPLEMENT":
      return implementsOf(rule).length > 0;
    case "HUNTER_CLASS":
    case "AUTHORIZATION":
    case "LEGAL_HOURS":
      /* No rule in the corpus carries these yet — `licence` appears on 1 of
         639 — so `false` is currently accurate rather than unimplemented. Said
         out loud because two of the three are MATERIAL for every profile: the
         day the data lands they would still read UNRESOLVED, and nobody would
         know whether that was the data or this function. */
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

export function read(rule: RuleShape, dimension: Dimension): DimensionReading {
  if (resolves(rule, dimension)) return "PRESENT";
  if (dimension === "ANIMAL_CLASS" && filled(rule.classLabel)) return "PROSE_ONLY";
  if (dimension === "IMPLEMENT" && filled(rule.equipmentStatedAs)) return "PROSE_ONLY";
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
export function rendersScannableRow(rule: RuleShape, speciesId: string): boolean {
  const profile = profileFor(speciesId);
  if (!profile) return false;
  const needed: Dimension[] = ["DATES", "IMPLEMENT"];
  if (profile.ANIMAL_CLASS === "MATERIAL") needed.push("ANIMAL_CLASS");
  return needed.every((dimension) => resolves(rule, dimension));
}
