import type { CanonicalId, SourceRecord } from "../../content-contract/index.ts";
import bundleJson from "../../../../content/regulatory/ca-qc-2026.json" with { type: "json" };
import { quebecZoneCanonicalId } from "../ingestion/quebec-zone.ts";
import {
  conditionalCoverage, evaluateConditional,
  type ConditionalBundle, type ConditionalCondition, type ConditionalEvaluation, type ConditionalInput,
  type ConditionalRule, type ConditionalVocabulary, type VocabularyDimension,
} from "./conditional-engine.ts";
import type { SpecialGeography } from "./geography.ts";

/**
 * Québec, bound to the jurisdiction-neutral engine.
 *
 * This file is data and a mechanical transform of the certified bundle
 * (content/regulatory/ca-qc-2026.json, built from the ministry's own French
 * pages). Every interpretation — which zones a label reaches, which implements a
 * heading permits, which class a per-year cell allows — was made by the builder,
 * against the source, and is recorded in the bundle. Nothing here decides law.
 *
 * Three Québec facts shape the binding:
 *
 *  - The pages speak for two periods: big game for the 2026 and 2027 seasons,
 *    small game from 1 April 2026. The engine certifies one period per bundle,
 *    so Québec is bound as two bundles over the same file.
 *
 *  - The tables are complete for each zone they name ("Les dates de chasse sont
 *    établies en fonction de la zone où la chasse est permise et du type d'arme
 *    utilisé"), so an implement no row permits in a named zone is closed there.
 *    A zone no row names is not something the pages speak to: UNKNOWN.
 *
 *  - Animal classes restrict what may be TAKEN, not who may hunt. "Orignal avec
 *    bois" limits the moose a hunter may shoot during a season that is open to
 *    them, so the class is stated with every answer and never asked.
 */

/* ── The certified bundle, as the builder wrote it ─────────────────────── */

interface QuebecWindow { opens: string; closes: string }
interface QuebecCaveat { text: string; designations: string[] }
interface QuebecRule {
  id: string;
  speciesId: string;
  sourceId: string;
  sourceSection: string;
  zoneLabel: string;
  designations: string[];
  caveats: QuebecCaveat[];
  implementLabel: string | null;
  permittedImplements: string[] | null;
  classLabel: string | null;
  animalClasses: string[] | null;
  seasonType: "REGULAR" | "RELEVE";
  seasonLabel: string;
  seasonPhrase: string | null;
  windows: QuebecWindow[];
  declaredNoSeason: boolean;
  notes: string[];
  conditionIds: string[];
  antlerlessByPermit?: boolean;
  rightsBasedHarvestExcluded?: boolean;
  reviewStatus: string;
}
interface QuebecStatement {
  id: string;
  text: string;
  sourceId: string;
  sourceSection: string;
  scope: "page" | "rule" | "designations" | "location" | "legal-time" | "period" | "definition";
  designations?: string[];
  speciesIds?: string[];
}
interface QuebecSource {
  id: string;
  authority: string;
  title: string;
  url: string;
  language: string;
  lastUpdated: string;
  contentHash: string;
}
interface QuebecUnresolved {
  sourceId: string;
  sourceSection: string;
  zoneLabel: string;
  fragment: string;
  speciesIds: string[];
  seasonLabel: string;
  seasonPhrase: string;
  windows: QuebecWindow[];
  permittedImplements: string[] | null;
  classLabel: string | null;
  possiblyReaches: string[];
  reason: string;
}
interface ClassDefinition { officialTerm: string; definition: string; english: string }
interface QuebecBundle {
  bundleId: string;
  retrievedAt: string;
  contentHash: string;
  certifiedPeriods: { bigGame: { from: string; to: string }; smallGame: { from: string; to: string } };
  designations: { count: number; entries: Array<{ designation: string; zoneNumber: string; partName: string }> };
  classDefinitions: Record<string, { dimension: string } & Record<string, ClassDefinition | string>>;
  legalTime: Record<string, string>;
  zecs: Array<{ page: string; sourceId: string; section: string; zec: string }>;
  locationNotes: Array<{ speciesIds: string[]; designations: string[]; statementId: string }>;
  sources: QuebecSource[];
  statements: QuebecStatement[];
  rules: QuebecRule[];
  unresolved: QuebecUnresolved[];
}

