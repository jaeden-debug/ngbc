import { createSpeciesHeatHandler } from "../../../../../lib/hunt/intelligence/handler.ts";
import { SITE_URL } from "../../../../../lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The species layer: the heat class of each zone in the viewport that holds
 * certified opportunity evidence. Zones absent from the reply hold none, and
 * the caller must not draw them as a low value.
 *
 * Its own route rather than a POST beside the GET above, so the single-zone
 * read stays edge-cacheable while this one is always dynamic.
 */
export const POST = createSpeciesHeatHandler({ canonicalOrigin: SITE_URL.origin });
