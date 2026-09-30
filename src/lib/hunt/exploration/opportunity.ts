import type { CanonicalId } from "../../content-contract/index.ts";
import type { LimitationLang } from "../limitation.ts";
import type { ConditionScope, RegulatoryCondition, RegulatoryConditionKind } from "../regulatory/condition.ts";
import type { HuntDimensionAnswers, HuntDimensionId, RequiredDimension } from "../regulatory/dimensions.ts";
import { UNSURE, withAnswer } from "../regulatory/dimensions.ts";
import type { RegulatoryOutcome } from "../regulatory/registry.ts";
import { statedConditionIsMaterial } from "./condition-scope.ts";

/**
 * Whether a legal hunting opportunity exists here now — and what a hunter has
 * to know before assuming it is theirs.
 *
 * THIS EXISTS BECAUSE A CORRECT RULE PRODUCED A FALSE MAP. The species layer
 * shipped drawing green only where a season was open for EVERY licence the
 * rules recognise. Ontario moose then drew zero green while twelve zones had a
 * season, because Ontario publishes moose seasons per tag and the engine asks
 * which tag before it will name dates. The map said *nothing is open* about
 * the commonest big-game answer in the province. §8 treats a claim stricter
 * than the source as false in exactly the way a looser one is, and this was the
 * quiet direction — a map showing nothing looks careful.
 *
 * So the question the layer asks is no longer "is the season open to
 * everyone", it is §41A's (2026-09-29): **does at least one current legal
 * hunting opportunity exist for this species, zone and date?**
 *
 * THAT IS ANSWERED BY THE ENGINE, NOT AROUND IT. A pending question is not an
 * open season — `NEEDS_INPUT` means North Ground knows the law and is missing a
 * fact from the hunter, and the engine has not looked at a season window yet.
 * Painting every pending answer green would assert a season nobody established,
 * which is §8's other direction and the worse one. Instead this walks the
 * engine's OWN answer tree: it takes the question the engine asked, answers it
 * each way the engine offers, and asks again, until the engine resolves. A zone
 * is green when at least one of those resolutions is an open season on the
 * date. Every leaf is the canonical engine's own output; there is no second
 * legality implementation here, and this file cannot reach a status the engine
 * would not.
 *
 * WHAT IS CONDITIONAL IS STRUCTURED. Two sources, both structured, neither a
 * display string: the DIMENSIONS the engine asked about (tag, licence class,
 * residency, weapon, animal class, land type — §41A's own list), and the
 * `RegulatoryCondition` rows a resolved answer carries. Nothing here matches
 * prose. A renderer that tested for "Depends on your hunt" would be deciding
 * legality from a label, which is what §57 and `limitation.ts` forbid, and the
 * label is the first thing anyone would change.
 *
 * WHAT IS NOT A CONDITION. Explanatory prose in a source is not a condition,
 * and neither is a `Limitation`: a limitation QUALIFIES an answer, a condition
 * is PART of it (see `condition.ts`).
 *
 * NOT EVERY CONDITION IS MATERIAL. Every condition an open answer carries is
 * listed, so the card can show all of them; each is also marked `material` or
 * not, once, here, and the map's `!` reads only that flag (`condition-scope.ts`
 * has the rule and the measurement behind it). A stated condition is material
 * by its declared kind and scope. An asked dimension is material only when the
 * engine's own tree has a hunter for whom the answer is NOT open: where every
 * residency, every licence and every weapon reaches an open season, the
 * question changes the dates, not whether there is a hunt.
 */

/**
 * What the certified rules say about this species, zone and date — one word,
 * and never a colour's negative.
 *
 * `UNRESOLVED` is deliberately its own member rather than folded into UNKNOWN.
 * It means North Ground stopped exploring the answer tree before deciding, and
 * saying "no certified rule covers this" about a search we truncated would be a
 * finding we never made. Nothing but OPEN draws green; that is the whole point
 * of keeping the rest apart rather than collapsing them into "not open".
 */
export type OpportunityCoverage =
  | "OPEN"
  | "CLOSED"
  | "NEEDS_CLOSER_LOOK"
  | "CONFLICT"
  | "UNKNOWN"
  | "NOT_CERTIFIED"
  | "UNRESOLVED";

/**
 * One material thing a hunter must know before assuming the opportunity is
 * theirs.
 *
 * `ASKED_DIMENSION` is a fact the published rules turn on and the engine asked
 * for; `STATED_CONDITION` is a condition a resolved answer carries, with the
 * authority's own provenance. They are different kinds of fact and are kept
 * apart rather than flattened, because only the second has a citation.
 */