export const QUEBEC_BUNDLE = bundleJson as unknown as QuebecBundle;

const ZONE_SOURCE = "source:ca-qc-zone-chasse-service";
const SMALL_GAME_SOURCE = "source:ca-qc-petit-gibier-2026-2028";

/* ── Transform: the certified bundle as the engine reads it ─────────────── */

const statementById = new Map(QUEBEC_BUNDLE.statements.map((statement) => [statement.id, statement]));
const zoneIdOf = (designation: string) => quebecZoneCanonicalId(designation);

const CLASS_ENGLISH: Record<string, string> = {
  ANTLERED: "antlered", ANTLERLESS: "antlerless", BEARDED: "bearded", BEARDLESS: "beardless",
};

/** What this season lets a hunter take, in the ministry's words and ours. */
function classNote(rule: QuebecRule): string | null {
  if (!rule.classLabel || !rule.animalClasses) return null;
  const definitions = QUEBEC_BUNDLE.classDefinitions[rule.speciesId];
  const glossed = rule.animalClasses
    .map((value) => (definitions?.[value] as ClassDefinition | undefined)?.english ?? CLASS_ENGLISH[value] ?? value)
    .join(" or ");
  return `This season allows « ${rule.classLabel} » (${glossed}), as the ministry states it for ${rule.seasonLabel}.`;
}

function engineRule(rule: QuebecRule, groupId: string): ConditionalRule {
  const notes: ConditionalRule["notes"] = [];
  const stated = classNote(rule);
  if (stated) notes.push(stated);
  if (rule.antlerlessByPermit) {
    notes.push(
      "Antlerless moose (« orignal sans bois », antlers under 10 cm) may be taken here only by the holder of a drawn " +
        "antlerless moose permit (tirage au sort), at the place the permit names.",
    );
  }
  if (!rule.permittedImplements && rule.implementLabel) {
    // Turkey: the heading is carried verbatim, never mapped to a rifle yes or no.
    notes.push(`Implements, as the ministry lists them for this season: « ${rule.implementLabel} ».`);
  }
  if (rule.seasonType === "RELEVE") {
    notes.push("Reserved for participants in the deer relève weekend (« fin de semaine destinée à la relève »).");
  }
  for (const caveat of rule.caveats) {
    for (const designation of caveat.designations) {
      notes.push({
        zoneId: zoneIdOf(designation),
        text:
          `The ministry excludes part of this zone from this season: « ${caveat.text} ». North Ground holds hunting-zone ` +
          "boundaries, not that one, and cannot tell you which side of it you are on.",
      });
    }
  }
  for (const note of rule.notes) notes.push(note);
  if (rule.declaredNoSeason) {
    /* A stated closure is CLOSED because it was said, so what was said travels
       with the answer. The engine lists conditions only for rules in season;
       a closure has none, so its statement is carried as a note instead. */
    for (const id of rule.conditionIds) {
      const statement = statementById.get(id);
      if (statement?.scope === "rule") notes.push(`The ministry states: « ${statement.text} »`);
    }
    if (rule.rightsBasedHarvestExcluded) {
      notes.push(
        "This answer is about sport hunting. Moose harvesting continues in zone 17 as Indigenous subsistence harvesting " +
          "under the James Bay and Northern Québec Agreement, a separate legal context North Ground does not evaluate.",
      );
    }
  }

  return {
    id: rule.id,
    speciesId: rule.speciesId,
    regulatoryGroupId: groupId,
    appliesWhen: {
      ...(rule.permittedImplements ? { permittedImplements: rule.permittedImplements } : {}),
      // Regular seasons carry no key, so a relève participant keeps them too.
      ...(rule.seasonType === "RELEVE" ? { SEASON_TYPE: "RELEVE" } : {}),
    },
    seasonLabel: rule.implementLabel ? `${rule.implementLabel}, ${rule.seasonLabel}` : rule.seasonLabel,
    seasonPhrase: rule.seasonPhrase ?? "",
    windows: rule.windows.map((window) => ({ opensIso: window.opens, closesIso: window.closes })),
    declaredNoSeason: rule.declaredNoSeason,
    conditionIds: rule.conditionIds.filter((id) => {
      const scope = statementById.get(id)?.scope;
      // Page-wide statements are carried once, as standing limitations.
      return scope === "rule" || scope === "designations";
    }),
    caveats: [],
    notes,
    disputes: [],
    sourceId: rule.sourceId,
    sourceSection: rule.sourceSection,
    sourceVersion: rule.seasonLabel,
    reviewStatus: rule.reviewStatus,
  };
}

