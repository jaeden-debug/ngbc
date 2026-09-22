import type { CanonicalId, SourceRecord } from "../../content-contract/index.ts";
import bundleJson from "../../../../content/regulatory/us-mt-upland-2026.json" with { type: "json" };
import overlaysJson from "../../../../content/regulatory/us-mt-overlays.json" with { type: "json" };
import type { OverlayCatalogue } from "../overlays.ts";
import {
  conditionalCoverage, evaluateConditional,
  type ConditionalBundle, type ConditionalEvaluation, type ConditionalInput, type ConditionalVocabulary,
} from "./conditional-engine.ts";

/**
 * Montana, bound to the shared engine. Data only: the bundle generated from
 * the 2026 upland game bird regulations, the overlay catalogue it read at the
 * same time, and the words Montana uses for the facts a hunt turns on.
 *
 * Montana's upland seasons are written in its own upland game bird districts
 * (east and west of the Continental Divide), not in its deer and elk hunting
 * districts, so a point is placed in those districts for these species.
 */

type MontanaBundle = Omit<ConditionalBundle, "sources"> & {
  officialUnitCount: number;
  contentHash: string;
  sources: Array<{ id: string; title: string; url: string; authority: string; conditions?: ConditionalBundle["sources"][number]["conditions"] }>;
  sourceRecords: Array<{ id: string; authority: string; title: string; url: string; licence?: string }>;
  limitations: string[];
};

export const MONTANA_BUNDLE = bundleJson as unknown as MontanaBundle;
export const MONTANA_OVERLAYS = overlaysJson as unknown as OverlayCatalogue;

const BOOKLET = "source:us-mt-upland-regulations-2026";
const NONRESIDENT_DELAY =
  "Nonresidents hunting on public lands and privately owned lands that are a part of a hunting access program begin hunting " +
  "10 days later than residents for all species except mountain grouse.";

export const MONTANA_VOCABULARY: ConditionalVocabulary = {
  jurisdictionName: "Montana",
  unitTerm: "Upland Game Bird District",
  dimensions: [
    {
      id: "RESIDENCY",
      question: "Are you a Montana resident?",
      reason: NONRESIDENT_DELAY,
      options: [
        { value: "RESIDENT", label: "Montana resident" },
        { value: "NON_RESIDENT", label: "Nonresident" },
      ],
      multiple: false,
      allowsUnsure: false,
      sourceId: BOOKLET,
      sourceSection: "p. 2, Highlights; pp. 9–10",
    },
    {
      id: "LAND_TYPE",
      question: "What land will you hunt on?",
      reason: NONRESIDENT_DELAY,
      options: [
        { value: "PRIVATE_NOT_ACCESS", label: "Private land not in a hunting access program", detail: "With the landowner's permission" },
        { value: "PUBLIC_OR_ACCESS", label: "Public land, or private land in a hunting access program", detail: "Such as Block Management" },
      ],
      multiple: false,
      allowsUnsure: false,
      sourceId: BOOKLET,
      sourceSection: "pp. 9–10, season columns",
    },
    {
      id: "LICENCE_TYPE",
      question: "Which upland game bird license will you hunt with?",
      reason: "A nonresident 3-day license is not valid for ring-necked pheasants during the opening week of the season.",
      options: [
        { value: "SEASON", label: "Upland Game Bird License (season)" },
        { value: "THREE_DAY", label: "3-day Upland Game Bird License", detail: "Nonresidents only" },
      ],
      multiple: false,
      allowsUnsure: false,
      sourceId: BOOKLET,
      sourceSection: "p. 2, License Chart; p. 10",
      implies: { THREE_DAY: { RESIDENCY: "NON_RESIDENT" } },
    },
    {
      id: "HUNTER_AGE",
      question: "Is the hunter 15 or younger?",
      reason: "Montana's youth pheasant weekend is open only to legally licensed youth ages 15 and under, accompanied by a nonhunting adult.",
      options: [
        { value: "YOUTH_15_AND_UNDER", label: "15 or younger" },
        { value: "16_AND_OVER", label: "16 or older" },
      ],
      multiple: false,
      allowsUnsure: false,
      sourceId: BOOKLET,
      sourceSection: "p. 10, Ring-necked Pheasant",
    },
  ],
  legalTime: {
    status: "RULE_ONLY",
    text:
      "Montana: “Authorized hunting hours for the taking of upland game birds begin one-half hour before sunrise and end " +
      "one-half hour after sunset each day of the hunting season” (p. 4). North Ground has not certified exact astronomical times.",
  },
  standingLimitations: MONTANA_BUNDLE.limitations,
  standingSourceIds: ["source:us-mt-upland-district-service"],
  describe: (dimension, value) => {
    if (dimension === "RESIDENCY") return value === "RESIDENT" ? "Montana residents" : "nonresidents";
    if (dimension === "LAND_TYPE") return value === "PUBLIC_OR_ACCESS" ? "public or access-program land" : "private land not in an access program";
    if (dimension === "LICENCE_TYPE") return value === "THREE_DAY" ? "3-day license holders" : "season license holders";
    if (dimension === "HUNTER_AGE") return value === "YOUTH_15_AND_UNDER" ? "youth 15 and under" : "hunters 16 and over";
    return value;
  },
};

export function evaluateMontana(input: ConditionalInput): ConditionalEvaluation {
  return evaluateConditional(MONTANA_BUNDLE, MONTANA_VOCABULARY, input);
}

/** Which overlay tokens reach an upland species: all of them. */
const UPLAND_TOKENS = ["tribal_authority", "restricted_area_not_evaluated", "upland_restricted_waterfowl_opening"] as const;

export function montanaRestrictionTokensFor(speciesId: string): readonly string[] {
  return MONTANA_BUNDLE.rules.some((rule) => rule.speciesId === speciesId) ? UPLAND_TOKENS : ["*"];
}

export function montanaCoverageReport() {
  return {
    sourceVersion: MONTANA_BUNDLE.sourceVersion,
    retrievedAt: MONTANA_BUNDLE.retrievedAt,
    officialUnits: MONTANA_BUNDLE.officialUnitCount,
    certifiedPeriod: MONTANA_BUNDLE.certifiedPeriod,
    species: conditionalCoverage(MONTANA_BUNDLE),
  };
}

export function montanaSourceRecords(ids: readonly string[]): SourceRecord[] {
  const wanted = new Set(ids);
  return MONTANA_BUNDLE.sourceRecords
    .filter((source) => wanted.has(source.id))
    .map((source) => ({
      id: source.id as CanonicalId<"source">,
      authority: source.authority,
      title: source.title,
      url: source.url,
      publisher: source.authority,
      retrievedAt: `${MONTANA_BUNDLE.retrievedAt}T00:00:00Z`,
      type: "official" as const,
      jurisdictionIds: ["jurisdiction:us-mt" as CanonicalId<"jurisdiction">],
      verificationStatus: "verified" as const,
      contentHash: MONTANA_BUNDLE.contentHash,
    }));
}
