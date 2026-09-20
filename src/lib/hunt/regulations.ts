import type { HuntInput, RegulatoryResult, ZoneResolution } from "./types.ts";

const VERIFIED_AT = "2026-09-20";

export function evaluateOntarioRuffedGrouse(input: HuntInput, zone: ZoneResolution): RegulatoryResult {
  const base = {
    legalTime: {
      status: "RULE_ONLY" as const,
      text: "Ontario's general rule permits hunting from 30 minutes before local sunrise to 30 minutes after local sunset, subject to listed exceptions. North Ground has not certified exact astronomical times for this result.",
    },
    requirements: ["A valid Ontario Outdoors Card and small game licence are required; confirm all current licensing and local requirements in the official summary."],
    limitations: [
      "The Ontario Hunting Regulations Summary is a convenient reference, not the complete law.",
      "This result does not resolve municipal discharge rules, land access, Sunday gun-hunting rules, protected areas or overlapping restrictions.",
    ],
    sourceIds: ["source:ca-on-small-game-2026", "source:ca-on-summary-use-2026"] as const,
    verifiedAt: VERIFIED_AT,
  };

  if (zone.status !== "RESOLVED") {
    return {
      ...base,
      sourceIds: [...base.sourceIds],
      status: "NEEDS_VERIFICATION",
      summary: "North Ground could not certify the wildlife management unit, so it will not infer a hunting status.",
    };
  }
  if (zone.zoneId !== "management_zone:ca-on-wmu-57") {
    return {
      ...base,
      sourceIds: [...base.sourceIds],
      status: "UNKNOWN",
      summary: `The official service resolved ${zone.officialName ?? "a WMU"}, but this first certified slice only contains the ruffed grouse rule for WMU 57.`,
    };
  }
  if (input.speciesId !== "species:ruffed-grouse") {
    return {
      ...base,
      sourceIds: [...base.sourceIds],
      status: "UNKNOWN",
      summary: "No certified rule is loaded for the selected species.",
    };
  }
  if (!/^2026-\d{2}-\d{2}$/.test(input.date)) {
    return {
      ...base,
      sourceIds: [...base.sourceIds],
      status: "NEEDS_VERIFICATION",
      summary: "The selected date falls outside the certified 2026 source period.",
    };
  }

  const season = { opens: "2026-09-15", closes: "2026-12-31", datesInclusive: true };
  const shared = {
    ...base,
    sourceIds: [...base.sourceIds],
    season,
    limits: { daily: 5, possession: 15, combinedWith: "spruce grouse" },
  };
  if (input.date >= season.opens && input.date <= season.closes) {
    return {
      ...shared,
      status: "CONDITIONAL",
      summary: "The certified WMU 57 season table includes this date, subject to licensing, legal hunting time, species identification and all overlapping restrictions.",
    };
  }
  return {
    ...shared,
    status: "CLOSED",
    summary: "The selected 2026 date is outside the certified September 15–December 31 ruffed/spruce grouse season for WMU 57.",
  };
}
