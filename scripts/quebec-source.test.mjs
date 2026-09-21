import assert from "node:assert/strict";
import { test } from "node:test";
import {
  diffQuebecBundles, expandZoneNumberList, implementsForEnginParagraph, implementsForHeading, pageBlocks, pageLastUpdated, parseClassCell, parseCrossbowBan, parseEnginCell, parseSeasonCell, seasonColumn, diffZoneLayer, formatZoneLayerDiff, zoneLayerFingerprint,
} from "./quebec-source.mjs";

/*
 * Deterministic fixtures, written from the ministry's own markup. None of these
 * touch quebec.ca: a test that depends on a government site fails for reasons
 * that have nothing to do with the code under test.
 */

const Y2026 = seasonColumn("Période de chasse 2026");
const Y2026_27 = seasonColumn("Période de chasse 2026-2027");

test("season columns are read from their headers, including two-year small-game columns", () => {
  assert.deepEqual(Y2026, { label: "2026", firstYear: 2026, lastYear: 2026 });
  assert.deepEqual(Y2026_27, { label: "2026-2027", firstYear: 2026, lastYear: 2027 });
  assert.throws(() => seasonColumn("Période de chasse 2026-2029"), /spans/);
  assert.throws(() => seasonColumn("Dates"), /Unrecognised season column/);
});

test("every French season phrase the pages use is read exactly", () => {
  const cell = (text) => parseSeasonCell(text, Y2026).windows;
  assert.deepEqual(cell("Du 26<span class=\"nbsp\">&nbsp;</span>septembre au 4 octobre 2026"), [{ opens: "2026-09-26", closes: "2026-10-04" }]);
  // The opening month may be shared with the closing one.
  assert.deepEqual(cell("Du 3 au 16 octobre 2026"), [{ opens: "2026-10-03", closes: "2026-10-16" }]);
  // "1er" is the first of the month.
  assert.deepEqual(cell("Du 19 septembre au 1er novembre 2026"), [{ opens: "2026-09-19", closes: "2026-11-01" }]);
  assert.deepEqual(cell("Du 1er août au 31 août 2026"), [{ opens: "2026-08-01", closes: "2026-08-31" }]);
});

test("a small-game season that runs into the next year keeps both years", () => {
  assert.deepEqual(parseSeasonCell("Du 19 septembre 2026 au 31 mars 2027", Y2026_27).windows, [
    { opens: "2026-09-19", closes: "2027-03-31" },
  ]);
});

test("a cell with a spring and a fall window yields both, each read on its own", () => {
  const { windows, phrase } = parseSeasonCell("<p>Du 15 mai au 30 juin 2026</p><p>Du 7 novembre au 22 novembre 2026</p>", Y2026);
  assert.deepEqual(windows, [
    { opens: "2026-05-15", closes: "2026-06-30" },
    { opens: "2026-11-07", closes: "2026-11-22" },
  ]);
  assert.equal(phrase, "Du 15 mai au 30 juin 2026 / Du 7 novembre au 22 novembre 2026");
});

test("an unreadable or impossible season is refused, never approximated", () => {
  for (const bad of [
    "Toute l'année",
    "Du 31 septembre au 4 octobre 2026", // September has 30 days
    "Du 4 octobre au 26 septembre 2026", // closes before it opens
    "Du 3 au 16 brumaire 2026",
    "Consultez la brochure du Règlement de chasse aux oiseaux migrateurs",
  ]) {
    assert.throws(() => parseSeasonCell(bad, Y2026), undefined, bad);
  }
});

test("a date printed in the wrong year's column is refused", () => {
  // A 2027 date under the 2026 header is a page error to report, not a season to certify.
  assert.throws(() => parseSeasonCell("Du 25 septembre au 3 octobre 2027", Y2026), /outside its column/);
});

