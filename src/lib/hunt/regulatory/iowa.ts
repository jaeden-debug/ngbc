import { general } from "../limitation.ts";
import { legalTimeFor, legalTimeNotCertified, type LegalTimeRule } from "./legal-time.ts";
import { timeZoneAtPoint } from "../time-zone.ts";
import { unitedStatesStateSource } from "../united-states/state-boundary.ts";
import type { CanonicalId, IsoDate, SourceRecord } from "../../content-contract/index.ts";
import bundleJson from "../../../../content/regulatory/us-ia-2026.json" with { type: "json" };
import {
  conditionalCoverage, evaluateConditional,
  type ConditionalBundle, type ConditionalEvaluation, type ConditionalInput, type ConditionalVocabulary,
} from "./conditional-engine.ts";

/**
 * Iowa, bound to the jurisdiction-neutral engine — the first bundle whose
 * geography is the whole jurisdiction rather than a set of units.
 *
 * The findings live in `scripts/build-iowa-regulations.mjs` and in the bundle's
 * own fields. Three things to know before changing anything:
 *
 *  1. EVERY RULE IS `include.jurisdiction`. Iowa publishes no small-game units
 *     and chapter 96 says "Entire state open." A point reaches these rules only
 *     by being placed in Iowa — today by the Census state boundary
 *     (`jurisdiction-scope.ts`), never by a zone id. Ruffed grouse, the one
 *     season the chapter scopes to part of the state, is refused rather than
 *     answered across the state.
 *  2. FALCONRY IS ITS OWN SEASON (96.9), so the method is a real question: a
 *     falconer's season, sexes and limits differ, and the regular seasons
 *     state no implement because which weapons are lawful is set elsewhere.
 *  3. HOURS BELONG TO THE SPECIES' REGULAR SEASON. Chapter 96 states them per
 *     species and none for falconry, so a falconer is told hours are not
 *     certified rather than shown the gun season's clock.
 */

type IowaSource = ConditionalBundle["sources"][number] & { title: string; url: string; authority: string; edition: string; contentHash: string };

/* `officialUnitCount` is null in the bundle: Iowa publishes no units for these rules. */
type IowaBundle = Omit<ConditionalBundle, "sources"> & {
  sources: IowaSource[];
  legalHours: Record<string, (LegalTimeRule | { basis: "NO_RESTRICTION"; statedAs: string; section: string; sourceId: string })>;
  closedOutsideSeason: { statedAs: string; section: string; sourceId: string };
  deliberatelyNotEncoded: Array<{ what: string; reason: string; detail: string }>;
};

export const IOWA_BUNDLE = bundleJson as unknown as IowaBundle;

const IAC = "source:us-ia-iac-571-96" as CanonicalId<"source">;
const AUTHORITY = "Iowa Department of Natural Resources (Natural Resource Commission rules)";

