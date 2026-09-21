import type { BlockResult, CanonicalId, IsoDate, SourceRecord } from "../content-contract/index.ts";
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
  displayRings?: number[][][];
  sourceId: CanonicalId<"source">;
  message: string;
}

export interface RegulatoryResult {
  status: RegulatoryStatus;
  summary: string;
  season?: { opens: string; closes: string; datesInclusive: boolean };
  limits?: { daily: number; possession: number; combinedWith?: string };
  legalTime: { status: "RULE_ONLY" | "NOT_AVAILABLE"; text: string };
  requirements: string[];
  limitations: string[];
  sourceIds: CanonicalId<"source">[];
  verifiedAt: string;
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
