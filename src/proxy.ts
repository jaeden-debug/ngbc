import { NextResponse, type NextRequest } from "next/server";
import { decideShareRoute } from "./lib/hunt-share/route.ts";
import { defaultHuntBriefStore } from "./lib/hunt-share/store.ts";

/**
 * Answers a missing Hunt Brief before its page renders.
 *
 * A `notFound()` thrown from a page in Next 16 produces a 404 whose HTML body is
 * empty by construction, so this decides "missing" first and rewrites to a real
 * page carrying a 404 status instead. The reason is set out in
 * `lib/hunt-share/route.ts`.
 *
 * Scoped to brief URLs only. Nothing else on the site pays for it.
 */
const NOT_FOUND_PAGE = "/hunt/share-unavailable";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // The not-found page is only ever a 404, including when requested directly.
  if (pathname === NOT_FOUND_PAGE) {
    return NextResponse.rewrite(new URL(NOT_FOUND_PAGE, request.url), { status: 404 });
  }

  const shareId = decodeURIComponent(pathname.slice("/hunt/share/".length));
  const decision = await decideShareRoute(shareId, defaultHuntBriefStore);
  if (decision === "not_found") {
    // A rewrite, not a redirect: the reader keeps the URL they followed, and no
    // extra round trip is spent on the poor connection they may be on.
    return NextResponse.rewrite(new URL(NOT_FOUND_PAGE, request.url), { status: 404 });
  }
  return NextResponse.next();
}

export const config = {
  // One path segment: `/hunt/share/:id/opengraph-image` is not matched, and
  // renders its own "unavailable" image for a missing brief.
  matcher: ["/hunt/share/:shareId", "/hunt/share-unavailable"],
};
