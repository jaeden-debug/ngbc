import type { NextSeason, SeasonAnchor } from "./regulatory/season.ts";
import type { AuthorityQuotation } from "./provenance.ts";
import type { OpportunityAvailability } from "./regulatory/opportunity-row.ts";
import type { RegulatoryCondition } from "./regulatory/condition.ts";
import type { LegalTimeResult } from "./regulatory/legal-time.ts";
import type { Limitation } from "./limitation.ts";
import type { BlockResult, CanonicalId, IsoDate, SourceRecord } from "../content-contract/index.ts";
import type { AuthorizationContext } from "./regulatory/allocation.ts";
import type { HuntDimensionAnswers, RequiredDimension } from "./regulatory/dimensions.ts";
import type { ReadinessResult } from "./readiness/types.ts";

export type RegulatoryStatus = "OPEN" | "CLOSED" | "CONDITIONAL" | "UNKNOWN" | "CONFLICT" | "NEEDS_VERIFICATION";

export interface HuntInput {
  latitude: number;
  longitude: number;
  date: IsoDate;
  speciesId: CanonicalId<"species">;
  /**
   * What the hunter has told us about their own hunt.
   *
   * Self-reported context that selects which published rule applies. It is never
   * proof: an answer of "resident" follows the resident rule and does not make
   * anyone a resident, and no result derived from it may say North Ground
   * verified a licence, tag or residency.
   */
  answers?: HuntDimensionAnswers;
}

export interface ZoneResolution {
  status: "RESOLVED" | "UNKNOWN" | "PROVIDER_ERROR";
  zoneId?: CanonicalId<"management_zone">;
  /**
   * The jurisdiction whose official layer this zone belongs to, read from the
   * zone itself — never from which bounding box the point happened to fall in.
   * Ontario's box reaches into Québec and Manitoba, so the box is not an answer.
   */
  jurisdictionId?: CanonicalId<"jurisdiction">;
  officialName?: string;
  locationAccuracy?: string;
  verificationFlag?: string;
  boundaryDistanceMeters?: number;
  nearBoundary?: boolean;
  /**
   * Set when more than one zone claims this point: either two authorities'
   * services both placed it in a zone of their own, or one authority's service
   * returned several of its own features for it. An UNKNOWN carrying this is a
   * CONFLICT, not "no zone here", and must never be resolved by preferring
   * another source that did answer.
   *
   * The ids are recorded rather than merely counted. "Overlapping features"
   * with the features thrown away cannot be investigated, cannot be shown to a
   * hunter, and cannot tell a legitimate nesting (Michigan draws a county unit,
   * a multicounty unit and a CWD core over the same ground) apart from a real
   * defect. Which zones is the whole question.
   */
  conflictingZoneIds?: string[];
  displayRings?: number[][][];
  /**
   * The authority whose geography produced this answer. Absent where there is
   * no such authority: a point outside every served layer has no source to
   * cite, and citing one anyway named Ontario at a point in Labrador for as
   * long as Ontario was the only jurisdiction North Ground served.
   */
  sourceId?: CanonicalId<"source">;
  /**
   * Present when the point was placed in a JURISDICTION rather than a zone:
   * by a jurisdiction boundary, for rules whose own scope is the whole
   * jurisdiction (CLAUDE.md §41A, "Resolving inside a jurisdiction is not
   * drawing its boundary"). Such a resolution has no `zoneId`, ever — no
   * authority drew a zone there — and carries what placed it, so it is
   * labelled as what it is wherever it is shown.
   */
  jurisdictionScope?: JurisdictionScope;
  message: string;
}

/** How a point was placed in a jurisdiction for its whole-jurisdiction rules. */
export interface JurisdictionScope {
  kind: "WHOLE_JURISDICTION";
  /** The boundary that placed it — cartographic, never the authority's own determination. */
  boundary: {
    authority: string;
    title: string;
    url: string;
    /**
     * The boundary's source. It PLACED the point; it never decided the
     * answer, so it is never in `RegulatoryResult.sourceIds` and the
     * resolution carries no zone `sourceId` — a reader listing what decided
     * the answer cannot pick it up by accident (`source-roles.ts`).
     */
    sourceId: CanonicalId<"source">;
    /** What it is, as a label beside its source: "the U.S. Census Bureau's cartographic state boundary". */
    describedAs: string;
    /** What this boundary is and is not, in North Ground's words. */
    statedAs: string;
  };
  /** Bracketed, never a figure: within `marginMetres` of the line, clear of it, or not measured. */
  proximity: "CLEAR" | "NEAR_LINE" | "NOT_MEASURED";
  marginMetres: number;
  /** Where hunting jurisdiction and the drawn extent are known to differ, said rather than smoothed. */
  knownDifferences: string[];
}

