import type { CanonicalId, SourceRecord } from "../../content-contract/index.ts";
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
  ],
  legalTime: {
    status: "RULE_ONLY",
    text:
      `British Columbia: "${BRITISH_COLUMBIA_BUNDLE.legalTime.statedAs}" (${BRITISH_COLUMBIA_BUNDLE.legalTime.section}). ` +
      "North Ground has not certified exact astronomical times for this result.",
  },
  standingLimitations: BRITISH_COLUMBIA_BUNDLE.limitations,
  // Legal hours (s. 14 (1)) and the meaning of the schedules (s. 4) come from the body of the regulation.
  standingSourceIds: [REGULATION],
  describe: (dimension, value) => {
    if (dimension === "HUNTER_AGE") return value === "UNDER_18" ? "hunters under 18" : "hunters 18 or older";
    return value;
  },
};

export function evaluateBritishColumbia(input: ConditionalInput): ConditionalEvaluation {
  return evaluateConditional(BRITISH_COLUMBIA_BUNDLE, BRITISH_COLUMBIA_VOCABULARY, input);
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
