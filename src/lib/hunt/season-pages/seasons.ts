import type { CanonicalId, SourceRecord } from "../../content-contract/index.ts";
import { contentRepository } from "../../content/repository.ts";
import { jurisdictionTodayIso } from "../date.ts";
import { EXPLORATION_WORDING, summarizeZoneSpecies, zoneStatesForSpecies, type ExplorationState } from "../exploration/zone-summary.ts";
import type { NextSeason } from "../regulatory/season.ts";
import { regulatoryEntryFor } from "../regulatory/registry.ts";
import { groupOpportunities, opportunityIdentity, openOn, type OpportunityWindow, type ResolvedOpportunity } from "../regulatory/opportunity-row.ts";
import { opportunityCard, type PresentedDimension } from "../regulatory/opportunity-presentation.ts";
import type { SeasonDates } from "../types.ts";
import type { LanguagedText } from "../translation.ts";
import { layerApplicability, speciesLayerFor, type ZoneLayer } from "../zone-layers.ts";
import { presentZone } from "../zone-presentation.ts";
import { compareDesignations, seasonRegionBySlug, seasonRegions, slugOf, type SeasonRegion } from "./regions.ts";

/**
 * What a server-rendered season page says, and nothing it is not entitled to.
 *
 * EVERY STATEMENT HERE IS THE ENGINE'S. Each zone is the whole-zone answer the
 * map's zone card gives (`summarizeZoneSpecies`), and whether a legal
 * opportunity exists is the map's own green (`zoneStatesForSpecies`). This
 * module only counts, groups and orders those answers; it never reads a season
 * row, so a page cannot drift from Hunt.
 *
 * Four rules carried over from §8 and §41A, because a page is where they would
 * otherwise erode first:
 *
 *  - Nothing here says OPEN. "In season" is a statement about a season, not a
 *    licence, and a zone answer never describes the hunter.
 *  - UNKNOWN and NOT_CERTIFIED are counted as themselves, never as closed.
 *  - Dimensions the authority did not settle are carried as the presentation
 *    layer renders them ("Not established"), never defaulted.
 *  - A species gets a page only where at least one zone has a certified rule,
 *    so no page exists to say nothing.
 */

export interface PageSource {
  id: string;
  title: string;
  publisher: string;
  url?: string;
}

export interface ZoneAnswer {
  designation: string;
  zoneId: string;
  fullLabel: string;
  compactLabel: string;
  state: ExplorationState;
  /** Whether at least one current legal opportunity exists (the map's green). */
  opportunityNow: boolean;
  /** Material conditions on today's opportunity, in the engine's words. */
  conditions: Array<LanguagedText & { source?: { url: string; publisher: string; title: string } }>;
  season?: SeasonDates;
  next: NextSeason;
  question?: string;
  detail?: string;
  exceptInside?: string[];
  opportunities: ResolvedOpportunity[];
  /** What the engine's answer for this zone cites. */
  sourceIds: string[];
  verifiedAt?: string;
}

export interface SeasonRow {
  animalClass: PresentedDimension;
  criterion: PresentedDimension;
  implements: PresentedDimension & { chips?: string[] };
  windows: readonly OpportunityWindow[];
  /** The authority's own name for the season segment, kept with its language. */
  seasonWords?: LanguagedText;
  sourceId?: string;
  /** Whether a window of this row contains the page's date. */
  runningToday: boolean;
}

/** Zones whose certified seasons for this species are identical, row for row. */
export interface SeasonGroup {
  key: string;
  zones: ZoneAnswer[];
  rows: SeasonRow[];
}

export interface StatusGroup {
  key: string;
  state: ExplorationState;
  season?: SeasonDates;
  next: NextSeason;
  zones: ZoneAnswer[];
}