test("a per-year class cell gives each year its own class", () => {
  const byYear = parseClassCell(
    "<p><strong>2026 </strong>Orignal avec bois</p><p><strong>2027 </strong>Orignal</p>",
    ["2026", "2027"],
  );
  assert.deepEqual(byYear, { 2026: "Orignal avec bois", 2027: "Orignal" });
  // An ordinary cell applies to both years.
  assert.deepEqual(parseClassCell("Orignal avec bois", ["2026", "2027"]), { 2026: "Orignal avec bois", 2027: "Orignal avec bois" });
});

test("a per-year class cell that misses a year or names another is refused", () => {
  assert.throws(() => parseClassCell("<p><strong>2026 </strong>Orignal avec bois</p>", ["2026", "2027"]), /no class for 2027/);
  assert.throws(
    () => parseClassCell("<p><strong>2025 </strong>Orignal</p><p><strong>2027 </strong>Orignal</p>", ["2026", "2027"]),
    /not a column/,
  );
  assert.throws(
    () => parseClassCell("<p><strong>2026 </strong>Orignal</p><p>Orignal avec bois</p>", ["2026", "2027"]),
    /mixes per-year and plain/,
  );
});

test("implement headings map only as the ministry wrote them", () => {
  assert.deepEqual(implementsForHeading("Périodes de chasse à l’arbalète et à l’arc").implements, ["CROSSBOW", "BOW"]);
  assert.deepEqual(implementsForHeading("Périodes de chasse à l’arc").implements, ["BOW"]);
  assert.deepEqual(
    implementsForHeading("Périodes de chasse au fusil, à l’arme à chargement par la bouche, à l’arbalète et à l’arc").implements,
    ["SHOTGUN", "MUZZLELOADER", "CROSSBOW", "BOW"],
  );
  assert.deepEqual(
    implementsForHeading("Périodes de chasse aux armes à feu (carabine, fusil, arme à chargement par la bouche), à l’arbalète et à l’arc").implements,
    ["RIFLE", "SHOTGUN", "MUZZLELOADER", "CROSSBOW", "BOW"],
  );
  assert.throws(() => implementsForHeading("Périodes de chasse au lance-pierre"), /Unrecognised implement heading/);
});

test("the turkey heading is carried verbatim, never mapped to a rifle yes or no", () => {
  /* Whether "arme à chargement par la culasse" admits a rifle for turkey is a
     legal reading these pages do not settle. */
  const { implements: mapped, label } = implementsForHeading("Fusil, arme à chargement par la bouche ou la culasse, arbalète et arc");
  assert.equal(mapped, null);
  assert.equal(label, "Fusil, arme à chargement par la bouche ou la culasse, arbalète et arc");
});

test("the deer relève tables read their implement from the paragraph before them", () => {
  assert.deepEqual(implementsForEnginParagraph("Engin : arbalète et arc").implements, ["CROSSBOW", "BOW"]);
  assert.deepEqual(
    implementsForEnginParagraph("Engin : armes à feu, à l’arbalète et à l’arc").implements,
    ["RIFLE", "SHOTGUN", "MUZZLELOADER", "CROSSBOW", "BOW"],
  );
  assert.throws(() => implementsForEnginParagraph("Engin : fronde"), /Unrecognised relève implement/);
});

test("small-game implement cells separate the implement from the note printed inside the cell", () => {
  const withNote = parseEnginCell("Armes à feu et à air comprimé, arbalète et arc<p>L’utilisation de l’arbalète est interdite dans la zone 17.</p>");
  assert.deepEqual(withNote.implements, ["RIFLE", "SHOTGUN", "MUZZLELOADER", "AIR_GUN", "CROSSBOW", "BOW"]);
  assert.equal(withNote.note, "L'utilisation de l'arbalète est interdite dans la zone 17.");
  // Snares are their own implement: a firearm hunter never inherits snare dates.
  assert.deepEqual(parseEnginCell("Collet").implements, ["SNARE"]);
  assert.throws(() => parseEnginCell("Carabine .22 à percussion latérale, la nuit, avec des chiens"), /Unrecognised small-game implement/);
});

