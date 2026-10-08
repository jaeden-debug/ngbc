import assert from "node:assert/strict";
import test from "node:test";
import { REGULATORY_REGISTRY } from "./registry.ts";
import type { RegulatoryResult } from "../types.ts";

/**
 * THE AUTHORITY'S WORDS TRAVEL TAGGED, AND OURS ARE NOT CONFUSED WITH THEM.
 *
 * A CLOSED answer lists the seasons that DO exist here. That listing was one
 * string: North Ground's sentence with the ministry's own French spliced into
 * it, carrying no language and no owner. Measured across the corpus, the
 * authority's wording reached 0 of 4,138 CLOSED answers in any structured form,
 * though the bundles hold it with its source and section.
 */

const quebec = REGULATORY_REGISTRY.find((entry) => entry.jurisdictionId === "jurisdiction:ca-qc");

async function closedAnswer(): Promise<RegulatoryResult> {
  assert.ok(quebec, "Québec must be certified for this test to mean anything");
  const outcome = await quebec.evaluate(
    { speciesId: "species:american-black-bear", date: "2026-07-15", latitude: 46.4, longitude: -75.9 } as never,
    { status: "RESOLVED", zoneId: "management_zone:ca-qc-zone-10o", officialName: "Zone 10 West", message: "" } as never,
    { verifiedAt: new Date(0).toISOString(), scope: "ZONE" } as never,
  );
  return outcome.regulation;
}

test("a closed answer carries the ministry's own wording, quoted and tagged", async () => {
  const regulation = await closedAnswer();
  assert.equal(regulation.status, "CLOSED", "positive control: this is the closed-with-a-listing case");
  assert.ok(regulation.seasonsHere?.length, "the seasons that exist here must travel structurally");

  for (const listing of regulation.seasonsHere) {
    assert.equal(listing.stated.owner, "AUTHORITY", "the window wording is the ministry's");
    assert.equal(listing.stated.lang, "fr-CA", "and it keeps the language the ministry published it in");
    assert.ok(listing.stated.sourceId, "a quotation without its source is not a quotation");
    assert.ok(listing.stated.citation, "§41A requires the section that states it");
    assert.match(listing.stated.text, /[éèêàç]|\bDu\b/, "the ministry's French is carried verbatim, not translated");
  }
});

test("the composed heading claims no owner, because it belongs to both", async () => {
  /*
   * It LOOKS like North Ground's framing and is not. Québec's adapter builds it
   * from the ministry's implement wording, the ministry's own word for the youth
   * weekend, and a bare year (`quebec.ts:239-246`), so it reads "armes à feu,
   * arbalète et arc, 2026". Measuring the bundle field said French in 0 of 186;
   * the runtime value is composed upstream, and the field's shape was not the
   * fact. Tagging it as ours would put a ministry's words in our mouth.
   */
  const regulation = await closedAnswer();
  const withLabel = regulation.seasonsHere?.find((listing) => listing.composedLabel);
  assert.ok(withLabel, "positive control: Québec composes a heading, so there is something to not-claim");
  assert.match(String(withLabel.composedLabel), /armes|arbalète|arc|relève|\d{4}/, "the heading really is the composed one");
  assert.equal(typeof withLabel.composedLabel, "string", "the heading is a plain string, not something a renderer can quote as anyone's words");

  /* What IS ours is only the qualifiers. */
  for (const listing of regulation.seasonsHere ?? []) {
    assert.ok(Array.isArray(listing.framing.qualifiers), "framing carries our qualifiers and nothing else");
    assert.ok(!("label" in listing.framing), "the heading must not sit inside North Ground's framing");
  }
});

test("the sentence is derived from the listings, so the two cannot drift apart", async () => {
  /*
   * PINNED BECAUSE NOTHING PINNED IT. Changing "Seasons open to" to "Seasons
   * available to" in the sentence builder broke 0 of 2,412 tests, so a suite
   * passing before and after a refactor of this sentence proved nothing about
   * the sentence. Equivalence was established instead by comparing 116 real
   * summaries across every certified jurisdiction — 0 differences — and this
   * keeps that true.
   */
  const regulation = await closedAnswer();
  assert.match(regulation.summary, /Seasons open to any licence here: /, "the listing sentence's wording is part of the contract");

  for (const listing of regulation.seasonsHere ?? []) {
    assert.ok(
      regulation.summary.includes(listing.stated.text),
      `the sentence must contain the wording it was derived from: ${listing.stated.text}`,
    );
  }
});
