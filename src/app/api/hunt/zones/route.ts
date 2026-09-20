import { fetchZoneGeometry, parseBounds } from "../../../../lib/hunt/zone-geometry";
import { COVERAGE_ROADMAP, layerById } from "../../../../lib/hunt/zone-layers";
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
  const result = await fetchZoneGeometry(bounds, zoom);
  const layer = result.layerId ? layerById(result.layerId) : undefined;

  return json(
    {
      status: result.status,
      message: result.message,
      tolerance: result.tolerance,
      // Terminology travels with the geometry so the interface never has to guess
      // whether these areas are called units, zones or WMUs.
      layer: layer
        ? {
            id: layer.id,
            jurisdictionName: layer.jurisdictionName,
            officialTerm: layer.officialTerm,
            officialTermShort: layer.officialTermShort,
            authority: layer.authority,
            coverage: layer.coverage,
            coverageNote: layer.coverageNote,
            sourceId: layer.sourceId,
          }
        : null,
      roadmap: COVERAGE_ROADMAP,
      features: result.features,
    },
    200,
    {
      // Generalised public boundary data: safe to cache at the edge, and the
      // authority is not queried again for every viewer of the same view.
      "cache-control":
        result.status === "PROVIDER_ERROR"
          ? "no-store"
          : "public, max-age=900, s-maxage=21600, stale-while-revalidate=86400",
    },
  );
}