test("crossbow prohibitions are read with the zones they name", () => {
  assert.deepEqual(parseCrossbowBan("Note : L’utilisation de l’arbalète est interdite dans les zones 22, 23 et 24."), ["22", "23", "24"]);
  assert.deepEqual(parseCrossbowBan("L’utilisation de l’arbalète est interdite dans la zone 17."), ["17"]);
  assert.deepEqual(parseCrossbowBan("L'utilisation de l'arbalète est interdite dans les zones 17, 22, 23 et 24."), ["17", "22", "23", "24"]);
  assert.equal(parseCrossbowBan("Dans la zone 17, l'utilisation de collets pour prendre du lièvre n'est permise que …"), null);
});

test("zone ranges in the ministry's sentences expand only to published zones", () => {
  const published = new Set([...Array(24).keys()].map((n) => String(n + 1).padStart(2, "0")).concat(["26", "27", "28", "29"]));
  assert.deepEqual(
    expandZoneNumberList("1 à 12, 14 à 16, 22, 26 et 27", published),
    ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "14", "15", "16", "22", "26", "27"],
  );
  // There is no hunting zone 25; a range across it must not invent one.
  assert.throws(() => expandZoneNumberList("24 à 26", published), /Zone 25 .* is not a published hunting zone/);
});

test("a page's own last-updated date is read as a calendar day", () => {
  assert.equal(pageLastUpdated("<main><p>Dernière mise à jour :</p><p>18 septembre 2026</p></main>"), "2026-09-18");
  assert.equal(pageLastUpdated("<main><p>Dernière mise à jour : 1er août 2026</p></main>"), "2026-08-01");
  assert.throws(() => pageLastUpdated("<main><p>Mis à jour récemment</p></main>"), /Dernière mise à jour/);
});

test("page blocks keep a note in order before the table it belongs to", () => {
  const html = `<main><h2>Périodes de chasse réservée à la relève</h2>
    <p>Engin : arbalète et arc</p><table><tr><th>Zone</th></tr><tr><td><p>1</p></td></tr></table>
    <p>Engin : armes à feu, à l’arbalète et à l’arc</p><table><tr><th>Zone</th></tr><tr><td>2</td></tr></table></main>`;
  const kinds = pageBlocks(html).map((block) => (block.kind === "paragraph" ? block.text : block.kind));
  // A paragraph inside a table cell is part of the table, not a note.
  assert.deepEqual(kinds, ["heading", "Engin : arbalète et arc", "table", "Engin : armes à feu, à l’arbalète et à l’arc", "table"]);
});

test("a bundle diff names each changed rule and the designations it touches", () => {
  const rule = {
    id: "rule:x", speciesId: "species:moose", seasonPhrase: "Du 10 octobre au 25 octobre 2026",
    windows: [{ opens: "2026-10-10", closes: "2026-10-25" }], permittedImplements: ["RIFLE", "BOW"],
    animalClasses: ["ANTLERED"], designations: ["12", "14"], caveats: [], conditionIds: [], declaredNoSeason: false,
  };
  const moved = { ...rule, seasonPhrase: "Du 11 octobre au 25 octobre 2026", windows: [{ opens: "2026-10-11", closes: "2026-10-25" }] };
  const diff = diffQuebecBundles({ rules: [rule] }, { rules: [moved, { ...rule, id: "rule:y", designations: ["26E"] }] });
  assert.deepEqual(diff.added, ["rule:y"]);
  assert.equal(diff.changed.length, 1);
  assert.deepEqual(diff.changed[0].fields.map((field) => field.field), ["seasonPhrase", "windows"]);
  assert.deepEqual(diff.designationsTouched, ["12", "14", "26E"]);
});

/* ── The zone layer's fingerprint ─────────────────────────────────────────── */

