import { general } from "../limitation.ts";
import { legalTimeFor, legalTimeNotCertified, type LegalTimeRule } from "./legal-time.ts";
import { timeZoneAtPoint } from "../time-zone.ts";
import type { CanonicalId, IsoDate, SourceRecord } from "../../content-contract/index.ts";
import bundleJson from "../../../../content/regulatory/ca-pe-2026.json" with { type: "json" };
import {
  conditionalCoverage, evaluateConditional,
  type ConditionalBundle, type ConditionalEvaluation, type ConditionalInput, type ConditionalVocabulary,
} from "./conditional-engine.ts";

/**
 * Prince Edward Island, bound to the jurisdiction-neutral engine.
 *
 * Every rule is `include.jurisdiction`: the province publishes no hunting
 * units and its seasons regulation names none, so a point reaches these rules
 * through `layer:ca-pe-province` (geography level JURISDICTION, no zone id).
 * The one sub-provincial rule — no partridge season in Lots 1 to 10 and 43 to
 * 47 — is an unresolved area inside the province, so partridge answers "needs a
 * closer look" rather than open anywhere North Ground cannot place.
 * The findings live in `scripts/build-prince-edward-island-regulations.mjs`.
 */

type PeiSource = ConditionalBundle["sources"][number] & { title: string; url: string; authority: string; edition: string; contentHash: string };

type PeiBundle = Omit<ConditionalBundle, "sources"> & {
  sources: PeiSource[];
  legalHours: LegalTimeRule;
  deliberatelyNotEncoded: Array<{ what: string; reason: string; detail: string }>;
};

export const PRINCE_EDWARD_ISLAND_BUNDLE = bundleJson as unknown as PeiBundle;

const AUTHORITY = "Prince Edward Island Department of Environment, Energy and Climate Action";

export const PRINCE_EDWARD_ISLAND_VOCABULARY: ConditionalVocabulary = {
  jurisdictionName: "Prince Edward Island",
  unitTerm: "Province of Prince Edward Island",
  /* No question changes a Prince Edward Island season: Schedule I states one
     season per species for every hunter. */
  dimensions: [],
  legalTime: legalTimeNotCertified(
    "Prince Edward Island prohibits hunting game from half an hour after sunset to half an hour before the next sunrise " +
      "(Hunting Regulations s. 2(1)(a)). North Ground states exact times for a point, not for the whole province.",
    AUTHORITY,
  ),
  legalTimeAt: (_speciesId, place, date) => {
    if (place.scope === "ZONE") return undefined;
    const timezone = timeZoneAtPoint("jurisdiction:ca-pe");
    return timezone ? legalTimeFor(PRINCE_EDWARD_ISLAND_BUNDLE.legalHours, place, date as IsoDate, timezone) : undefined;
  },
  standingLimitations: [
    general(
      "Prince Edward Island's Hunting and Trapping Seasons Regulations, as consolidated to September 3, 2022, are the controlling source " +
        "for these seasons and limits; the province's 2025 Hunting Summary agrees with them. An amendment made since that consolidation " +
        "would not be reflected here.",
    ),
    general(
      "Being in Prince Edward Island is not permission to hunt there. Private land, the Trespass to Property Act, parks and other closed " +
        "lands are separate questions North Ground has not resolved here.",
    ),
    general(
      "This describes licensed hunting under Prince Edward Island's Wildlife Conservation Act. It does not describe harvesting under " +
        "Treaty or Aboriginal rights, which is a separate legal context.",
    ),
  ],
  standingSourceIds: [],
  describe: (_dimension, value) => value,
};

export function evaluatePrinceEdwardIsland(input: ConditionalInput): ConditionalEvaluation {
  return evaluateConditional(PRINCE_EDWARD_ISLAND_BUNDLE as ConditionalBundle, PRINCE_EDWARD_ISLAND_VOCABULARY, input);
}

/** The province publishes no units, so every unit figure is zero because there are none to count. */
export function princeEdwardIslandCoverageReport() {
  return {
    sourceVersion: PRINCE_EDWARD_ISLAND_BUNDLE.sourceVersion,
    retrievedAt: PRINCE_EDWARD_ISLAND_BUNDLE.retrievedAt,
    officialUnits: null,
    certifiedPeriod: PRINCE_EDWARD_ISLAND_BUNDLE.certifiedPeriod,
    species: conditionalCoverage(PRINCE_EDWARD_ISLAND_BUNDLE as ConditionalBundle),
  };
}

export function princeEdwardIslandSourceRecords(ids: readonly string[]): SourceRecord[] {
  return PRINCE_EDWARD_ISLAND_BUNDLE.sources
    .filter((source) => ids.includes(source.id))
    .map((source): SourceRecord => ({
      id: source.id as CanonicalId<"source">,
      authority: source.authority,
      title: `${source.title} (${source.edition})`,
      url: source.url,
      publisher: "Government of Prince Edward Island",
      retrievedAt: `${PRINCE_EDWARD_ISLAND_BUNDLE.retrievedAt}T00:00:00Z` as SourceRecord["retrievedAt"],
      type: "official",
      jurisdictionIds: ["jurisdiction:ca-pe" as CanonicalId<"jurisdiction">],
      verificationStatus: "verified",
      contentHash: source.contentHash,
    }));
}

/** The species Prince Edward Island answers for, derived from the bundle. */
export const PRINCE_EDWARD_ISLAND_SPECIES: readonly string[] = [
  ...new Set(PRINCE_EDWARD_ISLAND_BUNDLE.rules.map((rule) => rule.speciesId)),
].sort();
