import type { CanonicalId, IsoDate, SourceRecord } from "../../content-contract/index.ts";
import bundleJson from "../../../../content/regulatory/ca-mb-2026.json" with { type: "json" };
import overlaysJson from "../../../../content/regulatory/ca-mb-overlays.json" with { type: "json" };
import overlayZonesJson from "../../../../content/regulatory/ca-mb-overlay-zones.json" with { type: "json" };
import type { OverlayZoneIndex } from "../overlay-zones.ts";
import type { OverlayCatalogue } from "../overlays.ts";
import {
  conditionalCoverage, evaluateConditional,
  type ConditionalBundle, type ConditionalEvaluation, type ConditionalInput, type ConditionalVocabulary,
} from "./conditional-engine.ts";

/**
 * Manitoba, bound to the jurisdiction-neutral engine.
 *
 * This file is data: the generated bundle and the words Manitoba's law uses.
 * There is no Manitoba logic here. Anything that would be — how a range of
 * areas expands, what "archery" permits, where a grouse season applies — is
 * decided by the builder from the regulation and arrives in the bundle.
 */

interface ManitobaSource {
  id: string;
  conditions?: ConditionalBundle["sources"][number]["conditions"];
  title: string;
  url: string;
  authority: string;
  hierarchy: string;
  version: string;
  effectiveFrom?: string;
  contentHash: string;
  retrievedAt: string;
}

type ManitobaBundle = Omit<ConditionalBundle, "sources"> & {
  officialUnitCount: number;
  sources: ManitobaSource[];
  crossCheck: { disputes: unknown[]; regulationControls: unknown[] };
};

export const MANITOBA_BUNDLE = bundleJson as unknown as ManitobaBundle;

const SEASONS = "source:ca-mb-hunting-seasons-regulation";

/* ── The questions, in Manitoba's terms ─────────────────────────────────── */

const MANITOBA_RESIDENT = "MANITOBA_RESIDENT";
const CANADIAN_RESIDENT = "CANADIAN_RESIDENT";
const NON_CANADIAN_RESIDENT = "NON_CANADIAN_RESIDENT";

const LICENCES: Array<{ value: string; label: string; detail?: string; residency: string }> = [
  { value: "MB_RESIDENT_GENERAL_WTD", label: "Manitoba resident general white-tailed deer licence", detail: "Or the white-tailed deer and game bird licence (youth)", residency: MANITOBA_RESIDENT },
  { value: "MB_RESIDENT_SECOND_WTD", label: "Manitoba resident second white-tailed deer licence", detail: "One antlerless deer; used together with a general licence", residency: MANITOBA_RESIDENT },
  { value: "MB_RESIDENT_THIRD_WTD", label: "Manitoba resident third white-tailed deer licence", detail: "One antlerless deer; used together with a general and a second licence", residency: MANITOBA_RESIDENT },
  { value: "CANADIAN_RESIDENT_GENERAL_WTD", label: "Canadian resident general white-tailed deer licence", residency: CANADIAN_RESIDENT },
  { value: "NON_CANADIAN_GENERAL_WTD", label: "Non-Canadian resident general white-tailed deer licence", residency: NON_CANADIAN_RESIDENT },
  { value: "NON_CANADIAN_ARCHERY_WTD", label: "Non-Canadian resident archery white-tailed deer licence", residency: NON_CANADIAN_RESIDENT },
  { value: "NON_CANADIAN_MUZZLELOADER_WTD", label: "Non-Canadian resident muzzleloader white-tailed deer licence", residency: NON_CANADIAN_RESIDENT },
  { value: "MB_RESIDENT_GAME_BIRD", label: "Manitoba resident game bird licence", detail: "Or the white-tailed deer and game bird licence (youth)", residency: MANITOBA_RESIDENT },
  { value: "CANADIAN_RESIDENT_GAME_BIRD", label: "Canadian resident game bird licence", residency: CANADIAN_RESIDENT },
  { value: "NON_CANADIAN_UPLAND_GAME_BIRD", label: "Non-Canadian resident upland game bird licence", residency: NON_CANADIAN_RESIDENT },
];

