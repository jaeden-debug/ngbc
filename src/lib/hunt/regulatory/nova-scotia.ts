import { general } from "../limitation.ts";
import { legalTimeNotCertified } from "./legal-time.ts";
import type { CanonicalId } from "../../content-contract/index.ts";
import bundleJson from "../../../../content/regulatory/ca-ns-2026.json" with { type: "json" };
import {
  conditionalCoverage, evaluateConditional,
  type ConditionalBundle, type ConditionalEvaluation, type ConditionalInput, type ConditionalVocabulary,
} from "./conditional-engine.ts";

/**
 * Nova Scotia, bound to the jurisdiction-neutral engine.
 *
 * This file is data: the bundle and the words Nova Scotia's law uses. Anything
 * that would be Nova Scotia LOGIC belongs in the bundle, decided from the
 * regulation, exactly as Manitoba does it.
 *
 * FOUR WAYS NOVA SCOTIA IS NOT MANITOBA, all of them in the bundle rather than
 * in code, and all of them worth reading before changing anything here:
 *
 *  1. THE SEASONS ARE NOT WRITTEN IN THE ZONES. Deer Hunting Regulations
 *     ss. 10(4) and 11(4) say taking deer under either stamp "is not restricted
 *     to any specific deer management zone". The zone governs the ANIMAL CLASS
 *     and the STAMP. Manitoba puts the area on the season row; Nova Scotia does
 *     not, so every encoded rule here spans all twelve zones and the zone-scoped
 *     fact is a CONDITION instead.
 *
 *  2. THERE IS NO HUNTING YEAR. "licence year", "license year" and "hunting
 *     year" occur zero times across eight instruments. §41A forbids inventing
 *     one, so `licenceYear` is null and the bundle records the four different
 *     validity bases the authority uses instead.
 *
 *  3. ALMOST NO LITERAL DATES. Deer, moose and bear seasons are relative rules
 *     over weekday ordinals — "the last Friday in October until the second
 *     Saturday in December" — so each window carries the ordinal rule AND the
 *     derived 2026 dates, and `certifiedPeriod` ends at 2026-12-31 because the
 *     derivation is certified for that year alone.
 *
 *  4. THE HOURS ARE A PUBLISHED TABLE, NOT AN OFFSET. General Wildlife
 *     Regulations s. 11(3) defines "sunrise" and "sunset" as the tabulated
 *     values in Schedule A — six day-by-day grids for Yarmouth, Halifax and
 *     Sydney in Atlantic Standard Time, with no interpolation formula. Our
 *     astronomy must never be used, so no exact clock is offered.
 */

type NovaScotiaBundle = ConditionalBundle & {
  officialUnitCount: number;
  licenceYear: null;
  ministerialDeterminations: {
    deer2026: { eitherSexZones: number[]; antlerlessStampAllocations: Record<string, number> };
    moose2026: { statedAs: string };
  };
  deliberatelyNotEncoded: Array<{ what: string; reason: string; detail: string }>;
};

export const NOVA_SCOTIA_BUNDLE = bundleJson as unknown as NovaScotiaBundle;

/* ── The questions, in Nova Scotia's terms ──────────────────────────────── */

/**
 * Nova Scotia's vocabulary is deliberately short, and the reason matters.
 *
 * Manitoba's rules turn on residency and licence type because its season table
 * is written that way. Nova Scotia's encoded seasons turn on almost nothing: the
 * dates are the same for everyone, and what varies is which licence and stamp
 * the hunter must HOLD — a Ready to Hunt fact, not a season selector. The two
 * keys below are the only ones any encoded rule actually uses.
 */