export interface SpeciesSeasonPage {
  region: Pick<SeasonRegion, "slug" | "name" | "jurisdictionId" | "huntingAuthorityUrl">;
  speciesId: CanonicalId<"species">;
  speciesSlug: string;
  name: string;
  scientificName?: string;
  /** The species' own library page, when one is published. */
  speciesPath?: string;
  date: string;
  layer: { id: string; officialTerm: string; officialTermPlural: string; authority: string };
  /** Units the page evaluated, which is the certified list, against the authority's own count where it publishes one. */
  officialUnits: number | null;
  zones: ZoneAnswer[];
  counts: Record<ExplorationState, number>;
  opportunityZones: number;
  groups: SeasonGroup[];
  /**
   * Zones whose answer carries no opportunity rows — an evaluator that states
   * only the running window and the next one, or a zone with no certified
   * season — grouped by exactly what the engine stated about them.
   */
  statusGroups: StatusGroup[];
  /** The earliest certified opening after the page's date, across every zone. */
  nextOpening: { opens: string; closes: string; zones: ZoneAnswer[] } | null;
  /** When the seasons running on the page's date close: the earliest and latest across zones that are in season. */
  runningSeasonCloses: { earliest: string; latest: string; zones: number } | null;
  sources: PageSource[];
  verifiedAt: string | null;
}

export interface RegionSpeciesSummary {
  speciesId: CanonicalId<"species">;
  speciesSlug: string;
  name: string;
  term: string;
  zoneCount: number;
  counts: Record<ExplorationState, number>;
  opportunityZones: number;
  nextOpening: { opens: string; closes: string } | null;
}

export interface RegionPage {
  region: SeasonRegion;
  date: string;
  species: RegionSpeciesSummary[];
  layers: Array<{ id: string; officialTerm: string; officialTermPlural: string; authority: string; zones: number }>;
  sources: PageSource[];
  verifiedAt: string | null;
}

const STATES: ExplorationState[] = ["SEASON_AVAILABLE", "SEASON_EXCEPT_AREAS", "CHECK_REQUIREMENTS", "NEEDS_VERIFICATION", "CONFLICT", "CLOSED", "UNKNOWN", "NOT_CERTIFIED"];

function emptyCounts(): Record<ExplorationState, number> {
  return Object.fromEntries(STATES.map((state) => [state, 0])) as Record<ExplorationState, number>;
}

/** The calendar day a region's page describes: its own, not the server's. */
export function regionToday(region: Pick<SeasonRegion, "timeZone">, now: Date = new Date()): string {
  return jurisdictionTodayIso(region.timeZone, now);
}

interface SpeciesMeta { slug: string; name: string; scientificName?: string; path?: string }

async function speciesMeta(speciesId: CanonicalId<"species">): Promise<SpeciesMeta> {
  const resource = await contentRepository.getSpecies(speciesId);
  if (resource?.status === "published") {
    return { slug: resource.slug, name: resource.title, scientificName: resource.speciesProfile.scientificName, path: resource.canonicalUrl };
  }
  const words = speciesId.replace("species:", "");
  return { slug: words, name: (resource?.title ?? words.replace(/-/g, " ")).replace(/^./, (c) => c.toUpperCase()) };
}

/** Certified species in a region that hold at least one rule, with the layer their seasons are written in. */
function certifiedSpecies(region: SeasonRegion): Array<{ speciesId: CanonicalId<"species">; layer: ZoneLayer; designations: string[] }> {
  const entry = regulatoryEntryFor(region.jurisdictionId);
  if (!entry) return [];
  const out: Array<{ speciesId: CanonicalId<"species">; layer: ZoneLayer; designations: string[] }> = [];
  for (const row of entry.coverage().species) {
    if (row.rules <= 0) continue;
    const layer = speciesLayerFor(region.jurisdictionId, row.speciesId);
    const held = layer ? region.layers.find((candidate) => candidate.layer.id === layer.id) : undefined;
    if (!layer || !held) continue;
    out.push({ speciesId: row.speciesId as CanonicalId<"species">, layer, designations: held.designations });
  }
  return out;
}

