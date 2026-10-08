import assert from "node:assert/strict";
import test from "node:test";
import { areaWithholdsSeason } from "../overlays.ts";
import {
  iowaColumnIsServableAsAZoneLayer, iowaDesignationOf, IOWA_AREA_EFFECTS, IOWA_ZONE_COLUMNS,
} from "./iowa-zone-columns.ts";

/** Iowa publishes hunter class inside its geography. These stop it leaking out. */

test("every column's counts add up to the 86 polygons that were measured", () => {
  /*
   * The arithmetic control, and it is the one that would have caught a column
   * read from a page rather than the whole layer. Every value in every column
   * was counted across all 86 features with no transfer limit exceeded, so each
   * column's designations and non-designations must together account for 86.
   */
  for (const column of IOWA_ZONE_COLUMNS) {
    const total = [...Object.values(column.designations), ...Object.values(column.nonDesignations)]
      .reduce((sum, n) => sum + n, 0);
    assert.equal(total, 86, `${column.column}: counts sum to ${total}, not the 86 features measured`);
    assert.ok(column.authorityAlias.length > 3, `${column.column}: the authority's own alias is the evidence`);
    assert.ok(column.note.length > 80, `${column.column}: say what a reader needs to know`);
  }
  assert.equal(IOWA_ZONE_COLUMNS.length, 7, "the layer has seven species columns");
});

test("a column whose authority alias names a hunter class is never a general zone layer", () => {
  /*
   * THE DEFECT THIS EXISTS FOR, and the evidence is IDNR's own labels rather
   * than our reading of an abbreviation: "Non-Resident Deer Zone",
   * "Non-Resident Spring Turkey Zone", "Resident Fall Turkey Zone". Serving
   * NR_Deer as "the deer zone" hands a resident a non-resident's boundaries,
   * and §8 puts hunter class in the opportunity, never in the map.
   */
  const classed = IOWA_ZONE_COLUMNS.filter((c) => /^(Non-)?Resident /.test(c.authorityAlias));
  assert.deepEqual(classed.map((c) => c.column).sort(), ["NR_Deer", "NR_S_Trky", "R_F_Trky"]);
  for (const column of classed) {
    assert.ok(column.blockers.includes("CARRIES_A_HUNTER_CLASS"), `${column.column}: the alias names a class`);
    assert.equal(iowaColumnIsServableAsAZoneLayer(column), false, column.column);
  }
  /* Turkey appears twice, once per class, which is what makes it deliberate. */
  const turkey = IOWA_ZONE_COLUMNS.filter((c) => /Trky/.test(c.column));
  assert.equal(turkey.length, 2);
  assert.notDeepEqual(turkey[0].designations, turkey[1].designations, "the two classes have different geography");
});

test("nothing in this layer is servable as a zone today, and each refusal names its own reason", () => {
  /*
   * Three different blockers across seven columns. The point of recording the
   * reason per column is that they are undone differently: a hunter-class
   * column needs the class modelled, an area-effect column needs splitting, and
   * an inconsistent column needs the authority's intent established.
   */
  assert.deepEqual(IOWA_ZONE_COLUMNS.filter(iowaColumnIsServableAsAZoneLayer), []);
  const byBlocker = new Map<string, string[]>();
  for (const column of IOWA_ZONE_COLUMNS) {
    assert.ok(column.blockers.length > 0, `${column.column}: if it serves, say so deliberately`);
    for (const blocker of column.blockers) byBlocker.set(blocker, [...(byBlocker.get(blocker) ?? []), column.column]);
  }
  assert.deepEqual(byBlocker.get("CARRIES_A_HUNTER_CLASS")?.sort(), ["NR_Deer", "NR_S_Trky", "R_F_Trky"]);
  assert.deepEqual(byBlocker.get("IS_AN_AREA_EFFECT_NOT_A_ZONE")?.sort(), ["Bobcat", "CAGO", "Grouse"]);
  assert.deepEqual(byBlocker.get("VALUES_INCONSISTENT"), ["Waterfowl"]);
});

test("Waterfowl is the one I had called clean, and its two odd rows are why it is not", () => {
  /*
   * My own earlier record said Waterfowl was "hunter-class-neutral and cleanly
   * servable". It is the first and not the second: two of 86 rows read "N" and
   * "S" where the other 79 spell the direction out, and serving the column as
   * it stands mints zones "n" and "s" of our invention. Reading them as
   * abbreviations is a judgement about IDNR's intent, not a reading of its
   * publication.
   */
  const waterfowl = IOWA_ZONE_COLUMNS.find((c) => c.column === "Waterfowl")!;
  assert.deepEqual(Object.keys(waterfowl.designations).sort(), ["Central", "North", "South"]);
  assert.equal(waterfowl.nonDesignations.N, 1);
  assert.equal(waterfowl.nonDesignations.S, 1);
  assert.deepEqual(waterfowl.blockers, ["VALUES_INCONSISTENT"]);
  /* And the odd rows do not resolve to a designation by accident. */
  assert.equal(iowaDesignationOf(waterfowl, "N"), null);
  assert.equal(iowaDesignationOf(waterfowl, "S"), null);
  assert.equal(iowaDesignationOf(waterfowl, "North"), "North");
  assert.equal(iowaDesignationOf(waterfowl, " Central "), "Central", "trimmed, not rejected");
});

test("a closure or a permission never resolves to a designation", () => {
  const bobcat = IOWA_ZONE_COLUMNS.find((c) => c.column === "Bobcat")!;
  assert.equal(iowaDesignationOf(bobcat, "No"), null, "'No' is not a zone called No");
  assert.equal(iowaDesignationOf(bobcat, "1"), "1", "but its real zones still resolve");
  assert.equal(iowaDesignationOf(bobcat, "2"), null, "the authority numbers 1 and 3 with no 2");

  const grouse = IOWA_ZONE_COLUMNS.find((c) => c.column === "Grouse")!;
  for (const value of ["Yes", "No"]) assert.equal(iowaDesignationOf(grouse, value), null, value);
  assert.deepEqual(grouse.designations, {}, "Grouse publishes no zones at all");

  const cago = IOWA_ZONE_COLUMNS.find((c) => c.column === "CAGO")!;
  assert.deepEqual(cago.designations, {}, "a closed-area number identifies a closure, not a zone");
  for (const value of ["9", "14", "None"]) assert.equal(iowaDesignationOf(cago, value), null, value);
});

test("the area effects quote the authority's own alias and claim nothing beyond it", () => {
  /*
   * §41B: a GIS attribute is not the instrument. Each record quotes the FIELD
   * ALIAS — where IDNR states what the column means — and the citation says
   * which attribute and how many polygons, so a reader can see the kind of
   * evidence. None may be presented as Iowa's law.
   */
  assert.equal(IOWA_AREA_EFFECTS.length, 4);
  for (const area of IOWA_AREA_EFFECTS) {
    assert.equal(area.words.owner, "AUTHORITY");
    assert.match(area.words.citation, /Hunting Regulations\/Zones, layer 3/, area.name);
    assert.notEqual(area.effect, "DEEMED_OPEN", `${area.name}: a GIS attribute is not a provision that deems ground open`);
  }
  /* Grouse's positive list is kept as a permission, not dropped as "not a zone". */
  const yes = IOWA_AREA_EFFECTS.find((a) => a.name === "Grouse: Yes")!;
  const no = IOWA_AREA_EFFECTS.find((a) => a.name === "Grouse: No")!;
  assert.equal(areaWithholdsSeason(yes), false, "the authority permits grouse on these eleven polygons");
  assert.equal(areaWithholdsSeason(no), true);
});