export const NOVA_SCOTIA_VOCABULARY: ConditionalVocabulary = {
  jurisdictionName: "Nova Scotia",
  /* The authority has no province-wide unit term. "Deer Management Zone" is
     correct for deer and wrong for everything else: the Moose regulations say
     "Moose Management Zone", the Fur Harvesting regulations say only "Zone", and
     Small Game and Bear say "county". This is the term for the geography North
     Ground actually draws, and the bundle records the other three. */
  unitTerm: "Deer Management Zone",
  /*
   * ONE DIMENSION, AND THE REASON IS THE FINDING.
   *
   * Manitoba asks residency and licence type because its season TABLE is written
   * that way — different licences open different areas and seasons. Nova Scotia's
   * encoded seasons are the same dates for everyone; what varies is which licence
   * and stamp the hunter must HOLD, which is a Ready to Hunt fact rather than a
   * season selector.
   *
   * Bear snaring is the one real exception, so it is the one dimension: it is a
   * separate authorization under Bear Harvesting Regulations s. 6 with its own
   * season, its own bag limit of two rather than one, and its own express
   * exemption from the Sunday prohibition. Asking anything else would be asking a
   * hunter to narrow an answer that does not narrow.
   */
  dimensions: [
    {
      id: "LICENCE_TYPE",
      question: "Will you hunt bear with a weapon, or snare bear?",
      reason:
        "Nova Scotia licenses bear snaring separately from bear hunting, and the two have different seasons, different " +
        "bag limits and different Sunday rules: snaring is expressly permitted on Sundays and hunting is not.",
      options: [
        { value: "NS_BASE", label: "Hunting with a weapon", detail: "Under a base licence and a Bear Hunting Licence" },
        { value: "NS_RESIDENT_BEAR_SNARING", label: "Snaring", detail: "Under a Resident Bear Snaring Licence; Nova Scotia resident, 16 or older, fur-harvester certified" },
      ],
      multiple: false,
      allowsUnsure: false,
      sourceId: "source:ca-ns-bear-harvesting-regulations",
      sourceSection: "Bear Harvesting Regulations ss. 5, 6, 7(1), 7(2)",
    },
  ],
  /*
   * NO LEGAL WINDOW IS OFFERED, and that is the correct answer rather than a
   * missing one. General Wildlife Regulations s. 11(3) defines "sunrise" and
   * "sunset" as the tabulated values in Schedule A — six day-by-day grids for
   * Yarmouth, Halifax and Sydney in Atlantic Standard Time, credited to Saint
   * Mary's University, with no interpolation formula and no longitude
   * correction. Our astronomy is not the law here, and Schedule A's rows are not
   * transcribed, so there is nothing to compute from.
   */
  legalTime: legalTimeNotCertified(
    "Nova Scotia defines legal hunting hours as half an hour before sunrise to half an hour after sunset, where sunrise " +
      "and sunset are not astronomical events but the times tabulated in Schedule A to the General Wildlife Regulations " +
      "for Yarmouth, Halifax and Sydney, in Atlantic Standard Time. North Ground has not transcribed that table and will " +
      "not substitute its own astronomy for it, so no exact window is given.",
    "Nova Scotia Department of Natural Resources and Renewables",
    "source:ca-ns-general-wildlife-regulations" as CanonicalId<"source">,
  ),
  /*
   * Four of these are Manitoba's, said about Nova Scotia's instruments. The
   * fifth is Nova Scotia's own and has no Manitoba equivalent: six area
   * closures are in force whose text the Registrar does not publish, so in six
   * named localities North Ground knows a prohibition EXISTS and cannot read
   * it. That is the one case where "I found no restriction" would be a false
   * negative in a place where a restriction is known to exist, and it must be
   * said on every Nova Scotia answer rather than only near those places,
   * because their extent is exactly what is unreadable.
   */
  standingLimitations: [
    general(
      "Nova Scotia's regulations under the Wildlife Act are the controlling source for this answer. The department's 2026 " +
        "Hunting and Furharvesting Guide is a summary, and is relied on only for the ministerial determinations the " +
        "regulations delegate to the Minister and publish nowhere else.",
    ),
    general(
      "Six hunting prohibition orders are in force under Wildlife Act s. 21 whose consolidated text the Registrar of " +
        "Regulations does not publish: Bridgewater, Dominion Beach, Georges/Lawlors/MacNabs Islands, Petite Riviere, " +
        "Majors Point Beach at Belliveau Cove, and Chaswood and Middle Musquodoboit. North Ground cannot read their terms " +
        "or their extent, so a closed answer near any of these localities may be incomplete.",
    ),
    general(
      "Deer Management Zone boundaries are the province's map of the written descriptions in Schedule A to the Deer " +
        "Hunting Regulations, which control. Near a boundary, confirm which zone you are in.",
    ),
    general(
      "Being inside a Deer Management Zone is not permission to hunt there. Private land, the 29 game sanctuaries and " +
        "wildlife management areas with their own regulations, parks and other closed lands are separate questions North " +
        "Ground has not resolved here.",
    ),
    general(
      "This describes licensed hunting under Nova Scotia's Wildlife Act. It does not describe harvesting under Treaty or " +
        "Aboriginal rights, which is a separate legal context.",
    ),
  ],
  standingSourceIds: [],
  describe: (dimension, value) => {
    if (dimension === "LICENCE_TYPE") {
      return value === "NS_RESIDENT_BEAR_SNARING" ? "bear snaring" : "hunting with a weapon";
    }
    return value;
  },
};

export function evaluateNovaScotia(input: ConditionalInput): ConditionalEvaluation {
  return evaluateConditional(NOVA_SCOTIA_BUNDLE, NOVA_SCOTIA_VOCABULARY, input);
}

export function novaScotiaCoverageReport() {
  return {
    sourceVersion: NOVA_SCOTIA_BUNDLE.sourceVersion,
    retrievedAt: NOVA_SCOTIA_BUNDLE.retrievedAt,
    officialUnits: NOVA_SCOTIA_BUNDLE.officialUnitCount,
    certifiedPeriod: NOVA_SCOTIA_BUNDLE.certifiedPeriod,
    /* Nova Scotia has no guide cross-check yet, so no dispute count is claimed. */
    species: conditionalCoverage(NOVA_SCOTIA_BUNDLE),
  };
}

/**
 * The species Nova Scotia can answer for, derived from the bundle rather than
 * listed, so a rule added without a catalogue entry cannot hide here.
 */
export const NOVA_SCOTIA_SPECIES: readonly string[] =
  [...new Set(NOVA_SCOTIA_BUNDLE.rules.map((rule) => rule.speciesId))].sort();
