import { seasonRegions } from "../../lib/hunt/season-pages/regions";
import { seasonPageIndex } from "../../lib/hunt/season-pages/seasons";
import { absoluteUrl } from "../../lib/site";

/**
 * /llms.txt: a plain map of the site for language models and answer engines.
 *
 * Generated from the same registries that generate the pages, so it lists
 * exactly the season pages that exist and cannot name one that does not. It
 * states what North Ground is and is not entitled to say — the same limits the
 * pages carry — because an assistant that cites us should cite those too.
 */
export const revalidate = 3600;

export async function GET(): Promise<Response> {
  const regions = seasonRegions();
  const pairs = await seasonPageIndex();
  const lines: string[] = [
    "# North Ground",
    "",
    "> North Ground Hunt finds the official hunting zone for a place in Canada and answers what is in season there on a given date, from certified readings of each province's official regulations, with the source cited. North Ground organises official information; the responsible authority's own regulations are the law.",
    "",
    "Coverage is Canadian and per province, per species and per zone. A zone or species North Ground has not certified is reported as not covered, which is never the same as a closed season. Status words: \"In season\" means a season is running for every licence the rules recognise (it is not a licence); \"Depends on your hunt\" means it turns on residency, licence, tag or method; \"Closed\" means the certified rules state no season on that date; \"Not covered here\" is a gap in coverage. Harvesting under treaty or Aboriginal rights is a separate legal context North Ground does not evaluate.",
    "",
    "## Tools",
    "",
    `- [North Ground Hunt — hunting zone and season finder](${absoluteUrl("/hunt")}): map of official hunting zones; search a place or use your location to resolve the zone, then a species and date for the certified answer and its source.`,
    `- [Hunting hub](${absoluteUrl("/hunting")}): entry point to Hunt, province season pages and the species library.`,
    `- [How North Ground verifies](${absoluteUrl("/hunting/how-north-ground-verifies")}): sources, certification, status words and limits.`,
    "",
    "## Hunting seasons by province (status recomputed daily)",
    "",
    ...regions.map((region) => `- [${region.name} hunting seasons](${absoluteUrl(`/hunting/${region.slug}`)})`),
    "",
    "## Species seasons by province",
    "",
    ...pairs.map((pair) => `- [${pair.speciesName} season in ${pair.regionName}](${absoluteUrl(`/hunting/${pair.region}/${pair.species}`)})`),
    "",
    "## Species",
    "",
    `- [Species library](${absoluteUrl("/hunting/species")}): identification, habitat and field knowledge for North American game and lookalike species. A species profile never implies a season; seasons are answered per place and date by Hunt and the province pages.`,
    "",
  ];
  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
