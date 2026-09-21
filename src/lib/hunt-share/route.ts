import { isValidHuntBriefShareId } from "./model.ts";
import type { HuntBriefStore } from "./store.ts";

/**
 * Whether a Hunt Brief URL should render the brief page or answer 404.
 *
 * Decided BEFORE the page renders, in the proxy, for a reason that lives in the
 * framework rather than here. In Next 16 a `notFound()` thrown from a page is
 * rendered through an error shell whose body is empty by construction
 * (`getErrorRSCPayload` builds `<body>` with no children in production), and the
 * 404 UI is then drawn from the RSC payload in the browser. So a missing brief
 * served a 404 whose HTML contained nothing: a blank page to anyone without
 * JavaScript, and to anyone on a slow connection until it arrived — which is the
 * ordinary case for somebody opening a link a friend sent them from the field.
 *
 * Answering "not found" here instead lets the proxy rewrite to a real page with
 * a 404 status, and that page renders in full on the server.
 */
export type ShareRouteDecision = "render" | "not_found";

export async function decideShareRoute(
  shareId: string,
  getStore: () => HuntBriefStore,
): Promise<ShareRouteDecision> {
  // A malformed ID cannot name a brief, so storage is never asked.
  if (!isValidHuntBriefShareId(shareId)) return "not_found";

  let store: HuntBriefStore;
  try {
    store = getStore();
  } catch {
    // Storage is not configured. The page knows how to say "temporarily
    // unavailable"; this function does not get to decide the brief is gone.
    return "render";
  }

  try {
    return (await store.exists(shareId)) ? "render" : "not_found";
  } catch {
    // An outage must never become a 404. "This brief does not exist" and "we
    // cannot read briefs right now" are different statements, and only the
    // second is true while storage is down. The page renders its unavailable
    // state, which invites the reader to try again.
    return "render";
  }
}
