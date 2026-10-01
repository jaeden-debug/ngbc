import { legalTimeNotCertified } from "./legal-time.ts";
import { general } from "../limitation.ts";
import type { CanonicalId, IsoDate, SourceRecord } from "../../content-contract/index.ts";
import { timeZoneAtPoint } from "../time-zone.ts";
import { wyomingLegalTime } from "./wyoming-legal-time.ts";
import bundleJson from "../../../../content/regulatory/us-wy-elk-2026.json" with { type: "json" };
import {
  conditionalCoverage, evaluateConditional,
  type ConditionalBundle, type ConditionalEvaluation, type ConditionalInput, type ConditionalVocabulary,
} from "./conditional-engine.ts";

/**
 * Wyoming, bound to the shared engine. Data only: the bundle generated from
 * the Commission's Chapter 7, Elk Hunting Seasons (scripts/build-us-wy-elk.mjs),
 * and the words Wyoming uses for the facts an elk hunt turns on.
 *
 * Wyoming writes its elk seasons per hunt area and per LICENSE: a limited
 * quota license (Types 1–9) is valid only in its own area(s) under its own
 * dates and animal class, a resident general license wherever an area's
 * seasons name General licenses, and a nonresident region general license only
 * in its region (Chapter 7 s. 6). So the first fact asked is which license,
 * offered only among those valid at the place, and North Ground never assumes
 * the hunter holds it. Weapon is asked only where it changes the answer — in a
 * special archery season, or a Type 9 archery-only season — and youth only in
 * the one area with a youth-only general season.
 */

type WyomingBundle = Omit<ConditionalBundle, "sources"> & {
  officialUnitCount: number;
  contentHash: string;
  sources: Array<{ id: string; title: string; url: string; authority: string; conditions?: ConditionalBundle["sources"][number]["conditions"] }>;
  sourceRecords: Array<{ id: string; authority: string; title: string; url: string }>;
  limitations: string[];
};

export const WYOMING_BUNDLE = bundleJson as unknown as WyomingBundle;

const CH7 = "source:us-wy-elk-ch7-2026";
const CH2 = "source:us-wy-general-hunting-ch2-2026";

/** General licenses first, then limited quota licenses by area and type. */
function licenceOrder(code: string): [number, number, number] {
  if (code === "General (resident)") return [0, 0, 0];
  if (code.startsWith("Nonresident")) return [1, code.includes("Eastern") ? 0 : code.includes("Southern") ? 1 : 2, 0];
  const match = /^Area (\d+)(?:, \d+)* Type (\d)$/.exec(code);
  return match ? [2, Number(match[1]), Number(match[2])] : [3, 0, 0];
}

const LICENCE_OPTIONS = [...(WYOMING_BUNDLE.huntCodes ?? [])]
  .sort((a, b) => {
    const [x, y] = [licenceOrder(a.code), licenceOrder(b.code)];
    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2] || a.code.localeCompare(b.code);
  })
  .map((huntCode) => ({
    value: huntCode.code,
    label: huntCode.code,
    detail: huntCode.allocation.method === "GENERAL"
      ? "Valid in every hunt area whose seasons name General licenses"
      : huntCode.allocation.authorityTerm === "nonresident region general elk license"
        ? `Valid only in ${huntCode.geography.statedAs}`
        : `Limited quota: ${huntCode.allocation.quota?.statedAs ?? "quota not stated"}`,
  }));