export const IOWA_VOCABULARY: ConditionalVocabulary = {
  jurisdictionName: "Iowa",
  unitTerm: "State of Iowa",
  /*
   * Asked in this order, and only where the answer changes the outcome.
   * Falconry first, because it decides which season exists at all; residency
   * and age only matter on the youth pheasant weekend.
   */
  dimensions: [
    {
      id: "HUNT_METHOD",
      ruleKey: "byFalconry",
      question: "Will you be hunting by falconry?",
      reason:
        "Iowa gives falconry its own seasons and limits (571 IAC 96.9): longer, and with lower bag limits, than the regular seasons.",
      options: [
        { value: "FALCONRY", label: "Falconry", detail: "With a trained raptor and a falconry permit" },
        { value: "NOT_FALCONRY", label: "Another method", detail: "Which weapons are lawful is set outside chapter 96 and not certified here" },
      ],
      multiple: false,
      allowsUnsure: false,
      sourceId: IAC,
      sourceSection: "571 IAC 96.9",
    },
    {
      id: "RESIDENCY",
      question: "Are you an Iowa resident?",
      reason: "Iowa's youth pheasant weekend is for residents only (571 IAC 96.1(3)).",
      options: [
        { value: "IOWA_RESIDENT", label: "Iowa resident" },
        { value: "NON_RESIDENT", label: "Not an Iowa resident" },
      ],
      multiple: false,
      allowsUnsure: false,
      sourceId: IAC,
      sourceSection: "571 IAC 96.1(3)",
    },
    {
      id: "HUNTER_AGE",
      question: "Is the hunter 15 or younger?",
      reason: "Iowa's youth pheasant weekend is for hunters 15 years old or younger (571 IAC 96.1(3)).",
      options: [
        { value: "15_OR_YOUNGER", label: "15 or younger" },
        { value: "16_OR_OLDER", label: "16 or older" },
      ],
      multiple: false,
      allowsUnsure: false,
      sourceId: IAC,
      sourceSection: "571 IAC 96.1(3)",
    },
  ],
  legalTime: legalTimeNotCertified(
    "Iowa states shooting hours per species in 571 IAC chapter 96. North Ground states them for an exact point.",
    AUTHORITY,
    IAC,
  ),
  legalTimeAt: (speciesId, place, date, answers) => {
    if (place.scope === "ZONE") return undefined;
    if (answers?.HUNT_METHOD === "FALCONRY") {
      return legalTimeNotCertified(
        "571 IAC 96.9 sets falconry seasons and limits and states no shooting hours for them, so North Ground states none; " +
          "the hours in 96.1–96.8 are written for each species' regular season.",
        AUTHORITY,
        IAC,
      );
    }
    const rule = IOWA_BUNDLE.legalHours[speciesId];
    if (!rule) return undefined;
    if (rule.basis === "NO_RESTRICTION") {
      /* A stated absence of restriction, quoted — not a window North Ground failed to find. */
      return legalTimeNotCertified(
        `Iowa states “${rule.statedAs}” (${rule.section}), so no hourly window applies to this season.`,
        AUTHORITY,
        rule.sourceId as CanonicalId<"source">,
      );
    }
    /* Iowa lies wholly in the central zone (`SINGLE_ZONE_JURISDICTIONS`, on 49 CFR Part 71). */
    const timezone = timeZoneAtPoint("jurisdiction:us-ia");
    return timezone ? legalTimeFor(rule as LegalTimeRule, place, date as IsoDate, timezone) : undefined;
  },
  standingLimitations: [
    general(
      "571 IAC chapter 96 (IAC 5/14/25) is the controlling source for these seasons, bag limits and shooting hours. Each window is a " +
        "standing rule written over weekdays; the dates shown are North Ground's derivation of it. Outside an open season Iowa Code " +
        "§481A.48(1) prohibits taking these species.",
    ),
    general(
      "Licences, the habitat stamp, hunter orange (Iowa Code §481A.122) and which weapons are lawful are set in instruments North Ground " +
        "has not certified, so this answer states none of them in either direction.",
    ),
    general(
      "Being in Iowa is not permission to hunt there. Wildlife refuges closed to hunting, federal land with its own rules and tribal " +
        "land are separate instruments with their own geography, and none of them is checked at this point.",
    ),
    general(
      "This describes hunting under Iowa's state law. It does not describe hunting by tribal members under tribal or federal law, " +
        "which is a separate legal context.",
    ),
  ],
  standingSourceIds: [],
  describe: (dimension, value) => {
    if (dimension === "HUNT_METHOD") return value === "FALCONRY" ? "falconry" : "a method other than falconry";
    if (dimension === "RESIDENCY") return value === "IOWA_RESIDENT" ? "Iowa residents" : "non-residents";
    if (dimension === "HUNTER_AGE") return value === "15_OR_YOUNGER" ? "hunters 15 or younger" : "hunters 16 or older";
    return value;
  },
};

export function evaluateIowa(input: ConditionalInput): ConditionalEvaluation {
  return evaluateConditional(IOWA_BUNDLE as ConditionalBundle, IOWA_VOCABULARY, input);
}

/**
 * Iowa publishes no units for these rules, so there is no unit count: the
 * coverage rows say how many rules and species are certified, and every unit
 * figure is zero because there are no units to count, not because none is
 * covered.
 */
export function iowaCoverageReport() {
  return {
    sourceVersion: IOWA_BUNDLE.sourceVersion,
    retrievedAt: IOWA_BUNDLE.retrievedAt,
    officialUnits: null,
    certifiedPeriod: IOWA_BUNDLE.certifiedPeriod,
    species: conditionalCoverage(IOWA_BUNDLE as ConditionalBundle),
  };
}

/** Records for the sources this bundle cites, and for the boundary that places a point in Iowa. */
export function iowaSourceRecords(ids: readonly string[]): SourceRecord[] {
  const records: SourceRecord[] = [
    ...IOWA_BUNDLE.sources.map((source): SourceRecord => ({
      id: source.id as CanonicalId<"source">,
      authority: source.authority,
      title: `${source.title} (${source.edition})`,
      url: source.url,
      publisher: "Iowa Legislature",
      retrievedAt: `${IOWA_BUNDLE.retrievedAt}T00:00:00Z` as SourceRecord["retrievedAt"],
      type: "official",
      jurisdictionIds: ["jurisdiction:us-ia" as CanonicalId<"jurisdiction">],
      verificationStatus: "verified",
      contentHash: source.contentHash,
    })),
    unitedStatesStateSource(`${IOWA_BUNDLE.retrievedAt}T00:00:00Z`),
  ];
  return records.filter((record) => ids.includes(record.id));
}

/** The species Iowa answers for, derived from the bundle. */
export const IOWA_SPECIES: readonly string[] = [...new Set(IOWA_BUNDLE.rules.map((rule) => rule.speciesId))].sort();
