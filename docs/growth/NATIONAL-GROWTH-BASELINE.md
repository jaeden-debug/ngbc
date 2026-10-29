# National growth baseline

Measured 2026-10-29 against production (`https://www.northgroundbushcraft.com`,
`origin/main` at `eed12b2f`). Every number below was measured in this pass
unless labelled otherwise. The SEO/AEO plan of record remains
`docs/SEO-AEO-ROADMAP.md`; this file is the measured starting point it lacked.

## 1. What exists

The sitemap lists **560 URLs**, all returning 200 to a Googlebot user agent:

| Family | URLs | Server p50 / p90 | HTML p50 | Visible words p50 (min) | JSON-LD |
| --- | --- | --- | --- | --- | --- |
| `/` | 1 | 35 ms | 25 KB | 155 | Organization, WebSite |
| `/hunting` | 1 | 39 ms | 48 KB | 421 | + CollectionPage, BreadcrumbList |
| `/hunting/[region]` + verification page | 10 | 129 / 163 ms | 61 KB | 956 (705) | WebPage, FAQPage, BreadcrumbList |
| `/hunting/[region]/[species]` | 61 | 126 / 181 ms | 69 KB | 1,105 (604) | WebPage, FAQPage, BreadcrumbList |
| `/hunting/species` | 1 | 2,630 ms | **1,307 KB** | 7,422 | CollectionPage |
| `/hunting/species/[species]` | 485 | 324 / 774 ms | 61 KB | 747 (419) | Article (+ FAQPage) |
| `/hunt` | 1 | 2,677 ms | 508 KB | 743 | WebApplication |

Province pages exist for 9 provinces (no Prince Edward Island, Yukon or U.S.
pages). Species × province pages: SK 13, NB 11, QC 10, ON 8, BC 7, AB 4, MB 4,
NL 3, NS 1.

Clean, and verified rather than assumed: 0 duplicate titles, 0 duplicate
descriptions, every page self-canonical, exactly one H1 everywhere, no
`noindex` in the sitemap, no sitemap page without an inbound link from another
sitemap page, and no internal link to a page missing from the sitemap.
`robots.txt`, `sitemap.xml` and `llms.txt` answer 200 on `www`; the apex
answers 308 to `www` (a client that does not follow redirects reports the
files as missing — they are not). GPTBot, ClaudeBot, PerplexityBot,
OAI-SearchBot, CCBot and Bingbot user agents all receive 200.

## 2. Defect found and fixed: crawlers rendered Hunt as a government outage

