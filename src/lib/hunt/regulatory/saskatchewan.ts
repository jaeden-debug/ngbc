import { general } from "../limitation.ts";
import { legalTimeFor, legalTimeNotCertified, type LegalTimeRule } from "./legal-time.ts";
import { timeZoneAtPoint } from "../time-zone.ts";
import { SASKATCHEWAN_IMPLEMENTS } from "./saskatchewan-methods.ts";
import type { CanonicalId, IsoDate } from "../../content-contract/index.ts";
import bundleJson from "../../../../content/regulatory/ca-sk-2026.json" with { type: "json" };
import {
  conditionalCoverage, evaluateConditional,
  type ConditionalBundle, type ConditionalEvaluation, type ConditionalInput, type ConditionalVocabulary,
} from "./conditional-engine.ts";

/**
 * Saskatchewan, bound to the jurisdiction-neutral engine.
 *
 * The findings are in `docs/handoff/saskatchewan-research.md`, in
 * `scripts/build-saskatchewan-regulations.mjs` and in the bundle's own fields.
 * Four to know before changing anything here:
 *
 *  1. THE SEASONS ARE A STANDING MINISTERIAL REGULATION. The Open Seasons Game
 *     Regulations, 2009 carries month-and-day dates with no year, amended by
 *     numbered Saskatchewan Regulations — twenty since 2009. There is no annual
 *     order: the Act's only order power (s. 27) is geography.
 *
 *  2. THE LICENCE CLASS IS THE DIMENSION, and there are 41 of them. Residency
 *     changes the zones AND the dates, so rules are keyed on the authority's own
 *     licence names and the dimension draws its values from the PLACE — a hunter
 *     sees the handful reaching their zone rather than all 41.
 *
 *  3. METHODS COME FROM `saskatchewan-methods.ts`, NOT FROM SECTION TITLES. The
 *     envelopes nest: a bow is lawful in the muzzleloader season. Bird seasons
 *     carry no method at all.
 *
 *  4. THE CLOCK IS CENTRAL STANDARD TIME BY STATUTE. s. 3(b) fixes it, and
 *     Saskatchewan does not observe daylight saving — so for most of the province
 *     the statutory basis and the observed clock coincide and the conversion is the
 *     identity. The Lloydminster area observes Alberta time, which is why the basis
 *     is preserved rather than collapsed.
 */

type SaskatchewanBundle = ConditionalBundle & {
  officialUnitCount: number;
  licenceYear: null;
  deliberatelyNotEncoded: Array<{ what: string; reason: string; detail: string }>;
  theSuffixRule: Record<string, string>;
  theSecondGeography: Record<string, string>;
  guideDivergence: Record<string, unknown>;
  methodEnvelopesAreReadNotInferred: Record<string, string>;
};

export const SASKATCHEWAN_BUNDLE = bundleJson as unknown as SaskatchewanBundle;

const ACT = "source:ca-sk-wildlife-act" as CanonicalId<"source">;
const OSGR = "source:ca-sk-open-seasons-game-regulations" as CanonicalId<"source">;
const WLR = "source:ca-sk-wildlife-regulations" as CanonicalId<"source">;
const BOUNDARIES = "source:ca-sk-wmz-boundaries-regulations" as CanonicalId<"source">;
const WMZ_SERVICE = "source:ca-sk-wmz-service" as CanonicalId<"source">;

/** s. 11(1) of The Wildlife Regulations, 1981, inverted. */
export const SASKATCHEWAN_HOURS: LegalTimeRule = {
  basis: "SUNRISE_SUNSET_OFFSET",
  /* POSITIVE opens BEFORE sunrise: `legalTimeFor` shifts by `-before`. This was
     -30, which opened the window half an hour AFTER sunrise and so denied a
     hunter the first hour of lawful light every day. */
  beforeSunriseMinutes: 30,
  afterSunsetMinutes: 30,
  statedAs:
    "No person shall hunt any wildlife during the period from one-half hour after sunset to one-half hour before sunrise.",
  section: "The Wildlife Regulations, 1981, s. 11(1)",
  sourceId: WLR,
};

/**
 * Every licence class the regulation names, derived from the rules rather than
 * listed, so a licence added by amendment arrives with its rule.
 */
