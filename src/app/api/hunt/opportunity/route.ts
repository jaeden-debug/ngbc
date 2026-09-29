import { createOpportunityHandler, createSpeciesHeatHandler } from "../../../../lib/hunt/intelligence/handler.ts";
import { SITE_URL } from "../../../../lib/site";

/**
 * Read-only, cacheable opportunity evidence. These endpoints accept zone ids,
 * never a precise personal location, and cannot return a legal status.
 *
 * GET  — one species at one zone, with its components, sources and limitations.
 * POST — the species layer: the heat class of each zone in the viewport that
 *        holds evidence. Zones absent from the reply hold none.
 */
export const GET = createOpportunityHandler();
export const POST = createSpeciesHeatHandler({ canonicalOrigin: SITE_URL.origin });
