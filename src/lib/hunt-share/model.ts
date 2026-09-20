import {
  isCanonicalId,
  isCanonicalIdOf,
  type CanonicalId,
  type EntityType,
} from "../content-contract/index.ts";

export const HUNT_BRIEF_SCHEMA_VERSION = 1 as const;
export const HUNT_BRIEF_STATUSES = [
  "OPEN",
  "CLOSED",
  "CONDITIONAL",
  "UNKNOWN",
  "CONFLICT",
  "NEEDS_VERIFICATION",
] as const;

export type HuntBriefStatus = (typeof HUNT_BRIEF_STATUSES)[number];

export interface HuntShareProjectionInput {
  species: {
    id: CanonicalId<"species">;
    displayName: string;
  };
  jurisdiction: {
    id: CanonicalId<"jurisdiction">;
    displayName: string;
  };
  managementZone?: {
    id: CanonicalId<"management_zone">;
    displayName: string;
  };
  selectedDate: string;
  regulatory: {
    status: HuntBriefStatus;
    summary: string;
    verifiedAt?: string;
    sourceDataVersion?: string;
    season?: {
      opens: string;
      closes: string;
      datesInclusive: boolean;
    };
  };
  legalTime?: {
    summary: string;
    verified: boolean;
    verifiedAt?: string;
    status?: "RULE_ONLY" | "NOT_AVAILABLE";
  };
  weather?:
    | {
      status: "available";
      summary: string;
      asOf: string;
      validFor?: string;
      }
    | {
        status: "unavailable";
        reason: string;
      }
    | {
        status: "provider_error";
        reason: string;
      };
  warnings?: string[];
  officialSources?: Array<{
    id?: CanonicalId<"source">;
    authority: string;
    title: string;
    url: string;
    verifiedAt?: string;
    effectiveDate?: string;
  }>;
  resourceReferences?: Array<{
    id: CanonicalId;
    title: string;
    href?: string;
  }>;
  location?: {
    generalLabel?: string;
    shareApproved?: boolean;
    latitude?: number;
    longitude?: number;
    rawInput?: string;
    postalCode?: string;
    address?: string;
  };
  privateContext?: unknown;
}

export interface ShareHuntBriefV1 {
  version: typeof HUNT_BRIEF_SCHEMA_VERSION;
  shareId: string;
  createdAt: string;
  species: {
    id: CanonicalId<"species">;
    displayName: string;
  };
  jurisdiction: {
    id: CanonicalId<"jurisdiction">;
    displayName: string;
  };
  managementZone?: {
    id: CanonicalId<"management_zone">;
    displayName: string;
  };
  selectedDate: string;
  generalLocationLabel?: string;
  regulatory: {
    status: HuntBriefStatus;
    summary: string;
    verifiedAt?: string;
    sourceDataVersion?: string;
    season?: {
      opens: string;
      closes: string;
      datesInclusive: boolean;
    };
  };
  legalTime?: {
    status: "RULE_ONLY" | "NOT_AVAILABLE";
    summary: string;
    verifiedAt: string;
  };
  weatherSnapshot?:
    | {
      status: "available";
      summary: string;
      asOf: string;
      validFor?: string;
      }
    | {
        status: "unavailable";
        reason: string;
      }
    | {
        status: "provider_error";
        reason: string;
      };
  warnings: string[];
  officialSources: Array<{
    id?: CanonicalId<"source">;
    authority: string;
    title: string;
    url: string;
    verifiedAt?: string;
    effectiveDate?: string;
  }>;
  resourceReferences: Array<{
    id: CanonicalId;
    title: string;
    href?: string;
  }>;
}

export type ShareHuntBrief = ShareHuntBriefV1;

export class HuntBriefValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HuntBriefValidationError";
  }
}

const STATUS_SET = new Set<string>(HUNT_BRIEF_STATUSES);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SHARE_ID = /^[A-Za-z0-9_-]{22,32}$/;

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HuntBriefValidationError(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string, max: number): string {
  if (typeof value !== "string") throw new HuntBriefValidationError(`${field} must be text`);
  const normalized = value.normalize("NFKC").trim();
  if (!normalized || normalized.length > max || /[<>\u0000-\u001F\u007F]/u.test(normalized)) {
    throw new HuntBriefValidationError(`${field} is invalid`);
  }
  return normalized;
}

function optionalText(value: unknown, field: string, max: number): string | undefined {
  return value === undefined ? undefined : text(value, field, max);
}

function timestamp(value: unknown, field: string): string {
  const candidate = text(value, field, 40);
  if (!Number.isFinite(Date.parse(candidate))) {
    throw new HuntBriefValidationError(`${field} must be an ISO timestamp`);
  }
  return new Date(candidate).toISOString();
}

