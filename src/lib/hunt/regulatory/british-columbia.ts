import { legalTimeNotCertified } from "./legal-time.ts";
import { withinZoneFactsAt } from "./bc-closed-areas.ts";
import { britishColumbiaLegalTime } from "./british-columbia-legal-time.ts";
import { general } from "../limitation.ts";
import type { IsoDate, CanonicalId, SourceRecord } from "../../content-contract/index.ts";
import bundleJson from "../../../../content/regulatory/ca-bc-2026.json" with { type: "json" };
import {
  conditionalCoverage, evaluateConditional,
  type ConditionalBundle, type ConditionalEvaluation, type ConditionalInput, type ConditionalVocabulary,
} from "./conditional-engine.ts";

/**
 * British Columbia, bound to the jurisdiction-neutral engine.
 *
 * Data only: the bundle `scripts/build-british-columbia-regulations.mjs`
 * generates from the Hunting Regulation, B.C. Reg. 190/84, and the words the
 * regulation uses. The builder decides every range, closure, youth season and
 * bow only season from the law; nothing here does.
 *
 * What British Columbia adds to the vocabulary: bow only seasons, where the
 * Wildlife Act's "bow" is a longbow or crossbow, and youth seasons restricted
 * to persons under 18. Parts of units the law closes without a boundary North
 * Ground holds, and seasons on private property only, arrive as unresolved
 * areas: at a point inside such a unit the answer is NEEDS_VERIFICATION and
 * names the area.
 */

interface BritishColumbiaSource {
  id: string;
  authority: string;
  title: string;
  url: string;
  sourceHashes: Record<string, string>;
}

type BritishColumbiaBundle = Omit<ConditionalBundle, "sources"> & {
  officialUnitCount: number;
  contentHash: string;
  sources: BritishColumbiaSource[];
  limitations: string[];
  legalTime: { statedAs: string; section: string };
};

export const BRITISH_COLUMBIA_BUNDLE = bundleJson as unknown as BritishColumbiaBundle;

const REGULATION = "source:ca-bc-hunting-regulation";

export const BRITISH_COLUMBIA_VOCABULARY: ConditionalVocabulary = {
  jurisdictionName: "British Columbia",
  unitTerm: "Management Unit",
  dimensions: [
    {
      id: "HUNT_METHOD",
      question: "What will you be hunting with?",
      reason:
        "British Columbia sets some seasons for hunting with a bow only. The Wildlife Act defines a bow as a longbow or " +
        "crossbow, so the open dates depend on whether you carry a firearm or a bow.",
      options: [
        { value: "RIFLE", label: "Rifle" },
        { value: "SHOTGUN", label: "Shotgun" },
        { value: "MUZZLELOADER", label: "Muzzleloader" },
        { value: "CROSSBOW", label: "Crossbow", detail: "A bow under the Wildlife Act, so allowed in bow only seasons" },
        { value: "BOW", label: "Bow", detail: "Longbow, recurve or compound" },
      ],
      multiple: false,
      allowsUnsure: false,
      sourceId: REGULATION,
      sourceSection: "Wildlife Act s. 1 (\"bow\"); B.C. Reg. 190/84 Schedules 1–8, Part 2",
    },
    {
      id: "HUNTER_AGE",
      question: "Are you under 18?",
      reason:
        "British Columbia restricts some open seasons to persons who are less than 18 years of age (B.C. Reg. 190/84, " +
        "Part 2 of Schedules 3, 5 and 8).",
      options: [
        { value: "UNDER_18", label: "Under 18" },
        { value: "ADULT", label: "18 or older" },
      ],
      multiple: false,
      allowsUnsure: false,
      sourceId: REGULATION,
      sourceSection: "B.C. Reg. 190/84, Part 2 youth seasons",
    },
    {
      id: "ANIMAL_CLASS:ANTLER_CLASS",
      question: "Is the animal you intend to take a bull or buck, or antlerless?",
      reason:
        "British Columbia's general moose seasons are for bulls only. The regulation defines a bull or buck as one " +
        "bearing visible bony antlers, not including a calf.",
      options: [
        { value: "ANTLERED", label: "Bull or buck", detail: "Bearing visible bony antlers, not a calf (B.C. Reg. 190/84, s. 1)" },
        { value: "ANTLERLESS", label: "Antlerless", detail: "No visible bony antlers" },
      ],
      multiple: false,
      allowsUnsure: false,
      sourceId: REGULATION,
      sourceSection: "B.C. Reg. 190/84, s. 1 (\"buck\" or \"bull\")",
    },
    {
      id: "ANIMAL_CLASS:ANTLER_POINTS",
      question: "What antlers does the bull carry?",
      reason:
        "Most of British Columbia's general bull moose seasons are open only to a bull with no more than two points " +
        "on one antler; Region 7's northern units also allow a tripalm or ten-point bull.",
      options: [
        { value: "MOOSE_SPIKE_FORK", label: "Spike-fork", detail: "No more than two points (tines) on one antler", speciesIds: ["species:moose"] },
        {
          value: "MOOSE_TRIPALM_OR_TEN_POINT",
          label: "Tripalm or 10-point",
          detail: "A distinct brow palm with three or more points on at least one antler, or at least ten tines on one antler",
          speciesIds: ["species:moose"],
        },
        { value: "MOOSE_OTHER_BULL", label: "Any other bull", speciesIds: ["species:moose"] },
      ],
      multiple: false,
      allowsUnsure: false,
      sourceId: REGULATION,
      sourceSection: "B.C. Reg. 190/84, Schedules 3, 4, 7 and 8, Part 2",
    },
  ],
  /*
   * The rule IS certified and is encoded in `british-columbia-legal-time.ts` —
   * an hour either side, not the half-hour three other provinces use. What is
   * missing is not the law but the CLOCK: British Columbia spans Pacific and
   * Mountain time and the Peace River region keeps Mountain time year-round,
   * so North Ground cannot establish the timezone at a point here and a
   * wall-clock time cannot be stated. Naming the real blocker matters, because
   * "not certified" reads as though the regulation had not been read.
   */
  /* The fallback, for a zone-scoped question where no point is known. */
  legalTime: legalTimeNotCertified(
      `British Columbia: "${BRITISH_COLUMBIA_BUNDLE.legalTime.statedAs}" (${BRITISH_COLUMBIA_BUNDLE.legalTime.section}). ` +
      "North Ground states exact times for a point, not for a whole Management Unit.",
      "Government of British Columbia",
    ),
  legalTimeAt: (speciesId, place, date) => {
    if (place.scope === "ZONE") return undefined;
    /* BC resolves its own clock: it is date-bounded, and no caller should have
       to know that. An earlier date is refused with its reason rather than
       answered with today's reckoning. */
    return britishColumbiaLegalTime(speciesId, place, date as IsoDate);
  },
  standingLimitations: BRITISH_COLUMBIA_BUNDLE.limitations.map((text) => general(text)),
  // Legal hours (s. 14 (1)) and the meaning of the schedules (s. 4) come from the body of the regulation.
  standingSourceIds: [REGULATION],
  describe: (dimension, value) => {
    if (dimension === "HUNTER_AGE") return value === "UNDER_18" ? "hunters under 18" : "hunters 18 or older";
    if (dimension === "ANIMAL_CLASS:ANTLER_CLASS") return value === "ANTLERED" ? "bulls and bucks" : "antlerless animals";
    if (dimension === "ANIMAL_CLASS:ANTLER_POINTS") {
      return value === "MOOSE_SPIKE_FORK" ? "spike-fork bulls" : value === "MOOSE_TRIPALM_OR_TEN_POINT" ? "tripalm or ten-point bulls" : "other bulls";
    }
    return value;
  },
};

