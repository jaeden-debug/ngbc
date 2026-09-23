import { legalTimeNotCertified } from "./legal-time.ts";
import { general, sourceDetail, type Limitation } from "../limitation.ts";
import type { CanonicalId, SourceRecord } from "../../content-contract/index.ts";
import bundleJson from "../../../../content/regulatory/ca-qc-2026.json" with { type: "json" };
import overlaysJson from "../../../../content/regulatory/ca-qc-overlays.json" with { type: "json" };
import { QUEBEC_ZONE_TYPE_NAME, QUEBEC_ZONE_WFS, quebecZoneCanonicalId } from "../ingestion/quebec-zone.ts";
import type { OverlayCatalogue } from "../overlays.ts";
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
  /** The year (or licence year) this rule is in force, as the builder read it from the column. */
  effectiveFrom: string;
  effectiveTo: string;
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
  designations: {
    source: string;
    count: number;
    contentHash: string;
    entries: Array<{ designation: string; zoneNumber: string; partName: string }>;
  };
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

/**
 * The ministry's implement heading, as a label.
 *
 * Headings open with the page's own preamble ("Périodes de chasse aux armes à
 * feu (carabine, fusil, arme à chargement par la bouche), à l'arbalète et à
 * l'arc"), and an answer lists every season open to a hunter, so the preamble
 * and the articles are left out of the label: "armes à feu, arbalète et arc".
 * The words are the ministry's; the heading itself is kept verbatim as the
 * rule's source section, and the implements the rule permits are its
 * `permittedImplements`.
 */
