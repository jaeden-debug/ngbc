# Manitoba — what the authority publishes, and what North Ground encodes

Last verified: 2026-09-21. Owner of this workstream: the Manitoba session.
Counts below are measured, not typed from memory; `npm run report:canada`
computes the live coverage figures from the bundle.

## 1. Legal standing and source hierarchy

Manitoba publishes its hunting seasons in the regulation itself, as structured
bilingual HTML on the King's Printer site. That is both the controlling source
and the most machine-readable one, so rules are built from it. Highest first:

| Tier | Source | Used for | Version read |
| --- | --- | --- | --- |
| Law | M.R. 165/91 Hunting Seasons and Bag Limits | every season, licence, equipment term and bag limit | in effect since 2026-06-16, last amended by M.R. 46/2026 |
| Law | M.R. 220/86 Hunting Areas and Zones | what a Game Hunting Area and a game bird hunting zone are | in effect since 2016-03-11 |
| Law | M.R. 351/87 General Hunting | legal hunting hours (s. 3), hunter orange (s. 10), landowner permission | in effect since 2025-12-12 |
| Law | M.R. 171/2001 Designation of Wildlife Lands | the Oak Hammock Waterfowl Control Area's legal description | in effect since 2023-01-20 |
| Summary | 2026 Manitoba Hunting Guide (PDF) | cross-check only; it says it "is neither a legal document nor a complete collection of wildlife regulations" | 2026 licence year |
| Explanatory | "Chronic Wasting Disease in Manitoba" page | the mandatory CWD sampling requirement | web page |
| GIS | GHA, CWD-zone, closed-lands and wildlife-lands layers | locating a point; indicative, the written law controls | see below |

Every source is hashed in `content/regulatory/ca-mb-2026.json`, registered by
migration (`20260921050100_register_manitoba_regulatory_sources.sql`), and
checked daily by `npm run check:regulatory-sources`. Its notes column records
which tier each is in.

## 2. Geometry: 62 Game Hunting Areas

- Service: Government of Manitoba `Manitoba_Game_Hunting_Areas/FeatureServer/0`
  (item `c30d7158…`). The data was last edited on 2024-05-30. Native CRS is
  EPSG:3857; EPSG:4326 is requested from the authority. Licensed under the
  Manitoba Open Data Licence. A second copy is embedded in the CWD map
  (`CWD_GHA/FeatureServer/1`); it is a derivative, with fewer vertices in
  32 areas, and is not used.
- The service has 63 polygon records: 62 designated areas plus one with no GHA
  value. The 62 designations are exactly the areas M.R. 220/86 s. 1 defines;
  there is no Area 37, and the builder refuses to run if the two sets ever
  differ. The blank record is Riding Mountain National Park, which the
  regulation draws GHAs 23 and 23A around. It is quarantined, with its bbox
  and vertex count recorded, and is never ingested or given an id.
- The official term is "Game Hunting Area (GHA)". It is never relabelled as a
  WMU. Canonical ids follow the form `management_zone:ca-mb-gha-23a`.
- Parity is certified with `scripts/certify-spatial-parity.mjs --jurisdiction
  ca-mb`: 201 points, 0 disagreements. The points are an interior point, an
  edge point and an across-the-edge point for each of the 62 areas; 4
  multipart components; 5 points outside Manitoba (Saskatchewan, North Dakota,
  Nunavut, Hudson Bay); 4 special points (Riding Mountain ×2, Churchill,
  Winnipeg); and 2 invalid coordinates. `src/lib/hunt/manitoba-spatial-parity.test.ts`
  replays the recorded result offline.

## 3. How the regulation is built

- **It is licence-centric.** Section 3 lets the holder of a licence hunt only
  the species, equipment and areas the regulation designates for that licence.
  **A place no row designates is therefore CLOSED, not UNKNOWN.** The bundle
  records this as `absence: { meaning: "CLOSED", section: "M.R. 165/91 s. 3" }`.
  It applies only to species North Ground has encoded: moose in Manitoba is
  UNKNOWN, never s. 3's CLOSED.
- **The hunting year is April 1 – March 31** (s. 1). Windows are anchored
  strictly inside it. The certified period runs from the consolidation's
  in-force date to the end of the licence year: 2026-06-16 to 2027-03-31.
  Outside it, nothing is answered about the season.
