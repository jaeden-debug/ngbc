import type { CanonicalId, SourceRecord } from "../../content-contract/index.ts";
import newBrunswickBundle from "../../../../content/regulatory/ca-nb-2026.json" with { type: "json" };
import newfoundlandBundle from "../../../../content/regulatory/ca-nl-2026.json" with { type: "json" };
import novaScotiaBundle from "../../../../content/regulatory/ca-ns-2026.json" with { type: "json" };
import saskatchewanBundle from "../../../../content/regulatory/ca-sk-2026.json" with { type: "json" };

/**
 * Source records for the bundles whose sources the content registry does not
 * hold.
 *
 * Without these, a Nova Scotia, Newfoundland and Labrador, New Brunswick or
 * Saskatchewan answer cited source ids that nothing resolved, and Hunt showed
 * the rule with no link to the instrument it came from — against §41A's
 * one-tap path to the official source. Each record is described from the
 * bundle itself: the authority's own title and URL as recorded when the bundle
 * was built, and the bundle's retrieval date.
 */
interface BundleShape {
  retrievedAt: string;
  sources: ReadonlyArray<{ id: string; title: string; url: string; authority?: string }>;
}

function recordsFrom(bundle: BundleShape, publisher: string, jurisdictionId: string) {
  return (ids: readonly string[]): SourceRecord[] => {
    const wanted = new Set(ids);
    return bundle.sources
      .filter((source) => wanted.has(source.id))
      .map((source) => ({
        id: source.id as CanonicalId<"source">,
        authority: source.authority ?? publisher,
        title: source.title,
        url: source.url,
        publisher,
        retrievedAt: `${bundle.retrievedAt}T00:00:00Z`,
        type: "official" as const,
        jurisdictionIds: [jurisdictionId as CanonicalId<"jurisdiction">],
        verificationStatus: "verified" as const,
      }));
  };
}

export const novaScotiaSourceRecords = recordsFrom(novaScotiaBundle, "Government of Nova Scotia", "jurisdiction:ca-ns");
export const newfoundlandSourceRecords = recordsFrom(newfoundlandBundle, "Government of Newfoundland and Labrador", "jurisdiction:ca-nl");
export const newBrunswickSourceRecords = recordsFrom(newBrunswickBundle, "Government of New Brunswick", "jurisdiction:ca-nb");
export const saskatchewanSourceRecords = recordsFrom(saskatchewanBundle, "Government of Saskatchewan", "jurisdiction:ca-sk");
