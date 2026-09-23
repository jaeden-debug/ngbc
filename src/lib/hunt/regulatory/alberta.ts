import { legalTimeNotCertified } from "./legal-time.ts";
import { general } from "../limitation.ts";
import type { CanonicalId, IsoDate, SourceRecord } from "../../content-contract/index.ts";
import { timeZoneAtPoint } from "../time-zone.ts";
import { albertaLegalTime } from "./alberta-legal-time.ts";
import bundleJson from "../../../../content/regulatory/ca-ab-2026.json" with { type: "json" };
import {
  conditionalCoverage, evaluateConditional,
  type ConditionalBundle, type ConditionalEvaluation, type ConditionalInput, type ConditionalVocabulary,
} from "./conditional-engine.ts";

/**
 * Alberta, bound to the jurisdiction-neutral engine.
 *
 * Data only: the generated bundle and the words Alberta's guide uses. How a
 * range of WMUs expands, which cell a special-licence mark belongs to, which
 * Sundays are closed — the builder decides all of that from the source, and it
 * arrives here as rules.
 *
 * What Alberta adds to the engine's vocabulary is the special licence. A season
 * the guide marks ■ "appl[ies] only to hunters with applicable special
 * licences" — authorisations drawn through the Alberta Hunting Draws. North
 * Ground cannot see who holds one, so it asks, answers under the stated
 * assumption, and says it has not verified it.
 */

interface AlbertaSource {
  id: string;
  authority: string;
  title: string;
  url: string;
  sourceHashes: Record<string, string>;
  conditions?: ConditionalBundle["sources"][number]["conditions"];
}

type AlbertaBundle = Omit<ConditionalBundle, "sources"> & {
  officialUnitCount: number;
  contentHash: string;
  sources: AlbertaSource[];
  limitations: string[];
};

export const ALBERTA_BUNDLE = bundleJson as unknown as AlbertaBundle;

const GUIDE = "source:ca-ab-hunting-guide-2026";

