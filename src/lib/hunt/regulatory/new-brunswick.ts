import { general } from "../limitation.ts";
import { legalTimeFor, legalTimeNotCertified, type LegalTimeRule } from "./legal-time.ts";
import { timeZoneAtPoint } from "../time-zone.ts";
import type { CanonicalId, IsoDate } from "../../content-contract/index.ts";
import bundleJson from "../../../../content/regulatory/ca-nb-2026.json" with { type: "json" };
import {
  conditionalCoverage, evaluateConditional,
  type ConditionalBundle, type ConditionalEvaluation, type ConditionalInput, type ConditionalVocabulary,
} from "./conditional-engine.ts";

/**
 * New Brunswick, bound to the jurisdiction-neutral engine.
 *
 * The findings live in `scripts/build-new-brunswick-regulations.mjs` and in the
 * bundle's own explanatory fields. Four things to know before changing anything:
 *
 *  1. THE SEASONS ARE STANDING RULES, NOT AN ANNUAL ORDER. Every window in
 *     Hunting Regulation s. 11(1) ends in the word "annually" and is stated as an
 *     ordinal over weekdays, so one build serves every year until the regulation
 *     is amended. The dates are derived by `scripts/nb-dates.mjs` and both forms
 *     are stored.
 *
 *  2. DEER IS THREE ANSWERS BY ZONE, from s. 11.1 alone: no antlered season in
 *     zones 4, 5 and 9; antlered only and five weeks rather than eight in 1, 2
 *     and 3; eight weeks elsewhere. First Canadian bundle where the zone changes
 *     a season's LENGTH.
 *
 *  3. THE CROSSBOW IS INCLUDED in the bow-only opening weeks (s. 11.2), which is
 *     the opposite of Newfoundland. Anyone who assumes archery means one thing
 *     across provinces will encode one of the two wrongly.
 *
 *  4. THE CLOCK IS PROVINCE-WIDE, unlike Newfoundland's. New Brunswick is one
 *     timezone, and the Act repealed its sunrise TABLE in 2021 in favour of the
 *     astronomical event, so our astronomy is the right instrument — while
 *     s. 109.1 makes clear it is not the legal PROOF, which is why the margin is
 *     applied inward.
 */

type NewBrunswickBundle = ConditionalBundle & {
  officialUnitCount: number;
  licenceYear: null;
  licenceClasses: Array<{ class: string; feeCad: number | null; section: string }>;
  relativeDateRules: Record<string, unknown>;
  deerIsThreeAnswersByZone: Record<string, string>;
  deliberatelyNotEncoded: Array<{ what: string; reason: string; detail: string }>;
};

export const NEW_BRUNSWICK_BUNDLE = bundleJson as unknown as NewBrunswickBundle;

const ACT = "source:ca-nb-fish-and-wildlife-act" as CanonicalId<"source">;
const HUNTING = "source:ca-nb-hunting-regulation" as CanonicalId<"source">;

/**
 * s. 33(1)(a) with s. 1's definition of "night", inverted.
 *
 * The Act makes hunting at night an offence and defines "night" as the period
 * from half an hour after sunset to half an hour before sunrise, so the lawful
 * window is that term's complement. Old s. 34, "Times of sunrise and sunset",
 * was REPEALED by 2021, c.12, s. 2, so there is no table that is the law here and
 * the solar computation is correct rather than a substitute for one — the
 * opposite of Nova Scotia, whose Schedule A our astronomy must never replace.
 */
export const NEW_BRUNSWICK_HOURS: LegalTimeRule = {
  basis: "SUNRISE_SUNSET_OFFSET",
  /* POSITIVE opens BEFORE sunrise — see the note on `beforeSunriseMinutes`. This
     was -30, an hour of lawful light denied every day. */
  beforeSunriseMinutes: 30,
  afterSunsetMinutes: 30,
  statedAs:
    "“night” means that period of time elapsing between one-half hour after sunset and one-half hour " +
    "before sunrise of the following day",
  section: "Fish and Wildlife Act s. 33(1)(a), with s. 1's definition of “night”",
  sourceId: ACT,
};