function conditionsFor(sourceId: string): ConditionalCondition[] {
  return QUEBEC_BUNDLE.statements
    .filter((statement) => statement.sourceId === sourceId && (statement.scope === "rule" || statement.scope === "designations"))
    .map((statement) => ({
      id: statement.id,
      text: `« ${statement.text} »`,
      sourceId: statement.sourceId,
      sourceSection: statement.sourceSection,
      ...(statement.designations ? { zoneIds: statement.designations.map(zoneIdOf) } : {}),
      ...(statement.speciesIds ? { speciesIds: statement.speciesIds } : {}),
    }));
}

function bindPeriod(kind: "bigGame" | "smallGame"): ConditionalBundle {
  const inPeriod = (sourceId: string) => (kind === "smallGame") === (sourceId === SMALL_GAME_SOURCE);
  const rules = QUEBEC_BUNDLE.rules.filter((rule) => inPeriod(rule.sourceId));

  const groups = new Map<string, { id: string; officialSpec: string; zoneIds: string[] }>();
  const groupFor = (label: string, designations: string[]) => {
    const key = [...designations].sort().join(",");
    const id = `regulatory_group:ca-qc-${key.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 120)}-${groups.size}`;
    const existing = [...groups.values()].find((group) => group.zoneIds.join(",") === designations.map(zoneIdOf).sort().join(","));
    if (existing) return existing.id;
    groups.set(id, { id, officialSpec: label, zoneIds: designations.map(zoneIdOf).sort() });
    return id;
  };

  const engineRules = rules.map((rule) => engineRule(rule, groupFor(rule.zoneLabel, rule.designations)));

  /* A row fragment the builder could not map stays unmapped. It becomes a rule
     that MAY apply at the designations it could possibly reach, so the engine
     answers NEEDS_VERIFICATION there within its dates rather than CLOSED. */
  const specials: SpecialGeography[] = [];
  for (const unresolved of QUEBEC_BUNDLE.unresolved.filter((entry) => inPeriod(entry.sourceId))) {
    if (!unresolved.possiblyReaches.length) continue;
    const specialId = `qc-unresolved-${specials.length}`;
    specials.push({
      id: specialId,
      name: `The row « ${unresolved.zoneLabel} »`,
      statedAs: unresolved.fragment,
      resolution: "UNRESOLVED",
      candidateAreas: unresolved.possiblyReaches,
      reason: `${unresolved.reason} Its season: ${unresolved.seasonPhrase}.`,
    });
    for (const speciesId of unresolved.speciesIds) {
      engineRules.push({
        id: `${specialId}-${speciesId}-${unresolved.seasonLabel}`,
        speciesId,
        regulatoryGroupId: groupFor(unresolved.zoneLabel, []),
        geography: {
          statedAs: unresolved.fragment,
          include: { ghas: [], gbhz: [], special: [specialId] },
          exclude: { ghas: [], special: [] },
        },
        appliesWhen: unresolved.permittedImplements ? { permittedImplements: unresolved.permittedImplements } : {},
        seasonLabel: unresolved.seasonLabel,
        seasonPhrase: unresolved.seasonPhrase,
        windows: unresolved.windows.map((window) => ({ opensIso: window.opens, closesIso: window.closes })),
        declaredNoSeason: false,
        conditionIds: [],
        caveats: [],
        notes: [],
        disputes: [],
        sourceId: unresolved.sourceId,
        sourceSection: unresolved.sourceSection,
        sourceVersion: unresolved.seasonLabel,
        reviewStatus: "VERIFIED",
      });
    }
  }

  const period = QUEBEC_BUNDLE.certifiedPeriods[kind];
  return {
    bundleId: `${QUEBEC_BUNDLE.bundleId}-${kind === "bigGame" ? "big-game" : "small-game"}`,
    jurisdictionId: "jurisdiction:ca-qc",
    sourceVersion: kind === "bigGame" ? "2026-2027" : "2026-2028",
    retrievedAt: QUEBEC_BUNDLE.retrievedAt,
    certifiedPeriod: {
      from: period.from,
      to: period.to,
      reason: kind === "smallGame"
        ? "The small-game page states the previous rules applied from 1 April 2024 to 31 March 2026."
        : "The big-game pages print the 2026 and 2027 seasons.",
    },
    absence: {
      meaning: "UNKNOWN",
      excludedCombination: "CLOSED",
      statedAs: "Les dates de chasse sont établies en fonction de la zone où la chasse est permise et du type d'arme utilisé.",
      explanation:
        "The ministry's tables list every season, by implement, for each zone they name, so a combination no row permits " +
        "in a named zone has no season there. A zone no row names is not something the pages speak to.",
    },
    units: QUEBEC_BUNDLE.designations.entries.map((entry) => ({ identifier: entry.designation, zoneId: zoneIdOf(entry.designation) })),
    specialGeographies: specials,
    sources: [...new Set(rules.map((rule) => rule.sourceId))].map((id) => ({ id, conditions: conditionsFor(id) })),
    groups: [...groups.values()],
    rules: engineRules,
  };
}

