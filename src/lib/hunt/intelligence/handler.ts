import { layerById, zoneIdFor } from "../zone-layers.ts";
import { evidenceProvenance, hasEvidenceForSpecies, heatMethodology, opportunityAcross, opportunityAt, servableDatasets } from "./bundles.ts";
import { OPPORTUNITY_METHODOLOGY } from "./methodology.ts";
import { hasCertifiedSurface, speciesSurfaces } from "./surface.ts";

/**
 * The opportunity endpoints.
 *
 * Neither of them imports the regulatory engine, and neither can return a legal
 * status. §41B keeps species opportunity and legal status in separate lanes;
 * this file is one end of that separation and the import list is the proof.
 *
 * What either handler will answer for is derived from the committed bundles
 * (`bundles.ts`). No species, jurisdiction or zone pattern is named here.
 */

/* Shapes only. A well-formed species or zone that holds no evidence is a 404 —
   "nothing is held here" — never a 400. Absence is a finding, not a bad request. */
const SPECIES_ID = /^species:[a-z0-9][a-z0-9-]{0,59}$/;
const ZONE_ID = /^management_zone:[a-z0-9][a-z0-9-]{0,63}$/;
const DESIGNATION = /^[A-Za-z0-9][A-Za-z0-9 .-]{0,47}$/;

/** The map may ask about at most one screenful. §41B: the ceiling is part of the question. */
export const MAX_HEAT_ZONES = 450;
const MAX_BODY_BYTES = 24_000;

const EVIDENCE_CACHE = "public, max-age=300, s-maxage=21600, stale-while-revalidate=86400";
const NO_STORE = "no-store";

function json(body: unknown, status: number, cacheControl: string) {
  return Response.json(body, { status, headers: { "cache-control": cacheControl } });
}

/** Testable server handler; the App Router file is only its transport adapter. */
export function createOpportunityHandler() {
  return async function GET(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const speciesId = url.searchParams.get("speciesId") ?? "";
    const geographyId = url.searchParams.get("geographyId") ?? "";
    if (!SPECIES_ID.test(speciesId) || !ZONE_ID.test(geographyId)) {
      return json({ error: "Provide a species id and a management zone id." }, 400, NO_STORE);
    }
    const evidence = opportunityAt(speciesId, geographyId);
    if (!evidence) {
      return json(
        {
          status: "NO_HEAT_MAP_DATA",
          message: hasEvidenceForSpecies(speciesId)
            ? "No certified opportunity evidence is published for this species in this area."
            : "North Ground holds no certified opportunity evidence for this species anywhere yet.",
        },
        404,
        EVIDENCE_CACHE,
      );
    }
    return json(evidence, 200, EVIDENCE_CACHE);
  };
}

/** What the layer can paint, and for whom, computed from the bundles at call time. */
export function createOpportunityCoverageHandler() {
  return async function GET(): Promise<Response> {
    const datasets = servableDatasets();
    return json(
      {
        status: "OK",
        datasetCount: datasets.length,
        speciesJurisdictionPairs: datasets.length,
        geographyCount: datasets.reduce((sum, dataset) => sum + dataset.geographyCount, 0),
        evidenceRecordCount: datasets.reduce((sum, dataset) => sum + dataset.evidenceRecordCount, 0),
        methodologyVersion: OPPORTUNITY_METHODOLOGY.version,
        /* The owner's A-E engineering grades, counted rather than asserted. No
           number in this reply is typed anywhere; all of it is computed from the
           committed bundles at call time, so a dataset cannot be made to look
           stronger than its evidence by editing a constant. */
        byGrade: datasets.reduce<Record<string, number>>((counts, dataset) => {
          counts[dataset.grade] = (counts[dataset.grade] ?? 0) + 1;
          return counts;
        }, {}),
        byRenderKind: datasets.reduce<Record<string, number>>((counts, dataset) => {
          counts[dataset.renderKind] = (counts[dataset.renderKind] ?? 0) + 1;
          return counts;
        }, {}),
        datasets,
      },
      200,
      EVIDENCE_CACHE,
    );
  };
}

interface HeatBody {
  speciesId?: unknown;
  zones?: unknown;
}

