import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SEASON_OPEN_STROKE } from "./cartography.ts";
import { HEAT_FILL, HEAT_WORDING, SPECIES_LAYER_LEGEND, heatFillFor, seasonIsOpen } from "./species-layer.ts";

const globals = readFileSync(new URL("../../../app/globals.css", import.meta.url), "utf8");
const token = (name: string): string => {
  const match = new RegExp(`--${name}:\\s*(#[0-9a-f]{6})\\s*;`, "i").exec(globals);
  assert.ok(match, `globals.css must define --${name}`);
  return match![1].toLowerCase();
};

/**
 * The two sentences the layer cannot ship without, and the palette it has to
 * sit inside. Colour carries a great deal on this layer, so §48's rule — that
 * meaning is never carried by colour alone — is load-bearing here rather than
 * a formality.
 */

test("the layer's two false inferences are refused in words, not only by colour", () => {
  const all = Object.values(SPECIES_LAYER_LEGEND).join(" ");
  // Not green is not closed. This is the one that could send a hunter home.
  assert.match(SPECIES_LAYER_LEGEND.notGreen, /not thereby closed/i);
  assert.match(all, /not certified|has not certified|holds no certified/i);
  // No heat is not no animals.
  assert.match(SPECIES_LAYER_LEGEND.heatDetail, /not a zone with no animals/i);
  // The class is a rank, not a density, and the peer set is named.
  assert.match(SPECIES_LAYER_LEGEND.heatDetail, /RANK AGAINST THE OTHER ZONES/);
  assert.match(SPECIES_LAYER_LEGEND.heatDetail, /not a count of animals and not a density/i);
  // And the two channels are stated as independent in both directions.
  assert.match(SPECIES_LAYER_LEGEND.independent, /never implies a season is open/i);
  assert.match(SPECIES_LAYER_LEGEND.independent, /never implies animals are present/i);
  // A species with no evidence anywhere says so rather than showing an empty ramp.
  assert.match(SPECIES_LAYER_LEGEND.noHeatDetail, /not a finding about where the animals are/i);
});

test("every heat class has a word and a glyph as well as a tint", () => {
  for (const [classification, wording] of Object.entries(HEAT_WORDING)) {
    assert.ok(wording.label.trim().length > 2, classification);
    assert.ok(wording.glyph.trim().length > 0, classification);
  }
  // The glyphs must differ, or the "not colour alone" channel says nothing.
  const glyphs = Object.values(HEAT_WORDING).map(({ glyph }) => glyph);
  assert.equal(new Set(glyphs).size, glyphs.length);
});

test("the ramp sits inside the brand palette and borrows no regulatory token", () => {
  // Two steps ARE palette tokens; the layer did not invent a colour direction.
  assert.equal(HEAT_FILL.LOW.color.toLowerCase(), token("ng-bark-light"));
  assert.equal(HEAT_FILL.HIGH.color.toLowerCase(), token("ng-amber"));
  // The green is the palette's own regulatory green, so the map ring and the
  // "In season" chip in the sheet are one colour, not two greens.
  assert.equal(SEASON_OPEN_STROKE.toLowerCase(), token("ng-open"));
  // Heat is evidence and must never wear a legal status's colour.
  for (const semantic of ["ng-open", "ng-closed", "ng-conditional", "ng-unknown", "ng-conflict"]) {
    for (const { color } of Object.values(HEAT_FILL)) {
      assert.notEqual(color.toLowerCase(), token(semantic), `heat must not reuse --${semantic}`);
    }
  }
  // globals.css carries the same four for the legend, which CAN take a variable.
  for (const [name, fill] of [["ng-heat-low", HEAT_FILL.LOW], ["ng-heat-moderate", HEAT_FILL.MODERATE], ["ng-heat-high", HEAT_FILL.HIGH], ["ng-heat-very-high", HEAT_FILL.VERY_HIGH]] as const) {
    assert.equal(token(name), fill.color.toLowerCase(), `--${name} must mirror the map's value`);
  }
});

test("absence and a low rank are different answers", () => {
  assert.equal(heatFillFor(undefined), null, "no evidence held");
  assert.equal(heatFillFor("LIMITED_DATA"), null, "evidence held that will not support a rank");
  assert.notEqual(heatFillFor("LOW"), null, "a low rank is a value and is drawn");
  assert.equal(seasonIsOpen(undefined), false);
});
