import { overlayLayersFor } from "../../../../lib/hunt/exploration/overlay-layers";
import { fetchZoneGeometry, parseBounds } from "../../../../lib/hunt/zone-geometry";
import { COVERAGE_ROADMAP, layerById, officialTermPlural } from "../../../../lib/hunt/zone-layers";
import { createRateLimiter, getClientAddress } from "../../../../lib/newsletter/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Official hunting-zone geometry for the map viewport.
 *
 * A read-only projection of an authority's own published layer: the viewport is
 * bounded, the simplification tolerance is chosen server-side from the zoom, and a
 * provider outage returns an explicit `PROVIDER_ERROR` rather than a guess. The
 * browser is never handed a continental polygon set.
 */

const limiter = createRateLimiter({ limit: 120, windowMs: 60_000 });

function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  return Response.json(data, { status, headers });
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const bounds = parseBounds(url.searchParams.get("bounds"));
  if (!bounds) {
    return json({ status: "INVALID", features: [], message: "Provide bounds as west,south,east,north." }, 400, {
      "cache-control": "no-store",
    });
  }

  const rate = limiter.check(getClientAddress(request));
  if (!rate.allowed) {
    return json({ status: "RATE_LIMITED", features: [], message: "Too many map requests. Try again shortly." }, 429, {
      "cache-control": "no-store",
      "retry-after": String(rate.retryAfterSeconds),
    });
  }

  const zoom = Number(url.searchParams.get("zoom") ?? 5);
  /*
   * A species-scoped jurisdiction is drawn in the geography of the species in
   * hand. The species is passed through whether or not the library holds it:
   * treating an unrecognised one as "no species" would fall back to the default
   * geography, which is how caribou came to draw Newfoundland's MOOSE areas —
   * the wrong official boundary under a species we cannot answer for. Only the
   * id's shape is checked, so junk cannot reach the layer filter. A
   * jurisdiction with one geography for everything is unaffected either way.
   */
  const asked = url.searchParams.get("species") ?? "";
  const speciesId = /^species:[a-z0-9][a-z0-9-]{0,80}$/.test(asked) ? asked : undefined;
  const result = await fetchZoneGeometry(bounds, zoom, fetch, { speciesId });
  const describe = (id: string) => {
    const layer = layerById(id);
    return layer
      ? {
          id: layer.id,
          jurisdictionName: layer.jurisdictionName,
          officialTerm: layer.officialTerm,
          officialTermShort: layer.officialTermShort,
          officialTermPlural: officialTermPlural(layer),
          authority: layer.authority,
          coverage: layer.coverage,
          coverageNote: layer.coverageNote,
          sourceId: layer.sourceId,
        }
      : null;
  };

  return json(
    {
      status: result.status,
      message: result.message,
      tolerance: result.tolerance,
      // Terminology travels with the geometry so the interface never has to guess
      // whether these areas are called units, zones or WMUs. A view can span
      // jurisdictions, so every layer asked is described, each with its outcome;
      // `layer` is set only when one jurisdiction is in view.
      layer: result.layerId ? describe(result.layerId) : null,
      layers: (result.layers ?? []).map((outcome) => ({ ...describe(outcome.layerId), status: outcome.status })),
      roadmap: COVERAGE_ROADMAP,
      // Special regulatory layers the authority serves for this view, drawn only on request.
      overlays: overlayLayersFor(bounds),
      features: result.features,
    },
    200,
    {
      // Generalised public boundary data: safe to cache at the edge, and the
      // authority is not queried again for every viewer of the same view.
      "cache-control":
        result.status === "PROVIDER_ERROR" || result.status === "PARTIAL"
          ? "no-store"
          : "public, max-age=900, s-maxage=21600, stale-while-revalidate=86400",
    },
  );
}