async function answersFor(
  layer: ZoneLayer,
  designations: string[],
  speciesId: CanonicalId<"species">,
  date: string,
): Promise<ZoneAnswer[]> {
  if (!layerApplicability(layer, speciesId, date).applies) return [];
  const refs = designations.map((designation) => ({ layerId: layer.id, designation }));
  const [summaries, states] = await Promise.all([
    Promise.all(refs.map((ref) => summarizeZoneSpecies(ref, speciesId, date))),
    zoneStatesForSpecies(speciesId, date, refs),
  ]);
  const answers: ZoneAnswer[] = [];
  refs.forEach((ref, index) => {
    const summary = summaries[index];
    const opportunity = states[index].opportunity;
    if (!summary) return;
    const presentation = presentZone({
      designation: ref.designation, layerId: layer.id, jurisdictionId: layer.jurisdictionId,
    });
    answers.push({
      designation: ref.designation,
      zoneId: presentation.zoneId ?? ref.designation,
      fullLabel: presentation.fullLabel,
      compactLabel: presentation.compactLabel,
      state: summary.state,
      opportunityNow: opportunity.hasCurrentLegalOpportunity,
      conditions: opportunity.conditions
        .filter((condition) => condition.material)
        .map((condition) => ({ text: condition.text, lang: condition.lang, owner: condition.owner, ...(condition.source ? { source: condition.source } : {}) })),
      ...(summary.season ? { season: summary.season } : {}),
      next: summary.next,
      ...(summary.question ? { question: summary.question } : {}),
      ...(summary.detail ? { detail: summary.detail } : {}),
      ...(summary.exceptInside ? { exceptInside: summary.exceptInside } : {}),
      opportunities: summary.opportunities ? [...summary.opportunities] : [],
      sourceIds: summary.sourceIds,
      ...(summary.verifiedAt ? { verifiedAt: summary.verifiedAt } : {}),
    });
  });
  return answers.sort((a, b) => compareDesignations(a.designation, b.designation));
}

function rowsOf(opportunities: readonly ResolvedOpportunity[], date: string): SeasonRow[] {
  return groupOpportunities(opportunities).map((group) => {
    const first = group.rows[0];
    const card = opportunityCard(first);
    /* Two rules can state the same window for the same opportunity (one per
       residency table, say); the reader sees the window once. */
    const windows = [...new Map(group.windows.map((window) => [`${window.opens}|${window.closes}`, window])).values()]
      .sort((a, b) => a.opens.localeCompare(b.opens));
    return {
      animalClass: card.animalClass,
      criterion: card.criterion,
      implements: card.implements,
      windows,
      ...(first.seasonWords ? { seasonWords: { text: first.seasonWords.text, lang: first.seasonWords.lang, owner: first.seasonWords.owner } } : {}),
      ...(first.sourceId ? { sourceId: first.sourceId } : {}),
      runningToday: group.rows.some((row) => openOn(row, date)),
    };
  });
}

const STATE_RANK: ExplorationState[] = ["SEASON_AVAILABLE", "SEASON_EXCEPT_AREAS", "CHECK_REQUIREMENTS", "NEEDS_VERIFICATION", "CONFLICT", "CLOSED", "UNKNOWN", "NOT_CERTIFIED"];

function seasonKey(season: SeasonDates | undefined): string {
  return season ? JSON.stringify(season) : "-";
}

/** Same state, same running window, same next window: one row of the status table. */
function statusGroupsOf(zones: ZoneAnswer[]): StatusGroup[] {
  const groups = new Map<string, StatusGroup>();
  for (const zone of zones) {
    const key = `${zone.state}|${seasonKey(zone.season)}|${JSON.stringify(zone.next)}`;
    const group = groups.get(key);
    if (group) group.zones.push(zone);
    else groups.set(key, { key, state: zone.state, ...(zone.season ? { season: zone.season } : {}), next: zone.next, zones: [zone] });
  }
  return [...groups.values()].sort((a, b) =>
    STATE_RANK.indexOf(a.state) - STATE_RANK.indexOf(b.state) || b.zones.length - a.zones.length);
}