export const SASKATCHEWAN_LICENCE_CLASSES: readonly string[] = [...new Set(
  SASKATCHEWAN_BUNDLE.rules.flatMap((rule) => {
    const stated = rule.appliesWhen.LICENCE_TYPE;
    return Array.isArray(stated) ? stated : stated ? [stated] : [];
  }),
)].sort();

export const SASKATCHEWAN_VOCABULARY: ConditionalVocabulary = {
  jurisdictionName: "Saskatchewan",
  unitTerm: "Wildlife Management Zone",
  dimensions: [
    {
      id: "LICENCE_TYPE",
      question: "Which licence will you be hunting under?",
      reason:
        "Saskatchewan writes every season for a named licence class, and the class changes both the zones and the " +
        "dates — a Saskatchewan resident, a Canadian resident and a guided non-resident have different seasons in " +
        "different zones for the same species.",
      options: SASKATCHEWAN_LICENCE_CLASSES.map((licence) => ({ value: licence, label: licence })),
      multiple: false,
      allowsUnsure: false,
      /* The regulation names 41 classes and most are meaningless outside the zones
         their own rules reach, so a hunter is offered the ones that reach theirs. */
      valuesFrom: "PLACE",
      sourceId: OSGR,
      sourceSection: "The Open Seasons Game Regulations, 2009, Parts II to X",
    },
    {
      id: "HUNT_METHOD",
      question: "What will you be hunting with?",
      reason:
        "Each big-game season states the means permitted during it, and they nest: the season named for the " +
        "muzzle-loading firearm is open to a bow and a crossbow too. Upland bird seasons name no means at all.",
      options: [
        { value: "BOW", label: "Bow", detail: "Archery means a bow and arrow and expressly not a crossbow (s. 2(f))" },
        { value: "CROSSBOW", label: "Crossbow", detail: "Its own seasons, and lawful in every season above archery" },
        { value: "MUZZLELOADER", label: "Muzzleloader" },
        { value: "SHOTGUN", label: "Shotgun" },
        { value: "RIFLE", label: "Rifle", detail: "The general seasons, which permit every means the Wildlife Regulations allow" },
      ],
      multiple: false,
      allowsUnsure: false,
      sourceId: OSGR,
      sourceSection: "The Open Seasons Game Regulations, 2009, the first subsection of each season section",
    },
  ],
  legalTime: legalTimeNotCertified(
    "Saskatchewan prohibits hunting from half an hour after sunset to half an hour before sunrise (The Wildlife " +
      "Regulations, 1981, s. 11(1)), and The Open Seasons Game Regulations s. 3(b) makes every time in them Central " +
      "Standard Time. North Ground states exact times for a point, not for a whole zone.",
    "Saskatchewan Ministry of Environment",
    WLR,
  ),
  legalTimeAt: (_speciesId, place, date) => {
    if (place.scope === "ZONE") return undefined;
    /* America/Regina from `SINGLE_ZONE_JURISDICTIONS`, which is Central Standard
       Time year-round — so the statutory basis in s. 3(b) and the observed clock
       coincide for most of the province. The Lloydminster exception is stated as a
       limitation rather than silently absorbed. */
    const timezone = timeZoneAtPoint("jurisdiction:ca-sk");
    return timezone ? legalTimeFor(SASKATCHEWAN_HOURS, place, date as IsoDate, timezone) : undefined;
  },
  standingLimitations: [
    general(
      "The Open Seasons Game Regulations, 2009 and The Wildlife Act, 1998 are the controlling source for this answer, " +
        "with The Wildlife Regulations, 1981 for legal hours and clothing. Every consolidation North Ground read marks " +
        "itself unofficial, and the dates shown are North Ground's derivation of standing month-and-day rules for this " +
        "period.",
    ),
    general(
      "YOU NEED THE LANDOWNER'S CONSENT. Saskatchewan prohibits hunting on any land without the consent of the owner " +
        "or occupant, except on vacant provincial land, and if you are charged the onus is on you to prove you had it " +
        "(The Wildlife Act, 1998, s. 41). Access to park land is governed by The Parks Act instead.",
    ),
    general(
      "Where a zone is open for a big game species, eight protected and national wildlife areas inside it are deemed " +
        "OPEN for that species — but Fort à la Corne Wildlife Management Unit and the St. Denis National Wildlife " +
        "Research Area are carved out, and provincial parks and recreation sites are closed except those the regulation " +
        "lists. North Ground holds no boundary for any of them, so none is resolved at a point.",
    ),
    general(
      "Many Saskatchewan seasons also reach provincial parks and recreation sites that North Ground holds no boundary " +
        "for, and those places are not in any rule here. A season shown for a zone says nothing about a park inside it.",
    ),
    general(
      "Zone boundaries are read live from the ministry's own service, and the ministry says the written descriptions " +
        "in The Wildlife Management Zones and Special Areas Boundaries Regulations, 1990 supersede them where they " +
        "disagree. Near a boundary, confirm which zone you are in.",
    ),
    /*
     * This said "except that the Lloydminster area observes Alberta time",
     * which was true until 2026 and is not true in this certified period. The
     * exception told a Lloydminster hunter their clock differed from the legal
     * basis when it does not, which is the direction of error nobody reports:
     * they would simply distrust a correct window. Verified against the
     * Government of Saskatchewan's own time page and Alberta's own: all of
     * Saskatchewan observes CST (UTC-6) year-round, there are currently no time
     * option areas, and Lloydminster's winter divergence ended when Alberta
     * adopted Alberta Time (UTC-6) year-round from November 2026.
     */
    general(
      "Legal hunting times are stated in Central Standard Time, and all of Saskatchewan observes Central Standard " +
        "Time year-round, so the clock the law uses is the clock you are on.",
    ),
    general(
      "This describes licensed hunting under The Wildlife Act, 1998. It does not describe harvesting under Treaty or " +
        "Aboriginal rights, which is a separate legal context, nor the subsistence-use barren-ground caribou licence " +
        "under The Wildlife Regulations, 1981 Part IX.1.",
    ),
  ],
  /*
   * FOUR SOURCES NO RULE CITES, AND THE ANSWER MAKES CLAIMS FROM ALL FOUR.
   *
   * Every encoded rule cites the Open Seasons Game Regulations, because that is
   * where the seasons are. But the standing limitations above state the law from
   * three other instruments — landowner consent and the Treaty-rights statement
   * from the Act, legal hours and clothing from The Wildlife Regulations, 1981,
   * and the written boundary descriptions that supersede the drawn geometry — and
   * the engine does not fold a legal-time rule's own source into the answer. So
   * without these the hunter would be shown a claim about consent or hours with
   * only the season table to check it against.
   *
   * The hunters' guide is deliberately NOT here. It is a summary used for the
   * cross-check and relied on for nothing in the answer; listing it beside the
   * regulations would imply it supports the result.
   */
  standingSourceIds: [ACT, WLR, BOUNDARIES, WMZ_SERVICE],
  describe: (dimension, value) => {
    if (dimension === "HUNT_METHOD") {
      return value === "BOW" ? "a bow" : value === "CROSSBOW" ? "a crossbow"
        : value === "MUZZLELOADER" ? "a muzzleloader" : value === "SHOTGUN" ? "a shotgun" : "a rifle";
    }
    return value;
  },
};

export function evaluateSaskatchewan(input: ConditionalInput): ConditionalEvaluation {
  return evaluateConditional(SASKATCHEWAN_BUNDLE, SASKATCHEWAN_VOCABULARY, input);
}

export function saskatchewanCoverageReport() {
  return {
    sourceVersion: SASKATCHEWAN_BUNDLE.sourceVersion,
    retrievedAt: SASKATCHEWAN_BUNDLE.retrievedAt,
    officialUnits: SASKATCHEWAN_BUNDLE.officialUnitCount,
    certifiedPeriod: SASKATCHEWAN_BUNDLE.certifiedPeriod,
    licenceClasses: SASKATCHEWAN_LICENCE_CLASSES.length,
    species: conditionalCoverage(SASKATCHEWAN_BUNDLE),
  };
}

/** The species Saskatchewan can answer for, derived from the bundle. */
export const SASKATCHEWAN_SPECIES: readonly string[] =
  [...new Set(SASKATCHEWAN_BUNDLE.rules.map((rule) => rule.speciesId))].sort();

/** Every implement the vocabulary offers, for a test that holds the two in step. */
export const SASKATCHEWAN_VOCABULARY_IMPLEMENTS = SASKATCHEWAN_IMPLEMENTS;
