import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  bufferStepPx, composite, luminance, paintFor, rampAt, sampleSurface, SURFACE_RAMP, SURVEYED_NONE, type RenderableSurface,
} from "./surface-paint.ts";
import { SEASON_OPEN_CASING, SEASON_OPEN_STROKE, seasonCasingStyle, zoneStyle } from "./cartography.ts";

const hex = (value: string) => ({
  red: parseInt(value.slice(1, 3), 16),
  green: parseInt(value.slice(3, 5), 16),
  blue: parseInt(value.slice(5, 7), 16),
});

/* The two grounds a surface is composited over in production: North Ground's
   own dark basemap, and satellite imagery, whose bright ground is the harder
   case for a legality outline to win over. */
const DARK_BASEMAP = hex("#151a15");
const BRIGHT_SATELLITE = hex("#b9b49c");

function grid(cells: Record<number, number>, rows = 4, cols = 4): RenderableSurface {
  return {
    id: "surface:test",
    speciesId: "species:ruffed-grouse",
    continuity: "CONTINUOUS",
    effectiveResolutionMetres: 40_000,
    grid: { latStep: 1, lonStep: 1, south: 40, west: -80, rows, cols },
    cells: new Map(Object.entries(cells).map(([k, v]) => [Number(k), v])),
  };
}

test("the ramp runs transparent to red through the owner's own sequence", () => {
  /* Transparent is reserved for ground with NO evidence (null), and a surveyed
     zero has its own neutral (`SURVEYED_NONE`). The ramp starts at the bottom
     tenth of where the species WAS found: faint, but blue — low, not none. */
  assert.ok(SURFACE_RAMP[0].alpha > 0 && SURFACE_RAMP[0].alpha <= 0.2, "it begins at a faint blue");
  assert.equal(SURFACE_RAMP[SURFACE_RAMP.length - 1].at, 1);

  /* Hue order, read as a weather radar is read. Asserted per band by the
     relationship between channels rather than by an argmax — yellow is red and
     green together, so "which channel is largest" says nothing useful there and
     an earlier version of this test failed a perfectly good ramp because of
     it. */
  const at = (t: number) => rampAt(t);
  const blue = at(0.15);
  assert.ok(blue.blue > blue.green && blue.green > blue.red, "0.15 is blue");
  const cyan = at(0.3);
  assert.ok(cyan.blue > cyan.red && cyan.green > cyan.red, "0.3 is cyan: blue and green over a low red");
  const green = at(0.5);
  assert.ok(green.green > green.red && green.green > green.blue, "0.5 is green");
  const yellow = at(0.7);
  assert.ok(yellow.red > yellow.blue * 3 && yellow.green > yellow.blue * 3, "0.7 is yellow: red and green over a low blue");
  const orange = at(0.9);
  assert.ok(orange.red > orange.green && orange.green > orange.blue, "0.9 is orange");
  const red = at(1);
  assert.ok(red.red > red.green * 3 && red.red > red.blue * 3, "1.0 is red");

  /* Alpha never falls as intensity climbs: a stronger place is never quieter. */
  let previous = -1;
  for (let t = 0; t <= 1.0001; t += 0.01) {
    const { alpha } = rampAt(t);
    assert.ok(alpha >= previous - 1e-9, `alpha fell at ${t.toFixed(2)}`);
    previous = alpha;
  }
  /* And the top stays translucent, because the basemap has to read through the
     hottest ground as well as the coldest (§41A). */
  assert.ok(rampAt(1).alpha < 0.8, "a fully opaque core would hide the map exactly where a hunter is going");
});

test("the legality outline beats the ramp's own green, over dark ground and over satellite", () => {
  /*
   * THE RISK THE OWNER ACCEPTED when they let green into the ramp: the map now
   * has two greens that mean completely different things. Ramp green is
   * "moderate abundance". Outline green is "there is a legal hunt here now".
   * Confusing them is a regulatory error made with a colour.
   *
   * So the outline must win on LUMINANCE, not hue — and at every hundredth of
   * the ramp rather than at its stops, because the failure would be between
   * them. The margin is checked over both grounds the surface is composited
   * over in production.
   */
  const ring = luminance(hex(SEASON_OPEN_STROKE));
  const casing = luminance(hex(SEASON_OPEN_CASING));

  /*
   * THE MEASUREMENT THAT FORCED THE CASING. Bare green against the surface is
   * NOT always brighter: over satellite imagery the ramp's yellow at 0.70
   * composites BRIGHTER than `--ng-open`, by 0.102. A bare line would be lost
   * exactly there, and losing it means missing that a legal hunt exists.
   */
  assert.ok(
    ring - luminance(composite(rampAt(0.7), BRIGHT_SATELLITE)) < 0,
    "if this ever passes, the yellow has been dulled and the casing's reason has gone; re-derive before removing it",
  );

  /* The line as actually drawn is casing / green / casing, so what has to hold
     is that the PAIR is legible against whatever is under it: the green always
     contrasts with its own casing, and at least one of the two always contrasts
     with the ground. */
  assert.ok(Math.abs(ring - casing) >= 0.3, "the green must always stand off its own casing");
  for (const [name, basemap] of [["dark basemap", DARK_BASEMAP], ["satellite", BRIGHT_SATELLITE]] as const) {
    let worst = { at: 0, gap: Infinity };
    for (let t = 0; t <= 1.0001; t += 0.01) {
      const ground = luminance(composite(rampAt(t), basemap));
      const gap = Math.max(Math.abs(ring - ground), Math.abs(casing - ground));
      if (gap < worst.gap) worst = { at: t, gap };
    }
    assert.ok(
      worst.gap >= 0.18,
      `over ${name} neither the line nor its casing separates from the surface at intensity ${worst.at.toFixed(2)} (best ${worst.gap.toFixed(3)})`,
    );
  }
});