export function implementLabelShort(heading: string): string {
  return heading
    .replace(/^Périodes de chasse\s+/i, "")
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/^(?:à l['’]|à la |au |aux )/i, "")
    .replace(/(,| et) (?:à l['’]|à la |au |aux )/g, "$1 ")
    .trim();
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
    seasonLabel: [
      /* A heading the builder could not map to implements (turkey's) is carried
         verbatim in a note instead, so the label is its year alone. */
      rule.implementLabel && rule.permittedImplements ? implementLabelShort(rule.implementLabel) : null,
      // The ministry's own word for the youth weekend, so it is never mistaken for the regular season beside it.
      rule.seasonType === "RELEVE" ? "relève" : null,
      rule.seasonLabel,
    ].filter(Boolean).join(", "),
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
        // The same form as every stored rule id, so the rule can be published as it is evaluated.
        id: `regulatory_rule:ca-${`${specialId}-${speciesId.slice("species:".length)}-${unresolved.seasonLabel}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-")}`,
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

function standingFor(speciesId: string): Limitation[] {
  const source = sourceOf(speciesId);
  const pageStatements = QUEBEC_BUNDLE.statements
    .filter((statement) => statement.sourceId === source && statement.scope === "page")
    .filter((statement) => !statement.speciesIds || statement.speciesIds.includes(speciesId))
    .map((statement) => sourceDetail(`« ${statement.text} »`, statement.sourceId as CanonicalId<"source">, "fr-CA"));
  const zecs = [...new Set(QUEBEC_BUNDLE.zecs.filter((entry) => entry.sourceId === source).map((entry) => entry.zec))];
  /* Most decisive first. A shared Hunt Brief keeps a fixed number of these, so
     what the answer covers and where hunting is permitted at all come before
     the ministry's general reservations and the map's standing. */
  return [
    /* Verbatim, GENERAL, and never shortened, paraphrased or merged. */
    general(
      "This describes sport hunting under Québec's Loi sur la conservation et la mise en valeur de la faune. It does not " +
        "describe harvesting under treaty or Aboriginal rights, which is a separate legal context North Ground does not evaluate.",
    ),
    general(
      "Being inside a hunting zone is not permission to hunt there. Private land, parks, ecological reserves, wildlife " +
        "reserves, zecs and outfitters' territories are separate questions North Ground has not resolved here.",
    ),
    ...(zecs.length
      ? [general(`Different seasons apply in these zecs: ${zecs.join(", ")}. North Ground does not hold zec boundaries.`)]
      : []),
    /* The ministry's own words, wholly in French, attached to its source and
       tagged fr-CA. Not translated: §47 keeps an official statement in the
       language the authority published it in, and an invented translation of
       law is worse than a quotation a reader can take to the ministry. */
    ...pageStatements,
    /*
     * North Ground's sentence, which QUOTES the ministry inside it. GENERAL
     * rather than SOURCE_DETAIL: marking the whole line as the authority's
     * would attribute "Near a boundary, confirm which zone you are in" to the
     * ministry, which did not write it.
     */
    general(
      "Québec's hunting-zone boundaries are the ministry's map, which states « cette compilation cartographique n'a aucune " +
        "portée légale, seuls les documents déposés ont force de loi ». Near a boundary, confirm which zone you are in.",
    ),
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
    /*
     * Québec spans more than one IANA zone, so a point timezone cannot yet be
     * established and no window is resolved. The ministry's own turkey hours
     * are still carried as the reason, which is more than "not certified".
     */
    legalTime: legalTimeNotCertified(
      speciesId === "species:wild-turkey" && turkeyHours
        ? `« ${turkeyHours} »`
        : "Québec's legal hunting hours for this species are set by rules North Ground has not certified.",
      "Ministère des Forêts, de la Faune et des Parcs",
    ),
    standingLimitations: [
      ...placeNotes(speciesId, designation).map((text) => general(text)),
      ...standingFor(speciesId),
    ],
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

/* ── Persistence ──────────────────────────────────────────────────────── */

/**
 * The two bound bundles in the shape `scripts/publish-regulations.mjs` stores.
 *
 * Every rule is the rule the engine evaluates, with the period it is in force:
 * its own year (2026, 2027) or licence year (1 April to 31 March) as the
 * ministry prints it, never the two-year span of the page, so "2026 Orignal avec
 * bois / 2027 Orignal" stays two rules in the store as in the bundle. A row the
 * builder could not map takes the period of the published rules beside it —
 * same page, same season — and is stored with the geography that keeps it
 * unresolved. Sources carry what the builder hashed.
 *
 * The store keeps each season's label as the ministry prints it, heading and
 * all; an answer uses the short form (`implementLabelShort`), which is a
 * presentation of the same words.
 */
export function quebecPublishableBundles() {
  const ownPeriod = new Map(QUEBEC_BUNDLE.rules.map((rule) => [rule.id, { from: rule.effectiveFrom, to: rule.effectiveTo }]));
  const printedLabel = new Map(QUEBEC_BUNDLE.rules.map((rule) => [
    rule.id,
    rule.implementLabel ? `${rule.implementLabel}, ${rule.seasonLabel}` : rule.seasonLabel,
  ]));
  const seasonPeriod = new Map(QUEBEC_BUNDLE.rules.map((rule) => [`${rule.sourceId}|${rule.seasonLabel}`, { from: rule.effectiveFrom, to: rule.effectiveTo }]));
  const unresolvedSeason = new Map<string, string>();
  for (const bound of [QUEBEC_BIG_GAME, QUEBEC_SMALL_GAME]) {
    for (const rule of bound.rules) if (rule.geography?.include.special.length) unresolvedSeason.set(rule.id, rule.sourceVersion);
  }
  return [QUEBEC_BIG_GAME, QUEBEC_SMALL_GAME].map((bound) => ({
    ...bound,
    sources: bound.sources.map((declared) => {
      const source = QUEBEC_BUNDLE.sources.find((candidate) => candidate.id === declared.id);
      if (!source) throw new Error(`Bound source ${declared.id} is not in the bundle`);
      return {
        ...declared,
        authority: source.authority,
        title: source.title,
        url: source.url,
        version: `page updated ${source.lastUpdated}`,
        contentHash: source.contentHash,
        retrievedAt: QUEBEC_BUNDLE.retrievedAt,
      };
    }),
    // The pages the groupings are printed on, identified by the hash of all of them.
    groups: bound.groups.map((group) => ({ ...group, label: group.officialSpec, sourceVersion: QUEBEC_BUNDLE.contentHash })),
    rules: bound.rules.map((rule) => {
      const period = ownPeriod.get(rule.id) ?? seasonPeriod.get(`${rule.sourceId}|${unresolvedSeason.get(rule.id)}`);
      if (!period) throw new Error(`No period in force for ${rule.id}`);
      return { ...rule, seasonLabel: printedLabel.get(rule.id) ?? rule.seasonLabel, effectiveFrom: period.from, effectiveTo: period.to };
    }),
  }));
}

/* ── Territories closed to all hunting ─────────────────────────────────── */

/**
 * The ministry's layer of territories where it states all hunting is prohibited
 * (SmartFaunePub:Chasse_Interdite): ecological reserves, Québec and federal
 * national parks, and territories it closes to hunting — 130 features, built by
 * `scripts/build-quebec-overlays.mjs`. Hunt asks the ministry's own service which
 * of them contain a point and reads the answer against this catalogue.
 *
 * These lie INSIDE hunting zones (Parc national de la Jacques-Cartier is in zone
 * 27), so a zone's season says nothing about them. One feature is the whole of
 * zone 19 Nord, which no season page names.
 */
export const QUEBEC_OVERLAYS = overlaysJson as unknown as OverlayCatalogue & { retrievedAt: string; contentHash: string };

/** The catalogue as a plural noun phrase: "… inside this zone are checked only for an exact point." */
export const QUEBEC_OVERLAY_DESCRIPTION = "ecological reserves, national parks and other territories closed to all hunting";

/* The ministry's two GIS layers Hunt reads, described from what North Ground
   committed when it read them: the zone designations with the bundle, the
   closed territories with their catalogue. */
const GIS_SOURCES = [
  {
    id: "source:ca-qc-zone-chasse-service",
    title: `Zones de chasse (${QUEBEC_ZONE_TYPE_NAME})`,
    url: `${QUEBEC_ZONE_WFS}?service=WFS&version=2.0.0&request=GetCapabilities`,
    retrievedAt: QUEBEC_BUNDLE.retrievedAt,
    contentHash: QUEBEC_BUNDLE.designations.contentHash,
  },
  {
    id: QUEBEC_OVERLAYS.layers[0].sourceId,
    title: `Territoires où toute activité de chasse est interdite (${QUEBEC_OVERLAYS.layers[0].typeName})`,
    url: `${QUEBEC_OVERLAYS.layers[0].url}?service=WFS&version=2.0.0&request=GetCapabilities`,
    retrievedAt: QUEBEC_OVERLAYS.retrievedAt,
    contentHash: QUEBEC_OVERLAYS.contentHash,
  },
];

/**
 * Source records for display, from the bundle and catalogue that cite them.
 *
 * Each knows the calendar DAY it was read, not the hour. The day is anchored at
 * 12:00 UTC, which is the same calendar day in every Canadian time zone;
 * midnight UTC would display as the previous evening across the country.
 */
const capitalise = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export function quebecSourceRecords(ids: readonly string[]): SourceRecord[] {
  const wanted = new Set(ids);
  const record = (source: { id: string; authority: string; title: string; url: string; retrievedAt: string; contentHash: string }) => ({
    id: source.id as CanonicalId<"source">,
    authority: source.authority,
    title: source.title,
    url: source.url,
    publisher: "Gouvernement du Québec",
    retrievedAt: `${source.retrievedAt}T12:00:00Z` as SourceRecord["retrievedAt"],
    type: "official" as const,
    jurisdictionIds: ["jurisdiction:ca-qc" as CanonicalId<"jurisdiction">],
    verificationStatus: "verified" as const,
    contentHash: source.contentHash,
  });
  return [
    ...QUEBEC_BUNDLE.sources
      .filter((source) => wanted.has(source.id))
      /* The page names its publisher and ministry together ("Gouvernement du
         Québec — ministère de …"); the ministry is the authority, the
         government the publisher, and both fit where a source is cited. */
      .map((source) => record({
        ...source,
        authority: capitalise(source.authority.split(" — ").at(-1)!.trim()),
        retrievedAt: QUEBEC_BUNDLE.retrievedAt,
      })),
    ...GIS_SOURCES
      .filter((source) => wanted.has(source.id))
      // As the ministry's GeoServer names itself.
      .map((source) => record({ ...source, authority: "Ministère des Forêts, de la Faune et des Parcs" })),
  ];
}
