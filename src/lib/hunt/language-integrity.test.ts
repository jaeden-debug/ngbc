import assert from "node:assert/strict";
import test from "node:test";
import type { CanonicalId, IsoDate } from "../content-contract/index.ts";
import { REGULATORY_REGISTRY } from "./regulatory/registry.ts";
import type { HuntInput, RegulatoryResult, ZoneResolution } from "./types.ts";
import type { LimitationLang } from "./limitation.ts";

/**
 * Does every line's DECLARED language match the language it is actually
 * written in?
 *
 * The product rule is that language is metadata and is never detected at
 * render — `translation.ts` says so at length, and a render-time detector is
 * exactly how a mislabel becomes invisible. This file is the one place
 * detection belongs: as a TEST ORACLE, whose whole job is to find records whose
 * declaration and script disagree. Guessing here is safe because a wrong guess
 * fails a test rather than mislabelling a ministry.
 *
 * IT EXISTS BECAUSE THE EXISTING SUITE COULD NOT SEE THIS CLASS OF DEFECT.
 * `answer-invariants.test.ts` asserts that every condition carries an `owner`
 * and never asserts its `lang`; nothing anywhere compared a line's declared
 * language with its own characters. So « Territoires où toute activité de
 * chasse est interdite. » shipped tagged `en-CA`, and a Québec ministry
 * statement shipped attributed to North Ground, and every test passed.
 *
 * WHAT THE METHOD CANNOT RETURN, stated so nobody mistakes a pass for proof:
 *
 *  - A French sentence containing no accent, cedilla or guillemet is invisible
 *    to this. The detector finds French ORTHOGRAPHY, not French.
 *  - It sweeps only the lines these evaluations produce. A jurisdiction, zone,
 *    species or date not in the matrix is not swept, and the matrix is small.
 *  - It says nothing about whether a translation is CORRECT. That is a human
 *    judgement and this file does not pretend to make it.
 *  - One fix it was written for is NOT observable here. The engine composes
 *    "Bag limit: …" in English and used to tag it with the BUNDLE'S language,
 *    so a Québec bag limit would have gone out as French. Québec is the only
 *    bundle declaring `fr-CA` and it encodes no harvest limit, so the defect is
 *    latent: reverting the fix leaves this file green. It is recorded here
 *    rather than left to look tested.
 *
 *    COVERED ELSEWHERE SINCE 2026-09-29: `conditional-engine.test.ts` builds a
 *    synthetic `fr-CA` bundle that DOES encode a limit, so the case exists on a
 *    fixture rather than waiting for a real jurisdiction to grow one. Reverting
 *    the engine's `lang: "en-CA"` fails there and still leaves this file green,
 *    which was checked rather than assumed. This paragraph stays: it describes
 *    what THIS sweep can and cannot see, and that has not changed.
 *
 * So the guard below refuses to pass on a sweep that found nothing to look at.
 */

/** French orthography: accents, cedilla, ligature, guillemets. */
const FRENCH_ORTHOGRAPHY = /[àâäçéèêëîïôöùûüœæÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŒÆ]|«|»/;

/**
 * English function words that would not appear in a French sentence.
 *
 * Needed because North Ground writes MIXED lines on purpose — an English
 * sentence quoting a French fragment — and the repo has already decided those
 * are tagged by their OUTER author (`limitation.ts`). A mixed line is not a
 * mislabel; a wholly French line tagged English is.
 */
const ENGLISH_MARKERS = /\b(the|and|is|are|this|that|with|from|which|North Ground|must|not|hunting|season|bag limit|required|per day|only|where|may|you|your)\b/i;