test("the casing carries no fill, so legality cannot tint the evidence", () => {
  /*
   * §41B: heat never implies legality and legality never implies animals. A
   * casing polygon with any fill at all would sit under the green zones only,
   * add its own opacity to theirs, and make open zones read hotter than shut
   * ones — legality leaking into the animal layer through a rendering detail.
   */
  const casing = seasonCasingStyle({ seasonOpen: true, selected: false, band: "regional", hovered: false });
  assert.ok(casing, "an open zone gets a casing");
  assert.equal(casing.fillOpacity, 0);
  assert.equal(seasonCasingStyle({ seasonOpen: false, selected: false, band: "regional", hovered: false }), null);
  assert.equal(
    seasonCasingStyle({ seasonOpen: true, selected: true, band: "regional", hovered: false }),
    null,
    "the chosen zone wears the bone outline; two loudest lines is no loudest line",
  );

  /* And it is heavier than the line it carries, or it is not a casing. */
  const line = zoneStyle({
    coverage: "VERIFIED", selected: false, hunt: false, hovered: false, dimmed: false,
    seasonOpen: true, band: "regional", emphasis: "standard",
  });
  assert.ok(casing.strokeWeight > line.strokeWeight, "the casing must be wider than the line it sits under");
  assert.ok(casing.zIndex < line.zIndex, "and under it");
});

test("the outline also wins on weight, so luminance is not carrying it alone", () => {
  /* §41A and the moderator's instruction both: weight AND luminance, never hue
     alone. The surface has no stroke at all, so any green line on the map is
     the legality outline — asserted here as a property of the module rather
     than left to a reader of the renderer. */
  const source = readFileSync(new URL("./surface-paint.ts", import.meta.url), "utf8");
  assert.ok(!/stroke/i.test(source), "the surface must never draw a line; a line on this map means legality");
});

test("surveyed-and-none-found is a finding; unsurveyed is not, and they never collapse", () => {
  /*
   * The distinction this whole architecture turns on, and the one canada agent
   * found their ingest had already lost once. A cell holding 0 was visited and
   * the species was not there. Ground with no cell was never visited. Drawing
   * the second like the first tells a hunter that wilderness nobody has
   * surveyed is empty.
   */
  const surface = grid({ [1 * 4 + 1]: 0 });
  assert.equal(sampleSurface(surface, 41, -79), 0, "a surveyed cell reporting none is zero, and zero is drawn");
  assert.equal(sampleSurface(surface, 43, -77), null, "ground with no cell is null, and null is drawn as nothing");

  /* And zero is visible, in its OWN paint: "we looked and found nothing" is
     distinguishable from "nobody looked" (transparent) and from "we found a
     few" (the ramp's blue). Painting it blue read as a low population across
     every province the survey is sure the bird is absent from. */
  const none = paintFor(0);
  assert.equal(none, SURVEYED_NONE);
  assert.ok(none.alpha > 0, "zero is drawn: we looked and found none");
  assert.ok(none.blue <= none.red, "and it is not blue: none found is not low");
  assert.ok(none.alpha < rampAt(0.3).alpha, "and it is fainter than real abundance");
  assert.deepEqual(paintFor(0.001), rampAt(0.001), "the faintest detection is on the ramp");
});

test("a point outside the grid is null, never the nearest edge value", () => {
  const surface = grid({ 5: 1 });
  assert.equal(sampleSurface(surface, 90, -79), null);
  assert.equal(sampleSurface(surface, 41, -179), null);
});