- **Grouse (Schedule A, parts A–C).** Seasons are stated per game bird hunting
  zone, not per GHA. M.R. 220/86 s. 1.1 defines the zones:
  - Zone 1 is north of 57°N, plus the part east of 94°W and north of 56°N.
  - The zone 2/3 line runs from the Saskatchewan boundary along the 53rd
    parallel, then along the east shore of Lake Winnipegosis, then along the
    north limit of Township 43.
  - Zone 3 is everything between zones 2 and 4.
  - Zone 4 is a list of GHAs (22–25B, 27–36, 38).
  Sharp-tailed grouse in GHAs 19, 19B, 22–24 and 27–33 has a lower limit:
  4, possession 8.
- **White-tailed deer (Schedule B, parts A–G)** turns on four things:
  - Licence: resident general, second and third; Canadian resident;
    non-Canadian general, archery and muzzleloader.
  - Equipment, in the regulation's own terms. "Archery" is a long, recurved
    or compound bow (s. 3.3). "All equipment" is rifle, shotgun, muzzleloader,
    crossbow or bow (s. 3.4). "Muzzleloader and Crossbow" and "Shotgun and
    Muzzleloader" are stated sets, never collapsed.
  - Age: footnote "Under age 18 only" marks the youth rows.
  - Area.
  Second and third licences require the licences before them (ss. 9(3),
  10(3)). Section 10.3 bars deer hunting during a moose season in GHAs 5–15A,
  or an elk season in GHAs 13 and 18, without the relevant draw licence.

The parser (`scripts/manitoba-source.mjs`) is strict. An unrecognised row,
footnote, equipment term, date phrase or area token stops the build. The
provisions a rule rests on are quoted verbatim, and a changed sentence also
stops it. A rebuild with unchanged sources is byte-identical.

## 4. Questions Hunt asks

| Dimension | Values | Source |
| --- | --- | --- |
| `RESIDENCY` | Manitoba resident, Canadian resident, non-Canadian resident | guide p. 7 (definitions) |
| `LICENCE_TYPE` | 10 licences; each implies its residency | M.R. 165/91 schedules |
| `HUNT_METHOD` | rifle, shotgun, muzzleloader, crossbow, bow | ss. 3.3, 3.4 |
| `HUNTER_AGE` | under 18, 18 or older | Schedule B footnote 1 |

A question is asked only when some answer to it changes the result on that day
at that place. Grouse asks nothing. A licence or draw is never assumed to be
held: the answer is stated as the hunter's own assumption, carried into the
Hunt Brief in the question's words, and marked as not verified.

## 5. Special geographies

