import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveZoneLabel, splitOutsideBracketsForTest, UnreadableZoneLabel } from "./quebec-zone-labels.ts";
import type { ZoneDesignation } from "./quebec-zone-labels.ts";

/**
 * Designations exactly as the ministry's layer publishes them, taken from a full
 * live read of all 59 on 2026-09-20. The awkward zones are all here — 8 with its
 * two named territories, 19 with sub-parts and no plain "Sud", 27 with islands
 * and the Seigneurie — because those are the ones a resolver gets wrong.
 */
const DESIGNATIONS: ZoneDesignation[] = [
  { designation: "01N", zoneNumber: "01", partName: "Nord" },
  { designation: "01S", zoneNumber: "01", partName: "Sud" },
  { designation: "02E", zoneNumber: "02", partName: "Est" },
  { designation: "02EI", zoneNumber: "02", partName: "Est (Île)" },
  { designation: "02O", zoneNumber: "02", partName: "Ouest" },
  { designation: "02OI", zoneNumber: "02", partName: "Ouest (Île)" },
  { designation: "03E", zoneNumber: "03", partName: "Est" },
  { designation: "03EI", zoneNumber: "03", partName: "Est (Île)" },
  { designation: "03O", zoneNumber: "03", partName: "Ouest" },
  { designation: "03OI", zoneNumber: "03", partName: "Ouest (Île)" },
  { designation: "04", zoneNumber: "04", partName: "" },
  { designation: "08E", zoneNumber: "08", partName: "Est" },
  { designation: "08N", zoneNumber: "08", partName: "Nord" },
  { designation: "08NMR", zoneNumber: "08", partName: "Nord (Montagne de Rigaud)" },
  { designation: "08NZ", zoneNumber: "08", partName: "Nord ZSR" },
  { designation: "08S", zoneNumber: "08", partName: "Sud" },
  { designation: "13", zoneNumber: "13", partName: "" },
  { designation: "13SO", zoneNumber: "13", partName: "Sud-ouest" },
  { designation: "19N", zoneNumber: "19", partName: "Nord" },
  { designation: "19SE", zoneNumber: "19", partName: "Sud-Est" },
  { designation: "19SNO", zoneNumber: "19", partName: "Sud-Nord-Ouest" },
  { designation: "19SO", zoneNumber: "19", partName: "Sud-Ouest" },
  { designation: "27E", zoneNumber: "27", partName: "Est" },
  { designation: "27EI", zoneNumber: "27", partName: "Est (Île)" },
  { designation: "27ESB", zoneNumber: "27", partName: "Est (Seigneurie de Beaupré)" },
  { designation: "27O", zoneNumber: "27", partName: "Ouest" },
  { designation: "27OI", zoneNumber: "27", partName: "Ouest (Île)" },
  { designation: "27OSB", zoneNumber: "27", partName: "Ouest (Seigneurie de Beaupré)" },
  { designation: "29", zoneNumber: "29", partName: "" },
];

function resolve(label: string): string[] {
  return resolveZoneLabel(label, DESIGNATIONS).designations;
}

test("a bare number is every part of that number", () => {
  // The small-game table writes "2 (sauf l'Île Verte)", removing a territory by
  // naming it, so the number alone must already include them.
  assert.deepEqual(resolve("2"), ["02E", "02EI", "02O", "02OI"]);
  assert.deepEqual(resolve("4"), ["04"]);
  assert.deepEqual(resolve("1, 4, 29"), ["01N", "01S", "04", "29"]);
});

test("a cardinal part reaches its own subdivisions", () => {
  // Zone 19 publishes no part named plainly "Sud", so "19 sud" can only mean the
  // three parts that subdivide it.
  assert.deepEqual(resolve("19 sud"), ["19SE", "19SNO", "19SO"]);
  assert.deepEqual(resolve("19 nord"), ["19N"]);
  assert.deepEqual(resolve("13 sud-ouest"), ["13SO"]);
});

test("a part naming a territory is never swept into its parent", () => {
  /* This is the difference between an answer and a wrong answer. 08NZ is the
     enhanced surveillance zone for chronic wasting disease and 08NMR is the
     Montagne de Rigaud; no season table states either one's terms, and the deer
     table excludes Rigaud from "8 nord" in so many words. */
  assert.deepEqual(resolve("8 nord"), ["08N"]);
  assert.deepEqual(resolve("27 est"), ["27E"]);
  assert.deepEqual(resolve("3 ouest"), ["03O"]);
});