export const ALBERTA_VOCABULARY: ConditionalVocabulary = {
  jurisdictionName: "Alberta",
  unitTerm: "Wildlife Management Unit",
  /* Asked in the order a hunter thinks about it: what they carry, what they
     are after, and only then whether they hold a drawn licence for it. */
  dimensions: [
    {
      id: "HUNT_METHOD",
      question: "What will you be hunting with?",
      reason:
        "Alberta's archery-only seasons allow only a bow and arrow; its general seasons allow a firearm, a crossbow " +
        "or a bow and arrow, so the open dates depend on what you carry.",
      options: [
        { value: "RIFLE", label: "Rifle" },
        { value: "SHOTGUN", label: "Shotgun" },
        { value: "MUZZLELOADER", label: "Muzzleloader" },
        { value: "CROSSBOW", label: "Crossbow", detail: "Not permitted in archery-only seasons" },
        { value: "BOW", label: "Bow and arrow", detail: "Needs a bowhunting permit as well as the licence" },
      ],
      multiple: false,
      allowsUnsure: false,
      sourceId: GUIDE,
      sourceSection: "p. 47, Big Game Seasons; p. 44, Bowhunting and crossbows",
    },
    {
      id: "ANIMAL_CLASS:ANTLER_CLASS",
      question: "Is the deer you intend to take antlered or antlerless?",
      reason:
        "Alberta sets separate white-tailed deer seasons for antlered and antlerless deer in many units, and some " +
        "antlerless seasons are open only to special-licence holders.",
      options: [
        { value: "ANTLERED", label: "Antlered", detail: "Has an antler longer than 10.2 cm (4 in.), as Alberta defines it" },
        { value: "ANTLERLESS", label: "Antlerless", detail: "Has no antler longer than 10.2 cm (4 in.)" },
      ],
      multiple: false,
      // Decided by looking at the animal; guessing at it is the failure that matters.
      allowsUnsure: false,
      sourceId: GUIDE,
      sourceSection: "p. 17, Definitions",
    },
    {
      id: "LICENCE_TYPE",
      question: "Do you hold an Alberta special licence for this species and class, valid in this WMU?",
      reason:
        "Alberta marks some seasons as open only to hunters with an applicable special licence from the Alberta " +
        "Hunting Draws. Holding a general licence does not open those seasons.",
      options: [
        { value: "SPECIAL", label: "Yes, a special licence valid here", detail: "Issued through the Alberta Hunting Draws for this species, class and WMU" },
        { value: "GENERAL", label: "No, a general licence only" },
      ],
      multiple: false,
      allowsUnsure: false,
      sourceId: GUIDE,
      sourceSection: "p. 47, Big Game Seasons (■)",
    },
  ],
  /*
   * The fallback, for a zone-scoped question where no point is known. The
   * point answer comes from `legalTimeAt` below and is computed from the ACT,
   * not from the guide this sentence used to cite: a summary is where the rule
   * is described, not where it is enacted.
   */
  legalTime: legalTimeNotCertified(
      "Alberta makes it unlawful to hunt wildlife, except by trapping, between one-half hour after sunset and " +
      "one-half hour before sunrise (Wildlife Act, RSA 2000, c. W-10, s. 28). North Ground states exact times for a " +
      "point, not for a whole zone.",
      "Government of Alberta",
    ),
  legalTimeAt: (speciesId, place, date) => {
    if (place.scope === "ZONE") return undefined;
    const timezone = timeZoneAtPoint("jurisdiction:ca-ab");
    return timezone ? albertaLegalTime(speciesId, place, date as IsoDate, timezone) : undefined;
  },
  standingLimitations: ALBERTA_BUNDLE.limitations.map((text) => general(text)),
  standingSourceIds: [],
  describe: (dimension, value) => {
    if (dimension === "LICENCE_TYPE") return value === "SPECIAL" ? "special-licence holders" : "general licence holders";
    if (dimension === "ANIMAL_CLASS:ANTLER_CLASS") return value === "ANTLERED" ? "antlered deer" : "antlerless deer";
    return value;
  },
};

export function evaluateAlberta(input: ConditionalInput): ConditionalEvaluation {
  return evaluateConditional(ALBERTA_BUNDLE, ALBERTA_VOCABULARY, input);
}

/** Species with at least one certified Alberta rule. */
export const ALBERTA_SPECIES: readonly string[] = [
  ...new Set(ALBERTA_BUNDLE.rules.filter((rule) => rule.reviewStatus === "VERIFIED" || rule.reviewStatus === "PUBLISHED").map((rule) => rule.speciesId)),
].sort();

export function albertaCoverageReport() {
  return {
    sourceVersion: ALBERTA_BUNDLE.sourceVersion,
    retrievedAt: ALBERTA_BUNDLE.retrievedAt,
    officialUnits: ALBERTA_BUNDLE.officialUnitCount,
    certifiedPeriod: ALBERTA_BUNDLE.certifiedPeriod,
    disputes: ALBERTA_BUNDLE.rules.filter((rule) => rule.disputes.length).length,
    species: conditionalCoverage(ALBERTA_BUNDLE),
  };
}

/** Source records for display, drawn from the bundle that cites them. */
export function albertaSourceRecords(ids: readonly string[]): SourceRecord[] {
  const wanted = new Set(ids);
  return ALBERTA_BUNDLE.sources
    .filter((source) => wanted.has(source.id))
    .map((source) => ({
      id: source.id as CanonicalId<"source">,
      authority: source.authority,
      title: source.title,
      url: source.url,
      publisher: "Government of Alberta",
      retrievedAt: `${ALBERTA_BUNDLE.retrievedAt}T00:00:00Z`,
      type: "official" as const,
      jurisdictionIds: ["jurisdiction:ca-ab" as CanonicalId<"jurisdiction">],
      verificationStatus: "verified" as const,
      contentHash: ALBERTA_BUNDLE.contentHash,
    }));
}