const LAYER = {
  metadata: { title: "Zones et parties de zones de chasse", abstract: "…", keywords: ["features", "zones_de_chasse_2022_03_23_Qlite"], defaultCrs: "urn:ogc:def:crs:EPSG::32198", wgs84Box: "-84.4 44.5 -53.4 62.8" },
  schema: ["the_geom:gml:MultiSurfacePropertyType", "Zone:xsd:string", "Shape_Area:xsd:double"],
  rows: [
    { id: "Zone_chasse_da3_sefaq.1", zone: "10O", area: 16_640_540_954.2, latitude: 46.1, longitude: -76.5 },
    { id: "Zone_chasse_da3_sefaq.2", zone: "19SE", area: 1_000_000, latitude: 50.4, longitude: -59.8 },
    { id: "Zone_chasse_da3_sefaq.3", zone: "19SE", area: 2_000_000, latitude: 50.5, longitude: -59.7 },
  ],
};

test("the fingerprint groups the ministry's records by zone, without geometry, in a stable order", () => {
  const fingerprint = zoneLayerFingerprint(LAYER);
  assert.equal(fingerprint.records, 3);
  assert.deepEqual(fingerprint.designations.map((entry) => [entry.designation, entry.records, entry.areaM2]), [
    ["10O", 1, 16_640_540_954],
    ["19SE", 2, 3_000_000],
  ]);
  // Record order in the response is not a change.
  assert.equal(zoneLayerFingerprint({ ...LAYER, rows: [...LAYER.rows].reverse() }).contentHash, fingerprint.contentHash);
});

test("a changed area, a lost record, a new zone and a new vintage are each named", () => {
  const before = zoneLayerFingerprint(LAYER);
  const after = zoneLayerFingerprint({
    metadata: { ...LAYER.metadata, keywords: ["features", "zones_de_chasse_2026_09_01_Qlite"] },
    schema: LAYER.schema,
    rows: [
      { ...LAYER.rows[0], area: LAYER.rows[0].area * 1.01 },
      LAYER.rows[1],
      { id: "Zone_chasse_da3_sefaq.9", zone: "30", area: 5, latitude: 50, longitude: -70 },
    ],
  });
  const diff = diffZoneLayer(before, after);
  assert.equal(diff.moved, true);
  assert.deepEqual(diff.metadata.map((entry) => entry.key), ["keywords"]);
  assert.deepEqual(diff.added, ["30"]);
  assert.deepEqual(diff.changed.map((entry) => [entry.designation, entry.records, entry.areaPercent]), [
    ["10O", [1, 1], 1],
    ["19SE", [2, 1], -66.7],
  ]);
  const text = formatZoneLayerDiff(diff);
  assert.match(text, /CHANGED {2}zone 19SE: 2 -> 1 records; area 3000000 -> 1000000 m² \(-66\.7%\)/);
  assert.match(text, /ADDED {4}zone 30/);
});

test("a record that moves without changing count or area is still a change", () => {
  const before = zoneLayerFingerprint(LAYER);
  const after = zoneLayerFingerprint({ ...LAYER, rows: [{ ...LAYER.rows[0], latitude: 46.2 }, ...LAYER.rows.slice(1)] });
  const diff = diffZoneLayer(before, after);
  assert.equal(diff.moved, true);
  assert.match(formatZoneLayerDiff(diff), /zone 10O: same records and area, but/);
});

test("a withdrawn area attribute is a schema change, and areas become incomparable rather than zero", () => {
  const before = zoneLayerFingerprint(LAYER);
  const after = zoneLayerFingerprint({
    ...LAYER,
    schema: LAYER.schema.filter((entry) => !entry.startsWith("Shape_Area")),
    rows: LAYER.rows.map((row) => ({ ...row, area: null })),
  });
  const diff = diffZoneLayer(before, after);
  assert.deepEqual(diff.schema.removed, ["Shape_Area:xsd:double"]);
  assert.ok(diff.changed.every((entry) => entry.areaM2[1] === null && entry.areaPercent === null));
});

test("an unchanged layer is unchanged", () => {
  const diff = diffZoneLayer(zoneLayerFingerprint(LAYER), zoneLayerFingerprint(LAYER));
  assert.equal(diff.moved, false);
  assert.equal(formatZoneLayerDiff(diff), "");
});
