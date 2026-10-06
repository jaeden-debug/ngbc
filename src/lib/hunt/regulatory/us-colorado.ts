import { general } from "../limitation.ts";
import { legalTimeNotCertified } from "./legal-time.ts";
import { coloradoLegalTime } from "./colorado-legal-time.ts";
import { timeZoneAtPoint } from "../time-zone.ts";
import type { CanonicalId, IsoDate, SourceRecord } from "../../content-contract/index.ts";
import bundleJson from "../../../../content/regulatory/us-co-small-game-2026.json" with { type: "json" };
import {
  conditionalCoverage, evaluateConditional,
  type ConditionalBundle, type ConditionalEvaluation, type ConditionalInput, type ConditionalVocabulary,
} from "./conditional-engine.ts";

/**
 * Colorado, bound to the shared engine. Data only: the bundle generated from
 * 2 CCR 406-3, Chapter W-3 (07/16/2026, effective September 1, 2026) by
 * `scripts/build-us-co-small-game.mjs`, and the words Colorado uses for the
 * facts a hunt turns on.
 *
 * Three questions, each asked only where its answer changes the result:
 *
 *  - LAND — prairie dogs only. #309 opens them on public land from June 15 to
 *    the end of February and on private land all year. Chapter W-3 does not
 *    define public land, so the hunter's own answer is followed and never
 *    inferred from a point.
 *  - AN ORGANIZED DOG PURSUIT EVENT — rabbits and hares only. #306(A)(2) runs an
 *    "Extended Falconry and Dog Pursuit Season" from September 1 to March 31,
 *    and Chapter W-0 #004 confines dog pursuit to organized events.
 *  - THE METHOD — #303 lists the legal methods per kind of animal and declares
 *    "Any method of take not listed herein shall be prohibited". A rifle is
 *    legal for dusky grouse and ptarmigan and not for pheasant; a slingshot for
 *    a cottontail and not for a coyote; hawking for every game bird and mammal
 *    and for no furbearer. Falconers also have their own extended seasons.
 */

type ColoradoBundle = Omit<ConditionalBundle, "sources"> & {
  officialUnitCount: number;
  contentHash: string;
  sources: ConditionalBundle["sources"];
  sourceRecords: Array<{ id: string; authority: string; title: string; url: string }>;
  limitations: string[];
};

export const COLORADO_BUNDLE = bundleJson as unknown as ColoradoBundle;

const W3 = "source:us-co-ccr-406-3-chapter-w-3" as CanonicalId<"source">;
const GMU = "source:us-co-gmu-service";
const AUTHORITY = "Colorado Parks and Wildlife";

export const COLORADO_VOCABULARY: ConditionalVocabulary = {
  jurisdictionName: "Colorado",
  unitTerm: "Game Management Unit",
  dimensions: [
    {
      id: "LAND_TYPE",
      question: "Will you hunt on public land or private land?",
      reason: "Colorado opens prairie dogs on public land from June 15 to the end of February, and on private land all year.",
      options: [
        { value: "PUBLIC_LAND", label: "Public land" },
        { value: "PRIVATE_LAND", label: "Private land" },
      ],
      multiple: false,
      allowsUnsure: false,
      sourceId: W3,
      sourceSection: "Chapter W-3 #309(A)(2)",
    },
    {
      id: "SEASON_TYPE",
      question: "Are you taking part in an organized dog pursuit event?",
      reason:
        "Colorado extends the rabbit and hare season from September 1 to March 31 for falconry and for organized dog pursuit events run by " +
        "recognized sporting associations.",
      options: [
        { value: "DOG_PURSUIT_EVENT", label: "Yes — an organized dog pursuit event" },
        { value: "REGULAR", label: "No" },
      ],
      multiple: false,
      allowsUnsure: false,
      sourceId: W3,
      sourceSection: "Chapter W-3 #306(A)(2); Chapter W-0 #004(A)(2)(a)(3)",
    },
    {
      id: "HUNT_METHOD",
      question: "What will you be hunting with?",
      reason:
        "Colorado lists the legal methods for each kind of animal and prohibits any it does not list, and falconers have extended seasons of their own.",
      options: [
        { value: "RIFLE", label: "Rifle" },
        { value: "HANDGUN", label: "Handgun" },
        { value: "SHOTGUN", label: "Shotgun" },
        { value: "BOW", label: "Bow", detail: "Handheld" },
        { value: "CROSSBOW", label: "Crossbow", detail: "Handheld" },
        { value: "AIR_GUN", label: "Air gun" },
        { value: "SLINGSHOT", label: "Slingshot" },
        { value: "FALCONRY", label: "Falconry", detail: "Hawking" },
      ],
      multiple: false,
      allowsUnsure: false,
      sourceId: W3,
      sourceSection: "Chapter W-3 #303",
    },
  ],
  /* The fallback, for a zone-scoped question where no point is known. */
  legalTime: legalTimeNotCertified(
    "Colorado: small game may be hunted from half an hour before sunrise to sunset, and furbearers from half an hour before sunrise " +
      "to half an hour after sunset (Chapter W-3 #302(A)). North Ground states exact times for a point, not for a whole unit.",
    AUTHORITY,
    W3,
  ),
  legalTimeAt: (speciesId, place, date) => {
    if (place.scope === "ZONE") return undefined;
    return coloradoLegalTime(speciesId, place, date as IsoDate, timeZoneAtPoint("jurisdiction:us-co"));
  },
  standingLimitations: COLORADO_BUNDLE.limitations.map((text) => general(text)),
  standingSourceIds: [GMU],
  describe: (dimension, value) => {
    if (dimension === "LAND_TYPE") return value === "PUBLIC_LAND" ? "public land" : "private land";
    if (dimension === "SEASON_TYPE") return value === "DOG_PURSUIT_EVENT" ? "organized dog pursuit events" : "hunts outside an organized dog pursuit event";
    return value;
  },
};

export function evaluateColorado(input: ConditionalInput): ConditionalEvaluation {
  return evaluateConditional(COLORADO_BUNDLE as unknown as ConditionalBundle, COLORADO_VOCABULARY, input);
}

export function coloradoCoverageReport() {
  return {
    sourceVersion: COLORADO_BUNDLE.sourceVersion,
    retrievedAt: COLORADO_BUNDLE.retrievedAt,
    officialUnits: COLORADO_BUNDLE.officialUnitCount,
    certifiedPeriod: COLORADO_BUNDLE.certifiedPeriod,
    species: conditionalCoverage(COLORADO_BUNDLE as unknown as ConditionalBundle & { officialUnitCount: number }),
  };
}

export function coloradoSourceRecords(ids: readonly string[]): SourceRecord[] {
  const wanted = new Set(ids);
  return COLORADO_BUNDLE.sourceRecords
    .filter((source) => wanted.has(source.id))
    .map((source) => ({
      id: source.id as CanonicalId<"source">,
      authority: source.authority,
      title: source.title,
      url: source.url,
      publisher: source.authority,
      retrievedAt: `${COLORADO_BUNDLE.retrievedAt}T00:00:00Z`,
      type: "official" as const,
      jurisdictionIds: ["jurisdiction:us-co" as CanonicalId<"jurisdiction">],
      verificationStatus: "verified" as const,
      contentHash: COLORADO_BUNDLE.contentHash,
    }));
}