export interface OpportunityCondition {
  id: string;
  kind: "ASKED_DIMENSION" | "STATED_CONDITION";
  text: string;
  lang: LimitationLang;
  owner: "NORTH_GROUND" | "AUTHORITY";
  /** Present for ASKED_DIMENSION: which fact the rules turn on. */
  dimension?: HuntDimensionId;
  /** Present for STATED_CONDITION: the pinpoint the author recorded. */
  sourceSection?: string;
  sourceId?: CanonicalId<"source">;
  /** A stated condition's declared kind (`condition-kinds.json`). Absent for an asked dimension. */
  category?: RegulatoryConditionKind;
  /** A stated condition's declared scope. */
  scope?: ConditionScope;
  /**
   * The official source the condition cites, resolved on the server so the
   * card can link it in one tap. Absent where North Ground holds no record of
   * that source — never an invented link.
   */
  source?: { url: string; publisher: string; title: string };
  /**
   * Whether this condition earns the map's `!`. Decided once, here, so the
   * marker, its popover and the zone's card read one answer and cannot
   * disagree about which conditions made a zone conditional.
   */
  material: boolean;
}

export interface ZoneOpportunity {
  /**
   * At least one current legal hunting opportunity exists, ESTABLISHED — never
   * assumed from a pending question and never inferred from an absence.
   */
  hasCurrentLegalOpportunity: boolean;
  /**
   * At least one listed condition is material. Only ever true alongside the
   * above, and derived from `conditions`, never set beside it.
   */
  hasMaterialConditions: boolean;
  /** Material conditions first, then the rest, each in the order the answer gave it. */
  conditions: OpportunityCondition[];
  coverage: OpportunityCoverage;
  /**
   * Whether the answer tree was walked to its end.
   *
   * False means the walk hit its ceiling. It never weakens an opportunity that
   * was found — one open leaf is one open leaf — but it forbids concluding that
   * none exists, which is why `coverage` is UNRESOLVED rather than CLOSED then.
   */
  exhaustive: boolean;
}

/** A zone with no certified rules at all: no opportunity, and never a closure. */
export const NO_CERTIFIED_RULES: ZoneOpportunity = {
  hasCurrentLegalOpportunity: false,
  hasMaterialConditions: false,
  conditions: [],
  coverage: "NOT_CERTIFIED",
  exhaustive: true,
};

/**
 * The ceiling on engine runs per zone, species and date.
 *
 * Bounded because the tree is the authority's, not ours: a jurisdiction that
 * publishes seasons per hunt code can offer dozens of options, and a crawler
 * walking a continent of zones must not be able to turn one map pan into an
 * unbounded amount of work. Sixty-four covers every published tree North Ground
 * holds with room to spare — Ontario deer is residency (2) × implement (4) —
 * and a tree that outgrows it reports UNRESOLVED rather than a wrong answer.
 */
export const MAX_ENGINE_RUNS = 64;

