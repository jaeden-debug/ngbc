import assert from "node:assert/strict";
import test from "node:test";
import { languageName, readingFor, readingNeedsLabel, storedReadingCount, type LanguagedText, type Translation } from "./translation.ts";
import type { AuthorityQuotation } from "./provenance.ts";
import type { CanonicalId } from "../content-contract/index.ts";

/**
 * The language contract: a hunter never needs French, and the ministry's words
 * are never rewritten.
 *
 * The sharpest test here is the one that does not run — the compile-time
 * refusal below. A translation that could be passed where an authority
 * quotation is expected would put North Ground's English in a ministry's mouth
 * at whatever render site forgot to check, and no runtime assertion can be
 * placed at every one of them.
 */

const FRENCH: LanguagedText = {
  text: "« Territoires où toute activité de chasse est interdite. » (Parc national).",
  lang: "fr-CA",
  owner: "AUTHORITY",
};

test("the stored readings are not an empty file", () => {
  /* Every assertion below would pass over an empty registry, and the suite
     would then be proving the fallback rather than the feature. */
  assert.ok(storedReadingCount >= 8, `expected stored readings; found ${storedReadingCount}`);
});

test("a translation can never be rendered as an authority quotation", () => {
  const reading = readingFor(FRENCH, "en-CA");
  assert.equal(reading.kind, "TRANSLATION");
  if (reading.kind !== "TRANSLATION") return;
  const translation: Translation = reading.show;

  // THE NEGATIVE TYPE TEST. A translation has no sourceId and no citation, and
  // its owner is the wrong literal, so it cannot satisfy the quotation
  // contract. Deleting `owner` from `Translation` makes this line compile,
  // which is the regression it exists to catch.
  // @ts-expect-error a translation is North Ground's and is not an authority quotation
  const asQuotation: AuthorityQuotation = translation;
  void asQuotation;

  assert.equal(translation.owner, "NORTH_GROUND");
  assert.equal("sourceId" in translation, false);
  assert.equal("citation" in translation, false);
});

test("the original is kept, in its own language, beside the reading", () => {
  const reading = readingFor(FRENCH, "en-CA");
  if (reading.kind !== "TRANSLATION") throw new Error("expected a translation");
  // Not replaced, not re-tagged, not re-worded. Byte for byte what the ministry published.
  assert.deepEqual(reading.original, FRENCH);
  assert.equal(reading.original.owner, "AUTHORITY");
  assert.equal(reading.original.lang, "fr-CA");
  assert.equal(reading.show.from, "fr-CA");
  assert.equal(reading.show.lang, "en-CA");
});

test("the reading is an English sentence, and it keeps the ministry's own designation", () => {
  const reading = readingFor(FRENCH, "en-CA");
  if (reading.kind !== "TRANSLATION") throw new Error("expected a translation");
  assert.match(reading.show.text, /hunting activity is prohibited/i);
  /* « Parc national » is Québec's designation for a PROVINCIAL park. Rendering
     it "national park" would name the wrong order of government, which is why
     §47 keeps an official term in the language it was published in. */
  assert.match(reading.show.text, /Parc national/);
  assert.doesNotMatch(reading.show.text, /national park/i);
});

test("a missing reading degrades honestly rather than silently", () => {
  const unknown: LanguagedText = { text: "Une phrase que personne n'a lue.", lang: "fr-CA", owner: "AUTHORITY" };
  const reading = readingFor(unknown, "en-CA");
  assert.equal(reading.kind, "UNTRANSLATED");
  if (reading.kind !== "UNTRANSLATED") return;
  // The original stays available; nothing is hidden and nothing is invented.
  assert.deepEqual(reading.original, unknown);
  assert.equal(readingNeedsLabel(reading), true);
});

test("a reading is keyed by the exact source text, so a changed rule loses its stale reading", () => {
  /* If the ministry adds a word, the key misses and the interface says no
     reading exists. Keying by an id would have kept showing yesterday's
     reading of today's rule, and nothing on screen would have shown it. */
  const amended: LanguagedText = { ...FRENCH, text: `${FRENCH.text} Modifié.` };
  assert.equal(readingFor(amended, "en-CA").kind, "UNTRANSLATED");
});

test("the authority's own other-language text wins, and both sides stay the authority's", () => {
  const english: LanguagedText = { text: "Territory closed to all hunting.", lang: "en-CA", owner: "AUTHORITY" };
  const reading = readingFor(FRENCH, "en-CA", english);
  assert.equal(reading.kind, "AUTHORITY_OTHER_LANGUAGE");
  if (reading.kind !== "AUTHORITY_OTHER_LANGUAGE") return;
  // A ministry's English text is the ministry's English text — never relabelled
  // as North Ground's reading of its French, and never as a translation.
  assert.equal(reading.show.owner, "AUTHORITY");
  assert.equal(reading.original.owner, "AUTHORITY");
  assert.notEqual(reading.kind as string, "TRANSLATION");
});

test("text already in the reader's language says nothing about itself", () => {
  const plain: LanguagedText = { text: "A valid small game licence is required.", lang: "en-CA", owner: "NORTH_GROUND" };
  const reading = readingFor(plain, "en-CA");
  assert.equal(reading.kind, "ORIGINAL");
  // Labelling English "in English" on an English page is noise (§13).
  assert.equal(readingNeedsLabel(reading), false);
});

test("the mechanism runs in both directions, not only out of French", () => {
  /* English→French is the same path. Nothing here is Québec-specific, and a
     further source language is a further row in the data file. */
  const english: LanguagedText = { text: "Hunting is permitted from half an hour before sunrise until noon.", lang: "en-CA", owner: "AUTHORITY" };
  assert.equal(readingFor(english, "fr-CA").kind, "UNTRANSLATED", "no French reading is stored, and none is invented");
  assert.equal(readingFor(english, "en-CA").kind, "ORIGINAL");
});

test("every reading declares who produced it, and none claims a review nobody did", () => {
  const reading = readingFor(FRENCH, "en-CA");
  if (reading.kind !== "TRANSLATION") throw new Error("expected a translation");
  assert.equal(reading.show.provenance, "NORTH_GROUND_GENERATED");
});

test("languages are named for a reader", () => {
  assert.equal(languageName("fr-CA"), "French");
  assert.equal(languageName("en-CA"), "English");
});

/* A `sourceId` on a quotation is what a translation must never acquire. */
const quotation: AuthorityQuotation = {
  owner: "AUTHORITY",
  text: FRENCH.text,
  sourceId: "source:ca-qc-overlays" as CanonicalId<"source">,
  citation: "Territoires fauniques",
  lang: "fr-CA",
};

test("an authority quotation is not interchangeable with a translation either", () => {
  // @ts-expect-error an authority's words are not North Ground's reading
  const asTranslation: Translation = quotation;
  void asTranslation;
  assert.equal(quotation.owner, "AUTHORITY");
});
