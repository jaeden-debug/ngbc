import { layerById, zoneIdFor } from "../zone-layers.ts";
import { evidenceProvenance, hasEvidenceForSpecies, opportunityAcross, opportunityAt, servableDatasets } from "./bundles.ts";

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
      return entry ? [{ layerId, designation, geographyId, classification: entry.classification, coverage: entry.coverage }] : [];
    });
    return json(
      {
        status: "OK",
        speciesId,
        methodologyVersion: "opportunity-v1",
        /* The peer set the percentile is against. A class is RELATIVE — it is
           never a claim about how many animals are on the ground. */
        peerSet: "this species, within each jurisdiction's own published dataset",
        zones: heat,
        sources: evidenceProvenance(speciesId),
      },
      200,
      EVIDENCE_CACHE,
    );
  };
}
