import { general } from "../limitation.ts";
import { legalTimeFor, legalTimeNotCertified, type LegalTimeException, type LegalTimeResult, type LegalTimeRule } from "./legal-time.ts";
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

/** #300(B): the furbearers, whose hours are #302(A)(2) rather than (A)(1). */
const FURBEARERS: ReadonlySet<string> = new Set([
  "species:american-mink", "species:american-marten", "species:american-badger", "species:gray-fox", "species:red-fox",
  "species:swift-fox", "species:raccoon", "species:ringtail", "species:striped-skunk", "species:western-spotted-skunk",
  "species:long-tailed-weasel", "species:american-ermine", "species:virginia-opossum", "species:muskrat",
  "species:bobcat", "species:coyote", "species:beaver",
]);

/** #302(A)(2), "Additionally": the eight furbearers that may be hunted at night under #303(E)(7)–(8). */
const NIGHT_FURBEARERS: ReadonlySet<string> = new Set([
  "species:beaver", "species:bobcat", "species:coyote", "species:gray-fox", "species:raccoon", "species:red-fox",
  "species:striped-skunk", "species:swift-fox",
]);

export const COLORADO_SMALL_GAME_HOURS: LegalTimeRule = {
  basis: "SUNRISE_SUNSET_OFFSET",
  beforeSunriseMinutes: 30,
  afterSunsetMinutes: 0,
  statedAs: "Small Game - from one-half (1/2) hour before sunrise to sunset.",
  section: "Chapter W-3 #302(A)(1)",
  sourceId: W3,
};

export const COLORADO_FURBEARER_HOURS: LegalTimeRule = {
  basis: "SUNRISE_SUNSET_OFFSET",
  beforeSunriseMinutes: 30,
  afterSunsetMinutes: 30,
  statedAs: "Furbearers - from one-half (1/2) hour before sunrise to one-half (1/2) hour after sunset.",
  section: "Chapter W-3 #302(A)(2)",
  sourceId: W3,
};

const NIGHT_HUNTING: LegalTimeException = {
  id: "us-co-furbearer-night-hunting",
  text:
    "This species may also be hunted at night with an artificial light: on private land with the written permission of the landowner, " +
    "designated agent, lessee or authorized employee, or on public land only under a Division permit valid for the time, species and place on it. " +
    "A light attached to or projected from a vehicle is prohibited.",
  effect: "WIDENS",
  section: "Chapter W-3 #302(A)(2); #303(E)(7)–(8)",
  sourceId: W3,
};

/** The species this bundle answers for, derived from it. */
export const COLORADO_SPECIES: readonly string[] = [...new Set(COLORADO_BUNDLE.rules.map((rule) => rule.speciesId))].sort();

/**
 * The hours rule Chapter W-3 sets for this species: furbearers by #302(A)(2),
 * every other species it covers by #302(A)(1). Nothing for a species it does
 * not cover, so a window is never built from a rule that does not reach it.
 */
export function coloradoHoursRule(speciesId: string): LegalTimeRule | undefined {
  if (!COLORADO_SPECIES.includes(speciesId)) return undefined;
  return FURBEARERS.has(speciesId) ? COLORADO_FURBEARER_HOURS : COLORADO_SMALL_GAME_HOURS;
}

/** Colorado's legal hunting window at a point. Colorado is wholly within America/Denver. */
export function coloradoLegalTime(
  speciesId: string,
  point: { latitude: number; longitude: number },
  date: IsoDate,
): LegalTimeResult | undefined {
  const rule = coloradoHoursRule(speciesId);
  if (!rule) return undefined;
  const result = legalTimeFor(rule, point, date, timeZoneAtPoint("jurisdiction:us-co"));
  if (result.status !== "RESOLVED" || !NIGHT_FURBEARERS.has(speciesId)) return result;
  return { ...result, exceptions: [NIGHT_HUNTING] };
}

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
    return coloradoLegalTime(speciesId, place, date as IsoDate);
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
