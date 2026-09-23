/**
 * Saskatchewan's Wildlife Management Zone identifiers, read LIVE.
 *
 * Every other jurisdiction in this build validates the regulation's unit
 * references against a certified inventory stored in the repository.
 * Saskatchewan has none and will not get one: its dataset carries the Standard
 * Unrestricted Use Data Licence v2.0, which grants commercial reuse, and the
 * same item says "Not for resale", so North Ground reads the ministry's
 * service and stores no copy of it (owner decision, 2026-09-22).
 *
 * WHAT IS STORED IS THE REGULATION, NOT THE MINISTRY'S DATASET. Schedule 3
 * Part 8 names the zones itself — "Provincial Wildlife Management Zones 43 and
 * 47 to 76" — and the federal bundle records what the REGULATION says. The
 * ministry's service is consulted only to check that every zone the regulation
 * names actually exists and that no reference expands into one that does not.
 * That is the same job the stored inventories do elsewhere; it is not a second
 * source of geography and no boundary is copied.
 *
 * IT FAILS CLOSED. If the service is unreachable, slow, or returns a different
 * set than the layer is certified for, the build STOPS. It never falls back to
 * a remembered list: a cached answer would be exactly the stored inventory the
 * licence decision rules out, and a build that quietly proceeded on stale
 * identifiers could place a hunter in a district the regulation never put them
 * in. An unread authority is an unanswered question, not an empty one.
 */

const SERVICE = "https://gis.saskatchewan.ca/arcgis/rest/services/WildlifeManagement/MapServer/0/query";

/**
 * The count the layer is certified for. Declared, so that a service returning
 * a DIFFERENT number of zones stops the build rather than silently changing
 * which zones a federal district contains. Saskatchewan revising its zones is
 * a regulatory event that needs a human, not a build that adapts to it.
 */
const CERTIFIED_ZONE_COUNT = 83;

/** The ministry's own identifier shape: 55, 2E, 68N, SWMZ, RWMZ, PWMZ. */
const DESIGNATION = /^(?:\d{1,2}[EWNS]?|[PRS]WMZ)$/;

export async function saskatchewanZones(fetchImpl = fetch) {
  const url = new URL(SERVICE);
  for (const [key, value] of Object.entries({
    where: "1=1", outFields: "ZONE_NUM,DA_NAME",
    returnGeometry: "false", returnDistinctValues: "true", f: "json",
  })) url.searchParams.set(key, value);

  let payload;
  try {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(60_000) });
    if (!response.ok) {
      throw new Error(`the Saskatchewan Ministry of Environment service returned HTTP ${response.status}`);
    }
    payload = await response.json();
  } catch (cause) {
    throw new Error(
      `Saskatchewan's zone identifiers could not be read from the ministry's own service, so this build cannot ` +
      `check the regulation's zone references against anything. It stops rather than assuming them: ${cause.message}`,
      { cause },
    );
  }

  /* An ArcGIS error is a 200 with an error body, so the shape is checked. */
  if (payload?.error) {
    throw new Error(`the Saskatchewan service answered with an error: ${payload.error.message ?? "unknown"}`);
  }
  if (!Array.isArray(payload?.features)) {
    throw new Error("the Saskatchewan service returned no feature list; its response shape has changed");
  }

  const names = new Map();
  for (const feature of payload.features) {
    const designation = String(feature?.attributes?.ZONE_NUM ?? "").trim().toUpperCase();
    if (!DESIGNATION.test(designation)) {
      throw new Error(`the Saskatchewan service returned a zone identifier this build does not recognise: ${designation || "(blank)"}`);
    }
    /* The ministry's own DA_NAME, so a zone the regulation names in words is
       matched against the authority's naming rather than against a guess. */
    names.set(designation, String(feature?.attributes?.DA_NAME ?? "").trim());
  }

  if (names.size !== CERTIFIED_ZONE_COUNT) {
    throw new Error(
      `the Saskatchewan service returned ${names.size} zones; the layer is certified for ${CERTIFIED_ZONE_COUNT}. ` +
      `A change to the province's zones is a regulatory event and needs review, not a build that adapts to it.`,
    );
  }

  return { identifiers: [...names.keys()], names, serviceUrl: SERVICE, readAt: new Date().toISOString() };
}