test("a hyphen continues a direction where a bracket or space starts a territory", () => {
  // "Sud-Est" subdivides Sud; "Nord ZSR" and "Est (Île)" do not subdivide.
  assert.deepEqual(resolve("19 sud"), ["19SE", "19SNO", "19SO"]);
  assert.ok(!resolve("8 nord").includes("08NZ"));
  assert.ok(!resolve("27 est").includes("27EI"));
});

test("the authority's own exclusions are carried, not silently applied", () => {
  const resolved = resolveZoneLabel("2 est (sauf les cantons de Macpès, de Duquesne)", DESIGNATIONS);
  /* No boundary here draws a township, so the season still covers 02E and the
     limit travels with it as the authority wrote it. Dropping the phrase would
     show a season over ground it does not cover. */
  assert.deepEqual(resolved.designations, ["02E"]);
  assert.deepEqual(resolved.caveats, ["sauf les cantons de Macpès, de Duquesne"]);
});

test("an exclusion's own commas do not split the label", () => {
  const resolved = resolveZoneLabel(
    "8 est, 8 nord (excluant le territoire de la montagne de Rigaud), 8 sud",
    DESIGNATIONS,
  );
  assert.deepEqual(resolved.designations, ["08E", "08N", "08S"]);
  assert.deepEqual(resolved.caveats, ["excluant le territoire de la montagne de Rigaud"]);
});

test('"et" joins zones outside brackets and is left alone inside them', () => {
  assert.deepEqual(resolve("1 nord, 1 sud et 2 est"), ["01N", "01S", "02E"]);
  const resolved = resolveZoneLabel("2 est (sauf les cantons de Macpès et Duquesne)", DESIGNATIONS);
  assert.deepEqual(resolved.designations, ["02E"]);
  assert.deepEqual(resolved.caveats, ["sauf les cantons de Macpès et Duquesne"]);
});

test("a named territory resolves to the part the layer publishes for it", () => {
  assert.deepEqual(resolve("Territoire de la montagne de Rigaud dans la zone 8 nord"), ["08NMR"]);
  // The territory is the subject here, so it reaches only its own ground.
  assert.deepEqual(resolve("Territoire de la montagne de Rigaud dans la zone 8 nord, 8 sud"), ["08NMR", "08S"]);
});

test("a sub-part composes onto its parent and does not reach a sibling", () => {
  assert.deepEqual(resolve("Partie est de 19 sud"), ["19SE"]);
  assert.deepEqual(resolve("Partie nord-ouest de 19 sud"), ["19SNO"]);
  // "Sud-Nord-Ouest" is not "Sud-Ouest", so the west part must not pick it up.
  assert.deepEqual(resolve("Partie ouest de 19 sud (sauf la partie nord-ouest), 29"), ["19SO", "29"]);
});

test("the St Lawrence islands resolve to the island parts of the zones named", () => {
  assert.deepEqual(
    resolve(
      "Ensemble des îles et îlots du fleuve Saint-Laurent en aval du pont Pierre-Laporte " +
        "compris dans les zones 2 est, 2 ouest, 3 est, 3 ouest, 27 est, 27 ouest",
    ),
    ["02EI", "02OI", "03EI", "03OI", "27EI", "27OI"],
  );
});

test("a label that is not a zone refuses instead of resolving to something near it", () => {
  /* Île-du-Havre-Aubert is in the Îles-de-la-Madeleine and the layer gives it no
     designation; "Partie est et partie ouest de 19 sud" elides its tail. Both
     must stop a build rather than be guessed at. */
  for (const label of [
    "Île-du-Havre-Aubert",
    "Dans les zones, les zecs et les réserves fauniques",
    "Partie est et partie ouest de 19 sud (sauf la partie nord-ouest), 29",
    "Territoire de la montagne de Rigaud dans la zone 13",
    "8 couchant",
    "31",
  ]) {
    assert.throws(() => resolveZoneLabel(label, DESIGNATIONS), UnreadableZoneLabel, `should refuse ${label}`);
  }
});

test("a refusal names the fragment and what the layer does publish", () => {
  try {
    resolveZoneLabel("8 couchant", DESIGNATIONS);
    assert.fail("expected a refusal");
  } catch (error) {
    assert.ok(error instanceof UnreadableZoneLabel);
    assert.equal(error.part, "8 couchant");
    // A reviewer has to see the real options to settle the mapping themselves.
    assert.match(error.message, /Nord \(Montagne de Rigaud\)/);
    assert.match(error.message, /Nord ZSR/);
  }
});

test("splitting respects brackets", () => {
  assert.deepEqual(
    splitOutsideBracketsForTest("a, b (x, y et z), c et d", /^\s*,\s*|^\s+et\s+/),
    ["a", "b (x, y et z)", "c", "d"],
  );
});
