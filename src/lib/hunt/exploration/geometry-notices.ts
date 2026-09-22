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
