import type { CanonicalId } from "../content-contract";
import { SupabaseServerConfigurationError } from "../supabase/server";
import { defaultSpeciesMediaStore, SpeciesMediaPersistenceError, type SpeciesMediaStore } from "./store";
import type { SpeciesPrimaryMedia } from "./types";

function readFailure(error: unknown): boolean {
  return error instanceof SupabaseServerConfigurationError
    || (error instanceof SpeciesMediaPersistenceError && error.code === "READ_FAILED");
}

export async function getSpeciesPrimaryMedia(
  speciesId: CanonicalId<"species">,
  store?: SpeciesMediaStore,
): Promise<SpeciesPrimaryMedia | null> {
  try {
    return await (store ?? defaultSpeciesMediaStore()).getPrimary(speciesId);
  } catch (error) {
    if (!readFailure(error)) throw error;
    console.error("[species-media] canonical media is unavailable");
    return null;
  }
}

export async function getSpeciesPrimaryMediaMap(
  speciesIds: CanonicalId<"species">[],
  store?: SpeciesMediaStore,
): Promise<Map<CanonicalId<"species">, SpeciesPrimaryMedia>> {
  try {
    return await (store ?? defaultSpeciesMediaStore()).getPrimaryMap(speciesIds);
  } catch (error) {
    if (!readFailure(error)) throw error;
    console.error("[species-media] canonical media is unavailable");
    return new Map();
  }
}
