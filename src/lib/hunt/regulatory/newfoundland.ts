import { general } from "../limitation.ts";
import { legalTimeNotCertified } from "./legal-time.ts";
import { newfoundlandLegalTime } from "./newfoundland-legal-time.ts";
import type { CanonicalId, IsoDate } from "../../content-contract/index.ts";
import bundleJson from "../../../../content/regulatory/ca-nl-2026.json" with { type: "json" };
import {
  conditionalCoverage, evaluateConditional,
  type ConditionalBundle, type ConditionalEvaluation, type ConditionalInput, type ConditionalVocabulary,
} from "./conditional-engine.ts";

/**
 * Newfoundland and Labrador, bound to the jurisdiction-neutral engine.
 *
 * This file is data: the bundle and the words the province's law uses. The
 * findings that shaped it live in `scripts/build-newfoundland-regulations.mjs`
 * and in the bundle's own explanatory fields; the four worth knowing before
 * changing anything here are:
 *
 *  1. THE SEASONS ARE IN ORDERS, NOT IN A REGULATION. The Wild Life
 *     Regulations carry no dates at all — they delegate (s. 38) and declare
 *     what silence means (s. 89, "Closed season except by order"). The dates
 *     are in the annual Open Seasons Hunting and Trapping Order, and the
 *     geography is in three standing species orders. A new year is a new Order
 *     and nothing else moves.
 *
 *  2. IT IS TWO ANSWERS, NOT ONE PROVINCE. Island moose closes 31 December and
 *     Labrador moose runs to 14 March; Labrador black bear opens a month
 *     earlier than the Island's; caribou has four Island windows and, by
 *     declaration for conservation, no Labrador season at all. Every rule here
 *     is Island- or Labrador-scoped and none is provincial.
 *
 *  3. THE PRE-SEASON EXCLUDES CROSSBOWS, so HUNT_METHOD has to distinguish a
 *     crossbow from a bow. Lumping them as archery would give a crossbow
 *     hunter two weeks of season they do not have.
 *
 *  4. THE CLOCK IS ISLAND-ONLY, and deliberately. See
 *     `newfoundland-legal-time.ts`: Labrador does not keep one clock, so the
 *     rule is stated there and the window is declined rather than computed in
 *     whichever of two timezones happened to be picked.
 */

type NewfoundlandBundle = ConditionalBundle & {
  officialUnitCount: number;
  licenceYear: null;
  guideCrossCheck: { disagreements: Array<{ where: string; guide: string; order: string; resolution: string }> };
  deliberatelyNotEncoded: Array<{ what: string; reason: string; detail: string }>;
  islandAndLabrador: Record<string, string>;
  theBearAreaThatIsNotInAnyOrder: Record<string, string>;
};

export const NEWFOUNDLAND_BUNDLE = bundleJson as unknown as NewfoundlandBundle;

const REGULATIONS = "source:ca-nl-wild-life-regulations" as CanonicalId<"source">;
const OPEN_SEASONS = "source:ca-nl-open-seasons-order-2026-27" as CanonicalId<"source">;

/* ── The questions, in the province's terms ─────────────────────────────── */

/**
 * ONE DIMENSION, AND IT IS THE ONE THE ORDER ACTUALLY TURNS ON.
 *
 * Nothing else in Newfoundland and Labrador's big game seasons varies by the
 * hunter. Residency changes what a hunter must ARRANGE — a non-resident may not
 * hunt big game without employing and being accompanied by a licensed guide
 * (Wild Life Regulations s. 111.1(2)) — but it changes no date and no area, so
 * it is a condition rather than a question. Age, licence class and draw
 * allocation are the same: real obligations, no effect on the window.
 *
 * Method is different, and materially. Each species' section gives a general
 * season and then an earlier PRE-SEASON "by long bow or compound bow and
 * arrow". The department states three times over that it "does not include
 * cross bows". So a crossbow hunter has the general season only, and a hunter
 * carrying a bow has both — which is why BOW and CROSSBOW are separate values
 * rather than one archery option.
 */
