import { ontarioWhiteTailedDeerOpportunity } from "./ontario-harvest.ts";

const ZONE_PATTERN = /^management_zone:ca-on-wmu-[a-z0-9-]{1,8}$/;

function json(body: unknown, status: number, cacheControl: string) {
  return Response.json(body, { status, headers: { "cache-control": cacheControl } });
}

/** Testable server handler; the App Router file is only its transport adapter. */
export function createOpportunityHandler() {
  return async function GET(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const speciesId = url.searchParams.get("speciesId");
    const geographyId = url.searchParams.get("geographyId");
    if (speciesId !== "species:white-tailed-deer" || !geographyId || !ZONE_PATTERN.test(geographyId)) {
      return json({ error: "Unsupported species or geography." }, 400, "no-store");
    }
    const evidence = ontarioWhiteTailedDeerOpportunity(geographyId);
    if (!evidence) {
      return json(
        { status: "NO_HEAT_MAP_DATA", message: "No certified opportunity evidence is published for this species and area." },
        404,
        "public, max-age=300, s-maxage=3600",
      );
    }
    return json(evidence, 200, "public, max-age=300, s-maxage=21600, stale-while-revalidate=86400");
  };
}
