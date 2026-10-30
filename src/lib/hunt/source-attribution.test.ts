import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { regulatoryEntryFor } from "./regulatory/registry.ts";
import { regionPage } from "./season-pages/seasons.ts";
import { summarizeZone } from "./exploration/zone-summary.ts";
import { distinctAttributions } from "./source-attribution.ts";
import { attributionsForSourceIds } from "./source-attribution-lookup.ts";

/**
 * THE KING'S PRINTER LICENCE – BRITISH COLUMBIA, s. 3.3: its statement must be
 * "displayed prominently at least once in association with any Reproduction".
 *
 * Found 2026-10-30: BC's regulation text was live in production and the
 * statement was in one research record and nowhere a hunter could see it. The
 * statement is now data on every BC Laws source; these tests hold the data to
 * the reviewed licence record word for word, and hold the surfaces to printing
 * it once.
 */

const LICENCE = JSON.parse(readFileSync("docs/research/bc-within-zone/ca-bc-closed-areas-enumeration.json", "utf8")).source.licence as {
  name: string;
  mandatoryAttribution: string;
};

test("the reviewed record is the King's Printer Licence and its statement ends as the licence requires", () => {
  assert.equal(LICENCE.name, "King's Printer Licence – British Columbia");
  assert.match(LICENCE.mandatoryAttribution, /THESE MATERIALS ARE NOT AN OFFICIAL VERSION\.$/);
});

test("every BC Laws source in every regulatory bundle carries the statement, verbatim", () => {
  const bcLaws: Array<{ id: string; jurisdictionId: string }> = [];
  for (const file of readdirSync("content/regulatory").filter((name) => name.endsWith(".json"))) {
    const bundle = JSON.parse(readFileSync(`content/regulatory/${file}`, "utf8"));
    for (const source of Array.isArray(bundle.sources) ? bundle.sources : []) {
      if (typeof source?.url === "string" && source.url.startsWith("https://www.bclaws.gov.bc.ca/")) {
        bcLaws.push({ id: source.id, jurisdictionId: bundle.jurisdictionId });
      }
    }
  }
  assert.ok(bcLaws.length >= 9, `positive control: found ${bcLaws.length} BC Laws sources`);
  for (const { id, jurisdictionId } of bcLaws) {
    const [record] = regulatoryEntryFor(jurisdictionId)?.sourceRecords?.([id]) ?? [];
    assert.ok(record, `${id} resolves to a source record`);
    assert.equal(record.attribution, LICENCE.mandatoryAttribution, `${id} carries the statement word for word`);
    assert.equal(record.licence, LICENCE.name);
  }
});

test("a source under another publication's terms does not borrow the statement", () => {
  const [synopsis] = regulatoryEntryFor("jurisdiction:ca-bc")?.sourceRecords?.(["source:ca-bc-hunting-synopsis-2026-2028"]) ?? [];
  assert.ok(synopsis, "positive control: the Synopsis resolves");
  assert.equal(synopsis.attribution, undefined);
});

test("one statement per distinct text, whatever the number of sources", () => {
  const notices = distinctAttributions([
    { licence: "A", attribution: "Same." },
    { licence: "A", attribution: "Same." },
    { attribution: "  " },
    null,
    { licence: "B", attribution: "Other." },
  ]);
  assert.deepEqual(notices, [{ licence: "A", text: "Same." }, { licence: "B", text: "Other." }]);
  assert.deepEqual(attributionsForSourceIds("jurisdiction:ca-bc", []), []);
  assert.deepEqual(attributionsForSourceIds(undefined, ["source:ca-bc-hunting-regulation"]), []);
});

test("a stored Hunt Brief's BC sources owe the statement once", () => {
  const notices = attributionsForSourceIds("jurisdiction:ca-bc", ["source:ca-bc-hunting-regulation", "source:ca-bc-hunting-regulation-sch3", undefined]);
  assert.deepEqual(notices, [{ licence: LICENCE.name, text: LICENCE.mandatoryAttribution }]);
});

test("the BC season page's sources carry it, once", async () => {
  const page = await regionPage("british-columbia", new Date("2026-10-30T18:00:00Z"));
  assert.ok(page, "positive control: the page exists");
  assert.deepEqual(distinctAttributions(page!.sources), [{ licence: LICENCE.name, text: LICENCE.mandatoryAttribution }]);
});

test("a BC zone card's answer carries it, including a hunt that still asks the hunter something", async () => {
  const bc = await summarizeZone({ layerId: "layer:ca-bc-mu", designation: "4-1" }, "2026-10-30");
  const moose = bc.species.find((row) => row.speciesId === "species:moose");
  assert.ok(moose, "positive control: moose is answered in MU 4-1");
  assert.deepEqual(moose!.licenceNotices, [{ licence: LICENCE.name, text: LICENCE.mandatoryAttribution }]);
  for (const row of bc.species) {
    for (const notice of row.licenceNotices ?? []) assert.equal(notice.text, LICENCE.mandatoryAttribution);
  }
});

test("the helper the answer card imports stays free of the regulatory registry", () => {
  /* The answer card is a client component. When this module imported the
     registry, `next build` put every province's rules into a 4.5 MB browser
     chunk for the card's details (2026-10-30). Types are erased; anything else
     is code the browser downloads. */
  const runtimeImports = readFileSync("src/lib/hunt/source-attribution.ts", "utf8")
    .split("\n")
    .filter((line) => /^import\s/.test(line) && !/^import\s+type\s/.test(line));
  assert.deepEqual(runtimeImports, []);
});