test("one small area can hold many intensities — the test a choropleth fails", () => {
  /*
   * §41A's acceptance invariant, at the sampling level: the value must be free
   * to vary continuously across ground that a single hunting zone would cover.
   * A choropleth cannot produce more than one value here however it is drawn.
   */
  const surface = grid({ 0: 0, 1: 0.3, 2: 0.7, 3: 1 }, 1, 4);
  const seen = new Set<string>();
  for (let lon = -80; lon <= -77; lon += 0.1) {
    const value = sampleSurface(surface, 40, lon);
    if (value !== null) seen.add(value.toFixed(2));
  }
  assert.ok(seen.size > 10, `expected a continuum across the area, saw ${seen.size} distinct values`);
});

test("interpolation reconstructs the field and never overshoots it", () => {
  /*
   * Reconstruction, not invention (§13). Between two sampled cells the value
   * must stay within the range of the cells that produced it: a bright core
   * BETWEEN two ordinary cells would be North Ground inventing a hotspot, which
   * is the failure the whole surface architecture exists to prevent — and it is
   * the one a hunter would act on.
   */
  const surface = grid({ 0: 0.2, 1: 0.6 }, 1, 2);
  for (let lon = -80; lon <= -79; lon += 0.05) {
    const value = sampleSurface(surface, 40, lon);
    if (value === null) continue;
    assert.ok(value >= 0.2 - 1e-9 && value <= 0.6 + 1e-9, `interpolated ${value} outside [0.2, 0.6] at ${lon}`);
  }
});

test("a discrete surface is never interpolated between its samples", () => {
  /*
   * `continuity` is the surface's own data. The waterfowl plots are 25 km²
   * squares scattered across five provinces and their publisher says nothing
   * about the ground between them; smoothing across that gap would manufacture
   * a continental duck map out of 332 helicopter flights.
   */
  const plots: RenderableSurface = { ...grid({ 0: 0.1, 1: 0.9 }, 1, 2), continuity: "DISCRETE" };
  const values = new Set<number>();
  for (let lon = -80; lon <= -79; lon += 0.05) {
    const value = sampleSurface(plots, 40, lon);
    if (value !== null) values.add(value);
  }
  assert.deepEqual([...values].sort(), [0.1, 0.9], "a discrete surface may only ever report the values it holds");
});

test("the buffer never samples a surface more finely than its evidence", () => {
  /*
   * §13: zooming to a road does not create road-level animal knowledge. The
   * buffer step grows as the map zooms in, so a 40 km field costs the same work
   * and shows the same structure at every scale — smoother, never finer.
   */
  const fortyKm = 40_000;
  const continental = bufferStepPx(fortyKm, 3000);
  const regional = bufferStepPx(fortyKm, 600);
  assert.ok(regional > continental, "zoomed in, one sample must cover more screen, not less");
  assert.equal(bufferStepPx(fortyKm, 1e9), 2, "at absurd scale the step is floored, not zero");
  assert.ok(bufferStepPx(fortyKm, 0) > 0, "a broken projection must not divide by zero");

  /* A fine surface may legitimately be sampled more finely than a coarse one at
     the same zoom, which is what honouring the declared resolution means.
     Compared below the ceiling, because at street zoom both are capped and an
     earlier version of this test compared two capped values and demanded they
     differ. */
  assert.ok(bufferStepPx(1_000, 600) < bufferStepPx(fortyKm, 600));
  assert.equal(bufferStepPx(fortyKm, 5), 24, "and the cap holds, so the work does not grow without bound");
});

test("the paint module cannot see a hunting zone", () => {
  /*
   * §2's acceptance invariant, made structural rather than tested behaviourally:
   * a regulatory boundary can only influence the surface if this module can
   * reach one. It imports the legality colour to CHECK ITSELF AGAINST it, which
   * is the one direction that is safe, and nothing else.
   */
  const source = readFileSync(new URL("./surface-paint.ts", import.meta.url), "utf8");
  const imports = [...source.matchAll(/from "([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(imports, [], "the surface paint module must import nothing at all");
});

test("the legend's key is the ramp the map paints, stop for stop", () => {
  /* The key is CSS and the map is canvas, so nothing ties them but this. A key
     whose bands sat at the old ratio-scale positions would tell a hunter blue
     covers four tenths of the scale when the map spends one tenth on it. */
  const css = readFileSync(new URL("../../../components/hunt/SpeciesLayerLegend.module.css", import.meta.url), "utf8");
  const block = css.slice(css.indexOf('.scaleBar[data-surface="true"]'));
  const stops = [...block.slice(0, block.indexOf(");")).matchAll(/rgb\((\d+) (\d+) (\d+)\) (\d+)%/g)]
    .map((m) => ({ red: +m[1], green: +m[2], blue: +m[3], at: +m[4] / 100 }));
  assert.deepEqual(stops, SURFACE_RAMP.map(({ red, green, blue, at }) => ({ red, green, blue, at })));
});
