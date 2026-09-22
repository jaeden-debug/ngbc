import { isValidHuntBriefShareId } from "./model.ts";
import { withDeadline } from "./deadline.ts";
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

/**
 * How long the proxy may spend asking whether a brief exists.
 *
 * The question is asked before any response starts, so while it is being
 * answered the reader is looking at nothing. A healthy lookup is one indexed
 * read of an ID column and returns in well under this. An unhealthy one was
 * measured on 2026-09-21 failing with Cloudflare 522 after 19 to 25 seconds —
 * and without this bound the proxy waited that long and then the page waited
 * it again, doubling what a reader sat through during the outage.
 *
 * Exceeding it is safe by construction: the answer falls back to "render", and
 * the page makes its own lookup, which is always correct. The only thing a
 * timeout can cost is the server-rendered 404 body for one missing brief.
 */
export const EXISTENCE_CHECK_TIMEOUT_MS = 1500;

export async function decideShareRoute(
  shareId: string,
  getStore: () => HuntBriefStore,
  { timeoutMs = EXISTENCE_CHECK_TIMEOUT_MS }: { timeoutMs?: number } = {},
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
    const exists = await withDeadline(
      (signal) => store.exists(shareId, { signal }),
      timeoutMs,
      "Hunt Brief existence check timed out",
    );
    return exists ? "render" : "not_found";
  } catch {
    // An outage must never become a 404, and neither may a slow answer.
    // "This brief does not exist" and "we cannot tell right now" are different
    // statements, and only the second is true while storage is down or slow.
    // The page renders and makes its own lookup.
    return "render";
  }
}
