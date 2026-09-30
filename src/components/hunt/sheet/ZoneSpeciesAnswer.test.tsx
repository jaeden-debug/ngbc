import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { stated, type ResolvedOpportunity } from "../../../lib/hunt/regulatory/opportunity-row.ts";
import type { SpeciesZoneSummary } from "../../../lib/hunt/exploration/states.ts";
import { ZoneSpeciesAnswer } from "./ZoneContext.tsx";

/**
 * The rows replace the season sentence where rows exist, and the sentence stays
 * where they do not. The status stays in both.
 *
 * §41A: "long-form legal prose never replaces a concise operational answer
 * where the same information can be represented accurately as structured
 * data" — and once the structured version exists the prose is the redundant
 * one. Keeping both would put one fact in two places on a single card.
 */

const SPECIES = {
  id: "species:white-tailed-deer",
  displayName: "White-tailed deer",
  scientificName: "Odocoileus virginianus",
  category: "big-game",
  aliases: [],
  searchTerms: [],
  resourcePath: null,
  image: null,
  regulatoryJurisdictions: [],
} as never;

const SUMMARY = {
  zone: {
    layerId: "layer:ca-qc-zone-chasse",
    designation: "10O",
    label: "Zone 10 West",
    officialName: "Zone de chasse 10O",
    jurisdictionId: "jurisdiction:ca-qc",
    jurisdictionName: "Québec",
    authority: "MELCCFP",
  },
  species: [],
} as never;

const entry = (over: Partial<SpeciesZoneSummary> = {}): SpeciesZoneSummary => ({
  speciesId: "species:white-tailed-deer",
  state: "SEASON_AVAILABLE",
  season: { opens: "2026-10-01", closes: "2026-12-15" },
  next: { kind: "NOT_CERTIFIED" },
  ...over,
} as SpeciesZoneSummary);

const rows: ResolvedOpportunity[] = [{
  ruleId: "regulatory_rule:test",
  speciesId: "species:white-tailed-deer",
  animalClass: stated("ANTLERED"),
  criterion: null,
  implements: stated(["BOW"]),
  windows: [{ opens: "2026-10-01", closes: "2026-10-14", datesInclusive: true }],
  conditionIds: [],
}];

const render = (e: SpeciesZoneSummary) => renderToStaticMarkup(
  <ZoneSpeciesAnswer entry={e} species={SPECIES} summary={SUMMARY} zoneLabel="Zone 10 West" action={null} date="2026-10-05" />,
);

test("where rows exist they replace the sentence, and the status stays", () => {
  const html = render(entry({ opportunities: rows }));
  assert.match(html, /What is open here/, "the rows are rendered");
  assert.match(html, /Antlered/);
  assert.match(html, /Bow/);
  /* The prose rendering of the same fact is gone — one fact, one place. */
  assert.doesNotMatch(html, /The season runs across Zone 10 West/);
  /* And the status, which answers a different question, is still there. */
  assert.match(html, /In season|Depends on your hunt|Needs a closer look/i);
});

test("where no rows exist the sentence stays, so every jurisdiction still answers", () => {
  /* Ontario has no structured dates and five bundles state no class; those
     zones must keep answering in prose rather than going silent. */
  const html = render(entry());
  assert.match(html, /The season runs across Zone 10 West/);
  assert.doesNotMatch(html, /What is open here/);
});

test("the card never shows the same fact twice", () => {
  const html = render(entry({ opportunities: rows }));
  const sentenceCount = (html.match(/The season runs across/g) ?? []).length;
  const rowsCount = (html.match(/What is open here/g) ?? []).length;
  assert.equal(sentenceCount + rowsCount, 1, "exactly one of the two renders, never both");
});