export const NEWFOUNDLAND_VOCABULARY: ConditionalVocabulary = {
  jurisdictionName: "Newfoundland and Labrador",
  /* The province has no single unit term: the orders say "moose management
     area", "caribou management area" and "black bear management area", each its
     own geography for its own species. This is the term they share. */
  unitTerm: "management area",
  dimensions: [
    {
      id: "HUNT_METHOD",
      question: "What will you be hunting with?",
      reason:
        "Newfoundland and Labrador opens an earlier pre-season for a long bow or compound bow and arrow. A crossbow is " +
        "not included in it, so what you carry changes the dates.",
      options: [
        { value: "FIREARM", label: "Firearm", detail: "Rifle of .243 calibre or larger, or a shotgun of 20 gauge or larger" },
        { value: "BOW", label: "Long bow or compound bow", detail: "At least 20 kilograms of draw; the only method the pre-season allows" },
        { value: "CROSSBOW", label: "Crossbow", detail: "At least 68 kilograms of draw; the general season only, not the pre-season" },
      ],
      multiple: false,
      allowsUnsure: false,
      sourceId: OPEN_SEASONS,
      sourceSection: "Open Seasons Hunting and Trapping Order, 2026-2027, ss. 7(2), 7(3), 9(2), 9(3), 10(2), 10(3), 11(2), 11(3)",
    },
  ],
  /* The fallback: a zone-scoped question, or any Labrador area, where the
     observed clock is not certified. The rule is still stated in full. */
  legalTime: legalTimeNotCertified(
    "Newfoundland and Labrador prohibits hunting big game from half an hour after sunset to half an hour before sunrise " +
      "the following day (Wild Life Regulations s. 42(2)). North Ground states an exact window for a point on the Island " +
      "of Newfoundland, which keeps one clock. It does not state one for Labrador, where most of the region keeps " +
      "Atlantic Time and a southeastern coastal strip keeps Newfoundland Time, and North Ground has not certified where " +
      "that line runs.",
    "Department of Forestry, Agriculture and Lands",
    REGULATIONS,
  ),
  legalTimeAt: (_speciesId, place, date) => newfoundlandLegalTime(place, date as IsoDate),
  standingLimitations: [
    general(
      "The Open Seasons Hunting and Trapping Order, 2026-2027 (NLR 43/26) and the standing species orders are the " +
        "controlling source for this answer. The department's Hunting and Trapping Guide 2026-27 is a summary, used to " +
        "cross-check them; where the two disagree the Order governs, and each disagreement is recorded.",
    ),
    general(
      "Management area boundaries are the province's map of the written descriptions in the species orders, which " +
        "control. Near a boundary, confirm which area you are in — and confirm it against your licence, because a " +
        "Newfoundland and Labrador big game licence is valid only for the area it names.",
    ),
    general(
      "Being inside a management area is not permission to hunt there. Three wild life reserves on the Island have their " +
        "own regulations and North Ground holds no boundary for any of them: the Middle Ridge Reserve, which bars entry " +
        "except under a permit and shares its name with caribou management area 64; the Big Barasway, Burgeo Reserve; and " +
        "the Little Grand Lake Reserve. Eleven further localities are closed by the Hunting Prohibition Order, 1998 — " +
        "nine to firearms and two to firearms, snares and traps — and their text is published while their geometry is not.",
    ),
    general(
      "National parks are a separate authority North Ground has not certified. Gros Morne and Terra Nova both run their " +
        "own moose hunts in park sub-areas the provincial order does not describe, and the province's area layer " +
        "quarantines both park polygons — so no answer here should be read as saying moose is closed inside either park.",
    ),
    general(
      "This describes licensed hunting under Newfoundland and Labrador's Wild Life Act. It does not describe harvesting " +
        "under Treaty or Aboriginal rights, or under the Labrador Inuit Land Claims Agreement, which are separate legal " +
        "contexts.",
    ),
  ],
  standingSourceIds: [],
  describe: (dimension, value) => {
    if (dimension !== "HUNT_METHOD") return value;
    if (value === "BOW") return "a long bow or compound bow";
    if (value === "CROSSBOW") return "a crossbow";
    return "a firearm";
  },
};

export function evaluateNewfoundland(input: ConditionalInput): ConditionalEvaluation {
  return evaluateConditional(NEWFOUNDLAND_BUNDLE, NEWFOUNDLAND_VOCABULARY, input);
}

export function newfoundlandCoverageReport() {
  return {
    sourceVersion: NEWFOUNDLAND_BUNDLE.sourceVersion,
    retrievedAt: NEWFOUNDLAND_BUNDLE.retrievedAt,
    officialUnits: NEWFOUNDLAND_BUNDLE.officialUnitCount,
    certifiedPeriod: NEWFOUNDLAND_BUNDLE.certifiedPeriod,
    guideDisputes: NEWFOUNDLAND_BUNDLE.guideCrossCheck.disagreements.length,
    species: conditionalCoverage(NEWFOUNDLAND_BUNDLE),
  };
}

/** The species this province can answer for, derived from the bundle. */
export const NEWFOUNDLAND_SPECIES: readonly string[] =
  [...new Set(NEWFOUNDLAND_BUNDLE.rules.map((rule) => rule.speciesId))].sort();