/** Identical certified seasons, identical material conditions: one group. */
function groupZones(zones: ZoneAnswer[], date: string): { groups: SeasonGroup[]; without: ZoneAnswer[] } {
  const groups = new Map<string, SeasonGroup>();
  const without: ZoneAnswer[] = [];
  for (const zone of zones) {
    if (!zone.opportunities.length) {
      without.push(zone);
      continue;
    }
    const identity = zone.opportunities
      .map((row) => `${opportunityIdentity(row)}\u0002${row.windows.map((window) => `${window.opens}..${window.closes}`).join(",")}`)
      .sort()
      .join("\u0003");
    const key = `${identity}\u0004${zone.conditions.map((condition) => condition.text).sort().join("\u0005")}`;
    const group = groups.get(key);
    if (group) group.zones.push(zone);
    else groups.set(key, { key: String(groups.size + 1), zones: [zone], rows: rowsOf(zone.opportunities, date) });
  }
  return { groups: [...groups.values()].sort((a, b) => b.zones.length - a.zones.length), without };
}

async function sourcesOf(region: SeasonRegion, ids: string[]): Promise<PageSource[]> {
  const unique = [...new Set(ids)].filter(Boolean) as CanonicalId<"source">[];
  if (!unique.length) return [];
  const known = await contentRepository.getSources(unique);
  const missing = unique.filter((id) => !known.some((source) => source.id === id));
  const fromBundle: SourceRecord[] = missing.length ? regulatoryEntryFor(region.jurisdictionId)?.sourceRecords?.(missing) ?? [] : [];
  return [...known, ...fromBundle]
    .map((source) => ({ id: source.id, title: source.title, publisher: source.publisher, ...(source.url ? { url: source.url } : {}) }))
    .sort((a, b) => a.title.localeCompare(b.title, "en-CA"));
}

function summarize(zones: ZoneAnswer[]) {
  const counts = emptyCounts();
  for (const zone of zones) counts[zone.state] += 1;
  const opportunityZones = zones.filter((zone) => zone.opportunityNow).length;
  const upcoming = zones
    .flatMap((zone) => zone.next.kind === "SEASON" ? [{ zone, opens: zone.next.opens, closes: zone.next.closes }] : [])
    .sort((a, b) => a.opens.localeCompare(b.opens));
  const soonest = upcoming[0];
  const nextOpening = soonest
    ? { opens: soonest.opens, closes: soonest.closes, zones: upcoming.filter((entry) => entry.opens === soonest.opens).map((entry) => entry.zone) }
    : null;
  return { counts, opportunityZones, nextOpening };
}

export async function speciesSeasonPage(regionSlug: string, speciesSlug: string, now: Date = new Date()): Promise<SpeciesSeasonPage | null> {
  const region = seasonRegionBySlug(regionSlug);
  if (!region) return null;
  const date = regionToday(region, now);
  for (const candidate of certifiedSpecies(region)) {
    const meta = await speciesMeta(candidate.speciesId);
    if (meta.slug !== speciesSlug) continue;
    const zones = await answersFor(candidate.layer, candidate.designations, candidate.speciesId, date);
    if (!zones.length || zones.every((zone) => zone.state === "NOT_CERTIFIED")) return null;
    const { counts, opportunityZones, nextOpening } = summarize(zones);
    const { groups, without } = groupZones(zones, date);
    const running = zones
      .flatMap((zone) => zone.season?.kind === "ABSOLUTE" && (zone.state === "SEASON_AVAILABLE" || zone.state === "SEASON_EXCEPT_AREAS")
        ? [zone.season.closes as string]
        : [])
      .sort();
    const sourceIds = zones.flatMap((zone) => [
      ...zone.sourceIds,
      ...zone.opportunities.flatMap((row) => row.sourceId ? [row.sourceId] : []),
    ]);
    const verified = zones.map((zone) => zone.verifiedAt).filter((value): value is string => Boolean(value)).sort();
    const entry = regulatoryEntryFor(region.jurisdictionId);
    return {
      region: { slug: region.slug, name: region.name, jurisdictionId: region.jurisdictionId, ...(region.huntingAuthorityUrl ? { huntingAuthorityUrl: region.huntingAuthorityUrl } : {}) },
      speciesId: candidate.speciesId,
      speciesSlug: meta.slug,
      name: meta.name,
      ...(meta.scientificName ? { scientificName: meta.scientificName } : {}),
      ...(meta.path ? { speciesPath: meta.path } : {}),
      date,
      layer: {
        id: candidate.layer.id,
        officialTerm: candidate.layer.officialTerm,
        officialTermPlural: candidate.layer.officialTermPlural ?? `${candidate.layer.officialTerm}s`,
        authority: candidate.layer.authority,
      },
      officialUnits: candidate.layer.speciesScope ? null : entry?.coverage().officialUnits ?? null,
      zones,
      counts,
      opportunityZones,
      groups,
      statusGroups: statusGroupsOf(without),
      nextOpening,
      runningSeasonCloses: running.length ? { earliest: running[0], latest: running.at(-1)!, zones: running.length } : null,
      sources: await sourcesOf(region, sourceIds),
      verifiedAt: verified.at(-1) ?? null,
    };
  }
  return null;
}