export const MANITOBA_VOCABULARY: ConditionalVocabulary = {
  jurisdictionName: "Manitoba",
  unitTerm: "Game Hunting Area",
  dimensions: [
    {
      id: "RESIDENCY",
      question: "Which Manitoba residency class applies to you?",
      reason:
        "Manitoba issues separate licences to Manitoba residents, other Canadian residents and non-Canadian residents, " +
        "and the areas and seasons each licence opens are different.",
      options: [
        { value: MANITOBA_RESIDENT, label: "Manitoba resident", detail: "Primary residence in Manitoba, and lived here at least six consecutive months of the last twelve" },
        { value: CANADIAN_RESIDENT, label: "Canadian resident", detail: "A Canadian citizen or permanent resident, or someone living in Canada, who is not a Manitoba resident" },
        { value: NON_CANADIAN_RESIDENT, label: "Non-Canadian resident", detail: "Neither a Manitoba resident nor a Canadian resident" },
      ],
      multiple: false,
      allowsUnsure: false,
      sourceId: "source:ca-mb-hunting-guide-2026",
      sourceSection: "Residency classes, 2026 Manitoba Hunting Guide p. 7; licence parts, M.R. 165/91 Schedules A and B",
    },
    {
      id: "LICENCE_TYPE",
      question: "Which licence will you hunt under?",
      reason:
        "Manitoba's regulation says a licence lets you hunt only in the areas, with the equipment and in the seasons it designates " +
        "for that licence (M.R. 165/91 s. 3), so which seasons are open depends on the licence you hold.",
      options: LICENCES.map(({ value, label, detail }) => ({ value, label, ...(detail ? { detail } : {}) })),
      implies: Object.fromEntries(LICENCES.map((licence) => [licence.value, { RESIDENCY: licence.residency }])),
      multiple: false,
      allowsUnsure: false,
      sourceId: SEASONS,
      sourceSection: "M.R. 165/91 s. 3; Schedules A and B",
    },
    {
      id: "HUNT_METHOD",
      question: "What will you be hunting with?",
      reason:
        "Manitoba states each season by equipment. “Archery” means a long, recurved or compound bow and does not include " +
        "a crossbow (M.R. 165/91 s. 3.3), so the open dates depend on what you carry.",
      options: [
        { value: "RIFLE", label: "Rifle", detail: "Centrefire; rimfire rifles cannot be used for big game" },
        { value: "SHOTGUN", label: "Shotgun" },
        { value: "MUZZLELOADER", label: "Muzzleloader" },
        { value: "CROSSBOW", label: "Crossbow" },
        { value: "BOW", label: "Bow", detail: "Long, recurved or compound bow" },
      ],
      multiple: false,
      allowsUnsure: false,
      sourceId: SEASONS,
      sourceSection: "M.R. 165/91 ss. 3.3, 3.4; Schedule B",
    },
    {
      id: "HUNTER_AGE",
      question: "Are you under 18?",
      reason:
        "Manitoba opens an earlier muzzleloader and crossbow season to hunters under 18 only (M.R. 165/91 Schedule B, Part A, footnote 1).",
      options: [
        { value: "UNDER_18", label: "Under 18" },
        { value: "ADULT", label: "18 or older" },
      ],
      multiple: false,
      allowsUnsure: false,
      sourceId: SEASONS,
      sourceSection: "M.R. 165/91 Schedule B, Part A, footnote 1",
    },
  ],
  legalTime: {
    status: "RULE_ONLY",
    text:
      "Manitoba prohibits hunting wildlife between half an hour after sunset and half an hour before sunrise the following day " +
      "(General Hunting Regulation, M.R. 351/87 s. 3). North Ground has not certified exact astronomical times for this result.",
  },
  standingLimitations: [
    "M.R. 165/91 is the controlling source for this answer. The 2026 Manitoba Hunting Guide is a summary and was used only to cross-check it.",
    "Game Hunting Area boundaries are the province's map of the written descriptions in M.R. 220/86, which control. Near a boundary, confirm which area you are in.",
    "Being inside a Game Hunting Area is not permission to hunt there. Private land, First Nation reserve land, parks, refuges, wildlife management areas and other closed lands are separate questions North Ground has not resolved here.",
    "This describes licensed hunting under Manitoba's Wildlife Act. It does not describe harvesting under Treaty or Aboriginal rights, which is a separate legal context.",
  ],
  standingSourceIds: [],
  describe: (dimension, value) => {
    if (dimension === "HUNTER_AGE" && value === "UNDER_18") return "under age 18 only";
    if (dimension === "LICENCE_TYPE") return LICENCES.find((licence) => licence.value === value)?.label ?? value;
    if (dimension === "RESIDENCY") return value === MANITOBA_RESIDENT ? "Manitoba residents" : value === CANADIAN_RESIDENT ? "Canadian residents" : "non-Canadian residents";
    return value;
  },
};

