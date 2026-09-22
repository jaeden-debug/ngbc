import type { CanonicalId, IsoDate } from "../../content-contract/index.ts";
import { contentRepository } from "../../content/repository.ts";
import { speciesById } from "../coverage.ts";
import { regulatoryEntryFor, type RegulatoryEntry, type RegulatoryOutcome } from "../regulatory/registry.ts";
import { CANADA_JURISDICTIONS } from "../canada/registry.ts";
import type { ZoneResolution } from "../types.ts";
import { presentZone } from "../zone-presentation.ts";
import { layerById, officialNameOf, type ZoneLayer, zoneCoverage, zoneDisplayLabel, zoneIdFor } from "../zone-layers.ts";
import type { ExplorationState, SpeciesZoneSummary, ZoneRef, ZoneSummary } from "./states.ts";

export { EXPLORATION_WORDING } from "./states.ts";
export type { ExplorationState, SpeciesZoneSummary, ZoneRef, ZoneSummary } from "./states.ts";

/**
 * What the map says about a zone while someone is exploring.
 *
 * There is exactly one regulatory truth: the jurisdiction's entry in
 * `regulatory/registry.ts`, the same code a full Hunt runs. This module asks
 * that entry about the WHOLE zone (scope ZONE) and translates the answer into
 * exploration states. It never reads a season row itself, so the map cannot
 * drift from the engine, and it can never be more certain than the engine was:
 *
 *  - The engine never says OPEN, because a season existing is not a licence.
 *    A season that is running for every licence the law recognises is shown as
 *    SEASON_AVAILABLE, which is a statement about the season, not the hunter.
 *  - Where the answer depends on the hunter (residency, licence, method, tag,
 *    animal class, age), the engine asks a question. The map shows
 *    CHECK_REQUIREMENTS and never picks an answer on the hunter's behalf.
 *  - Where the answer depends on WHERE in the zone (a game bird zone line, a
 *    base, a waterfowl control area), the engine returns NEEDS_VERIFICATION and
 *    so does the map.
 *  - UNKNOWN stays UNKNOWN. It is never drawn or described as CLOSED.
 */

export class ZoneSummaryError extends Error {}

/** The layer a map reference names, only while Hunt serves it. */
export function servedLayer(layerId: string): ZoneLayer | null {
  const layer = layerById(layerId);
  return layer?.serving ? layer : null;
}

/* Codes ("57", "10O", "69A-1") and worded designations ("East of the
   Continental Divide", Montana's upland districts), bounded either way. */
const DESIGNATION = /^[A-Za-z0-9][A-Za-z0-9 .-]{0,47}$/;

export function isDesignation(value: unknown): value is string {
  return typeof value === "string" && DESIGNATION.test(value);
}

/** The zone as the engine sees it: resolved, with no point inside it. */
function zoneResolutionFor(layer: ZoneLayer, designation: string): ZoneResolution {
  return {
    status: "RESOLVED",
    zoneId: zoneIdFor(layer, designation),
    jurisdictionId: layer.jurisdictionId,
    officialName: officialNameOf(layer, designation),
    sourceId: layer.sourceId,
    message: "Whole-zone summary; no point inside the zone was evaluated.",
  };
}

const ZONE_SCOPE_PHRASE = "where in it you hunt.";

function stateOf(outcome: RegulatoryOutcome): ExplorationState {
  if (outcome.completeness === "NEEDS_INPUT") return "CHECK_REQUIREMENTS";
  if (outcome.exceptInside?.length && outcome.regulation.status === "NEEDS_VERIFICATION") return "SEASON_EXCEPT_AREAS";
  switch (outcome.regulation.status) {
    // OPEN is never produced by the engine today; if it ever is, the map still
    // describes a season, not the hunter's right to use it.
    case "OPEN":
    case "CONDITIONAL":
      return "SEASON_AVAILABLE";
    case "CLOSED":
      return "CLOSED";
    case "CONFLICT":
      return "CONFLICT";
    case "NEEDS_VERIFICATION":
      return "NEEDS_VERIFICATION";
    default:
      return "UNKNOWN";
  }
}

function detailOf(outcome: RegulatoryOutcome, state: ExplorationState): string | undefined {
  if (state !== "NEEDS_VERIFICATION") return undefined;
  const varies = outcome.regulation.limitations.find((line) => line.endsWith(ZONE_SCOPE_PHRASE));
  if (varies) return varies;
  const first = outcome.regulation.summary.split(/(?<=\.)\s/)[0];
  return first || undefined;
}

