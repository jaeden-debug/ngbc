import { legalTimeNotCertified } from "./legal-time.ts";
import { general } from "../limitation.ts";
import type { CanonicalId } from "../../content-contract/index.ts";
import type { RegulatoryResult, ZoneResolution } from "../types.ts";
import { evaluateSeason, nextOpening, parseSeasonPhrase, type SeasonWindow } from "./season.ts";
import bundle from "../../../../content/regulatory/ca-on-small-game-2026.json" with { type: "json" };

/**
 * Ontario small-game regulatory evaluation.
 *
 * Every answer here comes from `content/regulatory/ca-on-small-game-2026.json`,
 * which is generated from the province's published summary rather than written by
 * hand. Nothing in this file encodes a season, a limit or a unit list: it reads
 * what the authority stated and decides where the requested date falls.
 *
 * The distinctions this preserves, all of which a simpler implementation loses:
 *
 *  - A unit no season row mentions is UNKNOWN, not CLOSED. Absence from an
 *    open-season table is not a statement that the season is closed.
 *  - A unit the source explicitly excludes IS closed, because the source says so.
 *  - A combined limit stays combined. Five birds shared between ruffed and spruce
 *    grouse is not five of each.
 *  - Two rules reaching the same unit is a CONFLICT to be reviewed, not a
 *    coin toss resolved by row order.
 */

interface BundleGroup {
  id: string;
  officialSpec: string;
  zoneIds: string[];
  officialIdentifiers: string[];
}

interface BundleRule {
  id: string;
  speciesId: string;
  regulatoryGroupId: string;
  seasonPhrase: string;
  limits: {
    daily: number;
    possession: number | null;
    combined: boolean;
    combinedWith: string[];
    combinedWithNames: string[];
    statedAs: string;
  };
  sourceId: string;
  sourceSection: string;
  sourceVersion: string;
  sourceYear: number;
  reviewStatus: string;
}

interface BundleNoSeason {
  speciesId: string;
  zoneIds: string[];
  statedAs: string;
  sourceId: string;
  sourceSection: string;
}

const GROUPS = new Map<string, BundleGroup>((bundle.groups as BundleGroup[]).map((group) => [group.id, group]));
const RULES = bundle.rules as BundleRule[];
const NO_SEASON = (bundle.declaredNoSeason ?? []) as BundleNoSeason[];
const SOURCE = bundle.source as { id: string; sourceVersion: string; retrievedAt: string };

/** Only rules the review lifecycle has cleared may produce a published answer. */
const PUBLISHABLE = new Set(["VERIFIED", "PUBLISHED"]);

const SUPPORTING_SOURCE = "source:ca-on-summary-use-2026" as CanonicalId<"source">;

const BASE = {
  legalTime: legalTimeNotCertified(
      "Ontario's general rule permits hunting from 30 minutes before local sunrise to 30 minutes " +
      "after local sunset, subject to listed exceptions. North Ground has not certified exact " +
      "astronomical times for this result.",
      "Ontario Ministry of Natural Resources",
    ),
  requirements: [
    "A valid Ontario Outdoors Card and small game licence are required; confirm all current licensing and local requirements in the official summary.",
  ],
  limitations: [
    general("The Ontario Hunting Regulations Summary is a convenient reference, not the complete law."),
    general("This result does not resolve municipal discharge rules, land access, Sunday gun-hunting rules, protected areas or overlapping restrictions."),
    general("Being inside a wildlife management unit is not permission to hunt there: land access, ownership and local restrictions are separate questions North Ground has not resolved."),
  ],
};

function baseResult(overrides: Partial<RegulatoryResult>): RegulatoryResult {
  return {
    /* No certified basis for a next opening from this path. Never "none". */
    next: { kind: "NOT_CERTIFIED" },
    ...BASE,
    requirements: [...BASE.requirements],
    limitations: [...BASE.limitations],
    sourceIds: [SOURCE.id as CanonicalId<"source">, SUPPORTING_SOURCE],
    verifiedAt: SOURCE.retrievedAt,
    status: "UNKNOWN",
    summary: "",
    ...overrides,
  };
}

/** Species this bundle carries any rule for, whatever the location. */
export const ONTARIO_SMALL_GAME_SPECIES: readonly string[] = [
  ...new Set(RULES.filter((rule) => PUBLISHABLE.has(rule.reviewStatus)).map((rule) => rule.speciesId)),
].sort();

/** Official units a species has at least one certified rule for. */
export function certifiedUnitsForSpecies(speciesId: string): string[] {
  const units = new Set<string>();
  for (const rule of RULES) {
    if (rule.speciesId !== speciesId || !PUBLISHABLE.has(rule.reviewStatus)) continue;
    for (const unit of GROUPS.get(rule.regulatoryGroupId)?.officialIdentifiers ?? []) units.add(unit);
  }
  return [...units].sort();
}

