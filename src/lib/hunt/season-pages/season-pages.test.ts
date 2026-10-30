import assert from "node:assert/strict";
import test from "node:test";
import { FORBIDDEN_GUESSES } from "../regulatory/opportunity-presentation.ts";
import { opportunityIdentity } from "../regulatory/opportunity-row.ts";
import { ZONE_LAYERS } from "../zone-layers.ts";
import { regionDirectAnswer, regionFaq, speciesDirectAnswer, speciesFaq, dayLabel } from "./copy.ts";
import { seasonRegions } from "./regions.ts";
import { regionPage, seasonPageIndex, speciesSeasonPage, type SpeciesSeasonPage } from "./seasons.ts";

/* One fixed instant, so every assertion is about a known day in every province. */
const NOW = new Date("2026-10-29T18:00:00Z");

const pages = new Map<string, SpeciesSeasonPage>();
async function allPages(): Promise<SpeciesSeasonPage[]> {
  if (pages.size) return [...pages.values()];
  for (const entry of await seasonPageIndex()) {
    const page = await speciesSeasonPage(entry.region, entry.species, NOW);
    assert.ok(page, `${entry.region}/${entry.species} is listed and must render`);
    pages.set(`${entry.region}/${entry.species}`, page);
  }
  return [...pages.values()];
}

test("a province has a page only where Hunt serves its certified rules", () => {
  const regions = seasonRegions();
  assert.ok(regions.length > 0);
  for (const region of regions) {
    assert.ok(region.jurisdictionId.startsWith("jurisdiction:ca-"), "Canada only until the United States is properly served");
    for (const { layer, designations } of region.layers) {
      assert.equal(layer.rulesServing, true, `${layer.id} serves rules`);
      assert.ok(designations.length > 0);
    }
  }
  /* A page lists units, so a province served at geography level JURISDICTION
     (Prince Edward Island, which publishes none) has no page yet. That is a
     gap in the pages, named here so it is chosen rather than silent: its
     answers are served in Hunt, and a province-wide page is unbuilt. */
  const served = new Set(ZONE_LAYERS.filter((layer) => layer.serving && layer.rulesServing && layer.country === "CA" && layer.geographyLevel !== "JURISDICTION").map((layer) => layer.jurisdictionId));
  assert.deepEqual(new Set(regions.map((region) => region.jurisdictionId)), served);
  assert.ok(!regions.some((region) => region.jurisdictionId === "jurisdiction:ca-pe"));
});

test("every listed species page renders, and no page exists to say nothing", { timeout: 300_000 }, async () => {
  for (const page of await allPages()) {
    assert.ok(page.zones.length > 0);
    assert.ok(page.zones.some((zone) => zone.state !== "NOT_CERTIFIED"), `${page.region.slug}/${page.speciesSlug} holds a certified answer`);
  }
});

test("counts are the zones' own states, and a gap is never counted as closed", { timeout: 300_000 }, async () => {
  for (const page of await allPages()) {
    const total = Object.values(page.counts).reduce((sum, count) => sum + count, 0);
    assert.equal(total, page.zones.length);
    for (const [state, count] of Object.entries(page.counts)) {
      assert.equal(count, page.zones.filter((zone) => zone.state === state).length, `${page.speciesSlug} ${state}`);
    }
    assert.equal(page.opportunityZones, page.zones.filter((zone) => zone.opportunityNow).length);
    const answer = speciesDirectAnswer(page);
    if (page.counts.CLOSED === 0) assert.doesNotMatch(answer, /closed in \d/, "no closure is stated where none was");
    else assert.match(answer, new RegExp(`closed in ${page.counts.CLOSED}\\b`));
    if (page.counts.UNKNOWN > 0) assert.match(answer, /not a closed season/);
  }
});

test("no sentence says a season is open to the hunter, and every answer is dated", { timeout: 300_000 }, async () => {
  for (const page of await allPages()) {
    const text = [speciesDirectAnswer(page), ...speciesFaq(page).map((item) => item.answer)].join(" ");
    assert.doesNotMatch(text, /\bOPEN\b/);
    assert.doesNotMatch(text, /(?<!whether a season is )open to you/i);
    assert.match(speciesDirectAnswer(page), new RegExp(dayLabel(page.date)));
    for (const guess of FORBIDDEN_GUESSES) assert.ok(!text.includes(guess), `${page.speciesSlug} never says "${guess}"`);
  }
});

test("an unestablished dimension is shown as unknown, never defaulted", { timeout: 300_000 }, async () => {
  for (const page of await allPages()) {
    for (const row of page.groups.flatMap((group) => group.rows)) {
      for (const dimension of [row.animalClass, row.implements]) {
        if (dimension.kind === "UNKNOWN") assert.equal(dimension.text, "Not established");
        if (dimension.kind === "VALUE") assert.ok(!FORBIDDEN_GUESSES.includes(dimension.text));
      }
    }
  }
});

test("a group holds only zones whose certified seasons are identical, each window once", { timeout: 300_000 }, async () => {
  for (const page of await allPages()) {
    for (const group of page.groups) {
      const signature = (zone: (typeof group.zones)[number]) => zone.opportunities
        .map((row) => `${opportunityIdentity(row)}|${row.windows.map((window) => `${window.opens}..${window.closes}`).join(",")}`)
        .sort().join(";");
      const first = signature(group.zones[0]);
      for (const zone of group.zones) assert.equal(signature(zone), first, `${page.speciesSlug} ${zone.designation}`);
      for (const row of group.rows) {
        const keys = row.windows.map((window) => `${window.opens}|${window.closes}`);
        assert.equal(new Set(keys).size, keys.length, "a window is listed once");
      }
    }
    const grouped = page.groups.reduce((sum, group) => sum + group.zones.length, 0);
    const listed = page.statusGroups.reduce((sum, group) => sum + group.zones.length, 0);
    assert.equal(grouped + listed, page.zones.length, "every zone appears exactly once");
  }
});

test("every page cites at least one official source with a link", { timeout: 300_000 }, async () => {
  for (const page of await allPages()) {
    assert.ok(page.sources.some((source) => source.url?.startsWith("https://")), `${page.region.slug}/${page.speciesSlug} cites a source`);
  }
  const deer = pages.get("ontario/white-tailed-deer");
  assert.ok(deer?.sources.some((source) => source.id === "source:ca-on-deer-2026"), "Ontario's major-game sources resolve");
});

test("a province page lists only species with pages, and names what it does not cover", async () => {
  const index = await seasonPageIndex();
  for (const region of seasonRegions()) {
    const page = await regionPage(region.slug, NOW);
    assert.ok(page);
    for (const species of page.species) {
      assert.ok(index.some((entry) => entry.region === region.slug && entry.species === species.speciesSlug), `${region.slug}/${species.speciesSlug} links to a page`);
    }
    const answer = regionDirectAnswer(page);
    assert.match(answer, /not the same as closed|none of the/);
    assert.ok(regionFaq(page).every((item) => item.answer.length > 0));
  }
});

test("an unknown slug has no page", async () => {
  assert.equal(await speciesSeasonPage("ontario", "unicorn", NOW), null);
  assert.equal(await speciesSeasonPage("atlantis", "moose", NOW), null);
  assert.equal(await regionPage("atlantis", NOW), null);
});
