import { general } from "../limitation.ts";
import type { CanonicalId, SourceRecord } from "../../content-contract/index.ts";
import bundleJson from "../../../../content/regulatory/us-id-pronghorn-2026.json" with { type: "json" };
import {
  conditionalCoverage, evaluateConditional,
  type ConditionalBundle, type ConditionalEvaluation, type ConditionalInput, type ConditionalVocabulary,
} from "./conditional-engine.ts";

/**
 * Idaho, bound to the shared engine. Data only: the bundle generated from the
 * 2026 Big Game Seasons and Rules, and the words Idaho uses.
 *
 * All Idaho pronghorn hunting is by controlled hunt, so the one fact an answer
 * turns on is which controlled hunt the hunter's tag is for. The question
 * offers only the hunts whose area reaches this place; the hunt number then
 * fixes the dates, weapon, animal class and age, so nothing else is asked.
 * North Ground never assumes the hunter was drawn.
 */

type IdahoBundle = Omit<ConditionalBundle, "sources"> & {
  officialUnitCount: number;
  contentHash: string;
  sources: Array<{ id: string; title: string; url: string; authority: string; conditions?: ConditionalBundle["sources"][number]["conditions"] }>;
  sourceRecords: Array<{ id: string; authority: string; title: string; url: string }>;
  limitations: string[];
};

export const IDAHO_BUNDLE = bundleJson as unknown as IdahoBundle;

const BOOKLET = "source:us-id-big-game-seasons-2026";

export const IDAHO_VOCABULARY: ConditionalVocabulary = {
  jurisdictionName: "Idaho",
  unitTerm: "Game Management Unit",
  dimensions: [
    {
      id: "HUNT_CODE",
      question: "Which pronghorn controlled hunt is your tag for?",
      reason: "All pronghorn hunting in Idaho, including archery seasons, is by controlled hunt; each tag is valid for one hunt number.",
      // Offered per place: only hunts whose area reaches this point are listed.
      valuesFrom: "PLACE",
      options: (IDAHO_BUNDLE.huntCodes ?? []).map((huntCode) => {
        const rule = IDAHO_BUNDLE.rules.find((candidate) => candidate.huntCodeId === huntCode.id);
        return { value: huntCode.code, label: `Hunt ${huntCode.code}`, detail: rule?.seasonLabel.replace(/^Controlled hunt \d+ /, "") };
      }),
      multiple: false,
      allowsUnsure: false,
      sourceId: BOOKLET,
      sourceSection: "pp. 63–66, Pronghorn Controlled Hunts",
    },
  ],
  legalTime: {
    status: "RULE_ONLY",
    // Quoted from p. 95; the builder stops if this wording changes.
    text:
      "Idaho: “Big game animals may be hunted only from one-half hour before sunrise to one-half hour after sunset” (p. 95). " +
      "North Ground has not certified exact astronomical times.",
  },
  standingLimitations: IDAHO_BUNDLE.limitations.map((text) => general(text)),
  standingSourceIds: ["source:us-id-gmu-service"],
  describe: (dimension, value) => (dimension === "HUNT_CODE" ? `controlled hunt ${value}` : value),
};

export function evaluateIdaho(input: ConditionalInput): ConditionalEvaluation {
  return evaluateConditional(IDAHO_BUNDLE, IDAHO_VOCABULARY, input);
}

export function idahoCoverageReport() {
  return {
    sourceVersion: IDAHO_BUNDLE.sourceVersion,
    retrievedAt: IDAHO_BUNDLE.retrievedAt,
    officialUnits: IDAHO_BUNDLE.officialUnitCount,
    certifiedPeriod: IDAHO_BUNDLE.certifiedPeriod,
    species: conditionalCoverage(IDAHO_BUNDLE),
  };
}

export function idahoSourceRecords(ids: readonly string[]): SourceRecord[] {
  const wanted = new Set(ids);
  return IDAHO_BUNDLE.sourceRecords
    .filter((source) => wanted.has(source.id))
    .map((source) => ({
      id: source.id as CanonicalId<"source">,
      authority: source.authority,
      title: source.title,
      url: source.url,
      publisher: source.authority,
      retrievedAt: `${IDAHO_BUNDLE.retrievedAt}T00:00:00Z`,
      type: "official" as const,
      jurisdictionIds: ["jurisdiction:us-id" as CanonicalId<"jurisdiction">],
      verificationStatus: "verified" as const,
      contentHash: IDAHO_BUNDLE.contentHash,
    }));
}