/**
 * The bare Management Unit designation, from the canonical zone id.
 *
 * NOT the zone's prose name. 76/84 lists units as the authority writes them —
 * "4-25", "3-19" — and the prose name is "Management Unit 4-25". Keyed on the
 * name, nothing would ever have matched: every row would have resolved to
 * UNKNOWN and the regulation would have been consulted and silently found
 * irrelevant everywhere. That is the exact silent-no-op this model replaced,
 * reintroduced one layer up, and it would have looked like working code.
 */
function managementUnitOf(zoneId: string | undefined): string | undefined {
  const prefix = "management_zone:ca-bc-mu-";
  return zoneId?.startsWith(prefix) ? zoneId.slice(prefix.length) : undefined;
}

export function evaluateBritishColumbia(input: ConditionalInput): ConditionalEvaluation {
  const evaluation = evaluateConditional(BRITISH_COLUMBIA_BUNDLE, BRITISH_COLUMBIA_VOCABULARY, input);

  /*
   * B.C. Reg. 76/84 prevails over this bundle's own regulation to the extent
   * of the conflict (s. 1.1), so its facts travel with every BC answer rather
   * than being merged into one. They are attached, never applied: today no
   * area can be placed, so none of them closes a season, and
   * `closesSeasonHere` says so rather than leaving a reader to infer it.
   */
  if (!evaluation.result) return evaluation;
  return {
    ...evaluation,
    result: {
      ...evaluation.result,
      withinZoneRestrictions: withinZoneFactsAt({
        area: managementUnitOf(input.place.zoneId),
        scope: input.place.scope === "ZONE" ? "ZONE" : "POINT",
      }),
    },
  };
}

/** Species with at least one certified British Columbia rule. */
export const BRITISH_COLUMBIA_SPECIES: readonly string[] = [
  ...new Set(BRITISH_COLUMBIA_BUNDLE.rules.filter((rule) => rule.reviewStatus === "VERIFIED" || rule.reviewStatus === "PUBLISHED").map((rule) => rule.speciesId)),
].sort();

export function britishColumbiaCoverageReport() {
  return {
    sourceVersion: BRITISH_COLUMBIA_BUNDLE.sourceVersion,
    retrievedAt: BRITISH_COLUMBIA_BUNDLE.retrievedAt,
    officialUnits: BRITISH_COLUMBIA_BUNDLE.officialUnitCount,
    certifiedPeriod: BRITISH_COLUMBIA_BUNDLE.certifiedPeriod,
    disputes: BRITISH_COLUMBIA_BUNDLE.rules.filter((rule) => rule.disputes.length).length,
    species: conditionalCoverage(BRITISH_COLUMBIA_BUNDLE),
  };
}

/** Source records for display, drawn from the bundle that cites them. */
export function britishColumbiaSourceRecords(ids: readonly string[]): SourceRecord[] {
  const wanted = new Set(ids);
  return BRITISH_COLUMBIA_BUNDLE.sources
    .filter((source) => wanted.has(source.id))
    .map((source) => ({
      id: source.id as CanonicalId<"source">,
      authority: source.authority,
      title: source.title,
      url: source.url,
      publisher: "Government of British Columbia",
      retrievedAt: `${BRITISH_COLUMBIA_BUNDLE.retrievedAt}T00:00:00Z`,
      type: "official" as const,
      jurisdictionIds: ["jurisdiction:ca-bc" as CanonicalId<"jurisdiction">],
      verificationStatus: "verified" as const,
      contentHash: BRITISH_COLUMBIA_BUNDLE.contentHash,
    }));
}
