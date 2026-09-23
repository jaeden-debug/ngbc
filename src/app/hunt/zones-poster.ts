import { unstable_cache } from "next/cache";
import { after } from "next/server";
import { OPENING_BOX, OVERVIEW_ZOOM, servedGeometryVersion } from "../../lib/hunt/exploration/overview";
import { posterDataUri, posterSvg } from "../../lib/hunt/exploration/overview-poster";
import { fetchZoneGeometry } from "../../lib/hunt/zone-geometry";

/**
 * The official-zones poster for /hunt's first paint, from a cache every
 * server instance shares.
 *
 * Only a complete answer is drawn and cached: if any authority does not
 * answer, nothing is cached and the page goes without a poster rather than
 * showing a picture that looks complete and is not. A cold cache never holds
 * the page up — past a short wait the page renders without the poster and the
 * cache is filled after the response.
 */
/*
 * Drawn from the very request the live map makes first — the opening camera's
 * own box, same zoom, same server cache — so the picture and the map cannot
 * come from different geometry. The cache key carries the served-geometry
 * version and the deployment, and it is revalidated as often as the zone
 * drawings themselves are cached at the edge.
 */
const DEPLOYMENT = process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "local";
const cachedPoster = unstable_cache(async (): Promise<string> => {
  const result = await fetchZoneGeometry(OPENING_BOX, OVERVIEW_ZOOM);
  if (result.status !== "OK" || !result.features.length) throw new Error("The official geometry was incomplete; no poster.");
  return posterDataUri(posterSvg(result.features));
}, ["hunt-zones-poster", servedGeometryVersion(), DEPLOYMENT], { revalidate: 21_600 });

/**
 * This instance's own copy of the answer it already drew, so a warm server
 * hands the poster to the page without waiting on the shared cache at all.
 * It carries the same key and the same lifetime as the shared entry, so it can
 * never be the staler of the two.
 */
const MEMORY_KEY = `${servedGeometryVersion()}:${DEPLOYMENT}`;
const MEMORY_MS = 21_600_000;
let memory: { key: string; value: string; expiresAt: number } | null = null;

export async function zonesPoster(waitMs = 350): Promise<string | null> {
  if (memory && memory.key === MEMORY_KEY && memory.expiresAt > Date.now()) return memory.value;
  const started = Date.now();
  const pending = cachedPoster().then((value) => {
    memory = { key: MEMORY_KEY, value, expiresAt: Date.now() + MEMORY_MS };
    return value;
  });
  let missedTheWait = false;
  // Whatever happens to this request, finish filling the cache for the next.
  after(() => pending.then(
    () => {
      // A page that shipped without a poster it could have had: the cause is the wait, not the geometry.
      if (missedTheWait) console.warn(`[hunt-poster] past the ${waitMs} ms wait: ready after ${Date.now() - started} ms`);
    },
    (error: unknown) => {
      // Observable, never fatal: the page simply opens without the poster.
      console.warn(`[hunt-poster] not drawn: ${error instanceof Error ? error.message : String(error)}`);
    },
  ));
  try {
    return await Promise.race([
      pending,
      new Promise<null>((resolve) => { setTimeout(() => { missedTheWait = true; resolve(null); }, waitMs); }),
    ]);
  } catch {
    return null;
  }
}
