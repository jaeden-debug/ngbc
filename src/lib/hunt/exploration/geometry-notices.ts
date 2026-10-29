/**
 * Which layers are currently drawn from the overview only, as the map's own
 * requests answer.
 *
 * A notice about an authority's service must follow that service: an outage
 * raises it, and the next answer that succeeds for the same layer takes it
 * away. Replacing the whole list with each response looks equivalent and is
 * not — a response covering one jurisdiction would silently clear another's
 * outage, and a response that never comes would hold a stale warning forever
 * (the Québec notice the owner saw while the service was healthy).
 */
export interface LayerOutcome {
  id?: string;
  status?: string;
}

export function mergeSimplified(current: readonly string[], layers: readonly LayerOutcome[] | undefined): string[] {
  const next = new Set(current);
  for (const layer of layers ?? []) {
    if (!layer.id) continue;
    if (layer.status === "PROVIDER_ERROR") next.add(layer.id);
    // Any other outcome is this layer answering for itself: the notice goes.
    else next.delete(layer.id);
  }
  return [...next];
}

/**
 * The sentence for a layer whose zones are not drawn, by who failed.
 *
 * A request from the browser that never reached North Ground — refused,
 * offline, or answered with something that is not North Ground's reply — says
 * nothing about any government's service. Naming the authority there blamed
 * eleven Canadian authorities and three states for a failure that was ours
 * (the growth lane reproduced it on production, 2026-10-29). Only a reply in
 * which North Ground reports the authority's service as failing names it.
 */
export type MissingCause = "AUTHORITY" | "NORTH_GROUND";

export function missingLayerMessage(authority: string, cause: MissingCause): string {
  return cause === "AUTHORITY"
    ? `${authority}'s zone service is not answering, so its zones are not drawn. North Ground will not draw an approximate boundary.`
    : "The map's zone data did not load, so zones are not drawn. North Ground will try again, and will not draw an approximate boundary.";
}
