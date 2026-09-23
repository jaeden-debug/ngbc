import type { NextSeason } from "./regulatory/season.ts";
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
  message: string;
}

import type { HarvestLimit } from "./regulatory/harvest-limit.ts";

export interface RegulatoryResult {
  status: RegulatoryStatus;
  summary: string;
  season?: {
    opens: string;
    closes: string;
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
