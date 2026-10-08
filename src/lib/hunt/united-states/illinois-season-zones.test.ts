import assert from "node:assert/strict";
import test from "node:test";
import { areaWithholdsSeason } from "../overlays.ts";
import {
  illinoisDesignationOf, ILLINOIS_AREA_EFFECTS, ILLINOIS_DESIGNATIONS, ILLINOIS_EFFECT_VALUES,
  ILLINOIS_SEASON_ZONES, readIllinoisZoneValue,
} from "./illinois-season-zones.ts";

/**
 * Illinois keeps zone identities and legal closures in one field. These are the
 * checks that stop either half being lost.
 */

test("the inventory is the whole layer, and every value is classified exactly once", () => {
  /*
   * The service held exactly 15 features when read with where=1=1, with no
   * transfer limit exceeded, so the inventory can be exhaustive — and an
   * exhaustive classification is what makes refusing an unknown value safe
   * rather than brittle.
   */
  const all = [...ILLINOIS_DESIGNATIONS, ...ILLINOIS_EFFECT_VALUES];
  assert.equal(all.length, 15, "the layer holds 15 features; the inventory must hold 15 values");
  assert.equal(new Set(all).size, 15, "a value is classified twice");
  assert.equal(ILLINOIS_DESIGNATIONS.length, 11);
  assert.equal(ILLINOIS_EFFECT_VALUES.length, 4);
  /* Every effect value has a characterised record, and vice versa. */
  assert.deepEqual([...ILLINOIS_EFFECT_VALUES].sort(), ILLINOIS_AREA_EFFECTS.map((a) => a.name).sort());
});

test("a closure never becomes a zone designation", () => {
  /*
   * THE TRAP. A naive read of `Zone` mints "management_zone:…-no-spring-turkey-
   * hunting-permitted" and resolves hunters into a zone named after a
   * prohibition, with an id, a label and a card.
   */
  for (const closure of ["No Spring Turkey Hunting Permitted", "No Bobcat Hunting or Trapping Permitted",
    "Closed to Fall Firearm Turkey Hunting"]) {
    assert.equal(illinoisDesignationOf(closure), null, closure);
    assert.equal(readIllinoisZoneValue(closure).kind, "AREA_EFFECT", closure);
  }
  /* And a real zone still resolves. */
  assert.equal(illinoisDesignationOf("North Duck & Goose Zone"), "North Duck & Goose Zone");
  assert.equal(illinoisDesignationOf(" South Furbearer Zone "), "South Furbearer Zone", "trimmed, not rejected");
});

test("the authority's OPENING is kept, which a restrict-only mechanism would have lost", () => {
  /*
   * THE HALF THAT MATTERS MORE. Fall Firearm Turkey has no named zone anywhere
   * in the layer: the authority publishes one polygon it is open in and one it
   * is not. Dropping the Open polygon as "not a zone" would withhold a season
   * the authority expressly granted — §8's understating direction.
   */
  const fall = ILLINOIS_SEASON_ZONES.find((row) => row.season === "Fall Fire Arm Turkey")!;
  assert.deepEqual([...fall.designations], [], "this season genuinely has no named zone");
  assert.equal(fall.effects.length, 2);

  const open = ILLINOIS_AREA_EFFECTS.find((a) => a.name === "Open to Fall Firearm Turkey Hunting")!;
  const closed = ILLINOIS_AREA_EFFECTS.find((a) => a.name === "Closed to Fall Firearm Turkey Hunting")!;
  assert.equal(open.effect, "OPEN_ONLY_IF_LISTED");
  assert.equal(closed.effect, "OPEN_ONLY_IF_LISTED");
  /* The whole point, through the Hunt lane's own predicate. */
  assert.equal(areaWithholdsSeason(open), false, "the authority opened this ground");
  assert.equal(areaWithholdsSeason(closed), true);
  /* `listed` is three-valued in the contract and both members are known here,
     so neither is LIST_NOT_HELD: Illinois publishes the whole list. */
  assert.equal(open.effect === "OPEN_ONLY_IF_LISTED" ? open.listed : undefined, true);
  assert.equal(closed.effect === "OPEN_ONLY_IF_LISTED" ? closed.listed : undefined, false);
});

test("an unmeasured value is refused, not absorbed, and says so", () => {
  /*
   * An exact list cannot recognise a phrasing IDNR adds tomorrow, and the
   * failure directions are not symmetric: absorbing an unknown value as a
   * designation can mint a zone named after a prohibition, while refusing it
   * costs a zone that is one line to add once someone has read it. There is
   * deliberately no pattern that accepts anything prohibition-shaped, because a
   * pattern that quietly accepts is the spell-checker mistake again.
   */
  for (const unknown of ["No Deer Hunting Permitted", "West Furbearer Zone", "", "   "]) {
    const reading = readIllinoisZoneValue(unknown);
    assert.equal(reading.kind, "UNRECOGNISED", JSON.stringify(unknown));
    assert.equal(illinoisDesignationOf(unknown), null, JSON.stringify(unknown));
  }
  assert.equal(readIllinoisZoneValue(42).kind, "UNRECOGNISED", "a number is not a designation");
  assert.equal(readIllinoisZoneValue(null).kind, "UNRECOGNISED");
});

test("no area effect is a certified CLOSED, because a GIS attribute is not the instrument", () => {
  /*
   * §41B: an authority's GIS does not override its regulations, which is the
   * same rule that governs Michigan's DMUs. Every record here quotes the
   * ATTRIBUTE and cites the layer, so a reader can see what kind of evidence it
   * is. None of them may be presented as Illinois's law.
   */
  for (const area of ILLINOIS_AREA_EFFECTS) {
    assert.equal(area.words.owner, "AUTHORITY", `${area.name}: it is the authority's string`);
    assert.match(area.words.citation, /Wildlife_SeasonZones, layer 4, Zone attribute/,
      `${area.name}: the citation must say it is a GIS attribute`);
    assert.equal(area.words.text, area.name, `${area.name}: quoted verbatim, not paraphrased`);
    assert.notEqual(area.effect, "DEEMED_OPEN",
      `${area.name}: DEEMED_OPEN requires the authority's own provision, and a GIS attribute is not one`);
  }
});

test("the species the layer serves cleanly are the ones with no effects at all", () => {
  /* Furbearer, Upland Game and Waterfowl carry identities only, so they are
     servable per species today; Bobcat and Turkey are not, and the reason is
     the effects rather than the geometry. */
  const clean = ILLINOIS_SEASON_ZONES.filter((row) => row.effects.length === 0).map((row) => row.species);
  assert.deepEqual(clean.sort(), ["Furbearer", "Upland Game", "Waterfowl"]);
  const encumbered = ILLINOIS_SEASON_ZONES.filter((row) => row.effects.length > 0).map((row) => row.species);
  assert.deepEqual([...new Set(encumbered)].sort(), ["Bobcat", "Turkey"]);
});