export const WYOMING_VOCABULARY: ConditionalVocabulary = {
  jurisdictionName: "Wyoming",
  unitTerm: "Elk Hunt Area",
  dimensions: [
    {
      id: "HUNT_CODE",
      question: "Which elk license will you hunt with?",
      reason:
        "Wyoming sets elk seasons per license: a limited quota license is valid only in its own hunt area(s) and type, " +
        "and a nonresident region general license only in its region's areas.",
      valuesFrom: "PLACE",
      options: LICENCE_OPTIONS,
      multiple: false,
      allowsUnsure: false,
      sourceId: CH7,
      sourceSection: "Section 2; Section 6",
    },
    {
      id: "HUNT_METHOD",
      question: "What will you be hunting with?",
      reason:
        "A special archery season, and a Type 9 license's season, are archery only; in a regular season both firearms " +
        "and archery equipment are legal.",
      options: [
        { value: "BOW", label: "Bow", detail: "Longbow, recurve or compound bow of at least 50 lb draw weight for elk" },
        { value: "CROSSBOW", label: "Crossbow", detail: "At least 90 lb peak draw weight; archery equipment in Wyoming" },
        { value: "FIREARM", label: "Center-fire firearm", detail: "At least .24 caliber, as Chapter 32 sets for elk" },
        { value: "MUZZLELOADER", label: "Muzzleloader", detail: "At least .40 caliber with at least 50 grains of black powder" },
        { value: "SHOTGUN", label: "Shotgun", detail: "“00” or larger buckshot, or a slug" },
      ],
      multiple: false,
      allowsUnsure: false,
      sourceId: CH7,
      sourceSection: "Section 3; Chapter 2 s. 11; Chapter 32 ss. 3, 4 and 6",
    },
    {
      id: "HUNTER_AGE",
      question: "Are you hunting with a youth license?",
      reason: "One general elk season in Area 21 is open to youth only.",
      options: [
        { value: "YOUTH", label: "Yes, a youth license" },
        { value: "NOT_YOUTH", label: "No" },
      ],
      multiple: false,
      allowsUnsure: false,
      sourceId: CH7,
      sourceSection: "Section 2, Area 21",
    },
  ],
  /* The fallback, for a zone-scoped question where no point is known. */
  legalTime: legalTimeNotCertified(
    "Wyoming: “Big game, trophy game and small game animals may only be taken from one-half (1/2) hour before sunrise " +
      "to one-half (1/2) hour after sunset” (Chapter 2, s. 5(a)). North Ground states exact times for a point, not for a " +
      "whole hunt area.",
    "Wyoming Game and Fish Department",
    CH2 as CanonicalId<"source">,
  ),
  legalTimeAt: (speciesId, place, date) => {
    if (place.scope === "ZONE") return undefined;
    return wyomingLegalTime(speciesId, place, date as IsoDate, timeZoneAtPoint("jurisdiction:us-wy"));
  },
  standingLimitations: WYOMING_BUNDLE.limitations.map((text) => general(text)),
  standingSourceIds: ["source:us-wy-elk-area-service"],
  describe: (dimension, value) => {
    if (dimension === "HUNT_CODE") return `the ${value} elk license`;
    if (dimension === "HUNTER_AGE") return value === "YOUTH" ? "youth license holders" : "hunters without a youth license";
    if (dimension === "HUNT_METHOD") {
      return value === "BOW" ? "a bow" : value === "CROSSBOW" ? "a crossbow" : value === "MUZZLELOADER" ? "a muzzleloader"
        : value === "SHOTGUN" ? "a shotgun" : "a center-fire firearm";
    }
    return value;
  },
};

export function evaluateWyoming(input: ConditionalInput): ConditionalEvaluation {
  return evaluateConditional(WYOMING_BUNDLE, WYOMING_VOCABULARY, input);
}

export function wyomingCoverageReport() {
  return {
    sourceVersion: WYOMING_BUNDLE.sourceVersion,
    retrievedAt: WYOMING_BUNDLE.retrievedAt,
    officialUnits: WYOMING_BUNDLE.officialUnitCount,
    certifiedPeriod: WYOMING_BUNDLE.certifiedPeriod,
    species: conditionalCoverage(WYOMING_BUNDLE),
  };
}

export function wyomingSourceRecords(ids: readonly string[]): SourceRecord[] {
  const wanted = new Set(ids);
  return WYOMING_BUNDLE.sourceRecords
    .filter((source) => wanted.has(source.id))
    .map((source) => ({
      id: source.id as CanonicalId<"source">,
      authority: source.authority,
      title: source.title,
      url: source.url,
      publisher: source.authority,
      retrievedAt: `${WYOMING_BUNDLE.retrievedAt}T00:00:00Z`,
      type: "official" as const,
      jurisdictionIds: ["jurisdiction:us-wy" as CanonicalId<"jurisdiction">],
      verificationStatus: "verified" as const,
      contentHash: WYOMING_BUNDLE.contentHash,
    }));
}
