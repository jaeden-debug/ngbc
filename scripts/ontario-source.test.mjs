import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { diffBundles, expandWmuSpec, parseWmuCell, formatBundleDiff } from "./ontario-source.mjs";

/**
 * The shared reading of Ontario's sources.
 *
 * These are the interpretations that decide what a rule reaches and who it
 * applies to, so they are tested against the source's actual shapes rather than
 * exercised only through a build that hits the live site.
 */

const UNITS = ["1A", "1B", "64B", "68A", "68B", "69A-1", "69A-2", "69B", "70", "71", "72A", "72B"];

describe("reading a WMU specification", () => {
  it("expands a bare number to every sub-unit, because the layer is lettered", () => {
    assert.deepEqual(expandWmuSpec("68", UNITS), ["68A", "68B"]);
  });

  it("reads a hyphenless numbered sub-unit as that part only", () => {
    // "69A1" in a deer table is the layer's "69A-1" — not all of 69A.
    assert.deepEqual(expandWmuSpec("69A1", UNITS), ["69A-1"]);
  });

  it("expands a lettered unit to its numbered parts", () => {
    assert.deepEqual(expandWmuSpec("69A", UNITS), ["69A-1", "69A-2"]);
  });

  it("expands a numeric range across stems", () => {
    assert.deepEqual(expandWmuSpec("70-72", UNITS), ["70", "71", "72A", "72B"]);
  });

  it("refuses a token that matches no official unit rather than shrinking the rule", () => {
    assert.throws(() => expandWmuSpec("99", UNITS), /matches no official unit/);
  });

  it("refuses a specification that names a unit twice", () => {
    assert.throws(() => expandWmuSpec("68, 68A", UNITS), /more than once/);
  });
});

describe("reading a WMU cell with footnotes", () => {
  it("keeps a footnote attached to the token it qualifies", () => {
    // The province's own markup: the marker lives inside the anchor.
    const cell = '<td>64B<a href="#foot-1" rel="footnote"><span>footnote 1</span>'
      + '<span aria-hidden="true"><sup>[1]</sup></span></a>, 65, 70</td>';
    assert.deepEqual(parseWmuCell(cell), [
      { token: "64B", footnotes: ["foot-1"] },
      { token: "65", footnotes: [] },
      { token: "70", footnotes: [] },
    ]);
  });

  it("records a bare marker left outside the anchor instead of losing it", () => {
    // A template change that moves "[1]" out of the anchor must not silently
    // drop the footnote: that would publish a season without the rule that
    // removes rifles from it.
    const [first] = parseWmuCell('<td>64B <sup>[1]</sup></td>');
    assert.equal(first.token, "64B", "a token carrying marker text matches no unit");
    assert.deepEqual(first.footnotes, ["foot-1"]);
  });

  it("does not record the same footnote twice when both forms are present", () => {
    const [first] = parseWmuCell('<td>64B<a href="#foot-1"><sup>[1]</sup></a></td>');
    assert.deepEqual(first.footnotes, ["foot-1"]);
  });
});

describe("reporting what a source change did", () => {
  const bundle = (seasonPhrase, extra = {}) => ({
    contentHash: "sha256:a",
    groups: [{ id: "g1", officialSpec: "60", zoneIds: ["z"], officialIdentifiers: ["60"] }],
    rules: [{
      id: "r1", speciesId: "species:white-tailed-deer", regulatoryGroupId: "g1",
      appliesWhen: { permittedImplements: ["RIFLE", "BOW"], RESIDENCY: "RESIDENT" },
      seasonPhrase, declaredNoSeason: false, caveats: [], ...extra,
    }],
  });

  it("reports no change when nothing moved", () => {
    const diff = diffBundles(bundle("November 2 to November 15"), bundle("November 2 to November 15"));
    assert.deepEqual(diff, { added: [], removed: [], changed: [] });
  });

  it("names the rule and the field when a season moves", () => {
    const diff = diffBundles(bundle("November 2 to November 15"), bundle("November 9 to November 15"));
    assert.equal(diff.changed.length, 1);
    assert.equal(diff.changed[0].id, "r1");
    assert.deepEqual(diff.changed[0].fields, [{
      field: "seasonPhrase", from: "November 2 to November 15", to: "November 9 to November 15",
    }]);
  });

  it("catches an implement being removed, which a season comparison alone would miss", () => {
    const before = bundle("November 2 to November 15");
    const after = bundle("November 2 to November 15", {
      appliesWhen: { permittedImplements: ["BOW"], RESIDENCY: "RESIDENT" },
    });
    const diff = diffBundles(before, after);
    assert.deepEqual(diff.changed[0].fields.map((field) => field.field), ["appliesWhen"]);
  });

  it("catches a cell becoming a closure", () => {
    const after = bundle(null, { declaredNoSeason: true });
    const diff = diffBundles(bundle("November 2 to November 15"), after);
    const fields = diff.changed[0].fields.map((field) => field.field);
    assert.ok(fields.includes("declaredNoSeason") && fields.includes("seasonPhrase"));
  });

  it("catches units moving between groups even when the season text is identical", () => {
    const after = bundle("November 2 to November 15");
    after.groups[0].officialIdentifiers = ["60", "61"];
    const diff = diffBundles(bundle("November 2 to November 15"), after);
    assert.deepEqual(diff.changed[0].fields.map((field) => field.field), ["units"]);
    assert.deepEqual(diff.changed[0].units, ["60", "61"], "the reviewer needs the blast radius");
  });

  it("reports added and removed rules by identity, not position", () => {
    const before = bundle("November 2 to November 15");
    const after = bundle("November 2 to November 15");
    after.rules[0].id = "r2";
    const diff = diffBundles(before, after);
    assert.deepEqual(diff.added, ["r2"]);
    assert.deepEqual(diff.removed, ["r1"]);
  });

  it("formats a change a person can read", () => {
    const diff = diffBundles(bundle("November 2 to November 15"), bundle("November 9 to November 15"));
    const text = formatBundleDiff(diff);
    assert.match(text, /CHANGED\s+r1/);
    assert.match(text, /affects 1 unit\(s\): 60/);
    assert.match(text, /November 2 to November 15\s+->\s+November 9 to November 15/);
  });
});
