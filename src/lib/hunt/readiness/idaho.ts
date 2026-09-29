import { authorizationRows } from "./requirements.ts";
import { resolveAuthorizations, type HunterAnswers } from "./resolve.ts";
import type { AuthorizationRecord, AuthorizationRequirement, Provenance, ReadinessResult } from "./types.ts";

const REGULATIONS = "https://idfg.idaho.gov/sites/default/files/seasons-rules-big-game-2026.pdf";
const CONTROLLED_HUNTS = "https://idfg.idaho.gov/licenses/tag/controlled";
const SOURCE_ID = "source:us-id-big-game-seasons-2026";
const AUTHORITY = "Idaho Department of Fish and Game";

const requirementProvenance: Provenance = {
  sourceId: SOURCE_ID,
  url: REGULATIONS,
  citation: "Idaho Big Game 2026 Seasons and Rules, p. 63",
  tier: "OFFICIAL_SUMMARY",
  retrievedAt: "2026-09-29",
};

const huntingLicence: AuthorizationRecord = {
  id: "authorization:us-id-hunting-license",
  kind: "HUNTING_LICENCE",
  officialName: "Idaho hunting license",
  authority: AUTHORITY,
  jurisdictionId: "jurisdiction:us-id",
  appliesTo: {},
  effectiveFrom: "2026-01-01",
  effectiveTo: "2026-12-31",
  prerequisites: [],
  possessionVerifiable: false,
  purchase: {
    channels: ["ONLINE", "PHONE", "PHYSICAL_VENDOR"],
    phone: "1-800-554-8685",
    infoUrl: CONTROLLED_HUNTS,
  },
  prices: [],
  provenance: [requirementProvenance],
  note: "North Ground cannot verify whether you hold this license.",
};

const controlledHuntTag: AuthorizationRecord = {
  id: "authorization:us-id-controlled-hunt-tag",
  kind: "DRAW_AUTHORIZATION",
  officialName: "controlled hunt tag",
  authority: AUTHORITY,
  jurisdictionId: "jurisdiction:us-id",
  appliesTo: {},
  effectiveFrom: "2026-01-01",
  effectiveTo: "2026-12-31",
  prerequisites: [huntingLicence.id],
  draw: {
    required: true,
    infoUrl: CONTROLLED_HUNTS,
    note: "Pronghorn tags are allocated through the controlled-hunt process; North Ground cannot see drawing results or what you hold.",
  },
  possessionVerifiable: false,
  purchase: {
    channels: ["DRAW", "ONLINE", "PHONE", "PHYSICAL_VENDOR"],
    phone: "1-800-554-8685",
    infoUrl: CONTROLLED_HUNTS,
  },
  prices: [],
  provenance: [requirementProvenance],
};

const RECORDS = new Map<string, AuthorizationRecord>([
  [huntingLicence.id, huntingLicence],
  [controlledHuntTag.id, controlledHuntTag],
]);

const REQUIREMENTS: AuthorizationRequirement[] = [
  { authorizationId: huntingLicence.id, provenance: [requirementProvenance] },
  { authorizationId: controlledHuntTag.id, provenance: [requirementProvenance] },
];

export const IDAHO_READINESS_SPECIES = ["species:pronghorn"] as const;

/** The certified portion of Idaho Ready to Hunt: licence + controlled-hunt tag. */
export function resolveIdahoReadiness(
  input: { speciesId: string; date: string; zoneId: string; answers: HunterAnswers },
): ReadinessResult {
  const base = { jurisdictionName: "Idaho", officialInfoUrl: CONTROLLED_HUNTS };
  if (!IDAHO_READINESS_SPECIES.includes(input.speciesId as never)) {
    return {
      ...base,
      coverage: "UNAVAILABLE",
      authorizations: [],
      limitations: ["North Ground has built Idaho Ready to Hunt only for its certified 2026 pronghorn path."],
    };
  }

  const authorizations = resolveAuthorizations(REQUIREMENTS, RECORDS, {
    answers: input.answers,
    licenceYearToday: Number(input.date.slice(0, 4)),
  });
  return {
    ...base,
    coverage: "PARTIAL",
    authorizations,
    requirements: authorizationRows(authorizations, CONTROLLED_HUNTS),
    limitations: [
      "Fees are not shown because North Ground has not certified the current amount for this hunter's category.",
      "Idaho method validations, hunter education, hunter orange, legal methods and ammunition are not yet certified in Ready to Hunt. Check the current official rules before you go.",
      "North Ground cannot verify drawing results, licences, tags or permits you hold.",
    ],
  };
}