export const QUEBEC_BIG_GAME = bindPeriod("bigGame");
export const QUEBEC_SMALL_GAME = bindPeriod("smallGame");

/* ── The questions, in Québec's terms ───────────────────────────────────── */

const IMPLEMENT_OPTIONS: Record<string, { label: string; detail?: string }> = {
  RIFLE: { label: "Rifle", detail: "« carabine »" },
  SHOTGUN: { label: "Shotgun", detail: "« fusil »" },
  MUZZLELOADER: { label: "Muzzle-loading gun", detail: "« arme à chargement par la bouche »" },
  CROSSBOW: { label: "Crossbow", detail: "« arbalète »" },
  BOW: { label: "Bow", detail: "« arc »" },
  AIR_GUN: { label: "Air gun", detail: "« arme à air comprimé »" },
  SNARE: { label: "Snare", detail: "« collet »" },
};

/** The implements the ministry names for a species anywhere, so an unpermitted one still has an answer. */
function implementsNamedFor(speciesId: string): string[] {
  const named = new Set<string>();
  for (const rule of QUEBEC_BUNDLE.rules) {
    if (rule.speciesId === speciesId) for (const implement of rule.permittedImplements ?? []) named.add(implement);
  }
  return Object.keys(IMPLEMENT_OPTIONS).filter((implement) => named.has(implement));
}

function methodDimension(speciesId: string): VocabularyDimension | null {
  const options = implementsNamedFor(speciesId);
  if (!options.length) return null;
  return {
    id: "HUNT_METHOD",
    question: "What will you be hunting with?",
    reason:
      "Québec publishes each season by implement, and some seasons exclude an implement their table heading names " +
      "(« L'utilisation de l'arbalète est interdite dans les zones 22, 23 et 24 »), so the open dates depend on what you carry.",
    options: options.map((value) => ({ value, ...IMPLEMENT_OPTIONS[value] })),
    multiple: false,
    allowsUnsure: false,
    sourceId: "source:ca-qc-orignal-2026-2027",
    sourceSection: "Périodes de chasse, by implement",
  };
}