export async function regionPage(regionSlug: string, now: Date = new Date()): Promise<RegionPage | null> {
  const region = seasonRegionBySlug(regionSlug);
  if (!region) return null;
  const date = regionToday(region, now);
  const species: RegionSpeciesSummary[] = [];
  const verifiedDates: string[] = [];
  const sourceIds: string[] = [];
  for (const candidate of certifiedSpecies(region)) {
    const zones = await answersFor(candidate.layer, candidate.designations, candidate.speciesId, date);
    if (!zones.length || zones.every((zone) => zone.state === "NOT_CERTIFIED")) continue;
    const meta = await speciesMeta(candidate.speciesId);
    const { counts, opportunityZones, nextOpening } = summarize(zones);
    verifiedDates.push(...zones.map((zone) => zone.verifiedAt).filter((value): value is string => Boolean(value)));
    sourceIds.push(...zones.flatMap((zone) => [...zone.sourceIds, ...zone.opportunities.flatMap((row) => row.sourceId ? [row.sourceId] : [])]));
    species.push({
      speciesId: candidate.speciesId,
      speciesSlug: meta.slug,
      name: meta.name,
      term: candidate.layer.officialTermPlural ?? `${candidate.layer.officialTerm}s`,
      zoneCount: zones.length,
      counts,
      opportunityZones,
      nextOpening: nextOpening ? { opens: nextOpening.opens, closes: nextOpening.closes } : null,
    });
  }
  species.sort((a, b) => (b.opportunityZones > 0 ? 1 : 0) - (a.opportunityZones > 0 ? 1 : 0) || a.name.localeCompare(b.name, "en-CA"));
  return {
    region,
    date,
    species,
    layers: region.layers.map(({ layer, designations }) => ({
      id: layer.id,
      officialTerm: layer.officialTerm,
      officialTermPlural: layer.officialTermPlural ?? `${layer.officialTerm}s`,
      authority: layer.authority,
      zones: designations.length,
    })),
    sources: await sourcesOf(region, sourceIds),
    verifiedAt: verifiedDates.sort().at(-1) ?? null,
  };
}

export interface SeasonPageEntry {
  region: string;
  species: string;
  regionName: string;
  speciesName: string;
}

/** Every (region, species) pair that has a page, named, for links and the sitemap. */
export async function seasonPageIndex(): Promise<SeasonPageEntry[]> {
  const entries: SeasonPageEntry[] = [];
  for (const region of seasonRegions()) {
    const date = regionToday(region);
    for (const candidate of certifiedSpecies(region)) {
      // The same test `answersFor` applies, so no listed page renders empty.
      if (!layerApplicability(candidate.layer, candidate.speciesId, date).applies) continue;
      const meta = await speciesMeta(candidate.speciesId);
      entries.push({ region: region.slug, species: meta.slug, regionName: region.name, speciesName: meta.name });
    }
  }
  return entries;
}

/** The route parameters for static generation: exactly the index, keys only. */
export async function seasonPageParams(): Promise<Array<{ region: string; species: string }>> {
  return (await seasonPageIndex()).map(({ region, species }) => ({ region, species }));
}

export { EXPLORATION_WORDING, slugOf };
