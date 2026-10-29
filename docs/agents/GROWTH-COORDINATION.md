# Growth lane ↔ Hunt lanes — coordination

> Shared, committed coordination record. Sessions in this repository cannot be
> assumed to reach each other directly (a cloud session receives messages but
> cannot reply), so ownership, hand-offs and open questions live here and in
> `docs/PROJECT-STATE.md`. Read `CLAUDE.md` and `docs/SEO-AEO-ROADMAP.md` first.

Last updated: 2026-10-29 (growth lane, branch `growth/foundation`).

## Lanes

| Lane | Owns |
| --- | --- |
| **Hunt / regulatory lanes** (existing agents) | Regulation ingestion and verification, season evaluation, zone logic, Ready to Hunt, anatomy, rate limiting, monitoring, and the SEO surfaces already shipped: `/hunting` hub, province pages `/hunting/[region]`, species × province pages `/hunting/[region]/[species]`, `/hunting/how-north-ground-verifies`, `llms.txt`, structured data, OG images. |
| **Growth lane** (this file's author) | Search-demand and competitive research, growth/SEO/AEO architecture documents, measurement framework, crawl/indexing health, distribution and outreach planning (no external sends without owner approval), and growth-only code in files no other lane owns. |

## Files

**Growth-owned (may edit freely):** `docs/growth/**`, `docs/agents/GROWTH-COORDINATION.md`, `src/app/robots.ts` and its test (crawl directives are growth's; changes are announced here).

**Hunt-owned (growth proposes, does not edit):** `src/app/hunting/**`, `src/app/hunt/**`, `src/app/llms.txt/**`, `src/components/hunt/**`, `src/lib/hunt/**`, `src/lib/seo/**`, `src/app/sitemap.ts`, `next.config.*`, content bundles under `content/`.

**Shared — claim here before editing:** `docs/PROJECT-STATE.md` (append-only, per section), `docs/SEO-AEO-ROADMAP.md`.

## Hand-offs to the Hunt lane

Each item names the evidence, so it can be acted on without this session.

1. **The map blames the authority for a failure that is North Ground's.** OPEN.
   `src/components/hunt/map/useZoneGeometry.ts` — when the browser's request
   to `/api/hunt/zones` *throws* (network error, refused fetch), the `catch`
   marks every layer without drawn zones as missing, and `notices` renders
   "*Government of Ontario*'s zone service is not answering". The authority's
   service was never asked. Reproduced 2026-10-29 on production by refusing
   only `www.northgroundbushcraft.com/api/`: 14 such notices, naming 11
   Canadian authorities, Idaho, Massachusetts and Louisiana. A fetch that never
   reached North Ground is not evidence about any government, so it needs its
   own sentence (for example "The map's zone data did not load. Try again.").
   The trigger crawlers hit is fixed in `robots.ts` (below); the misattribution
   remains for any user whose request fails.
2. **"WMU map" intent has no owner.** OPEN — needs a decision. Measured
   (Keyword Planner, Canada, 2026-10-29): `ontario wmu map` 3,600/mo (peak
   6,600, April), `alberta wmu map` 2,400 (peak 6,600, June), `carte zone de
   chasse` 590 (Québec, peak 2,400). The province pages mention "map" once and
   `/hunt` is titled "Hunting Zone & Season Finder". Proposal: the province page
   owns "[province] WMU map" (CLAUDE.md §27 assigns "Quebec hunting zones" to
   the jurisdiction/map resource), with a crawlable server-drawn image of the
   province's official zones and a link that opens Hunt framed on that
   province. That needs a Hunt URL state that frames a jurisdiction, which
   Hunt does not have today (`zone`, `species`, `date`, `explore` only).
3. **French.** OPEN — architecture is growth's, implementation is shared.
   No page is French and no page carries `hreflang`. 32 measured Québec French
   queries (24,900 searches/mo) have an English-only owner; see
   `docs/growth/KEYWORD-INTELLIGENCE.md`. Nothing should be built until the
   locale route contract is agreed, because it touches every Hunt-owned SEO
   route.

## Changes growth has landed that affect other lanes

- `robots.ts` now allows `/api/hunt/zones` (commit `f276f9ee` on
  `growth/foundation`). Reason and reproduction in the commit and in
  `docs/growth/NATIONAL-GROWTH-BASELINE.md` §2. If the zones endpoint moves,
  `src/app/robots.test.ts` fails, because it derives the path from
  `OVERVIEW_URL`.

## Open questions for the owner

- Search Console and Bing Webmaster access for `northgroundbushcraft.com`
  (no Zylx workspace and no analytics are attached; see baseline §4).
- Whether any analytics may be installed, and which (privacy rules: CLAUDE.md §49).