import type { HarvestLimit } from "./regulatory/harvest-limit.ts";

/**
 * A season's boundaries, discriminated by whether the source resolved them to
 * dates or published them as a recurring annual rule.
 *
 * ABSOLUTE carries real ISO dates and is what a producer that HAS a year must
 * emit: `federal.ts` previously held a full ISO date and sliced the year off it,
 * which was pure loss and is now a compile error, because an `IsoDate` is not a
 * `SeasonAnchor`.
 */
export type SeasonDates =
  | { kind: "ABSOLUTE"; opens: IsoDate; closes: IsoDate }
  | { kind: "ANNUAL"; opens: SeasonAnchor; closes: SeasonAnchor };

/**
 * ONE SEASON THAT EXISTS IN THIS PLACE, WITH THE AUTHORITY'S WORDS KEPT APART
 * FROM OURS.
 *
 * A CLOSED answer lists the seasons that DO exist here, so a hunter knows what
 * they missed. That listing was built as one string — North Ground's framing
 * spliced together with the authority's own wording and joined into an English
 * sentence. Measured on Québec, 10 of 10 sampled CLOSED answers read like:
 *
 *   "No american black bear season in Zone 10 West is open on this date for any
 *    licence or equipment. Seasons open to any licence here: armes à feu,
 *    arbalète et arc, 2026 Du 15 mai au 30 juin 2026."
 *
 * « Du 15 mai au 30 juin 2026 » is the ministry's own wording, carried with no
 * language and no owner, inside a sentence North Ground wrote. §41A requires an
 * authority's words to be QUOTED and tagged, never spliced; and measured across
 * the corpus the authority's wording reached 0 of 4,138 CLOSED answers in any
 * structured form, though the bundles hold it with its source and section.
 *
 * Which part belongs to whom is DECLARED by the bundle, never inferred from the
 * prose: `seasonPhrase` is the authority's window wording and carries the
 * source and section that cite it, while `seasonLabel` is a bare year. Measured
 * over Québec's 186 rules: `seasonPhrase` is French in 184 of 184, and
 * `seasonLabel` in 0 of 186.
 */
export interface SeasonListing {
  /** The authority's own wording for the window. Verbatim, never translated. */
  stated: AuthorityQuotation;
  /**
   * The season's heading as the engine composes it, OWNERSHIP UNDECLARED — so
   * it is not rendered as anyone's words.
   *
   * It looked like North Ground's framing and is not. Québec's adapter builds it
   * from `implementLabelShort(rule.implementLabel)`, the ministry's own word for
   * the youth weekend, and the bare year, joined with commas
   * (`quebec.ts:239-246`) — so it reads "armes à feu, arbalète et arc, 2026",
   * which is mostly the ministry's French. Measuring the BUNDLE field said
   * French in 0 of 186; the runtime value is composed upstream, and the field's
   * shape was not the fact.
   *
   * It is kept so the sentence can be derived rather than authored, and it is
   * NOT tagged, because §47 says ownership is declared by the producer and never
   * guessed. Declaring it is the adapters' job and is not done yet; until then a
   * renderer must treat this as unclassified and show `stated` for quotation.
   */
  composedLabel?: string;
  /** North Ground's own framing: who the season is open to. */
  framing: { qualifiers: string[] };
}

