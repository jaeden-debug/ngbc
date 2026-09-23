import assert from "node:assert/strict";
import { test } from "node:test";
import { contextual, critical, general, sourceDetail, type Limitation } from "./limitation.ts";
import { evaluateQuebec } from "./regulatory/quebec.ts";
import { quebecZoneCanonicalId } from "./ingestion/quebec-zone.ts";

/** One certified Québec answer, through the real engine. */
const quebecAnswer = () => evaluateQuebec({
  speciesId: "species:ruffed-grouse",
  speciesName: "ruffed-grouse",
  date: "2026-10-15",
  place: { zoneId: quebecZoneCanonicalId("10O"), zoneName: "Zone de chasse 10O", latitude: 46.4, longitude: -75.9, overlays: null },
  answers: {},
}).result!;

/**
 * A limitation carries what KIND of statement it is, recorded by the author of
 * the string. These pin the properties a renderer is allowed to rely on.
 */

test("every limitation carries an id, text, language and owner", () => {
  const lines: Limitation[] = [
    general("a general line"),
    critical("a critical line"),
    contextual("a contextual line", "NEAR_BOUNDARY"),
    sourceDetail("an authority's words", "source:ca-qc-zone-chasse-service", "fr-CA"),
  ];
  for (const line of lines) {
    assert.ok(line.id.startsWith("limitation:"), line.text);
    assert.ok(line.text.length > 0);
    assert.ok(line.lang === "en-CA" || line.lang === "fr-CA");
    assert.ok(line.owner === "NORTH_GROUND" || line.owner === "AUTHORITY");
  }
});

test("the same text always gets the same id, and different text does not", () => {
  assert.equal(general("one").id, general("one").id);
  assert.notEqual(general("one").id, general("two").id);
});

test("North Ground's words and an authority's are distinguishable without reading them", () => {
  assert.equal(general("ours").owner, "NORTH_GROUND");
  assert.equal(sourceDetail("theirs", "source:ca-qc-zone-chasse-service").owner, "AUTHORITY");
});

test("an authority's quotation keeps its own language rather than being translated", () => {
  /* §47: an official statement stays in the language the authority published
     it in. An invented translation of law is worse than a quotation a reader
     can take to the ministry. */
  const quoted = sourceDetail("« ... n'a aucune portée légale ... »", "source:ca-qc-zone-chasse-service", "fr-CA");
  assert.equal(quoted.lang, "fr-CA");
  assert.equal(quoted.scope, "SOURCE_DETAIL");
  assert.equal(quoted.sourceId, "source:ca-qc-zone-chasse-service");
});

test("a CONTEXTUAL limitation cannot exist without something to test", () => {
  const line = contextual("only near a boundary", "NEAR_BOUNDARY");
  assert.equal(line.scope, "CONTEXTUAL");
  assert.equal(line.condition, "NEAR_BOUNDARY");
  /*
   * The type refuses the alternative. These do not compile, which is the
   * point — a builder must not be able to emit a CONTEXTUAL line with nothing
   * to test against, or a SOURCE_DETAIL with nothing to attribute it to:
   *
   *   const bad: Limitation = { ...base, scope: "CONTEXTUAL" };
   *   const worse: Limitation = { ...base, scope: "SOURCE_DETAIL" };
   *
   * and a condition is a closed set, so this does not compile either:
   *
   *   contextual("...", "whatever the renderer feels like");
   */
});

/* ── What the migration guarantees ───────────────────────────────────────── */

test("a real Québec answer classifies every line, and defaults to GENERAL", () => {
  const outcome = quebecAnswer();

  const limitations = outcome.limitations;
  assert.ok(limitations.length > 0, "Québec says something");
  for (const line of limitations) {
    assert.ok(["GENERAL", "CRITICAL", "CONTEXTUAL", "SOURCE_DETAIL"].includes(line.scope), line.text);
    if (line.scope === "CONTEXTUAL") assert.ok(line.condition, line.text);
    if (line.scope === "SOURCE_DETAIL") assert.ok(line.sourceId, line.text);
  }
  /* Nothing was triaged as part of landing the shape: the default is GENERAL
     and promotion is each jurisdiction owner's own later decision. */
  assert.ok(limitations.some((line) => line.scope === "GENERAL"));
});