/**
 * POST { speciesId, zones: [{ layerId, designation }] } → the heat class of
 * each zone in view that holds evidence.
 *
 * A zone that is absent from the response holds no evidence. The map draws it
 * with no heat at all — never a cold value — and the legend says so in words.
 */
export function createSpeciesHeatHandler({ canonicalOrigin }: { canonicalOrigin: string }) {
  return async function POST(request: Request): Promise<Response> {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin && origin !== canonicalOrigin) {
      return json({ status: "ERROR", message: "Origin is not allowed." }, 403, NO_STORE);
    }
    if (request.headers.get("content-type")?.split(";", 1)[0]?.trim() !== "application/json") {
      return json({ status: "ERROR", message: "Content type must be application/json." }, 415, NO_STORE);
    }
    const raw = await request.text().catch(() => null);
    if (raw === null || new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
      return json({ status: "ERROR", message: "Request body could not be read." }, 400, NO_STORE);
    }
    let body: HeatBody;
    try {
      body = JSON.parse(raw) as HeatBody;
    } catch {
      return json({ status: "ERROR", message: "Request body must be valid JSON." }, 400, NO_STORE);
    }
    const { speciesId, zones } = body;
    if (typeof speciesId !== "string" || !SPECIES_ID.test(speciesId) || !Array.isArray(zones) || zones.length > MAX_HEAT_ZONES) {
      return json(
        { status: "ERROR", message: `Provide a species id and at most ${MAX_HEAT_ZONES} zones.` },
        400,
        NO_STORE,
      );
    }
    const refs: Array<{ layerId: string; designation: string; geographyId: string }> = [];
    for (const zone of zones) {
      const candidate = zone as { layerId?: unknown; designation?: unknown };
      if (typeof candidate?.layerId !== "string" || typeof candidate?.designation !== "string" || !DESIGNATION.test(candidate.designation)) {
        return json({ status: "ERROR", message: "Every zone needs a layer and a designation." }, 400, NO_STORE);
      }
      const layer = layerById(candidate.layerId);
      /* An unknown layer is skipped rather than refused: the map asks about
         everything in view, and a layer without evidence is a normal answer. */
      if (layer) {
        refs.push({ layerId: candidate.layerId, designation: candidate.designation, geographyId: zoneIdFor(layer, candidate.designation) });
      }
    }
    const classes = new Map(opportunityAcross(speciesId, refs.map(({ geographyId }) => geographyId)).map((entry) => [entry.geographyId, entry]));
    /* Keyed by the zone the caller named, so the map never has to mint a
       canonical id in the browser; only zones that hold evidence come back. */
    const heat = refs.flatMap(({ layerId, designation, geographyId }) => {
      const entry = classes.get(geographyId);
      return entry
        ? [{
          layerId,
          designation,
          geographyId,
          classification: entry.classification,
          /* The continuous value the ramp paints. Null is a refusal to rank and
             is never to be drawn at the cold end. */
          intensity: entry.intensity,
          coverage: entry.coverage,
          /* Carried beside the shade, never folded into it (§41B, §17 of the
             brief): a thin measurement can rank high and still be weak. */
          strength: entry.strength,
          renderKind: entry.renderKind,
        }]
        : [];
    });
    return json(
      {
        status: "OK",
        speciesId,
        methodologyVersion: OPPORTUNITY_METHODOLOGY.version,
        /* The peer set the percentile is against. A class is RELATIVE — it is
           never a claim about how many animals are on the ground. */
        peerSet: "this species, within each jurisdiction's own published dataset",
        /* Stated on every reply so a renderer cannot choose a finer primitive
           than the evidence supports (§41B, brief §9 and §29). */
        renderKind: heat.length ? heat[0].renderKind : "NONE",
        effort: OPPORTUNITY_METHODOLOGY.effort,
        zones: heat,
        sources: evidenceProvenance(speciesId),
      },
      200,
      EVIDENCE_CACHE,
    );
  };
}

/**
 * "How is this calculated?" — the real datasets, authorities, years, measures,
 * weights, resolution and limitations behind one species' heat.
 *
 * Its own endpoint rather than a fatter heat reply, because the panel is opened
 * rarely and the heat reply is sent on every pan.
 */
