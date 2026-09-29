import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CanonicalId } from "../content-contract/index.ts";
import {
  authored,
  isQuotation,
  provenancedLine,
  quoting,
  type AuthorityQuotation,
  type NorthGroundStatement,
} from "./provenance.ts";

/**
 * The `@ts-expect-error` assertions are load-bearing compile-time tests.
 * TypeScript reports an unused directive as an error, so widening either type
 * makes `npm test` fail during its initial `tsc --noEmit` step.
 */

const SOURCE = "source:ca-mb-wildlife-lands-service" as CanonicalId<"source">;

function renderQuotation(quotation: AuthorityQuotation): string {
  return `“${quotation.text}” — ${quotation.citation}`;
}

describe("provenance is structural, not conventional", () => {
  it("will not let North Ground's words through the quotation renderer", () => {
    const ours: NorthGroundStatement = authored("North Ground has not certified this.");

    // @ts-expect-error North Ground wording is not an authority quotation
    renderQuotation(ours);
    // @ts-expect-error a bare string has declared no authorship
    renderQuotation("No person shall hunt in a refuge.");
    // @ts-expect-error owner is required; authorship is never inferred or defaulted
    renderQuotation({ text: "x", sourceId: SOURCE, citation: "s.1", lang: "en-CA" });

    assert.equal(isQuotation(ours), false);
  });

  it("will not let a quotation exist without complete provenance", () => {
    // @ts-expect-error a quotation without a source is a rumour
    quoting("No person shall hunt in a refuge.");
    // @ts-expect-error a quotation without a citation cannot be checked
    quoting("No person shall hunt in a refuge.", SOURCE);
    // @ts-expect-error language is the authority's fact and must not default
    quoting("No person shall hunt in a refuge.", SOURCE, "s.1");

    const sound = quoting("No person shall hunt in a refuge.", SOURCE, "s.1", "en-CA");
    assert.equal(renderQuotation(sound), "“No person shall hunt in a refuge.” — s.1");
  });

  it("will not let North Ground wording acquire authority provenance", () => {
    // @ts-expect-error NorthGroundStatement deliberately has no sourceId
    const drifted: NorthGroundStatement = { ...authored("ours"), sourceId: SOURCE };
    assert.equal(drifted.owner, "NORTH_GROUND");
  });

  it("puts quote marks on authority wording and not on ours", () => {
    assert.equal(
      provenancedLine("Example Refuge", quoting("No person shall hunt.", SOURCE, "s.1", "en-CA")),
      "Example Refuge: “No person shall hunt.”",
    );
    assert.equal(
      provenancedLine("unread feature", authored("North Ground's catalogue does not include it.")),
      "unread feature: North Ground's catalogue does not include it.",
    );
  });
});