function optionalTimestamp(value: unknown, field: string): string | undefined {
  return value === undefined ? undefined : timestamp(value, field);
}

function date(value: unknown, field: string): string {
  const candidate = text(value, field, 10);
  const parsed = new Date(`${candidate}T00:00:00Z`);
  if (
    !ISO_DATE.test(candidate) ||
    Number.isNaN(parsed.valueOf()) ||
    parsed.toISOString().slice(0, 10) !== candidate
  ) {
    throw new HuntBriefValidationError(`${field} must be an ISO date`);
  }
  return candidate;
}

function canonicalId<T extends EntityType>(
  value: unknown,
  field: string,
  expectedType: T,
): CanonicalId<T>;
function canonicalId(value: unknown, field: string): CanonicalId;
function canonicalId(value: unknown, field: string, expectedType?: EntityType): CanonicalId {
  if (
    typeof value !== "string" ||
    !isCanonicalId(value) ||
    (expectedType !== undefined && !isCanonicalIdOf(value, expectedType))
  ) {
    throw new HuntBriefValidationError(`${field} must be a canonical ID`);
  }
  return value;
}

function httpsUrl(value: unknown, field: string): string {
  const candidate = text(value, field, 500);
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new HuntBriefValidationError(`${field} must be an absolute URL`);
  }
  if (url.protocol !== "https:") throw new HuntBriefValidationError(`${field} must use HTTPS`);
  url.username = "";
  url.password = "";
  url.hash = "";
  return url.toString();
}

function resourceHref(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  const candidate = text(value, field, 500);
  if (candidate.startsWith("/") && !candidate.startsWith("//")) return candidate;
  return httpsUrl(candidate, field);
}

function strings(value: unknown, field: string, limit: number, max: number): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > limit) {
    throw new HuntBriefValidationError(`${field} has too many entries`);
  }
  return value.map((item, index) => text(item, `${field}[${index}]`, max));
}

function status(value: unknown): HuntBriefStatus {
  if (typeof value !== "string" || !STATUS_SET.has(value)) {
    throw new HuntBriefValidationError("regulatory.status is unsupported");
  }
  return value as HuntBriefStatus;
}

function parseSources(value: unknown): ShareHuntBriefV1["officialSources"] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 12) {
    throw new HuntBriefValidationError("officialSources has too many entries");
  }
  return value.map((item, index) => {
    const source = record(item, `officialSources[${index}]`);
    return {
      id: source.id === undefined ? undefined : canonicalId(source.id, `officialSources[${index}].id`, "source"),
      authority: text(source.authority, `officialSources[${index}].authority`, 120),
      title: text(source.title, `officialSources[${index}].title`, 180),
      url: httpsUrl(source.url, `officialSources[${index}].url`),
      verifiedAt: optionalTimestamp(source.verifiedAt, `officialSources[${index}].verifiedAt`),
      effectiveDate: optionalText(source.effectiveDate, `officialSources[${index}].effectiveDate`, 80),
    };
  });
}

function parseResources(value: unknown): ShareHuntBriefV1["resourceReferences"] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 8) {
    throw new HuntBriefValidationError("resourceReferences has too many entries");
  }
  return value.map((item, index) => {
    const resource = record(item, `resourceReferences[${index}]`);
    return {
      id: canonicalId(resource.id, `resourceReferences[${index}].id`),
      title: text(resource.title, `resourceReferences[${index}].title`, 140),
      href: resourceHref(resource.href, `resourceReferences[${index}].href`),
    };
  });
}

function parseWeather(value: unknown): ShareHuntBriefV1["weatherSnapshot"] {
  if (value === undefined) return undefined;
  const weather = record(value, "weather");
  if (weather.status === "available") {
    return {
      status: "available",
      summary: text(weather.summary, "weather.summary", 280),
      asOf: timestamp(weather.asOf, "weather.asOf"),
      validFor: weather.validFor === undefined ? undefined : date(weather.validFor, "weather.validFor"),
    };
  }
  if (weather.status === "unavailable") {
    return {
      status: "unavailable",
      reason: text(weather.reason, "weather.reason", 200),
    };
  }
  if (weather.status === "provider_error") {
    return {
      status: "provider_error",
      reason: text(weather.reason, "weather.reason", 200),
    };
  }
  throw new HuntBriefValidationError("weather.status is unsupported");
}