export const NEW_BRUNSWICK_VOCABULARY: ConditionalVocabulary = {
  jurisdictionName: "New Brunswick",
  unitTerm: "Wildlife Management Zone",
  /*
   * ONE DIMENSION, AND IT CHANGES THE DATES BY THREE WEEKS.
   *
   * s. 11.2: "No person shall hunt antlered deer or antlerless deer for the first
   * three consecutive weeks beginning on the first Monday of October except by
   * means of a bow or crossbow." So a firearm hunter's deer season opens in week
   * four and an archer's in week one.
   *
   * MUZZLELOADER is offered separately from FIREARM even though a muzzle-loader
   * IS a firearm for s. 11.2, because s. 3.11 reserves the eighth week to
   * muzzle-loading firearms with their own authorization. That week is not
   * encoded — its zones are a ministerial determination — so the two values
   * currently share a season; keeping them apart is what makes encoding that week
   * later a data change rather than a vocabulary change.
   *
   * Residency changes what a hunter must HOLD (class I and II are non-resident,
   * III and IV resident) and no date, so it is a condition rather than a
   * question.
   */
  dimensions: [
    {
      id: "HUNT_METHOD",
      question: "What will you be hunting with?",
      reason:
        "New Brunswick reserves the first three weeks of the deer season to a bow or crossbow, so what you carry " +
        "changes when your season opens.",
      options: [
        { value: "BOW", label: "Bow", detail: "At least 20 kg of draw at or before 70 cm for big game" },
        { value: "CROSSBOW", label: "Crossbow", detail: "At least 20 kg of draw; included in the opening weeks, unlike some provinces" },
        { value: "FIREARM", label: "Firearm", detail: "Opens in the fourth week of the deer season" },
        { value: "MUZZLELOADER", label: "Muzzleloader", detail: "A firearm for the opening-weeks rule; the reserved final week is not yet certified" },
      ],
      multiple: false,
      allowsUnsure: false,
      sourceId: HUNTING,
      sourceSection: "Hunting Regulation ss. 11.2, 3.11(1)",
    },
  ],
  /* The fallback: a whole-zone question, where no point exists to compute at. */
  legalTime: legalTimeNotCertified(
    "New Brunswick makes hunting at night an offence and defines “night” as the period from half an hour after " +
      "sunset to half an hour before sunrise the following day (Fish and Wildlife Act s. 33(1)(a) and s. 1), so the " +
      "lawful window is half an hour before sunrise to half an hour after sunset. North Ground states exact times for " +
      "a point, not for a whole zone.",
    "New Brunswick Department of Natural Resources and Energy Development",
    ACT,
  ),
  legalTimeAt: (_speciesId, place, date) => {
    if (place.scope === "ZONE") return undefined;
    /* One timezone for the whole province, from `SINGLE_ZONE_JURISDICTIONS`
       rather than from a guess — America/Moncton. */
    const timezone = timeZoneAtPoint("jurisdiction:ca-nb");
    return timezone ? legalTimeFor(NEW_BRUNSWICK_HOURS, place, date as IsoDate, timezone) : undefined;
  },
  standingLimitations: [
    general(
      "The Hunting Regulation (N.B. Reg. 84-133) and the Fish and Wildlife Act are the controlling source for this " +
        "answer, with the Moose Hunting Regulation and the Hunter Orange Regulation for their own subjects. Every " +
        "window is a standing rule stated as an ordinal over weekdays; the dates shown are North Ground's derivation " +
        "of it for this period.",
    ),
    general(
      "Two figures New Brunswick delegates to the Minister are published nowhere in the regulation: the antlerless " +
        "deer quota for each zone, which may be set to zero and thereby close the zone, and the moose quota for each " +
        "zone. No antlerless deer answer is given here in either direction, and the number of moose licences " +
        "available in this zone is unknown.",
    ),
    general(
      "Wildlife Management Zone boundaries are the province's map of the written descriptions in s. 12 of the Hunting " +
        "Regulation, which control. Near a boundary, confirm which zone you are in — and confirm it against your " +
        "licence, because a class I or class III licence authorizes one antlered deer in one zone only.",
    ),
    general(
      "Being inside a Wildlife Management Zone is not permission to hunt there. Wildlife refuges and wildlife " +
        "management areas under N.B. Reg. 94-43, land posted under N.B. Reg. 89-106, and the Baie de Tracadie and " +
        "Tabusintac Lagoon areas — where s. 8(1) bars hunting after one o'clock in the afternoon — are all " +
        "geographies North Ground does not hold.",
    ),
    general(
      "This describes licensed hunting under New Brunswick's Fish and Wildlife Act. It does not describe harvesting " +
        "under Treaty or Aboriginal rights, which is a separate legal context.",
    ),
  ],
  standingSourceIds: [],
  describe: (dimension, value) => {
    if (dimension !== "HUNT_METHOD") return value;
    if (value === "BOW") return "a bow";
    if (value === "CROSSBOW") return "a crossbow";
    if (value === "MUZZLELOADER") return "a muzzleloader";
    return "a firearm";
  },
};

export function evaluateNewBrunswick(input: ConditionalInput): ConditionalEvaluation {
  return evaluateConditional(NEW_BRUNSWICK_BUNDLE, NEW_BRUNSWICK_VOCABULARY, input);
}

export function newBrunswickCoverageReport() {
  return {
    sourceVersion: NEW_BRUNSWICK_BUNDLE.sourceVersion,
    retrievedAt: NEW_BRUNSWICK_BUNDLE.retrievedAt,
    officialUnits: NEW_BRUNSWICK_BUNDLE.officialUnitCount,
    certifiedPeriod: NEW_BRUNSWICK_BUNDLE.certifiedPeriod,
    species: conditionalCoverage(NEW_BRUNSWICK_BUNDLE),
  };
}

/** The species this province can answer for, derived from the bundle. */
export const NEW_BRUNSWICK_SPECIES: readonly string[] =
  [...new Set(NEW_BRUNSWICK_BUNDLE.rules.map((rule) => rule.speciesId))].sort();
