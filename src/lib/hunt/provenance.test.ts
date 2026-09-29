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

describe("no bundle launders North Ground's reasoning as an authority's words", () => {
  it("declares authorship on every absence rule, with provenance on the quotations", async () => {
    /* `AbsenceMeaning` carried a bare `statedAs` beside `sourceId` and
       `section`, under a doc comment reading "on whose authority" — and THREE
       OF ITS FIVE VALUES were North Ground's own reasoning ("so North Ground
       reports UNKNOWN rather than CLOSED"). Nothing rendered the field, so
       nothing was misattributed; it was a loaded gun rather than a wound.

       The discriminator is evidence, not prose: British Columbia's and
       Manitoba's sentences are verified verbatim against the live instrument
       by their generators, and Alberta's, Idaho's and Montana's are
       hand-written constants. This asserts the shape survives regeneration. */
    const { readdir, readFile } = await import("node:fs/promises");
    const dir = "content/regulatory";
    let withAbsence = 0;
    let quotations = 0;

    for (const file of await readdir(dir)) {
      if (!file.endsWith(".json")) continue;
      const parsed = JSON.parse(await readFile(`${dir}/${file}`, "utf8")) as {
        absence?: { words?: Record<string, unknown>; statedAs?: unknown; speciesExceptions?: Record<string, { words?: Record<string, unknown>; statedAs?: unknown }> };
      };
      const absence = parsed.absence;
      if (!absence) continue;
      withAbsence += 1;

      for (const [label, record] of [["absence", absence] as const,
        ...Object.entries(absence.speciesExceptions ?? {}).map(([k, v]) => [`absence.speciesExceptions.${k}`, v] as const)]) {
        const at = `${file} ${label}`;
        assert.equal(record.statedAs, undefined, `${at}: the bare statedAs is retired — authorship must be declared`);
        const words = record.words;
        if (!words) continue;
        assert.ok(words.owner === "AUTHORITY" || words.owner === "NORTH_GROUND", `${at}: owner must be declared`);
        if (words.owner === "AUTHORITY") {
          quotations += 1;
          for (const field of ["sourceId", "citation", "lang"]) {
            assert.ok(typeof words[field] === "string" && (words[field] as string).length > 0,
              `${at}: an authority quotation needs ${field}`);
          }
          assert.doesNotMatch(words.text as string, /North Ground/,
            `${at}: a sentence naming North Ground is not the authority's`);
        } else {
          for (const field of ["sourceId", "citation"]) {
            assert.equal(words[field], undefined, `${at}: North Ground wording must not carry authority provenance`);
          }
        }
      }
    }

    /* An empty sweep would satisfy every assertion above. */
    assert.ok(withAbsence >= 5, `expected at least 5 bundles with an absence rule, saw ${withAbsence}`);
    assert.ok(quotations >= 2, `expected at least 2 authority-quoted absences (BC, MB), saw ${quotations}`);
  });
});