export function createHeatMethodologyHandler() {
  return async function GET(request: Request): Promise<Response> {
    const speciesId = new URL(request.url).searchParams.get("speciesId") ?? "";
    if (!SPECIES_ID.test(speciesId)) {
      return json({ status: "ERROR", message: "Provide a species id." }, 400, NO_STORE);
    }
    const methodology = heatMethodology(speciesId);
    if (!methodology) {
      return json(
        {
          status: "NO_HEAT_MAP_DATA",
          speciesId,
          methodology: OPPORTUNITY_METHODOLOGY,
          message: "North Ground holds no certified opportunity evidence for this species anywhere yet. That is a gap in what has been gathered, not a finding about where the animals are.",
        },
        404,
        EVIDENCE_CACHE,
      );
    }
    return json({ status: "OK", ...methodology }, 200, EVIDENCE_CACHE);
  };
}

/**
 * The species surface: everything a renderer needs to draw one species, and
 * everything it must not do, carried in the data.
 *
 * GET with a viewport, because a surface is a layer rather than a question
 * about named zones — and because §41B makes bounds part of the question, not
 * an optimisation: no continental evidence set is ever sent to a browser.
 *
 * A species with no surface is 404 with the reason in words. A blank map reads
 * to a hunter as "there are no animals here", so nothing here may return an
 * empty body and let the caller decide what that meant.
 */
export function createSpeciesSurfaceHandler() {
  return async function GET(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const speciesId = url.searchParams.get("speciesId") ?? "";
    if (!SPECIES_ID.test(speciesId)) {
      return json({ status: "ERROR", message: "Provide a species id." }, 400, NO_STORE);
    }
    const bbox = url.searchParams.get("bbox");
    let box: [number, number, number, number] | undefined;
    if (bbox !== null) {
      const parts = bbox.split(",").map(Number);
      if (parts.length !== 4 || parts.some((value) => !Number.isFinite(value))) {
        return json({ status: "ERROR", message: "bbox must be west,south,east,north." }, 400, NO_STORE);
      }
      const [west, south, east, north] = parts as [number, number, number, number];
      if (west > east || south > north || south < -90 || north > 90 || west < -180 || east > 180) {
        return json({ status: "ERROR", message: "bbox must be a valid west,south,east,north box." }, 400, NO_STORE);
      }
      box = [west, south, east, north];
    }
    const response = speciesSurfaces(speciesId, box);
    if (!response.surfaces.length && response.refusals.length) {
      /* Evidence exists and the request could not carry it. Saying "no evidence"
         here would be false, and 404 would be the wrong word for it. */
      return json({ status: "REQUEST_TOO_LARGE", speciesId, refusals: response.refusals }, 413, NO_STORE);
    }
    if (!response.surfaces.length && hasCertifiedSurface(speciesId)) {
      /* The species HAS a surface; it just does not reach this ground. Saying
         "no evidence is held for this species" here was false — ruffed grouse
         asked about over Florida answered exactly that. An empty list with the
         reason is the true answer, and it is not a statement about animals. */
      return json(
        {
          speciesId,
          surfaces: [],
          refusals: [],
          emptyMeans: "This species' surface does not reach this ground: the surveys behind it did not cover it. That is not a finding that the species is absent.",
        },
        200,
        EVIDENCE_CACHE,
      );
    }
    if (!response.surfaces.length) {
      return json(
        {
          status: "NO_SURFACE",
          speciesId,
          /* Why, rather than nothing: an empty answer and an unheld species are
             different facts, and only one of them is about the animals. */
          message: hasEvidenceForSpecies(speciesId)
            ? "North Ground holds zone-level evidence for this species, but none of it may be drawn as a surface: a figure for a whole management area is not a surface, and says nothing about where inside it the animals are. Unshaded ground is a gap in what North Ground holds, not a finding about the animals."
            : "No certified evidence is held for this species. That is a gap in what North Ground holds, not a finding about the animals.",
        },
        404,
        EVIDENCE_CACHE,
      );
    }
    return json(response, 200, EVIDENCE_CACHE);
  };
}
