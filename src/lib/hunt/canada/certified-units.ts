import { BRITISH_COLUMBIA_MU_CONFIG } from "../ingestion/british-columbia-mu.ts";
import {
  NEWFOUNDLAND_BEAR_CONFIG, NEWFOUNDLAND_CARIBOU_CONFIG, NEWFOUNDLAND_MOOSE_CONFIG,
} from "../ingestion/newfoundland-areas.ts";
import { YUKON_GMS_CONFIG } from "../ingestion/yukon-subzones.ts";
import { CANADA_LIVE_ZONE_LAYERS, canadaLiveAdapterConfig } from "./live-layers.ts";

/**
 * How many official units each jurisdiction's authority publishes.
 *
 * Every number comes from the ingestion adapter the certification run asserts
 * against the authority's own service: `audit-zone-certification.mjs` and
 * `certify-live-zone-layer.mjs` both fail closed when the service disagrees
 * with `expectedUnits`, so none of these can drift from what the authority
 * serves, and none is a constant someone can edit to look more covered.
 *
 * Jurisdictions whose rules are certified carry the count in their bundle
 * instead; this fills the gap for geography certified ahead of its rules.
 */
const STORED_CONFIGS = [
  BRITISH_COLUMBIA_MU_CONFIG,
  YUKON_GMS_CONFIG,
  NEWFOUNDLAND_MOOSE_CONFIG,
  NEWFOUNDLAND_CARIBOU_CONFIG,
  NEWFOUNDLAND_BEAR_CONFIG,
];

/** The authority's own unit count for one layer, from its certified adapter. */
export function certifiedUnitsForLayer(layerId: string): number | null {
  const stored = STORED_CONFIGS.find((config) => config.layerId === layerId);
  if (stored) return stored.expectedUnits;
  return canadaLiveAdapterConfig(layerId)?.expectedUnits ?? null;
}

export function certifiedUnitCount(jurisdictionId: string): number | null {
  const stored = STORED_CONFIGS.filter((config) => config.jurisdictionCanonicalId === jurisdictionId);
  // A species-scoped jurisdiction has one geography per species; each is official.
  if (stored.length) return stored.reduce((total, config) => total + config.expectedUnits, 0);

  const live = CANADA_LIVE_ZONE_LAYERS.find((layer) => layer.jurisdictionId === jurisdictionId);
  return live ? canadaLiveAdapterConfig(live.id)?.expectedUnits ?? null : null;
}
