import { CANADA_JURISDICTIONS } from "../canada/registry.ts";
import type { RegulatoryResult, ZoneResolution } from "../types.ts";
import { resolveOntarioReadiness } from "./ontario.ts";
import type { HunterAnswers } from "./resolve.ts";
import type { ReadinessResult } from "./types.ts";

export type { ReadinessResult } from "./types.ts";

const RESIDENCIES = new Set(["RESIDENT", "NON_RESIDENT"]);
const METHODS = new Set(["RIFLE", "SHOTGUN", "MUZZLELOADER", "BOW", "CROSSBOW", "AIR_GUN"]);

/**
 * Only answers the checklist understands reach it. The request handler checks
 * answers for shape, not meaning; an unrecognised residency would otherwise
 * match no fee and no requirement and read as "nothing applies to you".
 * Anything unrecognised is treated as not yet answered.
 */
export function readinessAnswers(answers: HunterAnswers | undefined): HunterAnswers {
  const clean: HunterAnswers = {};
  if (answers?.RESIDENCY && RESIDENCIES.has(answers.RESIDENCY)) clean.RESIDENCY = answers.RESIDENCY;
  if (answers?.HUNT_METHOD && METHODS.has(answers.HUNT_METHOD)) clean.HUNT_METHOD = answers.HUNT_METHOD;
  if (typeof answers?.TAG_TYPE === "string" && /^[A-Z_]{1,40}$/.test(answers.TAG_TYPE)) clean.TAG_TYPE = answers.TAG_TYPE;
  return clean;
}

/**
 * Whether a hunt gets a Ready to Hunt checklist, and whose.
 *
 * Only a hunt the law permits gets one. "Ready to hunt" beside CLOSED would
 * read as an invitation, and beside UNKNOWN or NEEDS_VERIFICATION it would imply
 * North Ground knows the hunt is possible when it does not. So the checklist
 * appears only for a CONDITIONAL answer — the status Hunt gives a hunt that is
 * open subject to the hunter's own licensing and the law's conditions.
 *
 * A jurisdiction without a checklist says so and links to the authority's own
 * source, rather than showing an empty card that could read as "nothing needed".
 */
export function resolveReadiness(
  input: { speciesId: string; date: string; answers?: HunterAnswers },
  zone: ZoneResolution,
  regulation: RegulatoryResult,
  options: { now?: Date; fallbackInfoUrl?: string } = {},
): ReadinessResult | undefined {
  if (regulation.status !== "CONDITIONAL") return undefined;
  if (zone.status !== "RESOLVED" || !zone.zoneId || !zone.jurisdictionId) return undefined;

  if (zone.jurisdictionId === "jurisdiction:ca-on") {
    return resolveOntarioReadiness(
      { speciesId: input.speciesId, date: input.date, zoneId: String(zone.zoneId), answers: readinessAnswers(input.answers) },
      options.now,
    );
  }

  const jurisdiction = CANADA_JURISDICTIONS.find((entry) => entry.id === zone.jurisdictionId);
  return {
    coverage: "UNAVAILABLE",
    jurisdictionName: jurisdiction?.nameEn ?? "this jurisdiction",
    // The source this hunt's certified answer already cites — never an invented link.
    officialInfoUrl: options.fallbackInfoUrl ?? "",
    authorizations: [],
    limitations: [
      `North Ground has not built a Ready to Hunt checklist for ${jurisdiction?.nameEn ?? "this jurisdiction"} yet. ` +
        "Check the authority's official requirements for licences, hunter orange and legal methods before you go.",
    ],
  };
}