export interface RegulatoryResult {
  status: RegulatoryStatus;
  summary: string;
  /**
   * The seasons that DO exist here, where the answer is that none is running
   * today — so a consumer can show what applies without parsing the sentence.
   *
   * Present on the non-RESOLVED answers that list them (CLOSED, CONFLICT and
   * the unsettled cases). The sentence in `summary` is derived from these
   * rather than authored beside them, so a listing and its citation cannot
   * drift apart — the same discipline `conditions` already follows.
   */
  seasonsHere?: SeasonListing[];
  /**
   * When the season runs, as the SOURCE expresses it.
   *
   * WHY THIS IS A UNION. It was `{ opens: string; closes: string }` with no
   * declared format, and two kinds of value were written into it. Three
   * producers write a resolved date — `ontario.ts:303`, `major-game.ts:509` and
   * `conditional-engine.ts:1299` all pass `*.opensIso`. The federal migratory
   * path wrote a bare `MM-DD` (`federal.ts`, via a `monthDay` helper), because a
   * federal season is published as a recurring annual rule and genuinely has no
   * year. Measured: 56 species — every federal migratory game bird — took that
   * path, and the Hunt Brief validator REJECTED them, because it validates the
   * field with an ISO-date check. A brief carrying "2026-09-15" parsed; the same
   * brief carrying "09-15" came back `{"status":"invalid"}`.
   *
   * The fix is not to invent a year. §41A: the source model wins over our
   * schema, and a recurring rule that is given a year is a different and false
   * claim. The fix is for the type to say which kind it is.
   *
   * ANNUAL reuses `SeasonAnchor` rather than a new month/day pair, because that
   * primitive already exists and already handles a case a fresh one would miss:
   * `{ month, lastDay: true }` for "the last day of February", which is not 28
   * in a leap year.
   *
   * A mixed season — an absolute opening with a recurring close — is not
   * representable, because no producer has one and it would mean nothing.
   *
   * Whether an ANNUAL window crosses the year end is DERIVED, never stored:
   * `seasonCrossesYear()` in `regulatory/season.ts` is its one home, so it
   * cannot drift from the boundaries it describes. Mallard runs 19 September to
   * 3 January, so comparing the two as plain strings inverts the window — which
   * is exactly what a bare-string field invited.
   */
  season?: SeasonDates & {
    datesInclusive: boolean;
    /**
     * The AUTHORITY'S OWN NAME for this season segment — « Armes à feu et à
     * air comprimé, arbalète et arc ».
     *
     * The only fact in the old status paragraph that lived nowhere else, so
     * the paragraph could not be deleted without taking it: nothing is deleted
     * whose fact has nowhere else to go. It is here so the paragraph can go.
     *
     * Marked AUTHORITY so a renderer QUOTES it rather than paraphrasing, and
     * `lang` so it is tagged rather than translated. Never normalised: not
     * translated, not reformatted, "2026-2027" left exactly as the ministry
     * writes it.
     */
    label?: { text: string; lang: "en-CA" | "fr-CA"; owner: "AUTHORITY" };
  };
  /**
   * When the next season opens. REQUIRED, and a discriminated union, because
   * "closed until further notice" and "we do not know" must not share a
   * representation — see `NextSeason`. Every producer states which it means.
   */
  next: NextSeason;
  /**
   * Daily and possession, in the original shape. Both are required here, so a
   * SEASON limit cannot be expressed — which is why `harvestLimits` exists.
   * Retained until every consumer has moved; new readers use `harvestLimits`.
   *
   * @deprecated Read `harvestLimits`, which carries the limit KIND.
   */
  limits?: { daily: number; possession: number; combinedWith?: string };
  /**
   * Every harvest limit the authority states, with its KIND as a dimension.
   *
   * A limit's kind is not interchangeable: daily, season and possession are
   * different rules, and the old pair made a season limit inexpressible. Absent
   * kinds mean the authority does not state them — never that they are unknown,
   * and never a licence to derive one from another.
   */
  harvestLimits?: HarvestLimit[];
  /**
   * The legal hunting window, resolved where North Ground can resolve it and
   * NOT_CERTIFIED (naming the authority) where it cannot. One field and one
   * type: the prose a caller needs is DERIVED from it by `legalTimeSummary`,
   * so the words and the window cannot disagree.
   */
  legalTime: LegalTimeResult;
  /**
   * What a prevailing within-zone instrument says about this place, one state
   * per FACT.
   *
   * Three facts and never one verdict, because they are not interchangeable: a
   * no-shooting area leaves the season running and may not reach a bow, while
   * no-open-season closes it for every method. Collapsing them is wrong in
   * both directions at once.
   *
   * `closesSeasonHere` is stated rather than inferred by a reader, and it is
   * the assertion the engine makes: a renderer must not derive a closure from
   * the presence of restrictions. Absent where the jurisdiction has no such
   * instrument.
   */
  withinZoneRestrictions?: WithinZoneRestrictionFacts;
  /**
   * The conditions on this hunt, each with its own provenance.
   *
   * Absent where the producer enumerates none — which is a real and common
   * answer, not a gap, and is exactly what stops "in season, with conditions"
   * being said when there is nothing to name. See `condition.ts`.
   */
  conditions?: RegulatoryCondition[];
  /**
   * The same conditions, flattened to one string per line.
   *
   * DERIVED from `conditions` by `conditionLine`, never authored beside it, so
   * the sentence and the fields cannot disagree. Kept because the zone card,
   * the Hunt Brief and the long-form detail all read it and none of them needs
   * the structure; a surface that wants to group by source reads `conditions`.
   */
  requirements: string[];
  /**
   * What limits or qualifies this answer, each carrying what KIND of statement
   * it is. Classified by the author of the string; see `limitation.ts`.
   */
  limitations: Limitation[];
  sourceIds: CanonicalId<"source">[];
  verifiedAt: string;
  /**
   * How the seasons behind this answer are licensed — hunt codes, draw or over
   * the counter — where the jurisdiction allocates them that way. Regulatory
   * availability only; it never states what the hunter holds.
   */
  authorization?: AuthorizationContext;
}

