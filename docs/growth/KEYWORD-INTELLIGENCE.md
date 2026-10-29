# Keyword intelligence

The database is `data/keyword-planner-2026-10-29.csv`: 102 queries, one row
each, with Google's average monthly searches, the advertiser competition index,
12 months of history, the peak month, North Ground's intent class and the URL
that owns the intent today.

## How to read it

- **Evidence.** Every volume is MEASURED (Google Keyword Planner via Zylx,
  retrieved 2026-10-29): 58 English queries for Canada and 44 French queries
  for Québec. Nothing is estimated. Planner merges close variants into head
  terms and rounds to buckets, so long-tail demand reads low.
- **Competition index is advertisers, not SEO difficulty.** A 0 does not mean an
  easy results page. No SEO difficulty is recorded because none was measured.
- **`north_ground_owner`** is a URL where a published page serves the intent,
  `PARTIAL` where only a broader page does, `GAP` where nothing does, and
  `GAP-FR` where only an English page does. It records *existence*, never
  *ranking*: without Search Console, rank is unknown (baseline §4).
- **Intent classes:** MAP_TOOL, ZONE_LOOKUP, SEASON, REGULATIONS, LICENCE,
  DRAW, ACCESS, LEGAL_HOURS, SPECIES_ENTITY. Assigned by rule
  (`map`/`carte` before `zone`, and so on), so a row can be wrong; correct the
  row, not the rule, when the SERP disagrees.

## What the data says

| Finding | Evidence (avg / peak per month) |
| --- | --- |
| Ontario dominates English demand. | `ontario hunting licence` 8,100 / 14,800; `outdoors card ontario` 9,900 / 18,100 (May); `ontario hunting regulations` 2,400 / 5,400; `deer season ontario` 1,900 / 6,600 |
| People ask for the map, not for "which zone am I in". | `ontario wmu map` 3,600 / 6,600 (Apr); `alberta wmu map` 2,400 / 6,600 (Jun); `hunting zones ontario` 480; `what hunting zone am i in` 50 / 140 |
| Québec searches in French, with its own words. | `zone de chasse` 1,000 / 3,600 vs `quebec hunting zones` 260 / 720; `chasse chevreuil` 1,300 / 5,400; `chasse perdrix` 480 / 1,600, while `chasse gélinotte` returned no volume |
| Licences and draws are a large unowned category. | `permis de chasse` 2,900 / 8,100 (Sep); `pal canada` 3,600; `ontario moose draw` 1,000 / 3,600 (Apr); `certificat du chasseur` 590 |
| Legal-hours queries are tiny. | `legal hunting hours ontario` 10 / 90; `heures légales de chasse` 10. The capability matters to hunters; it is not an acquisition channel. |
| Seasonality is not one peak. | Turkey and draws peak in April; Alberta's map in June; migratory permits and waterfowl in September; big game in October–November; `pal canada` in January. |

Coverage by measured volume: English intents with a page, 36 queries / 119,580
searches; English with none, 20 / 26,920; French served only in English, 32 /
24,900; French with none, 11 / 5,180.

## Vocabulary rules for copy (from the measured data)

- Québec deer is **chevreuil** in search, ruffed grouse is **perdrix**, the
  unit is **zone de chasse** and the map is **carte**. Authority terminology
  ("cerf de Virginie", "gélinotte huppée") stays the legal and identity term
  (CLAUDE.md §41A, §47); search vocabulary belongs in titles and headings
  beside it, never replacing it.
- Ontario's unit is **WMU**, and people search for its **map**.

## Not yet measured

Question-form long tail (Planner strips it; Google Autocomplete is the free
source), the U.S., Prince Edward Island and the territories, waterfowl by
province, and any SERP or ranking data.