export function ontarioCoverageReport() {
  const officialUnits = bundle.officialUnitCount as number;
  return {
    sourceVersion: SOURCE.sourceVersion,
    retrievedAt: SOURCE.retrievedAt,
    officialUnits,
    species: ONTARIO_SMALL_GAME_SPECIES.map((speciesId) => {
      const certified = certifiedUnitsForSpecies(speciesId);
      const declaredClosed = new Set(
        NO_SEASON.filter((entry) => entry.speciesId === speciesId).flatMap((entry) => entry.zoneIds),
      ).size;
      return {
        speciesId,
        certifiedUnits: certified.length,
        declaredNoSeasonUnits: declaredClosed,
        unknownUnits: officialUnits - certified.length - declaredClosed,
        rules: RULES.filter((rule) => rule.speciesId === speciesId).length,
      };
    }),
  };
}

function windowsFor(rule: BundleRule): SeasonWindow[] | null {
  return parseSeasonPhrase(rule.seasonPhrase);
}

function limitsOf(rule: BundleRule): RegulatoryResult["limits"] {
  if (rule.limits.possession === null) return undefined;
  return {
    daily: rule.limits.daily,
    possession: rule.limits.possession,
    // Preserved as the authority stated it. A combined allowance shared with
    // another species is a different fact from an individual one.
    ...(rule.limits.combined && rule.limits.combinedWithNames.length
      ? { combinedWith: rule.limits.combinedWithNames.join(" and ") }
      : {}),
  };
}

/**
 * Evaluate an Ontario small-game hunt.
 *
 * `zone` must already be resolved; this function never guesses a location.
 */
export function evaluateOntarioSmallGame(
  input: { speciesId: string; date: string },
  zone: ZoneResolution,
): RegulatoryResult {
  if (zone.status !== "RESOLVED" || !zone.zoneId) {
    return baseResult({
      status: "NEEDS_VERIFICATION",
      summary: "North Ground could not certify the wildlife management unit, so it will not infer a hunting status.",
    });
  }

  const zoneId = String(zone.zoneId);
  const unitName = zone.officialName ?? zoneId;

  const matching = RULES.filter(
    (rule) =>
      rule.speciesId === input.speciesId &&
      PUBLISHABLE.has(rule.reviewStatus) &&
      (GROUPS.get(rule.regulatoryGroupId)?.zoneIds.includes(zoneId) ?? false),
  );

  if (matching.length > 1) {
    return baseResult({
      status: "CONFLICT",
      summary:
        `More than one official rule reaches ${unitName} for this species ` +
        `(${matching.map((rule) => GROUPS.get(rule.regulatoryGroupId)?.officialSpec).join("; ")}). ` +
        "North Ground will not choose between them; this combination is flagged for review.",
    });
  }

  if (!matching.length) {
    const declared = NO_SEASON.find(
      (entry) => entry.speciesId === input.speciesId && entry.zoneIds.includes(zoneId),
    );
    if (declared) {
      // The source states there is no season here, which is a real answer.
      return baseResult({
        status: "CLOSED",
        summary:
          `The official summary states there is no ${input.speciesId.replace("species:", "").replace(/-/g, " ")} ` +
          `season in ${unitName} (${declared.statedAs}).`,
      });
    }
    return baseResult({
      status: "UNKNOWN",
      summary:
        `No certified rule covers this species in ${unitName}. The unit is not named by any ` +
        "season row North Ground has certified, and an absent row is not evidence that the season is closed.",
    });
  }

  const rule = matching[0];
  const windows = windowsFor(rule);
  if (!windows) {
    return baseResult({
      status: "NEEDS_VERIFICATION",
      summary: `North Ground cannot interpret the published season wording for ${unitName} ("${rule.seasonPhrase}").`,
    });
  }

  const season = evaluateSeason(windows, rule.sourceYear, input.date);
  const first = season.windows[0];
  const shared = {
    /*
     * Supplementary, never a status. A CLOSED row carries its next opening and
     * stays CLOSED: "closed" and "closed, opens November 7" are different
     * answers to a hunter and neither is a different legal status.
     *
     * Read from the SAME resolved windows this answer is built from, so the
     * next date cannot disagree with the season beside it.
     */
    next: nextOpening([season], input.date),
    season: { opens: first.opensIso, closes: first.closesIso, datesInclusive: true },
    limits: limitsOf(rule),
    sourceIds: [rule.sourceId as CanonicalId<"source">, SUPPORTING_SOURCE],
    verifiedAt: SOURCE.retrievedAt,
  };

  if (season.verdict === "IN_SEASON") {
    return baseResult({
      ...shared,
      status: "CONDITIONAL",
      summary:
        `The certified ${rule.sourceVersion} season for ${unitName} includes this date ` +
        `(${rule.seasonPhrase}), subject to licensing, legal hunting time, species identification ` +
        "and all overlapping restrictions.",
    });
  }

  if (season.verdict === "OUT_OF_SEASON") {
    return baseResult({
      ...shared,
      status: "CLOSED",
      summary:
        `The selected date is outside the certified ${rule.sourceVersion} season for ${unitName} ` +
        `(${rule.seasonPhrase}).`,
    });
  }

  return baseResult({
    ...shared,
    status: "NEEDS_VERIFICATION",
    summary:
      `The selected date falls outside the period the ${rule.sourceVersion} summary certifies for ` +
      `${unitName} (${season.span.from} to ${season.span.to}). A different licence year applies, and ` +
      "North Ground has not certified it.",
  });
}
