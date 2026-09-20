import type { BlockResult, CanonicalId, IsoDate, SourceRecord } from "../content-contract/index.ts";

export type RegulatoryStatus = "OPEN" | "CLOSED" | "CONDITIONAL" | "UNKNOWN" | "CONFLICT" | "NEEDS_VERIFICATION";

export interface HuntInput {
  latitude: number;
  longitude: number;
  date: IsoDate;
  speciesId: CanonicalId<"species">;
}

export interface ZoneResolution {
  status: "RESOLVED" | "UNKNOWN" | "PROVIDER_ERROR";
  zoneId?: CanonicalId<"management_zone">;
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

export interface HuntEvaluation {
  input: HuntInput;
  species: { id: CanonicalId<"species">; name: string; canonicalPath: string };
  zone: ZoneResolution;
  regulation: RegulatoryResult;
  weather: WeatherResult;
  knowledge: BlockResult;
  sources: SourceRecord[];
  evaluatedAt: string;
}
