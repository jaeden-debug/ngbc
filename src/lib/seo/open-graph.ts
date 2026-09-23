import { SITE_NAME } from "../site.ts";

/**
 * The Open Graph fields every page shares.
 *
 * Next replaces a parent's `openGraph` wholesale when a page sets its own, so a
 * page that writes its own title silently loses the site name and locale the
 * root layout declared. Spread this into every page-level `openGraph`.
 */
export const OPEN_GRAPH_BASE = {
  siteName: SITE_NAME,
  locale: "en_CA",
} as const;