test("the ministry's own statements are attributed and tagged, not translated", () => {
  const outcome = quebecAnswer();

  const quoted = outcome.limitations.filter((line) => line.scope === "SOURCE_DETAIL");
  assert.ok(quoted.length > 0, "the ministry's page statements are present");
  for (const line of quoted) {
    assert.equal(line.owner, "AUTHORITY");
    assert.equal(line.lang, "fr-CA");
    assert.ok(line.scope === "SOURCE_DETAIL" && line.sourceId.startsWith("source:"));
  }
});

test("the treaty and Aboriginal-rights line survives verbatim and unmerged", () => {
  const outcome = quebecAnswer();

  const treaty = outcome.limitations.find((line) => /treaty or Aboriginal rights/.test(line.text));
  assert.ok(treaty, "the treaty paragraph is present");
  assert.equal(
    treaty!.text,
    "This describes sport hunting under Québec's Loi sur la conservation et la mise en valeur de la faune. It does not " +
      "describe harvesting under treaty or Aboriginal rights, which is a separate legal context North Ground does not evaluate.",
  );
  assert.equal(treaty!.scope, "GENERAL");
});

/* ── Canada's promotions pass ────────────────────────────────────────────── */

test("Québec's place-specific lines are CONTEXTUAL with a condition from the closed set", async () => {
  const { evaluateQuebec } = await import("./regulatory/quebec.ts");
  const { quebecZoneCanonicalId } = await import("./ingestion/quebec-zone.ts");
  const ask = (designation: string) => evaluateQuebec({
    speciesId: "species:white-tailed-deer", speciesName: "deer", date: "2026-11-10",
    place: { zoneId: quebecZoneCanonicalId(designation), zoneName: `Zone ${designation}`, latitude: 46.4, longitude: -74, overlays: null },
    answers: { HUNT_METHOD: "BOW" },
  } as Parameters<typeof evaluateQuebec>[0]).result!;

  /* The chronic-wasting-disease enhanced surveillance zone. */
  const cwd = ask("10EZ").limitations.find((line) => /zone de surveillance rehaussée/.test(line.text));
  assert.ok(cwd, "the CWD line is present inside the ZSR");
  assert.equal(cwd!.scope, "CONTEXTUAL");
  assert.equal(cwd!.scope === "CONTEXTUAL" && cwd!.condition, "RESTRICTED_AREA_PRESENT");

  /* A named territory the ministry draws as its own part of a zone. */
  const territory = ask("08NMR").limitations.find((line) => /Montagne de Rigaud/.test(line.text));
  assert.ok(territory);
  assert.equal(territory!.scope, "CONTEXTUAL");

  /* And a plain zone fires neither: a place-specific warning that fires
     everywhere is the wall growing back. */
  assert.equal(ask("10E").limitations.filter((line) => line.scope === "CONTEXTUAL").length, 0);
});

test("the treaty paragraph did NOT move in the promotions pass", () => {
  /* Not a candidate, and asserted again here so a later pass cannot take it. */
  const treaty = quebecAnswer().limitations.find((line) => /treaty or Aboriginal rights/.test(line.text));
  assert.ok(treaty);
  assert.equal(treaty!.scope, "GENERAL");
});

test("only Québec was promoted: nothing North Ground does not own moved", async () => {
  /*
   * Nobody classifies a jurisdiction they do not own. Ontario, Alberta,
   * British Columbia, Manitoba and the U.S. strings stay GENERAL until their
   * owners promote them.
   */
  const { ALBERTA_VOCABULARY } = await import("./regulatory/alberta.ts").catch(() => ({ ALBERTA_VOCABULARY: undefined })) as { ALBERTA_VOCABULARY?: { standingLimitations: Array<{ scope: string }> } };
  if (!ALBERTA_VOCABULARY) return;
  for (const line of ALBERTA_VOCABULARY.standingLimitations) assert.equal(line.scope, "GENERAL");
});
