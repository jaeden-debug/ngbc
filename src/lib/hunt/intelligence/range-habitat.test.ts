import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { gunzipSync } from "node:zlib";
import { permitsSpeciesHeat } from "../../content/species-eligibility.ts";
import { decodeCells, surfaceRegistry } from "./surface.ts";
import { closeRange } from "../../../../scripts/lib/range-closing.mjs";

/**
 * RANGE + HABITAT, THE UNIVERSAL FALLBACK (CLAUDE.md §41B, 2026-09-30).
 *
 * A categorical habitat profile inside a range drawn from occurrence records.
 * What these tests hold is what makes it defensible rather than decorative:
 * the profile rests on a statement North Ground already publishes, the build
 * reproduces from committed inputs, the surface owes nothing to hunting
 * geography, and a range is never dressed as a ranking.
 */

const profiles = JSON.parse(readFileSync("content/intelligence/surface-profiles.json", "utf8")) as {
  classValues: Record<string, number>;
  families: Record<string, { reachKm: number; why: string; recordBias: string; isolatedSquareMinRecords: number | null; gapKm: number | null; gapWhy: string; recordGroup: string }>;
  species: Record<string, { family: string; habitatStatement: string | null; season?: string; tier?: string; landCover?: Record<string, string[]>; requires?: unknown[]; whyNotRangeHabitat?: string; rangeNotDefensible?: string }>;
};
const registry = JSON.parse(readFileSync("content/intelligence/range-habitat-registry.json", "utf8")) as {
  surfaces: Array<{ speciesId: string; artifactPath: string; surfaceTier: string; surfaceKind: string; resolution: { source: { metres: number } }; edgeOnUnrecordedGround: number | null }>;
  declined: Array<{ speciesId: string; reason: string }>;
};

test("the committed surfaces are exactly what the builder produces from committed inputs", () => {
  execFileSync(process.execPath, ["scripts/build-range-habitat-surfaces.mjs", "--check"], { stdio: "pipe" });
});

test("profiles exist only for Hunt-eligible species, and every quote is the published statement", () => {
  const published = new Map<string, string[]>();
  for (const file of readdirSync("content/published").filter((f) => f.endsWith(".json"))) {
    for (const resource of JSON.parse(readFileSync(`content/published/${file}`, "utf8")).resources ?? []) {
      if (resource.speciesProfile) published.set(resource.speciesProfile.speciesId, (resource.speciesProfile.habitat ?? []).map((h: { text: string }) => h.text));
    }
  }
  for (const [speciesId, profile] of Object.entries(profiles.species)) {
    assert.ok(permitsSpeciesHeat(speciesId), `${speciesId}: no hunter-facing map for a species Hunt may not offer`);
    /* A range-only profile may stand without a quote — the missing statement is why it is range-only — but never without its reason. */
    if (profile.habitatStatement === null) {
      assert.equal(profile.tier, "RANGE_ONLY", `${speciesId}: only a range-only profile may quote nothing`);
      continue;
    }
    assert.ok(published.get(speciesId)?.includes(profile.habitatStatement), `${speciesId}: the quote is not the published statement`);
  }
});

test("a range-only profile says why range + habitat is not defensible; a declined range says why the records cannot be one", () => {
  for (const [speciesId, profile] of Object.entries(profiles.species)) {
    if (profile.tier === "RANGE_ONLY") assert.ok((profile.whyNotRangeHabitat ?? "").length > 40, `${speciesId}: range-only with no reason`);
    if (profile.rangeNotDefensible) assert.ok(registry.declined.some((row) => row.speciesId === speciesId && row.reason === "NO_DEFENSIBLE_RANGE"), speciesId);
  }
  for (const entry of registry.surfaces) {
    if (entry.surfaceTier !== "RANGE_ONLY") continue;
    const artifact = JSON.parse(readFileSync(entry.artifactPath, "utf8"));
    assert.ok(artifact.model.profile.whyNotRangeHabitat, `${entry.speciesId}: the reason travels with the surface`);
  }
});

