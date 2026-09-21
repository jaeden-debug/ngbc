import type { Metadata } from "next";
import HuntBriefUnavailable from "../../../components/hunt-share/HuntBriefUnavailable.tsx";
import { unavailableHuntBriefMetadata } from "../../../lib/hunt-share/metadata.ts";

/**
 * The page a missing Hunt Brief is answered with.
 *
 * Reached only through `src/proxy.ts`, which rewrites a missing or malformed
 * brief URL here with a 404 status — so the address bar keeps the link the
 * reader followed, the status is correct, and the page renders in full on the
 * server. See `lib/hunt-share/route.ts` for why this is not `notFound()`.
 *
 * `noindex` is declared here rather than inherited. A page under the root
 * layout inherits `index, follow`, and a 404 that invites indexing is a worse
 * defect than the empty page this replaces.
 */
export const metadata: Metadata = unavailableHuntBriefMetadata();

export default function HuntBriefNotFoundPage() {
  return <HuntBriefUnavailable reason="not_found" />;
}
