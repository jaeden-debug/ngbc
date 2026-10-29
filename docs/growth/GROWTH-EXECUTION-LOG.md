# Growth execution log

Newest first. What was done, how it was checked, and what is next.

## 2026-10-29 — Baseline, keyword data, and a crawler-rendering defect

**Done**
- Crawled all 560 sitemap URLs on production; recorded in
  `NATIONAL-GROWTH-BASELINE.md` §1.
- Found and reproduced the robots.txt → false "zone service is not answering"
  rendering (14 notices with `/api/` refused, 0 without); fixed in
  `src/app/robots.ts` (`f276f9ee`), test fails against the old file.
- Measured 102 queries (58 EN Canada, 44 FR Québec) with Keyword Planner;
  `data/keyword-planner-2026-10-29.csv`, read in `KEYWORD-INTELLIGENCE.md`.
- Opened `docs/agents/GROWTH-COORDINATION.md` with three hand-offs.

**Gate:** `npm test` exit 0, 2,515 / 2,515 pass, on `growth/foundation` off
`origin/main` `eed12b2f`.

**Deployed** as `759f7345` (owner approved), deployment `dpl_DguqzN6ijBGZSXR48yn1fkqa9yZS`; new robots.txt live ~80 s after push. **Production verified:** Playwright on `/hunt` refusing exactly what the live robots.txt disallows fetched `/api/hunt/zones`, refused nothing, drew the zones, and showed 0 notices (14 before the fix).

**Next, in order**
1. Owner: Search Console / Bing / analytics access (baseline §4).
2. SERP observation for the top 20 rows of the CSV (who ranks, whether a
   government page holds position 1), recorded as OBSERVED → `COMPETITIVE-LANDSCAPE.md`.
3. AI-answer citation test set (10 questions from the CSV's intents), run
   against the assistants available, recorded verbatim → `AI-DISCOVERY-STRATEGY.md`.
4. French locale contract proposal → `FRENCH-SEO-STRATEGY.md`, for agreement
   with the Hunt lane before any route exists.
