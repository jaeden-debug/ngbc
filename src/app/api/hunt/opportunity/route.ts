import { createOpportunityHandler } from "../../../../lib/hunt/intelligence/handler.ts";

/**
 * Read-only, cacheable opportunity evidence. This endpoint accepts a zone id,
 * never a precise personal location, and cannot return a legal status.
 */
export const GET = createOpportunityHandler();