function looksWhollyFrench(text: string): boolean {
  if (!FRENCH_ORTHOGRAPHY.test(text)) return false;
  /* Strip what is inside guillemets: those ARE the authority's French, and an
     English sentence is allowed to contain them. What is left is the author's
     own prose, and that is what the declaration describes. */
  const outside = text.replace(/«[^»]*»/g, " ").replace(/[“"][^”"]*[”"]/g, " ");
  if (ENGLISH_MARKERS.test(outside)) return false;
  return FRENCH_ORTHOGRAPHY.test(text);
}

/* ── A representative hunt in every served jurisdiction ─────────────────── */

const MATRIX = [
  { jurisdiction: "jurisdiction:ca-qc", zoneId: "management_zone:ca-qc-zone-10o", zoneName: "Zone de chasse 10O", speciesId: "species:arctic-hare", point: { latitude: 46.3789, longitude: -75.9664 }, date: "2026-09-29" },
  { jurisdiction: "jurisdiction:ca-qc", zoneId: "management_zone:ca-qc-zone-10o", zoneName: "Zone de chasse 10O", speciesId: "species:wild-turkey", point: { latitude: 46.3789, longitude: -75.9664 }, date: "2026-05-01" },
  { jurisdiction: "jurisdiction:ca-qc", zoneId: "management_zone:ca-qc-zone-10o", zoneName: "Zone de chasse 10O", speciesId: "species:moose", point: { latitude: 46.3789, longitude: -75.9664 }, date: "2026-10-10" },
  { jurisdiction: "jurisdiction:ca-on", zoneId: "management_zone:ca-on-wmu-57", zoneName: "WMU 57", speciesId: "species:ruffed-grouse", point: { latitude: 45.0, longitude: -79.0 }, date: "2026-10-15" },
  { jurisdiction: "jurisdiction:ca-mb", zoneId: "management_zone:ca-mb-gha-26", zoneName: "GHA 26", speciesId: "species:ruffed-grouse", point: { latitude: 50.5, longitude: -99.5 }, date: "2026-10-15" },
  { jurisdiction: "jurisdiction:ca-ab", zoneId: "management_zone:ca-ab-wmu-102", zoneName: "WMU 102", speciesId: "species:white-tailed-deer", point: { latitude: 49.5, longitude: -112.0 }, date: "2026-11-05", answers: { animalClasses: [{ dimension: "ANTLER_CLASS", value: "ANTLERED" }] } },
  { jurisdiction: "jurisdiction:ca-bc", zoneId: "management_zone:ca-bc-mu-7-15", zoneName: "MU 7-15", speciesId: "species:ruffed-grouse", point: { latitude: 55.0, longitude: -122.0 }, date: "2026-10-15" },
] as const;

const offline = (async () => new Response(JSON.stringify({ type: "FeatureCollection", features: [] }),
  { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;

function zoneFor(entry: (typeof MATRIX)[number]): ZoneResolution {
  return {
    status: "RESOLVED",
    zoneId: entry.zoneId as CanonicalId<"management_zone">,
    jurisdictionId: entry.jurisdiction as CanonicalId<"jurisdiction">,
    officialName: entry.zoneName,
    boundaryDistanceMeters: 25_000,
    nearBoundary: false,
    message: "fixture",
  };
}

interface Line {
  where: string;
  text: string;
  lang: LimitationLang;
  owner: "AUTHORITY" | "NORTH_GROUND";
}

async function linesOf(entry: (typeof MATRIX)[number]): Promise<Line[]> {
  const registry = REGULATORY_REGISTRY.find((candidate) => candidate.jurisdictionId === entry.jurisdiction);
  assert.ok(registry, `No registry entry for ${entry.jurisdiction}`);
  const input: HuntInput = {
    ...entry.point,
    date: entry.date as IsoDate,
    speciesId: entry.speciesId as CanonicalId<"species">,
    answers: ("answers" in entry ? entry.answers : {}) as HuntInput["answers"],
  };
  const outcome = await registry.evaluate(input, zoneFor(entry), { verifiedAt: "2026-09-29", fetcher: offline, scope: "POINT" });
  const regulation: RegulatoryResult = outcome.regulation;
  const at = `${entry.jurisdiction} ${entry.speciesId} ${entry.date}`;
  return [
    ...regulation.limitations.map((limitation) => ({
      where: `${at} limitation ${limitation.id}`, text: limitation.text, lang: limitation.lang, owner: limitation.owner,
    })),
    ...(regulation.conditions ?? []).map((condition) => ({
      where: `${at} condition ${condition.id}`, text: condition.text, lang: condition.lang, owner: condition.owner,
    })),
    ...(regulation.season?.label
      ? [{ where: `${at} season label`, text: regulation.season.label.text, lang: regulation.season.label.lang, owner: regulation.season.label.owner }]
      : []),
  ];
}

async function everyLine(): Promise<Line[]> {
  const all: Line[] = [];
  for (const entry of MATRIX) all.push(...await linesOf(entry));
  return all;
}

/* ── The sweep ──────────────────────────────────────────────────────────── */

test("the sweep actually reaches French text", async () => {
  /*
   * A measurement guaranteed by its method is not a measurement. If the matrix
   * stops producing any French at all — a bundle edit, a species that no longer
   * resolves, a jurisdiction dropped — every assertion below passes vacuously
   * and reports a clean language audit over nothing.
   */
  const lines = await everyLine();
  assert.ok(lines.length >= 12, `expected a body of lines to sweep; found ${lines.length}`);
  const french = lines.filter((line) => FRENCH_ORTHOGRAPHY.test(line.text));
  assert.ok(french.length >= 3, `expected French text in the sweep; found ${french.length} of ${lines.length}`);
});

test("no wholly French line is declared English", async () => {
  const wrong = (await everyLine())
    .filter((line) => line.lang !== "fr-CA" && looksWhollyFrench(line.text))
    .map((line) => `${line.where} declared ${line.lang}: ${line.text.slice(0, 120)}`);
  assert.deepEqual(wrong, [], `these lines are French and say they are not:\n${wrong.join("\n")}`);
});

test("no line declared French is plainly English", async () => {
  /* The inverse mislabel, and the quieter one: a line tagged `fr-CA` is
     rendered `lang="fr-CA"`, which tells a screen reader to pronounce English
     words with French phonetics. Nobody reports it because nobody sighted
     notices. */
  /* The text OUTSIDE any quotation is the author's own. "Bag limit: 1 lièvre."
     is North Ground's English sentence around an authority's figure, and it
     was being tagged with the BUNDLE's language — so the whole line went out
     as French on the strength of a fragment. */
  const wrong = (await everyLine())
    .filter((line) => line.lang === "fr-CA" && ENGLISH_MARKERS.test(line.text.replace(/«[^»]*»/g, " ")))
    .map((line) => `${line.where} declared fr-CA: ${line.text.slice(0, 120)}`);
  assert.deepEqual(wrong, [], `these lines say they are French and are not:\n${wrong.join("\n")}`);
});

test("a line that is wholly the authority's words is attributed to the authority", async () => {
  /*
   * The symmetric failure to `limitation.ts`'s: there we must not put North
   * Ground's caution in a ministry's mouth; here we must not take a ministry's
   * own sentence and present it as ours. A line that is nothing but a
   * guillemeted quotation is the authority's, and rendering it NORTH_GROUND
   * strips the quotation marks the reader needs to know whose rule it is.
   */
  const wrong = (await everyLine())
    .filter((line) => line.owner === "NORTH_GROUND" && /^\s*«[^»]*»\s*$/.test(line.text))
    .map((line) => `${line.where}: ${line.text.slice(0, 120)}`);
  assert.deepEqual(wrong, [], `these lines are nothing but an authority quotation, attributed to North Ground:\n${wrong.join("\n")}`);
});

test("the detector itself distinguishes a French line from an English one quoting French", () => {
  // The distinction the sweep turns on, asserted rather than assumed.
  assert.equal(looksWhollyFrench("Dans la zone 17, l'utilisation de collets n'est permise que dans les établissements."), true);
  assert.equal(looksWhollyFrench("The ministry excludes part of this zone: « sauf les Îles-de-la-Madeleine »."), false);
  assert.equal(looksWhollyFrench("A valid small game licence is required."), false);
  assert.equal(looksWhollyFrench("« Territoires où toute activité de chasse est interdite. » (Parc national)."), true);
});
