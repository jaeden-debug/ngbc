import {
  isCanonicalId,
  isCanonicalIdOf,
  type CanonicalId,
  type EntityType,
} from "../content-contract/index.ts";

/**
 * Version 3 adds `readiness`: a compact Ready to Hunt checklist — the licences,
 * hunter orange and legal methods the hunt needs, as the result showed them.
 * It deliberately has no field for a licence vendor or any location: vendor
 * search is a private, on-device aid and never part of a shared brief.
 *
 * Version 2 adds `assumptions`.
 *
 * A major-game result depends on facts the hunter supplied — residency, the
 * implement carried, the tag drawn. A snapshot that recorded only the status
 * would show "CONDITIONAL, season open 2-15 November" to a reader whose own
 * answers would have produced a different rule, or no season at all. So the
 * assumptions travel with the result, labelled as the hunter's own statements.
 *
 * Version 1 briefs are still read exactly as written. They were created when
 * every certified species answered from location and date alone, so they carry
 * no assumptions and none are invented for them.
 */
export const HUNT_BRIEF_SCHEMA_VERSION = 3 as const;
export const READABLE_HUNT_BRIEF_VERSIONS = [1, 2, 3] as const;
export type HuntBriefSchemaVersion = (typeof READABLE_HUNT_BRIEF_VERSIONS)[number];
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
  assumptions?: Array<{ question: string; answer: string }>;
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
  readiness?: HuntBriefReadiness;
}

export const HUNT_BRIEF_READINESS_STATUSES = ["REQUIRED", "NOT_REQUIRED", "CONDITIONAL", "UNKNOWN"] as const;
export type HuntBriefReadinessStatus = (typeof HUNT_BRIEF_READINESS_STATUSES)[number];

/**
 * Ready to Hunt as a brief carries it. Every field is display text already
 * decided by the engine; the brief restates it and never re-derives it.
 */
export interface HuntBriefReadiness {
  coverage: "VERIFIED" | "PARTIAL" | "UNAVAILABLE";
  jurisdictionName: string;
  officialInfoUrl?: string;
  authorizations: Array<{
    status: "REQUIRED" | "CONDITIONAL" | "UNKNOWN";
    name: string;
    authority: string;
    condition?: string;
    fee?: string;
  }>;
  orange?: { status: HuntBriefReadinessStatus; summary: string };
  /** Legal methods for this hunt, as labels. North Ground's recommendations are not carried. */
  legalMethods: string[];
}

/** A fact the hunter supplied, recorded as theirs rather than as verified. */
export interface HuntBriefAssumption {
  question: string;
  answer: string;
}

export interface ShareHuntBrief {
  version: HuntBriefSchemaVersion;
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
  /**
   * What the hunter told us, which selected the rule this result came from.
   * Empty for a species that asks nothing, and for every version 1 brief.
   */
  assumptions: HuntBriefAssumption[];
  /** Present on version 3 briefs whose result had a Ready to Hunt checklist. */
  readiness?: HuntBriefReadiness;
}

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

function parseAssumptions(value: unknown): HuntBriefAssumption[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 6) {
    throw new HuntBriefValidationError("assumptions has too many entries");
  }
  return value.map((item, index) => {
    const assumption = record(item, `assumptions[${index}]`);
    return {
      question: text(assumption.question, `assumptions[${index}].question`, 200),
      answer: text(assumption.answer, `assumptions[${index}].answer`, 120),
    };
  });
}

const READINESS_STATUS_SET = new Set<string>(HUNT_BRIEF_READINESS_STATUSES);
const AUTHORIZATION_STATUS_SET = new Set(["REQUIRED", "CONDITIONAL", "UNKNOWN"]);
const COVERAGE_SET = new Set(["VERIFIED", "PARTIAL", "UNAVAILABLE"]);

function oneOf<T extends string>(value: unknown, allowed: Set<string>, field: string): T {
  if (typeof value !== "string" || !allowed.has(value)) throw new HuntBriefValidationError(`${field} is unsupported`);
  return value as T;
}

/**
 * Only the named fields are copied. Anything else a client sends — a vendor, a
 * device position, a coordinate — is dropped, so the brief cannot carry it.
 */