/* ── Cache ─────────────────────────────────────────────────────────────── */

/**
 * Deterministic in (zone, species, date) for the life of a deployment, because
 * the bundles are committed files. Bounded so a crawler walking every date
 * cannot grow it without limit.
 */
const CACHE_MAX = 6_000;

/** What is cached: the public summary plus the certified requirements the card lists. */
interface CachedSummary extends SpeciesZoneSummary {
  requirements: string[];
}

const cache = new Map<string, CachedSummary>();

export function clearZoneSummaryCache(): void {
  cache.clear();
}

function remember(key: string, value: CachedSummary): CachedSummary {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(key, value);
  return value;
}

/* ── Evaluation ────────────────────────────────────────────────────────── */

async function summarizeSpecies(
  entry: RegulatoryEntry,
  layer: ZoneLayer,
  designation: string,
  speciesId: CanonicalId<"species">,
  date: string,
): Promise<CachedSummary> {
  const key = `${layer.id}|${designation.toUpperCase()}|${speciesId}|${date}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const outcome = await entry.evaluate(
    // No coordinate: the whole-zone scope never reads one, and NaN makes sure
    // nothing could quietly answer for a made-up point.
    { latitude: Number.NaN, longitude: Number.NaN, date: date as IsoDate, speciesId, answers: {} },
    zoneResolutionFor(layer, designation),
    { verifiedAt: new Date(0).toISOString(), scope: "ZONE" },
  );
  const state = stateOf(outcome);
  const season = (state === "SEASON_AVAILABLE" || state === "SEASON_EXCEPT_AREAS") && outcome.regulation.season
    ? { opens: outcome.regulation.season.opens, closes: outcome.regulation.season.closes }
    : undefined;
  const detail = detailOf(outcome, state);
  const verifiedAt = /^\d{4}-\d{2}-\d{2}/.test(outcome.regulation.verifiedAt) && !outcome.regulation.verifiedAt.startsWith("1970")
    ? outcome.regulation.verifiedAt.slice(0, 10)
    : undefined;
  return remember(key, {
    speciesId,
    name: await speciesName(speciesId),
    state,
    ...(season ? { season } : {}),
    ...(state === "CHECK_REQUIREMENTS" && outcome.required ? { question: outcome.required.question } : {}),
    ...(detail ? { detail } : {}),
    ...(state === "SEASON_EXCEPT_AREAS" ? { exceptInside: outcome.exceptInside } : {}),
    ...(verifiedAt ? { verifiedAt } : {}),
    // Only an in-season species' conditions are in force on this date.
    requirements: state === "SEASON_AVAILABLE" || state === "SEASON_EXCEPT_AREAS" ? outcome.regulation.requirements : [],
  });
}

/** The summary without the cached requirement lines, which the zone lists once. */
function publicSummary(cached: CachedSummary): SpeciesZoneSummary {
  const summary: SpeciesZoneSummary & { requirements?: string[] } = { ...cached };
  delete summary.requirements;
  return summary;
}

/** The canonical library's name for a species; the id, readably, only if the library has none. */
async function speciesName(speciesId: CanonicalId<"species">): Promise<string> {
  const known = speciesById(speciesId)?.displayName ?? (await contentRepository.getSpecies(speciesId))?.title;
  if (known) return known;
  const words = speciesId.replace("species:", "").replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function speciesIn(entry: RegulatoryEntry): CanonicalId<"species">[] {
  return entry.coverage().species.map((row) => row.speciesId as CanonicalId<"species">);
}

/** Every certified species in the zone's jurisdiction, as the engine answers for the whole zone on `date`. */
/** The authority's own hunting rules page, where North Ground has none certified. */
function authorityRulesUrl(jurisdictionId: string): string | undefined {
  return CANADA_JURISDICTIONS.find((entry) => entry.id === jurisdictionId)?.regulatory.huntingAuthorityUrl;
}

export async function summarizeZone(ref: ZoneRef, date: string): Promise<ZoneSummary> {
  const layer = servedLayer(ref.layerId);
  if (!layer) throw new ZoneSummaryError("That map layer is not served.");
  if (!isDesignation(ref.designation)) throw new ZoneSummaryError("That is not a zone designation.");
  const designation = ref.designation.trim();

  const entry = regulatoryEntryFor(layer.jurisdictionId);

  const speciesIds = entry ? speciesIn(entry) : [];
  const species = entry
    ? await Promise.all(speciesIds.map((speciesId) => summarizeSpecies(entry, layer, designation, speciesId, date)))
    : [];

  const order: ExplorationState[] = ["SEASON_AVAILABLE", "SEASON_EXCEPT_AREAS", "CHECK_REQUIREMENTS", "NEEDS_VERIFICATION", "CONFLICT", "CLOSED", "UNKNOWN", "NOT_CERTIFIED"];
  species.sort((a, b) => order.indexOf(a.state) - order.indexOf(b.state) || a.name.localeCompare(b.name));

  const areas = entry?.specialAreasInZone ? entry.specialAreasInZone(designation) : undefined;
  const specialAreas = areas
    ? await Promise.all(areas.map(async (area) => ({
        name: area.name,
        layer: area.layer,
        statedAs: area.statedAs,
        species: await Promise.all(area.speciesIds.map((id) => speciesName(id as CanonicalId<"species">))),
      })))
    : null;
  const requirements = [...new Set(species.flatMap((summary) =>
    // Bag limits belong to a species' full answer, not to the zone.
    summary.requirements.filter((line) => !line.startsWith("Bag limit"))))];
  const verified = species.map((summary) => summary.verifiedAt).filter((value): value is string => Boolean(value)).sort();

  return {
    zone: {
      layerId: layer.id,
      designation,
      label: zoneDisplayLabel(layer, designation),
      officialName: officialNameOf(layer, designation),
      presentation: presentZone({
        designation, layerId: layer.id, jurisdictionId: layer.jurisdictionId, zoneId: zoneIdFor(layer, designation),
        officialName: officialNameOf(layer, designation),
      }),
      officialTerm: layer.officialTerm,
      jurisdictionId: layer.jurisdictionId,
      jurisdictionName: layer.jurisdictionName,
      authority: layer.authority,
      coverage: zoneCoverage(layer, designation),
      sourceId: layer.sourceId,
      /* Whether North Ground holds certified rules for this jurisdiction at all.
         A drawn boundary is not a claim about rules (CLAUDE.md section 41A), so
         a zone can be named and outlined while this is false. When it is false
         the card says so and sends the person to the authority's own rules. */
      rulesCertified: entry !== undefined,
      ...(entry ? {} : { authorityRulesUrl: authorityRulesUrl(layer.jurisdictionId) ?? null }),
    },
    date,
    species: species.map(publicSummary),
    requirements,
    // An indexed jurisdiction whose index lacks this zone has not been checked here — never "nothing there".
    pointOnlyChecks: entry?.pointOnlyChecks ?? (areas === null ? "published special areas" : null),
    specialAreas,
    counts: {
      certifiedHere: species.filter((summary) => summary.state !== "UNKNOWN" && summary.state !== "NOT_CERTIFIED").length,
      inSeason: species.filter((summary) => summary.state === "SEASON_AVAILABLE" || summary.state === "SEASON_EXCEPT_AREAS").length,
      dependsOnHunter: species.filter((summary) => summary.state === "CHECK_REQUIREMENTS").length,
      jurisdictionSpecies: speciesIds.length,
    },
    verifiedAt: verified.at(-1) ?? null,
  };
}

/**
 * One species across many zones, for the map's species filter.
 *
 * Each zone is the same whole-zone evaluation as the card, cached, so a filter
 * over the zones in view costs one engine run per zone the first time and a
 * map lookup after that.
 */
export async function zoneStatesForSpecies(
  speciesId: CanonicalId<"species">,
  date: string,
  zones: readonly ZoneRef[],
): Promise<Array<ZoneRef & { state: ExplorationState }>> {
  return await Promise.all(zones.map(async (ref) => {
    const layer = servedLayer(ref.layerId);
    if (!layer || !isDesignation(ref.designation)) return { ...ref, state: "UNKNOWN" as const };
    const entry = regulatoryEntryFor(layer.jurisdictionId);
    if (!entry || !speciesIn(entry).includes(speciesId)) return { ...ref, state: "NOT_CERTIFIED" as const };
    const summary = await summarizeSpecies(entry, layer, ref.designation.trim(), speciesId, date);
    return { ...ref, state: summary.state };
  }));
}