/* ── Overlapping land ───────────────────────────────────────────────────── */

/** Refuges, special conservation areas, WMAs and lands closed to hunting. */
/* Manitoba's layers are licensed for redistribution (OpenMB Information and Data
   Use Licence), so each may be read from its stored copy while that copy is
   current; see `scripts/ingest-special-areas.mjs`. */
export const MANITOBA_OVERLAYS: OverlayCatalogue = {
  ...(overlaysJson as unknown as OverlayCatalogue),
  layers: (overlaysJson as unknown as OverlayCatalogue).layers.map((layer) => ({ ...layer, storedLayerId: `special_layer:ca-mb-${layer.key}` })),
};

/** Which of those areas lie inside each GHA, from `scripts/build-overlay-zone-index.mjs`. */
export const MANITOBA_OVERLAY_ZONES = overlayZonesJson as unknown as OverlayZoneIndex;

/**
 * Which restriction tokens reach a species. "firearm" reaches both species:
 * a grouse hunter and most deer hunters carry one, and the conservative reading
 * of a firearm ban is that it affects the hunt. Mule deer, moose or elk tokens
 * never reach white-tailed deer, and "big game other than white-tailed deer"
 * — the Macdonald part of GHA 38 — deliberately does not either.
 */
const RESTRICTION_TOKENS: Record<string, readonly string[]> = {
  "species:ruffed-grouse": ["all", "entry_closure_order", "wildlife", "game_bird", "upland_game_bird", "firearm", "firearm_unless_big_game_or_trapping"],
  "species:spruce-grouse": ["all", "entry_closure_order", "wildlife", "game_bird", "upland_game_bird", "firearm", "firearm_unless_big_game_or_trapping"],
  "species:sharp-tailed-grouse": ["all", "entry_closure_order", "wildlife", "game_bird", "upland_game_bird", "firearm", "firearm_unless_big_game_or_trapping"],
  "species:white-tailed-deer": ["all", "entry_closure_order", "wildlife", "big_game", "deer", "firearm", "centrefire_rifle"],
};

export function restrictionTokensFor(speciesId: string): readonly string[] {
  // A species with no declared tokens is reached by everything: never silently by nothing.
  return RESTRICTION_TOKENS[speciesId] ?? ["*"];
}

/* ── Evaluation ─────────────────────────────────────────────────────────── */

export function evaluateManitoba(input: ConditionalInput): ConditionalEvaluation {
  return evaluateConditional(MANITOBA_BUNDLE, MANITOBA_VOCABULARY, input);
}

/** Species with at least one certified Manitoba rule. */
export const MANITOBA_SPECIES: readonly string[] = [
  ...new Set(MANITOBA_BUNDLE.rules.filter((rule) => rule.reviewStatus === "VERIFIED" || rule.reviewStatus === "PUBLISHED").map((rule) => rule.speciesId)),
].sort();

export function manitobaCoverageReport() {
  return {
    sourceVersion: MANITOBA_BUNDLE.sourceVersion,
    retrievedAt: MANITOBA_BUNDLE.retrievedAt,
    officialUnits: MANITOBA_BUNDLE.officialUnitCount,
    certifiedPeriod: MANITOBA_BUNDLE.certifiedPeriod,
    disputes: MANITOBA_BUNDLE.crossCheck.disputes.length,
    species: conditionalCoverage(MANITOBA_BUNDLE),
  };
}

/**
 * Source records for display, drawn from the bundle that cites them rather than
 * copied into the content registry, so a source's version and hash have one
 * home.
 */
export function manitobaSourceRecords(ids: readonly string[]): SourceRecord[] {
  const wanted = new Set(ids);
  return MANITOBA_BUNDLE.sources
    .filter((source) => wanted.has(source.id))
    .map((source) => ({
      id: source.id as CanonicalId<"source">,
      authority: source.authority,
      title: source.title,
      url: source.url,
      publisher: "Government of Manitoba",
      retrievedAt: `${source.retrievedAt}T00:00:00Z`,
      ...(source.effectiveFrom ? { effectiveFrom: source.effectiveFrom as IsoDate } : {}),
      type: "official" as const,
      jurisdictionIds: ["jurisdiction:ca-mb" as CanonicalId<"jurisdiction">],
      verificationStatus: "verified" as const,
      contentHash: source.contentHash,
    }));
}
