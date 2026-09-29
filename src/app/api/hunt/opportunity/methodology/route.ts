import { createHeatMethodologyHandler } from "../../../../../lib/hunt/intelligence/handler.ts";

export const runtime = "nodejs";

/**
 * The heat layer's own account of itself: which authority's dataset, measured
 * when, at what resolution, which measures moved the shade and by how much.
 *
 * Read only when a hunter asks, which is why it is not folded into the heat
 * reply the map sends on every pan.
 */
export const GET = createHeatMethodologyHandler();