function parseReadiness(value: unknown): HuntBriefReadiness | undefined {
  if (value === undefined) return undefined;
  const readiness = record(value, "readiness");
  const items = readiness.authorizations;
  if (!Array.isArray(items) || items.length > 12) throw new HuntBriefValidationError("readiness.authorizations has too many entries");
  const orange = readiness.orange === undefined ? undefined : record(readiness.orange, "readiness.orange");
  return {
    coverage: oneOf(readiness.coverage, COVERAGE_SET, "readiness.coverage"),
    jurisdictionName: text(readiness.jurisdictionName, "readiness.jurisdictionName", 120),
    officialInfoUrl: readiness.officialInfoUrl === undefined ? undefined : httpsUrl(readiness.officialInfoUrl, "readiness.officialInfoUrl"),
    authorizations: items.map((item, index) => {
      const entry = record(item, `readiness.authorizations[${index}]`);
      return {
        status: oneOf(entry.status, AUTHORIZATION_STATUS_SET, `readiness.authorizations[${index}].status`),
        name: text(entry.name, `readiness.authorizations[${index}].name`, 160),
        authority: text(entry.authority, `readiness.authorizations[${index}].authority`, 120),
        condition: optionalText(entry.condition, `readiness.authorizations[${index}].condition`, 300),
        fee: optionalText(entry.fee, `readiness.authorizations[${index}].fee`, 80),
      };
    }),
    orange: orange
      ? {
          status: oneOf(orange.status, READINESS_STATUS_SET, "readiness.orange.status"),
          summary: text(orange.summary, "readiness.orange.summary", 400),
        }
      : undefined,
    legalMethods: strings(readiness.legalMethods, "readiness.legalMethods", 8, 320),
  };
}

function parseSources(value: unknown): ShareHuntBrief["officialSources"] {
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

function parseResources(value: unknown): ShareHuntBrief["resourceReferences"] {
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

function parseWeather(value: unknown): ShareHuntBrief["weatherSnapshot"] {
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
  context: { shareId: string; createdAt: string; version?: HuntBriefSchemaVersion },
): ShareHuntBrief {
  const input = record(inputValue, "huntResult");
  const species = record(input.species, "species");
  const jurisdiction = record(input.jurisdiction, "jurisdiction");
  const zone = input.managementZone === undefined ? undefined : record(input.managementZone, "managementZone");
  const regulatory = record(input.regulatory, "regulatory");
  const season = regulatory.season === undefined ? undefined : record(regulatory.season, "regulatory.season");
  const location = input.location === undefined ? undefined : record(input.location, "location");
  const legalTime = input.legalTime === undefined ? undefined : record(input.legalTime, "legalTime");

  if (!SHARE_ID.test(context.shareId)) throw new HuntBriefValidationError("shareId is invalid");

  const version = context.version ?? HUNT_BRIEF_SCHEMA_VERSION;
  /* A version 1 brief predates conditional species and cannot carry assumptions.
     Refusing them here stops a stored v1 record from acquiring context it never
     had, which would be exactly the silent reinterpretation this guards against. */
  const assumptions = version === 1 ? [] : parseAssumptions(input.assumptions);
  // Likewise, a brief from before Ready to Hunt never acquires a checklist.
  const readiness = version < 3 ? undefined : parseReadiness(input.readiness);

  const brief: ShareHuntBrief = {
    version,
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
    /* A warning is a regulatory requirement or limitation with its citation.
       Manitoba's CWD sampling requirement alone is 320 characters; a cap below
       real legal text refuses the whole brief, and truncating it would change
       what it says. */
    warnings: strings(input.warnings, "warnings", 8, 600),
    officialSources: parseSources(input.officialSources),
    resourceReferences: parseResources(input.resourceReferences),
    assumptions,
    ...(readiness ? { readiness } : {}),
  };

  return brief;
}

export type StoredHuntBriefResult =
  | { status: "found"; brief: ShareHuntBrief }
  | { status: "unsupported_version"; version: number | null }
  | { status: "invalid" };

export function parseStoredHuntBrief(value: unknown): StoredHuntBriefResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { status: "invalid" };
  const candidate = value as Record<string, unknown>;
  const storedVersion = candidate.version;
  if (
    typeof storedVersion !== "number" ||
    !(READABLE_HUNT_BRIEF_VERSIONS as readonly number[]).includes(storedVersion)
  ) {
    return {
      status: "unsupported_version",
      version: typeof storedVersion === "number" ? storedVersion : null,
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
      assumptions: candidate.assumptions,
      readiness: candidate.readiness,
    }, {
      shareId: text(candidate.shareId, "shareId", 32),
      createdAt: timestamp(candidate.createdAt, "createdAt"),
      version: storedVersion as HuntBriefSchemaVersion,
    });
    return { status: "found", brief };
  } catch {
    return { status: "invalid" };
  }
}

export function isValidHuntBriefShareId(value: string): boolean {
  return SHARE_ID.test(value);
}
