import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SEASON_OPEN_STROKE } from "./cartography.ts";
import type { ZoneHeat } from "./species-layer.ts";
import { CONDITIONS_SHOWN, HEAT_FILL, HEAT_RAMP, HEAT_WORDING, SPECIES_LAYER_LEGEND, conditionDigest, conditionMarkerLabel, heatFillFor, heatPaintFor, rampAt, zoneIsGreen } from "./species-layer.ts";
import type { ZoneSpeciesAnswer } from "./states.ts";
import type { OpportunityCondition } from "./opportunity.ts";

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
  assert.match(SPECIES_LAYER_LEGEND.heatDetail, /not a count of animals, and never a density/i);
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

test("the ramp is continuous, monotone and carries no regulatory colour", () => {
  // The line is ordered and gets stronger; a ramp that dips reads as two ramps.
  for (let index = 1; index < HEAT_RAMP.length; index += 1) {
    assert.ok(HEAT_RAMP[index].at > HEAT_RAMP[index - 1].at, "stops must ascend");
    assert.ok(HEAT_RAMP[index].opacity > HEAT_RAMP[index - 1].opacity, "hotter must read stronger");
  }
  assert.equal(HEAT_RAMP[0].at, 0);
  assert.equal(HEAT_RAMP[HEAT_RAMP.length - 1].at, 1);

  // Continuous: neighbouring values differ, which four buckets could not do.
  assert.notEqual(rampAt(0.61).color, rampAt(0.79).color);
  assert.notEqual(rampAt(0.02).color, rampAt(0.18).color);
  // And the ends are the ends, not an interpolation past them.
  assert.equal(rampAt(0).color, HEAT_RAMP[0].color);
  assert.equal(rampAt(1).color, HEAT_RAMP[HEAT_RAMP.length - 1].color);

  /* NO GREEN ANYWHERE ALONG IT. Green means a legal hunt exists; a green-ish
     cool end would make "cold" read as "closed", which is the false closure
     this product exists to avoid. Checked across the whole line, not just at
     the stops, because an interpolation between two non-green stops is where
     a green would actually appear. */
  for (let value = 0; value <= 1.0001; value += 0.01) {
    const { color } = rampAt(value);
    const [red, green, blue] = [1, 3, 5].map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16));
    assert.ok(green <= Math.max(red, blue), `${color} at ${value.toFixed(2)} leads with green`);
  }

  // Heat is evidence and must never wear a legal status's colour.
  for (const semantic of ["ng-open", "ng-closed", "ng-conditional", "ng-unknown", "ng-conflict"]) {
    for (let value = 0; value <= 1.0001; value += 0.01) {
      assert.notEqual(rampAt(value).color.toLowerCase(), token(semantic), `heat must not reuse --${semantic}`);
    }
  }
  // The green is the palette's own regulatory green, so the map ring and the
  // "In season" chip in the sheet are one colour, not two greens.
  assert.equal(SEASON_OPEN_STROKE.toLowerCase(), token("ng-open"));
});

test("the legend's swatches are the ramp's own values, not a second table", () => {
  /* The failure this prevents: a legend tuned by eye until it looked right,
     after which the key and the map disagree about what "High" looks like. */
  assert.equal(HEAT_FILL.LOW.color, rampAt(0.2).color);
  assert.equal(HEAT_FILL.MODERATE.color, rampAt(0.5).color);
  assert.equal(HEAT_FILL.HIGH.color, rampAt(0.7).color);
  assert.equal(HEAT_FILL.VERY_HIGH.color, rampAt(0.9).color);

  // globals.css carries the same values for the legend, which CAN take a variable.
  for (const [name, fill] of [["ng-heat-low", HEAT_FILL.LOW], ["ng-heat-moderate", HEAT_FILL.MODERATE], ["ng-heat-high", HEAT_FILL.HIGH], ["ng-heat-very-high", HEAT_FILL.VERY_HIGH]] as const) {
    assert.equal(token(name), fill.color.toLowerCase(), `--${name} must mirror the map's value`);
  }
  assert.equal(token("ng-heat-cold"), HEAT_RAMP[0].color.toLowerCase());
  assert.equal(token("ng-heat-ember"), HEAT_RAMP[HEAT_RAMP.length - 1].color.toLowerCase());
  // Every stop appears in the gradient the legend bar is painted with.
  const gradient = /--ng-heat-gradient:([^;]+);/.exec(readFileSync(new URL("../../../app/globals.css", import.meta.url), "utf8"))![1];
  for (const stop of HEAT_RAMP) assert.ok(gradient.includes(stop.color), `${stop.color} missing from the legend gradient`);
});