| Geography | How it is resolved | Effect |
| --- | --- | --- |
| CFB Shilo | Closed-lands layer, OBJECTID 27 | excluded from the GBHZ 3 & 4 grouse seasons |
| Whiteshell Game Bird Refuge | Refuges layer, OBJECTID 61 | excluded from the GHA 26/36 deer rows; GHA 36 is a PARTIAL member |
| R.M. of Macdonald part of GHA 38 | Closed-lands layer, 2 features | the only part of GHA 38 with a deer season |
| Oak Hammock Waterfowl Control Area | **Unresolved**: defined in words only (M.R. 171/2001 s. 9(2)); no polygon exists | inside a proven envelope (the WMA's extent padded 0.15°), grouse answers NEEDS_VERIFICATION; outside it, unaffected |
| CWD mandatory surveillance zone | A set of 25 GHAs, on which the CWD page, the guide and the CWD layer all agree | deer requires sampling |
| Game bird hunting zones 2/3 | 52.70°N–53.05°N is an undetermined band | grouse is answered there only where both zones give the same answer |

When a layer cannot be read, a point inside a carve-out's proven extent answers
NEEDS_VERIFICATION. Elsewhere the answer stands and says the layers were not
read.

## 6. Published land restrictions, read live

Four layers are read at the point, cached for each point:
- lands closed to hunting (24 features);
- game bird refuges (71);
- special conservation areas (7);
- wildlife management areas (129).

At build time, each feature's restriction text is classified into species
tokens: `all`, `wildlife`, `upland_game_bird`, `big_game`, `firearm`,
`entry_closure_order` and so on. All 231 features are classified, and an
unclassified feature would affect every species.

A restriction that reaches the species turns a CONDITIONAL answer into
NEEDS_VERIFICATION and quotes the authority's text. A restriction naming only
other species leaves the answer alone. None of these layers is ever certified
as a closure.

## 7. The guide cross-check

The guide's deer tables were transcribed once
(`content/regulatory/sources/ca-mb-hunting-guide-2026-crosscheck.json`, bound
to the PDF's hash) and compared with every rule.
- **2 disputes:** GHA 7A under the non-Canadian archery and muzzleloader
  licences. The regulation reaches 7A only through the range "5-8", read in the
  regulation's own ordering of areas, and the guide omits it. Where that
  decides the answer, Hunt returns CONFLICT.
- **3 regulation-controls notes:** GHA 33 archery (×2) and 21A archery. The
  regulation's dates are used, and the difference is disclosed.

## 8. What is certified

For 2026-06-16 to 2027-03-31:

| Species | GHAs covered | Closed by s. 3 | Unknown | Rules | Asks |
| --- | --- | --- | --- | --- | --- |
| Ruffed grouse | 62 | 0 | 0 | 6 | no |
| Spruce grouse | 62 | 0 | 0 | 6 | no |
| Sharp-tailed grouse | 62 | 0 | 0 | 9 | no |
| White-tailed deer | 54 | 8 | 0 | 64 | yes |

85 rules in 24 groups, with 21 conditions. Every other species answers
UNKNOWN. See section 12.

## 9. Persistence

`node scripts/publish-regulations.mjs content/regulatory/ca-mb-2026.json`
writes the bundle to Supabase through the conditional-rule persistence:
- groups, with FULL or PARTIAL membership;
- rules, with `applies_when`, `season_windows`, `geography`, `disputes`,
  `notes` and whole `limits`;
- each rule's primary citation.
It then reads everything back and compares it column by column. On 2026-09-21
it published 24 groups, 329 memberships and 85 rules, and the round trip was
identical; a second run created nothing. Add `--verify` to compare without
writing. A copy of the bundle with a moved window, a dropped youth condition
and a changed membership fails with all three named.

## 10. Change detection and the drill

- Daily: `check:regulatory-sources` rebuilds from the live sources and exits 2
  when one has moved. The workflow then opens an issue.
- The report is `diffConditionalBundles`. It covers every field the engine
  evaluates, pairs a rule re-identified by an area change, diffs the
  conditions, and gives the **blast radius**: the areas where an answer can
  actually change.
- Drill:
  `node scripts/build-manitoba-regulations.mjs --check --save-sources <dir>`, then
  `node scripts/drill-manitoba-regulatory-change.mjs --base <dir>`. It runs
  offline against edited copies, and replayed sources can never be written
  as the bundle.

| Edit | Result |
| --- | --- |
| Deer archery date in GHAs 26/36 | exit 2: 1 rule, GHAs 26 and 36; the guide cross-check also notes the new divergence |
| GHA 36 removed from a deer row | exit 2: 4 rules, paired and re-identified; GHA 36 only |
| GHA 35 added to a row it already has a season in | exit 1: two seasons for one licence and equipment |
| GHA 21 moved into game bird zone 4 | exit 2: 18 grouse rules, GHA 21 only |
| GHA 8 removed from s. 10.3 | exit 2: 1 condition and 13 rules, GHA 8 only |
| s. 11(1) bag wording changed | exit 1: quoted provision no longer matches |
| Unknown equipment term | exit 1 |
| Guide republished | exit 2: cross-check must be redone |

## 11. Production certification

`node scripts/certify-hunt-cases.mjs --base https://www.northgroundbushcraft.com
--cases fixtures/hunt/ca-mb-certification-cases.json` runs 24 real places.
Every case's expectation was written from the law before it ran. All 24 agree
(`fixtures/hunt/ca-mb-production-certification.json`). One expectation was
itself wrong: Churchill is inside the Churchill Special Conservation Area, and
the correct answer there is NEEDS_VERIFICATION. The case keeps its original
expectation and the evidence.

Measured on production:
- Zone lookup: median 369 ms.
- Evaluation: median 237 ms, p90 about 3 s, from cold overlay reads.
- Evaluation payload: median 12 KB.
- Map geometry: all of Manitoba at zoom 5 is 86 features in 22 KB; Winnipeg
  at zoom 10 is 5 KB.

## 12. Not yet answered

- Every other species. The first to add is moose, which needs s. 10.3's moose
  seasons in any case; then elk, mule deer, black bear, caribou, wild turkey,
  wolf and coyote, ptarmigan and gray partridge. Migratory game birds wait on
  the federal layer.
- The Oak Hammock Waterfowl Control Area needs a polygon from its legal
  description, or an official one.
- The zone 2/3 band needs the shoreline and township line surveyed.
- Provincial parks are not a layer North Ground reads. Park-specific hunting
  rules are outside the certified result, and the answer says so.
- First Nation reserve land, and harvesting under Treaty or Aboriginal
  rights, are a separate legal context that is never evaluated.