const RELEVE_DIMENSION: VocabularyDimension = {
  id: "SEASON_TYPE",
  question: "Are you taking part in the deer relève weekend?",
  reason:
    "These dates are reserved for participants: « Ces dates sont destinées aux participants à la fin de semaine destinée " +
    "à la relève au cerf de Virginie. » Who may take part is set by the ministry, not by age alone.",
  options: [
    { value: "RELEVE", label: "Yes — I am a relève weekend participant" },
    { value: "REGULAR", label: "No" },
  ],
  multiple: false,
  allowsUnsure: false,
  sourceId: "source:ca-qc-cerf-virginie-2026-2027",
  sourceSection: "Périodes de chasse réservée à la relève",
};

/* ── Standing text, per species and per place ──────────────────────────── */

const ZSR = new Set(["08NZ", "09OZ", "10EZ"]);
const NAMED_TERRITORY: Record<string, string> = {
  "08NMR": "Montagne de Rigaud",
  "27ESB": "Seigneurie de Beaupré",
  "27OSB": "Seigneurie de Beaupré",
};
const CERVIDS = new Set(["species:moose", "species:white-tailed-deer"]);

function sourceOf(speciesId: string): string | undefined {
  return QUEBEC_BUNDLE.rules.find((rule) => rule.speciesId === speciesId)?.sourceId;
}

function placeNotes(speciesId: string, designation: string | null): string[] {
  if (!designation) return [];
  const notes: string[] = [];
  if (ZSR.has(designation) && CERVIDS.has(speciesId)) {
    notes.push(
      "This point is in the part of the zone the ministry's layer marks « ZSR » — the enhanced surveillance zone " +
        "(zone de surveillance rehaussée) for chronic wasting disease. The ministry sets additional cervid measures there " +
        "on its chronic wasting disease pages, which North Ground has not certified.",
    );
  }
  const territory = NAMED_TERRITORY[designation];
  if (territory) {
    notes.push(
      `This point is in ${territory}, which the ministry's layer draws as its own part of the zone. Hunting can be ` +
        "prohibited in particular territories of a zone, or follow different terms there; confirm with whoever manages it.",
    );
  }
  for (const note of QUEBEC_BUNDLE.locationNotes) {
    if (note.speciesIds.includes(speciesId) && note.designations.includes(designation)) {
      const statement = statementById.get(note.statementId);
      if (statement) notes.push(`« ${statement.text} »`);
    }
  }
  return notes;
}

function standingFor(speciesId: string): string[] {
  const source = sourceOf(speciesId);
  const pageStatements = QUEBEC_BUNDLE.statements
    .filter((statement) => statement.sourceId === source && statement.scope === "page")
    .filter((statement) => !statement.speciesIds || statement.speciesIds.includes(speciesId))
    .map((statement) => `« ${statement.text} »`);
  const zecs = [...new Set(QUEBEC_BUNDLE.zecs.filter((entry) => entry.sourceId === source).map((entry) => entry.zec))];
  return [
    ...pageStatements,
    ...(zecs.length
      ? [`Different seasons apply in these zecs: ${zecs.join(", ")}. North Ground does not hold zec boundaries.`]
      : []),
    "Québec's hunting-zone boundaries are the ministry's map, which states « cette compilation cartographique n'a aucune " +
      "portée légale, seuls les documents déposés ont force de loi ». Near a boundary, confirm which zone you are in.",
    "Being inside a hunting zone is not permission to hunt there. Private land, parks, ecological reserves, wildlife " +
      "reserves, zecs and outfitters' territories are separate questions North Ground has not resolved here.",
    "This describes sport hunting under Québec's Loi sur la conservation et la mise en valeur de la faune. It does not " +
      "describe harvesting under treaty or Aboriginal rights, which is a separate legal context North Ground does not evaluate.",
  ];
}