test("every family states how its records are biased, and records never set a cell's value", () => {
  for (const [name, family] of Object.entries(profiles.families)) {
    assert.ok(family.recordBias.length > 40, `${name}: no statement of how its records are biased`);
    assert.ok(family.isolatedSquareMinRecords === null || family.isolatedSquareMinRecords >= 10, `${name}: an island needs real support`);
  }
  for (const entry of registry.surfaces) {
    const artifact = JSON.parse(readFileSync(entry.artifactPath, "utf8"));
    assert.ok(artifact.limitations.some((line: string) => /never set a cell's colour/.test(line)), `${entry.speciesId}: the bias rule travels with the surface`);
  }
});

test("a profile names land, water and terrain, never hunting geography", () => {
  const text = readFileSync("content/intelligence/surface-profiles.json", "utf8");
  assert.ok(!/management_zone|zoneId|layer:|jurisdiction:|WMU|GHA/.test(text), "no zone or jurisdiction in a habitat profile");
  const builder = readFileSync("scripts/build-range-habitat-surfaces.mjs", "utf8");
  for (const forbidden of ["zone-layers", "regulatory", "zone-geometry", "exploration/zone", "cartography"]) {
    assert.ok(!builder.includes(forbidden), `the builder must not read ${forbidden}`);
  }
});

test("migratory species are drawn from hunting-season records, and say so", () => {
  for (const entry of registry.surfaces) {
    if (profiles.species[entry.speciesId]?.season !== "HUNTING_SEASON_RECORDS") continue;
    const input = JSON.parse(readFileSync(`content/intelligence/range-habitat/inputs/${entry.speciesId.replace("species:", "")}.records.json`, "utf8"));
    assert.ok(Array.isArray(input.months) && input.months.length, `${entry.speciesId}: read without a month window`);
    const artifact = JSON.parse(readFileSync(entry.artifactPath, "utf8"));
    assert.match(artifact.season.observedSeason, /September to February/);
  }
});

test("values are habitat classes, and a range-only surface does not rank", () => {
  const values = new Set(Object.values(profiles.classValues));
  for (const entry of registry.surfaces) {
    const artifact = JSON.parse(readFileSync(entry.artifactPath, "utf8"));
    const cells = decodeCells(artifact.cellsEncoded);
    assert.ok(cells.row.length, entry.speciesId);
    const intensities = new Set(Array.from(cells.intensity));
    /* -1 is ground inside the range rated unsuitable: its own state, never painted. */
    for (const value of intensities) assert.ok(value === -1 || (value >= 200 && value <= 1000), `${entry.speciesId}: ${value} is outside the painted classes`);
    intensities.delete(-1);
    if (entry.surfaceTier === "RANGE_ONLY") {
      assert.deepEqual([...intensities], [500], `${entry.speciesId}: a known distribution is shaded evenly`);
      assert.equal(entry.surfaceKind, "RANGE_EXTENT");
    } else {
      assert.equal(entry.surfaceKind, "RANGE_HABITAT");
      /* A single-class profile draws that class; the classes themselves are the declared convention. */
      assert.ok(values.has(1) && values.has(0.25));
    }
  }
});

test("a declined species keeps its reason, and the served registry holds only eligible species", () => {
  for (const row of registry.declined) assert.ok(row.reason && permitsSpeciesHeat(row.speciesId), row.speciesId);
  for (const entry of surfaceRegistry().surfaces) assert.ok(permitsSpeciesHeat(entry.speciesId), entry.speciesId);
  for (const entry of registry.surfaces) assert.ok(existsSync(entry.artifactPath), entry.artifactPath);
});

/* ------------------------------------------------------ joining record gaps */

/* A 0.1° grid at 45°N, 40 × 40 cells: one row is 11.1 km, one column 7.9 km. */
const GRID = { rows: 40, columns: 40, north: 47, cell: 0.1 };
const blank = () => new Uint8Array(GRID.rows * GRID.columns);
const fill = (set: Uint8Array, rows: [number, number], cols: [number, number]) => {
  for (let r = rows[0]; r <= rows[1]; r += 1) for (let c = cols[0]; c <= cols[1]; c += 1) set[r * GRID.columns + c] = 1;
  return set;
};

test("joining a range's gaps fills a narrow gap and leaves a wide one", () => {
  /* Two blocks 5 columns apart (~40 km of empty ground between them). */
  const range = fill(fill(blank(), [10, 30], [5, 14]), [10, 30], [20, 29]);
  const narrow = closeRange(GRID, range, 80).inRange;
  for (let c = 15; c <= 19; c += 1) assert.equal(narrow[20 * GRID.columns + c], 1, `column ${c} of a 40 km gap joins at 80 km`);
  const wide = closeRange(GRID, range, 30).inRange;
  for (let c = 15; c <= 19; c += 1) assert.equal(wide[20 * GRID.columns + c], 0, `column ${c} of a 40 km gap stays open at 30 km`);
  assert.equal(closeRange(GRID, range, null).inRange, range, "a family that joins nothing keeps its range as drawn");
});

test("joining never removes range, and never reaches past the recorded edge", () => {
  const range = fill(fill(fill(blank(), [8, 14], [6, 12]), [17, 24], [10, 16]), [9, 12], [16, 20]);
  const { inRange: closed, added } = closeRange(GRID, range, 80);
  assert.ok(added > 0);
  let rowMin = GRID.rows, rowMax = 0, colMin = GRID.columns, colMax = 0;
  range.forEach((v, i) => {
    if (!v) return;
    rowMin = Math.min(rowMin, Math.floor(i / GRID.columns)); rowMax = Math.max(rowMax, Math.floor(i / GRID.columns));
    colMin = Math.min(colMin, i % GRID.columns); colMax = Math.max(colMax, i % GRID.columns);
  });
  closed.forEach((v, i) => {
    if (range[i]) assert.equal(v, 1, "nothing recorded is removed");
    if (!v) return;
    const row = Math.floor(i / GRID.columns);
    const col = i % GRID.columns;
    /* A closing lies inside the convex hull of what it closes, so inside its bounding box. */
    assert.ok(row >= rowMin && row <= rowMax && col >= colMin && col <= colMax, `cell ${row},${col} is past the recorded edge`);
  });
});

test("every family says whether and why it joins gaps, and each surface says it", () => {
  for (const [name, family] of Object.entries(profiles.families)) {
    assert.ok(family.gapKm === null || (family.gapKm > 0 && family.gapKm <= 300), `${name}: gapKm ${family.gapKm}`);
    assert.ok(family.gapWhy.length > 40, `${name}: no reason for its gap rule`);
  }
  for (const entry of registry.surfaces) {
    const artifact = JSON.parse(readFileSync(entry.artifactPath, "utf8"));
    const family = profiles.families[profiles.species[entry.speciesId].family];
    /* Documented places are named one by one and never joined. */
    assert.equal(artifact.model.range.gapKm, artifact.model.range.basis === "DOCUMENTED_POPULATION" ? null : family.gapKm, entry.speciesId);
  }
});

test("a record square is read at the size of the cell it stands for", () => {
  for (const entry of registry.surfaces) {
    const input = JSON.parse(readFileSync(`content/intelligence/range-habitat/inputs/${entry.speciesId.replace("species:", "")}.records.json`, "utf8"));
    /* A read that says its cells are 0.35° placed every record its coarse pass found; one that does not is a first read, of 1.40625° cells. */
    const step = input.aggregationDegrees ?? 1.40625;
    if (input.aggregationDegrees) {
      /* The fine pass placed what the coarse pass found, within the stated tolerance for a live index. */
      const placed = input.squares.reduce((sum: number, square: number[]) => sum + square[2], 0);
      assert.ok(Math.abs(input.aggregation.coarseRecords - placed) <= 0.001 * input.aggregation.coarseRecords, entry.speciesId);
    }
    assert.equal(entry.resolution.source.metres, Math.round(step * 111_000), `${entry.speciesId}: the stated source resolution is the cell the records stand for`);
  }
});

test("open water a profile names is drawn along its shore, never across the middle of a lake", () => {
  const artifact = JSON.parse(readFileSync("content/intelligence/range-habitat/mallard.json", "utf8"));
  const cells = decodeCells(artifact.cellsEncoded);
  const valueAt = (lat: number, lon: number) => {
    const row = Math.round((lat - artifact.grid.south) / artifact.grid.latStep);
    const col = Math.round((lon - artifact.grid.west) / artifact.grid.lonStep);
    for (let i = 0; i < cells.row.length; i += 1) if (cells.row[i] === row && cells.col[i] === col) return cells.intensity[i];
    return null;
  };
  /* Lake Winnipeg's north basin: every cell within 20 km is 87% water or more. */
  const middle = valueAt(52.8, -98.0);
  assert.ok(middle === null || middle < 0, `mallard painted ${middle} in the middle of Lake Winnipeg`);
  /* The prairie pothole country it is drawn from in the season is painted. */
  assert.ok((valueAt(50.5, -100.5) ?? 0) > 0, "mallard not drawn in the pothole prairie");
});

test("a range that stops where recording stops says so", () => {
  for (const entry of registry.surfaces) {
    const artifact = JSON.parse(readFileSync(entry.artifactPath, "utf8"));
    assert.equal(artifact.model.range.edgeOnUnrecordedGround, entry.edgeOnUnrecordedGround, entry.speciesId);
    const says = artifact.limitations.some((line: string) => /edge is where recording stops/.test(line));
    assert.equal(says, (entry.edgeOnUnrecordedGround ?? 0) >= 0.25, `${entry.speciesId}: edge on unrecorded ground ${entry.edgeOnUnrecordedGround}`);
  }
  /* Every family names the group whose recording measures its effort. */
  for (const [name, family] of Object.entries(profiles.families)) assert.ok(["MAMMAL", "BIRD", "REPTILE", "AMPHIBIAN"].includes(family.recordGroup), name);
});

test("a sedentary population on another island stands on its own records", () => {
  /* Kalij pheasant: 3 open records on Kauaʻi, 12,000 on Hawaiʻi Island. The
     150 km cluster rule used to carry the Kauaʻi records across the channel. */
  const artifact = JSON.parse(readFileSync("content/intelligence/range-habitat/kalij-pheasant.json", "utf8"));
  const cells = decodeCells(artifact.cellsEncoded);
  const on = (west: number, south: number, east: number, north: number) => {
    for (let i = 0; i < cells.row.length; i += 1) {
      const lat = artifact.grid.south + cells.row[i] * artifact.grid.latStep;
      const lon = artifact.grid.west + cells.col[i] * artifact.grid.lonStep;
      if (cells.intensity[i] > 0 && lat >= south && lat <= north && lon >= west && lon <= east) return true;
    }
    return false;
  };
  assert.equal(on(-159.9, 21.8, -159.2, 22.3), false, "Kauaʻi is not drawn from 3 records");
  assert.equal(on(-156.1, 18.9, -154.8, 20.3), true, "Hawaiʻi Island is drawn");
  assert.ok(artifact.model.range.landmassesWithTooFewRecords >= 1);
});

test("a documented population is drawn only where the profile names it and a record confirms it", () => {
  const ranges = new Map<string, string>();
  for (const file of readdirSync("content/published").filter((f) => f.endsWith(".json"))) {
    for (const resource of JSON.parse(readFileSync(`content/published/${file}`, "utf8")).resources ?? []) {
      const p = resource.speciesProfile;
      if (p) ranges.set(p.speciesId, (p.rangeSummary ?? []).map((r: { text?: string; value?: string }) => r.text ?? r.value ?? "").join(" "));
    }
  }
  const declared = Object.entries(profiles.species as Record<string, { documentedPopulations?: { statedAs: string; places: Array<{ place: string; cells: number[][] }> } }>)
    .filter(([, profile]) => profile.documentedPopulations);
  assert.ok(declared.length >= 10);
  for (const [speciesId, profile] of declared) {
    const documented = profile.documentedPopulations!;
    assert.ok(ranges.get(speciesId)?.includes(documented.statedAs), `${speciesId}: the place is not quoted from the published range`);
    const input = JSON.parse(readFileSync(`content/intelligence/range-habitat/inputs/${speciesId.replace("species:", "")}.records.json`, "utf8"));
    const held = new Set(input.squares.map(([west, south]: number[]) => `${south.toFixed(4)}:${west.toFixed(4)}`));
    for (const place of documented.places) for (const [south, west] of place.cells) assert.ok(held.has(`${south.toFixed(4)}:${west.toFixed(4)}`), `${speciesId}: ${place.place} has no record at ${south},${west}`);
    const entry = registry.surfaces.find((e) => e.speciesId === speciesId);
    if (!entry) continue;
    const artifact = JSON.parse(readFileSync(entry.artifactPath, "utf8"));
    if (artifact.model.range.basis !== "DOCUMENTED_POPULATION") continue;
    assert.equal(JSON.parse(readFileSync("content/intelligence/range-habitat-registry.json", "utf8")).surfaces.find((e: { speciesId: string }) => e.speciesId === speciesId).confidence.level, "LIMITED", `${speciesId}: a documented population is never more than LIMITED`);
    assert.deepEqual(artifact.model.range.documentedPlaces.map((p: { place: string }) => p.place), documented.places.map((p) => p.place));
  }
});

test("a place the statement names is drawn beside the clusters, and joined to nothing", () => {
  /* Emperor goose: "Most winter in the Aleutian Islands". Adak's 257
     hunting-season records have no neighbour within the clustering distance,
     so under 2.2.0 the island the statement is about was not drawn. */
  const artifact = JSON.parse(readFileSync("content/intelligence/range-habitat/emperor-goose.json", "utf8"));
  assert.equal(artifact.model.range.documentedPlacesAlongsideClusters, true);
  assert.deepEqual(artifact.model.range.documentedPlaces.map((p: { place: string }) => p.place), ["Adak Island, central Aleutians"]);
  assert.match(artifact.methodologyStatedAs, /Beside the clusters/);
  assert.ok(artifact.limitations.some((line: string) => /Also drawn, beyond the clustering rules: Adak Island/.test(line)));
  const cells = decodeCells(artifact.cellsEncoded);
  let adak = 0;
  let between = 0;
  for (let i = 0; i < cells.row.length; i += 1) {
    if (cells.intensity[i] <= 0) continue;
    const lat = artifact.grid.south + cells.row[i] * artifact.grid.latStep;
    const lon = artifact.grid.west + cells.col[i] * artifact.grid.lonStep;
    if (lat > 51 && lat < 52.6 && lon > -177.6 && lon < -175.8) adak += 1;
    /* Kiska to Amchitka, and Atka: no record cell confirms them, and the
       place is not joined to the clusters or to the Near Islands. */
    if (lat > 51 && lat < 53 && ((lon > -184 && lon < -178.5) || (lon > -175 && lon < -173.5))) between += 1;
  }
  assert.ok(adak > 0, "Adak is painted");
  assert.equal(between, 0, "nothing between the declared place and other ground is painted");
  /* The clustering rule itself is unchanged: an isolated square a profile
     does not name stays undrawn (canvasback at Adak is a visitor). */
  const canvasback = JSON.parse(readFileSync("content/intelligence/range-habitat/canvasback.json", "utf8"));
  const cb = decodeCells(canvasback.cellsEncoded);
  for (let i = 0; i < cb.row.length; i += 1) {
    const lat = canvasback.grid.south + cb.row[i] * canvasback.grid.latStep;
    const lon = canvasback.grid.west + cb.col[i] * canvasback.grid.lonStep;
    assert.ok(!(lat > 51 && lat < 52.6 && lon > -177.6 && lon < -175.8 && cb.intensity[i] > 0), `canvasback painted at Adak ${lat},${lon}`);
  }
});

test("records kept within a geography never draw outside it", () => {
  const artifact = JSON.parse(readFileSync("content/intelligence/range-habitat/ermine.json", "utf8"));
  assert.ok(artifact.model.range.cellsOutside > 0, "the American ermine's records were set aside");
  const cells = decodeCells(artifact.cellsEncoded);
  for (let i = 0; i < cells.row.length; i += 1) {
    if (cells.intensity[i] <= 0) continue;
    const lat = artifact.grid.south + cells.row[i] * artifact.grid.latStep;
    const lon = artifact.grid.west + cells.col[i] * artifact.grid.lonStep;
    /* Within reach of the boxes: west of 141°W, or north of the Arctic Circle, give or take the family's 40 km and a gap join. */
    assert.ok(lon < -139 || lat > 65.5, `ermine painted at ${lat.toFixed(2)},${lon.toFixed(2)}`);
  }
});

/* ---- 2.4.0: an authority's words and maps, never inference ---- */

const jurisdictionManifest = existsSync("content/intelligence/foundation/jurisdictions-0.1deg.json")
  ? JSON.parse(readFileSync("content/intelligence/foundation/jurisdictions-0.1deg.json", "utf8")) as { grid: { west: number; north: number; cell: number; columns: number; rows: number }; codes: Array<{ index: number; code: string | null }>; artifact: { file: string } }
  : null;
const jurisdictionBytes = jurisdictionManifest
  ? gunzipSync(readFileSync(`content/intelligence/foundation/${jurisdictionManifest.artifact.file}`))
  : null;

test("records the published statement calls strays are set aside in the states and provinces it names", () => {
  assert.ok(jurisdictionManifest && jurisdictionBytes, "the jurisdiction foundation is committed");
  const g = jurisdictionManifest.grid;
  const declared = Object.entries(profiles.species).filter(([, p]) => (p as { recordsNotWithin?: unknown }).recordsNotWithin);
  assert.deepEqual(declared.map(([id]) => id).sort(), ["species:king-eider", "species:purple-gallinule", "species:white-winged-dove"]);
  for (const [speciesId, profile] of declared) {
    const named = (profile as unknown as { recordsNotWithin: { jurisdictions: string[] } }).recordsNotWithin.jurisdictions;
    const names = (code: string) => named.some((n) => code === n || (n.endsWith("-*") && code.startsWith(n.slice(0, -1))));
    const excluded = new Set(jurisdictionManifest.codes.filter((c) => c.code !== null && names(c.code)).map((c) => c.index));
    const allowed = (row: number, col: number) => {
      const code = jurisdictionBytes[row * g.columns + col];
      return code !== 0 && !excluded.has(code);
    };
    const entry = registry.surfaces.find((s) => s.speciesId === speciesId);
    assert.ok(entry, speciesId);
    const artifact = JSON.parse(readFileSync(entry.artifactPath, "utf8"));
    assert.ok(artifact.model.range.strayCellsDropped > 0, `${speciesId} set no record aside`);
    assert.ok(artifact.limitations.some((line: string) => /are not drawn: North Ground's published profile says/.test(line)), speciesId);
    /* What remains painted inside the named jurisdictions is only the reach of
       range across their line: every such cell lies within the family's reach
       and half its gap (plus one record cell) of ground that is not named. */
    const family = profiles.families[profile.family];
    const reachDeg = (family.reachKm + (family.gapKm ?? 0) / 2) / 111 + 1.5;
    const cells = decodeCells(artifact.cellsEncoded);
    for (let i = 0; i < cells.row.length; i += 1) {
      if (cells.intensity[i] <= 0) continue;
      const lat = artifact.grid.south + cells.row[i] * artifact.grid.latStep;
      const lon = artifact.grid.west + cells.col[i] * artifact.grid.lonStep;
      const row = Math.floor((g.north - lat) / g.cell);
      const col = Math.floor((lon - g.west) / g.cell);
      if (!excluded.has(jurisdictionBytes[row * g.columns + col])) continue;
      const span = Math.ceil(reachDeg / g.cell);
      let near = false;
      for (let dr = -span; dr <= span && !near; dr += 1) {
        const dc = Math.ceil(span / Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
        for (let c = -dc; c <= dc && !near; c += 1) {
          const r = row + dr;
          const cc = col + c;
          if (r >= 0 && r < g.rows && cc >= 0 && cc < g.columns && allowed(r, cc)) near = true;
        }
      }
      assert.ok(near, `${speciesId} painted at ${lat.toFixed(2)},${lon.toFixed(2)}, deep inside ground its statement calls strays`);
    }
  }
});

test("an authority's range adds ground only where nobody records the group, and never removes any", async () => {
  const { fillFromAuthority } = await import("../../../../scripts/lib/authority-range.mjs");
  const inRange = Uint8Array.from([1, 0, 0, 0, 0]);
  const authority = Uint8Array.from([1, 1, 1, 0, 0]);
  const wellRecorded = (cell: number) => cell === 2;
  const filled = fillFromAuthority(inRange, authority, wellRecorded);
  assert.deepEqual([...filled.inRange], [1, 1, 0, 0, 0], "unrecorded ground the map covers joins; recorded ground keeps the records' silence; ground the map leaves out stays out");
  assert.equal(filled.added, 1);
  assert.deepEqual([...inRange], [1, 0, 0, 0, 0], "the range given is not changed");
  /* Never removes: a cell in the range stays whatever the map says. */
  assert.deepEqual([...fillFromAuthority(Uint8Array.from([1, 1]), Uint8Array.from([0, 0]), () => false).inRange], [1, 1]);
});

test("a GAP map is imported only where its sub-watershed table says every part is known and extant", async () => {
  const { gapSelection } = await import("../../../../scripts/lib/authority-range.mjs");
  const read = (combos: Record<string, number>, extra: Record<string, unknown> = {}) => ({
    published: "2018-08-15",
    hucCombos: { "x.csv": combos },
    parts: [{ attributes: { SeasonCode: 1, SeasonName: "Year-round" }, cells: [[10, 3]] }],
    ...extra,
  });
  assert.equal(gapSelection(read({ "Native|Known/extant|Both|Year-round": 40 })).import, true);
  const mixed = gapSelection(read({ "Native|Known/extant|Both|Year-round": 40, "Native|Extirpated/historical presence|Both|Year-round": 3 }));
  assert.equal(mixed.import, false, "historical ground would be drawn as range");
  assert.match(mixed.why, /3 "Extirpated\/historical presence"/);
  assert.equal(gapSelection(read({ "Native|Known/extant|Both|Year-round": 40 }, { published: null })).import, false, "a map whose age cannot be stated is not imported");
  assert.equal(gapSelection(read({ "Native|Known/extant|Both|Year-round": 40 }, { hucCombos: {} })).import, false, "no table, no presence, no import");
  /* Read by sub-watershed, a mixed table gives its known ground and nothing else. */
  const byHuc = gapSelection(read({}, {
    hucParts: [
      { origin: "Native", presence: "Known/extant", reproduction: "Both", season: "Year-round", hucs: 30, cells: [[100, 4]] },
      { origin: "Native", presence: "Extirpated/historical presence", reproduction: "Both", season: "Year-round", hucs: 9, cells: [[200, 7]] },
      { origin: "Native", presence: "Known/extant", reproduction: "Nonbreeding", season: "Migratory", hucs: 2, cells: [[300, 1]] },
    ],
  }));
  assert.equal(byHuc.import, true);
  assert.deepEqual(byHuc.cells, { YEAR_ROUND: [[100, 4]] }, "extirpated ground and passage ground are left out");
  assert.match(byHuc.why, /30 of 41 sub-watersheds/);
  /* Every committed import passed that rule, and says so. */
  const dir = "content/intelligence/range-habitat/authority";
  for (const file of existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json") && !f.startsWith("_")) : []) {
    const entry = JSON.parse(readFileSync(`${dir}/${file}`, "utf8"));
    for (const r of entry.reads) {
      assert.match(r.selected, /"Known\/extant"/, file);
      assert.ok(r.published && r.sha256 && r.fileUrl && r.licence, file);
    }
  }
});

test("a surface that drew on an authority's range map says so, credits it, and dates it", () => {
  for (const entry of registry.surfaces) {
    const artifact = JSON.parse(readFileSync(entry.artifactPath, "utf8"));
    const authority = artifact.model.range.authorityRange;
    if (!authority) continue;
    assert.ok(artifact.limitations.some((line: string) => /map(s)? (as )?the species' range/.test(line)), entry.speciesId);
    assert.ok(authority.reads.every((r: { authority: string }) => artifact.source.attribution.includes("Gap Analysis Project") || artifact.source.attribution.includes(r.authority)), entry.speciesId);
    assert.ok((entry as unknown as { inputsDated: Array<{ kind: string }> }).inputsDated.some((i) => i.kind === "AUTHORITY_RANGE"), entry.speciesId);
  }
});