export function createShareableHuntBrief(
  inputValue: HuntShareProjectionInput | unknown,
  context: { shareId: string; createdAt: string },
): ShareHuntBriefV1 {
  const input = record(inputValue, "huntResult");
  const species = record(input.species, "species");
  const jurisdiction = record(input.jurisdiction, "jurisdiction");
  const zone = input.managementZone === undefined ? undefined : record(input.managementZone, "managementZone");
  const regulatory = record(input.regulatory, "regulatory");
  const season = regulatory.season === undefined ? undefined : record(regulatory.season, "regulatory.season");
  const location = input.location === undefined ? undefined : record(input.location, "location");
  const legalTime = input.legalTime === undefined ? undefined : record(input.legalTime, "legalTime");

  if (!SHARE_ID.test(context.shareId)) throw new HuntBriefValidationError("shareId is invalid");

  const brief: ShareHuntBriefV1 = {
    version: HUNT_BRIEF_SCHEMA_VERSION,
    shareId: context.shareId,
    createdAt: timestamp(context.createdAt, "createdAt"),
    species: {
      id: canonicalId(species.id, "species.id", "species"),
      displayName: text(species.displayName, "species.displayName", 100),
    },
    jurisdiction: {
      id: canonicalId(jurisdiction.id, "jurisdiction.id", "jurisdiction"),
      displayName: text(jurisdiction.displayName, "jurisdiction.displayName", 120),
    },
    managementZone: zone
      ? {
          id: canonicalId(zone.id, "managementZone.id", "management_zone"),
          displayName: text(zone.displayName, "managementZone.displayName", 100),
        }
      : undefined,
    selectedDate: date(input.selectedDate, "selectedDate"),
    generalLocationLabel:
      location?.shareApproved === true
        ? optionalText(location.generalLabel, "location.generalLabel", 120)
        : undefined,
    regulatory: {
      status: status(regulatory.status),
      summary: text(regulatory.summary, "regulatory.summary", 700),
      verifiedAt: optionalTimestamp(regulatory.verifiedAt, "regulatory.verifiedAt"),
      sourceDataVersion: optionalText(regulatory.sourceDataVersion, "regulatory.sourceDataVersion", 120),
      season: season
        ? {
            opens: date(season.opens, "regulatory.season.opens"),
            closes: date(season.closes, "regulatory.season.closes"),
            datesInclusive: season.datesInclusive === true,
          }
        : undefined,
    },
    legalTime:
      legalTime?.verified === true
        ? {
            status: legalTime.status === "NOT_AVAILABLE" ? "NOT_AVAILABLE" : "RULE_ONLY",
            summary: text(legalTime.summary, "legalTime.summary", 280),
            verifiedAt: timestamp(legalTime.verifiedAt, "legalTime.verifiedAt"),
          }
        : undefined,
    weatherSnapshot: parseWeather(input.weather),
    warnings: strings(input.warnings, "warnings", 8, 300),
    officialSources: parseSources(input.officialSources),
    resourceReferences: parseResources(input.resourceReferences),
  };

  return brief;
}

export type StoredHuntBriefResult =
  | { status: "found"; brief: ShareHuntBriefV1 }
  | { status: "unsupported_version"; version: number | null }
  | { status: "invalid" };

export function parseStoredHuntBrief(value: unknown): StoredHuntBriefResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { status: "invalid" };
  const candidate = value as Record<string, unknown>;
  if (candidate.version !== HUNT_BRIEF_SCHEMA_VERSION) {
    return {
      status: "unsupported_version",
      version: typeof candidate.version === "number" ? candidate.version : null,
    };
  }

  try {
    const legalTime = candidate.legalTime === undefined ? undefined : record(candidate.legalTime, "legalTime");
    const brief = createShareableHuntBrief({
      species: candidate.species,
      jurisdiction: candidate.jurisdiction,
      managementZone: candidate.managementZone,
      selectedDate: candidate.selectedDate,
      location: candidate.generalLocationLabel === undefined
        ? undefined
        : { generalLabel: candidate.generalLocationLabel, shareApproved: true },
      regulatory: candidate.regulatory,
      legalTime: legalTime === undefined
        ? undefined
        : {
            status: legalTime.status,
            summary: legalTime.summary,
            verifiedAt: legalTime.verifiedAt,
            verified: true,
          },
      weather: candidate.weatherSnapshot,
      warnings: candidate.warnings,
      officialSources: candidate.officialSources,
      resourceReferences: candidate.resourceReferences,
    }, {
      shareId: text(candidate.shareId, "shareId", 32),
      createdAt: timestamp(candidate.createdAt, "createdAt"),
    });
    return { status: "found", brief };
  } catch {
    return { status: "invalid" };
  }
}

export function isValidHuntBriefShareId(value: string): boolean {
  return SHARE_ID.test(value);
}