test("the three reasons to paint nothing are all painted as nothing", () => {
  const zone = (over: Partial<ZoneHeat>): ZoneHeat =>
    ({ classification: "HIGH", intensity: 0.7, strength: "MODERATE", renderKind: "ZONE_AREA", ...over });

  assert.equal(heatPaintFor(undefined), null, "no certified evidence is held for this zone at all");
  assert.equal(heatPaintFor(zone({ classification: "LIMITED_DATA", intensity: null })), null, "evidence held that refuses to rank");
  assert.equal(heatPaintFor(zone({ intensity: null })), null, "a null intensity is a refusal, never the cold end");
  assert.equal(heatPaintFor(zone({ renderKind: "RANGE_EXTENT" })), null, "extent has no more and no less, so it carries no ramp");
  assert.notEqual(heatPaintFor(zone({ classification: "LOW", intensity: 0 })), null, "a rank of zero IS a value and is drawn");

  // Zero and null are different answers and must never collapse into each other.
  assert.equal(heatPaintFor(zone({ classification: "LOW", intensity: 0 }))!.color, rampAt(0).color);
});

test("absence and a low rank are different answers", () => {
  assert.equal(heatFillFor(undefined), null, "no evidence held");
  assert.equal(heatFillFor("LIMITED_DATA"), null, "evidence held that will not support a rank");
  assert.notEqual(heatFillFor("LOW"), null, "a low rank is a value and is drawn");
  assert.equal(zoneIsGreen(undefined), false);
});

/* ── The condition indicator ───────────────────────────────────────────── */

const condition = (id: string, lang: OpportunityCondition["lang"]): OpportunityCondition =>
  ({ id, kind: "STATED_CONDITION", text: `line ${id}`, lang, owner: "AUTHORITY" });

const withConditions = (conditions: OpportunityCondition[]): ZoneSpeciesAnswer => ({
  state: "CHECK_REQUIREMENTS",
  opportunity: { hasCurrentLegalOpportunity: true, hasMaterialConditions: true, conditions, coverage: "OPEN", exhaustive: true },
});

test("the popover names a few conditions and COUNTS the rest", () => {
  const many = ["a", "b", "c", "d", "e"].map((id) => condition(id, "en-CA"));
  const digest = conditionDigest(withConditions(many), "en-CA");
  assert.equal(digest.shown.length, CONDITIONS_SHOWN);
  assert.equal(digest.further, many.length - CONDITIONS_SHOWN);
});

test("a condition the reader cannot read is counted, never dropped and never shown untranslated", () => {
  /* The map shows one language. A French ministry line has no room here for its
     original, its translation and the attribution that makes either honest — so
     it goes to the sheet, which has all three. What must NOT happen is the
     popover quietly reporting fewer conditions than the zone actually carries. */
  const mixed = [condition("en", "en-CA"), condition("fr1", "fr-CA"), condition("fr2", "fr-CA")];
  const digest = conditionDigest(withConditions(mixed), "en-CA");
  assert.deepEqual(digest.shown.map((row) => row.id), ["en"]);
  assert.equal(digest.further, 2, "the French lines are counted, not forgotten");
});

test("the indicator's accessible name says what it MEANS", () => {
  const label = conditionMarkerLabel("WMU 57");
  assert.match(label, /WMU 57/);
  // "Exclamation" tells a screen-reader user nothing (§48).
  assert.match(label, /conditions/i);
  assert.doesNotMatch(label, /exclamation/i);
});