export interface WeatherResult {
  status: "AVAILABLE" | "UNAVAILABLE" | "PROVIDER_ERROR";
  summary: string;
  date: IsoDate;
  temperatureMaxC?: number;
  temperatureMinC?: number;
  precipitationMm?: number;
  sunrise?: string;
  sunset?: string;
  timezone?: string;
  sourceId: CanonicalId<"source">;
}

/**
 * Whether the engine could finish, kept separate from what it concluded.
 *
 * `NEEDS_INPUT` means North Ground knows the applicable law and is missing a
 * fact from the hunter. `UNKNOWN` — a RegulatoryStatus — means North Ground does
 * not know the law here. Collapsing the two would turn "tell me your method"
 * into "we have no rules for this place", which is a different and much worse
 * statement.
 */
export type EvaluationCompleteness = "RESOLVED" | "NEEDS_INPUT";

export interface HuntEvaluation {
  input: HuntInput;
  species: { id: CanonicalId<"species">; name: string; canonicalPath: string };
  zone: ZoneResolution;
  completeness: EvaluationCompleteness;
  /** The one outstanding question. Present only when NEEDS_INPUT. */
  required?: RequiredDimension;
  /** Every fact this species and unit turn on, so the interface can show progress. */
  dimensions: RequiredDimension[];
  /**
   * The regulatory answer. While `completeness` is NEEDS_INPUT this carries a
   * placeholder whose status is the engine's own `NEEDS_VERIFICATION`, never a
   * status that reads as a decision.
   */
  regulation: RegulatoryResult;
  /**
   * The distinct legal harvest opportunities behind this answer, and where
   * there are none, WHY.
   *
   * §8's fundamental regulatory object is a legal harvest opportunity, not a
   * season: "antlered with a bow in October" and "either sex with a rifle in
   * November" are different opportunities that `regulation.season` flattens
   * into one date range. The engine computes them and `evaluate.ts` discarded
   * them by destructuring four of the outcome's six fields, so no consumer of
   * an evaluation could see one.
   *
   * ABSENCE CARRIES ITS REASON. A bare empty list would say "no opportunity
   * here", and measured on Ontario major game that would have been false for 35
   * answers — American black bear in WMUs 82A/83A/83B/83C/84 across 1–7 May
   * 2026 come back CONDITIONAL, which §41A paints green, from rules whose
   * published `seasonPhrase` the adapter cannot turn into a window. ENUMERATED
   * with no rows means none apply; NOT_ENUMERATED means the engine could not
   * say, which is neither open nor closed.
   */
  opportunities: OpportunityAvailability;
  weather: WeatherResult;
  knowledge: BlockResult;
  sources: SourceRecord[];
  /**
   * Ready to Hunt: the licences, hunter orange and legal methods this hunt
   * needs. Present only when the regulatory answer is CONDITIONAL. It is built
   * from this evaluation's own inputs and nothing else; a licence-vendor search
   * never feeds it.
   */
  readiness?: ReadinessResult;
  evaluatedAt: string;
}

/** How well North Ground can place a restricted area against this hunt. */
export type WithinZonePlacement =
  /** The authority's own list puts this area in this unit; where inside is open. */
  | "CONTAINED_BY_UNIT"
  /** No unit North Ground can match, or none it could resolve. Loud, never dropped. */
  | "UNPLACEABLE";

export interface WithinZoneArea {
  name: string;
  /** The authority's own words for what it restricts. */
  statedAs: string;
  /** Pinpoint: instrument, schedule and item. */
  citation: string;
  sourceId: string;
  placement: WithinZonePlacement;
  /** Why this could not be decided, where it could not. */
  because?: string;
}

export interface WithinZoneFactState {
  /** MAY_APPLY is not a weak APPLIES: it means it could not be placed. */
  state: "APPLIES" | "MAY_APPLY" | "NONE";
  areas: WithinZoneArea[];
  /** The instrument that governs, and the clause making it govern. */
  governedBy?: { citation: string; statedAs: string; sourceId: string };
}

export interface WithinZoneRestrictionFacts {
  /** Closes the season inside the area. */
  season: WithinZoneFactState;
  /** Forbids discharging; the season is untouched. */
  discharge: WithinZoneFactState;
  /** Ammunition or implement limits specific to the area. */
  ammunition: WithinZoneFactState;
  /**
   * Whether any of it actually closes the season HERE.
   *
   * Stated by the engine so no renderer has to decide it. False while the
   * restricted areas cannot be placed — which is every one of them today.
   */
  closesSeasonHere: boolean;
}