/** A short stable id, so a condition row keys and a test can name one line. */
function idFor(prefix: string, text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${prefix}:${hash.toString(16).padStart(8, "0")}`;
}

/**
 * How a dimension is named in one short phrase.
 *
 * A table keyed by the CLOSED dimension vocabulary, not a transformation of the
 * engine's question. The question is a sentence addressed to a hunter ("Which
 * moose tag do you hold?") and belongs in the sheet that asks it; the `!`
 * popover has room for a phrase. A dimension missing from this table is named
 * by the authority's own option labels alone rather than by a mangled id.
 */
const DIMENSION_NOUN: Record<string, string> = {
  RESIDENCY: "Residency",
  HUNT_METHOD: "Weapon",
  SEASON_TYPE: "Season",
  TAG_TYPE: "Tag",
  LICENCE_TYPE: "Licence",
  HUNTER_AGE: "Age",
  HUNT_CODE: "Hunt",
  LAND_TYPE: "Land",
};

/** The same fact as something a hunter possesses, for the "turns on" phrasing. */
const DIMENSION_PHRASE: Record<string, string> = {
  RESIDENCY: "your residency",
  HUNT_METHOD: "what you carry",
  SEASON_TYPE: "which season you hunt",
  TAG_TYPE: "which tag you hold",
  LICENCE_TYPE: "which licence you hold",
  HUNTER_AGE: "your age",
  HUNT_CODE: "which hunt you drew",
  LAND_TYPE: "the land you hunt",
};

function nounFor(id: HuntDimensionId): string {
  if (id.startsWith("ANIMAL_CLASS:")) return "Animal class";
  return DIMENSION_NOUN[id] ?? "Your hunt";
}

function phraseFor(id: HuntDimensionId): string {
  if (id.startsWith("ANIMAL_CLASS:")) return "the animal's class";
  return DIMENSION_PHRASE[id] ?? "your hunt";
}

/** Whether an engine outcome reports a season running on the evaluated date. */
export function outcomeIsOpen(outcome: RegulatoryOutcome): boolean {
  if (outcome.completeness !== "RESOLVED") return false;
  const { status } = outcome.regulation;
  /* SEASON_EXCEPT_AREAS: the season IS open across the zone and the card names
     the published areas it does not reach. `zone-summary.ts` states the same
     thing from the same two fields; this is the only other place that decides
     it, and both read the engine rather than a label. */
  if (outcome.exceptInside?.length && status === "NEEDS_VERIFICATION") return true;
  return status === "OPEN" || status === "CONDITIONAL";
}

/** The coverage word a resolved, not-open engine outcome carries. */
function coverageOfClosedOutcome(outcome: RegulatoryOutcome): OpportunityCoverage {
  switch (outcome.regulation.status) {
    case "CLOSED": return "CLOSED";
    case "CONFLICT": return "CONFLICT";
    case "NEEDS_VERIFICATION": return "NEEDS_CLOSER_LOOK";
    default: return "UNKNOWN";
  }
}

/** The least decided of several coverage words, so one gap is never averaged away. */
function weakest(words: readonly OpportunityCoverage[]): OpportunityCoverage {
  const order: OpportunityCoverage[] = ["UNRESOLVED", "CONFLICT", "UNKNOWN", "NEEDS_CLOSER_LOOK", "CLOSED"];
  for (const word of order) if (words.includes(word)) return word;
  return "UNKNOWN";
}

function statedConditions(outcome: RegulatoryOutcome): OpportunityCondition[] {
  return (outcome.regulation.conditions ?? []).map((condition: RegulatoryCondition) => ({
    id: condition.id,
    kind: "STATED_CONDITION" as const,
    text: condition.text,
    lang: condition.lang,
    owner: condition.owner,
    sourceSection: condition.sourceSection,
    sourceId: condition.sourceId,
    ...(condition.kind ? { category: condition.kind } : {}),
    ...(condition.scope ? { scope: condition.scope } : {}),
    material: statedConditionIsMaterial(condition.kind, condition.scope),
  }));
}

/** Material first, each group in the order the answer gave it. */
function materialFirst(conditions: readonly OpportunityCondition[]): OpportunityCondition[] {
  return [...conditions.filter((condition) => condition.material), ...conditions.filter((condition) => !condition.material)];
}

/**
 * An asked dimension, named by the authority's own option labels.
 *
 * THE VALUES ARE NAMED ONLY WHEN ONE FACT GATES THE ANSWER, and that
 * restriction is the whole care in this function. The opening values are a
 * UNION over every open path in the tree, so when two facts gate an answer the
 * two unions do not combine: Manitoba deer opens for a muzzle-loader and for a
 * hunter under eighteen, but not necessarily for a hunter under eighteen with a
 * muzzle-loader. Printing "Weapon: Muzzle-loader" beside "Age: Under 18" reads
 * as a recipe and would assert a season nobody published — §8's looser
 * direction, arrived at by a presentation choice rather than by a rule.
 *
 * So: one gate, name the answers that open it. More than one, name the fact and
 * send the hunter to the card, where the engine answers them one at a time.
 */
function askedCondition(
  dimension: RequiredDimension,
  openingValues: readonly string[],
  soleGate: boolean,
  material: boolean,
): OpportunityCondition {
  const labels = dimension.options
    .filter((option) => openingValues.includes(option.value))
    .map((option) => option.label);
  const noun = nounFor(dimension.id);
  /* Every option opens a season, so naming them adds nothing a hunter can act
     on — what they need to know is that the dates turn on this fact at all. */
  const allOpen = labels.length === dimension.options.length;
  const text = soleGate && labels.length && !allOpen
    ? `${noun}: ${labels.join(" or ")}`
    : `Turns on ${phraseFor(dimension.id)}`;
  return {
    id: idFor("opportunity-dimension", `${dimension.id}|${text}`),
    kind: "ASKED_DIMENSION",
    text,
    lang: "en-CA",
    owner: "NORTH_GROUND",
    dimension: dimension.id,
    material,
  };
}

/**
 * Walk the engine's own answer tree and report what it establishes.
 *
 * `evaluateWith` is the canonical engine, curried over the zone, species and
 * date. Every conclusion below comes from an outcome it returned.
 */
export async function opportunityOf(
  root: RegulatoryOutcome,
  evaluateWith: (answers: HuntDimensionAnswers) => Promise<RegulatoryOutcome>,
): Promise<ZoneOpportunity> {
  if (root.completeness === "RESOLVED") {
    if (!outcomeIsOpen(root)) {
      return {
        hasCurrentLegalOpportunity: false,
        hasMaterialConditions: false,
        conditions: [],
        coverage: coverageOfClosedOutcome(root),
        exhaustive: true,
      };
    }
    const conditions = materialFirst(statedConditions(root));
    return {
      hasCurrentLegalOpportunity: true,
      hasMaterialConditions: conditions.some((condition) => condition.material),
      conditions,
      coverage: "OPEN",
      exhaustive: true,
    };
  }

  /* NEEDS_INPUT. Nothing about a season is known yet, so the tree is walked. */
  const asked = new Map<HuntDimensionId, { dimension: RequiredDimension; order: number }>();
  const opening = new Map<HuntDimensionId, Set<string>>();
  /* Every answer the tree offered for a dimension, wherever it was asked. */
  const offered = new Map<HuntDimensionId, Set<string>>();
  const stated = new Map<string, OpportunityCondition>();
  const closedWords: OpportunityCoverage[] = [];
  let runs = 0;
  let truncated = false;
  let found = false;

  const walk = async (answers: HuntDimensionAnswers, path: Array<{ id: HuntDimensionId; value: string }>): Promise<void> => {
    if (runs >= MAX_ENGINE_RUNS) {
      truncated = true;
      return;
    }
    runs += 1;
    const outcome = await evaluateWith(answers);
    if (outcome.completeness === "NEEDS_INPUT") {
      const required = outcome.required;
      /* NEEDS_INPUT with nothing to ask is a branch that cannot be explored.
         It is not a closure and not an opportunity; it is undecided. */
      if (!required) {
        truncated = true;
        return;
      }
      if (!asked.has(required.id)) asked.set(required.id, { dimension: required, order: asked.size });
      const values = offered.get(required.id) ?? new Set<string>();
      for (const option of required.options) if (option.value !== UNSURE) values.add(option.value);
      offered.set(required.id, values);
      for (const option of required.options) {
        /* "Not sure" is not a hunt. A tree branch on it would answer for a
           hunter who has not established the fact, which is the failure
           `allowsUnsure` exists to prevent. */
        if (option.value === UNSURE) continue;
        await walk(withAnswer(answers, required.id, option.value), [...path, { id: required.id, value: option.value }]);
        if (runs >= MAX_ENGINE_RUNS) {
          truncated = true;
          return;
        }
      }
      return;
    }
    if (!outcomeIsOpen(outcome)) {
      closedWords.push(coverageOfClosedOutcome(outcome));
      return;
    }
    found = true;
    for (const step of path) {
      const values = opening.get(step.id) ?? new Set<string>();
      values.add(step.value);
      opening.set(step.id, values);
    }
    for (const condition of statedConditions(outcome)) stated.set(condition.id, condition);
  };

  await walk({}, []);

  if (!found) {
    return {
      hasCurrentLegalOpportunity: false,
      hasMaterialConditions: false,
      conditions: [],
      /* A truncated walk found nothing; it did not establish that nothing is
         there. Reporting CLOSED here would be a finding we never made. */
      coverage: truncated ? "UNRESOLVED" : weakest(closedWords),
      exhaustive: !truncated,
    };
  }

  /* The dimensions a hunter's answer actually reached an open season through,
     in the order the rules asked them, then the conditions those answers carry. */
  const reached = [...asked.values()]
    .filter((entry) => opening.has(entry.dimension.id))
    .sort((a, b) => a.order - b.order);
  /*
   * GATED: some hunter the rules recognise does NOT reach an open season — a
   * leaf closed, unknown or undecided, or a walk cut short before it could
   * show otherwise. Only then does a question gate the hunt; where every
   * answer opens, it changes which dates apply and nothing about whether a
   * hunt exists, and a `!` for it would be the licence-everywhere marker again.
   *
   * The dimensions that gate are those whose open answers are narrower than
   * what was offered. Where each dimension's answers all open somewhere but a
   * COMBINATION does not (a muzzle-loader and under 18), no single one is
   * narrow, and every one reached is material — the card walks them.
   */
  const gated = closedWords.length > 0 || truncated;
  const narrow = new Set(reached
    .filter((entry) => opening.get(entry.dimension.id)!.size < (offered.get(entry.dimension.id)?.size ?? 0))
    .map((entry) => entry.dimension.id));
  const dimensionConditions = reached.map((entry, _index, all) => askedCondition(
    entry.dimension,
    [...opening.get(entry.dimension.id)!],
    all.length === 1,
    gated && (narrow.size === 0 || narrow.has(entry.dimension.id)),
  ));
  const conditions = materialFirst([...dimensionConditions, ...stated.values()]);

  return {
    hasCurrentLegalOpportunity: true,
    hasMaterialConditions: conditions.some((condition) => condition.material),
    conditions,
    coverage: "OPEN",
    exhaustive: !truncated,
  };
}
