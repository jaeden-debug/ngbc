import { createOpportunityHandler } from "../../../../lib/hunt/intelligence/handler.ts";

/**
 * Read-only, cacheable opportunity evidence. These endpoints accept zone ids,
 * never a precise personal location, and cannot return a legal status.
 *
 * One species at one zone, with its components, sources and limitations. The
 * viewport form the map layer needs is `./heat`, which is always dynamic.
 */
export const GET = createOpportunityHandler();