export function quebecVocabulary(speciesId: string, designation: string | null): ConditionalVocabulary {
  const method = methodDimension(speciesId);
  const turkeyHours = QUEBEC_BUNDLE.legalTime["source:ca-qc-dindon-sauvage-2026-2027"];
  return {
    jurisdictionName: "Québec",
    unitTerm: "zone de chasse",
    dimensions: [
      ...(speciesId === "species:white-tailed-deer" ? [RELEVE_DIMENSION] : []),
      ...(method ? [method] : []),
    ],
    legalTime: speciesId === "species:wild-turkey" && turkeyHours
      ? { status: "RULE_ONLY", text: `« ${turkeyHours} » North Ground has not certified exact astronomical times for this result.` }
      : {
          status: "NOT_AVAILABLE",
          text: "Québec's legal hunting hours for this species are set by rules North Ground has not certified.",
        },
    standingLimitations: [...placeNotes(speciesId, designation), ...standingFor(speciesId)],
    standingSourceIds: [ZONE_SOURCE],
    describe: (dimension, value) => (dimension === "SEASON_TYPE" && value === "RELEVE" ? "relève weekend participants only" : value),
  };
}

/* ── Evaluation ─────────────────────────────────────────────────────────── */

export function designationOfZoneId(zoneId: string): string | null {
  return QUEBEC_BUNDLE.designations.entries.find((entry) => zoneIdOf(entry.designation) === zoneId)?.designation ?? null;
}

export function evaluateQuebec(input: ConditionalInput): ConditionalEvaluation {
  const bundle = sourceOf(input.speciesId) === SMALL_GAME_SOURCE ? QUEBEC_SMALL_GAME : QUEBEC_BIG_GAME;
  return evaluateConditional(bundle, quebecVocabulary(input.speciesId, designationOfZoneId(input.place.zoneId)), input);
}

/** Species with at least one certified Québec rule. */
export const QUEBEC_SPECIES: readonly string[] = [
  ...new Set(QUEBEC_BUNDLE.rules.filter((rule) => rule.reviewStatus === "VERIFIED" || rule.reviewStatus === "PUBLISHED").map((rule) => rule.speciesId)),
].sort();

export function quebecCoverageReport() {
  const officialUnitCount = QUEBEC_BUNDLE.designations.count;
  return {
    sourceVersion: "2026-2027 / 2026-2028",
    retrievedAt: QUEBEC_BUNDLE.retrievedAt,
    officialUnits: officialUnitCount,
    unresolvedFragments: QUEBEC_BUNDLE.unresolved.length,
    species: [
      ...conditionalCoverage({ ...QUEBEC_BIG_GAME, officialUnitCount }),
      ...conditionalCoverage({ ...QUEBEC_SMALL_GAME, officialUnitCount }),
    ],
  };
}

/**
 * Source records for display, from the bundle that cites them.
 *
 * The bundle knows the calendar DAY each page was read, not the hour. It is
 * anchored at 12:00 UTC, which is the same calendar day in every Canadian time
 * zone; midnight UTC would display as the previous evening across the country.
 */
export function quebecSourceRecords(ids: readonly string[]): SourceRecord[] {
  const wanted = new Set(ids);
  return QUEBEC_BUNDLE.sources
    .filter((source) => wanted.has(source.id))
    .map((source) => ({
      id: source.id as CanonicalId<"source">,
      authority: source.authority,
      title: source.title,
      url: source.url,
      publisher: "Gouvernement du Québec",
      retrievedAt: `${QUEBEC_BUNDLE.retrievedAt}T12:00:00Z` as SourceRecord["retrievedAt"],
      type: "official" as const,
      jurisdictionIds: ["jurisdiction:ca-qc" as CanonicalId<"jurisdiction">],
      verificationStatus: "verified" as const,
      contentHash: source.contentHash,
    }));
}