**What a renderer saw.** `robots.txt` disallowed all of `/api/`, including
`/api/hunt/zones`, the geometry Hunt's opening map requests. A renderer that
obeys robots.txt (Googlebot's does) is refused that request; the map's fetch
throws, and `useZoneGeometry` reports every authority as down.

**Reproduction.** Playwright on production `/hunt`, 1280×900, 12 s settle:

| Condition | "…zone service is not answering" notices |
| --- | --- |
| Normal | 0 |
| Only `www.northgroundbushcraft.com/api/*` refused | **14** — Ontario, Manitoba, Alberta, Québec, BC, NL, NB, PEI, NS, Yukon, Saskatchewan, Idaho, Massachusetts, Louisiana |

The server HTML is identical for a browser and a Googlebot user agent and
contains no error text; the notices are client-rendered. So the defect is in
what Google's *rendered* copy contains, which matches the publicly crawled copy
the owner reported. Search Console's URL Inspection would confirm the rendered
copy directly; it is not available to this lane (§4).

**Fix.** `robots.ts` allows exactly `/api/hunt/zones`
(`f276f9ee`). That response is public, generalised boundary data already
cached at the edge (`s-maxage=21600`). `src/app/robots.test.ts` derives the
path from `OVERVIEW_URL` and fails against the previous file (checked).

**Not fixed here (Hunt-owned).** The same notice appears for any real user
whose request fails, and it names a government that was never asked. Handed
off in `docs/agents/GROWTH-COORDINATION.md` §1.

## 3. Problems, ranked by consequence

1. **No measurement exists.** No Search Console, GA4, Vercel Web Analytics
   (`404 Web Analytics not found` for project `ngbc`), Bing Webmaster or any
   analytics script. No verification meta tag in the HTML (DNS verification is
   possible and unknown). Clicks, impressions, rankings, indexed counts and AI
   referrals cannot be stated. Every "owned" intent in the keyword file means
   *a page exists*, never *it ranks*.
2. **French does not exist.** 0 French pages, 0 `hreflang`. Measured Québec
   French demand that has an English-only owner: 24,900 searches/mo across 32
   queries; 5,180/mo more with no owner at all (§5).
3. **The largest tool-shaped queries have no owner.** "ontario wmu map",
   "alberta wmu map", "crown land map ontario" (3,600 / 2,400 / 3,600 per month,
   peaks 6,600 / 6,600 / 4,400). Crown land has no product surface at all
   (Ontario's Crown land service is LICENCE_PENDING in PROJECT-STATE).
4. **Licence and requirement queries have no owner**: "outdoors card ontario"
   9,900, "ontario hunting licence" 8,100, "pal canada" 3,600, "permis de
   chasse" 2,900, "ontario moose draw" 1,000. Ready to Hunt holds some of this
   knowledge inside the app; none of it is a crawlable page.
5. **Weight.** `/hunting/species` ships 1.3 MB of HTML in 2.6 s and `/hunt`
   508 KB in 2.7 s from the server. Species p90 is 774 ms. Not a ranking
   emergency; worth a budget.
6. **Titles run long.** 514 of 560 titles exceed 60 characters (the
   " | North Ground" suffix alone is 15). Google rewrites or truncates these;
   impact cannot be measured until Search Console exists, so this is an
   experiment, not a fix.

## 4. Blocked on the owner

- **Search Console + Bing Webmaster** for `northgroundbushcraft.com`, attached
  to Zylx (no Zylx workspace exists for North Ground; the six workspaces are
  other businesses) or shared with this lane. Without it, §3.6, indexing,
  ranking and CTR work are guesses.
- **An analytics decision** consistent with CLAUDE.md §49 (no precise
  coordinates; coarse geography). Vercel Web Analytics is the smallest step:
  the site is already hosted there; it needs enabling on the project plus the
  `@vercel/analytics` component.

## 5. Opportunities, ordered

Ordering weighs measured demand, data readiness, regulatory risk and whether it
creates reusable infrastructure. Volumes: `docs/growth/data/keyword-planner-2026-10-29.csv`.

1. **Measurement** (§4). Unblocks every later decision; zero regulatory risk.
2. **Province "WMU map" ownership** — a crawlable picture of each province's
   official zones on its existing page plus a framed Hunt link. Demand is
   measured, the geometry is already certified and drawn, and it is the
   decision-intent wedge CLAUDE.md §31 names. Needs a Hunt URL state that
   frames a jurisdiction (hand-off §2).
3. **French Québec**: locale contract first (routes, `hreflang`, which facts
   are authority French vs North Ground translation per CLAUDE.md §41A), then
   `/fr/chasse/quebec`-style pages over the same certified data. Peak months are
   September–October, so the window for 2027 opens next summer.
4. **Requirements pages** for licence/card/draw queries, sourced and dated,
   reusing Ready to Hunt's structured facts rather than new prose (CLAUDE.md
   §14, §24). Ontario first: 9,900 + 8,100 + 1,000 + 590 per month.
5. **Seasonal calendar**: Ontario turkey and the draws peak in April, Alberta's
   WMU map in June, waterfowl and permits in September. Pages need 8–16 weeks to
   mature (memory: beachhead research), so spring pages are due in January.

## 6. Not yet done in this lane

Competitive SERP analysis, AI-answer citation testing, backlink research, and
distribution planning have not been performed. Ahrefs and Semrush returned no
data on this account when last checked (2026-09-20: no plan / no API units; not
re-checked in this pass), so backlink and difficulty figures may need another
source or remain unknown. These are listed as next work in
`GROWTH-EXECUTION-LOG.md`, not written up as findings.
