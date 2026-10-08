# North Ground — Project State

> Living operational state.
> Read `../CLAUDE.md` first.
> Update this file after material project changes.

Last updated: 2026-10-08 (**CI HAS BEEN RED ON MAIN SINCE ~02:00 AND EVERY LOCAL GATE WAS BLIND TO IT. Four tests, one file, unrelated to any of this lane's work — and the one suite built to detect timezone-data drift is the one that cannot see it from macOS.** `observed-clock.test.ts`: the GitHub runner's tzdata has absorbed Manitoba's permanent-DST legislation and our hosts have not, so the tests fire exactly as designed, reporting that an override has become redundant. `# fail 4` in that suite and `# fail 0` in the other five, on every commit tonight including nine of mine. **PRODUCTION WAS MEASURED RATHER THAN INFERRED and is correct**: POST /api/hunt/evaluate, Winnipeg, white-tailed deer, 2026-11-20 returns 08:21–18:07 — the legal window, not the hour-early 07:21–17:07 that was live in September. **And production is unobservable on this question by the override's own design**: it matches `date >= 2026-11-01` with no end and substitutes the zone absolutely, so every date on which stale and corrected tzdata differ is a date it covers; 31 October is −05:00 under both. Three environments, local stale, runner corrected, production correct-but-silent. A SEPARATE DEFECT found in the same area and not touched: production's provenance sentence asserts “the platform's own timezone data does not yet carry this” unconditionally — `tzdataAgrees` exists for exactly that check and only the tests call it. Fixing the sentence would NOT turn CI green; they are two repairs and only one is urgent. **The gate is now local fail-lines AND the CI conclusion, both quoted, with a disagreement reported as the finding.** **JURISDICTION WORK: 49 → 43.** Michigan's BASE − SUBUNIT + EXCEPTION primitive (its Order states NO precedence anywhere in 183 pages, so the overlaps are real and a point in several units returns CONFLICT naming all of them — correcting my own inverted explanation); Kentucky's four deer zones from all 120 counties, where which VERSION is in force was settled from `<ins data-added>` versus `<del data-removed>` because both candidate lists partitioned the state exactly and a summarising fetch picked the deleted one; Illinois, Utah and Iowa read exhaustively, each with something in its zone field that is not a zone. **A RUNG NOBODY WAS TESTING**: dropping the division from the serialised wire body fails six of eight new end-to-end tests and only one of nineteen placement tests — five of six jurisdictions had no coverage of that step while all six were reported as resolving. **Vermont's elided endpoint recovered** by walking the REST directory (the FOLDER was elided, not an org id) and the recorded layer number was wrong too: the WMUs are layer 25, not 164. Its service IGNORES inSR and returns zero with no error — the fifth misleading zero of the day, each from a different instrument — and the live-parity certifier was checked and WOULD catch it, so no defect was reported there. **Deliverable coverage is unchanged at 11 of 64 with ten jurisdictions now resolving a point and holding no certified rules: the bottleneck has moved from geography to rules.** Kentucky's complete deer model is extracted as the first input, and is blocked on one architectural question raised rather than changed — a ConditionalBundle's geography takes ghas/gbhz/special/jurisdiction and a composed unit is none of those.)

Previously: 2026-10-08, later (**Species Heat 2.5.0 — GAP range maps are read sub-watershed by sub-watershed against the national HUC12 layer: 187 imported, 1 refused (was 161 and 27).** Production verification of 2.5.0 is in *Validation*.)

Previously: 2026-10-07, late night 3 (**Three jurisdictions' zone fields read properly, and in each one the field carries something that is not a zone.** Illinois, Utah and Iowa were the three blocked on modelling rather than on licence or access, and all three are now measured exhaustively and split. **Illinois**: 15 features, 11 zone identities and 4 statements about hunting — including “Open to Fall Firearm Turkey Hunting”, so the authority OPENS ground in the same field it closes other ground in. Fall Firearm Turkey has no named zone at all, which is §41A's OPEN_ONLY_IF_LISTED in its purest form, and a restrict-only mechanism would have withheld a season the authority granted. The Hunt lane's `AreaEffect` (107751dc) is consumed, not reinvented. **Utah**: my earlier finding was wrong in a useful direction — the model is IN the service and the authority documents it (“Many hunts can occur on each boundary (hunt_number is the key)”), so a point in 25 boundaries is the design rather than a defect: WHICH HUNT selects the boundary, not the geometry. What is missing is the CODE BOOK for 29 hunt-number prefixes, which no field domain, table description or relationship in the service provides, and which §8 forbids guessing from DB/EA/EB/BR. SEASON is HTML display prose. **Iowa**: the hunter class is the authority's own field ALIAS — “Non-Resident Deer Zone”, “Resident Fall Turkey Zone” — not our reading of an abbreviation, and turkey is published twice with different geography in a shared numbering space. All seven columns are blocked for three recorded reasons, and **the column my own record called “cleanly servable” is not**: two of 86 Waterfowl rows read “N” and “S” where 79 spell it out, which would mint zones of our invention. **MISSOURI'S CONTROL COULD NOT FAIL and was corrected**: I reported 114 county equivalents against the rule's 114 names, a perfect match — produced because my dict was keyed by the Bureau's BASENAME and St. Louis County and St. Louis city share it, so two rows collapsed into one. The Bureau returns 115. Swept the blast radius: Virginia has four such pairs (Fairfax, Franklin, Richmond, Roanoke) and survived only because that count used returnCountOnly. Three structural fixes — `byKind` must sum to `expected`, `ambiguousNames` is required wherever a jurisdiction has more than one kind of division, and `unaccountedFor` carries each left-over division with a disposition, St. Louis city being NOT_ESTABLISHED. **CO/MT/WY measured to the Massachusetts standard and all three were misclassified**: none is silence. Colorado's and Wyoming's item licenceInfo are warranty and indemnity paragraphs saying nothing about use, so `TERMS_SILENT_ON_USE` was added — permitting nothing, since §44 turns on an absence and the search found terms, which makes serving them the owner's call. Montana is a third finding: its section 4 GRANTS “view, copy, or distribute … for personal or informational use … if the documents are not modified in any respect”, two conditions our use does not obviously satisfy, so it stays UNRESOLVED. Found only by sweeping the full terms for eight words and reading the two ‘copyright’ hits. **North Carolina declined**: the family is established from the authority's words but the county list exists only in a redline whose insertions and deletions the extraction cannot tell apart — a list read from it would name real counties and be the wrong set, and nothing downstream would catch it. Indiana's county limits are published only as a GIF; Indiana's and Ohio's code sites time out at the connection. Four states now need one thing: an allowed route to adopted administrative-code text. Nine fast-forward pushes, no force; counter unchanged at 44, deliverable 11 of 64.)

Previously: 2026-10-07, late night 2 (**Four jurisdictions answer their geographic question without a polygon, and the coverage matrix can finally tell a measured dead end from one nobody examined. 49 → 45.** Two primitives over one resolver: **DIVISION_IS_THE_UNIT** (Virginia's locality, West Virginia's county — WV publishes no units at all) and **COMPOSED_UNIT** (South Carolina's Game Zones 2–4, Georgia's three bear zones), both reading the Census county boundary, which is what these authorities legislate in. **South Carolina is §8 running both directions in one jurisdiction**: all 43 counties the three zones name verified against the Bureau's 46 before encoding — none missing, none duplicated — and the remainder fell out as exactly Greenville, Oconee and Pickens, the three Zone 1's railway traverse crosses. Those three are answered as reached by an unresolved zone rather than handed Zone 2. **Georgia needed a state the schema lacked**: its own bear page omits Walton from the 38 northern-zone counties while its own zone map labels Walton, and Rule 391-4-2-.22's body was refused with HTTP 403, so MEMBERSHIP_IN_CONFLICT is its own state and Walton gets neither answer. Georgia's tests also refused its accounting, correctly: my invariant assumed units PARTITION a jurisdiction, true of SC's game zones and false of bear zones covering 50 of 159 counties, so the accounting now declares PARTITION or SUBSET_OF_JURISDICTION. **Alabama's definition is read and rules out county composition** — Zone A's line runs along US Hwy. 80 through the middle of Sumter and Dallas Counties — and one instrument exercises nine families, so the families are confirmed by an authority's text rather than invented; its season table is 2024–25, so nothing in it is current. **THE MATRIX DEFECT IS FIXED**: 44 of 51 rows read UNSUPPORTED with nothing separating Alabama's measured absence from an unexamined state. Each row now carries strategy plus a four-rung enquiry state derived from the repository — 8 ANSWERING, 5 MEASURED_AND_HELD with dispositions named, 38 LICENCE_MEASURED, 0 NOT_EXAMINED. My first ladder **overstated our own ignorance**, putting Colorado, Montana and Wyoming at NOT_EXAMINED because the licence register holds 47 of 51; all three carry a non-serving layer whose licence records the publisher's words, Montana's a full paragraph. **Connecticut's provenance hold is WITHDRAWN**: I inferred from item metadata (owner `karenz`, no orgId) that the service was not CT DEEP's own, and it is — hosting org FjPcSmEFuDYlIdKC resolves to "Department of Energy & Environmental Protection", urlKey CTDEEP — with Maine's named-individual-owned layer the counterexample inside my own corpus. Re-based on SCOPE: the layer governs private-land reporting zones while state land is DEEP's lottery system, so Connecticut needs land status as a dimension. **Deliverable coverage is still 11 of 64** and the geography-without-rules group is now eight; CO/MT/WY remain the reverse and the cheapest real coverage. Four of my own checks were found vacuous by mutation this stretch — a proximity assertion built from the constant it checked, a FIPS guard reading the county row's own state on both sides, a composed-unit lookup order with no instance that could distinguish it, and a carve-out honesty check that had become a spell-checker (the state is now a field, §8: a fact that lives only in a display string is not resolved). One reported "did not fire" was a mutation that silently changed no bytes. The git rule is the owner's: fast-forward only, six pushes, no force.)

Previously: 2026-10-08 (**Species Heat 2.4.0 — ranges keep to their own statements, take an authority's map where nobody records, and none is range-only; production 1,558 / 1,558 at 390, 1280 and 1920 px, Hunt app 425 / 425, FULLY_PRODUCTION_REACHABLE 230 / 230.** Stray geography by the statement's own states and provinces (Census + NRCan boundaries); USGS GAP range maps for 161 species where the group is barely recorded; 23 edges that followed recording → 15, all northern; T6 6 → 0. See *2026-10-08 — Ranges keep to their own statements*.)

Previously: 2026-10-07, late night (**The county resolver, and Virginia is the first jurisdiction whose legal unit is an administrative division: 49 → 48 with no product strategy.** In ten states the county IS the legal hunting unit by the authority's own words — Texas indexes "Seasons by County", Ohio's own field is `County_Bag_Limit`, Virginia's unit is a LOCALITY, a county or an independent city — so there is nothing for a wildlife agency to draw and Texas's and Indiana's RESTRICTED GIS licences stop nothing. `county-boundary.ts` asks TIGERweb layer 1, public domain under 17 U.S.C. § 105, read per point and never stored. Richmond city (51760) resolves distinctly from Henrico County (51087); parishes and boroughs answer as themselves; Paris and the Gulf of Mexico return a genuine nothing. **Connecticut must NOT go on this resolver**: it abolished county government, so the Bureau answers a Hartford point with "Capitol Planning Region", which is not a town and is not Connecticut's legal geography. Virginia is declared on 4VAC15-90-10(A)'s own sentence (eff. 1 September 2025), with the three dimensions that sit ON TOP of the locality recorded rather than flattened — land class, legal animal class, and the Dismal Swamp Line splitting Suffolk, which is geography narrower than the locality and stays unresolved. The division lives INSIDE `JurisdictionScope` because it is one cartographic placement, so statewide rules still compose and the wire gains a field rather than an outcome. **A STRATEGY IS NOT COVERAGE**: the deliverable figure is **11 of 64** (strategy AND certified rules), not 15 — Virginia joins PEI, Yukon, Massachusetts and Louisiana in the five that can place a point and have nothing yet to say, while Colorado, Montana and Wyoming are the reverse: certified rules no hunter can receive for want of geography. **ALABAMA'S DEFINITION IS READ AND IT RULES OUT COUNTY COMPOSITION**: r. 220-2-.01 defines Zones A–E by linear traverse, and the Zone A line runs along US Hwy. 80 through the middle of Sumter and Dallas Counties, so composing from whole counties would be fabrication — third-party summaries already make that error. One instrument exercises nine families (closed traverse, side-of-line, county ∩ traverse, multi-part, county composition, hierarchy, carve-out, species-specific, jurisdiction-wide), so the families are confirmed by an authority's text rather than by invention; its season table is 2024–25, so nothing in it is encoded as current. **A FINDING OF MINE WITHDRAWN**: Connecticut was held on PROVENANCE because I inferred from item metadata (owner `karenz`, no orgId) that the service was not CT DEEP's own. It is — the service's hosting org `FjPcSmEFuDYlIdKC` resolves to "Department of Energy & Environmental Protection", urlKey CTDEEP — and my own corpus held the counterexample, Maine's layer being owned by a named individual and treated as MDIFW's. Re-based on SCOPE, which is better founded: the layer governs private-land reporting zones while state land is DEEP's hunting-area and lottery system, so Connecticut needs land status as a dimension, not a better polygon. **THE REWRITTEN TIP REACHED PRODUCTION.** `a9d79671` — the force-pushed tip missing all three of the other lane's commits — was READY for about five minutes before `d18e7500` superseded it. Nothing regulatory was wrong in that build and the three commits were domain types and docs, so no hunter could have received a wrong answer; production nonetheless briefly served a build from rewritten history, and that belongs in the record next to the recovery rather than being left out because it turned out harmless. The git rule is now the owner's: **fast-forward push only**, no `--force`, no `--force-with-lease`, no rewriting shared main — strictly safer, and a push rebased onto current main needs no force at all. Repository integrity verified upstream by the moderator lane: 6477ddf9, db41a21b, d18e7500 and 02a06190 all ancestors of origin/main, `git cherry` against the pre-incident reflog tip returning exactly the three restored, and exactly ONE non-fast-forward across 40 origin/main reflog transitions — one incident, not the visible instance of a recurring one. Sensitivity runs found defects in my own tests twice: the county proximity assertion was built from the constant it checked, so changing the margin left it green, and the division's cross-state FIPS check compared the Bureau's answer with itself. Both now fail when mutated, as do all five mutations of the Virginia wiring.)

Previously: 2026-10-07, night (**A legal rule's geography is not always a polygon — owner direction change, now in CLAUDE.md §41B, with a machine check over all 64 in-scope jurisdictions.** Six strategies: AUTHORITY_GEOMETRY, ADMINISTRATIVE_COMPOSITION, DERIVED_FROM_DEFINITION, NON_POLYGON_RESOLVER, JURISDICTION_WIDE, NOT_APPLICABLE. Source status and product capability are now separate fields. Measured: **13 authority-geometry, 2 jurisdiction-wide, 49 with no product strategy** — asserted so it can only move deliberately, and falsified by removing one strategy (49→50, two tests fail). PEI is COMPLETE as JURISDICTION_WIDE because it publishes no hunting units, derived from `geographyLevel` rather than from the bare fact that a layer serves. **MICHIGAN'S CONTROLLING INSTRUMENT IS READ**: the consolidated Wildlife Conservation Order repeals ss. 12.483, 12.484 and 3.124 — DMUs 351 and 352 — **effective 2026-05-24**, so the minutes were right, the effective date that was UNKNOWN is known, and MDNR's GIS (edited 2026-09-21) is stale. Michigan's layer was then **built and withdrawn**: 302 of 624 points fall in >1 unit because the Order defines units as mutually exclusive by carve-out and the drawing does not implement the carve-outs — strategy is DERIVED_FROM_DEFINITION. Louisiana live and production-verified (10 Deer Management Areas, species-scoped). Alabama publishes no season geography at all. Utah: a point falls in 25 boundaries. Iowa encodes hunter class in its field names; Illinois puts legal closures where a zone id goes. **A force-push of mine dropped three commits from another lane; detected, restored as 6477ddf9/db41a21b/d18e7500, and the lane notified.**)

Previously: 2026-10-07, later (**Louisiana is the second U.S. state live and the first species-scoped layer; Alabama publishes no season geography at all; ten elided service URLs found and guarded.** LA: 10 Deer Management Areas read live, 45 parity points, 0 disagreements, production Alexandria/Monroe/Shreveport→Area 2, New Orleans→Area 9, Beaumont TX→UNSUPPORTED. It is scoped to deer via `speciesScope`+`drawnByDefault` because ONE service carries seven species geographies (Alligator, Dove, Goose, Deer, Waterfowl, Turkey) and an unscoped layer would draw deer areas under a turkey question. **AL moved off the licence-blocked list for a reason that is not licence**: enumerating ADCNR's own server (47 root services, 9 in SWAP) found no season zone, its recorded service has one layer of properties, and ArcGIS Online returns zero for three phrasings — against a positive control of 176 "deer season zone" hits elsewhere. **Ten of 47 findings recorded a service URL elided to `...`**; four recovered and verified, six with stated reasons, and `service-url.test.ts` pins the set by membership. Recovering West Virginia's surfaced a private council of governments serving TEXAS Parks and Wildlife data under WV's service name — a title match is not a publisher match. **Michigan's own map contradicts its own minutes**: MDNR still publishes DMUs 351/352, tagged Year 2026 and last edited 2026-09-21, four months after the vote to rescind them; UNAVAILABLE stands and the open task is now one dated question for MDNR. US map lane: 2 SERVED → **3 SERVED**.)

Previously: 2026-10-07 (**Silence blocks copying, not reading — Massachusetts is the first U.S. state live under the owner's 2026-10-06 decision, and it is production verified.** `LIVE_READ_NO_STATED_TERMS` in `source-licence.ts`: `licencePermitsServing` accepts it, `licencePermitsStoredCopy` refuses it STRUCTURALLY rather than by reading `redistribution`, because terms nobody stated cannot have granted anything. CLAUDE.md §44 narrowed accordingly. No adapter was built — `arcgis-zone-source.ts` and `certify-live-zone-layer.mjs` already were the canonical live path — so this extended it. MA: 15 Wildlife Management Zones read live, nothing stored, 103 parity points, 0 disagreements, 7 outside points correctly resolving to no zone. Production POST `/api/hunt/zone`: Quabbin→6, Boston→10, Nantucket→14, with Saskatoon→SWMZ and Boise→38 still right and Providence RI→UNKNOWN. **All eight silent-terms states were verified individually and SEVEN ARE NOT SERVED** — CT on PROVENANCE (a personal ArcGIS account claiming CT DEEP's attribution), MS on an incomplete TLS chain that is ours to fix, AL/LA on the registry naming the wrong layer, IA/IL/UT on geography modelling. Each recorded in `us-map-licence-findings.json.liveReadDisposition`. US map lane now 37 LICENCE_BLOCKED / 9 LICENCE_CLEAR_NOT_INGESTED / 2 TRANSPORT_BLOCKED / 2 SERVED / 1 UNAVAILABLE.)

Previously: 2026-10-07 (**Every heat-eligible species has a map, and all 230 are production verified.** Seven species left heat on authority evidence (red deer, Himalayan tahr, red-legged and rock partridge, helmeted guineafowl, Indian peafowl → LIMITED_TAKE; feral ferret → NON_QUARRY), red deer's profile — which described elk — was rewritten, and eleven ranges now keep to their published geography. The maps reach Attu across 180°. A layer whose map lies outside the visible view now says so and offers Show where. Range-habitat methodology 2.3.0 draws the emperor goose at Adak. Production certification of `a8fb344`: 1,502 / 1,502 checks, FULLY_PRODUCTION_REACHABLE 230 / 230. See *2026-10-06 — Every heat-eligible species has a working map*.)

Previously: 2026-10-06 (**White-tailed Deer now has the reusable visual field-guide reference system; catalogue-wide rollout remains blocked on owner review.** Five data-driven explorers integrate 12 of the 17 supplied originals through 17 optimized WebP renditions. Five originals are deliberately withheld because they contain a false claim, conflict with the page's shot guidance, or require anatomical review. See *White-tailed Deer authority page reference implementation (2026-10-06)*.)

Previously: 2026-10-01, evening (**Species images: 269 of 485 species show a photograph whose identity is established; 216 keep the placeholder, each with a recorded reason.** 180 administrator images (36 now credited to their Unsplash photographer, 10 wrong-species images retired on the owner's instruction and replaced) and 89 hotlinked, credited Unsplash images. Placed this session through the ordinary upload pipeline: 53 Adobe Stock images (36 owner-approved Standard licences, now used up, plus 17 free assets) and 28 files the owner put in `public/`. Resume point: `content/species-media/image-manifest.json`. Regulatory data untouched.)

Previously: 2026-10-01 (**Saskatchewan answers — 149 rules over 13 species, from geometry North Ground stores no copy of.** `coreGameComplete` 8 → **9 of 11**; 595 → **744 certified rules**, 19 → **25 species** — Saskatchewan alone brought American bison, elk, gray partridge, gray wolf, mule deer and pronghorn, none of which any other Canadian bundle held. Jurisdictions drawn with no rules: 3 → **2** (Prince Edward Island, Yukon), both blocked on reaching the authority's own instrument rather than on encoding it. Saskatchewan writes every season for a named licence class, so a resolved zone ASKS which licence before stating a status — and its 40 method envelopes NEST, because the regulation's "by any means other than a bow and arrow, crossbow, muzzle-loading firearm or shotgun" PERMITS those four rather than excluding them: a heading-driven build would have closed two weeks of October to every bow hunter in the province. Two corrections to my own work landed with it: `crossesYear` was undeclared on `ConditionalWindow` and the engine derived it as `closesIso < opensIso`, false for all 31 windows that genuinely cross; and Saskatchewan's limitation still asserted a Lloydminster time exception that ended when Alberta went to UTC−6 year-round in November 2026. See *Saskatchewan answers (2026-10-01)*.)

Previously: 2026-09-30, night (**Every Hunt-eligible species has a map, or a named reason it cannot.** The universe is live — 237 species from the catalogue and canonical take eligibility — and all 237 are covered: 218 with a served surface (72 survey, 141 range + habitat as their best tier, 5 range only) and 19 with no defensible range, each named. The occurrence reads were found to be 1.40625° cells taken for 0.35° squares and were re-read at 0.35°; four range rules were added after looking at the maps, each recorded as such. Production browser certification of every species is the step still open. See *Every Hunt-eligible species has a map (2026-09-30)*.)

Previously: 2026-09-30, evening (**All 54 survey surfaces are PRODUCTION VERIFIED, and Alberta's measured densities reach the unit card.** A real-browser certification of production from a GitHub runner passed 208/208 on phone and desktop: every surface drawn from its link with detected ground on the ramp; Maniwaki resolving to Zone 10 West under green-to-orange grouse; a tapped `!` naming the same conditions as its card. Alberta's aerial surveys now give 187 unit figures in animals per km² for moose and both deer, each cited to its own report and dated by its own survey; one report that contradicts itself is shown both ways. See *Production verified, and Alberta's measured densities reach the unit card*.)

Previously: 2026-09-30, later (**`!` now means a material condition, the survey surfaces are ranked, and every species has a stated spatial strategy.** A `!` appears on 396 of 2,993 open zone-species pairs instead of 2,682, decided by declared condition kind and scope. The zone card leads with those conditions, using the same ids as the popover. All 54 survey surfaces are rebuilt on methodology 2.0.0: colour is rank among detected ground, and surveyed-none is its own neutral, so Maniwaki reads green to yellow for ruffed grouse. `docs/species-spatial-coverage.md` states A–E for all 133 species. See *`!` means a material condition; surfaces are ranked; every species states where it is*.)

Previously: 2026-09-30 (**Species Heat is drawn in production Hunt.** The species surface existed in the tree, was certified and was SERVED, and no Hunt client requested it — production at `23ed04d` drew ruffed grouse as a zone choropleth from `/api/hunt/opportunity/heat`. The `heat-legible` renderer was recovered from GitHub, integrated onto main with the client gaps closed, reviewed adversarially, and deployed as `1059d02` (Vercel `dpl_AUoMqG7AacPZUWJ3CjRHXwpkuu2p`). In the real production Hunt, choosing Ruffed grouse requests `/api/hunt/species-surface`, receives the BBS raster and paints it under the zones: **RENDERED and PRODUCTION VERIFIED**, 30/30 browser checks on phone and desktop, and all 25 certified BBS surfaces rendered from their shareable links. See *Species Heat: the surface reaches the hunter (2026-09-30)*.)

Previously: 2026-09-29 (**The mobile composer keeps its place; the keyboard only takes viewport away.** Reported from an iPhone and reproduced: tapping Search anywhere sent the search field down onto the keyboard's edge. The cause was two CSS `order` declarations under `[data-composer="open"]` that drew the field last — a deliberate messaging-composer model the owner has now decided against, so §41A is amended. Both are gone and document order is visual order; no offset, unit or second keyboard detector was added. Certifying that fix exposed a second real defect in the same lane: the sheet's height mixed a viewport-relative header rect with a shell-relative band height, charging a scrolled keyboard to the sheet twice — and, because the inset in the DOM is a state behind, the error outlived the keyboard and left the sheet 48px short after dismissal. `headerBottomInBand` now takes the inset off both sides. The control bar above the keyboard is Safari's own AutoFill bar, not North Ground's; the half we control was checked and is clean.)

Previously: 2026-09-29 (**The heat measures the animals, not the hunters.** The species layer averaged every normalized series a bundle carried, and two of British Columbia's five are HUNTER COUNT and HUNTER DAYS — so two fifths of what the map drew as *where to look for an animal* was a measure of how many people went hunting there. `opportunity-v2` declares a ROLE per metric: only evidence about the animals may move the shade, effort is carried and shown and marked `contributesToIntensity: false`, and the applied weights travel in every result. Measured across all 1,297 zone-species pairs: **540 (41.6%) change band**, the largest single movement 165 MODERATE→LOW — crowded, low-yield units losing warmth they had borrowed from their own hunters. The shade is now CONTINUOUS along a six-stop ramp from cold indigo-slate to ember, carries its own STRENGTH (a thin measurement can rank high) and its RENDER KIND (zone evidence can never produce a hotspot inside a unit), and the key says how it was calculated from the same read model the map is painted from. Three more Ontario datasets served under the same Open Government Licence: moose, black bear, wild turkey — **13 datasets, 1,469 zone-species pairs, 6,642 records, 10 species**. Two Ontario datasets deliberately NOT served, neither for a licence: wolf-and-coyote publishes one combined column for two species, and elk is reported by a geography North Ground does not hold.)

Previously: 2026-09-29 (**The species answer became a decision surface, and Québec stopped saying "not yet verified".** Québec legal hunting hours now RESOLVE at a point: the Legal Time Act (T-5.1) splits the province at the 63rd meridian and answers completely west of it, while the east is refused by naming the three territories whose boundaries North Ground does not hold. The hours themselves are the complement of C-61.1 s. 1's « nuit » under s. 56's prohibition, narrowed by r. 12 s. 21's night permission — ±30 minutes, established by three independent reads. Québec Ready to Hunt ships PARTIAL: certificat du chasseur, permis de petit gibier, the hare-by-snare licence, the federal firearms licence and hunter orange, with legal methods, ammunition and fees carried as explicitly unresolved. Conditions are structured and shown under the status; "in season, with conditions" is now earned by a condition that exists. Served-matrix invariants are declared per jurisdiction rather than derived.)

Previously: 2026-09-23 (**Federal migratory game birds answer**: 24 species selectable nationally, PE/YT/AB with certified seasons, 18/18 cases. Earlier: **British Columbia serves rules** — a first wave of 79 rules over seven species reaching 221 of 225 units, 20/20 production cases, three disputes preserved as CONFLICT; coreGameComplete 5 of 11. Earlier the same day: **Canada spatial complete**: all 11 in-scope provinces and territories have parity-certified official geography, Prince Edward Island last, served at geography level JURISDICTION because the province publishes no units. Rules remain the open front — 7 of 11 hold no certified rule and answer UNKNOWN. Government GIS transient failures are now retried under one stated policy and a national audit survives an unreadable provider. **United States: licence-first.** Six more states' map licences read and recorded verbatim with hashes — Michigan clears (public record, no reuse restrictions), Wisconsin, North Dakota and South Dakota are silent, Minnesota and Maine refuse outright. Eight of the ten states with any evidence may not be drawn, so the 50-state bottleneck is permissions rather than engineering; eight letters are drafted for the owner. A silence and a refusal are now reported differently because they are undone differently. An overlap names its zones instead of counting them. Michigan is next and is held until its Wildlife Conservation Order is read: its deer units nest by design, and deliberate nesting is not a conflict.)

Previously: 2026-09-22 (Canonical species PRIMARY media schema, private storage and every shared consumer are activated and certified in production. Temporary certification media and users were removed; population is 0/60. Permanent administrator access remains fail-closed until the owner supplies the administrator email.)

## Current Product State

### White-tailed Deer authority page reference implementation (2026-10-06)

`/hunting/species/white-tailed-deer` is the sole reference implementation of the
Species Authority Page system. It uses the species' existing canonical URL and
PRIMARY photo relationship. The other 484 routes still use the established
generic profile; there is deliberately no catalogue-wide rollout.

The reusable contract lives in `src/lib/species-authority/`: identity, facts,
ordered sections and subsection anchors, layer classification, claim-level
citations, FAQ, canonical species references, Hunt handoffs, a complete visual
asset manifest, and generic identification, habitat, diet, sign and shot
explorer schemas. `SpeciesVisualExplorer` and `SpeciesShotPlacementExplorer`
contain no White-tail-specific paths or copy. The runtime validator now also
fails duplicate/missing visual ids, invalid dimensions, missing alt/caption,
unavailable rendition references, non-canonical originals, and any used asset
without a publishable rendition. The reference data contains all 14 stable major
anchors plus stable explorer anchors. All answers—including every unselected
explorer panel—remain in server HTML; Article, Taxon, Breadcrumb and
visible-answer-matched FAQ JSON-LD ship in the initial response.

The page keeps the evidentiary layers named in the interface. Biology and field
knowledge explain the animal and its sign; hunting intelligence covers scouting,
equipment and ethical shot selection; regulatory copy explicitly refuses to
answer legality; geospatial copy describes the existing production-verified
`RANGE_HABITAT` Species Heat surface (methodology 2.1.0, moderate confidence,
ageing source inputs). The CTAs use canonical state:
`/hunt?species=white-tailed-deer` for a legal query and
`/hunt?species=white-tailed-deer&explore=1` for the existing map. No map or
regulatory engine was duplicated.

The five explorers are answer-first and synchronize image, heading, evidence and
caution text. Identification covers the supplied buck and White-tail/Mule deer
comparison. Habitat is limited to the supplied bedding, feeding and travel
categories. Diet uses four deterministic crops of the supplied seasonal plate
and now includes the required stomach-contents field-observation note. Sign has
track, bed, rub, browse, pellet and multi-sign synthesis views. Shot placement
is a controlled decision explorer: broadside is PREFERRED, modest quartering-away
is CONDITIONAL, and frontal, quartering-toward and rear-facing are PASS. Only the
quartering-away asset is a registered external/anatomy pair and therefore only
it receives the anatomy toggle. Angle changes atomically reset to external.
There is no firearm/bow toggle because no supplied asset or cited source supports
separate method visuals. Target copy names a region and intended path, never a
magic pixel, and the legal handoff remains adjacent.

Asset review is intentionally selective. All 17 supplied files are represented
in `visualAssets` with original path, intrinsic dimensions, role, section,
status, rationale and provenance. The source files named `.webp` actually contain
PNG bytes and are 2.3–3.7 MB each; they remain untouched. The deterministic
`scripts/build-white-tail-visuals.mjs` creates 17 real WebP renditions under
`public/species-authority/white-tailed-deer/`, totalling about 5.0 MB before
Next Image resizing. `.vercelignore` excludes the 48 MB source folder from the
deployment while keeping it in Git for review and deterministic rebuilds. Twelve
originals are used. Five are withheld:

- `white-tailed-deer-sex-age-comparison.webp` — REVIEW REQUIRED; falsely says
  fawn spots are year-round and makes body-build generalizations too absolute.
- `white-tailed-deer-tracks-diagram.webp` — REVIEW REQUIRED; its rounded-tip
  comparison conflicts with the sourced pointed/heart-shaped field mark, and
  gait labels require review.
- `white-tailed-deer-shot-broadside-anatomy.webp` — REVIEW REQUIRED; not
  registered to the external pose and its simplified internal anatomy requires
  veterinary review.
- `white-tailed-deer-shot-frontal-anatomy.webp` — NOT USED; its target overlay
  conflicts with the cited frontal PASS decision.
- `white-tailed-deer-shot-quartering forward-anatomy.webp` — NOT USED; its
  target overlay conflicts with the cited quartering-toward PASS decision.

No supplied scrape visual, scale-calibrated track plate, registered broadside
anatomy layer, rear-facing PASS plate or method-specific shot set exists. If
commissioned, use explicit filenames such as
`white-tailed-deer-sign-scrape-reviewed.webp`,
`white-tailed-deer-tracks-scale-reviewed.webp`,
`white-tailed-deer-shot-broadside-anatomy-registered-reviewed.webp`, and
`white-tailed-deer-shot-rear-pass-reviewed.webp`. Any anatomy or target overlay
needs subject-matter review before its status can become `USED`.

Verification on the visual implementation tree:

- `npm run typecheck`, targeted lint and `npm run build`: pass; 504 routes/pages
  generated in the production build. `npm run test:species-authority`: 9/9 pass,
  including exact original inventory, source and rendition dimensions, omissions,
  shot state/registration, all explorer HTML, anchors and structured data.
- Browser certification at 1440×1000, 1280×800, 390×844, 320×568 and 412×915:
  all five explorers render and transition correctly; no horizontal overflow,
  page error, console error or framework overlay. At 320 px, primary explorer
  choices are 44 px high and the registered anatomy view remains contained.
  Desktop and compact review captures are in
  `artifacts/white-tail-visual-review/`.
- A fresh 390×844 load fetched zero explorer images above the fold. Scrolling
  directly to shot placement fetched one selected lazy image (13,576 transferred
  bytes through Next Image) while the other 16 rendition elements remained
  unloaded. Intrinsic dimensions and responsive `sizes` are declared everywhere.
- Feature commit `d42ed927` deployed through the established Git-to-Vercel
  production workflow as `dpl_HutnVcmQXdfAjuAK6smQ6bG87174`. The canonical
  public route returned 200 and was browser-certified at 390×844 with one H1,
  five explorers, every major anchor, the registered anatomy transition, no
  document overflow, no framework overlay and no browser/runtime errors. Vercel's
  deployment error-log scan returned no records. The 48 MB source directory
  returned 404 in production while optimized renditions returned 200 as intended.
- The Species Heat handoff retained its canonical query, loaded White-tailed deer
  in Hunt and showed no framework error. Review screenshots are in
  `artifacts/species-authority-review/`.
- Commit `ba1d6bc5` deployed through the established Git-to-Vercel production
  workflow as `dpl_59qFxjmDhxqYRPV8Zn1Sv6H7wptA`; the canonical public route was
  then browser-certified with meaningful content, the complete interactive
  outline and no framework overlay. Five warm mobile reads measured median TTFB
  269 ms, DOMContentLoaded 318 ms and load 657 ms; the document transferred about
  20 KB and scripts about 160 KB. One first cold desktop read reached 5.7 s TTFB,
  so function cold-start variance remains visible even though subsequent reads
  were 0.23–0.45 s.

Open for owner review before any broader rollout: the five withheld assets and
especially every anatomical/target overlay; the information hierarchy and page
length; whether the right rail earns its desktop space; and whether the reference
content's Canada-first regulatory handoff is the right framing for a
continent-wide biological page. No analytics were added and no catalogue rollout
was attempted.

**Current external-source hold (2026-09-29).** The live source gate found that
Manitoba replaced its 2026 hunting-guide artifact: the downloaded guide is now
`sha256:402f9485…`, while the certified cross-check transcription belongs to
`sha256:74a15553…`. The regulation remains the controlling source and all
deterministic tests pass, but `npm run check:regulatory-sources` must remain red
until the replacement guide is re-transcribed and compared; accepting the new
hash without that review would make the cross-check fictitious. The same run
found a Québec page update dated 2026-09-23. That change was reviewed: it adds
the ZEC-default-date context, changes 0 rules and 0 designations, and the Québec
bundle now reproduces byte for byte from the current page.

### Main Site
- Visual/hero work is currently being developed.
- Brand direction: dark boreal, warm, rustic, clean, outdoorsy; not tactical.
- Broader North Ground architecture is being established.
- Technical foundation remediation is implemented: truthful durable newsletter handling, production robots/sitemap, canonical and social metadata, justified Organization/WebSite structured data, a breadcrumb primitive, server-rendered homepage H1, and branded 404 behavior.
- The published bundles now drive `/hunt`, the searchable `/hunting/species` library, and 60 indexable species routes. All are included in the generated sitemap alongside `/`. `/tools/season-finder` is superseded and redirects permanently (308) to `/hunt`; the redirect is generated from `redirectPairs()` in `src/lib/content/urls.ts`, not hand-written in config.
- Finalized homepage metadata remains broad across Canadian outdoor knowledge and tools. `/hunt` has dedicated North Ground Hunt metadata and a static 1536×803 JPEG social preview; dynamic `/hunt/share/[shareId]` metadata remains independently overridable and `noindex`.
- The homepage hero is unchanged and stays the dark, immersive entrance. Its `Enter the North` control is now a link to `/hunt`; the mission deck it previously opened moved to a quieter `Who we are` control directly beneath it, with focus return repointed accordingly.
- The integrated release is deployed on the canonical public host. Homepage navigation now exposes Hunt and the ruffed-grouse species guide on desktop, mobile and keyboard paths; the approved brand mark also supplies a 180×180 Apple touch icon.
- Canonical species PRIMARY media is active in production. One service-role-only database relationship keyed by `species:*` drives the species library/profile and Hunt selector/result/map/Ready to Hunt consumers. The administrator surface is `/admin/species-media`; successful Supabase Auth plus an explicit UUID allowlist produces an eight-hour signed HttpOnly, Secure, SameSite=Strict cookie, and every upload is checked again server-side. Drag/drop takes identity only from the card, never the filename. The pipeline drops metadata by re-encoding, keeps one sanitized master plus avatar/card/profile WebP derivatives in the private `species-media` bucket, records rights/audit fields, uses immutable asset paths, and atomically retires/replaces the old primary with optimistic concurrency. Missing media stays a meaningful placeholder.
- Species search and social metadata is generated for every species from one function, `src/lib/seo/species-metadata.ts` (2026-09-23). Library: "North American Game Species Guide". Profiles: "{Name}: Habitat, Range & Hunting Guide" only for hunted groups or certified coverage; furbearer-only species get "Identification, Habitat & Range"; descriptions say "certified hunting rules in …" only where the coverage report holds them, naming one or two jurisdictions and counting beyond that. Each profile's Open Graph/Twitter image is its own verified PRIMARY photo with credit (`[species]/opengraph-image.tsx`); the library card is a strip of five PRIMARY photos at `/og/species-library` (outside `/api/`, which robots.txt disallows, and outside the `[species]` segment, which claims the slug).
- Migration `20260921113816_canonical_species_primary_media.sql` is in the live ledger and the private WebP-only, 15 MiB-limited bucket is provisioned. `20260921093347_map_intelligence_foundation.sql` remains intentionally unapplied. **Permanent administrator (2026-09-22):** the owner created the administrator Supabase Auth account (confirmed; the only Auth user). Its UUID is set as `SPECIES_MEDIA_ADMIN_USER_IDS` in Vercel Production only; `SPECIES_MEDIA_ADMIN_SESSION_SECRET` is unchanged. It takes effect with the next production deployment; sign-in, `/admin/species-media` (expected 60 missing) and refusal of anonymous and non-allowlisted uploads are to be verified then. Production remains 0/60.

### Species media
- **Admin surface audited 2026-09-22 (§50).** Session cookie HttpOnly/Secure/SameSite=strict for 8 h, HMAC token compared with `timingSafeEqual`, the UUID allowlist re-checked on every verify (so removing a UUID revokes instantly, and is the revocation path — the token is otherwise stateless for its 8 h), same-origin on all three admin endpoints, uploads bounded and metadata-stripped, the public rendition route taking its storage path from the database and serving active assets only. Two findings were fixed: the pre-authentication sign-in limiter is now the durable Supabase one (`consume_hunt_share_rate_limit`, own HMAC namespace, 5 per 15 min, FAILS CLOSED — an unreachable limiter returns 503 rather than allowing), and a focal write now records `updated_by`/`updated_at` (migration `20260922220000`). Known and not acted on: every rendition costs a database read plus a storage download through the function, which the 1 h/1 day cache headers make fine at 60 cards — revisit with signed URLs or a public CDN path if the library grows by an order of magnitude.
- **Library cards are full-bleed photographs (2026-09-22).** The card image fills the card at a fixed 4:5 ratio and every line sits in one dense glass panel (`.ng-glass-dense`, added once in `globals.css`); worst measured contrast over the brightest blur-sized block under the panel across all photos is 4.54:1.
- **Focal point (2026-09-22).** Each asset carries `focal_x`/`focal_y` (percentages, default centred) and an uncropped card-sized `cover` rendition; every consumer applies them as `object-position`. An administrator presses and drags a card photo to place its subject; release saves through `POST /api/admin/species-media/focal` (admin session, same-origin, rate-limited, active asset only). Migration `20260922210000` is applied: variant check widened, focal columns added, `publish_species_primary_media` replaced to accept the optional cover while still requiring avatar/card/profile. Dry-run in BEGIN/ROLLBACK first, per the migration rule.
- **Population: 60 of 60.** Every active asset has a cover rendition (57 backfilled from their sanitized masters, 3 published with one).

### Hunting Intelligence
- **Species Heat is drawn under the zones in production (2026-09-30, `1059d02`).** Find game → a species requests the independent surface resource by GROUND (`/api/hunt/species-surface?speciesId=…&bbox=…`), never through the zones in view, and needs no zone geometry to draw. The field is a canvas in Google's `mapPane`, so the stack is the compositor's own: basemap → animal surface → transparent zone polygons → cased green legality outlines → `!` markers → labels. Ramp transparent → blue → cyan → green → yellow → orange → red; a surveyed zero is the faintest blue and only unsurveyed ground is transparent; the edge of survey support fades rather than stepping. CONTINUOUS rasters are sampled bilinearly at no finer than a quarter of their declared resolution; SAMPLE_PLOT surveys are vector fills with hard edges and nothing between plots (mallard carries both). A species with only zone-level evidence shows no heat, and the key says "no fine-grained evidence held" in words. The zone-keyed choropleth (`useSpeciesHeat`) is deleted. Status ladder in *Recent Product Decisions*.
- **A species profile link is a published URL or nothing (2026-09-23).** `resourcePath` fell back to a path assembled from the slug when a species had no canonical URL. **All 60 resolve today** — measured, not assumed — which is exactly what makes that kind of guess dangerous: nothing checked it, and nothing would have checked the next one. A "Learn more" that 404s is worse than no link. It is now `string | null`, every consumer treats `null` as **do not link**, and `species-links.test.ts` pins the shape. Same rule as an unresolvable species id: do not render around it. This also settles the constraint for the incoming species-page patch before it arrives. **And `Start over` now forgets the Find Game hint's counter too** — the E2E caught that it survived, and exempting it would have been the easier change and the wrong one: §41A's promise is that the device is left clean, not clean except for what we found convenient to keep.
- **The selected zone's label is composited above its own polygon (2026-09-23, owner).** Google draws polygons into `overlayLayer` (pane 101); the labels were in that same pane, so the selected zone — deliberately the loudest fill on the map — painted over the name of the zone it was highlighting, worst at far zoom where the shape is small and the label sits inside it. Ordinary labels stay in `overlayLayer`; the **selected** label is appended to `markerLayer` (103), and the self marker shares that pane with a higher z-index so a hunter's own position is never covered by a name. **Render order at the map's own layer, with no geometry changed.** The collision half was already correct and was left alone: `labels.ts` sorts `force`d candidates first, so the selected label was never suppressed by a neighbour — measured before touching it. `selectedLabelOnTop` pins all three zooms and asserts **pane order rather than hit testing**, because map labels are pointer-transparent (`elementFromPoint` never returns one, so a naive check reports "covered" either way) and because existence proves nothing — a label painted under a polygon is still in the DOM. Two probe errors of my own along the way, both in measurement rather than in the fix: the first compared my container's z-index against Google's pane, the second walked past the pane into the shell.
- **Find Game, regulatory half — "where can I hunt this" (2026-09-23, §41B).** A **buck** on the map opens *Find an animal to hunt*; choosing a species shades every zone in view by what the certified rules say, names the zones where a season is actually open, and writes `?species=…&explore=1` so the state is shareable. **It needs no evidence dataset and is not SPECIES HEAT:** §41B keeps regulatory availability and species opportunity apart, so the card never ranks a zone, never says "best", and carries none of the heat vocabulary — the E2E asserts that absence explicitly, and that the zones are in their own name order rather than any ranking. Closing it removes the layer. **And a small bouncing hint** appears beside the buck on a quiet map, at most three times per device, never again once Find Game has been used: a real button with an accessible name, clear of the map's attribution (the grabber's lesson), and static under `prefers-reduced-motion`. Its animation runs **three times and stops** — an element that never stops moving is a harder target for a thumb, and the certification found the same thing from the other side, where a tool that waits for a control to settle could never touch it.
- **The anchored composer suppressed the body, and two of the three ways in never closed it (2026-09-29).** The composer owning the sheet while open is INTENDED — the owner's messaging-composer model, and the reason `{composerOpen && layout === "sheet" ? null : body}` exists. What was not intended: `chooseSearchResult` closed the composer, `useMyLocation` and `chooseOnMap` did not. So on a phone, granting location resolved the zone and then left the species list, the evaluation and the pin's own confirm control unmounted behind an open search field. **Measured on the branch build at 390×844 with geolocation granted at Bancroft: after the zone resolved to WMU 57, `data-composer` was still `open` and the DOM held ZERO species controls** — a hunter who granted location could not choose a species at all. The certification's `locationGranted` and `staleAnswers` both aborted on `locator.click: Timeout` at exactly that step; the same shape hit "Choose a spot on the map", which **no assertion covered**, because it is pressed from inside the composer and "Check this spot" lives in the body the composer suppresses. **The fix is one rule, not three call sites** (§41A: the three ways of choosing a place end in the same state): `placeChoiceSubject` in `exploration/viewport.ts` keys what the composer is still waiting to be told, and one effect closes it when that subject changes. A key rather than a boolean, so re-opening the composer over a resolved hunt is not shut the moment it opens; the label is not in the key, because a reverse geocode renaming a point is the same place. **Product defect, not a test artefact** — and the by-name diff proves it: with the fix, the branch's failure set is IDENTICAL to production's (14 common, zero unique on either side), on two production bases that both reported 244/258.
- **The certification's own total was unstable, and that is fixed before it was trusted (2026-09-29).** The moderator measured 303 then 261 checks on identical code. The cause is the shape this suite was burned by once already — assertions inside an `if` whose condition nothing asserts. Four more were found (the Google basemap block ×14 widths, the self-marker comparison ×3, the Hunt Brief link, a second place-provider gate) plus two whole scenarios gated on `--slow` and `--brief` that contributed nothing and said nothing. **Not all are defects**: this host's Google key is refused for Maps JS, Places, Geocoding and Weather, so the basemap legitimately falls back — but a legitimate absence must not VANISH. Each now records a `SKIP`, one entry per assertion not run, with its reason; and **every scenario declares a minimum entry count**, so a scenario that shrinks FAILS on the shortfall instead of quietly reducing the suite, and a new scenario without a declared minimum fails too. **Measured after: two runs of the same build, 389 entries each, identical per-scenario contributions.** The 14 remaining failures are all Google-dependent and present on production unchanged.
- **The composer anchors above the keyboard (2026-09-29, owner spec).** The geometry fix below kept the sheet on screen; it did not produce the layout the owner asked for, and those are different things. `PlaceComposer` rendered the field FIRST with everything it offers below, so with a keyboard open the field sat mid-screen and the results were behind the keyboard. It is now the messaging-composer model — field on the visible bottom edge, offerings scrolling above. **Measured at 375 with a keyboard simulated: results [291,539], field [553,597], visible band [150,620]** — the field is the last thing before the keyboard. The field is last visually and first in the DOM via `order`, so a screen reader still meets the input before the listbox it controls. **One scroller:** the sheet body stops scrolling while the composer is open and the recents list gives up its own max-height; the composer owns the sheet while open, because anything rendered after it would sit between the results and the field being typed in. **One source of truth for the height:** `.sheet` fell back to `88dvh` (the layout viewport) before the first measurement and used the visual viewport after — the double compensation that makes the first keyboard open behave differently from the second; the fallback is now the same arithmetic in dynamic-viewport CSS. No device-specific pixel offsets. **A blur stays a blur:** closing the search blurs on the open→closed edge only, so an interactive swipe-down is never fought. **Enter no longer submits mid-composition** — an IME uses Enter to commit characters, so it was searching half a word and taking the keyboard away; guarded by `isComposing` plus keyCode 229. **There is no keyboard-dismiss control and never was one** — grepped, not remembered; the certification asserts its absence rather than claiming a deletion that did not happen. `keyboardStateMachine` now covers anchoring order, the absent dismiss control and no-refocus-after-blur, at 375 and 320.

- **The keyboard scrolls the visual viewport, and nothing was reading it (2026-09-23, owner, real iPhone, Safari and Chrome).** A large black scrollable region appeared when the composer took focus, and the sheet's top — the zone heading and the composer — could be pushed off the screen. One unread value caused both. `.app` was `position: fixed; inset: 0` with only `bottom: var(--viewport-gap)`, measured from `visualViewport.height` alone. When a phone keyboard opens WebKit both shrinks the visual viewport AND scrolls it down, so `visualViewport.offsetTop` goes non-zero; a fixed element does not move with that scroll. The shell therefore stayed pinned to the layout viewport — above the visible band, which is the header being pushed away — while its height was only the visual viewport's, leaving the bottom `offsetTop` px of the band uncovered, which is the black strip. **Reproduced numerically with the production formula: shell `[0,470]` against a visible band of `[150,620]` — 150px uncovered and the sheet's top at 62, 88px off-screen. With the fix: shell `[150,620]`, uncovered 0, sheet top 212.** The shell is now inset to both edges of the band. Two more of the same family went with it: `HuntSheet`'s focus handler compared a control's rect against `window.innerHeight` (874 while ~475 is visible), so it reported a control as on screen with the keyboard on top of it; and the keyboard's own Search key did nothing, because Enter was handled only when a suggestion had been highlighted with arrow keys a phone does not have — it now takes the highlighted place or the first offered, exactly once, and dismisses the keyboard either way. New E2E `keyboardStateMachine` drives normal → focused → keyboard-sized viewport → submitted → blurred → restored at 375 and 320; **six of its assertions fail on the pre-fix formula**, including a dedicated one for the void (ground inside the visible band the shell does not cover), because the scroll-height checks looked correct while half the screen was black. `HuntDiagnostics` (`?diag=1`, read-only) is temporary, for measuring on a real device, and goes when the owner confirms the fix.

- **The mobile sheet: sized to the screen, not to the layout viewport (2026-09-23, owner: "expands out of screen and it doesnt behave so smooth").** `window.innerHeight` on a phone includes the strip behind the browser's own toolbar, so a sheet sized from it puts its last rows under the chrome — and a desktop emulator cannot reproduce that, because there the two are equal. The sheet now measures `visualViewport.height`, and the shell is lifted by `--viewport-gap` (the difference) so the whole composition lays out inside what is actually visible. **Measured with a simulated 67px toolbar:** at `full` the sheet's bottom went from 812 (67px behind the chrome) to **745 — exactly the visible edge**, with the last row and the map's attribution both on screen. A 24px threshold on the `visualViewport` resize listener keeps rotation and keyboard changes while dropping the frames of the toolbar's own animation, which is the stutter. **New E2E `everyRowReachable`** pins what 253 passing checks had never asserted — that content can be SEEN, not merely that it exists: at 320/375/390 and at both `half` and `full`, the last species row must be reachable by scrolling the sheet body. **A mobile sweep of five states at two widths** found the species library's filter chips at 36px (raised to 44 — a standalone control in a scrolling strip) and confirmed the rest: no horizontal overflow anywhere, the category strip scrolls rather than overflowing, and the small inline links on species pages are prose links, which WCAG 2.5.8 exempts and which enlarging would break the reading they sit in. **One fix was reverted:** growing the sheet grabber to a 44px hit area put its box 10px above the sheet, over Google's attribution — a licence term — and growing it downward would have taken taps from Share and Close. It stays a 286px-wide, 24px-tall bar, with the whole header as the drag surface. The responsive check caught that within one run, which is what splitting "drew at all" from "not covered" bought.
- **The drill-down: legal hours and Ready to Hunt are in the answer, not behind it (2026-09-23).** Both blocks moved out of the lazily-loaded "Details" and sit directly under the season, which is the owner's panel 4. Legal hours render as **two lines** — the clock a hunter reads off their watch, and the authority's own statement of the rule that produced it — because those are two different things to know; showing only the clock hides what it depends on, showing only the rule makes someone do sunrise arithmetic in the dark. Every state is honest: Yukon resolves `07:43 – 19:48` with *Migratory Birds Regulations, 2022, s. 28(3)(a)*; Québec cannot state a window at all (its zones span several timezones) and says so while naming the ministry; `NO_SOLAR_EVENT` is a real answer about a real day. Neither block is repeated in the detail — the duplicate species list taught that one fact rendered twice on one card can disagree with itself. **And a defect the shape exposed: a federally-regulated species read as uncovered in a jurisdiction where the engine has an answer.** Canada goose in Yukon failed `hasSpeciesCoverageIn` — Yukon does not certify it, because the rules are federal — so the card said "North Ground has no certified canada goose rules in Yukon" while a point evaluation returned CONDITIONAL with a resolved legal window. Jurisdiction coverage metadata is no longer the last word where a point can be asked: **the engine decides, and its own UNKNOWN is what shows when that is the answer.** The metadata still governs zone scope, where there is no point to ask about. That is §8's understatement clause — the quieter half of not overstating.
- **A boundary's standing and a zone's rules are two facts, said at their own scopes (2026-09-23).** British Columbia's units now answer CLOSED quoting B.C. Reg. 190/84 while their geometry is still `IN_DEVELOPMENT`, so the zone list — which read `coverage`, the GEOMETRY's status — called them "boundary only" beside a card answering from certified rules with a source. Both claims were true; one was made at the wrong scope. The list now reads `rulesServing` and says *"Official boundary, rules not yet certified"* only where the rules genuinely are not; the per-species answer on the card is unchanged and outranks either summary, being the most specific true thing. Neither claim was deleted. `COVERAGE_WORDING` in `zone-layers.ts` authors the same conflation (`IN_DEVELOPMENT` → "Boundary only" / "North Ground has not yet certified the rules for this zone") but has **no consumers**, so it reaches no hunter; reported rather than edited, since that file is not mine.
- **Component tests were never in `npm test` (2026-09-23).** `test:hunt` globs `src/lib/**` only, so `limitation-groups.test.ts` — written and reported as part of a landing earlier today — had never executed in the suite. Added `test:components`; the count went 1314 → 1320. The four limitation-grouping assertions and the two new zone-list ones now run. **A gate I reported was weaker than I said it was**, which is the same family as a test that passes while measuring nothing, one step worse.
- **`next` on the card, one species list, and a place name that isn't cut in half (2026-09-23).** The four `NextSeason` kinds render as **four different sentences** — opens on a day / depends on your hunt / nothing further through a stated horizon / not certified — because each is a different thing to know. Status and upcoming stay two facts: a row can be CLOSED and say "Opens Sep 15, 2026" and it is still CLOSED, and there is no `NOT_OPEN_BUT_UPCOMING` anywhere. A row shows the season it is IN, or — when none runs — what happens next, never both. **`next` is silent when the status is itself an absence:** "Not covered here" above a row reading "Next opening not certified" is one fact said twice, which is the two-facts rule failing in the direction nobody expected — not a merge, but two fields each having something to say about the same nothing. **Removed the duplicate species list:** `ZoneSummaryDetail` enumerated the same species as the card's own rows, from a different variable, so during a load or a zone change the two could show different states for the same zone at the same moment. Only the enumeration went; the headings' explanation, the restricted areas, the special considerations and the zone facts stayed, and both consumers now read one object. **And the place subline no longer carries a hidden duplicate sentence** — "Mani— Mani is in this zone" on the owner's screen — nor cuts a name mid-word: it wraps to two lines. I had added that hidden sentence for screen readers; it cost more than it bought, and if the relation needs stating it should be stated visibly, for everyone.
- **Same link, same answer — the stored-place exception dropped, and the summary stops sending names and counts (2026-09-23, owner).** An explicit link is now restored onto **nothing at all**: not the place, not the species, not the date, not the camera, not the sheet's height, not a layer — *however compatible any of it looks*. I had argued to keep the remembered place when it sat inside the link's own zone; the owner overruled it, and the operative clause is why: compatibility is the justification every future exception would arrive wearing. New E2E `twoDevicesOneLink` seeds **two genuinely different histories** (one hunter last in Ontario after deer, one last in Québec after grouse at a remembered spot), opens the same link on both, and proves they converge on the same ten rows, the same camera, no species and no place — a seeded-versus-clean pair would have passed while the real case failed. Took Canada's patch removing `counts` and `name` from the zone summary and landed both halves together: counts are now **derived from the rows drawn**, so they cannot disagree with the list beside them, and every name resolves through the canonical presentation path. **The unresolvable-id failure mode is an owner ruling, not a default:** the invariant is enforced at build and test time; if one reaches production the **row fails, never the Hunt**, with a structured error carrying the id, surface and zone — a hunter is never shown a raw id, a prettified slug or "Unknown species". `speciesName`'s humanisation (`species:foo-bar` → "Foo bar") is explicitly **not** resolution. I had argued for a visible "cannot name this" row; a missing row is a defect an engineer finds from the error, and a named one is a defect a hunter reads. All of it is in `docs/contracts/hunt-sheet-presentation.md` rather than in messages.
- **Precedence: an explicit link means what it says (2026-09-23, owner contract; `docs/contracts/hunt-sheet-presentation.md`).** `explicit URL > current explicit action > remembered session > defaults`. **Reproduced the defect the owner watched:** `?zone=ca-qc-zone-10o&date=2026-09-23` came back from restore carrying `species=white-tailed-deer` from device memory, and the URL-sync effect wrote it into the address bar — a link that gains a species no longer means what it said, and whoever it was shared with gets someone else's animal. A URL naming ANY hunt dimension is now explicit and no other dimension is hydrated from memory; a bare `/hunt` still restores in full. The stored place stays, and is not an exception: it is kept only inside the link's own zone, sharpens a zone answer into a point answer without changing which zone the link is about, and never reaches a URL. New E2E `urlBeatsMemory` walks the owner's seven-step sequence — Ontario hunt with species and camera, then an explicit Québec zone-and-date link in the same tab — and proves Québec wins, the camera frames it in **both** axes (46.25/−76.39, not Ontario's 45.30/−77.74), the old camera does not survive, no species is inserted, and a reload is stable. **The world-view camera symptom did not reproduce in any form**, before or after; the two-axis framing check stands as a fix for the class, not a claimed fix for that report.
- **The zone card is the owner's panel 3, and it was never blocked (2026-09-23).** The mockup's per-species rows — photo, name, season range, chevron — are built from `/api/hunt/zone-summary`, which **already carries `state` and `season: {opens, closes}` per species**. `getOpenSpecies` was thought to be the blocker; it is not, for this. Headings keep the §41A zone vocabulary (**In season**, Depends on your hunt, … , Closed) rather than the mock's "Open today", because a zone card never says OPEN. **A closed row carries NO date:** the summary knows a season is not running and does not yet carry when the next one starts, and "closed today" must never share a representation with "closed until further notice" — the mock's `Opens Nov 7, 2026` is the one thing here that still waits on the engine. Species PRIMARY media resolves by canonical id through the existing relationship; a species without a verified image gets the neutral placeholder rather than a substitute. Measured at 390px, Zone 10 West: 6 in-season rows with dates, 4 closed rows without, `View all species`, no horizontal overflow.
- **X means X, and the composer stops growing with its own memory (2026-09-23, owner).** The sheet gained a fourth resting state, **`closed`**: a 44px pill and the map. X on a zone card now dismisses the card, **clears the species with it** — so raising the sheet again never shows a previous hunt's animal — and leaves the map; it used to drop to a short sheet still carrying "Ruffed grouse / Today" and the whole explainer, which is not closing anything. A dismissed sheet is never REMEMBERED as a height: a device left closed returns at peek, because coming back to a map with no sheet would read as a failure to restore. The card's duplicated `Check an exact spot` / `Use my location` buttons are gone — both are rows inside the composer, which is on that card too. Recent searches now live in a bounded scroll region so a pile of them cannot push `Use my location` and `Choose a spot on the map` off the bottom. New E2E `closingMeansClosed` pins all of it; `sheet.test.ts` gained the closed state and three assertions that said "nothing below peek" were reformed, because the owner added somewhere below peek to go. **Also: `fitAndConfirm` now confirms framing in BOTH axes.** It checked longitude only, which catches an antimeridian clamp but not a map that has landed somewhere unrelated — the moderator saw production rest over the Atlantic under a card answering about Zone 10 West. That exact repro does not reproduce locally on a clean or seeded profile, with or without `species`; the two-axis check is a fix for the class regardless, and the report stands as unreproduced.
- **Zone card: the species dropdown is gone, and the composer stops pretending a place is a hint (2026-09-23, owner priority).** The zone card's own list of what is in season IS the species control; a dropdown beside it asked the same question twice. Tapping a species in the list drills in, and a `← All species in [zone]` control comes back out. **The removal exposed a real defect that the deep-link test caught:** the chip had been the only place the card NAMED the species, so a `?species=` link produced "● In season" over a season's dates with no animal anywhere on the card. The species name is now a heading between the way back and the status, which is also the owner's own shape. The deep-link check was rewritten to assert the CAPABILITY (a link naming a species is answered for) rather than the control, which is why it caught this. The composer's placeholder is now the hint **"Search anywhere"**, and a chosen place renders as the field's VALUE — it used to be the placeholder, so a hunter could not tell their own choice from a suggestion. Map zone labels are now `user-select: none`: they are `aria-hidden` because the zone list is the textual alternative, and a Select-All copy was otherwise picking up nineteen undelimited designations ("10W1211E4865…").
- **Answer surface, stage 1d: the status paragraph is out of the scan (2026-09-23).** With Canada's `season.label` the scan became what the owner asked for: **status → dates → the authority's own segment → limits**, verified at 320px as `IN SEASON, WITH CONDITIONS / Sat, Sep 19, 2026 – Fri, Jan 15, 2027 « Armes à feu et à air comprimé, arbalète et arc »`. The segment is quoted and `lang="fr-CA"`, never translated; where the rules behind a season disagree the label is absent and **nothing takes its place**, because a North Ground substitute there would attribute a name to a ministry that never wrote it. The paragraph moved behind a "Why this answer" disclosure rather than being deleted — it still carries the other season segments and the reminder that North Ground has not verified what the hunter holds, neither of which is structured yet. **Québec's contextual band is live and, more importantly, selective:** new E2E scenario `contextualBand` pins the pair behaviourally — Rigaud (Zone 8 North, Montagne de Rigaud) shows one line beside the status, not collapsed; Maniwaki (Zone 10 West) shows **no band at all**; both keep the province's 3 standing limitations collapsed. A band that populated everywhere would be the wall growing back under a better name. Also corrected a check of my own whose premise the segment label changed: "no French outside a disclosure" now means no ministry PROSE in the scan — French is permitted inside the facts list, where a quoted segment NAME belongs, and is refused everywhere else in the scan.
- **Answer surface, stage 1c: the header says the place once, and the facts come before the sentence (2026-09-23).** "Maniwaki is in this zone" was a sentence under a header that had just said the zone; the place is now the zone title's subline, with the full relation kept as visually-hidden text because a subline reads as "in this zone" only if you can see that it sits under the zone's name. In the answer, the status is followed by the season dates and limits, and the prose paragraph moved BELOW them. It was not deleted: every fact in it is in the list except the authority's own name for the season segment ("Armes à feu et à air comprimé, arbalète et arc"), which exists nowhere else — a real fact with nowhere to live until `season` carries a label field. **Requested from Canada:** `season.label` with `lang` and `owner`, after which the paragraph can go.
- **Answer surface, stage 1b: every limitation goes where its author's scope sends it (2026-09-23).** Canada's `Limitation` shape landed, so the wall could finally be taken apart without a renderer guessing at legal meaning. `groupLimitations` (`src/components/hunt/sheet/limitation-groups.ts`, 4 tests) sends each line to one of three places and nowhere else: **CRITICAL and CONTEXTUAL** to "Applies here today", above everything and never behind a disclosure; **GENERAL** into the collapsed "What this does not resolve", said once and complete; **SOURCE_DETAIL** into Sources, quoted, attributed and attached to the source it describes, with a caveat whose source is not listed still shown rather than dropped. CONTEXTUAL is rendered on presence — the evaluation already decided its condition — and is never re-tested here. The ministry's French leaves the scan path and lands in Sources with `lang="fr-CA"`; it is not translated, because §47 keeps an official term in the authority's words and a renderer inventing an English gloss of law is the failure this product exists to avoid. An English summary, when one exists, is content someone owns and publishes as data. Disclosure titles stay `<h3>` inside `<summary>`, so collapsing a section does not remove it from the heading order. Measured at 320px: 3 general lines present and collapsed, 0 untagged French outside a disclosure, sources 1,332 characters collapsed-but-openable. Gate: 1230/1230 unit, 200/200 E2E (one intermittent failure in one of four runs, not reproduced and not captured — the suite calls live provider services), seo pass.
- **Answer surface, stage 1a: the disclosure primitive, and what may not go behind one (2026-09-23).** One `<details>`-based `Disclosure` (`src/components/hunt/sheet/Disclosure.tsx`) now serves every Hunt surface, sharing the tokens the About section already used: platform keyboard behaviour, the global focus outline, a 44px target, reduced motion, and — because it is `<details>` — its content in the HTML the server sent, so collapsed is never absent (§29). **Sources moved behind it**; a citation is never a today-here blocker and the answer keeps its authority and checked-on date beside the status. **The limitations wall did NOT**, and the reason is recorded in the component: `regulation.limitations` is one flat `string[]` that concatenates Québec's `placeNotes` — true of THIS point, e.g. a CWD enhanced-surveillance area or a named territory where hunting can be prohibited — with `standingFor` lines true everywhere in the province. Collapsing hides the first kind with the second, and telling them apart by their wording would be a renderer guessing at legal meaning. It collapses when each line carries its own scope from its author (the agreed `limitations[]` shape: id, text, lang, owner, scope, condition, sourceId; GENERAL by default, CRITICAL earned). Also de-duplicated the weather (the prose repeated the numbers under it; the prose now shows only when there are no numbers) and moved "not a legal hunting time" onto the sunrise/sunset value where someone reading a time will see it. New E2E scenario `narrowScreen` pins map-first behaviour at **320px** before the rebuild: no sideways scroll on the opening state or a full answer, the provider's attribution on screen and clear of the sheet, both map controls ≥44px and uncovered, the sheet scrolling to its end at its resting height, the status a word and not a colour, sources collapsed-but-present-and-openable, and the limitations not behind a disclosure. Gate: 1166/1166 unit, 198/198 E2E, seo pass.
- **App-wide bug pass, driven as a hunter on a phone (2026-09-23).** Five defects, each with a test that would have caught it. (1) **The date field ignored typing.** It always holds a date, so `maxLength={10}` meant every keystroke after a tap was dropped — §41A's promise that typing `20260808` is enough was true only for an empty field, which this one never is. Selecting on focus; `formatDateInput` already caps the digits. (2) **A deep link to a zone outside the opening view was refused as "not one North Ground draws"** — a regression from the viewport change three commits earlier, visible only on a phone: `overview === "ready"` used to mean the country was drawn, and now means this screen's viewport is. The store is asked for the named zone's own ground before anything can be ruled out, and an unreachable authority says so instead. Same family as the `whole` flag: a conclusion that was safe only while the request was the whole extent. (3) **The poster's alt text named every served jurisdiction** rather than the ones in the picture — a textual alternative over-claiming to the one reader who cannot check; it is now derived from the features drawn. (4) **"Start over" dropped keyboard focus to `<body>`**; it returns to the menu button, as Escape already did. (5) **`/api/hunt/zone` answered latitude 999 with UNSUPPORTED** — a coverage statement about somewhere that is not a place. Range is now checked and refused as ERROR, so a caller with swapped or mis-scaled coordinates learns it is their bug, not our coverage. Also fixed a stale assertion of my own: the "selectable is not answerable" scenario read the whole sheet for season words, which broke the moment British Columbia gained rules for other species; it reads the answer panel. Gate: `npm test` 1118/1118, E2E 187/187, `validate:seo` pass, LCP median 569 ms with the poster in every run.
- **Coverage, camera and request separated (2026-09-23, `CLAUDE.md` §41A, Canada's contract `docs/contracts/viewport-scoped-overview.md`).** `SERVED_EXTENT` keeps its single job (coverage). `OPENING_CAMERA` is now declared in `exploration/overview.ts` and read by both the map and the poster, so serving a jurisdiction no longer moves anyone's opening view. Requests are viewports: level 0 became a 4° grid like the other levels, the margin is capped at one cell (a quarter of a country-scale view was 18°, which snapping rounded into requests several times the screen), and each screen asks for the box it can actually show. Two honesty fixes went with it: `whole` is computed from containment with a margin instead of being true by construction for level 0 (a clipped drawing treated as whole would let the map draw a request box's edge as a zone boundary), and panning past the answered boxes now asks rather than drawing empty country. The geometry preload was removed: it warmed a reference box a phone would not ask for, so a phone downloaded the country and then its own view. **Measured, local, 1425 zones served:** phone 390×844 opens with one request of 217.6 KB (was 679 KB, −68%); laptop 1440×900 one request of 679 KB, unchanged, because at the declared camera a laptop can see the whole country — narrowing that is an owner decision about the camera, not a code change. LCP median 568 ms, poster present in every run.
- **Selectable is not answerable (2026-09-23, `CLAUDE.md` §41A).** `speciesSelectableIn` (in `coverage.ts`, built on `speciesLayerFor`) asks whether a served layer covers a species; `hasSpeciesCoverageIn` still asks whether a certified record exists. The selector shows three tiers — rules here, boundaries only here, no official geography here — and choosing a selectable-but-unanswerable species draws that species' geography, resolves the zone and answers "Not covered here" naming the authority, with its published source where North Ground holds one and the species profile otherwise. It never shows a season, limit or date. This unlocks British Columbia, Saskatchewan, Yukon and Newfoundland, all drawn without certified rules: a hunter there can now learn which official zone they are in. Certified by `--only selectableNotAnswerable` (BC MU 1-15) plus three unit tests. Note for Canada: BC's and Newfoundland's layer `sourceId`s have no record in the published content bundles, so those jurisdictions name their authority without a link; adding those source records would complete it.
- **Stage 2 — the map reads at three scales (2026-09-22, `CLAUDE.md` §41A).** All zone styling moved out of the renderer into `src/lib/hunt/exploration/cartography.ts`, a pure module with 9 tests that hold the hierarchy rather than trusting hand-tuned values: the chosen zone's fill is computed to clear the loudest unchosen zone at every band and emphasis, dimmed neighbours keep their boundaries, fills thin as the map closes in while lines take over, jurisdictions differ in tone but not in loudness, and a filtered view leaves stateless zones empty rather than tinting them a default. Bands are national (<6.5), regional (<9.5) and local, applied on every settled camera. Labels are rationed by the screen span a zone owns (54/34/24 px) with the chosen zone always named — the rationing lives in the label layer, where pixels are known; a first attempt compared degrees to pixels and silently removed every label. Layers is now appearance only (basemap Standard/Satellite/Terrain, zone boundaries on/off, boundary visibility Light/Standard/Strong, special areas where they exist, zones-in-view list), and the visibility preference is remembered per device. The device dot is smaller and the hunt pin lighter, so the two markers read as the two different things §41A says they are. Certified by `scripts/certify-hunt-app.mjs --only cartography`, which hooks the map's own polygon API and asserts what the map is told to draw (Google renders polygons to a canvas, so the DOM cannot be inspected).
- **Stage 1b — one way in, one state, and a device that remembers (2026-09-22, `CLAUDE.md` §41A).** The resting sheet is a prompt and one composer; one tap focuses it with the keyboard up, and recent places, "Use my location" and "Choose a spot on the map" are rows inside it (`sheet/PlaceComposer.tsx`, replacing `SearchPage`). The old two-button start and the header's magnifier are gone. The field names the hunt location only while the sheet is about it, so a tapped zone can no longer wear a searched place's name. What the device remembers lives in `src/lib/hunt/exploration/session-store.ts` (localStorage, 9 tests): hunt place, zone, species, date, camera, layers, sheet height and up to six recent places; a URL always wins, a device-origin hunt is never stored, a past date falls back to today, blocked storage is simply a device that does not remember, and "Start over" in the menu removes the record entirely. Two defects fixed on the way: the sheet only scrolled at full height, so actions below the fold were unreachable at peek and half (the body is now sized to what the current height leaves, and a downward drag from the top still lowers the sheet); and the homepage's "Species guide" pointed at ruffed grouse rather than the library, which is where the preselected-grouse impression came from — Hunt itself has no default species, only `?species=`. The sheet's explainer is now one orientation line plus four server-rendered `<details>` disclosures, so crawlers and no-JS readers still receive all of it (§29).
- **Map-first rebuild (2026-09-22, branch `hunt-map-first`, direction in `CLAUDE.md` §41A). Certified locally and on a Vercel preview; NOT yet deployed.** Landing follows the moderator's batch push as its own release.
  - **Interface.** A full-screen Google map under a compact header, with one draggable bottom sheet (peek/half/full, pointer-driven with flick velocity) on phones and one floating panel on wide screens. The map region is sized to what the sheet leaves, so Google's attribution is never covered. Evaluation is automatic (no submit); the long form (conditions, Ready to Hunt, legal time, weather, sources, Hunt Brief) is a lazy chunk behind "Details". Date is Today or Choose date; no other presets (owner decision 2026-09-22). "Use my location" prompts only when pressed; denial, timeout, low accuracy and unsupported browsers each get a sentence and search stays one tap away. The crawlable "How North Ground Hunt works" section is server-rendered in the sheet below the actions.
  - **Code.** `src/components/hunt/HuntApp.tsx` (orchestrator), `HuntMapView.tsx`, `HuntSheet.tsx`, `sheet/` (search, species, date, layers, zones, zone context, answer, lazy answer detail), `map/` (Google controller, overlays, loader, geometry hook). Pure, tested state in `src/lib/hunt/exploration/`: `url-state`, `hunt-session` (answers keyed by an evaluation key; stale responses dropped), `sheet`, `geometry-store`, `date-presets`, `share`, `map-labels`, `overview`, `overview-poster`. Deleted: `HuntComposer`, `HuntMap`, `ZoneCard`, `DateField`, `SpeciesSelect`, `HuntResult`, `Hunt.module.css`. Answers post through the shared `evaluateRequestBody` (`answer-payload.ts`); the UI never sends `includeGeometry`.
  - **Geometry.** The whole served overview (461 zones, zoom-6 generalisation) loads once and is never dropped; detail levels (zoom 8/10/12) replace it per grid-snapped box with sequence ordering, abort ground the view has left, and reuse answered boxes for two minutes. Stress test (15 zoom steps × 3 rounds + 6 pans at 1440 px): 461 zones drawn throughout, minimum 461, one geometry request, no repeats. Polygons are updated in place, labels are placed with hysteresis and culled to the view.
  - **Deep links.** `/hunt?zone=ca-on-wmu-57&species=white-tailed-deer&date=2026-09-22&explore=1`: never coordinates; each parameter validated alone (bad ones dropped with a notice); a zone restores only after the drawn geometry confirms it; `/hunt` stays canonical while `generateMetadata` names the view. Share: native sheet or clipboard copy; text names species, zone, jurisdiction and date, never a status.
  - **First paint.** The page preloads the overview request and the Maps script, and inlines a server-drawn SVG of the same overview answer in the live map's projection and camera (30.9 KB data URI on the preview), cached per served-geometry version and deployment for six hours. It is drawn only from a complete answer — any authority failing means no poster — and fades as the live map draws. On the preview the inlined poster is byte-identical to `posterSvg()` of the live `/api/hunt/zones` overview (461 zones: ON 151, MB 62, AB 189, QC 59; no unserved layer).
  - **Measured** on the deployed preview and production, same harness (`scripts/measure-hunt-performance.mjs`: Chromium, 390×844, 4× CPU, 150 ms RTT, 1.6 Mbps, cache off). Preview `cd2a78e`, 5 runs: LCP median **1.07 s**, max 1.998 s, every run's largest paint the poster, poster present in every run; first live zones 1.9 s; CLS 0.004; TBT 0; longest pan task 0 ms. Production on the same main, 3 runs: LCP median 1.18 s (max 7.0 s), first zones 4.7 s. First-load JavaScript at the load boundary: preview 186.6 KB brotli across 17 files, of which ~36 KB is the sheet's on-demand chunks, which now start only after the load event; production 158.9 KB across 9 files plus 15.7 KB fetched later. Tap a zone → card: one request (its whole-zone summary), title 21–47 ms, card 50–212 ms. Search "Bancroft" typed at 140 ms/key: one debounced autocomplete request, suggestions ~0.3 s after the last key; choosing it: four first-party requests (place, zone, zone summary, one detail geometry box), card in 0.39–0.89 s.
- **Zone presentation contract (2026-09-22, `CLAUDE.md` §41A).** `src/lib/hunt/zone-presentation.ts` derives full, compact, readable and accessible zone labels per locale (en-CA, fr-CA) from a per-layer data table, audited against all 461 certified zones. Identity (canonical id, source designation, official name) is unchanged everywhere. Map features, zone cards and `/api/hunt/zone` carry presentation beside identity; the engine's prose names Québec zones "Zone 10 West"; Hunt Briefs derive the label at render time from the stored id and official name. The old map's dense-area fallback no longer draws raw codes ("11O"). Tests: `zone-presentation.test.ts` (10), brief cases in `HuntBriefCard.test.tsx`.
- **Saskatchewan SERVES, from geometry North Ground stores no copy of.** 83 Wildlife Management Zones are read from the ministry's own service at request time; North Ground stores no copy, because the ArcGIS item says "Not for resale" despite the province's unrestricted licence (owner decision, 2026-09-22). Live-certified 2026-09-22: 265 points, 0 disagreements, 0 overlaps; authority p90 114 ms, production p90 141 ms (`fixtures/hunt/ca-sk-wmz-live-parity.json`). `layer:ca-sk-wmz` became `rulesServing:true` on 2026-10-01 when the rules landed — the first jurisdiction to answer regulatory questions over geometry that exists only as a live read, which is the case the provider abstraction was built for.
- **Newfoundland and Yukon are ingested and unserved.** Newfoundland manages each big-game species on its own map, so it is three species-scoped layers over one Wildlife Division service (NL Open Government Licence): 74 moose areas, 19 caribou, 7 black bear. Yukon is 443 Game Management Subzones, rebuilt from the service's integers as the territory writes them (417 -> "4-17"). Both are NEEDS_VERIFICATION, so no point resolves to them and nothing of them is drawn. Records the authority itself excludes are quarantined with its own words and never renumbered: NL's four national parks, the Nunavut sliver, area 000 "Not Applicable" and area 099 "Not a Newfoundland Caribou Hunting Zone"; Yukon's 102 and 103 over Ivvavik and Vuntut National Parks. Production now holds 1,229 zones: 461 VERIFIED (ON 151, MB 62, AB 189, QC 59) and 768 unverified (BC 225, NL 100, YT 443).
- **Ontario, Manitoba and Alberta draw from stored drawings.** The map reads North Ground's stored drawings of the parity-certified copy, with each authority's service as fallback; point answers still ask the authority and still use full geometry. Measured on a local production build, `/api/hunt/zones` at zooms 4/7/10/12 over each province: p50 1,520 ms → 175 ms, p90 2,257 ms → 516 ms. Stored drawings deviate from the certified geometry by at most 16.7 m, the level-0 tolerance.
- **British Columbia serves a first rules wave (2026-09-23).** `rulesServing` is
  on. 79 rules from B.C. Reg. 190/84 (consolidated to 2026-09-15), certified for
  2026-07-01 → 2027-06-30, reaching **221 of the 225** Management Units for
  **seven** species: ruffed, spruce and sharp-tailed grouse, rock and willow
  ptarmigan, snowshoe hare, black bear. PARTIAL, never VERIFIED — every other
  species, the remaining four units, and any date outside the certified period
  answer UNKNOWN or NEEDS_VERIFICATION. **20 of 20 production cases agree with
  the law**, each written from the regulation before the run.
  **Three cross-check disputes are encoded and unresolved by design**, and
  surface as CONFLICT stating both readings: the spring black bear closing date
  (regulation June 20, synopsis June 30) and a September 1–9 youth grouse season
  the synopsis prints that Part 1 of Schedule 8 does not list (on both ruffed and
  spruce grouse). `british-columbia-served.test.ts` pins all three by their
  quoted text, so a rebuild that quietly picks a side fails.

- *Superseded 2026-09-22:* **British Columbia was ingested and unserved.** 225 Management Units from the province's WFS (`WHSE_WILDLIFE_MANAGEMENT.WAA_WILDLIFE_MGMT_UNITS_SVW`) are published as NEEDS_VERIFICATION with all derivatives, certified 225/225 against the province (890/890 authority-derived points). The first rules wave from B.C. Reg. 190/84 (79 rules, 2026-07-01 → 2027-06-30) and 20 production cases are committed. `layer:ca-bc-mu` is `serving:false`, so Hunt answers nothing British Columbian: no rules entry, not listed as covered, nothing drawn, and a BC zone is never presented (`british-columbia-unserved.test.ts`). Serving waits for the rules certification and the moderator's GO.
- **Every served zone has lookup derivatives.** Point-lookup parts, boundary parts and five drawing levels exist for all 686 published zones: ON 151, MB 62, AB 189, QC 59, BC 225. A database invariant (migrations `20260922190000` and `20260922200000`) now refuses a VERIFIED zone without them. Changing a zone's boundary drops its stale derivatives, so a zone must be built before it is promoted.
- **Zone resolver in PL/pgSQL, planned per point.** Same signature and answers. It finds zones only through their parts, and as a safety net it raises into the official-GIS fallback if a part-less VERIFIED zone ever lies under the point. Warm in-database: WMU 26 9.8 ms (was 460 ms cold), Québec zone 21 8.6 ms (was 1.5–5 s). Production Québec zone lookup median 258 ms / p90 846 ms (was p90 6.7 s). Proven by the 686-zone authority audit (2,767 points, 0 disagreements), a 1,102-point replay (0 differences old vs new) and the Québec 21-case suite (21/21).
- **Regulatory special areas are stored where the licence allows.** Migrations `20260922170000` and `20260922180000` add `regulatory_special_areas`, staged batch publishing and `special_areas_at_point`. Manitoba's four layers (closed lands 24, refuges 71, special conservation areas 7, WMAs 129) are stored under the OpenMB licence. Hunt reads a layer from the store only while it is CURRENT and was loaded against the exact committed catalogue; otherwise it asks the live service. Stored vs live at 225 Manitoba points: 0 differences; the zone index rebuilt from the store equals the committed one. `node scripts/ingest-special-areas.mjs --jurisdiction ca-mb --check` is the change watch.
- **Source records can carry licence and attribution.** `SourceRecord.licence` and `SourceRecord.attribution` are optional, validated as non-empty trimmed text. Manitoba's four ArcGIS sources carry the OpenMB statement.
- **Fixes landed 2026-09-22.** Unknown species profiles now 404 with a server-rendered body (the live-image `force-dynamic` had defeated `dynamicParams`; `src/proxy.ts` answers unpublished slugs first). Alberta deer's antler-class answer is posted as `animalClasses` (`src/lib/hunt/answer-payload.ts`); the old key was refused with 400 in production. Alberta's WMU service omits records from some envelope answers while counting them (WMU 214 near Calgary); a short answer is re-asked by object id and accepted only if every counted id arrives exactly once (110/110 Alberta cells, 189/189 WMUs). The Ontario readiness builder keeps quote dates while a source is unchanged, so `build:regulations` is byte-identical again.
- Flagship product under active development.
- **Zone certification completed 2026-09-21.** Ontario 151/151 (608/608 authority-derived points), Manitoba 62/62 (249/249), Alberta 189/189 (763/763), and Québec 59/59 (257/257) have no missing, invented or geometry-disagreeing zones after the documented Québec Zone 18 normalization. Public map delivery returns the complete inventory for all four at zooms 4, 7 and 10. Ottawa → WMU 64B, Winnipeg → GHA 38, Edmonton → WMU 247, and the official-name coordinates for both Maniwaki and Déléage → Québec 10O agree with the authorities. Evidence and the permanent gate are in `fixtures/hunt/*zone-certification.json` and `docs/hunt-zone-certification.md`.
- The Québec ministry's current Zone 18 aggregate contains a zero-area self-intersection at `-69.92999105 48.24828929`. Staging repaired it with `ST_MakeValid`; the valid 310-polygon result is topologically equal to the previous production boundary with `0.000000 m²` symmetric difference. Only Zone 18 was promoted and its 400 spatial parts, 433 boundary parts and stored drawings were rebuilt. Any future normalization over 1 m² fails closed.
- The non-derivative boundary fallback now segmentizes sparse authority edges before the geography cast. At one near-edge sample per zone, the former maximum error against that straight-edge reference was Ontario 234.352 m, Manitoba 9.301 m and Alberta 0.522 m; the served expression now is the reference expression. All 402 inside-edge membership samples remain resolved.
- Map authority calls now issue an identical spatial count request and refuse short or over-limit geometry responses; stored drawings refuse a saturated 400-row result. Québec cardinal labels are readable (`10O` → `Zone 10 West`) while the official designation and `Zone de chasse 10O` remain unchanged.
- Intended capability: location/date/species → zone + season + applicable rules + authoritative sources + environmental context + North Ground knowledge.
- Architecture should support international expansion while initial verified coverage is developed jurisdiction by jurisdiction.
- **Map intelligence direction expanded 2026-09-21.** `CLAUDE.md` §41B now permanently defines one Hunt map with EXPLORE, FIND GAME and CHECK HUNT; the user-facing name **SPECIE HEAT MAP**; Crown/Public Land; Potential Hunting Areas; evidence, land, access, condition and offline-planning rules; and strict separation of opportunity, legality, ownership and access. It preserves §41A's regulatory engine, explicit Hunt point and self-location privacy requirements.
- The shared foundation is implemented locally under `src/lib/hunt/intelligence/`: canonical source/licence, evidence, land/access, coverage, layer/mode and opportunity-result contracts; immutable `opportunity-v1` classification; conservative Potential Hunting Area composition; and tests proving heat/range/public ownership cannot create a legal status. `docs/map-intelligence-foundation.md` is the implementation handoff.
- The service-role-only PostGIS design is in unapplied migration `20260921093347_map_intelligence_foundation.sql`: sources, datasets, species evidence, land, access, layer coverage, versioned methodologies and derived scores, with GiST indexes and RLS. It remains unapplied while database/migration reconciliation is actively owned elsewhere; no production table is being claimed.
- The first real intelligence dataset is integrated from Ontario's openly licensed **White-tailed deer hunting activity and harvest** CSV (`sha256:b91f14b…`). The deterministic bundle preserves 1,983 WMU-year observations from 2008–2025. For 2025 it publishes 232 evidence components across 116 WMUs: estimated total harvest and the disclosed derivative estimated harvest per estimated active resident hunter. Coverage is PARTIAL DATA, confidence MODERATE, and the authority's sampling/statistical-error limitation is carried into every result. This is historical opportunity evidence, not current presence, legality, ownership or access.
- `GET /api/hunt/opportunity` is a bounded/cacheable server endpoint keyed by canonical species and management-zone IDs, not precise coordinates. It currently serves only Ontario white-tailed deer WMU evidence, returns `legalStatus: null`, and returns explicit `NO_HEAT_MAP_DATA` elsewhere. It is not yet consumed by the active map UI.
- `content/intelligence/source-registry.json` records exact investigated datasets and blockers. Ontario's unpatented Crown-land layer is LICENCE_PENDING until mixed OGDE-only features, service schema and exclusions are certified; CLUPA Provincial is rejected for ownership because the authority expressly says not to use it as Crown/private boundaries; 2025 Ontario CWD surveillance is LICENCE_PENDING; in-year fire perimeters NEEDS_VERIFICATION. None of those geometries was copied or rendered.
- Daily source monitoring now checks the intelligence bundle as well as regulations. A hash move stops and opens the review path; publication remains a human decision.
- An isolated research foundation now exists in `research/hunting/`; it is an inventory/review input, not production rule data.
- The first certified vertical slice is implemented locally for ruffed grouse in Ontario WMU 57 using the 2026 Ontario small-game table. An official Ontario GIS feature service resolves the point to a WMU; the deterministic evaluator returns `CONDITIONAL`, `CLOSED`, or an explicit unknown/verification state and never infers legality from editorial content.
- Hunt keeps regulatory evidence, environmental context, and North Ground knowledge as separate response layers. Exact legal astronomical times, municipal discharge rules, land access, Sunday gun-hunting rules, protected areas, and overlapping restrictions remain outside the certified result.
- Evaluated Hunt results can now be projected into privacy-safe, versioned Hunt Brief snapshots and shared through opaque `/hunt/share/[shareId]` URLs. The projection preserves the engine's exact status, excludes coordinates and raw location inputs, and stores only an explicitly approved coarse location label. Snapshots persist to Supabase; Upstash has been removed from the code and the dependency list.
- Hunt is now a map-first application at `/hunt`, built to the approved premium glass direction recorded in `CLAUDE.md` section 41A. It opens on official Ontario Wildlife Management Unit boundaries before anything is typed, so a first-time visitor sees hunting zones rather than a coordinate form.
- Zone geometry is served by `GET /api/hunt/zones` from the Government of Ontario feature layer: viewport-bounded, generalised server-side by a tolerance chosen from the requested zoom (`maxAllowableOffset`), capped at 400 features, and cached for six hours on a snapped viewport key. The whole province at the opening zoom is roughly 35 KB across 151 units. A provider outage returns `PROVIDER_ERROR` and an empty map; no approximate boundary is ever drawn.
- Per-zone coverage is distinguished on the map and in the composer: `VERIFIED` for a zone with a certified regulatory record (currently WMU 57 only) and `IN_DEVELOPMENT` for a zone whose official boundary is known but whose rules are not certified. Drawing a boundary is explicitly not a claim about the rules inside it.
- `POST /api/hunt/zone` resolves a point to its official management zone from location alone, with no species or date. It returns zone identity, jurisdiction, coverage and boundary proximity, and deliberately returns nothing about legality.
- The Hunt interface assembles progressively: location resolves the zone, date enables time-specific evaluation, species completes the regulatory overview. The overview separates regulatory, environmental and editorial layers into tabs that appear only when they have real content.
- Location is entered through one place-search composer with Google Places where a key is configured and Nominatim otherwise; attribution follows whichever provider answered. `Use my location` is a separate explicit action. Coordinates appear only as secondary detail on a previewed map point and are never the primary input.
- Date entry is `Today` plus `Choose date` only. The canonical display format is `YYYY/MM/DD` with progressive numeric entry (`20260808` becomes `2026/08/08`), pasted ISO and slash forms normalise, and impossible dates are refused with a plain-language reason. The text field and the accessible calendar share one ISO value and cannot disagree. Covered by 19 tests in `src/lib/hunt/date.test.ts`.
- Ontario major game is wired end to end as of 2026-09-20. `evaluateHunt` routes by how the province publishes a species: small game answers from location, date and species and asks nothing; deer, turkey, black bear and moose go to `evaluateOntarioMajorGame`, which asks only what the applicable rules disagree on, one fact at a time, with its reason and source section. All eight certified species are now selectable, and the selector distinguishes "Rules available" from "Rules available · asks a question".
- `HuntEvaluation` carries `completeness` separately from regulatory status, so NEEDS_INPUT (North Ground knows the law and needs a fact) can never be rendered as UNKNOWN (North Ground does not know the law) or as CLOSED. While a question is outstanding the regulatory placeholder is `NEEDS_VERIFICATION`.
- Answers are untrusted at two layers. `/api/hunt/evaluate` refuses anything that is not a known dimension key with a bounded string value, and the engine then refuses any value its own dimension did not offer. Certified live: an invalid residency or implement leaves the question outstanding and never produces a status. Answers are cleared whenever species, place or date changes.
- Hunt Brief is at schema version 3. Version 2 records the assumptions a result depended on in the words the question used; version 3 adds a compact Ready to Hunt checklist (licences with year-labelled fees, hunter orange, legal methods) and structurally has no field for a vendor, purchase link or location. Versions 1 and 2 remain readable as written and cannot acquire assumptions or a checklist from their stored payload.
- Canada coverage is machine-readable. `src/lib/hunt/canada/registry.ts` declares all thirteen provinces and territories plus the federal layer with each authority's own management term, official source and known gaps; `report.ts` computes every count from the certified bundles at call time. `npm run report:canada` renders it, `-- --json` emits it.
- Hunt answers by the jurisdiction of the RESOLVED ZONE, never by the box a point falls in (`77e259b`). `src/lib/hunt/regulatory/registry.ts` is the one list of jurisdictions with certified rules and how each is evaluated: Ontario on its own engines; Manitoba, Alberta and (when served) Québec on the shared conditional engine. Hunt's evaluation, the national coverage report and the species surfaces all read it. An entry counts only while its zone layer is served, and `regulatory/registry.test.ts` holds that every served layer has an entry, so coverage can never claim a place Hunt cannot answer. A point no authority places is attributed to a jurisdiction only when exactly one registered extent contains it; otherwise it gets a neutral NEEDS_VERIFICATION, never Ontario's wording (`c077595`).
- The map draws every served jurisdiction in view, each asked of its own authority in parallel and labelled in its own terms (`beb8f7f`): WMUs and GHAs appear together from Kenora to Winnipeg. Features and the selected zone are keyed by layer, because designations repeat across jurisdictions. One authority failing returns `PARTIAL` with the others drawn and the failed service named. The share brief, the question source line and the coverage copy take the zone's own jurisdiction instead of hard-coded Ontario.
- **The map is an exploration surface (2026-09-21, direction in `CLAUDE.md` §41A).** Code lives in `src/lib/hunt/exploration/` (domain, server) and, since the map-first rebuild, `HuntApp.tsx`, `HuntMapView.tsx`, `sheet/ZoneContext.tsx`, `ZoneCanvas.tsx` and `map/` (presentation).
  - **Labels.** Every drawn zone carries its authority's designation in its own terms (WMU 57, GHA 26); Québec's simple cardinal suffixes are expanded for readers (`10O` → `Zone 10 West`) without changing the stored official identifier. Labels are placed at the pole of inaccessibility of the largest part and decluttered per frame. Alberta publishes WMUs 718, 728 and 794 as 6, 3 and 3 records; `fetchLayerGeometry` merges records by designation, so a multipart zone is one feature with one label.
  - **Zone cards.** Tap a zone, or pick it from the keyboard-accessible "zones in view" list, to open a card (bottom sheet under 700 px, floating panel beside the zone above). `GET /api/hunt/zone-summary` runs every certified species of the zone's jurisdiction through the jurisdiction's own registry entry with a new `scope: "ZONE"` — the same engine as a full Hunt, asked about the whole zone. In zone scope the geography worlds treat every point-dependent fact as open (game bird zone lines, CFB Shilo, Oak Hammock), so the card answers only where the whole zone agrees. States: In season (engine CONDITIONAL — never "open"), Depends on your hunt (NEEDS_INPUT, with the engine's first question), Needs a closer look (varies in the zone or outside the certified period), Sources disagree, Closed, Not covered here (UNKNOWN), Not certified. Certified requirements in force that day are listed verbatim; Manitoba's cards say refuges, SCAs, WMAs and closed lands are checked only at an exact point. ~0.1 ms per zone per species, cached per zone/species/date.
  - **Species filter.** `POST /api/hunt/zone-status` returns one species' state for the zones in view (≤450, the same cached evaluation). Zones are tinted AND labelled with a glyph, and the legend names each state in words.
  - **Self vs hunt location.** The device location is a blue dot with an accuracy ring, requested only by the recentre control (or shown silently if permission was already granted), held only in map state, never sent anywhere. The hunt location is a distinct bone pin set only by a search result, a confirmed map pin or "Use my location" (named "Hunt at my location" between 2026-09-21 and the map-first rebuild). `map-state.ts` is the one interaction machine; a 5,000-step property test holds that no other event changes the hunt location, and a source test holds that the app and answer views never read the device fix.
  - **Drop pin.** Long press (pointer-timed, so it works on iOS), right-click, or the pin control previews a point with its zone ("Hunt here? · GHA 25A · Manitoba"); only "Check this location" makes it the hunt location. A plain tap never does.
  - **Address → zone card.** A chosen search result sets the hunt location, resolves the zone, highlights it, frames it beside the card and opens its card. Near a boundary, the composer and card name the neighbouring zone from the drawn geometry ("Near the boundary of WMU 57 and WMU 61").
  - **Layers.** Management areas are always shown, each layer disclosed with its authority and standing. Manitoba's four authority-served special layers can be switched on (`GET /api/hunt/overlays`), drawn with a dashed amber outline, and tapped for the authority's verbatim restriction text and its legal standing. No other jurisdiction offers one yet, and none is invented.
  - **Restricted areas inside a zone (2026-09-21, follow-up).** `scripts/build-overlay-zone-index.mjs` asks Manitoba's own refuge, SCA, WMA and closed-lands layers which features overlap each GHA's full-resolution polygon (intersecting minus merely touching the edge) and commits `content/regulatory/ca-mb-overlay-zones.json` (62 GHAs, 59 with at least one area). In whole-zone scope the registry applies the same `restrictionsFor` token logic as a point answer: where an area inside the zone reaches a species whose season otherwise runs across the zone, the card says "In season outside restricted areas" (new state `SEASON_EXCEPT_AREAS`) and lists each area with its verbatim restriction and the species it affects. GHA 38: grouse in season except inside the Winnipeg, Rosser and Macdonald portions; the Macdonald text ("…big game animal other than white-tailed deer") correctly does not reach deer. The index rebuilds byte-identically and is part of `build:regulations` (CI diff) and `check:regulatory-sources` (daily watch). A zone missing from an index is reported as unchecked, never as "none".
  - **Ontario wide views lost units (found by the Canada clean-up session).** LIO's WMU service silently drops units from wide envelope queries — 34 of 39 for a 22°-wide view, 4 for 65° — while 5°-wide queries are complete. Production drew 96 of 151 Ontario WMUs at zoom 4. `fetchLayerGeometry` now clamps every view to the layer's extent and asks a layer with `maxQueryLongitudeSpan` (Ontario: 5) in longitude tiles, cached per tile, de-duplicated by record id then merged by designation. One failed tile fails the layer rather than drawing part of Ontario as all of it.
  - **Stored drawings.** A layer may draw from North Ground's stored PostGIS drawings (`mapGeometry: "stored"`, via the Québec session's `zone_display_in_view`, level chosen from the zoom's tolerance), falling back to the authority's service where there is one. Québec uses it: its ministry serves WFS, not ArcGIS, so without this its zones would not have drawn when switched on. Drawings are accepted only when their designation mints the same canonical id the rules use. Unserved layers are never drawn. A test switches Québec on and confirms stored drawings labelled "Zone 10E", cards from Québec's own engine ("Zone de chasse 10E"), and species names from the library ("Arctic hare"). Ontario, Manitoba and Alberta have no stored drawings yet (0 of 402 zones in production); switching them to `"stored"` needs `build_zone_derivatives` run for each zone, which is a production write to schedule one jurisdiction at a time.
  - Species gates (`/api/hunt/zone-status`, `/hunt?species=`) now use the Canada clean-up session's `isCertifiedSpecies`, so a species a served jurisdiction certifies (Québec's arctic hare and eastern cottontail) is accepted; the composer and selector carry canonical species ids rather than the Ontario-only type.
  - **Resilience.** A refused Google key (wrong referrer, billing) is reported only through `gm_authFailure`, after load, leaving a grey map; Hunt now listens for it and falls back to the boundary view. The boundary view gained labels, markers, overlays, long press, and keyboard pan/zoom.
- **Ready to Hunt (2026-09-21, direction in `CLAUDE.md` §41A).** A permitted hunt (CONDITIONAL) now answers "what do I need before I can go?" in its own panel under the answer. Code: `src/lib/hunt/readiness/` (domain: `types.ts`, jurisdiction-neutral `resolve.ts`, `ontario.ts`, `vendors.ts`, `format.ts`), `ReadyToHunt.tsx` and `VendorSearch.tsx` (presentation). `evaluateHunt` attaches `readiness` from the same inputs and answers as the regulation; nothing is asked twice.
  - **Data.** `scripts/build-ontario-readiness.mjs` builds `content/regulatory/readiness/ca-on-2026.json` from O. Reg. 665/98 (e-Laws API, consolidated text), the 2026 fee page and the summary pages, and `ca-on-licence-issuers.json` from LIO's licence-issuer layer (503 issuers, OGL–Ontario). Every quoted passage is verified verbatim against its source (`<main>` text only, since the summary pages inject a per-request bot token) and every fee line must exist exactly, or the build fails and writes nothing; builds are byte-identical and it is in `build:regulations` (CI diff) and `check:regulatory-sources` (daily watch).
  - **Authorizations** are records of a general kind (licence, tag, validation, stamp, draw, federal permit, …) with official names, authority, applicability, prerequisites, purchase channels, provenance and fees; requirements compose federal (firearms licence, RCMP, for gun hunters only) and provincial. Ontario: hunter education → Outdoors Card, small game licence, turkey = small game licence + turkey tag (s. 28(4)), deer, bear (+ non-resident validation certificate through a licensed operator, s. 53), moose licence and draw tag (party exception stated). An unencoded requirement shows as UNKNOWN, never disappears.
  - **Fees** show only for the licence year in force and a known residency; otherwise the hunter chooses Resident/Non-resident inline (the same `RESIDENCY` answer the engine reads) or the line says "Check current official fee". Published fees before 13% HST, labelled so.
  - **Hunter orange** follows s. 26 across species: required whenever a deer, moose or elk season other than bows-only is open in the unit (general, elk and 78 controlled deer / 3 controlled moose hunts), conditional for bear hunters (tree stand), exemptions (4)(a) and (4)(c) applied. Elk season 21 Sept–4 Oct in WMUs 57, 58, 60–62 and 63A means a grouse hunter there today needs orange.
  - **Methods and ammunition** come from the engine (major game, turkey) or the small-game table, with the rifle restriction stated as in force when a big-game season is open. North Ground recommendations (upland, hare, turkey) are labelled "Recommended — not a legal requirement", checked against the legal restriction at build time; none for big game.
  - **Vendor search** is a separate `VendorSearchLocation` type in a local reducer. "Find a licence vendor near me" asks the device once, only when pressed, with the stated explanation; distances are computed in the browser against the lazy-loaded issuer list (its own ~135 KB chunk); nothing is sent, stored or shared. Denied permission opens "Search another location", which sends only the typed text. Tests prove zone and weather are evaluated at the hunt location only and the result is identical however the vendor search moves.
  - Other jurisdictions return coverage UNAVAILABLE with a link to the source their answer already cites.
- Where no Google Maps browser key is configured the map falls back to a basemap-free boundary view that draws the same official geometry, supports pan, zoom and zone inspection, and labels itself as having no basemap. It is not a substitute basemap and invents no geography.

### Content / Knowledge Graph
- Structured content system being developed in parallel with Hunt.
- Editorial standard: maximum useful information with minimum necessary words.
- Species, conditions, clothing, packing, skills, regulations and related entities should be reusable by the application.
- Shared content contract v1 is defined in `docs/content-system/` with canonical ID, species/resource, App Block, deterministic matching, relationship, source, media, URL, quality and lifecycle rules.
- Storage-neutral TypeScript contracts live in `src/lib/content-contract/`. The strict validated production bundles are `content/published/en-CA.json`, `species-wave-1.json`, and `species-wave-2{a,b,c,d}.json`; `src/lib/content/repository.ts` provides canonical entity/resource/source lookup, alias- and terminology-aware species search, exact-species media gating, deterministic App Block matching, related-resource lookup, and URL resolution without binding the product to a CMS.
- Waves 1–2 publish 60 source-backed species profiles: 10 foundation profiles plus 17 mammal/predator/furbearer, 8 upland/migratory-bird, 20 waterfowl and 5 broader-big-game profiles. Search distinguishes canonical species from biological sex/age and source-defined regulatory-class intent (`doe`, `antlerless deer`, `bull moose`, `hen turkey`), while broad terms such as `rabbit`, `wolf`, `fox`, `duck` and `goose` return choices rather than fake species. Hunt coverage remains independent and comes only from the regulatory coverage registry.
- **Species images (2026-10-01):** 269 of 485 species show a PRIMARY image; 216 show the neutral placeholder. Precedence is MANUAL > verified provider image > placeholder (CLAUDE.md §16). Administrator images are re-encoded into private storage; Unsplash images are hotlinked with a visible "Photo by … on Unsplash" credit and are kept off Hunt's compact avatars, which have no room for one (`uncreditedSurfaceMedia`). Adobe Stock images are stored as MANUAL images through `uploadSpeciesPrimary`, never hotlinked. A photograph is accepted only when its caption or Adobe title names the exact species (binomial → VERIFIED, identifying common name → HIGH_CONFIDENCE) and it passes a reject-only visual check. Every species has one row in `content/species-media/image-manifest.json`; `docs/species-images-audit.md` is the readable audit. Tooling: `npm run species:images -- <run|verify|sheets|publish|owner-upload|report|manifest>`.
- The species library and every canonical species profile now render in the Hunt product visual language rather than the separate editorial identity they had developed. They carry Hunt's floating glass navigation, its atmospheric ground, its Inter type scale, its glass panel/card hierarchy and its primary/quiet action pair. Hunt was not changed to meet them: the only edit to Hunt was replacing its `.page` background literal with the shared `--ng-product-bg` token, which computes identically.
- Shared product primitives were extracted into `globals.css`, which `CLAUDE.md` section 41A already names as the single home for Hunt's tokens and surfaces: `--ng-product-bg`, `.ng-product-page`, `.ng-shell`, `.ng-coverage`, `.ng-action`, `.ng-action-quiet`, `.ng-section-title` and `.ng-breadcrumb`. `HuntNav` gained an optional `current` prop so the same navigation serves `/hunt` and both species routes. The species route stylesheets now hold layout only and no longer define colour, blur, border or radius values of their own.
- `.ng-coverage` is deliberately separate from the regulatory `.ng-status`. Coverage answers WHERE North Ground holds certified rules for a species; regulatory status answers what those rules say for a location and date, which only Hunt can do. A library card can never imply a season.
- Coverage is per jurisdiction, not a global species flag (2026-09-21, `f36cb41`). `regulatoryJurisdictionsForSpecies()` in `src/lib/hunt/canada/report.ts` reads the computed national coverage report, so the library, every profile and the Hunt selector show `Rules: Ontario` (or several jurisdictions) and knowledge-only species show `Knowledge profile · no certified rules`. White-tailed deer rules in Ontario say nothing about Québec, Manitoba or Alberta deer, and the interface no longer implies they do. A jurisdiction that wires its certified bundle into the report is picked up everywhere without editing a species profile.
- Before a place is chosen a species is discoverable wherever rules exist; once a zone resolves, only rules for THAT jurisdiction make it evaluable, and "asks a question" is judged per jurisdiction. The zone endpoint returns the resolved layer's `jurisdictionId`. A profile may preselect its species in Hunt (`/hunt?species=`), but Hunt still refuses to evaluate it where the resolved jurisdiction has no certified rules. The selector payload stayed the same size: 24,468 bytes raw / 3,655 gzip for 60 species (26,084 / 3,686 before), with no profile content.
- The library is a filtered discovery surface rather than fourteen stacked category sections: one search field over server-assembled search terms, plus category filter pills whose counts follow the current query. It ships 60 species in 11.8 KB on the wire, the same order as Hunt itself, and carries no deep profile content in the list payload.

### Field Testing
- Methodology planned.
- Original North Ground field data should become a long-term authority moat.

### Cold / Winter
- Identified as an early topical-authority wedge.
- Cold is an entry strategy, not the permanent limit of the brand.

### Crown / Public Land
- Identified as another major future data/content/tool opportunity.

## In Progress

- **Every non-resolved answer carries its cause, structurally (API lane, step 3 of the authorized sequence, 2026-10-07).** Landed as `e016bdfd`, `e9357796`, `216eb3f8`, `a4419bb7`.

  **What was wrong.** CLOSED, UNKNOWN, NEEDS_VERIFICATION and CONFLICT were four words over seventeen different facts, every one of them reaching a consumer as prose and nothing else. §8's rule — a fact that lives only in a display string is not resolved — applied to exactly the states that had only a sentence.

  **`RegulatoryResult.closure`** carries five causes, one per site: `UNLISTED_PLACE` (with the authority's own words for the absence rule, already provenanced in 6 of 7 CLOSED-absence bundles and previously left behind in the bundle while our paraphrase went into the sentence), `DECLARED_NO_SEASON`, `NO_SEASON_OPEN_ON_DATE`, `NO_SEASON_FOR_THE_HUNT_DESCRIBED` (Ontario's tables permit the hunt on no date, so telling a hunter to come back another day would be wrong) and `AUTHORIZATION_COVERS_ANOTHER_AREA` (a tag whose area is elsewhere is not a closure of this place). Wired at eight sites: three in `conditional-engine.ts`, two in `federal.ts`, two in `ontario.ts`, one in `major-game.ts`. **648 CLOSED answers had no cause at all** after the first pass — every one the hunt-code site, which is unreachable until a hunter describes something, and the first sweep ran without answers and reported zero missing.

  **`RegulatoryResult.unresolved`** carries eleven reasons across thirteen sites, including `evaluate.ts`. The ones that were previously indistinguishable and are not the same work: `SPECIES_NOT_CERTIFIED` (a gap the owner can close), `SPECIES_NOT_NAMED_BY_THE_INSTRUMENT` (a fact about the law), `SEASON_NOT_ENCODED` (the Regulations set one and North Ground declined, each refusal with its reason), `MODEL_LACKS_A_REQUIRED_VALUE` (carrying the question, which is the difference between a gap and a shrug), `POINT_NOT_IN_AN_OFFICIAL_ZONE` with `providerOutage` (a failed authority service and a point no boundary covers shared one sentence; only the first is worth retrying). `WorldSet.unknowns` has declared `GAME_BIRD_ZONE`, `SPECIAL` and `DISPUTE` since it was written and `Outcome.reasons` kept only `statedAs`; the declared kind now survives.

  **`RegulatoryResult.conflict`** names the sides. §8 forbids choosing between disagreeing sources, so the whole value of a CONFLICT is showing both, and it carried neither. Manitoba's cross-check against its own guide is the corpus's only recorded dispute and the answer now states it: under the reading where M.R. 165/91 reaches GHA 7A through the range "5-8" there is a season (CONDITIONAL); under the guide's, which lists none, there is not (CLOSED). Ontario's overlapping groups and the major-game duplicate-unit guard each carry their two readings with the section each comes from.

  **The federal composition** takes the cause and the reason from whichever layer the status came from, generalising the rule `next` already followed.

  **An area's hunting effect is now its own field** (§41A, Saskatchewan ss. 7 and 7.1). `restrictionsFor` returns `AreaEffect`; the registry filters through `areaWithholdsSeason` before degrading a CONDITIONAL zone, so an area the authority DEEMS OPEN no longer reads as "the answer depends on where you hunt". Nothing infers an effect — an undeclared area is UNRESOLVED and withholds exactly as before, and every indexed Manitoba area is UNRESOLVED today across 40 designations. The mechanism is proved by changing one real area rather than asserted: Churchill Special Conservation Area declared DEEMED_OPEN stops withholding in Game Hunting Areas 1 **and 2** — it straddles both, which is why the expected set is derived from the index rather than written down — at the overlay level and again through the registry path the zone card reads, restoring exactly. `exceptInside` keeps its `string[]` shape, so the three `exploration/*` consumers are untouched. Saskatchewan itself has **no overlay catalogue**, which is why it could not be the subject. Naming a deemed-open area as open on the zone card is the surface half of §41A and is deliberately not built: no catalogue declares DEEMED_OPEN yet, and unreachable rendering code cannot be certified. West Virginia's CWD Containment Area and the Illinois closures are the first two waiting consumers (US GIS lane).

  **`/api/v1` remains nonexistent**, as the owner required until the three contract prerequisites are satisfied. Step 3 is done; step 4 is the locale/provenance contract.

- **One canonical opportunity set, and Ontario finally reaches it (Hunt UX lane, 2026-10-06).** Landed as `a0aa7b7e`.

  **The canonical path.** `opportunity-adapter.ts` turns certified rules into `ResolvedOpportunity`; the engine carries them on `RegulatoryOutcome.opportunities`; `zone-summary.ts` carries them onto `SpeciesZoneSummary`; `OpportunityRows` renders them with `opportunity-presentation.ts` and `opportunity-timeline.ts`. No presentation component reinterprets regulatory prose, and the map's green walks the engine's own answer tree (`opportunityOf`) rather than parsing anything.

  **The audit, over real certified bundles rather than reasoning.** 534 comparisons across 8 served layers, map green against zone-sheet rows: 190 green-with-an-open-row, **49 green with NO row** and 1 open-row-but-not-green. Every one of the 49 was Ontario — the only jurisdiction of fourteen whose `RegulatoryEntry` is bespoke rather than built by `conditionalEntry`, and the only one that never emitted opportunities at all (**37 of 37** open species-dates carried none, against **0 missing** in Manitoba, Alberta, Québec, British Columbia, Newfoundland, Saskatchewan and Idaho). The outline asserted a current legal opportunity while the card it opens had nothing to render but prose.

  **Nothing was extended to fix it.** The adapter already produced 114 rows from Ontario's major-game bundle unchanged; the entry never called it. `evaluateOntarioMajorGame` now wraps the ten-return-path core in one place that cannot be missed, and `BundleRule` declares the `windows` and `animalClasses` it had always carried but never typed.

  **Two recorded exceptions, both pinned in the test rather than only described.** Ontario small game — ruffed, sharp-tailed and spruce grouse, snowshoe hare — publishes a `seasonPhrase` with no derived ISO windows, so the adapter correctly yields nothing; deriving them is certified regulatory work, not an architecture change, and those four account for all 24 remaining green-without-rows. Idaho GMU 29 pronghorn carries three rows with two open on 2026-10-15 while the tree walk returns `green: false, coverage: NEEDS_CLOSER_LOOK, exhaustive: true` — controlled hunts, and whether a draw-qualified hunt is a CURRENT legal opportunity under §41A's amended green is **with the owner**, unchanged here.

  **The invariant is now a test.** `cross-surface-opportunity.test.ts` asserts the map and the zone sheet describe one opportunity set over real bundles — 194 species-dates compared with 100 green-with-open-row agreements as a derived positive control, since every assertion in it is satisfied by comparing nothing. The exception register is asserted LIVE at the unit each case was observed in, so an entry that stops excusing anything fails rather than quietly covering the next real divergence.

  **Ready to Hunt remains a separate source and is NOT yet converged.** It reads its own `content/regulatory/readiness/*.json` for methods, licences, orange and fees — facts the rules bundles do not hold — so it is a legitimate second dataset, but where it overlaps on legal methods there are still two truths, which is what `method-agreement.test.ts` exists to pin. Converging that overlap is the next piece of this milestone and was not attempted here.

- **The opportunity rows reach the zone card, and the browser found two defects both gates had passed (Hunt UX lane, 2026-09-30).** Wiring landed as `885ef14`; the two fixes are on `opportunity-ux`.

  `RegulatoryOutcome.opportunities` carries the engine's own selected rules from `registry.ts` through `zone-summary.ts` to `ZoneSpeciesAnswer`, which renders them with `OpportunityRows`. The reason it had to exist: `regulation.season` is ONE window with no animal class and no implement, so no card could render "antlered with a bow in October" beside "either sex with a rifle in November" from it. The rows are the engine's, not a second derivation — `opportunity-adapter.ts` converts certified rules into `ResolvedOpportunity`, and the component decides nothing legally material.

  Two decisions rather than plumbing. **Carried on the NEEDS_INPUT path as well**, which is the case they matter most in: the engine asks a question BECAUSE the seasons differ by class or method, so the hunter who has answered nothing is the one who most needs to see what exists, and requiring an answer first asks them to name the thing they opened the app to find out (§41A). **Carried whatever the state, CLOSED included** — a closed row's opportunities are the seasons that exist here and are not running today, which answers "when can I hunt this", while the row's own state still says it is not running now.

  **The rows replace the summary sentence where rows exist; the sentence stays where they do not; the status line stays in both cases.** §41A settles that rather than taste: prose never replaces a structured answer carrying the same information, and the leftover prose is then the redundant line §41A deletes rather than keeps for thoroughness.

  Absent on Ontario's `major-game` path, which does not emit it. **Absence is a gap in what is carried and never a statement that no opportunity exists**, and that is written into the field's own comment because the next reader will otherwise take an empty array for a closed season.

  **WHAT THE BROWSER FOUND, after 2,005 tests, lint and build were all green over both of it.** Québec Zone 10 West, white-tailed deer, 2026-10-05:

  1. **The filter shouted a token the card beside it rendered properly** — `ANTLERED or ANTLERLESS` in the control, "Antlered or Antlerless" on the card. A rule stating two classes is one season in which either may be taken, so the adapter joins them with `" or "`; the token is a COMPOUND, not a key. `presentAnimalClass` split before labelling, the filter did `ANIMAL_CLASS_LABELS[token] ?? token`. One token, two formatters, one component. Fixed by extracting `animalClassLabel` as the only place a class token becomes words — not by adding the compound to the map, because compounds are combinatorial.
  2. **Both filters were disabled in the live app.** `OpportunityRows` disables a control with no change handler, which is right for a static render; `ZoneContext` is a client component and never passed one. A control that renders and does nothing is worse than no control.

  **Why neither test could have caught the first one, which matters more than the bug.** The component test asserted `>ANTLERED<` and friends — a compound containing both tokens matches no pattern in that list. The corpus test reads `rule.animalClasses` from the bundle, where the tokens are still separate, so it could never see a compound the ADAPTER builds. Both measured what they could not have failed on. The replacement asserts a SHAPE over all visible text — any run of three or more capitals — and names what escaped.

  The filter is deliberately **not in the URL**: §41A lets a link carry durable intent only, and a shared link silently hiding four of a zone's five seasons would be wrong in the worst way, complete-looking. It is keyed by species, zone and date, so a filter cannot survive into a different question and empty a card that has answers.
- **One composer change is written, gated and NOT landed (metadata lane, 2026-09-29; lane stopped at its usage limit).** Branch `fix/composer-stays-top`, tip `897bcb4`.

  The composer layout fix itself is already live in `8902943`, reached independently: the CSS `order` declarations are gone from production and no `composerAnchored` class remains anywhere. That part of the branch is redundant and must not be landed.

  What is NOT on production and is worth keeping: **the timed 80 ms refocus at `HuntApp.tsx:189` still runs on every composer open.** The branch guards it behind an explicit `options?.focusField`, so only "search another place" moves the cursor into the field — tapping the field itself is already focused, and the second timed focus fired while the sheet was still rising under the keyboard. Landing it requires checking every call site passes `focusField` where it is wanted, or the field silently stops focusing.

  **The branch must not be landed as-is under any circumstances.** Its base is `02f68fd`, which predates the United States milestone, so a merge of it deletes `coverage-matrix`, `unsupported-response` and 976 lines of `jurisdictions.generated.json`. Rebase onto current production first.

  Their own first certification run was INVALID and they said so: it hit port 3104, which is a Codex worktree's dev server, so it certified another lane's code. The rerun against their own build was unfinished when the lane stopped.

- **The iOS keyboard accessory bar is Safari's, not North Ground's — unfixed and unverifiable here.** Reported by the owner from an iPhone with a screenshot: key, card and location-pin buttons plus a dismiss chevron above the keyboard. No North Ground component draws it; the input already carries `type="search"`, `inputMode="search"`, `enterKeyHint="search"`, `autoComplete="off"`, `autoCorrect="off"` and `spellCheck={false}`, and there is no `<form>`. Safari shows the AutoFill bar regardless — it disregards `autocomplete="off"` for AutoFill.

  One unverified hypothesis on record: `autoCorrect="off"` plus `spellCheck={false}` suppress the QuickType prediction row, so iOS fills that same strip with AutoFill buttons instead. No attribute change has been made to test it, and it can only be tested on a physical device. The dismiss chevron is native and cannot be removed by a web page.

  §41A now says "the search field carries search semantics so the platform treats it as a location search rather than as credentials or payment input". **That sentence is not supported by the evidence**: the bar appeared with those semantics already in place. It should be corrected or removed when the owner next rules on this section, or a later lane will read it as a requirement that production already violates.

- **Québec is certified and served (Québec session, 2026-09-21).** The 59 designations, rules, stored drawings and authority fallback are live; the fresh whole-layer audit above supersedes the earlier pre-serving point fixture.
  - Geometry: all 59 designations in PostGIS (9,509 polygons, 2,424,981 vertices), VERIFIED, with subdivided parts, boundary parts and stored drawings for fast lookup (`20260921034448`, `20260921035259`, `20260921085602`, `20260921201849`).
  - Fresh parity against the ministry's complete 9,503-feature WFS read: 257 independently derived points, 0 disagreements, including the official-name coordinates for Maniwaki and Déléage → 10O (`fixtures/hunt/ca-qc-zone-certification.json`).
  - Rules: `content/regulatory/ca-qc-2026.json`, 186 rules for 10 species (moose 46, deer 44, black bear 30, snowshoe hare, cottontail and arctic hare 12 each, three grouse 8 each, turkey 6), each in force for its own year or licence year, with 6 fragments kept unresolved on purpose. 58 of 59 zones have a certified rule; 19N has none.
  - Persisted through the shared publisher and read back identical: 196 rows, 51 groups, 424 memberships (`publish-quebec-regulations.mjs --verify`); sources registered in `20260921093010`.
  - The ministry's 130 territories closed to all hunting (`Chasse_Interdite`) are checked at the point; an answer inside one is NEEDS_VERIFICATION quoting the ministry.
  - Pages, designations, closed territories and the zone layer's fingerprint are in `check:regulatory-sources`; the regulatory drill (5) and GIS drill (9) pass.
  - The official-GIS fallback asks the ministry's WFS when PostGIS cannot answer; every Québec Hunt Brief shares; `fixtures/hunt/ca-qc-certification-cases.json` holds 20 production cases written from the law (20/20 in process).
  - `docs/quebec-regulatory-sources.md` has the detail and the serving order.
  - Zecs are still not hunting zones, and the TFS layer's licence is unsettled.
- Federal migratory birds. The only district layer located (ECCC, Québec) is marked Draft and states it has no legal value, so it fails the boundary standard. Certified geometry must come from the Migratory Birds Regulations text or a layer the authority stands behind. 25 waterfowl and migratory species have published biological profiles and no rules.
- British Columbia: 225 Management Units ingested, parity-certified and deliberately unserved (NEEDS_VERIFICATION); the first rules wave from B.C. Reg. 190/84 is committed and unserved. Serving waits for rules certification and the moderator's GO.
- Yukon: the 445-versus-443 discrepancy is reconciled (service features 102 and 103 lie over Ivvavik and Vuntut National Parks and stay quarantined); not ingested. Northwest Territories and Nunavut: spatial UNAVAILABLE, with the reasons in `src/lib/hunt/canada/registry.ts`.
- Atlantic Canada and the Prairies are ingested (Saskatchewan 2026-10-01; Nova Scotia, New Brunswick, Newfoundland and Labrador 2026-09-30). Prince Edward Island and Yukon remain: both are blocked on locating or reaching the authority's own seasons instrument, not on encoding it.
- Main site visual direction / hero.
- Hunting Intelligence application.
- Structured North Ground content/resource system.
- Search/keyword research informing Hunt terminology, URLs and content.

## Known Problems

- **A composed federal answer keeps the federal sentence even where the province's status governs (found 2026-10-07).** `composeFederalWithProvincial` sets `summary: federal.summary` unconditionally while `status` takes the province's where the province has certified a binding restriction. The new `closure` and `unresolved` fields deliberately follow the STATUS, which is the documented rule `next` already used — so on such an answer the structured cause and the sentence can describe different layers. The divergence predates these fields and no test asserts that a composed summary was derived from a composed cause. Regulatory lane.
- **/hunt HTML grew with the 485-species catalogue (2026-09-30).** Measured on production after `e7d12f7`: ~487 KB uncompressed / ~99 KB gzip (previous build ~317–336 KB uncompressed), full-response p50 0.58 s (6 samples); a species page p50 0.23 s, p90 0.49 s. Reduced in the follow-up by sending the picker options as tuples (`src/lib/hunt/species-option-pack.ts`, round-trip tested) and group names once: local build 387 KB uncompressed / 96 KB gzip. The remaining weight is the options themselves; the durable fix is to fetch the picker list when the picker first opens.
- **Group take rows (2026-09-30):** 770 authority group rows now resolve through one gate (NatureServe occurrence → take eligibility → same-jurisdiction closure), recorded with state and basis in `research/hunting/take-group-resolutions.csv`: SPECIES_ATTRIBUTED 470, PARTIAL_GROUP_WITH_EXCLUSIONS 52, GROUP_RULE_LEGALLY_APPLICABLE 38 (broad legal classes, no attributable members), NOT_RELEVANT 69, BLOCKED_SOURCE 29, **UNRESOLVED 132** (no authority membership read, or no candidate recorded here by NatureServe — e.g. Wisconsin "Scaup", Iowa "Pigeon"). Only a source-NAMED group can reach a LIMITED_TAKE species; nothing reaches NON_QUARRY/UNKNOWN (`src/lib/content/species-invariants.test.ts`).
- **Zone cards do not compose federal migratory rules.** `zone-summary.ts` answers "NOT COVERED HERE" for ducks and geese although federal rules are certified and served at the point answer (`evaluate.ts`). 54 species are FEDERAL_ONLY in `docs/species-readiness.md` for this reason. Regulatory lane.
- **North Carolina Administrative Code is HTTP-only.** 21 NC take rows cite `reports.oah.state.nc.us`, which serves no HTTPS; the content contract links HTTPS only, so those rows stay in the matrix as SOURCE_NOT_HTTPS and are not published. Most species keep NC listings from the NCWRC's HTTPS digest.
- **`certify-hunt-app.mjs` has two stale legal-hours assertions (pre-existing, found 2026-09-30).** In the scenario *what you need, before what you open*, "a resolved window shows the clock" reads `[class*=legalWindow]` and finds nothing, and "where it cannot be stated, it says so" still expects Québec to say *Not yet verified* although Québec's legal hours were resolved on 2026-09-29 (06:24 – 19:29 local time is what production shows). Both fail identically on `23ed04d` and on `1059d02`; the other 384 checks pass. The assertions need updating to the shipped behaviour, not the product.
- **This container's egress denies the government and survey sources.** `check:intelligence-sources`, `check:regulatory-sources` and the EWS check fail here with HTTP 403 from the proxy. That is a network fact, not a code failure; the runners reach them.
- **Species Heat — known limits.** (1) The client asks for the viewport plus a 30% margin, snapped to half-degrees; a continental phone view is one request of ~204 KB uncompressed (~11 KB gzip) and a desktop view ~466 KB (~26 KB gzip) — measured, and inside budget, but the whole-continent reply parses to a `Map` of up to ~100k cells. (2) Legend/summary name one layer's heading; mallard-type species with plots AND a field list both inside the key but the collapsed chip says "2 evidence layers". (3) BBS is a June breeding survey; every waterfowl/grouse surface carries that warning in the key. (4) At national zoom the 0.3° × 0.2° cells are a few pixels, so edges of support are still visible as soft blocks; at regional zoom they read as a field.

- **A live Québec surface shows untranslated French to an English reader, and the existing sweep cannot see it.** `regulation.summary` for Québec turkey carries « Du 24 avril au 18 mai 2026 » — French with no accent, cedilla or guillemet, so the orthography detector in `language-integrity.test.ts` scores it as not-French. Its own header already admits the class of blind spot; what is new is that it is **live**, and that it sits exactly where Québec's season text lives, because French dates are the common case.
  The same detector is wrong in the other direction too: built properly and refined once, it still fired on « Gouvernement du Québec » and « Règlement sur la chasse » inside English sentences, which §47 *requires* stay untranslated. **False positives on proper names, false negatives on unaccented French** — a complete demonstration, not an argument, that language must come from the record. §41A already says source language is metadata and never detection; this is the evidence. Recorded in `translation.ts` where the next reader will look.
  The fix is the `regulation.summary` structuring item below, not a better detector.


- **`britishColumbiaLegalTime` computes a window from an undefined timezone.** Called directly it returns "09:35 to 22:20 (undefined)" — a legal hunting window computed against nothing, rendered into user-facing text. It is unwired today (BC falls back to the static `legalTime` refusal, which quotes s. 14 (1) and names the real blocker), so nothing ships it. But the guard lives in every caller (`alberta.ts`, `federal.ts`) rather than in the function, so wiring BC up without remembering the guard emits nonsense. Push the guard down: no timezone, no window, `legalTimeNotCertified` instead. / Technical Debt

- **The Supabase advisor's INFO items are deliberate (assessed 2026-09-22).** 8 unindexed foreign keys (management_zones.source_id, regulatory_groups.jurisdiction_id/source_id, regulatory_rules.jurisdiction_id/source_id, regulatory_sources.jurisdiction_id, regulatory_special_area_layers.published_run_id, zone_ingest_runs.jurisdiction_id) and 4 unused indexes (regulatory_rules_lookup_idx, hunt_brief_snapshots_created_at_idx, zone_ingest_features_geometry_gix, regulatory_rule_sources_source_idx). None sits on a request path: Hunt evaluates regulations from the committed bundles, and those tables are a mirror for coverage reporting and the review lifecycle, joined only by the publisher and admin tooling. The indexes are cheap to keep and needed again the moment the mirror is queried or an ingest runs. Do not "optimise" them away.

- **Newfoundland publishes invalid geometry in four of its seven black bear areas.** Areas 200, 201, 205 and 206 arrive with ring self-intersections or nested shells. Each was repaired with `ST_MakeValid` under the standing guard and measured at 0.000000 m² symmetric difference, so no boundary moved; area 200 went from 4,221 to 4,210 polygons and 197,116 to 197,117 vertices. Every repair is recorded on the staged feature (`attributes.geometryNormalization`: authority, date, the authority's own validity error, polygon and vertex counts before and after, area delta), the Québec Zone 18 standard. Area 200 could not be repaired through the ordinary REST path: `ST_MakeValid` takes 58 s and the guard 33 s against an 8 s statement timeout, so it was done in one guarded transaction from a direct session. Per-polygon repair was measured and rejected: only 1 of 4,221 polygons is invalid, and the residual defect is between polygons, which per-polygon work cannot fix by construction.
- **A deferred check must read current state, not its recorded row image.** The VERIFIED-has-derivatives trigger read `new.coverage_status`, which is the image the statement recorded, so publish-then-demote in one transaction — how an uncertified jurisdiction is published — was judged on the VERIFIED image and refused every time. Newfoundland's first ingest hit it. Fixed in `20260922214000` by re-reading the zone by id, as the derivative-removal check already did. Same class as the 42703 incident: a trigger that reasons about state must read the state.
- **A hand-maintained lookup that yields a sentinel instead of raising is a fail-closed defect that lies about its cause.** `audit-zone-certification.mjs` kept a table mapping jurisdiction to canonical-id prefix. It had no Yukon entry, so the lookup produced `undefined`, the query filtered on the literal string `"undefined*"`, matched nothing, and the audit reported `official=443 North Ground=0 missing=443` — i.e. "every zone is missing" rather than "this script does not know this jurisdiction". It refuses to certify, which is safe, but it sends the reader to look for 443 absent zones instead of one absent table row. The prefix is now derived from the adapter's own id minting, verified to reproduce all five previous entries exactly (ON, MB, AB, QC, BC) and to cover every id in all nine adapters. **Grep for siblings of this class**: any table keyed by jurisdiction, layer or species whose miss produces `undefined`/`null` that then flows into a query, a filter or a URL rather than throwing.

- **The sharpest example of the sentinel class: a check that reported agreement because both sides were empty.** `build-british-columbia-regulations.mjs` looked up `SPECIES_GROUP[rule.speciesId]` with no guard. A species the seven-entry table does not name yielded `undefined`, collected its rules under an `undefined` key, and was then cross-checked against `synopsis[undefined]` — also undefined. Law and synopsis were compared empty-to-empty and REPORTED AGREEMENT. Not a lost rule: a silent pass on the very check that exists to catch the regulation and the printed synopsis disagreeing. It throws now, naming the species and the table's keys. It could not misfire while the table covered all seven certified species; it would have the moment an eighth was added, which is exactly when someone is concentrating on certifying rules rather than on a lookup table.

- **The stored-drawing limit bounds rows, but the real invariant is bytes.** `zone_display_in_view` is capped at 1000 rows for the overview levels and 400 for the detailed ones (`20260922204235`), after a flat 400 blocked Yukon entirely: it publishes 443 subzones, the national overview necessarily contains all of them, so every overview request saturated the cap and the caller refused the whole layer. Refusing is correct — 400 of 443 drawn would misstate where the boundaries are — but a row count is only a proxy. Measured across all 443 Yukon zones: level 1 is 102 kB, level 2 239 kB, level 3 867 kB, level 4 3,454 kB. The same row count is trivial at the overview levels and heavy at the detailed ones. A jurisdiction approaching 1000 zones at level 1 will hit this wall again, and **raising the number is not the answer** — a byte-aware bound is. Related: the national overview is one blob for every served jurisdiction, and viewport-scoped or tiled delivery is the next infrastructure item once it approaches the payload budget.

- **The staging comparison is per jurisdiction, not per layer.** For a multi-layer jurisdiction, publishing Newfoundland's moose run reported the 19 caribou areas as "removed". `publish_zone_run` only inserts and upserts, so nothing was deleted and both sets are intact, but the report misleads. Scope the comparison by layer (`zoneIdPrefix`) when the next multi-layer jurisdiction lands.
- **A cold start can drop a jurisdiction from one map request.** Observed once: the first `/api/hunt/zones` request after a fresh build answered `PARTIAL` in 9.6 s, which means a layer genuinely failed and the map would have shown the remaining jurisdictions with the notice. Not reproducible since; a deliberately cold server answers the same view `OK` in 204 ms, and all 12 measured views are `OK`. The stored-drawing path now retries once under the same bounded timeout before falling back to the authority, because the first stored query of a process pays the database's per-connection start-up. Hunt overhaul sees the same class on www (roughly one load in four or five has a cold-start TTFB spike), so this is shared runtime cold start rather than the stored path. Symptom to recognise: a map missing one jurisdiction, with the partial notice, on a first load only.
- **A stored-drawing view can include one zone just outside it.** The stored query filters by bounding box, so Alberta at zoom 10 draws WMU 516, whose geometry lies just north of the viewport; Alberta's own envelope query excludes it. An adjacent zone drawn where it actually is, is not a wrong answer, and the point answer remains authoritative. Recorded rather than fixed.
- **Parity-tool gaps.** `scripts/certify-spatial-parity.mjs` cannot certify Ontario (its adapter has no `officialIdentifiersAt`), and its Manitoba sampler (`zone_component_sample_points`) hit the 8 s statement timeout under load on 2026-09-22. Neither is a wrong answer; the authority-first audit (`scripts/audit-zone-certification.mjs --all`) covers both jurisdictions.
- **Yukon's service holds two features the dataset does not state.** `GAME_MGMT_AREA_ID` 102 and 103 lie over Ivvavik and Vuntut National Parks. They stay quarantined until Environment Yukon answers the drafted query (`docs/correspondence/2026-09-22-yukon-gms-102-103-query.md`, not sent).
- **The Manitoba store read path helps only after landing.** Production still asks ArcGIS live for all four layers until `canada-bc` deploys.
- **Hunt map-first (branch `hunt-map-first`), known limits.** (1) Authorities fail intermittently (Ontario and Québec `PROVIDER_ERROR` seen locally): the overview is then incomplete, so no poster is drawn (by rule) and the map shows the answering jurisdictions and retries at 15/45/120 s. (2) The poster's cache key is the served-layer version plus the deployment; `management_zone_display` has no per-zone display version, so a stored-drawing rebuild without a deploy can show the old drawing for up to the same six hours as the live map's edge-cached overview. (3) `/api/hunt/zones` takes no species, so a species-scoped layer that is not drawn by default (U.S. Wyoming elk areas) cannot yet be requested by the map; nothing is affected until U.S. layers are served. (4) On Vercel preview deployments only, the site's CSP refuses Vercel's injected toolbar script (`vercel.live/feedback.js`): console noise, not an application error.

- **Owner action — production's Google server key is refused.** `GOOGLE_MAPS_SERVER_API_KEY` was replaced in Vercel Production at 2026-09-21 03:07 UTC. Since then Google Weather has answered `403 PERMISSION_DENIED: Requests from referer <empty> are blocked` (production runtime log, 09:33 UTC, deployment `dpl_99MphvNNqTHBUNDAsqPRseZF61zs`). Google gives that answer only to a key with an HTTP-referrer restriction, which a server key must not have; the value set is probably the browser key. Weather is being served by Open-Meteo and place search by Nominatim. Answers stay correct, because neither provider decides anything regulatory, but Google is not in use. Fix: set Production `GOOGLE_MAPS_SERVER_API_KEY` to the server key (API-restricted to Places (New), Geocoding and Weather, no application restriction), then redeploy. It is fixed when the `[hunt-weather]` and `[hunt-location]` warnings stop appearing in the runtime log. Every Google refusal is logged by Google's enumerated reason only, never the query, coordinate, date or key (`907b2fe`). The local `.env.local` server key is separately expired (`API key expired`).
- **Geocoding read a refused key as "no named place".** The legacy Geocoding API refuses with HTTP 200 and `REQUEST_DENIED`. That was mapped to NOT_FOUND, so a dropped pin lost its place name instead of falling back to Nominatim. Fixed in `907b2fe`; only `ZERO_RESULTS` now means no named place.

- **Ontario turkey in the Supabase mirror predates the s. 79 fix** (2026-09-21). The major-game bundle now permits a muzzle-loading shotgun (10–20 gauge, shot 4–7) in the spring and fall "shotgun or bow" turkey seasons, which the old parse had closed. Hunt evaluates from the committed bundle, so production answers are already right (certified live: muzzle-loading shotgun CONDITIONAL, rifle CLOSED). The mirror needs `node scripts/publish-regulations.mjs` for the major-game bundle. That is a production write, deliberately **not yet run** on 2026-09-21 because other sessions were reconciling the migration ledger and the map-intelligence migration was still unapplied; run it when no other production database work is in flight.
- **Ready to Hunt is Ontario-only.** Every other served jurisdiction shows an honest "not built yet" with the authority link. Ontario gaps: controlled-hunt and draw-specific tags are named but not individually priced; the southern rifle-calibre restriction is shown as CONDITIONAL because North Ground does not map the 21 named areas to units.

- **Owner action — Maps key and local ports.** The browser key allows only production, `*.vercel.app` and `http://localhost:3100`, and Google does not support port wildcards (exact ports or subdomain wildcards only). Several sessions run dev servers at once, so only one can see the Google basemap; the others now fall back to the boundary view via `gm_authFailure`. Fix, in Google Cloud Console → project `ngbc-509209` → APIs & Services → Credentials → the browser key → Website restrictions: add `http://localhost:3101` through `http://localhost:3109` (and `http://127.0.0.1:3100` if wanted). Changing a key's restrictions is a credential setting, so it is left to the owner.
- **The neighbouring-zone name comes from drawn (generalised) geometry** within 2.5 km. It is an identification aid; which side of the line a point is on is still decided only by the resolver against full geometry.
- The keyless place-search fallback (Nominatim) rate-limits quickly; repeated local searches returned "Place search is temporarily unavailable". Production uses Google Places.

- **Provenance dates read a day early for every North American user.** `HuntResult` formatted "Record verified" and each source's retrieved date with an unpinned `Intl.DateTimeFormat`, and `new Date("2026-09-20")` is midnight UTC — so Toronto and Vancouver saw 19 September, and the server's HTML disagreed with the browser. Season dates were unaffected (`readableIso` already pinned UTC). Fixed with `readableCalendarDay`, which reads calendar days and instants in UTC. Found by searching for server/client divergence while building the hydration check, not by the check itself: the result only renders after an evaluation, and the check covers first render.
- **The footer copyright year disagreed between server and browser for the last hours of 31 December.** Now `siteYear()`, computed in `SITE_TIME_ZONE`.
- **An unknown species served an empty 404.** The route had `generateStaticParams` but no `dynamicParams = false`, so an unknown slug rendered on demand, reached `notFound()` after the response had begun streaming, and delivered the 404 body only inside the RSC payload — nothing without JavaScript or before it arrived. `dynamicParams = false` makes an unknown slug a route miss, which Next renders in full; the set is closed anyway.
- **A missing Hunt Brief served an empty 404 — fixed 2026-09-21, and the cause turned out to be the framework, not this app.** The earlier theory (streaming metadata, async render) was wrong, and the two attempts built on it could not have worked. Probe routes isolated it: even a synchronous page that calls `notFound()` immediately, with no metadata, no `await` and no dynamic rendering, served an empty body — and so did the same page under a bare root layout. Next 16.1.1 renders an escaped `notFound()` through an error shell whose `<body>` is empty by construction (`getErrorRSCPayload` in `app-render.js`), then draws the 404 in the browser from the RSC payload. Only a request resolved as not-found BEFORE rendering is server-rendered in full.
  - So `src/proxy.ts` now decides "missing" first, for brief URLs only, and rewrites to `/hunt/share-unavailable` with a 404 status. A rewrite rather than a redirect: the reader keeps the URL they followed and no extra round trip is spent on the connection they may be on. The page renders in full, and its robots are a single `noindex, follow, noarchive` — the duplicated `noindex` + `noindex, follow` pair came from the error shell, which these requests no longer touch.
  - The decision is `decideShareRoute` in `lib/hunt-share/route.ts`, using a new `HuntBriefStore.exists()` that selects the ID column rather than the snapshot. A malformed ID is answered without touching storage. **An outage never becomes a 404**: if storage is unconfigured or unreachable the page renders its "temporarily unavailable" state, because "this brief does not exist" is not true while storage is down. Verified end to end against a real unreachable store: an existing brief and a well-formed missing one both return 200 "temporarily unavailable", and only a malformed ID returns 404.
  - **The existence check is bounded (1.5 s), after it made an outage worse.** As first committed (`c79491a`) the proxy awaited storage with no limit, then the page looked the brief up again — two sequential waits before any response. Supabase failed on 2026-09-21 from about 02:50 UTC with Cloudflare 522 after 19–25 s per call, so a reader would have sat at a blank screen for twice that. Measured under controlled conditions against a local server that stalls 8 s then answers 522: 16.0 s as committed, 9.5 s bounded. Exceeding the bound falls back to "render", which is always correct — a timeout can cost the server-rendered 404 body for one missing brief, never a wrong answer. It uses a plain timer rather than `AbortSignal.timeout`, whose unref'd timer does not keep the process alive, so the deadline held only while other I/O happened to be pending; a test with a store that hangs without I/O caught this. A fast 522 is confirmed to throw `HuntBriefStoreUnavailableError`, so it becomes "temporarily unavailable", not a false 404.
  - **Still open: the page's own brief lookup is unbounded.** With the proxy fixed, a reader during an outage still waits the full storage timeout (~20 s) for "temporarily unavailable", as before this work. Bounding `loadHuntBrief` would cut that to seconds; it changes the page and the Open Graph image route, so it belongs in its own change.
  - The page's own `notFound()` remains as defence in depth, and for one residual case the proxy cannot see without fetching the whole snapshot: a stored brief that fails validation. That still serves the empty-body 404, but it requires a corrupted immutable record and has not been observed.
  - The three "unavailable" states — not found, storage unavailable, unsupported format — now render from one component, `HuntBriefUnavailable`, each with its own wording because a reader acts on each differently.
- 404 pages carry two robots tags, `noindex` and `noindex, follow`: Next adds the first automatically and `not-found.tsx` declares the second. Redundant rather than conflicting — both forbid indexing — so left alone rather than fought.

- `retrievedAt` used to be stamped with the build date, so every rebuild differed from the committed bundle by one line and the generated-bundle check would have been red from its second day — and a permanently red check is one nobody reads. It now moves only when the content moves, which is also the more honest reading: re-reading an unchanged page does not change when its text was retrieved. "When did we last confirm it is current" is a different fact and belongs on the source row in the database, which the daily watch updates without touching a committed file. The stamp is also the jurisdiction's day rather than UTC, for the same reason the Hunt date is.

- **The server served tomorrow's date for four hours every evening.** Found by verifying production rather than assuming it, on deployment `dpl_Bfos…`: /hunt threw React #418, and the hydration error was only the symptom. At 21:53 in Ontario the server rendered `2026/09/21` and the browser rendered `2026/09/20`. `date.ts` already warned about exactly this — "never the server's, because a Vercel function runs in UTC and would hand an Ontario hunter tomorrow's date every evening" — but `todayIso()` was reached through a `useState` initializer, which runs on the server too; that was the one path the warning did not cover. Pre-existing since the map-first rebuild (`c31755e`). The larger half of the defect was not the console error: every crawler, answer engine and no-JS reader was served a Hunt page dated tomorrow for the four hours each evening Ontario is behind UTC, and the date is the second most important input to a regulatory answer. The server now renders the jurisdiction's day via `jurisdictionTodayIso(HUNT_DEFAULT_TIME_ZONE)` — deterministic, and the right default for a Canada-first product — and the browser corrects to the viewer's own day once on mount, so both start from the same value and hydration agrees. Tested at the boundaries it actually fails on: the evening gap, month and year rollover, and the November daylight-saving change that moves the boundary by an hour. Fixed in `1901e0f`.

- Two defects were found and fixed on 2026-09-20 while taking the conditional work to production. Both had passed review and tests.
  - **The publisher retired other bundles' rules.** Its supersede sweep selected every published rule in the jurisdiction and retired anything absent from the bundle being published. That is indistinguishable from correct while one bundle exists; publishing major game retired all 11 small-game rules, and publishing small game would then have retired all 135 major-game rules, each run silently undoing the last. Superseding is now scoped to the sources a bundle is built from, which is the boundary of what it can speak for. The 12 affected rows were restored, both bundles were republished in sequence to prove they coexist, and `scripts/publish-regulations.test.mjs` asserts the scope so a jurisdiction-wide sweep cannot return. Note the fix still correctly retires the one legacy hand-written WMU 57 rule, which the generated small-game bundle genuinely replaces.
  - **A test depended on the wall clock.** `weather.test.ts` pinned `now` in every Open-Meteo/Google case but one, so that case passed during the day and failed once UTC rolled past the evaluated date. A suite that fails by time of day trains people to rerun rather than read it.

- **Supabase outage, 2026-09-21, 02:50–03:24 UTC (34 minutes; recovered without intervention, data intact).** REST answered 522 after ~20 s and the management API could not connect while the project still reported `ACTIVE_HEALTHY`. The logs show a 271-second checkpoint, then at 02:49:09 a `POST /zone_ingest_features` failing on statement timeout, then no logging at all after 02:50:46. The preceding half hour carried three large geometry ingests into a small instance — Manitoba (~624k vertices), Alberta (two staging runs of ~692k vertices and a publish) and, by the timing, a further upload — which is consistent with exhausting the instance's disk-I/O budget. It recovered by itself at 03:24 UTC; whether the instance needs more compute for future ingests is an owner decision. Production kept answering correctly through the official-GIS fallback, but each evaluation waited ~20 s for the Supabase call to fail; the spatial lookup now aborts after 2.5 s (`77e259b`), and the Hunt Brief existence check after 1.5 s (`7b21529`). Oversized zones now stage in chunks (`afdecb9`). Lesson for every ingest: stage one jurisdiction at a time, and batch very large MultiPolygons (Québec's 19SE is 8,091 polygons) small enough to stay inside the statement timeout.
- **Ontario's small-game mirror in Supabase is not identical to its bundle** (found 2026-09-21 by the new `publish-regulations.mjs --verify`). Its 11 rows predate rule-level provenance, so they have no `regulatory_rule_sources` row, and they were stored without the `combinedWithNames` display field. Hunt evaluates from the bundle, so no answer is affected; Ontario major game verifies identical (135/135). Fixing it means republishing those rows (they are skipped as already present) and is Ontario's decision.
- **A Hunt Brief keeps at most 8 warnings** (`from-hunt-evaluation.ts` slices, and the schema validates the count). A Manitoba deer answer carries up to 7 today. Beyond 8, requirements and limitations would be dropped from the shared brief without saying so. The per-warning cap was too low for real legal text (300 characters against the 320-character CWD requirement) and is now 600 (`1f39121`).
- **Evaluation p90 is about 3 s where Manitoba's overlay layers are read cold** (four ArcGIS point queries, cached per point). The median is 237 ms. A server-side cache of the overlay geometry, or a PostGIS copy of the four layers, would remove the external round trip.
- Search for `doe` or `buck` returns both deer, but only white-tailed deer carries the biological-sex intent: Wave 2 gave mule deer compound terms (`mule deer doe`), so bare `doe` matches it by substring. No pseudo-species is created and nothing collapses to one species; fixing it means changing the Wave 2 generator's terminology, not the published file.
- Inspect current repository before trusting this list.
- Record confirmed defects here as they are discovered.
- Do not copy stale audit findings forward without verifying them.
- Technical foundation audit: `docs/technical-foundation-audit.md`.
- Newsletter production persistence is configured with Resend Contacts and the dedicated Segment. A controlled production subscription and direct segment-membership read both passed on 2026-09-20.
- The canonical host is confirmed as `www`; production permanently redirects the apex to it. The repository enforces `www`, HTTPS, and a no-trailing-slash path policy in generated metadata/URLs.
- The global fixed-height/overflow lock was removed so long-form and Hunt routes can scroll. Remaining homepage hero/modal behavior should still receive a dedicated visual regression pass when active visual work settles; the server-rendered homepage H1 remains visually hidden.
- Analytics remains intentionally unconfigured pending provider, consent, retention, location-privacy, and event-design decisions.
- The in-process content repository reads a versioned bundle; a durable authoring store/export pipeline is not selected yet.
- Hunt evaluation rate limiting is process-local and must become distributed before high-volume production use.
- Ontario's deer season tables contradict their own headings. Footnote 1 reads "Indicates that rifles are not permitted during the open resident and non-resident seasons" and is attached to individual WMU tokens inside a table headed "Rifles, shotguns, muzzle-loading guns and bows". In WMUs 64B, 65, 68B, 69B, 71, 72A, 73, 74A and 75 a shotgun hunter has a 2–15 November season and a rifle hunter has no gun season at all. Any model that treats a table heading as the method would tell a rifle hunter in WMU 71 the season is open. Rules therefore carry the implement SET that survives their footnotes, and "rifle" and "shotgun" are separate answers in the interface. A footnote whose wording is not recognised aborts the build.
- Black bear works the opposite way: its tables name no implements at all, and a footnote SETS them (WMU 7A is bows and muzzle-loading guns only). Where every applicable rule agrees on a narrowed set the engine asks nothing but states the restriction, so a rifle hunter never reads an unqualified CONDITIONAL.
- Moose is gated by the tag, not the weapon. The province heads its tables "seasons when gun tags are valid" and "season when bow tags are valid", so a person carrying a bow without a bow tag has no season. The engine asks which tag was drawn and every moose result stays conditional on a validated tag North Ground cannot see.
- Two season tables are published but deliberately NOT certified: "Controlled deer hunt seasons (with hunt codes)" and moose "Resident seasons with controlled hunter numbers". Both are drawn per hunt code or restricted by eligibility and are not decidable from location and date. They are declared in the builder with a written reason, their content is hashed so a change still triggers review, and readers are told they exist via the `deer-controlled` and `moose-controlled` conditions.
- The generated regulatory bundles no longer carry a wall-clock `generatedAt`. A rebuild that finds the law unchanged now produces a byte-identical file; the previous behaviour put a diff on every rebuild, which trains a reviewer to skip diffs. Provenance is `retrievedAt` (date) plus `contentHash`.
- Exact legal sunrise/sunset computation is not certified. Open-Meteo sunrise/sunset is displayed only as environmental context and never establishes legal hunting time.
- The canonical Hunt H1 remains “What applies here, on this date?” because the certified product currently evaluates one selected species rather than answering the broader species-discovery question implied by “What Can I Hunt Here?”. Revisit when coverage supports that promise.
- The Maps JavaScript loader resolved on the bootstrap script's `onload` and checked for `google.maps` there. With `loading=async` that fires before the library exists, so every load was reported as a failure and the product silently dropped to its basemap-free view. It now waits for the documented ready callback. This was invisible until a real browser key existed.
- Google Weather returns sun events as UTC instants while Open-Meteo returns local wall-clock times, and the interface rendered both by slicing the string, showing an Ontario hunter a 10:56 sunrise for an 06:55 morning. Google's instants are converted to the forecast location's own clock in the adapter, so both providers hand the interface one shape. Covered by `src/lib/hunt/weather.test.ts`.
- The Google Cloud project has ~24 Maps Platform APIs enabled from its onboarding, of which North Ground uses four. The two North Ground keys are restricted to exactly what they need, so the surplus is a tidiness and cost-exposure matter rather than a key risk. The older broad `Maps Platform API Key` (35 APIs, no application restriction) still exists and should be deleted once nothing depends on it.
- The Hunt H1 is now `Your zone. Your season. Your hunt.`, matching the approved product direction and the existing social title. The earlier query-shaped H1 was replaced deliberately; the search terms it carried remain in the page title and meta description. Revisit if position data shows a loss.
- `src/components/hunt/Hunt.module.css` references four custom properties that are never defined anywhere: `--ng-line`, `--ng-fire`, `--ng-sand` and `--ng-moss-light`. They are used by the Hunt species-selector field and its group labels, so that control currently renders with no border and with inherited rather than intended label colour. This is a pre-existing Hunt defect. It was deliberately NOT fixed during the species visual integration, because defining them would change Hunt's rendered appearance and Hunt is the visual reference for that work, not its subject. Fix it as a Hunt change with its own visual check.
- ~~Hunt does not read a `species` query parameter.~~ Resolved 2026-09-21 (`f36cb41`): Hunt preselects `?species=` for a species with certified rules somewhere, and profiles link that way only when such rules exist; evaluation is still gated by the resolved jurisdiction.
- The species library page title rendered as `Species Library | North Ground | North Ground` because the route set the brand in its own title while the root layout template also appends it. The route now sets `Species library` and the template supplies the brand once.
- Secondary text tokens were failing WCAG AA on the dark glass: `--ng-bone-faint` measured 2.9:1 at 11–12px. Both secondary tiers were raised (0.80 and 0.62 alpha) and re-measured at 6.7:1 and 4.7:1. Any new token added to the palette must be measured against the glass it sits on, not against the page background.

## Next Priorities

0. **Species Heat: quality debt (2026-10-08).** All 230 heat-eligible species have a served map, none range-only (see *2026-10-08 — Ranges keep to their own statements*). What remains, in `docs/species-spatial-coverage.md`: 69 LIMITED surfaces; 15 ranges whose edge follows recording, all northern (Arctic species, caribou, polar bear, wolverine, brown bear, moose, black bear, lynx, marten, eastern wolf, raven, rock ptarmigan) — no open authority range map reaches Canada or Alaska for them (ECCC publishes no national Species at Risk range-extent dataset in its open catalogue; open.canada.ca's API and GeoNetwork refuse the runner); one GAP map refused (common gallinule: no sub-watershed table); the black-bellied whistling duck's wanderers, which its statement names without a place; and land cover from 2019, ageing (newer forest-typed land cover — ESA CCI, MODIS MCD12Q1 — sits behind registered accounts North Ground does not hold).

1. **Structure `regulation.summary`'s season listing so each label keeps its own language.** The French reaching English readers is a *list* of authority season labels string-concatenated into an English sentence. `season.label` already exists as `{text, lang, owner: "AUTHORITY"}` and the producer already sets it correctly — **but only when every cited rule agrees on one label**, deliberately, because inventing a name for a combination the authority did not write would attribute a name to a ministry. For arctic hare it is `undefined` while the summary still carries the French.
   So the work is giving the season **listing** a structured form, then composing the summary from structure rather than concatenation. It touches every consumer of `summary`, so it is a deliberate item rather than something to begin at the end of a session. Two constraints: **the singular-label restraint must survive** — a listing is not a licence to name a combination the authority did not — and **each label carries its own language**, so a bilingual listing is representable rather than flattened.
   Of the seven known French-bearing surfaces, **zero are converted**; only `AuthorityText.tsx` consumes `readingFor`. Whether an eighth exists is not established — the producers of `summary`, `specialAreas[].line` and the source records were inspected, the rest were not. **Seven is not a completeness claim.**

1. **The provenance split — authorship must be structurally impossible to confuse (owner, 2026-09-23).** `statedAs` means *as stated by the authority*, and eight render sites wrap it in quotation marks beside the authority's citation — yet `src/lib/hunt/overlays.ts:247` hard-codes North Ground's own sentence into it, on a path Manitoba and Québec both serve. 57 `statedAs` values tree-wide contain "North Ground"; 50 more are latent in Montana; Alberta's longest is ours too. **Severity, stated honestly: no false rule is asserted** — each of these sentences names North Ground inside itself — so the defect is attributive and typographic. Real, not urgent, not safety.
   The fix is not a second optional field. Per the owner: if text is North Ground-authored, the type must prevent it from reaching the authority-quotation path; if it is an authority quotation, its source and citation are mandatory at construction. **Enforce it in the type system with a test, not by convention across eight renderers.** It unblocks the Montana migration, every other jurisdiction's migration, and the per-source attribution mechanism.
2. `FindGameHint.tsx:87` — the one lint error on main (synchronous setState in an effect). A fix was reported and never landed; verify by content.
3. Montana prose → structured facts, after the split. **Legal land descriptions stay verbatim** where rewriting would change the geographic identifier (a PLSS description is a geographic identifier, not prose).
4. **BC stays 50 provisional.** Geometry, not more rows, is the missing capability. Coverage must not award points for encoded-but-non-decisive restrictions.
5. Remaining Ready to Hunt gaps, on the canonical `npm test` gate at **0 failures** — not "same as baseline".

Completed 2026-09-23: **the verbatim-dependency audit.** Of 2,507 stored `statedAs`, 1,578 are bare values rather than prose (a transcribed table cell is a fact, not expression); the real corpus is 929 clause-or-longer quotations, 322 displayed and 607 internal. **Genuinely verbatim-dependent: four** — and all four turn out to be model gaps rather than licensing problems (an actor class; a compound condition whose predicate is undefined; a closure scoped to a class of authorization; a window ending at another regulation's season opening). A trap for whoever migrates: 89 quotations are enumerated prohibited acts, which are replaceable because the act list IS the fact — but rewording one to "hunting prohibited" silently drops possession of a loaded firearm while looking like exemplary compliance. **Replaceable is not trivially replaceable.**

Priorities 1 to 4 of the previous wave are complete: the conditional UI, the
selector, conditional persistence and Hunt Brief v2 all landed on 2026-09-20.
The national rollout order below replaces them.

Map-intelligence delivery order, without racing current map/database owners:

1. Reconcile and locally replay `20260921093347_map_intelligence_foundation.sql`, then schedule its production application separately from geometry ingests.
2. Add the existing opportunity endpoint to the map only after the active map session lands: FIND GAME mode, SPECIE HEAT MAP layer, textual legend and evidence card, including the NO HEAT-MAP DATA state.
3. Certify the Ontario unpatented-Crown-land service schema and determine how open features can be separated from OGDE-only features. Until then it remains LICENCE_PENDING and no geometry is served.
4. Add one independently sourced habitat/range component before upgrading Ontario deer beyond PARTIAL DATA; do not turn the two correlated harvest metrics into ROBUST DATA.
5. Build Crown/public-land, restricted-area and access intersections before naming any geometry Potential Hunting Area in production.

1. Serve Québec, in this order, each on the owner's approval: swap `resolve_management_zone` to v2's body (first, because the current body would simplify zone 21's 838,537 vertices per request); promote the 59 zones to VERIFIED; deploy with the layer's `serving: true`. Then run `node scripts/certify-hunt-cases.mjs --base https://www.northgroundbushcraft.com --cases fixtures/hunt/ca-qc-certification-cases.json` and upgrade the Canada registry's spatial status to VERIFIED.
2. Québec's second wave: the CWD pages as a regulatory source (the ZSR's deer obligations), the per-zec moose seasons once zec geometry and its licence are settled, a per-zone index of the closed territories, and the remaining small-game species (coyote and wolf, fox, raccoon, woodchuck, grey partridge, ptarmigan). Preserve French terminology; never let the ZSR inherit a parent zone's season.
3. Distributed rate limiting and production observability before broad Hunt rollout. Hunt's limiter is still process-local.
4. Federal migratory birds. Establish certified district geometry from the Migratory Birds Regulations or an authority-backed layer — the ECCC draft layer disclaims legal value and cannot be used. This unblocks 25 published waterfowl species that currently have no rules at all.
5. Prairie provinces: Manitoba, Alberta and Saskatchewan are served. Manitoba's second wave is moose (s. 10.3 already needs its seasons), then elk, black bear and mule deer, then the Oak Hammock polygon. Then British Columbia, Atlantic Canada, and the territories. Each wave: research, ingest, certify parity, encode rules, test, deploy, verify, record exact coverage in the registry.
6. Complete current visual foundation without locking poor information architecture.
7. Establish technical/semantic site architecture.
8. Establish trust pages and North Ground Verified framework.
9. Continue Hunting Intelligence core.
10. Build structured knowledge/content graph alongside Hunt.
10. Expand verified regulatory coverage one source-backed record at a time. Waterfowl is federal (migratory birds) rather than provincial and needs its own source review.
11. Select a durable content authoring/store adapter that exports the existing normalized bundle without changing canonical IDs.
12. Build early cold-weather authority resources/tools.
13. Begin standardized field-data collection.
14. Build Crown/public-land data foundation ahead of seasonal demand.
15. Add distributed rate limiting, production observability, and an explicit regulatory/source review workflow before broad Hunt rollout.

## Blocked

Record only genuine blockers here.

Examples:
- missing API credentials
- unavailable official GIS data
- owner decision required
- third-party service issue

- **Species photos — 216 species on the placeholder (owner decision or manual sourcing):** Unsplash has no identifiable photograph for any of them, and the owner-approved 36 Adobe Stock licences are used. 160 have an Adobe candidate whose title names the species (`BLOCKED_DOWNLOAD` in `content/species-media/image-manifest.json`, asset ids in `adobe-candidates.json`) — each needs a licence approval, then the visual check. 29 have only a candidate that does not establish the species (`BLOCKED_IDENTIFICATION`: domestic stand-ins, a second species in frame, a different subspecies or a split species); 21 have no candidate anywhere (`BLOCKED_NO_SUITABLE_IMAGE`). Also open: 24 administrator images with no established origin and 4 owner images with a recorded doubt (`manual-image-findings.json`).
- **Take audit sources blocked (not bypassed):** New Jersey and New York (every official host 403/timeout), Massachusetts (mass.gov 403; statute only), Michigan (michigan.gov Akamai; statute stub), Arizona (azgfd/azsos Cloudflare; department PDFs used), Yukon. Needs an owner-approved official route (e.g. manual download of the digests).
- **Trumpeter swan in Nevada needs Nevada served:** the quota take is recorded as a sourced finding; a certified engine rule needs Nevada's county geography and rule model (U.S. regulatory lane).
- Analytics: approve provider, consent model, coarse-location constraints, retention, and event contract before adding instrumentation.
- Owner action: replace production's refused `GOOGLE_MAPS_SERVER_API_KEY` (see Known Problems). Hunt works without it on Open-Meteo and Nominatim, so this blocks Google, not Hunt.
- Owner decision: serving Québec. Three steps, each blocked on approval in the Québec session: the resolver swap (proven identical for Ontario, Manitoba and Alberta; it does not change their boundary distance — see Known Problems), promoting the 59 Québec zones to VERIFIED, and deploying the serving switch.
- Ontario Crown-land production layer: the catalogue combines Open Government Licence metadata with additional OGDE-only features. Production storage/redistribution is blocked until the service schema is certified and the redistributable subset can be proved, or Ontario confirms the rights.
- **Verbatim legislative text — freeze, now one sentence (2026-09-23).** **Do not store new VERBATIM Québec legislative text.** That is the whole freeze. It blocks nothing else: research, fact extraction, structured encoding, original North Ground wording, Ready to Hunt, legal hours, methods, ammunition, orange, licences, limits and season certification all proceed in every jurisdiction, per CLAUDE.md §8 "The law's answer, not a copy of the law's prose". Human-equivalent browser reads of public regulation pages remain fine; scripted ingestion presenting a user-agent we are not stays out.
  **Six jurisdictions, six different answers, established by reading each authority's own words about the specific thing North Ground uses** — no two predictable from one another:
  - **British Columbia** — King's Printer Licence – BC. Commercial reuse granted; a prescribed attribution statement required.
  - **Manitoba** — OpenMB Information and Data Use Licence. Commercial use granted in those words; exemptions checked and legislation is not among them. Attribution line required.
  - **Ontario** — King's Printer grant reaches statutes, regulations and judicial decisions commercially. It does NOT reach the ministry-authored Hunting Regulations Summary. A non-official reproduction must state it is not an official version.
  - **Alberta** — never used the King's Printer at all. Single source is open.alberta.ca; that resource's licence field reads "No licence". Note the trap: OGL–Alberta grants commercial use in OpenMB's words, but the portal's licence is per-resource, so a portal licence is not a dataset licence. Alberta stores no legislative prose — every Alberta `statedAs` is a value — so nothing is needed from anyone.
  - **Québec** — quebec.ca/droit-auteur names « des lois et règlements » and prohibits « reproduire, télécharger, stocker ». Restrictive and established. §8 routes around it: a legal fact in North Ground's own words with a citation is not a reproduction of the expression.
  - **Montana** — FWP's terms grant "personal or informational use" only, do not mention commercial use, condition the grant on documents being unmodified, and disclaim any warranty that the material is free of copyright claims. Not "prohibited" — the terms do not answer and the agency will not stand behind an answer. Its prose is being migrated to structured facts rather than licensed.
  **No authorization request has been sent to any authority, and none is needed.** The licensing question turned out to be a question about what we chose to store.
- **Live compliance gap:** the King's Printer Licence – British Columbia requires its attribution statement ("…THESE MATERIALS ARE NOT AN OFFICIAL VERSION") to be prominently displayed at least once with any reproduction. `grep "NOT AN OFFICIAL VERSION"` across `src` and `content` returns zero while BC verbatim text is live in production. Assigned to the Hunt surfaces lane, to be rendered per-source from data rather than as a BC-shaped string.
- Owner decision: reading legisquebec.gouv.qc.ca programmatically. The site returns **403** to our own agent (`NorthGroundBushcraft/1.0`) and **200** to a browser agent, so any scripted read means presenting a user-agent we are not. Settled already, per `source-licence.ts`: a general bot filter on a public regulations page is not an access control on a data service, so a **human-equivalent browser read is fine and is not at issue**. The open question is scripted ingestion only — storage of verbatim text is now governed by the freeze above, and most Québec facts should be reachable as structured facts without it.
  Do NOT reconstruct a Québec gear class from `permittedImplements`: r. 12 art. 31 defines types 11 and 12 with identical bow and crossbow paragraphs, type 12 adding slugs and muzzleloaders, and the hunter-orange exemption reaches 6 and 11 but not 12. The failure direction is telling a hunter they need no orange when the law requires it, so the correct output is UNKNOWN.

## Regulatory Coverage

### Canada

**Direction (2026-09-20): all of Canada is Hunt's first complete geographic
target.** Recorded in `CLAUDE.md` section 9. Canada is the minimum complete
footprint before broad United States expansion — not the initial market to be
moved past.

Coverage is machine-readable rather than prose. `src/lib/hunt/canada/registry.ts`
declares structure and known gaps; `src/lib/hunt/canada/report.ts` computes every
count from the certified bundles. Run `npm run report:canada`. Do not restate
those counts here — they would go stale the moment a bundle changes.

The structure, which does not move with a bundle: **14 jurisdictions tracked** (13
provinces and territories plus the federal layer), of which **11 are in scope**
(the Northwest Territories and Nunavut are out of scope by owner decision and are
counted in neither direction).

Every other national count — rules, species, units, jurisdictions answering — comes
from `npm run report:canada` and is deliberately NOT restated here. A table of them
stood in this spot from 2026-09-23 and went stale twice inside eight days: it still
read 556 rules, 12 species and 5 jurisdictions on 2026-10-01, when the bundles held
744, 25 and 9. The paragraph directly above it had said not to do this. Removing the
table removes the defect rather than the instance; the dated snapshot at the top of
this file is the one place a figure is written down, and it carries its date.

**`spatialComplete` is MET as of 2026-09-23 (11 of 11 in-scope).** Every one of
the ten provinces and Yukon has its official hunting geography ingested and
parity-certified against its own authority; Prince Edward Island was the last,
and the Northwest Territories and Nunavut remain out of scope by owner decision
and are counted in neither direction. The flag is computed from the
certifications by `report.ts`, not typed, so it cannot be turned on by editing a
constant — and it makes no claim at all about rules.

**RULE — `spatialComplete` is a MAP claim, and is governed (moderator ruling,
2026-09-23).** It is true as computed and it is also the most misreadable
sentence in the project, because "Canada complete" is exactly what a reader
wants it to mean.

- **Internally**, state it as the milestone states it — "11 of 11 in-scope
  provinces and territories have parity-certified official geography" — always
  with the two caveats below attached, and never as a bare boolean in prose.
- **Publicly / hunter-facing**, it may NOT be stated as "Canada is covered",
  "North Ground covers all of Canada", or anything a hunter would read as rules
  coverage. The permitted public form is about maps specifically — e.g.
  "official hunting-zone boundaries for every province and Yukon" — and only
  where the interface simultaneously makes clear that rules are certified in
  four jurisdictions.
- **`spatialComplete` never appears near a coverage claim without
  `coreGameComplete` (4 of 11) beside it.** CLAUDE.md section 9 is explicit:
  coverage means North Ground can state, per jurisdiction and per species, what
  applies. Drawing every boundary is not that.
- If a marketing surface wants the sentence, it goes through the moderator.

Read it with its two standing caveats, both declared in the registry's
`knownGaps` and pinned by a test:

- **Nova Scotia** is certified on the 12 deer zones it licenses as open data and
  holds no moose or bear boundary at all, because the province licenses none.
  That is a licence finding, not a missing ingest.
- **Prince Edward Island** is certified on a provincial outline, because it
  publishes no units to certify (below).

`coreGameComplete` NOT met (**9 of 11** — Saskatchewan landed 2026-10-01; Nova
Scotia, Newfoundland and Labrador and New Brunswick all landed 2026-09-30, after
British Columbia on 2026-09-23). `migratoryComplete` NOT met (no federal
rules). `coverageAudited` MET — every jurisdiction declares its own gaps, so
what is missing is intentionally UNKNOWN rather than accidentally absent.

Measured from the certified bundles at call time, 2026-10-01: **744 certified
rules over 25 distinct species**, CA-QC 196 / CA-SK 149 / CA-ON 146 / CA-MB 85 /
CA-BC 79 / CA-AB 50 / CA-NB 15 / CA-NL 13 / CA-NS 11. Saskatchewan is now the
broadest Canadian bundle by species (13) and the second largest by rules.

**Drawing every boundary in Canada is not covering Canada.** TWO of the eleven
hold no certified rule — Prince Edward Island and Yukon — so every species query
there is UNKNOWN. It was six on the morning of 2026-09-30 and three that evening.
The next front is still rules, and **both remaining source blockers were cleared
on 2026-10-01** — see *docs/handoff/pei-yukon-sources-found.md*. Prince Edward
Island's seasons instrument is located and verified (the Hunting and Trapping
Seasons Regulations under Wildlife Conservation Act s. 28, slug `w04-1-6-`, 5
pages, with Schedules I–IV quoted); its open question is CURRENCY, since the
consolidation reads "Current to: September 3, 2022" and the only index route is
the closed one. Yukon's Wildlife Regulation (O.I.C. 2012/84) is reachable in an
ordinary browser at HTTP 200 — the automated client is refused and a browser
visitor is served, which are two different facts, and §44 names the second as a
permitted route. Nothing is certified in either yet: the next step in both is
reading rather than searching. Neither is a licence finding and neither is a
modelling problem; §44's three separate rights mean a refused reader says nothing
about whether the facts may be derived once read.

#### Prince Edward Island: the province IS the hunting geography (2026-09-23)

Prince Edward Island has no hunting zones, and that was established from the
authority's own text rather than assumed from an absent dataset. Searching the
consolidated Wildlife Conservation Act Hunting Regulations: **"zone" appears 0
times, "county" 0 times, "district" 0 times.** Schedule 2 lists harvestable
wildlife province-wide with no geographic qualifier. **"Wildlife management
area" appears 6 times**, every one inside a single prohibition — no hunting
migratory waterfowl within 100 m of the centre line of a highway right-of-way
forming a boundary of the Indian River, Rollo Bay, New Glasgow or Pisquid River
Wildlife Management Areas.

So the province is the extent to which its hunting rules apply. The layer is
registered at **geography level JURISDICTION**: a point resolves to the province
and carries **no zone id**, because handing a hunter
`management_zone:ca-pe-prince-edward-island` would invent a unit out of a
storage key. `ZoneLayer.geographyLevel` and `isJurisdictionGeography()` are the
general mechanism; every other layer is asserted to be zone-shaped, so the new
field cannot silently unit-strip a jurisdiction that really does publish units.

The outline drawn is **Statistics Canada's 2021 cartographic provincial boundary
(PRUID 11)** under the Open Government Licence – Canada. It is provenance for
the shape only and is never the authority for a rule; the citation a hunter
reads stays the province's own hunting page. Parity-certified 2026-09-23: 1/1
inventory, 0 missing, 0 invented, 0 geometry disagreements, 5/5 testable points,
472 parts.

**The four Wildlife Management Areas are a declared gap, not a layer.** They
carry a real restriction, but the province publishes no boundary for them that
North Ground may use: its own open data and ArcGIS Online returned only
third-party mirrors (a conservation NGO, university accounts), which are not the
authority. North Ground holds no geometry for them and draws none rather than
approximating a legal boundary. This is a source-availability finding.

Record each jurisdiction as:
VERIFIED / PARTIAL / IN DEVELOPMENT / UNAVAILABLE

Do not mark VERIFIED until actual data and representative queries have been certified.

- Research inventory: PARTIAL for federal plus all 13 provinces/territories. Principal authorities, official terminology and regulatory-source leads are recorded; no jurisdiction is certified `VERIFIED` for production. Deep source reconnaissance is complete for the 11 jurisdictions outside the Ontario and Québec workstreams in `research/hunting/canada-source-reconnaissance.json`; this remains research-only and does not change coverage.
- Canadian species evidence: 102 source-linked rows across all 14 jurisdiction records, with deeper big-game, upland-bird, ptarmigan, hare, and small-game leads. These remain research inputs rather than certified rules.
- GIS: every North American jurisdiction has an explicit availability classification. The Canada deep pass verified machine-readable official management geometry for BC (225 MUs), Alberta (199 WMUs), Saskatchewan (83 WMZs), Manitoba (63 service features/62 named GHAs), New Brunswick (27 WMZs), Nova Scotia (separate deer and moose layers) and Yukon (445 service features versus 443 stated GMS). These are source candidates, not production-certified geometry: Saskatchewan and Nova Scotia have unresolved reuse terms, Yukon's count discrepancy is reconciled (two national-park features quarantined), and most authorities describe the geometry as indicative or generalized. PEI has no comprehensive hunt-zone system identified; NL, NWT and Nunavut remain map/geometry blocked.
- Ontario geographic coverage is COMPLETE as of 2026-09-20: all 151 official Wildlife Management Units are normalized in Supabase/PostGIS, ingested from the province's own feature layer. 1,298,941 vertices, every geometry valid, every one EPSG:4326 MultiPolygon, 1,078,174 km2 in total against Ontario's actual area of roughly 1,076,000 km2. Sub-unit designations are preserved exactly as the authority writes them (69A-1 stays 69A-1).
- Spatial parity with the authority is CERTIFIED: 309 points — one inside every unit, one just inside every unit's boundary, five outside the province, two impossible coordinates — resolve identically in North Ground's PostGIS registry and in the Government of Ontario service, with zero disagreements. `scripts/certify-ontario-spatial-parity.mjs` performs the live comparison; `src/lib/hunt/spatial-parity.test.ts` replays the recorded result and never touches the network.
- `SPATIAL_PROVIDER` is now `supabase` with `official-gis` as the fallback, in local and in Vercel Production and Preview. The condition recorded for this switch — demonstrated parity — is met, and PostGIS measured steadier than the live service (median 170 ms versus 207 ms, p90 215 ms versus 1,460 ms). Production resolves WMU 3, 15B, 36, 57, 61, 80 and 94A through PostGIS.
- Ontario small-game regulatory coverage expanded on 2026-09-20 from one unit to the province. Against the 2026 Ontario Hunting Regulations Summary (`sha256:99fadfbb…`, retrieved 2026-09-20), 8 official season groupings and 11 rules now cover four species:

| Species | Certified units | Declared no season | Unknown | Rules |
| --- | --- | --- | --- | --- |
| `species:ruffed-grouse` | 150 | 0 | 1 | 4 |
| `species:snowshoe-hare` | 150 | 0 | 1 | 2 |
| `species:sharp-tailed-grouse` | 85 | 0 | 66 | 3 |
| `species:spruce-grouse` | 85 | 65 | 1 | 2 |

- The rules are generated, never hand-written. `npm run build:regulations` rebuilds both `content/regulatory/ca-on-small-game-2026.json` and `ca-on-major-game-2026.json` from the published summaries, and `npm run check:regulatory-sources` fails if either source has moved since its bundle was built. A moved hash now names the affected rules with field-level before/after and the number of units each change touches; `scripts/regulatory-change-report.mjs <old> <new>` produces the same report between any two bundles and exits 3 when review is required. Parsing is strict: an unreadable season phrase, limit or WMU reference aborts the build rather than dropping a row. `scripts/publish-regulations.mjs` mirrors the bundle into Supabase for coverage reporting and the review lifecycle; Hunt itself evaluates from the committed bundle, which keeps evaluation deterministic and offline-testable.
- Both bundles are LIVE in Supabase as of 2026-09-20. The conditional migration is applied to project `nxzaatqovhbvziecogan` and both bundles are published: 146 rules PUBLISHED (135 major game across four sources, 11 small game), 60 groups, 1,085 zone memberships with no duplication, 135 rules carrying a non-empty `applies_when`, 16 stated closures. The WMU 71 deer gun-season row stores `["SHOTGUN","MUZZLELOADER","BOW"]` — rifles excluded — which is the row the migration exists to make representable. Season dates stay null by design: a split season ("October 1 to November 1, November 16 to November 29, December 7 to December 31") cannot be one opens/closes pair, so the authority's verbatim phrase is kept instead.
- Each published page now carries its own content hash, so a change is attributable to the page that moved rather than to the bundle as a whole, and `--check` names which source moved.
- Season semantics are modelled rather than approximated: windows that cross the calendar year stay open through 31 December, "the last day of February" follows the leap cycle, and the part of a source year that belongs to the PREVIOUS summary is reported as outside the certified period rather than closed.
- Combined limits stay combined. Five birds shared between ruffed and spruce grouse is rendered as the authority states it, never as five of each.
- Ontario major game is certified for four species as of 2026-09-20, against four published pages of the 2026 summary (`sha256:bd4c42a8…`, retrieved 2026-09-20): 60 official season groupings and 135 rules.

| Species | Units reached | Rules | Rules stating "None" | Rules with an uninterpretable caveat |
| --- | --- | --- | --- | --- |
| `species:white-tailed-deer` | 140 of 151 | 100 | 14 | 2 |
| `species:american-black-bear` | 103 of 151 | 8 | 0 | 1 |
| `species:wild-turkey` | 91 of 151 | 3 | 0 | 0 |
| `species:moose` | 70 of 151 | 24 | 2 | 0 |

- "Units reached" is not coverage of the province. A unit no season row names stays UNKNOWN; a unit whose cell reads "None" is CLOSED because the authority said so. The two are never merged.
- Major game answers a question small game does not raise: WHO is hunting and WITH WHAT. `evaluateOntarioMajorGame` reports evaluation completeness separately from regulatory status, so `NEEDS_INPUT` ("North Ground knows the law and needs a fact from you") is never confused with `UNKNOWN` ("North Ground does not know the law here"). Questions are derived from the rules, not declared per species: the engine asks only where the applicable rules disagree, one fact at a time, naming the source section the distinction comes from. A deer hunter is asked residency then implement, a turkey hunter only implement, a moose hunter residency then tag, and a bear hunter in WMU 7A nothing at all.
- Answers are untrusted input. Only a value the dimension itself offers is applied; an unrecognised one leaves the question outstanding rather than narrowing the rule set, because filtering on an arbitrary string empties the candidates and an empty candidate set would read as a confident CLOSED. Residency is never inferred from IP, browser location, account, postal code or a previous hunt — it is asked, and no result claims North Ground verified it.
- One implement can qualify for several published seasons at once — a bow is legal in the deer gun, muzzle-loader and archery seasons — so open dates are the UNION of every applicable rule, not a conflict. A genuine CONFLICT is two rules in the same published table applying to the same hunter with different dates; the current bundle contains none.
- Zone geometry drawn on the map: Ontario only, PARTIAL. All 151 Ontario WMU boundaries are rendered from the province's own feature layer, generalised by zoom. Per-unit coverage badges follow the certified rule set rather than a pinned unit. No other Canadian or United States jurisdiction has geometry drawn, and none will be until its official source passes the same review.

**Québec — source found and read, nothing certified (2026-09-20).** *Superseded on 2026-09-21: Québec is certified and not served; see In Progress and `docs/quebec-regulatory-sources.md`. Kept as the record of what was found.*
Full findings in `docs/quebec-regulatory-sources.md`. Read that before encoding a
bundle; it is the difference between a day of work and a week of rediscovery.

- Geometry is VERIFIED as readable and remains IN DEVELOPMENT as coverage. The
  boundaries are not in the open-data portal — they are served by the ministry's
  own GeoServer behind the *Forêt ouverte* map
  (`SmartFaunePub:Zone_chasse_da3_sefaq`, WFS 2.0, GeoJSON, EPSG:4326 on request,
  `AccessConstraints: NONE`). The registry's previous note that Québec geometry
  "is NOT available as open data" was true of the portal and false of the
  province; it has been corrected.
- Measured by a full live read: **59 designations, 28 numeric zones (1–24, 26–29,
  no zone 25), 9,509 polygons, 2,424,980 vertices, zero geometry problems**, in
  about 65 s. The zone count matches quebec.ca exactly. `19SE` alone is 8,091
  island polygons and is one regulatory area, not 8,091.
- **The part is the regulatory unit, not the number.** Québec writes its season
  tables per part — 19N, 19SE, 19SO and 19SNO are four different seasons — so
  keying on `No_zone` would merge them.
- `createQuebecZoneSource` is the second implementation of `ZoneLayerSource` and
  the first that is not ArcGIS. The contract absorbed the difference: the fetch
  is WFS, everything downstream is unchanged. That is the evidence the ingestion
  layer generalises.
- `resolveZoneLabel` maps the published labels onto those designations and was
  run over **all 66 labels the five species pages publish: 62 resolve, 4 refuse**.
  The refusals are the feature — Île-du-Havre-Aubert has no designation, one row
  is a table header, and two use coordinated ellipsis. Each stops a build and
  names what the layer does publish.
- The rule that prevents a false answer: a part naming a *territory* is never
  swept into its parent. So "8 nord" is `08N` alone, never `08NMR` (Montagne de
  Rigaud) or `08NZ`.
- **ZSR — `08NZ`, `09OZ`, `10EZ` — is the enhanced surveillance zone for chronic
  wasting disease**, 17 named municipalities around the 2018 infected farm. No
  season table names it; its antlerless-permit and registration obligations live
  on the CWD pages. It was found in the GIS layer, not in any hunting page.
  Answering it with its parent zone's season would be a false answer.
- **Zone 17 moose is closed to sport hunting.** The harvest that continues is
  Indigenous subsistence under the James Bay and Northern Québec Agreement — a
  treaty context North Ground does not evaluate and must never render as a
  season.
- Québec is more conditional than Ontario. Implement is a section heading that a
  footnote can narrow (crossbows are banned in zones 22, 23 and 24 under a
  heading that names crossbows); antlerless moose runs three different regimes at
  once; and **one cell can carry a different animal class per year** ("2026
  Orignal avec bois / 2027 Orignal"), which the current rule schema cannot
  represent.
- Still zero certified Québec rules. Every Québec query answers UNKNOWN, and the
  registry says so rather than implying coverage.

**Alberta — served in Hunt: geometry parity-certified, first rule wave live on `main` (2026-09-21).**

- Official source: Government of Alberta `fishwild_wildlife_mgmt_unit_public/FeatureServer/0`, EPSG:3400 native, requested in EPSG:4326, Open Government Licence – Alberta. Alberta describes the boundaries as "small-scale approximations of the actual units legally described in the Wildlife Regulation (AR 143/97)"; every unit carries that standing and the written descriptions control.
- **199 records are 189 WMUs, not 199.** WMUs 718 Writing-On-Stone (6 records), 728 West Wainwright (3) and 794 Evans-Thomas (3) are published in parts and grouped into one MultiPolygon each. The one blank record is **Elk Island National Park**: its interior point lies inside NRCan's legal park boundary (adminAreaId ELKI, accuracy better than 10 m) and the areas agree to 0.24%. It is quarantined, recorded on the ingest run, and never given an id. The adapter re-checks every one of these facts on each fetch and refuses on drift.
- The WMUs tile Alberta except its five national parks: 661,848 km² less 54,797 km² of parks (Wood Buffalo's Alberta share clipped at 60°N) leaves 607,051 km²; the 189 units cover 608,042 km², a residual of 0.15%. Zero overlaps between units, every geometry valid.
- All 189 are published in PostGIS through the generalised promotion (`734bfef`, `16336a3`), with the jurisdiction and source registered by migration. **Parity is CERTIFIED** (`1ac90d8`): 592 points, zero disagreements — inside, just inside the edge and just across the boundary of all 189 units, all 12 parts of the three multipart units, five points outside the province, two impossible coordinates, and a point in each of the five national parks. PostGIS resolves in 86 ms median, 157 ms p90. Replayed by `src/lib/hunt/alberta-spatial-parity.test.ts`.
- Served (`f07a886`): Alberta's layer is `serving: true` and its rules are in the regulatory registry, in one commit, so coverage never claims a jurisdiction Hunt cannot answer. Alberta's service stores WMU 102 as `00102`; `ZoneLayer.designationOf` makes the official-GIS fallback and the map read it as `102` and read the blank Elk Island record as no zone. Verified through the real API: WMUs 102, 212 and 357 resolve (south, Calgary, Peace Country), 718 is boundary-only, Elk Island and Banff are in no WMU. In a real browser at Pincher Creek the selector enables exactly the three grouse and white-tailed deer and marks moose "No certified rules here".
- First regulatory wave (`083963f`): ruffed, spruce and sharp-tailed grouse (nothing asked) and white-tailed deer (implement, antler class, special licence). 50 generated rules in 22 groups from the 2026 Alberta Guide to Hunting Regulations. Seasons marked ■ are open only to special-licence (draw) holders; Hunt asks, answers under that stated assumption and says it has not verified it. Sunday big-game hunting is unlawful in WMUs 102–160, 624, 728, 730 and 936 but not 162–166, so shared rows split and Sundays are removed. A unit no row names is UNKNOWN; a named unit whose seasons exclude the combination asked about is CLOSED.
- Coverage: ruffed grouse 179 of 189 WMUs, spruce grouse 177, sharp-tailed grouse 92, white-tailed deer 177; the rest answer UNKNOWN. 179 WMUs carry at least one certified rule and draw as certified; 624, 648, 651, 718, 726, 732–738 and 794 draw as boundary-only. Not encoded: mule deer, moose, elk, sheep, goat, pronghorn, black bear, cougar, other game birds, migratory birds.
- Two channels, one checked against the other: the online edition's HTML tables are parsed, and `scripts/crosscheck-alberta-guide.py` confirms all 30 source rows against the government PDF by coordinates (dates in order, ■ column). A tampering drill proved it catches a moved date and a moved mark. The channels genuinely disagree on late elk in WMUs 102–150 (PDF N17–D31, online N17–D20), which would be a CONFLICT if elk is encoded. The guide's catalogue record carries no open licence, so North Ground records facts with the printed cell as provenance.

**Manitoba — served in Hunt and certified on production (2026-09-21).** The full record is `docs/manitoba-regulatory-sources.md`; do not re-derive it.

- Geometry: the province's dedicated `Manitoba_Game_Hunting_Areas` layer. 63 records are the 62 GHAs M.R. 220/86 defines, plus one blank record, which is Riding Mountain National Park; it is quarantined and never ingested. Parity is certified at 201 points with 0 disagreements. The official term is "Game Hunting Area (GHA)", never relabelled as a WMU.
- Rules are built from the regulation itself: M.R. 165/91, consolidation in force since 2026-06-16 (M.R. 46/2026). The 2026 guide is only a cross-check, with 2 disputes (GHA 7A) and 3 notes where the regulation controls. Certified period: 2026-06-16 to 2027-03-31. Section 3 makes a place no row designates CLOSED for an encoded species; an unencoded species stays UNKNOWN.
- Coverage: ruffed, spruce and sharp-tailed grouse in all 62 GHAs, asking nothing, by game bird hunting zone. White-tailed deer is covered in 54 GHAs and closed by s. 3 in 8, asking residency, licence, equipment and (where the youth rows decide) age. 85 rules in 24 groups. Everything else answers UNKNOWN.
- Special geographies: CFB Shilo, the Whiteshell Game Bird Refuge and the R.M. of Macdonald part of GHA 38 are read from the province's layers. The Oak Hammock Waterfowl Control Area has no polygon and answers NEEDS_VERIFICATION inside a proven envelope. The CWD zone is 25 GHAs, on which three sources agree. The GBHZ 2/3 band is answered only where both zones agree.
- Refuges, special conservation areas, WMAs and closed lands (231 features) are read live at the point and never certified as closures. A restriction that reaches the species turns CONDITIONAL into NEEDS_VERIFICATION and quotes the authority.
- Persisted to Supabase through the conditional-rule publisher (`fa1973c`): 85 rules, 24 groups and 329 memberships, read back identical. Sources are registered by migration. Change detection is in the daily watch, and the drill passed 8 of 8 with exact blast radii (`d10d9e5`). Production certification: 24 of 24 real places agree with the law (`c077595`).

### United States
Not assumed complete.
Add jurisdictions only when genuinely implemented.

**One state is served. One more has certified regulations and is withheld.
Ten may not be drawn, one cannot be reached at all. No state is complete end to
end.**

**Legal hunting hours went from one state to 38 (2026-09-30).** 49 CFR Part 71 —
the federal instrument that decides what clock a US legal-hours answer is
expressed in — had never been read. It is now read end to end, and all 51
jurisdictions are classified with none unaccounted:

- **38 served a single zone.** Part 71 names a state only in the section
  describing a line through or along it, so a state named nowhere lies wholly in
  one zone BY CONSTRUCTION. Cross-checked against the tz database's
  `zone1970.tab`, which describes the US by exception and names only MI, KY, IN,
  ND, ID, OR, AZ and Alaska sub-areas. Two independent instruments.
- **6 split along COUNTY lines** — KS TX MI IN KY TN. Resolvable with Census
  TIGERweb county geometry, which this codebase already reads for state identity.
- **7 split by a FEATURE** — ID OR ND SD NE FL AK. Rivers, a historical railway
  alignment, a state highway centreline, PLSS section lines, and a meridian
  qualified by an undefined class. These need hydrography or a survey grid.

The two split kinds are held apart because they misdirect work if merged: one
sends someone to acquire county geometry, the other hydrography, and Nebraska —
whose line names no county at all, only section lines "with their offsets" — is
the proof that no national county-to-timezone table can exist.

Three traps recorded rather than absorbed: **§ 71.2 names no DST-exempt state**,
so Arizona's and Hawaii's exemptions rest on each state's own act under 15
U.S.C. 260a(a) and not on Part 71; **Idaho's `America/Boise` error is latent, not
live** (all 42 certified units are numbered 21A+, none in the Pacific panhandle)
and becomes real with the first panhandle species; and **a longitude-only Alaska
test is wrong in the PERMISSIVE direction**, putting St. Lawrence Island
(Gambell, Savoonga) an hour off.

**A third map blocker exists: TRANSPORT_BLOCKED.** Arizona's authority publishes
its GMU service on its own host, `arcgis.azgfdportal.com`, which has presented a
certificate expired since 2022-11-04 — observed 2026-09-30, nearly four years.
That is neither LICENCE_BLOCKED (its terms have never been readable either) nor
UNAVAILABLE (a service exists). It was not worked around, because reading it
means disabling certificate verification on a regulatory path (§50). A finding
now carries EITHER a licence somebody read OR a reachability reason nobody
could, and the test asserts exactly one.

**New Mexico (70 GMUs) and Nevada (129) read, both UNRESOLVED.** New Mexico's
terms limit the data to "general location purposes only"; Nevada's entire
statement is a warranty disclaimer that never mentions use. **A warranty
disclaimer is not a licence** — reading "no warranty" as "no permission" invents
a refusal, and as permission invents a grant. Three findings from those two that
would otherwise be silent errors: species-specific geography is an ATTRIBUTE in
both (NM's Bear_Zone/Cougar_Zone, NV's Bear/Sheep/Deer/Elk) rather than a second
layer; Nevada publishes five similarly-named unit services returning 129 and
214 features, and which one a season is written in must be read from the
regulations, not guessed; and Nevada's units are TEMPORAL
(`is_active`, `year_deactivated`), so a snapshot without the date fields answers
last year's geography. Every count
below is computed by `npm run report:us` from evidence at call time. The
generated `content/registry/us-state-coverage-matrix.generated.json` covers all
50 states and the District of Columbia and is checked by
`npm run validate:us-coverage`. It records authority, readable regulations,
exact GIS source where parity-tested, real management terminology,
map/rules/species/hours, provenance, intelligence, Ready to Hunt and explicit
gaps. A state cannot look covered merely because a status was edited.

Per-state status is three independent lanes — MAP, REGULATIONS, INTELLIGENCE —
and a state is never promoted past what its evidence supports:
`UNAVAILABLE → LICENCE_BLOCKED → IN_DEVELOPMENT → CERTIFIED → SERVED`.

As of 2026-09-29, four states have checked implementation evidence (live
parity, a certified bundle, or both). The honest end-to-end classification is
**0 COMPLETE, 1 PARTIAL, 1 REGULATIONS ONLY, 49 UNSUPPORTED**:

- **Idaho — SERVED, both lanes.** The first U.S. state live. CC-BY licence,
  708-point live parity with 0 disagreements, 54 pronghorn rules over 40 hunt
  areas built from the 2026 Big Game booklet, 16 of 16 certification cases.
  Hunt codes are a first-class dimension; a tag for an area that does not cover
  the point is answered ("a tag for it does not authorise hunting here"), not
  ignored. Hunting hours are certified as half an hour before sunrise through
  half an hour after sunset, but exact clock times remain unavailable until the
  Salmon River/municipality time-zone rule is implemented. Ready to Hunt is
  PARTIAL for pronghorn: it carries the Idaho hunting licence and controlled-
  hunt tag/draw requirements with official provenance and purchase channels;
  current fees, education, hunter orange, methods, ammunition and method-
  specific validations remain explicitly uncertified.
- **Montana — REGULATIONS CERTIFIED, MAP LICENCE_BLOCKED, nothing served.** 28
  rules across 5 species, 18 of 18 cases, 9 of 9 change drills. FWP grants
  access "on a strictly 'as is' basis" and states no reuse terms, so the code
  enforces the block and the work is withheld in full. This is the clearest
  case of the programme's real bottleneck: the engineering is done and the
  permission is not.
- **Michigan — licence CLEARED, not yet built.** A public record with no
  restrictions on use, reproduction or distribution — the only state so far
  that permits a stored copy (not acted on; U.S. layers stay live-service by
  the owner's decision). 115 deer units plus 14 further game geographies on one
  service. Serving is blocked on the conformed text and effective date of WCO
  Amendment No. 6 of 2026, which rescinded DMUs 351 and 352: meeting minutes
  establish the vote but are not the instrument and supply neither fact.
- **Licence-blocked (8): CO, ME, MN, MT, ND, SD, WI, WY.** Each blocked in its
  publisher's own words, recorded verbatim with a hash in
  `content/registry/us-map-licence-findings.json`, with a drafted letter in
  `docs/correspondence/`.
- **49 jurisdictions are UNSUPPORTED end to end.** Some have discovery sources
  or blocked parity work, but no production path. Every one has an explicit
  matrix row; no jurisdiction can silently disappear from the report.

The zone endpoint now asks Census TIGERweb for state identity when a valid U.S.
point is outside every served hunting layer. It returns the state, authority,
readable official source and exact coverage state while refusing to invent a
unit. Census geometry remains attribution only — never drawn as hunting
geography and never used as a regulatory input. Provider failure or a point
outside the United States retains the generic unsupported answer.

**Licence-first is the working order**, adopted after Montana: a state's MAP
licence is read and recorded before any rules work is spent on it. Silence is
never permission. Two blocked kinds are kept distinct because they are undone
differently — a SILENCE (UNRESOLVED) means the publisher may never have been
asked, so a person must ask; a REFUSAL (RESTRICTED/PROHIBITED) means it has
answered, and only a written exception would change that. Reporting them
identically would make a refusal look like an errand.

**Permissions remain a material bottleneck, but discovery and regulatory
engineering are also incomplete.** Eight reviewed map paths require publisher
action or an exception. Michigan's licence is clear but its controlling 2026
instrument is missing. The remaining states still require authoritative source,
licence, geometry and regulation certification; the matrix states each gap
rather than grouping discovery-only rows with implementation evidence.

Supporting architecture now in place:

- **A state resolver independent of hunting geometry.** `point → state →
  hunting geography → rules`, from Census TIGERweb (public domain, 17 U.S.C.
  § 105), bounded and cached, never drawn, never a zone id, never a rule input.
  A unit layer's extent is a rectangle and cannot answer "which state".
- **`SourceLicence` records** hold the publisher's words verbatim with a
  sha256, so a reworded licence is a visible change. Using and KEEPING are
  separate permissions (`licencePermitsServing` vs `licencePermitsStoredCopy`);
  an ingest asks the second, never the first.
- **`serving` and `rulesServing` are separate flags**, so drawing a boundary is
  never a claim that the rules inside it are certified.
- **Opening-payload cost is measured before a state is served**
  (`scripts/us-overview-budget.mjs`), at brotli quality 5 as a CDN serves, and
  refuses to report a number if any layer failed to draw.

Known, unresolved, and blocking Michigan:

- **Nesting is not conflict, and the engine has no third state for it.**
  Michigan publishes a county unit, a multicounty unit and a CWD core over the
  same ground on purpose — the Lansing capitol is in three deer units at once,
  Detroit in two — all on ONE layer with no field distinguishing kind.
  Reporting that as a conflict would show a hunter a defect where the authority
  intends a hierarchy. Whether the Wildlife Conservation Order states a
  precedence rule is being read; if it does not, that is recorded as explicitly
  absent rather than inferred from code ranges.
- Earlier reconnaissance in `research/hunting/us/` (51 readiness rows, 65
  source rows) remains research only and is superseded, where they disagree, by
  the certification report.
- Several states define units by written description and say the text governs
  where the map disagrees (MN, ME, SD by county in rule). A polygon there is a
  depiction, not the law, and intra-unit exclusions are often absent from GIS
  attributes.

### Other Countries
Future.

## Species Coverage

Maintain a reference to the authoritative species registry rather than duplicating the entire registry here.

Research registry: `research/hunting/species-master.csv` currently contains 133 North American species and protected identification-risk entities, with 56 alias records. Eastern wolf, Arctic fox, Canada lynx, New England cottontail, striped skunk and wolverine were the only genuine gaps added during Wave 2 reconciliation; existing canonical records such as North American beaver, mountain lion/cougar and brown bear/grizzly were reused rather than duplicated. Separate research tables cover 66 jurisdiction-specific regulatory-group mappings, 15 identification risks, 25 range-source leads, 24 seasonal modules, and 25 content opportunities. None encodes universal huntability or production editorial coverage.

Current editorial coverage (2026-09-30): **485 published species** (Waves 1–4),
each with a required take eligibility — 209 HUNTABLE, 231 LIMITED_TAKE, 28
NUISANCE_OR_INVASIVE_TAKE, 4 NON_QUARRY, 13 UNKNOWN; 468 are offered in Hunt.
Wave 4 (352 species: mammals 4a, birds 4b, reptiles and amphibians 4c) comes
from the jurisdiction-first take audit and is built from researched profiles
(`research/hunting/profiles/`) that cite pages actually read (NatureServe,
Animal Diversity Web, Audubon, agency pages; Wikipedia only as a labelled
secondary source). 101 earlier species cited a Cornell page nobody read or the
ITIS home page; their text was replaced from the sources read. Rebuild with
`npm run species:build`. The history
below records how the first 60 were reached.

**Jurisdiction × species take matrix** (`research/hunting/species-take-matrix.csv`,
generated by `scripts/build-species-take-matrix.mjs` from
`research/hunting/take-audit/*.jsonl`): 4,239 audit rows from 65 jurisdictions
(51 U.S. + DC, 13 Canadian + the federal layer) resolve to 4,589 matrix rows;
462 species carry published take listings from 308 authority sources, shown on
each profile as "Where it is listed for legal take" (a listing, never a season).
Every animal an authority lists for take is a published species or a documented
exclusion (66, in `take-exclusions.csv` with jurisdictions and sources: small
mammals, bats, commensals, federally listed species, unprotected-only). Audit
gaps, named rather than inferred: New Jersey and New York (every official source
bot-blocked), Massachusetts and Michigan (statute only), Arizona (department
PDFs; agency site blocked; waterfowl rows are 2025-26), Nebraska/Kansas/Nevada
partly via older or eRegulations-hosted guides, Yukon (blocked), PEI (2022
consolidation). Group rows resolve on evidence (see Known Problems); a group
season never legalizes a member the source does not name.

**Readiness is generated, not asserted:** `docs/species-readiness.md` (from
`scripts/report-species-readiness.mjs`, `--check` in CI) with the per-species
stages in `research/hunting/species-readiness.json` and the species ×
jurisdiction dimension matrix in `research/hunting/species-jurisdiction-coverage.csv`.
At 2026-09-30: 485 species, 468 Hunt-selectable, all 468 reaching at least one
served zone layer; rule coverage FULL 0, PARTIAL 20, FEDERAL_ONLY 54, NONE 394.
Species × jurisdiction: take established + rules certified 31, + partial 206,
+ not ingested 4,182, source blocked 525, no take evidence 4,501.
Production (`scripts/verify-species-production.mjs`): 485/485 pages 200, picker
membership matches eligibility for 485/485.

Spatial coverage (where the animal is, never whether it is legal) is generated
in `docs/species-spatial-coverage.md` from the live universe (2026-10-06): the
catalogue's 485 species are HUNTABLE 203, LIMITED_TAKE 237,
NUISANCE_OR_INVASIVE_TAKE 27, NON_QUARRY 5, UNKNOWN 13; **467 are offered in
Hunt; 230 are heat-eligible (`permitsSpeciesHeat`), and all 230 have a served
surface — no blockers.** Seven species left the heat universe on evidence (red
deer, Himalayan tahr, red-legged and rock partridge, helmeted guineafowl and
Indian peafowl to LIMITED_TAKE; feral ferret to NON_QUARRY). Best tier: T3
systematic survey 72, T5 range + habitat 158, T6 known distribution 0; no
species has T1, T2 or T4 as its best tier (the grouse model is a complement
beyond the survey, and Alberta's densities are zone evidence in the card, never
painted). 229 range surfaces, all range + habitat (methodology 2.5.0, 2026-10-08:
stray geography by the statement's own states and provinces; USGS GAP range
maps for 187 species, read sub-watershed by sub-watershed, where nobody
records); confidence MODERATE 160, LIMITED 69, never HIGH; 15 ranges still have an edge that follows recording, all
northern. The range reads and the foundations cross 180° to Attu (172°E).
FULLY_PRODUCTION_REACHABLE is in *Validation*, from the browser certification
of production.

- Wave 1 publishes ruffed grouse, spruce grouse, sharp-tailed grouse, wild turkey, white-tailed deer, moose, American black bear, snowshoe hare, mallard and Canada goose in `en-CA`.
- Wave 2A publishes 17 mammals; Wave 2B publishes 8 upland/migratory birds; Wave 2C publishes 20 waterfowl; Wave 2D publishes elk, caribou, mule deer, pronghorn and the canonical brown bear entity (with grizzly retained as terminology rather than a duplicate species).
- The production selector groups 60 compact options and searches common, scientific, French, alternate, category and hunter terminology while keeping the remaining research-only registry out of runtime publication. Only the regulatory coverage registry enables evaluation, per jurisdiction.
- Counts re-verified 2026-09-21: 60 production species (1 in `en-CA.json`, 9 Wave 1, 17 + 8 + 20 + 5 across Waves 2A–2D), 133 research species, 8 with certified rules (all Ontario), 52 knowledge-only, all 60 in the verified no-photo state. Eastern wolf (with its contested-taxonomy wording), Arctic fox and Canada lynx are published; New England cottontail, striped skunk and wolverine are research entries only.
- The live media read model supports one canonical PRIMARY image per production species without changing the content bundles. Population is 0/60 after production certification cleanup; verified editorial images can be assigned once a permanent administrator identity is allowlisted.
- Lookalike paths are reciprocal and generated (`ef6e924`): snowshoe hare ↔ eastern cottontail and Arctic hare, mallard ↔ American black duck, each already named on the Wave 2 side.
- Search certified 2026-09-21 against the production repository: `wolf` → Eastern + Gray wolf; `fox` → Arctic, gray, red; `rabbit` → Arctic hare, eastern cottontail, snowshoe hare; `duck` → 17 species, never Mallard alone; `goose` → 5; `doe`/`buck` → both deer with a sex intent on white-tailed deer; `bull moose` → Moose with a MALE intent; exact names resolve to one species.

## Data Providers

Record actual production providers here once selected:

- Database: Supabase (PostgreSQL + PostGIS in the `extensions` schema), project `nxzaatqovhbvziecogan` in the North Ground Bushcraft organisation, PostgreSQL 17.6. The repository's migration files and the database's migration ledger were reconciled on 2026-09-21 and agree version for version (18 = 18), and replaying the files into an empty database produces production's schema exactly. How they diverged, the mapping evidence, and the rule every new migration follows are in `docs/supabase-migration-history.md`. Check with `select version from supabase_migrations.schema_migrations` against `ls supabase/migrations`. It backs Hunt Brief snapshots, share rate limiting and the normalized zone registry. Configured in Vercel Production and Preview.
- GIS: Government of Ontario LIO Wildlife Management Unit Feature Layer, used both for certified point resolution and for the map's viewport zone geometry. It is the only jurisdiction whose boundary layer has passed endpoint, schema, coordinate-system and licence review.
- Map: Google Maps JavaScript API, live, with North Ground's own regulatory overlays on top and a Terrain/Satellite control. The basemap-free boundary view remains the fallback when the key or the API is unavailable. Neither is a legal survey, and Google's required attribution is never covered.
- Geocoding / place search: Google Places API (New) and Geocoding API are configured, but production is answering from Nominatim, the keyless fallback, because the server key is refused (Known Problems). The attribution shown follows whichever provider answered, and provider choice never changes regulatory truth.
- Weather: Google Weather API is configured as primary, but production is being served by Open-Meteo, the configured fallback, because the server key is refused (Known Problems). Environmental context only, current day through the provider's horizon; no climatology substitution.
- Google Cloud project `ngbc-509209`. Two keys, each restricted to exactly what it needs: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is HTTP-referrer restricted to the production host, the apex, `*.vercel.app` and `localhost:3100`, and limited to the Maps JavaScript API alone — the browser never calls Places directly. `GOOGLE_MAPS_SERVER_API_KEY` is server-only and limited to Places API (New), Geocoding API and Weather API. Both restrictions were verified by calling a non-permitted API with each key and confirming `REQUEST_DENIED`.
- Analytics:
- Email: Resend Contacts + dedicated Segment, configured and production-certified.
- Error monitoring:

Do not list aspirational providers as implemented.

## Hunt Species Detail — Decision Surface (2026-09-29)

### What a hunter now sees
Opening a species in a zone leads with the answer: status, then the conditions
that qualify it, then the season as two labelled dates, then legal hours, then
Ready to Hunt. Regulatory prose and provenance moved behind disclosure; nothing
operational did.

- **Conditions are structured and in the scan.** `RegulatoryCondition` keeps a
  line's text apart from its pinpoint and source, so several conditions group
  under one source affordance and a validator can test that a line HAS a source.
  `RegulatoryResult.requirements` is unchanged for the zone card, the Hunt Brief
  and the long form, and is now DERIVED from the structured list.
- **"With conditions" is earned by the data.** `settle()` has no OPEN branch —
  every in-season rule returns CONDITIONAL — while Québec, BC, Ontario small
  game and the federal bundle enumerate none. The engine's STATUS is unchanged
  (it gates Ready to Hunt); the displayed word drops the qualifier when no
  condition can be shown, which also stops the sheet disagreeing with the zone
  card on the same evaluation.
- **Closed species show when they next open**, rendered per `NextSeason`
  variant so "not yet published" can never draw as "no further season".
- **Fixed a measured overflow**: at 375px the "In season, with conditions" pill
  is 276px and pushed Details 17px past the card edge. Fixed from the sheet's
  own stylesheet, not `HuntApp.module.css`.

### Québec legal hunting hours — RESOLVED
- **Clock:** Loi sur le temps légal, CQLR c. T-5.1, s. 1 — the 63rd meridian
  West, not the 68th. West of it the Act answers completely (every southern
  hunting zone). East of it three reckonings turn on named territories (MRC de
  Minganie; Îles-de-la-Madeleine and Listuguj; the remainder, Atlantic standard
  all year with no summer shift). Each is settled in the Act; what North Ground
  cannot do is place a POINT in one, so the east is refused and says which
  boundaries would settle it.
- **Hours:** there is no hours section. « heures de chasse » returns zero across
  r. 12 and r. 1 — Québec legislates hunting time under « nuit ». C-61.1 s. 56
  prohibits hunting except as a regulation permits, s. 1 defines night, and
  r. 12 s. 21 permits night hunting for an enumerated few. The complement is
  ±30 minutes. Three independent reads agree.
- **`LegalTimeException`** is a new contract field: s. 21's night permission
  turns on the METHOD (hare by snare), which no single window can express. It
  carries a stated direction, because WIDENS and NARROWS fail differently.
- **Turkey** cites r. 12, art. 14, **septième alinéa**, anchored. It shipped
  once as "para. 6" — an index from zero — which landed on a real provision
  about small game in zone 3. A citation to nothing gets caught; one to the
  wrong real rule gets believed. A test sweeps for bare paragraph indices.

### Québec Ready to Hunt — PARTIAL, small game only
Covers arctic hare, snowshoe hare, eastern cottontail, ruffed/spruce/sharp-tailed
grouse. Big game gets no checklist rather than one built from the nearest thing
to hand.

- **Hunter orange is in the Règlement sur les ACTIVITÉS de chasse (r. 1) ss.
  17.1–17.3, NOT r. 12.** r. 12 contains zero occurrences of « orang » in
  114,000 characters against 283 for « chasse » — a measured negative. Verified
  independently before encoding; a test asserts every orange citation names r. 1.
- **Orange turns on the method for hare only**: s. 17.3(1°)(c) exempts arctic
  hare, snowshoe hare and eastern cottontail taken BY SNARE. Grouse reach no
  exemption. With no method given the answer is CONDITIONAL.
- **`MethodClass` gained SNARE.** The engine modelled « collet » all along;
  readiness silently discarded a SNARE answer, so the checklist could only tell
  an exempt hunter that orange was required.
- **Explicitly unresolved, not omitted:** legal methods and ammunition (r. 12
  art. 31 defines the engin types, but Annexe III — which says which type is
  permitted where — has no body text on the official consolidation) and fees
  (a separate tarification regulation, unread; every row is CHECK_OFFICIAL).
- A PARTIAL checklist now says so above its rows; previously PARTIAL rendered
  identically to VERIFIED.

### Legal-hours coverage, served matrix
| Jurisdiction | Point hours | Note |
|---|---|---|
| Ontario | RESOLVED | Time Act 90°W; Atikokan divergence stated |
| Alberta | RESOLVED | Wildlife Act s. 28; "except by trapping" carve-out carried |
| Manitoba | RESOLVED | M.R. 351/87 s. 3 |
| Québec | RESOLVED | **new**; see above |
| Federal migratory | RESOLVED | composes with provincial layers |
| British Columbia | NOT_CERTIFIED | rule encoded (B.C. Reg. 190/84 s. 14(1), ONE hour); clock blocked |
| Idaho | NOT_CERTIFIED | 49 CFR § 71.9 — Salmon River centreline and municipality override not held |

### Validators added
`answer-invariants.test.ts` runs the served matrix and enforces, **declared per
jurisdiction rather than derived**, that hours still resolve where they should
and still refuse where they should; that a refusal names its authority; that a
resolved window cites its provision and states a real timezone; that a
"with conditions" answer can name one; that every condition has a source and a
pinpoint; that `requirements` stays in step with `conditions`; and that a next
opening is strictly future. The carve-out test asks both whether the answer
carries the carve-out and whether it applies to the hunter being answered —
Manitoba asserts ABSENCE, because its ss. 12.1/12.2 are rights-based and the
blueprint keeps those out of North Ground's answers.

### Known gaps from this pass
- **BC hours are unblocked in principle**: Interpretation Act s. 26 (not s. 34)
  makes BC UTC−7 province-wide with no DST after B.C. Reg. 20/2026. The in-force
  date could not be verified, and it governs backdated evaluation, so BC stays
  NOT_CERTIFIED and pinned. Owned by another lane.
- **BC bundle lacks s. 14(2)**, the migratory half-hour tier. Latent: BC serves
  seven species, none migratory, and `british-columbia-legal-time.ts` records
  the tier. Becomes live when a migratory species is served.
- **Manitoba s. 12(2)** deems spotlighting with a loaded firearm to be night
  hunting — three conjunctive limbs, in scope for licensed hunters, unencoded.
- **Multiple season windows** are not yet surfaced per-window; the engine
  reports one season plus `next`.
- Québec methods, ammunition and fees, as above.


## Recent Product Decisions

### 2026-10-08 — Ranges keep to their own statements, take an authority's map where nobody records, and none is range-only

Range-habitat methodology **2.4.0**; all 229 range surfaces rebuilt. Three gaps
the 2026-10-06 report left open are closed, each by an authority's own words or
maps and never by a line North Ground drew.

**Strays, by the statement's own geography (`recordsNotWithin`).** Where a
published range statement names the states or provinces it reaches only as
strays, record squares lying mostly in them are set aside. The places come from
a state and province grid on the land-cover grid
(`content/intelligence/foundation/jurisdictions-0.1deg.*`), built on a runner
from the U.S. Census Bureau's cartographic boundary file (public domain) and
Natural Resources Canada's Atlas of Canada 1:1M boundary polygons (OGL-Canada).
Statistics Canada's boundary file refused the runner (HTTP 403, 2026-10-07);
that is recorded in the builder's own header and was not worked around. The grid is never drawn and
never a hunting boundary. White-winged dove leaves Canada and Alaska (82 cells,
1,129 records; under 2.3.0 it painted 1,052 cells north of 49°N), purple
gallinule leaves Canada (65 cells, 834 records), king eider leaves Florida,
Louisiana and Kansas (5 cells, 317 records; southern California, which its
statement also names, has no line to bound it and says so). A square is judged
by the land it covers, so a coastal square centred offshore is still Florida's.
The black-bellied whistling duck's statement says small flocks wander "well
north" without naming where, so no record is set aside and its surface says so.

**An authority's range where nobody records.** USGS GAP CONUS 2001 range maps
(public domain, read per species from ScienceBase, matched by scientific name,
then common name, then an unqualified alias) are imported as derived cells for
**187 heat species** (`content/intelligence/range-habitat/authority/`), each read
from its own sub-watershed table (**2.5.0**): every HUC12 is placed at the
0.1° cells whose centre it holds (USGS Watershed Boundary Dataset, HU2 regions
01–18, `content/intelligence/foundation/huc12-0.1deg.*`, 87,028 sub-watersheds,
64,581 holding a cell centre), and only sub-watersheds GAP lists as known and
extant are used, in the seasons the species lives there, clipped to the lower
48 that GAP maps. Under 2.4.0 the season-dissolved shapefile could not separate
known from extirpated or possible ground, so 27 maps (elk, pronghorn, gray
wolf, mountain lion, white-tailed deer, brown bear, caribou and others) were
refused whole; elk's table alone holds 40,777 extirpated sub-watersheds beside
16,200 known. **One is refused**: common gallinule's archive holds no table.
The national WBD geodatabase lost a runner twice (read whole, then from inside
its archive); the region-by-region read is what completed. Ground inside a map joins a
range only where the species' group is barely recorded (fewer than 10 records to
a 1.4° cell); on recorded ground the records' silence stands, because coarse
maps are drawn wider than species live (2.4.0 figures: 53 surfaces gained
ground — northern leopard frog 18,995 cells, bullfrog 18,133, snapping turtle
10,378, prairie rattlesnake 7,547; under 2.5.0 the newly read maps add, among
others, American badger 1,986, beaver 1,937, fox squirrel 1,907, white-tailed
jackrabbit 1,525). Ground GAP calls possibly present or potential is not
counted as the authority's edge. A GAP edge in the lower 48 is the authority's edge, so
**ranges whose edge follows recording fall from 23 to 15** — all northern, where
no open authority map reaches. ECCC's open data catalogue, listed through its
own public endpoint, holds no national Species at Risk range-extent dataset;
open.canada.ca's API and GeoNetwork refuse the runner. Three surfaces (red fox,
black-tailed jackrabbit, spiny softshell) went LIMITED because the added ground
moved their habitat-concordance ratio to 0.94–0.99 against the declared 1.0
(and under 2.5.0 white-tailed jackrabbit, at 0.99);
the rule was not adjusted after seeing it.

**No species is range-only.** The six range-only species now rest on published
habitat statements, read from Hawaiʻi Birding Trails (sandgrouse at Waikiʻi
pasture and grassland; francolin in dry areas and near hotel lawns; kalij at
wet-forest, dry-forest and pasture sites), Audubon (snowcock on steep, barren
slopes above treeline, with relief required), Animal Diversity Web (Japanese
quail: grassy fields, river banks, rice fields) and ADW plus EDDMapS (ringed
turtle-dove: suburban, near people). The European rabbit is drawn from the
Alberta Invasive Species Council's statement that feral rabbits thrive in towns,
parks, farmland and grassland, so its urban colonies are no longer masked as
town; its range statement now names American Camp on San Juan Island (NPS), feral
rabbits across Alberta (AISC) and south Anchorage (ADF&G). The Eurasian collared
dove's statement adds Alaska's deleterious-exotic-wildlife listing (no closed
season, no limit), which is why its Alaskan and Yukon records stay range.
**T6 is 0 of 230; T5 is 158.**

Tests (`range-habitat.test.ts`): stray jurisdictions paint nothing deeper than
the family's reach across the line; the fill rule adds only unrecorded ground the
map covers and never removes any; a GAP map is imported only when every
sub-watershed is Known/extant and its publication date was read; a surface that
used an authority map says so, credits it and dates it (`AUTHORITY_RANGE` in
`STALENESS_RULES`: 10 years current, 20 ageing). Falsified: the king-eider check
failed against the first 2.4.0 build, which judged squares by their centre and
kept offshore Florida squares.

### 2026-10-07 — Step 3 measured: "facts live only in summary" is mostly WRONG, and what survives it is sharper

**The area hunting-effect vocabulary the owner declared is now implemented**
(`107751dc`). CLAUDE.md §41A declared DEEMED_OPEN / EXCLUDED /
OPEN_ONLY_IF_LISTED / UNRESOLVED on 2026-10-01; measured before building,
`DEEMED_OPEN`, `OPEN_ONLY_IF_LISTED` and `huntingEffect` had **0 occurrences** in
`src/`, `content/` or `research/`. Five ad-hoc representations had accumulated in
its place and the only one reaching an answer — `exceptInside: string[]` —
carries names only and can do exactly one thing: degrade. `AreaEffect` extends
the existing `RestrictionRecord` rather than becoming a sixth address, DEEMED_OPEN
structurally requires an `AuthorityQuotation` (North Ground cannot deem ground
open on its own say-so), and `listed` is three-valued because an absent list is
UNKNOWN. Additive — nothing consumes it yet, so no behaviour moved. The US GIS
lane consumes it for Illinois closures rather than defining a parallel model.

**THE EARLIER AUDIT CLAIM IS REJECTED AS STATED.** Three independent
measurement passes over the real registry boundary agree that non-RESOLVED
answers are NOT prose-only:

- **4,138 of 4,138** CLOSED answers across all 14 certified jurisdictions carry
  a structured companion.
- **2,787 of 2,787** out-of-season answers carry resolved ISO windows in
  opportunity rows; `ontario.ts` carries `season` on 102/102; every path carries
  a structured `next`.
- So season DATES on a CLOSED answer are structured, and the claim that they are
  "moved into prose" is wrong for the main path.

**WHAT IS GENUINELY PROSE-ONLY, and it is the authority's WORDS rather than the
facts:**

- **The authority's own closure wording reaches 0 of 4,138 CLOSED answers.** Six
  bundles hold it as a fully provenanced `AuthorityQuotation`, and it is lost in
  transit.
- **The closure CAUSE has no field at all.** 909 of 4,138 embed
  `absence.explanation` as free prose with no owner and no language; there is no
  field on `RegulatoryResult` for a closure cause.
- **Québec pastes ministry French into an English sentence. VERIFIED HERE, 10 of
  10 sampled CLOSED answers**, e.g. "No american black bear season in Zone 10
  West is open on this date … Seasons open to any licence here: armes à feu,
  arbalète et arc, 2026 Du 15 mai au 30 juin 2026." The ministry's own words
  carry no `lang` and no `owner`. §41A requires authority wording to be quoted
  and tagged, not spliced into North Ground's sentence.
- **UNKNOWN is at least five statements with one representation** (3,818
  answers). Three of the reasons ARE structured upstream — `zone-layers.ts:710`
  returns a closed union, `geography.ts:162` declares a `kind` — and are lost
  on the way to the result.
- **CONFLICT carries neither which sources disagree nor what each said** (56
  answers), while the precedent exists as `ZoneResolution.conflictingZoneIds`.

**A CORRECTION TO MY OWN EARLIER NOTE.** I previously declined a §47 finding
here, having measured that `closureStatedAs` is never French (23 strings, all
English jurisdictions) and that Québec's 130 restriction NAMES are proper names,
correctly untranslated. Both of those remain right. They were a narrower
population than the claim covers: the ministry French arrives through the
seasons listing, not through either path I checked. The decline was sound on its
evidence and the evidence was too narrow.

**Not fixed, deliberately.** `describeSeasons` builds a composite string in which
part is the authority's wording and part is North Ground's framing, with no
boundary — so the fix is to split authority wording from North Ground framing at
that site, which is a modelling decision rather than a patch. §47's own
`ProvenancedText` (`AuthorityQuotation` with mandatory `sourceId`, `citation` and
`lang`, versus `NorthGroundStatement`) is the shape it should take.

**Remaining before Step 4** (locale/provenance contract): the closure wording,
cause and provision as structured fields; the Québec splice; UNKNOWN's reason
carried rather than re-derived; CONFLICT's two readings. Step 3 is NOT complete.


### 2026-10-07 — STEP 2 DOMAIN RESULT COMPLETION is done

Two commits, independently reviewable. `/api/v1` remains nonexistent.

**SEASON BOUNDARIES ARE TWO FACTS AND THE TYPE NOW SAYS WHICH.**
`RegulatoryResult.season` was `{opens: string; closes: string}` with no declared
format. Three producers wrote resolved ISO dates; the federal migratory path
wrote a bare `MM-DD`, because a federal season is published as a recurring
annual rule. 56 species took that path and the Hunt Brief validator rejected
every one. `SeasonDates` is now ABSOLUTE (`IsoDate`) or ANNUAL (`SeasonAnchor`),
so a mixed season is unrepresentable.

It reuses the repository's own primitives rather than adding a date system:
`SeasonAnchor` already handles `{ month, lastDay: true }` for "the last day of
February", which a fresh month/day pair would have got wrong in a leap year.
`seasonCrossesYear()` is DERIVED, never stored, so Mallard's 19 September to
3 January cannot be inverted by a reader comparing strings.

It also recovered a year that was being thrown away: a relative federal window is
resolved against the evaluation date, so it HELD a full ISO date and sliced the
year off. ECCC's published British Columbia District No. 2 mallard season now
arrives as 2026-10-10 to 2027-01-24 rather than 10-10 to 01-24.

Eight live consumers were migrated, found structurally rather than from an
earlier count of four. The brief validator was NOT loosened to accept `MM-DD`; it
validates each arm, so an absolute boundary that lost its year is still invalid.
Briefs of versions 1–4 read as ABSOLUTE, which is sound rather than assumed,
because the old validator could never have persisted a recurring one.

**OPPORTUNITIES REACH THE EVALUATION, AND ABSENCE KEEPS ITS CAUSE.**
`evaluate.ts:184` destructured four of the outcome's six fields. `opportunities`
is now carried as `OpportunityAvailability`: ENUMERATED (an empty `rows` means
none apply) or NOT_ENUMERATED with a reason.

That distinction is not decoration. Measured against the real bundle: **35
answers are CONDITIONAL — which §41A paints green — while carrying no
opportunity rows**. American black bear, WMUs 82A/83A/83B/83C/84, 1–7 May 2026,
from two rules whose published `seasonPhrase` says "May 1 to May 7" and whose
`windows` array is empty. The season evaluation parses the phrase; the adapter
reads `windows` and skips the rule. A bare empty list would have reported no
opportunity where the engine had just asserted one.

**A CORRECTION TO THIS DOCUMENT.** The entry below records that Ontario major
game was NOT omitting published dates, measured as 119 non-closure phrase rules
parsing with 0 failures. That measurement is correct and it tested the wrong
thing: `parseSeasonPhrase` is not what the opportunity adapter reads. The dates
reach the answer; the rows did not. The five rules involved are the same five the
original audit named. Both halves now stand.

**`exceptInside` was deliberately not threaded** — documented whole-zone-only, so
its absence from a point answer is correct rather than a gap.

**Counterfactuals, and which mechanism caught each.** Season: inventing a year
for a recurring rule, discarding a year from an absolute one, mishandling
Sep→Jan, and loosening the brief validator — TypeScript caught NONE of the first
two, because both produce a valid `SeasonDates` and the error is semantic.
Threading: dropping opportunities (tsc + contract), collapsing the absence states
(nothing, until an end-to-end test was added), and dropping the gap at its source
(threading test). The second one is the lesson: the engine-level tests proved the
engine reports why, and still passed when the evaluation stopped carrying it.

**Wire shapes that changed, named rather than changed silently.**
`/api/hunt/evaluate` now emits `season.kind` and an `opportunities` object;
`/api/hunt/zone-summary` emits `season.kind`. Every in-repo consumer is migrated;
no external consumer exists.

**Remaining before Step 3.** The authorized sequence is unchanged: structured
non-RESOLVED outcomes, locale/provenance contract, partner authentication,
centralized rate-limit/accounting or no advertised quota, adversarial contract
review, then `/api/v1/hunt-evaluations`. Three findings are recorded but NOT
fixed, because none blocks Step 2: `criterion: null` is hardcoded at the only
opportunity producer so Québec's 7 cm antler threshold still lives in
`classLabel` as prose; `implementWords` and `seasonWords` are declared on
`ResolvedOpportunity` with no producer and no consumer, which is dead state today
and an API-boundary hazard the moment it is published; and the five Ontario rules
whose `windows` are empty should eventually be enumerated rather than reported as
a gap.

### 2026-10-07 (later) — The audit's worst claim is refuted; its smallest one is a shipped defect that breaks Hunt Briefs for 56 species

Both checked here, against the data and the real validator, not taken from the
audit.

**PARTLY REFUTED, and corrected in the entry ABOVE: Ontario is not omitting
published DATES, but it was omitting opportunity ROWS.** The audit reported
5 non-closure major-game rules carrying a `seasonPhrase` with no structured
window, on white-tailed deer and american-black-bear — species that also have
enumerable rows — and called it the understating direction §8 says nobody
reports. Measured over `ca-on-major-game-2026.json`: 135 rules, 16 declared
closures, **119 non-closure rules with a phrase, and 0 that fail to parse into a
structured window.** The rows it quoted do parse — "October 1 to November 6
November 16 to November 29 December 7 to December 15" yields 3 windows and
"May 1 to May 7" yields 1.

Positive control on that zero, because an empty result and a true negative are
the same output: the field names are real (`declaredNoSeason` on 135/135,
`seasonPhrase` on 119, and 119 + 16 = 135), and the predicate does detect
unparseable text — `parseSeasonPhrase("on application to the Minister")` and
`("")` both return null while `("October 1 to November 6")` returns a window.

One correction to my own first reading: I reported the parsed windows as
`undefined..undefined`. That was my accessor. `parseSeasonPhrase` returns
`SeasonWindow` — `{opens:{month,day}, closes:{month,day}}` — not `ResolvedWindow`
with `opensIso`. The windows are fully structured and year-less by design,
because a season phrase has no year.

**CONFIRMED, and worse than reported: `season.opens` breaks the Hunt Brief for
every federal migratory bird.** `types.ts:109` declares `opens: string` with no
format. Of its four producers, `conditional-engine.ts:1299`, `major-game.ts:509`
and `ontario.ts:303` write `*.opensIso`; `federal.ts:347,351` write
`monthDay(...)`, a bare `MM-DD`. Measured through a real `evaluateHunt`:

    american-woodcock  CONDITIONAL  {"opens":"09-15","closes":"12-16"}
    mallard            CONDITIONAL  {"opens":"09-19","closes":"01-03"}

**56 species take that path** — every federal migratory game bird, confirmed two
independent ways (a filter over the 485 published species, and
`federalSpeciesIds()`). The audit guessed 54; the denominator it gave ("of 83
answerable") remains unverified and is not repeated here.

Four consumers treat the field as a date — `HuntBriefCard.tsx:72` formats it
with a year, `SeasonDates.tsx:52` passes it to a prop named `iso`,
`ZoneContext.tsx:187` reads it as a day, and `hunt-share/model.ts:601` validates
it with `date()`, which throws unless it matches `ISO_DATE`. Proven through the
real validator rather than inferred: the standard brief fixture carrying
`"2026-09-15"` parses `found`; the same brief carrying the exact federal value
`"09-15"` is **REJECTED, `{"status":"invalid"}`**.

Mallard shows a second harm independent of validation: its season crosses the
year as `"09-19"` to `"01-03"`, so any consumer comparing the two strings gets
the window inverted.

**Not fixed here, deliberately.** The two branches are different problems.
`federal.ts:347` slices month and day out of an ISO date it already holds, so
discarding the year there is pure loss with no modelling question. `:351` reads
a month/day rule that genuinely has no year, and §41A's "the source model wins
over our schema" says the type should be able to express a recurring annual
window rather than have one invented for it. That is a schema decision inside
domain result completion, not a patch.

### 2026-10-07 — Domain result completion: what I verified, and what the audit reports but nobody has checked

Step 2 of the owner's API sequence. **No code changed yet beyond a
characterization test (`9a0cb12e`); the threading waits.**

**VERIFIED HERE, structurally, not taken from the audit.**

`evaluateRegulation` returns a `RegulatoryOutcome` with six fields and
`evaluate.ts:184` destructures four:

    const { completeness, required, dimensions, regulation } = await evaluateRegulation(...)

so `opportunities` and `exceptInside` are computed by the engine and dropped one
line before the result is built. `exceptInside` is documented "whole-zone
answers only", so its absence from a POINT answer is correct and is NOT a second
gap — checked rather than reported.

**`season.opens` carries two incompatible calendar meanings under one bare
`string`, and this is shipped.** `types.ts:109` declares `opens: string` with no
documented format. Four producers write it:

| producer | writes |
| --- | --- |
| `conditional-engine.ts:1299` | `window.opensIso` — ISO |
| `major-game.ts:509` | `containing.opensIso` — ISO |
| `ontario.ts:303` | `first.opensIso` — ISO |
| `federal.ts:347,351` | `monthDay(...)` — **bare `MM-DD`** |

`monthDay` (`federal.ts:212`) slices month and day out of an ISO date it already
holds and throws the year away. Three of four producers name the variable
`opensIso`; the federal path is the only one that discards the year. This is
§8's own failure mode — a date that may be `2026-09-15` or `09-25` is not
comparable, filterable or convertible — on the field a partner is most certain
to parse. It reaches production today through `/api/hunt/evaluate`, which
serializes the evaluation verbatim.

**REPORTED BY THE AUDIT AND NOT YET VERIFIED.** Recorded so the next session can
check them, not as established fact:

- Absence of opportunities is said to have **five causes and one
  representation** (optional field; the adapter `continue`s past closures at
  `opportunity-adapter.ts:86` and past rules with no ISO window at `:88`;
  `major-game.ts:591` returns rows only when non-empty; three constructors in
  `evaluate.ts` answer for uncertified ground). `registry.ts:66` warns in PROSE
  that "absence is a gap in what is carried, never a statement that no
  opportunity exists" — and prose is not a wire state.
- **The understating direction, which §8 says nobody reports.** Ontario major
  game is said to hold 5 non-closure rules with a `seasonPhrase` and no
  structured window, belonging to white-tailed deer and american-black-bear —
  species that ALSO have enumerable rows. If so, those species' row sets look
  complete and are not, and published dates North Ground holds are silently
  omitted beside rows that are present. This one deserves checking first.
- `criterion: null` is said to be hardcoded at the only producer
  (`opportunity-adapter.ts:107`), so Québec's 7 cm antler threshold still lives
  in `classLabel` as French prose — §8's own named example, unresolved.
- `implementWords` and `seasonWords` on `ResolvedOpportunity` are said to have
  zero producers and zero consumers.
- The audit reports it also rejected two reader framings; those are in the run
  output rather than here.

**The audit's own count I did not reproduce.** It claims 54 of 83 answerable
species take the federal path, which would make the bare month-day the majority
case. My probe to confirm that errored and I did not retry it, so **the share is
unmeasured**. The structural fact above stands on its own; the proportion does
not.

**What exists.** `9a0cb12e` pins the evaluation's field set for one Ontario
fixture, with its own limitation recorded in the test: threading `opportunities`
with a conditional spread leaves it green, because that fixture produces none.
Certifying that opportunities arrive needs a fixture whose evaluator emits them
— major-game and Québec are the two that reference them.


### 2026-10-07 — Public API v1: the Phase B prerequisites are landed and the v1 surface is NOT settled

**Where the milestone stands.** Phase A (audit) and Phase A.1 (`1da28014`,
extracting `src/lib/hunt/zone-answer.ts`) are on main. Phase B — the
domain/serialization boundary — now has its prerequisites landed (`c4487548`)
and its surface design REFUTED. No v1 endpoint exists and none should be built
until the open questions below are answered.

**A correction to Phase A's record.** The commit message for `1da28014` says
"nine of ten" Hunt routes are thin shells. Measured: there are **18 route files
under `src/app/api`, 13 of them under `src/app/api/hunt`** — the denominator is
wrong — and **`/api/hunt/zones` is a second non-shell** that the message does
not name. It holds an inline unexported nine-field layer projection
(`route.ts:54-69`), builds its response envelope inline (`:71-86`) and derives
its cache policy from `result.status` (`:91-94`); no library holds any of it. A
v1 geometry endpoint would be the next independent `ZoneLayer` projection, so
that extraction is a Phase B precondition, not a nicety. The commit message is
immutable; this is the correction.

**The gate was running 12 of 18 component tests.** `test:components` was
`node --test src/components/**/*.test.ts`, and npm runs scripts under `/bin/sh`,
where `**` does not recurse. Two files — `limitation-groups.test.ts` and
`zone-list-labels.test.ts`, 6 live passing tests — had never run under
`npm test`. It is interactively invisible because this environment's shell is
zsh, where `**` does recurse: running the command by hand prints all 18, and
only the npm path shows the gap. `test:routes` carries the identical pattern and
survives by accident (`src/app/*/*` matches nothing, so sh passes the literal
through and node's own runner globs it recursively); the first test placed one
level deep under `src/app` would turn that suite dark with no failure and no
warning. All three now quote the pattern. Every suite total reported in this
document before 2026-10-07 was counted with those 6 tests excluded.

**The extracted serializer returned `unknown`.** `zoneAnswerBody`'s `never`
made a seventh outcome a compile error but said nothing about what any arm
returns. Measured on the code as it stood: making the RESOLVED arm return the
JURISDICTION_SCOPED body left typecheck clean, 4/4 zone-answer tests passing and
8/8 route characterization tests passing. Each body is now keyed to the outcome
it serializes, so both that swap and the NOT_SERVING/NO_GEOGRAPHY collapse fail
to compile. A plain union return type would not have closed either, because a
swapped arm returns a different member of the same union.

**Four outcomes shared one wire status.** Both `UNSUPPORTED_US_STATE` paths,
`NO_GEOGRAPHY` and `NOT_SERVING` all serialize `status: "UNSUPPORTED"`, so a
reader branching on `status` could not tell "no authority publishes boundaries
here" from "we hold this authority's boundaries and have not certified them
against it". The distinction survived only in prose. It is the same collapse
`1da28014` named as its own counterfactual — prevented in the domain union and
then performed by the serializer reading it. The added `outcome` field carries
it; `status` and every existing field are unchanged, and the Hunt client types
`status` as a bare string.

**Three of the six outcomes were reached by no test** — RESOLVED,
JURISDICTION_SCOPED and UNSUPPORTED_US_STATE, which are the three that carry an
actual answer — while the test file's own header said all six were. Covered now.

**The v1 surface design was refuted on all three review lenses**, with seven
blocking findings, so it is not built. The substantive ones: a closed
`RegulatoryConditionKind` on the wire would make certifying a new jurisdiction a
v2 event, which contradicts §41A's "the source model wins over our schema"; no
locale on any request while answers carry authority words in the language the
authority published them in (§47); `withinZoneRestrictions` and `harvestLimits`
publishable inside a territory closed to all hunting; and `counts` in a zone
summary reimplementing a domain decision in the serializer. The design is
sound on its core claim — a second serializer over canonical entry points — and
wrong in its surface.

**One claim corrected during review.** The audit reported that a published
answer's `legalTime.authority` reads "North Ground" and called it §11 violated
by default. `evaluate.ts:115,131,147` do pass that string, but **no renderer
displays `legalTime.authority`**, so it is not a live defect; Québec correctly
passes "Gouvernement du Québec". It is an API-boundary hazard: the field means
"whose rule this is" on a resolved answer and "who is declining to state one" on
a NOT_CERTIFIED answer, and a v1 that serialized it verbatim would publish North
Ground as the authority on every uncertified answer. A wire contract may not
have a field whose meaning changes by arm.

**The owner's authorized sequence (2026-10-07).** It replaces the three open
questions this entry previously left — who the first consumer is, whether v1
waits for `ResolvedOpportunity`, and whether the non-RESOLVED paths ship prose.

  gate hardening (done) → domain result completion → structured non-RESOLVED
  outcomes → locale/provenance contract → partner authentication → centralized
  rate-limit/accounting OR no advertised quota → adversarial contract review →
  `/api/v1/hunt-evaluations` → pilot → production certification.

**`/api/v1` stays nonexistent until the three contract prerequisites are
satisfied** — domain result completion, structured non-RESOLVED outcomes, and
the locale/provenance contract. `cabf04b6` is the milestone's new starting
point.

Three questions this settles. `hunt-evaluations` DOES wait for
`ResolvedOpportunity` to reach the result; it is step 2, before any endpoint.
The CLOSED, UNKNOWN and CONFLICT paths DO get structured fields before v1
publishes them; prose is not accepted as the answer. And the quota problem is
resolved either way: a centralized limiter with accounting, or no advertised
quota at all — the in-memory per-instance limiter may not be documented as
"30/minute", because the real limit is 30 × instances and §61 forbids claiming
a capability we cannot keep.

**The serializer regression is locked** (`d76c315f`), which the owner required
before the milestone continues. The domain's six outcomes cannot collapse back
into four "UNSUPPORTED" wire states. Falsified three ways, each caught by a
different mechanism: a seventh domain outcome gives 3 typecheck errors (the
`BODIES` record, the `never`, and the test's own `Record<ZoneAnswer["kind"]>`);
an arm returning the wrong wire shape gives 1 typecheck error and 2 test
failures; and the collapse itself gives 0 typecheck errors — an `as` cast
defeats the type — and 1 test failure. The third is why the runtime assertion is
not redundant with the type.

**On the test-chain bootstrap hole**, the owner's direction is to leave it:
`validate-test-chain` tests the invariant that matters, and no further
self-referential machinery is to be added inside the same chain. CI can
eventually provide the independent outer assertion.


### 2026-10-06 — The species authority page is the renderer for all 485 species, and the six field families are carried in its contract

*Owner: "carry and migrate."*

**What changed.** `/hunting/species/[species]` renders every published species
through the Species Authority contract. White-tailed Deer keeps its authored
page; the other 484 are adapted from the structured profile each already holds
(`src/lib/species-authority/adapt.ts`). The six field families that lived only
in the legacy renderer are now carried in the contract
(`src/lib/species-authority/context.ts`), **derived at build time from the data
that owns each one** — never authored into a second file.

**What the migration was held on, and what the evidence showed.** "485 of 485
validate" measured the contract, not the page. Running both renderers side by
side over all 485 species and diffing 7,597 expected items against the SOURCE
data — not old HTML against new — found **0 dropped items**, and found gaps the
test suite could not see:

| family | old | new |
| --- | --- | --- |
| take-evidence jurisdictions | 4,462 | 4,462 |
| group names | 603 | **942** |
| lookalikes | 410 | **425** |
| conservation statements | 49 | **51** |
| related resources | 888 | 889 |
| field notes | 341 | 342 |
| review dates | 484 | 485 |

The gains are not new content. 316 species belong to more than one group and
both renderers showed only the first, losing 339 real classifications.
`similarSpeciesIds` is canonical and `relatedSpeciesIds` is contained in it for
all 485 species (0 exceptions, measured), so reading related alone showed no
lookalikes for six species — **white-tailed deer among them**. Conservation
statements were built inside the adapter, so the 484 adapted pages had them and
the one authored page did not.

**Three defects only a rendered page revealed**, after the suite was green:

- **A NON_QUARRY species offered a Species Heat map.** Whooping crane carried
  "Open the whooping crane map" directly beneath the sentence "Hunt never offers
  it". §41B gives heat to HUNTABLE and NUISANCE_OR_INVASIVE_TAKE alone, and
  LIMITED_TAKE — 237 of 485 species, the largest class — is excluded
  deliberately. The Hunt handoff now reads `capabilitiesOf()`: 230 species carry
  a map, 467 carry a species-scoped legality link, 18 link `/hunt` plainly.
- **The same sentence three times.** The hero's quick answer, the overview
  section's direct answer and its first claim were the same words for 475 of 485
  species. The overview is emitted only where it adds something; each section's
  lead sentence is its direct answer and keeps its citation
  (`directAnswerCitations`) instead of appearing again beneath itself.
- **A regression the whole suite passed through.** Moving the lead sentence out
  of `claims` left single-sentence sections empty, and the filter that removes
  sections emptied by uncitable claims deleted them — 8 lookalike lists vanished
  with the identification sections they hang off. Only the rendered diff caught
  it. `adapt.test.ts` now pins it (27 species have exactly one sourced
  identification sentence).

**Image-optional by composition.** 216 of 485 species have no verified
photograph. The hero rendered a 280px bordered box and the caption "No verified
primary photograph is set" — an empty frame and an apology on nearly half the
catalogue. The figure is not rendered at all and the hero becomes one column.
Scanned across all 485 served pages: **no unfinished-looking state on any of
them**, against 216 placeholder elements on the previous renderer.

**Reversible.** `NG_ADAPTED_AUTHORITY_PAGES=off`, or flipping
`ADAPTED_AUTHORITY_PAGES` in `src/lib/species-authority/repository.ts`, returns
all 484 to the previous renderer, which is untouched behind it. The authored
White-tailed Deer page does not pass through the switch.

**What is NOT claimed.** The adapter invents nothing. `diet` is populated for 0
of 485 species and no diet section is emitted. Hunting, shot-placement and
equipment sections are never adapted — they need guidance no profile holds. A
page is SHORTER where the research is thinner rather than padded. One content
defect was found and left for its owner: `mountain-lion`'s conservation
statement reads "Puma  concolor coryi" with a doubled space.

### 2026-10-06 — Every heat-eligible species has a working map; seven leave heat on evidence; the map reaches Attu

**Counts (live, from `docs/species-spatial-coverage.md` and the catalogue):**

| | |
| --- | --- |
| Total current species (catalogue) | 485 |
| Hunt-eligible (offered in Hunt: HUNTABLE + LIMITED_TAKE + NUISANCE_OR_INVASIVE_TAKE) | 467 |
| Heat-eligible (HUNTABLE + NUISANCE_OR_INVASIVE_TAKE, `permitsSpeciesHeat`) | 230 |
| Heat surfaces built (certified, registered, served) | 230 |
| Structurally valid (`surface-structure.test.ts`: artifact, hash, grid, coordinates, endpoint, client, renderer, 180°) | 230 |
| Production-verified (browser, against production: requested, canonical reply, drawn, no other species) | **230** — run 37624741021 against `a8fb344`, 1,502 / 1,502 checks, phone 390×844 and desktop 1280×800 |

Classes: HUNTABLE 203 · LIMITED_TAKE 237 · NUISANCE_OR_INVASIVE_TAKE 27 · NON_QUARRY 5 · UNKNOWN 13.
Best tier: T3 survey 72 · T5 range + habitat 152 · T6 known distribution 6.
Range surfaces: 229 (223 range + habitat, 6 range only), confidence MODERATE 162,
LIMITED 67, never HIGH. Methodology `north-ground-range-habitat` 2.3.0.

**The five species without a map, researched against their authorities.**
Each left the heat universe through the canonical eligibility source
(`research/hunting/wave-4-candidates.tsv`), never through a list; each stays
in the species library, and the four LIMITED_TAKE species stay in Hunt
because an authority's season for them is a real rule. CLAUDE.md §16 records
the rule ("A ranch, a release pen or a pet is not a wild population").

| Species | Finding | Class now | Evidence |
| --- | --- | --- | --- |
| Himalayan tahr | No free-ranging population confirmed since 1966 | LIMITED_TAKE (Hunt yes, heat no) | 14 CCR §472(c) "may be taken all year"; CDFW CWHR account (1988–90) rests on Barrett 1966, "probably no more than a few hundred" on the Hearst Ranch; GBIF: 0 US and 0 Canadian records 1990–2026, any licence |
| Red deer | Ranch exotic; **taxonomy conflation fixed** | LIMITED_TAKE | Mammals of Texas (2016): introduced species "limited to a few exotic game ranches and seldom … free-ranging"; TPWD exotics on private property only; 35,585 of 35,784 US records under *Cervus elaphus* are *C. canadensis*. The profile described elk throughout (field marks, habitat, range, aliases "elk" and "wapiti"); rewritten from red deer sources, aliases removed, elk named as the lookalike |
| Red-legged partridge | Released game-farm birds only | LIMITED_TAKE | Québec's 1 Aug–31 Dec season for released game-farm species; records are one Florida address and one Québec outfitter lake |
| Rock partridge | Released game-farm birds only | LIMITED_TAKE | Same Québec season; 2 records in 36 years (one a Canadian Tire lot) |
| Feral ferret | Domestic animal, no established population | NON_QUARRY (never called protected) | Alaska lists it as deleterious exotic wildlife beside rats and pigeons (finding recorded in `take-eligibility-conflicts.csv`); state surveys found no breeding feral population (CDFW journal, 2022); 4 records 1990–2026, all zoo animals |

**The audit of the other surfaces.** Every range surface was compared with its
own published range statement and its components inventoried (cells, records
and squares per connected part).

- **Two more species leave heat** on the same rule: helmeted guineafowl
  (Québec released birds only; not a Hawaiʻi game bird under HAR 13-122-6;
  24,869 cells of farm birds) and Indian peafowl (taken only in three named
  Hawaiʻi hunting areas; 22,102 cells of farm and yard birds). Both LIMITED_TAKE.
- **Eleven ranges keep to their published geography** (`recordsWithin`, the
  statement quoted verbatim, the reason recorded): zebra dove, gray francolin,
  Japanese quail (Hawaiʻi; the Mojave doves, the Alaskan francolins and the
  mainland quail are escapes), feral sheep (Hawaiʻi, drawn as its documented
  Mauna Kea population, and Wyoming) and feral goat (Hawaiʻi; farm herds
  elsewhere), chukar (west of Montana's boundary, southern BC, Hawaiʻi; release
  sites east and north are not drawn), shiny cowbird (Florida), Barbary sheep
  (New Mexico and Texas), emperor goose (Alaska; the Oregon and California
  birds are "autumn strays" — one watched stray leaves hundreds of records),
  Mexican duck (Arizona, New Mexico, Texas; northern birds are casual), and
  mountain lion (the West and Florida; eastern sightings are wanderers or
  escaped captives).
- **Reviewed and left as drawn**: ring-necked pheasant (Hawaiʻi is a game-bird
  population; Alaska allows feral non-native game birds), axis deer, nilgai,
  gemsbok, sambar, fallow deer, wild boar, black francolin, kalij pheasant,
  spotted dove.
- **Known limitation, not fixed by an unstated line**: hunting-season reads are
  vagrancy season, so expanding or wandering species whose statements give no
  bound draw some stray clusters — white-winged dove in Canada, black-bellied
  whistling duck in Michigan, Eurasian collared dove in interior Alaska and
  Yukon, European rabbit's urban pet colonies (its statement names no North
  American place). Each needs a published range statement that names the
  established range; none was invented.

**The map reaches the Aleutians and Attu.** The land-cover and terrain
foundations stopped at 170°W and the occurrence reader at 180°, so St. Lawrence
Island, the Pribilofs and the Aleutians from Umnak west were cut out of every
range without a word (arctic fox lost 71% of its records). Both foundations now
run from 172°E, stored as −188 so the grid is one continuous array across 180
(the old extent is byte-identical inside the new one); every profiled species'
records east of 180 are read as their own strip with their own provenance; the
server reads a request box in the grid's frame both as written and shifted by
−360, and the sampler reads any longitude in its grid's frame. Common murre
+1,264 cells west of 170°W, thick-billed murre +1,450, polar bear +315, emperor
goose 67 cells past 180. The ruffed grouse model was refitted on the new
foundation (identical cells, new input hash).

**Production certification found three more defects** (run 37513066111 against
`8b5f634`: 1,497 of 1,500 checks; all 230 species production reachable on the
2.2.0 surfaces; all twelve regions, pan, zoom, filters and the phone shared
link passing). Fixed in `a8fb344`:

- **A layer nobody could see called itself drawn.** A shared zebra-dove link
  on a 1280 px desktop opens over eastern North America; the request reaches
  past the screen by the renderer's margin, the margin reached Hawaiʻi, and the
  legend named a drawn "Range + habitat" layer with nothing painted on screen.
  "In view" is now found ground in the VISIBLE view (`surfacePaintsWithin`),
  and on a wide screen the visible view excludes the columns under the floating
  panel (`groundRightOf`) — at 1920 px the islands were in the map's view but
  under the panel. Every 200 reply carries the map's `extent`, so the legend
  says "mapped elsewhere" with Show where; the renderer keeps the surfaces.
- **The emperor goose had lost Adak** — "Most winter in the Aleutian Islands",
  257 hunting-season records — because its square has no neighbour within the
  clustering distance. Methodology **2.3.0**: a place the published statement
  names, confirmed by records too isolated for the clusters, may be declared
  beside them (`documentedPopulations.alongsideClusters`) and is drawn without
  being joined to anything. The clustering rule is unchanged: Adak is where
  watched strays accumulate (canvasback and ring-necked duck both have Adak
  squares), so only the statement admits the place. Of the four
  profiles naming the Aleutians, only the emperor goose's speaks for the season
  its surface draws (cackling goose and thick-billed murre describe breeding;
  surf scoter has no record there). 228 of 229 surfaces are cell-identical; the
  emperor goose gains 148 cells.
- **The certification's date change typed nothing**: it counted the date field
  before the page rendered it. It now waits for the field; locally October →
  June asks for June and draws the breeding survey (`bbs-mallard`).

**Rendering across ±180°** (`24465e0`, production-certified 2026-10-06 on
`beec34b`): Google unwraps a view across the line (Alaska at zoom 4 runs
153°..266°) and the renderer read 200° where the evidence said −160°, so 17
species painted nothing in production. `wrapLongitude`/`longitudeNear` fix it;
`fixtures/hunt/species-heat-antimeridian-production.json` records the 17 (and
greater scaup) in production; a corpus test samples 18 species/months with the
view written three ways.

**A returning hunter's layer comes back** (`b4ae4af`, 2026-10-01): restore read
neither explore nor camera.

**A layer that misses the view says where its map is.** The empty-view answer
carries the extent of the species' map for the month; the legend says "mapped
elsewhere" with a visible **Show where** control that moves the camera only.
The sentence no longer calls every surface a survey.

**Validators.** `surface-structure.test.ts` (the zebra-dove desktop case on
real data; live universe → surface; every
surface through eight links; falsified with a corrupted artifact, a sampler
blind west of 100°W, and a sampler that does not read in its grid's frame);
server and sampler strip tests (falsified against the old code); legend,
decoder and map-machine tests for Show where; `certify-species-surface.mjs
--regions` (twelve regions including across and east of 180°, pan, zoom, date
change, shared link and Show where, zone-card filters; phone and desktop).

**Remaining**: the stray limitation above; 67 LIMITED range surfaces; 6
range-only species whose profile names no habitat; edges that follow recording.

### 2026-10-01 — Species images: a provider image fills a placeholder and never outranks the administrator

An image is shown only when its identity is established; otherwise the placeholder
stays, because a wrong species is a factual error and, on identification pages, a
safety failure. Unsplash images are hotlinked and credited as Unsplash requires
(download tracked once at publish); they never appear where a credit cannot be
shown. Adobe Stock images are licensed by the owner and stored through the same
re-encoding pipeline as an upload. The 36-licence ceiling was the owner's; going
past it needs the owner again. Recorded in CLAUDE.md §16.

### 2026-10-01 — Fourteen more species get a map, and a returning hunter's layer comes back

**Documented populations.** Thirteen species whose open records describe a few
small introduced or relict populations failed the record-cluster thresholds and
had no map. They now get a range drawn from those places alone:

- The species' surface profile names each place, quoting North Ground's own
  published range statement (`statedAs`), and the builder checks that the
  quote appears in the published `rangeSummary` and that an open record
  confirms the species in each declared 0.35° cell. A declared cell with no
  record stops the build.
- These ranges are never gap-joined (two colonies 100 km apart are two
  colonies), always LIMITED, and say in words which named places were not
  drawn and why (`notDrawn`).
- Species: Alaska hare (Seward Peninsula), Alaska marmot (western Brooks
  Range), Appalachian cottontail (southern Appalachians, Allegheny WV),
  Argentine black-and-white tegu (Miami-Dade), European hare (southern
  Ontario), green pheasant (Hawaiʻi Island, Maui, Kauaʻi), mouflon (Hawaiʻi
  Island), Nile monitor (Cape Coral), ocellated skink (Mesa, AZ), Persian ibex
  (Florida Mountains, NM), ringed turtle-dove (northeastern Illinois), ringed
  wall gecko (Lee County, Redlands, San Juan Capistrano), sambar (Texas).
- **Ermine** is read only where its records are this species — Alaska west of
  141°W and arctic Canada (`recordsWithin`) — because elsewhere the name holds
  American ermine and long-tailed weasel records filed under the older
  combined name. **Mouflon** also reads the five names its records are filed
  under (`alsoRead`).

**Five species stay without a map, because drawing one would invent a
distribution (CLAUDE.md §61):**

| Species | Why no defensible range |
| --- | --- |
| Himalayan tahr | 0 openly licensed records in Canada and the United States since 2000 |
| Red deer | records of *Cervus elaphus* are dominated by elk filed under the older combined name; the species' own herds are on private ranches |
| Red-legged partridge | no North American population is described; records are of released game-farm birds |
| Rock partridge | "rock partridge" has been used in the U.S. for several *Alectoris* species and hybrids, so the records cannot be trusted as this species |
| Feral ferret | no established feral population is documented, only escaped pets (California Department of Fish and Wildlife) |

Each is Hunt-eligible on its take evidence (preserve, ranch or escape
contexts). Whether such species belong in the HUNTABLE class at all is an
eligibility question for the owner, not a map question.

*Superseded 2026-10-06:* all five were resolved against their authorities and
left the heat universe through the canonical eligibility source (four
LIMITED_TAKE, still in Hunt; the ferret NON_QUARRY), and red deer's profile,
which described elk, was rewritten. See *2026-10-06 — Every heat-eligible
species has a working map*.

**A returning hunter's species layer comes back** (`b4ae4af`). Hunt stored
whether Find game was on and where the map sat, and never read either back: a
hunter who left Ruffed grouse on over Maniwaki returned to the species chosen,
its layer off, at the opening camera. §41A already promised both. Now restored
on a bare `/hunt` (a link still wins); the camera only when no remembered place
or zone frames itself, and the opening-camera poster is then not drawn under it.
This was also why the first every-species production sweep reached nothing: it
restores each species exactly as a returning hunter's Hunt is restored, and no
surface was ever requested.

### Saskatchewan answers (2026-10-01)

**What a hunter can do in Saskatchewan now.** All **83** Wildlife Management Zones
resolve, read live from the ministry's own service. **13 species** answer:
white-tailed deer, mule deer, elk, moose, pronghorn, American bison, black bear,
gray wolf, sharp-tailed grouse, ruffed grouse, spruce grouse, gray partridge and
ring-necked pheasant. **149 rules**, 44 groups, 6 sources, certified period
2026-04-15 to 2027-03-15.

It is the first jurisdiction whose regulatory answers rest on geometry North
Ground deliberately does not hold — the licence grants commercial reuse and the
same ArcGIS item says "Not for resale" — so `layer:ca-sk-wmz` serves rules while
storing no copy.

**The answer asks which licence, and that is the answer.** Saskatchewan writes
every season for a named licence class (41 of them), and the class changes both
the zones and the dates: a Saskatchewan resident, a Canadian resident and a guided
non-resident have different seasons in different zones for the same species. So a
resolved zone returns NEEDS_INPUT with LICENCE_TYPE rather than a status, and only
the classes whose own rules reach that zone are offered. A status produced without
the class would be a guess about which hunter is standing there.

**The method ladder is read, not inferred.** 40 season names map to five envelopes,
each read from the section's own first subsection. The regulation writes a season
as the means permitted during it — "by any means other than a bow and arrow,
crossbow, muzzle-loading firearm or shotgun" PERMITS those four — so the envelopes
nest and a bow hunter is in season inside the muzzle-loading window. A build driven
by section HEADINGS would have closed 1–14 October in zone 29 to every bow hunter
and said nothing about it.

**Findings worth keeping:**

- **A missing "than" hid a whole shotgun season.** s. 35(1) reads "by any means
  other a bow and arrow, crossbow, muzzle-loading firearm or shotgun". My regex
  required "other than", so I got 39 envelopes instead of 40 and asserted in a test
  that mule deer has no shotgun season. Caught only because a per-section tally put
  one row in s. 35 while the envelope tally had none — a cross-check between two
  counts of the same thing, not a review of the regex.
- **The Prince Albert zone is CLOSED to game birds, and I first recorded it
  UNRESOLVED.** The ministry states it three times. That was an unnecessary
  refusal, the §8 direction nobody reports, and it is now the one zone
  `zonesWithNoGameBirdDistrict()` returns, with the reason.
- **ss. 7 and 7.1 DEEM eight protected and national wildlife areas OPEN** inside an
  open zone, which inverts the usual assumption and prompted the owner's
  2026-10-01 §41A ruling. The real exclusions run the other way: Fort à la Corne
  WMU and St. Denis NWRA are carved out, and provincial parks are closed EXCEPT
  those listed — a positive list, not a prohibition.
- **Bull elk and antlerless elk are not complementary.** Bull elk is a male with an
  antler ≥15 cm; a male elk over a year old with antlers under 15 cm is neither
  class, so BY_NEGATION would be a misstatement. `physical-criterion.ts` has no AGE
  measure, which bull moose (male ≥1 year) needs.
- **Saskatchewan is not a blaze-orange jurisdiction.** Four colours or a CAN/CSA
  Z96 Class 2 label satisfy s. 21; white is lawful for the garment and NOT for the
  cap; and the requirement binds whoever accompanies or guides as well as the
  hunter.

**Two of my own defects, both landed as fixes:**

- **`crossesYear` had two definitions and the engine used the wrong one.**
  `season.ts` decides it from month-and-day anchors, so 15 October to 15 March
  crosses; the engine derived its own as `closesIso < opensIso`, which is false for
  every RESOLVED window because a resolved window is anchored to its licence year
  and never wraps. The root was that the field was never declared on
  `ConditionalWindow`: five bundles set it, four never did, mine set it only when
  true. Declared now, with `crossesYearAgreesWithTheBundle` holding the two
  definitions together, naming Québec's different contract and the 36 unflagged
  crossing windows by exact count rather than tolerating them silently.
- **A stale time exception.** Saskatchewan's limitation said legal times are CST
  "except that the Lloydminster area observes Alberta time". True until 2026; not
  true in this period. Lloydminster observed MST (UTC−7) November–March until
  **Alberta adopted Alberta Time (UTC−6) year-round from November 2026**, and
  Saskatchewan now states all of the province is CST year-round with **no time
  option areas**. The exception told a Lloydminster hunter their clock differed
  from the law when it does not — the understating direction, which nobody reports
  because the hunter simply distrusts a correct window. **The coincidence is
  contingent, not structural:** The Time Act, 2026 allows time option areas to be
  established in regulation for border communities, so a legal-time module must
  read the basis as data for the date asked rather than hard-coding single-zone
  permanent CST. The whole finding is on `ca-sk-time-is-cst`.

**A test that asks the engine.** `saskatchewan.test.ts` exists because Nova Scotia
shipped eleven passing tests that all read the bundle and answered CLOSED at every
point in the province. These ask for an answer: a season at a real point, the bow
hunter inside the wider envelope, the wolf season still open on 1 February, every
instrument the answer makes a claim from reachable from it, and all 83 zones
accounted for exactly once per species.

**Not claimed for Saskatchewan.** Ptarmigan, barren-ground caribou, waterfowl, fur
animals and every fee are UNKNOWN — 41 licence classes are named and no fee
instrument was located, so no number is shown. 47 of the 197 extracted rows reach
only provincial parks and recreation sites whose boundaries North Ground does not
hold, and the answer says so rather than implying a zone season covers a park
inside it. Upland bird limits (ss. 52–58) are extracted and not yet encoded as
conditions.


### Every Hunt-eligible species has a map (2026-09-30)

**What the owner asked.** Every Hunt-eligible species gets a map at the
strongest tier its evidence defensibly supports (CLAUDE.md §41B), with a live
denominator, seasonal truth, the four states kept apart end to end, honest
resolution and confidence, and production reachability measured species by
species.

**Where it stands.**

- **Universe:** live, not typed. There are 237 species whose canonical take
  eligibility grants Species Heat (HUNTABLE 209, NUISANCE_OR_INVASIVE_TAKE 28).
  `eligible − covered` is empty in CI.
- **Coverage:** 237 of 237 covered.
  - 218 have a served surface.
  - 19 are declined with NO_DEFENSIBLE_RANGE:
    - 11 have too few open records: fewer than 30, or no counted cell.
      Alaska hare, Alaska marmot, Appalachian cottontail,
      Argentine black-and-white tegu, European hare, Himalayan tahr,
      Nile monitor, ocellated skink, ringed turtle-dove, ringed wall gecko,
      sambar.
    - 2 have records, but none of them counted:
      - persian-ibex has 8 records;
      - mouflon has 0 records under NAMED_ONLY.
    - 1 is released birds, not a population: green pheasant (below).
    - 5 have a documented identity or population problem: ermine,
      red deer, rock partridge, red-legged partridge, feral ferret.
- **Best tier:**
  - T3 systematic survey: 72
  - T5 range + habitat: 141
  - T6 known distribution: 5
- **Range + habitat surfaces:** 217 (212 T5, 5 T6).
  - Confidence: MODERATE 164, LIMITED 53, and never HIGH.
  - 211 of them have useful internal variation.
  - 68 speak for the hunting season.
- **Moose ships as T5,** as the owner required.

**A correction first: the occurrence reads were a sixteenth of what they were
taken for** (see Corrections). GBIF's ad-hoc map aggregates 16 × 16 cells per
tile, and every read was a zoom-3 tile. So each "0.35° square" was a 1.40625°
cell. This was found by looking at the maps: mallard had bars across the
prairies and the alligator was drawn as discs.

- `fetch-gbif-presence.mjs` now reads in two passes:
  - a coarse zoom-3 pass, which finds occupied cells;
  - a fine zoom-5 pass over only the tiles those cells fall in, with every
    square filed under its 0.35° cell.
- At zoom 5, GBIF aggregates at least that finely: 223 of 236 species had more
  than one square in some 0.35° cell.
- The fine pass must place the coarse pass's records within 0.1%, because the
  two are separate queries of a live index. Black bear differed by 2 of
  7,554 records, and the difference is stated on its surface.

**Four range rules, each set after seeing the map it fixes, and recorded as
such in methodology 2.1.0's history.** None is a fitted weight.

1. **Gaps are joined.** A morphological closing, per family, joins gaps no
   wider than the family's `gapKm`.
   - It never removes range.
   - It never reaches past the recorded edge.
   - Both properties are tested.
   - Before it, central Florida was blank for the alligator.
2. **Open water is drawn only near dry land.** A profile's named open water
   counts only within its `openWaterKm`, else its `coastKm`, else 5 km. Mallard
   had been painted across the middle of Lake Winnipeg. Separately,
   "water nearby" is now a 20 km distance-weighted share instead of a 3 × 3
   box, which had drawn hard squares around every small lake for wild boar.
3. **A cell is confirmed by 2 records in it and the eight cells around it.**
   Half of every species' 0.35° record cells hold a single record, most with a
   record next door. Without this rule, moose lost the boreal core and red fox
   was fragmented.
4. **Islands stand on their own records.** For a family with an island rule,
   a population on a separate landmass needs that many records on it.
   - Landmasses are 8-connected dry-land runs of the 0.1° foundation; the
     mainland is one.
   - Kalij pheasant had been drawn on Kauaʻi from 3 records, carried across
     the channel by the cluster rule.
   - Green pheasant falls out: its only real population is Hawaiʻi Island's
     15 records. What had given it a range was scattered single records of
     released birds.

Mallard's reading now ranks marsh above open water, as every other dabbler's
profile already did.

**A range edge that stops where recording stops says so.** Target-group effort
is measured as the open records of every other Hunt-eligible species of the
same animal group, per 1.4° cell.

- Where a range's land edge borders ground holding fewer than 10 such records,
  a quarter of the time or more, the surface says in words that its edge there
  is where recording stops. The report lists it as a geographic gap. There are
  22 such surfaces, for example:

  | Species | Share of land edge on barely recorded ground |
  | --- | --- |
  | moose | 33% |
  | black bear | 31% |
  | caribou | 72% |
  | muskox | 82% |

- North of about 49°N in Ontario and Québec, the reads hold almost no records
  of any hunted mammal.
- Ranges are never extended into that ground: it would paint deer into the
  northern boreal.

**Ecological inspection, by family.** Each was rendered through the one
renderer's own sampler and paint over the land-cover foundation, and looked at.

| Family | Species | What the map shows |
| --- | --- | --- |
| Forest upland bird | Ruffed grouse | Survey plus model beyond it (unchanged) |
| Forest ungulate | Moose | Alaska, BC–Alberta, Ontario–Québec–Maritimes; central boreal thin, and said |
| Forest ungulate | White-tailed deer | Continental, with the forested Rockies cut out |
| Open-country ungulate | Pronghorn | Great Plains and basins, forested ranges cut out |
| Mountain ungulate | Bighorn sheep | Separate mountain ranges |
| Mountain ungulate | Mountain goat | Native Coast and Rocky ranges; introduced Olympic, Black Hills and Colorado herds |
| Large predator | Black bear | Appalachians, Great Lakes, New England, the West |
| Large predator | Gray wolf | Alaska, Rockies, western Great Lakes |
| Small predator / furbearer | Red fox | Continuous in the East, patchy in the West |
| Grassland bird | Sharp-tailed grouse | Survey field plus a northern complement |
| Waterfowl | Mallard (October) | Prairie potholes, Mississippi, Central Valley, Gulf marshes |
| Coastal / marine bird | Common eider (November) | Maine–Maritimes, Hudson Bay, Alaska coasts |
| Coastal / marine bird | Emperor goose | Aleutians, Kodiak, Yukon–Kuskokwim delta |
| Desert | Collared peccary | Arizona, New Mexico, South Texas |
| Invasive mammal | Wild boar | Southeast, Texas, California |
| Reptile | American alligator | Continuous coastal plain from North Carolina to Texas; Everglades and Louisiana marsh strongest |
| Amphibian | American bullfrog | Wetland network |
| Island / exotic | Kalij pheasant | Hawaiʻi Island and Oʻahu |
| Island / exotic | Axis deer | Texas Hill Country |
| Small mammal | Snowshoe hare | Improved, but under-drawn across boreal Canada for the recording reason above |

**Merged with main.** Main's species-readiness report counted a surface only in
the survey registry, so it printed `undefined` for 165 species. It now reads
the canonical spatial strategy.

**Open (superseded 2026-10-01, see above).** 232 species now have a map; the
production browser certification and USGS GAP public-domain ranges (CONUS)
remain.

### 2026-09-30 — Beyond the survey's reach: a grouse model, a moose model that failed, and the remaining owner items

**The land-cover foundation.** `content/intelligence/foundation/landcover-2019-0.1deg.*`
is Copernicus Global Land Service 100 m land cover, 2019 (CC BY 4.0, DOI
10.5281/zenodo.3939050). It stores the share of eighteen cover groups per 0.1°
cell from 24°N to 84°N and 170°W to 50°W. It is a histogram of the source and
not a model, it is hashed, and the manifest names the source file's own hash.
It was built on a runner by `scripts/build-landcover-foundation.py`.
Spot-checked against places we know:

- Maniwaki is mixed and broadleaf forest; Regina is cropland and built-up land.
- Hudson Bay is sea, and the Everglades are herbaceous wetland.
- North of 80° is empty: the source raster ends there. The model builder
  counts land from what the source classified, not as "not sea", so that
  ground is never read as land.

**Ruffed grouse habitat model 1.1.0: published, beyond the survey field only.**

- Fitted as a logistic model of whether a Breeding Bird Survey route detected
  grouse, on land cover within 25 km of each of 4,120 routes.
- Held out by 5° blocks, **detection AUC 0.857** against a bar of 0.80
  declared before fitting.
- Version 1.0.0 also claimed a count. Its held-out Spearman was 0.072 against
  0.25, so the count claim is withdrawn and never drawn. The failure is kept
  in every artifact's `model.history`.
- The painting rule was changed once before publication, and that is
  recorded too. Keyed to "300 km of any route", it coloured Nunavut tundra and
  northern Mexico. It is now "300 km of a route that found grouse", the
  survey's own range evidence.

Where it draws:

- 4,487 cells of the survey's own grid, never on a cell the field speaks for
  (a test asserts zero overlap, surveyed zeros included).
- Only inside the land-cover range it was fitted on, and only above the
  held-out Youden threshold (0.165).
- Colour is the likelihood ranked among routes that found grouse. A model
  cell is never 0, because 0 means "surveyed, none found".
- It is drawn at 65% opacity, and the legend says in words that it is fainter
  because it is a model.
- The per-route input (CC0) is committed beside it, so the layer re-runs from
  the repository alone.

**Moose winter habitat model 1.0.0: tested, below its bar, not published.**
Fitted to Alberta's aerial-survey unit densities (76 units):

| Test | Result | Bar |
| --- | --- | --- |
| Leave one unit out | 0.509 | 0.5 |
| 2° blocked | **0.451** | 0.5 |
| British Columbia, harvest per km² (179 units) | **−0.39** | 0.3 |

Alberta's densest moose units are parkland and farm fringe, so the fit learns
that farmland is moose ground, and that does not travel. The report is
committed at `content/intelligence/models/moose-validation.json` and nothing
is drawn. Re-specifying the model and re-testing it on the same 76 units
until it passes would be fitting to the test. A moose surface needs new
evidence (a second province's densities, or a moose-specific forest-age or
browse layer), not another try on these units.

**The two conditions that named their zones only in prose now carry them.**

- Alberta's Sunday big-game closure carries its 30 units.
- Manitoba's landowner-permission rule carries GHA 33 and 38. GHA 38 is named
  whole because the municipal line inside it is not geography North Ground
  holds; the condition's own text says which part.
- Both bundles were rebuilt by `.github/workflows/build-regulations.yml` from
  the authorities' sources, never edited by hand.
- **Correction to that commit's message:** the Manitoba rules carrying the
  condition already covered only those areas, so its `!` was not marking
  other ground. Manitoba deer zones wear `!` on open dates (41 of 41 on
  2026-10-01) because their seasons are weapon-specific, which gates the hunt
  under the owner's rule.

**Manitoba's changed 2026 guide, reviewed page by page.** The province replaced
the file (sha256 74a155… → 402f94…). The transcribed version was recovered
from the Internet Archive by hash and compared with the new file using the
pinned pypdf:

- Two pages changed. Every transcribed page (5, 7, 29, 30, 31, 56) is
  textually identical, so the transcription stands.
- p. 14 warns hunters that sunrise and sunset information "may not reflect"
  Manitoba's move to permanent daylight time. **Corrected:** this entry first
  said Hunt already applied it. It did not — Hunt's Manitoba clock was an hour
  early (Winnipeg deer, 20 November: 07:21–17:07 against a legal 08:21–18:07)
  until main's `observed-clock.ts` (`eb49c7a`), which carries the offset the
  authority states where the platform's time-zone data lags the law.
- p. 16 moves a form link, which is not carried.

The review is recorded in the cross-check file's `reviews` block.

### 2026-09-30 — Production verified, and Alberta's measured densities reach the unit card

**Production verification of `8b61035`** (Vercel `dpl_4o6an8XMYQ8ygfQhMjxa5EuK9YUF`),
run from a GitHub runner against www.northgroundbushcraft.com at 390×844 and
1280×800:

- The species surface certification passed 208/208. All **54 survey surfaces
  are PRODUCTION_VERIFIED**, recorded by artifact hash in
  `content/intelligence/surface-verification.json`. Each one was requested,
  answered 200 and drawn from its shareable link, and each showed detected
  ground on the ramp in at least one view.
- Maniwaki resolves to Zone 10 West. The grouse surface around it is mostly
  green, yellow and orange: about 1.0M, 0.67M and 0.41M pixels on desktop,
  against 65k blue.
- The `!` walk ran on the case the engine named for that day: Québec 10O
  moose. The marker, popover and card carried the same three condition ids.
- The Hunt app certification passed 420/423. The three failures are the known
  pre-existing ones: two stale legal-hours assertions and Québec French in
  `regulation.summary`.
- The first pass had failed the `!` walk. WMU 49 moose is closed on 30
  September, so its card rightly had nothing to say. A fixed case goes silent
  between seasons, so the walk now asks the engine for today's case.

**Alberta: animals per km², by unit, from the province's own survey reports**
(OGL–Alberta, all 162 catalogue entries).

- `scripts/fetch-alberta-ungulate-surveys.mjs` runs on a runner. It lists the
  reports through the catalogue's API, records each licence, and extracts
  text with the pinned pypdf.
- `scripts/build-alberta-ungulate-density.mjs` reads **187 unit figures**:
  mule deer 52, white-tailed deer 57, moose 78. Each unit takes its own most
  recent survey (2015–2025).
- A figure is taken only from a report's Results section, only in recognised
  wording, and only for a species named by the sentence, its section heading,
  its paragraph or its title. That attribution is kept on the record, with
  the sentence itself.
- Wording the builder does not recognise is listed, never guessed.
- Readings are checked against each report's own table where it has a row
  for the same survey: 91 agree and one disagrees. WMU 336 moose gives 0.71
  in its text and 0.56 in its table. Both are shown and neither is ranked.
- An interval that excludes its own estimate is refused and the card says so
  (WMU 216: "0.5 – 0.11" around 0.80).
- A figure for part of a unit says so (WMU 440, only the non-alpine part was
  flown).
- Multi-unit reports are not apportioned.
- 20 reports were not read, each with its reason, in
  `docs/research/alberta-ungulate-density-read.md`. Three of those are the
  authority's own "insufficient to estimate".

Where the figures go and what they are:

- Shown in the unit card as "Aerial survey for WMU 204, 2019", dated by that
  unit's own survey, never the bundle's latest year.
- Cited to the specific report, carrying the winter-survey warning.
- Evidence grade A (a measured density), but still one figure per unit. The
  spatial strategy stays **D** and nothing is painted (§41B).
- The evidence ladder records it as T2, the authority's estimate.

**Re-verified on `f6c17e1`** (Vercel `dpl_9kY8XKCgZDuS8bVJ2BqFcqNAkETg`, the
Alberta release): species surface certification 210/210 on phone and desktop.
It adds a check that WMU 204's card shows "0.74 mule deer per km² (90% CI
0.58–0.90)", dated 2019 and linked to that report. The unit's rule status
stays "Not covered here" beside it. Hunt app 420/423, the same three known
failures. CI on main is green.

**Rebuilding Alberta.** A re-read needs the runner's fetch; the extracted text
lives on the working branch only (`.research/`), never on main. The committed
bundles are checked for internal consistency by
`src/lib/hunt/intelligence/alberta-density.test.ts`, including figures
checked by hand against the reports.

### 2026-09-30 — `!` means a material condition; surfaces are ranked; every species states where it is

Owner report from the live map: every zone wore a `!` that explained nothing,
only ruffed grouse had heat, and the grouse heat was mostly blue with Maniwaki
(Québec Zone 10) barely coloured. Three fixes, each driven by a structured
rule rather than tuning.

**`!` semantics (§41A amended 2026-09-30).** A `!` appears only where a
condition is MATERIAL to the opportunity. The rule is a predicate over
canonical data, never over display strings:

- Every regulatory condition carries a declared `kind` (17 kinds) and `scope`
  (`JURISDICTION` or `ZONE`) from `content/regulatory/condition-kinds.json`
  (63 ids). A test fails if an emitted condition is unclassified or an entry
  is stale.
- GATING kinds are always material: `TAG_OR_DRAW`, `METHOD_SEASON`,
  `ELIGIBLE_HUNTERS`. NEVER-marked kinds: `HARVEST_LIMIT`, `REPORTING`,
  `INFORMATION`. Every other kind is material only at `ZONE` scope. A
  condition without a declared kind stays material, because an ignored `!`
  costs less than a restriction nobody sees.
- A question the answer asks (weapon, residency, age) is material only when
  the walk is gated, meaning some answer is not open or the walk was
  truncated. A question every answer opens is not a condition.
- Jurisdiction-wide requirements (licences, general orange rules) move to
  "Also required" in the zone card. They are said once and never marked.

The marker, popover and card use the same condition ids
(`data-condition-id`). The card leads with "Conditions apply", each row with
its source link. **Measured on 2,993 open zone-species pairs: 2,682 (89.6%)
wore a `!` before, 396 (13.2%) after; the set of green zones is unchanged.**
The remaining markers are specific: Alberta bow-only seasons and Sunday
closures, Ontario moose draw tags, Québec antlerless-moose draws and
weapon-restricted zones, Manitoba orange in 11 GHAs, Idaho controlled hunts.
The marker now sits in Google's `overlayMouseTarget` pane with
`preventMapHitsAndGesturesFrom`. Before this it sat in `markerLayer`, which
receives no events, so a tap never reached it.

**Ruffed grouse was diagnosed, not tuned.** The Breeding Bird Survey detects
grouse on 649 of 4,121 routes, and 773 of the 1,348 non-zero route-years
logged one bird. The field itself is sound: holding out each route, AUC is
0.909 and Spearman is 0.558. The defect was the colour mapping: a ratio to
the 95th percentile put most detected ground in the ramp's blue.

Methodology 2.0.0 (`RANK_AMONG_DETECTED`) colours each cell by its rank
among ground where the survey found the species. Red is the top tenth, blue
the bottom. Ground surveyed where it was not found (zero) gets its own
warm-grey neutral (`SURVEYED_NONE`) and never the ramp's blue. The legend
says both in words, and the ramp stops sit at the owner's tenths. Maniwaki
cells move from about 0.43 (cyan) to 0.59–0.78 (green to yellow): the local
value, about 0.41 birds per route, sits above the detected median of 0.19.
Zone 10 was not touched. Seasonal movement is declared per species, and a
June survey drawn for an autumn-moving species carries the warning. The
ruffed grouse habitat model stays IN_RESEARCH: it needs a continental
forest-age layer and weights fitted against held-out routes, and neither
exists yet.

**Every species has a stated spatial strategy.** Strategies run from A
(measured density) to E (nothing defensible). The strategy shown is DERIVED
from what is held: the surface registry and the servable evidence bundles.
Declared plans live in `content/intelligence/spatial-strategy.json` and
never count as coverage. `docs/species-spatial-coverage.md` is generated,
and `npm test` fails when it is stale.

Now: **133 species, B 54, D 9, E 70.** All 54 surfaces are on 2.0.0 and
seen drawn in a local browser at 390×844 and 1280×800 (186/186 checks);
`PRODUCTION_VERIFIED` waits for the runner's production pass. For the nine D
species (moose, deer, bear, elk and others), the unit's harvest figures show
in the zone card ("Harvest records for WMU 49, 2024 … a record of hunting,
not a count of animals"). They are never painted. A species with no surface
returns `404 NO_SURFACE` with its strategy statement. Protected and
unverified species say why no map of them is drawn.

**How this is built and verified now.** This container cannot reach
ScienceBase or production, so two runner workflows carry the work.
`.github/workflows/build-surfaces.yml` rebuilds every surface from the pinned
release on a branch push, proves the build reproduces, regenerates the
matrix, and commits back. `.github/workflows/certify-browser.yml` runs the
real-browser certification against a deployed base when
`.certification/request.json` is committed on a branch. It records
verification by artifact hash, so a rebuilt surface is unverified until it
is seen again. Screenshots it commits belong on the branch, never on main.

### 2026-09-30 — Conservation status, take eligibility and legality are three questions (owner ruling)

Supersedes the same-day PROTECTED/REMOVAL/UNVERIFIED allowlist (the moderator's
three-name denylist `27050f4` stays deleted). Trumpeter swan broke the binary:
it is protected in Wyoming, Washington, Alaska and Utah, and Nevada's drawn swan
permit counts it against a federal quota of ten (50 CFR 20.107 note 4; NDOW
2026-27 guide). CLAUDE.md §16 now records the three questions.

- **Take eligibility** (`src/lib/content/species-eligibility.ts`), required on
  every profile: HUNTABLE 209, LIMITED_TAKE 231, NUISANCE_OR_INVASIVE_TAKE 28,
  NON_QUARRY 4 (whooping crane, Gunnison sage-grouse, Steller's and spectacled
  eiders), UNKNOWN 13. Capabilities come from the class alone: Hunt offers
  HUNTABLE, LIMITED_TAKE and NUISANCE; Species Heat only HUNTABLE and NUISANCE
  (a quota in three Nevada counties must never paint a continental "where to
  look" map). Enforced at the heat builder, served registry, surface/heat/
  opportunity evidence, Hunt selector and URL validation, and titles.
- **Conservation status** (`conservationStatus` on the profile, via
  `scripts/apply-conservation-status.mjs`): hand-sourced statements in
  `research/hunting/conservation-status.csv` plus every ESA Endangered/
  Threatened listing from a committed ECOS snapshot
  (`research/hunting/esa-listings.json`, 1,545 North American entities), each
  naming its exact entity — "Key deer (O. v. clavium)", never "white-tailed
  deer". 37 species carry statements.
- **Trumpeter swan** is LIMITED_TAKE: its only published listing is Nevada, with
  the quota condition. Idaho's controlled "1 swan" hunt was checked against the
  guide and 50 CFR 20.107 and recorded NOT_ESTABLISHED — a generic group season
  does not legalize every member. Nevada's rule is NOT an engine rule: Nevada is
  DISCOVERY_ONLY (no geography, no rule model; its swan areas are three
  counties), so the swan correctly has no green outline anywhere. Certifying it
  is the U.S. regulatory lane's work.
- **Inclusion rule**: a named season, game class, licence, bag limit, draw or
  removal program admits a species; "unprotected" alone does not (five western
  species that were only ever unprotected are now UNKNOWN, keeping their pages).
- **Validator** (`species-take-evidence.test.ts`): no silent contradiction — a
  NON_QUARRY/UNKNOWN species with take evidence needs a recorded finding in
  `take-eligibility-conflicts.csv`; LIMITED_TAKE needs a species-specific
  listing; unprotected-only never admits a species; findings cannot go stale.

### 2026-09-30 — A hunter was told nothing, and 390 of 433 zones wore the same warning

**The zone-keyed heat path is gone**, and with it the `MAX_HEAT_ZONES` /
`MAX_BODY_BYTES` mismatch recorded in the heat performance table: nothing calls
`/api/hunt/opportunity/heat` any more and `surface-independence.test.ts` asserts
it stays that way. The endpoint is still mounted with no caller, which is a
decision outstanding rather than a live defect.

**What its removal left.** Coverage reports **9,108 zone-level evidence records
across 49 datasets** — 1,093 moose, 1,264 American black bear, 962 white-tailed
deer, 935 mule deer, 845 gray wolf, 670 elk, 465 lynx — and none of the nine
big-game species has a surface. Not drawing them is correct (§41B: a coarse
figure may never shape fine cells) and the legend carried an honest sentence
saying so. **The sentence was unreachable.** A species with no surface returns
200 with an empty list, classified `NONE_IN_VIEW` — "a surface exists, but not
here" — with `message` null and `emptyMeans` empty, so the legend printed an
EMPTY PARAGRAPH under "Where to look for the animal" and that branch ran before
the one that knew about zone-level evidence. Fixed: the branch defers when it
has nothing to say. Verified live — moose and ruffed grouse both render zero
empty nodes.

**Fixed from both ends, independently.** The serving lane now returns
`404 NO_SURFACE` with a real `message` for a species holding only zone-level
evidence — verified on production, `species:moose` — so the client classifies it
`NOT_HELD` and prints that sentence. The renderer guard remains for the case the
server fix does not cover: a species that HAS a surface but none in this
viewport, returning `NONE_IN_VIEW` with nothing to say.

**The `!` marker is decided by DECLARED scope, and counts nothing.** Measured on
one viewport (ruffed grouse, 2026-09-30): 390 of 433 open zones wore a marker.
Per jurisdiction — Alberta game-bird licence 177/177 and WMU 936 permit 6/177;
Ontario small-game licence 150/150; Manitoba no-single-projectile 59/59 and
hunter orange 11/59; Québec 3/47 and 1/47 with nothing universal. Three general,
three contextual; the distinction takes the marker from 390 zones to 21.

Scope is declared by the regulatory record because a counted denominator fails
in the dangerous direction: Manitoba's orange rule is on 19% of zones, so zooming
onto the eleven that have it reads 100%, reclassifies it as general, and the
specific warning disappears exactly where the hunter is looking. An undeclared
condition keeps its marker — an ignored `!` is a cheaper failure than a
restriction never seen — so `condition-scope.ts` changes nothing today and
activates when a record declares a scope. **Next action for the regulatory lane:
declare JURISDICTION vs ZONE on conditions.** The said-once destination exists
and is wired, so the rule moves a requirement rather than suppressing it.

**One viewport band.** `visibleBand` in `viewport.ts` is the survivor; the
duplicate that sat uncommitted in `sheet.ts` is discarded. Its two clamps were
real and are ported: a negative `offsetTop` during iOS rubber-band overscroll
became a negative inset that lifted the shell off screen, and a visual viewport
taller than the space below the offset let the band claim ground below the page.
Neither reproduced on a device; both are correct by construction, since an inset
can never validly be negative or overrun the page.

Gate: `npm test` 1,701 assertions / 0 failing / exit 0; lint exit 0 (10
pre-existing warnings, all in regulatory legal-time files); build, `validate:seo`
and `check:intelligence-sources` exit 0.


### Species Heat: the surface reaches the hunter (2026-09-30)

**The defect.** On 2026-09-29 the species-surface backend was complete — 25
certified BBS rasters in `surface-registry.json`, hash-checked and answering 200
— and no Hunt client ever requested one. Checked in production from a real
browser before this work: choosing Ruffed grouse on `23ed04d` called
`/api/hunt/opportunity/heat` (the zone choropleth) and never
`/api/hunt/species-surface`. Every backend test was green, because none of them
could see a client.

**Status ladder**, which is the vocabulary for this milestone. Only the last rung
means complete.

| Rung | Meaning | Ruffed grouse | All 25 BBS species |
| --- | --- | --- | --- |
| BUILT | builder and contract exist | yes | yes |
| GENERATED | artifact written | yes | yes |
| CERTIFIED | in `surface-registry.json` with its sha256 | yes | 25 |
| SERVED | the endpoint returns it | yes | 25 |
| RENDERED | a Hunt client requests it and paints it | yes | 25 |
| PRODUCTION VERIFIED | seen drawn in the real production Hunt | **yes** (30/30 browser checks, and inspected by eye) | **25/25** requested 200 and painted from their shareable links |

**What shipped** (`6b2e761…1059d02`, deployed as `dpl_AUoMqG7AacPZUWJ3CjRHXwpkuu2p`):

- The `heat-legible` branch (four commits, pushed from the owner's machine) was
  cherry-picked onto `23ed04d` without conflicts: the vivid ramp, the canvas in
  Google's `mapPane` under the zones, cased green legality outlines, the
  surface-describing legend, and the renderer for both surface kinds.
- The gaps between it and a hunter, closed here: a same-species reply after a
  pan is redrawn; the request covers the renderer's 30% margin and is not re-sent
  for ground already held; a request in flight that covers the view is not
  aborted; `NOT_HELD`, `NONE_IN_VIEW` and `UNAVAILABLE` are separate states with
  the server's own sentence; surface-only species are reachable in Find game
  (`hasSpeciesSurface`, from the registry); the key never says "0 zones open"
  where seasons were never evaluated.
- An adversarial review found, and this fixes: zooming in never re-rendered the
  raster (the zoom test compared the container with itself, so plots blurred as
  the bitmap was CSS-stretched); surveyed-zero cells painted transparent, i.e.
  identical to unsurveyed ground; antimeridian views produced an inverted bbox; a
  certified surface that failed to load was reported as "not covered" and
  cached for six hours (now 503, no-store); the fallback map re-rasterised on
  every pointer move.
- Seen on the real map and fixed: the edge of survey support stepped cell by
  cell. Opacity now fades over the outer half of an edge cell, only inside ground
  already drawn, never changing the value and never at a reply window's edge.
- The server no longer says "No certified evidence is held for this species"
  for ruffed grouse over ground its surface does not reach (200, empty, with the
  reason).

**Decisions taken, and why.**

- **No zone is filled with evidence, ever** (owner direction in this task:
  "not a hunting-zone choropleth", "no administrative polygon colouring", "do not
  fetch heat through zonesInView"). `useSpeciesHeat` is deleted; a species whose
  only evidence is zone-level shows no heat and the key says so. CLAUDE.md §41B's
  resolution bullet is amended to match.
- **Closing a zone card over the species layer keeps the layer** (owner
  acceptance: "Tap a zone … Close it. Confirm species + surface + date
  persist"). Outside the layer, X still forgets the species (owner, 2026-09-23).
- **Performance: viewport loading, no tiling.** Measured: a phone's national
  view is one ~204 KB reply (~11 KB gzip), the continental desktop view ~466 KB
  (~26 KB gzip), 12–21 ms on the server; one field re-render 86–95 ms on a phone
  and 190–225 ms on desktop under 4× CPU throttling. Panning inside the held box
  asks nothing (the regional walk made one request in total). Tiling is not
  justified by these numbers; the cells `Map` is the first thing to replace if
  a denser surface arrives.

**How it is held.** `src/lib/hunt/exploration/surface-independence.test.ts`
walks certified artifact → registry → handler → the URL the client builds →
decoder → a painted pixel, asserts HuntApp wires the hook to the map, and holds
the separations (no zone/season/date import on the surface path; a hotspot
crossing a boundary unchanged; legality and heat independent; closed/open/unknown
zones with any heat; stale replies discarded; SAMPLE_PLOT discrete; null ≠ 0;
declared resolution carried). `scripts/certify-species-surface.mjs` does the
same in a real browser and runs in CI on every push to `main`; against `23ed04d`
it fails with "ruffed grouse: surface requested — no request was made".

**Verification channel, recorded because it will be needed again.** This cloud
container's egress policy denies `www.northgroundbushcraft.com` and
`*.vercel.app`. Production and previews were exercised from a Vercel Sandbox in
the project (Playwright, Chromium), with previews opened through a Vercel share
link; screenshots were streamed back through the sandbox's command logs and
checksum-verified before being inspected.

### The Eastern Waterfowl Survey lands, and the gap for big game becomes a record (2026-09-29)

**What was ingested.** The Canadian Wildlife Service Eastern Waterfowl Survey
(EWS25) — 332 published plots of 25 km² in Québec, Ontario and the Maritimes,
under the Open Government Licence – Canada. It is the ONLY public Canadian
dataset found that says where animals are at a resolution finer than a hunting
zone. 36 species × jurisdiction bundles, 2,474 plot records, eight species Hunt
serves plus blue-winged teal in Ontario. Coverage goes 13 → 49 datasets, and the
grade split is now `{ B: 36, C: 13 }`: the survey counted animals, the harvest
datasets counted hunting.

**Three refusals are in the contract, not in comments**, because each is a claim
the data cannot support while the picture would support it beautifully:

- **Nothing between the plots.** A new geometry type `SAMPLE_PLOT` and a render
  kind of the same name: even shade on each surveyed plot, and nothing off-plot.
  `drawsOnlyWhereSurveyed` exists so a legend can say that unshaded ground was
  not looked at rather than found empty. 332 plots is 8,300 km² of five
  provinces; a continuous surface over it would be a North Ground model wearing
  ECCC's provenance.
- **May is not October.** Every bundle carries a `seasonalBasis`, and
  `bundles.ts` REFUSES TO LOAD a bundle whose seasons differ and which carries no
  warning to show. It travels on the opportunity, the provenance and the
  methodology — every surface that carries the heat — because a spring breeding
  count read as an autumn hunting map is the mistake most likely to be made.
- **Detections are not a density.** The counts are double-observer detections,
  uncorrected, so the metric is `SURVEY_OBSERVATION` and the builder refuses to
  emit `POPULATION_DENSITY` or `POPULATION_ESTIMATE`.

**Four rejections are counted and asserted rather than filtered quietly**, so the
day a publisher convention changes the number moves and the build stops: 502 rows
with the authority's `9999` unknown sentinel in the coordinate (its data
dictionary: "In all data files, '9999' indicates unknown"), **10,199 rows
recorded OUTSIDE the plot** — birds seen in transit up to 7 km away, which would
have inflated every plot by about an eighth — 878 rows on plot-years that were
not completely flown, and 0 unreadable counts.

**`distOut` was verified by derivation, not by its field name:** 4,000 rows with
`distOut` of 0 all fall inside their plot's published polygon and 4,000 rows with
a positive `distOut` all fall outside it.

**The drawable threshold is declared methodology, not a constant.** A species is
drawable in a jurisdiction only where the survey recorded it on at least half
that jurisdiction's plots, because below half a plot without the species is more
likely non-detection than absence — so a ramp built on the minority ranks our
sampling rather than the birds. It refuses 14 pairs, including Barrow's goldeneye
in Québec (37 of 166 plots) and mallard in Newfoundland (14 of 52, while all 44
of Ontario's carry it).

**The gap for big game is now machine-readable.** `subZoneEvidence` in the source
registry records, per species group and jurisdiction, whether anything finer than
a zone exists and why not: Ontario NONE_PUBLISHED (its 23,550-plot grid carries
no counts, and its modern Landscape scale is coarser than a WMU), Québec
NOT_MACHINE_READABLE (PDF only; its zone 1 estimate excludes the réserves
fauniques and the parks, so it does not cover its own zone; and the sub-zone map
it does publish is a HARVEST density map), Alberta ZONE_RESOLUTION_ONLY, British
Columbia LICENCE_BLOCKED, Manitoba NONE_PUBLISHED. A jurisdiction nobody has
searched returns null, so a search that never ran can never be reported as a
finding that nothing exists.

Research behind it: `docs/research/species-density-evidence.md`.

### The composer keeps its place; the keyboard only takes viewport away (2026-09-29)

Reported by the owner from an iPhone, reproduced: tapping **Search anywhere**
sent the search field DOWN to sit on the keyboard's edge, with the rows it
offers rearranging above it. That was deliberate once — a messaging-composer
model — and the owner has decided against it. §41A is amended: the field stays
at the top of the sheet, what it offers scrolls below it, and the keyboard only
takes viewport away.

**The cause was two CSS `order` declarations**, not a viewport bug:
`.searchField { order: 1 }` with `.composerScroll { order: 0 }` under
`[data-composer="open"]` drew the field LAST. Both are gone, the state class is
`composerOpen`, and document order is now visual order. No offset, no unit and
no detector was added — the one viewport model in `HuntApp` was already right.

**Certifying that fix exposed a second, real defect in the same lane.** The
sheet's height was computed from a header rect read in VIEWPORT coordinates
against a band height measured in the SHELL's, so a keyboard that scrolls the
visual viewport was charged to the sheet twice — and because React applies the
inset after the effect runs, the error OUTLIVED the keyboard: dismissing it left
the sheet short until something else moved. Measured at 375x667, `full` went
605 → 269 → **557**, where 605 was correct. `headerBottomInBand` in
`exploration/viewport.ts` now takes the inset off both sides, and the property —
the header's place in the shell does not depend on where the band sits — is
asserted for band tops of 0, 8, 48 and 120.

**The control bar above the keyboard is Safari's own AutoFill/QuickType bar**,
which a page cannot remove. What was checkable was checked and is clean: no
`<form>` wrapper, no fixed or sticky bottom bar in any Hunt stylesheet, no
accessory or keyboard-dismiss component anywhere in the source, and the field
declares `type="search"`, `inputMode="search"`, `enterKeyHint="search"` and
`autoComplete="off"` with no credential, address or payment token.

### 2026-09-29 — Heat is evidence about animals, and it says how much

**The defect.** `classifyOpportunity` averaged every normalized value a zone
carried. British Columbia's bundles carry five per unit — reported harvest,
harvest per hunter, harvest per hunter day, hunter count and hunter days — so
**40% of every BC zone's shade was a measure of hunting pressure**, in the
colour a hunter reads as abundance. A unit beside a highway with many hunters
and little game outranked a remote unit with few hunters and good game. Nothing
in the suite could see it, because nothing asserted what the number was made of.

**The fix.** `methodology.ts` declares a ROLE per metric —
`ABUNDANCE_SIGNAL`, `EFFORT_CONTEXT`, `EXTENT_ONLY`, `PLACE_CONTEXT` — and only
the first may carry a weight. Effort is still ingested, still shown, and marked
`contributesToIntensity: false` in every component; a measurement silently
dropped looks exactly like one that was never published. The declared weights
are renormalized over what a zone actually holds, sum to one, and travel in the
result.

**Measured, having predicted first.** Predicted 320–440 of 1,297 zone-species
pairs would change band; **measured 540 (41.6%)**. The under-prediction was
mine: I assumed effort ranks correlate strongly with harvest ranks, which they
do, but ignored that removing two of five series also widens the distribution,
so more zones cross thresholds in both directions. The movement breakdown:
MODERATE→LOW 165, MODERATE→HIGH 92, HIGH→VERY_HIGH 81, HIGH→MODERATE 74,
MODERATE→VERY_HIGH 45, VERY_HIGH→HIGH 42, LOW→MODERATE 26, HIGH→LOW 12,
LOW→HIGH 3. The largest single movement being *downward out of MODERATE* is
the signature of the correction: those are the crowded, low-yield units.

**Three things the one number was answering, now separated.**

- **Intensity** is continuous, 0 to 1, and null where the evidence refuses to
  rank. Null and zero are different answers: zero is the bottom of a ranking
  that happened, null is a refusal to rank, and drawing null at the cold end
  would assert the first while meaning the second.
- **Strength** is how well-evidenced the shade is. It counts INDEPENDENT FACTS
  ABOUT THE ANIMALS, so a rate whose numerator is already present adds nothing —
  BC's five metrics reduce to **one** animal fact, the reported harvest, and
  every served dataset is therefore `WEAK` today. That is the true answer, and
  it is asserted in the suite so that the day it changes is a deliberate act.
- **Render kind** is how finely the evidence may be drawn. Every served dataset
  is `ZONE_AREA`, and `permitsSubAreaVariation` is false for it, so no blurred
  hotspot can ever appear inside a unit the authority reported one number for.
  A mixed set is drawn at the COARSEST kind present.

**`evidenceCoverage` counts independent values, not distinct metrics.** BC's
five metric names are three published numbers and two rates derived from them;
counting names graded that `ROBUST_DATA` — the strongest coverage word the
product has — for restating three facts five ways. That grade was also
structurally incapable of noticing the rank-copy defect found earlier, which is
why it is fixed here rather than left as a note.

**The ramp.** Six stops from a cold indigo-slate through the palette's bark and
ochre into campfire amber and ember, interpolated continuously. Four flat amber
tints could not make a heat map; they made four categories, which is what they
were and what the evidence is not. **No green anywhere along it**, asserted at
every hundredth of the line rather than at the stops — green means a legal hunt
exists, and a teal cool end would make "cold" read as "closed".

**`MAX_STATE_FILL` is derived from the ramp**, not a constant that happened to
equal its maximum. The moment the ramp changed, the two parted company and a
hot neighbour out-filled the chosen zone at regional zoom on the light setting.
§41A says the chosen zone is always the loudest thing on the map; exactly one
assertion noticed.

**"How is this calculated?"** is served by `/api/hunt/opportunity/methodology`
from the same read model the map is painted from, so the panel cannot describe a
calculation the map did not perform. It names every authority, dataset, year,
area count, resolution, measurement with its applied weight, licence and the
authority's own limitations. Fetched only when opened; the heat reply the map
sends on every pan stays small.

### 2026-09-29 — Three more Ontario datasets, and two deliberately refused

Served from data.ontario.ca under the same Open Government Licence – Ontario the
deer dataset already used, with the resource URLs, resolutions and pitfalls the
source registry had already recorded: **moose** (66 units), **black bear** (78),
**wild turkey** (28). Coverage moves from 10 datasets / 1,297 zone-species pairs
/ 6,182 records / 9 species to **13 / 1,469 / 6,642 / 10**.

`scripts/ontario-harvest.mjs` holds the rules once rather than per species. Each
exists because getting it wrong is invisible: a suppressed cell read as zero
publishes "nothing was taken here" over data the authority withheld; a
zero-padded code mints units no layer has, so the map goes blank exactly where
harvest was reported; a parent-area figure apportioned across sub-units draws a
division the authority never made. Ontario uses BOTH ellipsis characters for
suppression, sometimes in adjacent rows of the same file.

**Wild turkey publishes no hunter count, so it gets no rate** — one independent
value, `LIMITED_DATA`, `WEAK`. That is the derivation module doing its job: the
honest name for what remains is a total.

**Two Ontario datasets are deliberately not served, and neither is a licence
problem.**

- **Wolf and coyote** — one combined "Harvest" column covering both species.
  Attributing it to either overstates that one; splitting it publishes two
  numbers the authority never released. Recorded as
  `REJECTED_FOR_SPECIES_ATTRIBUTION`.
- **Elk** — reported by Elk Harvest Area, a geography North Ground does not
  hold. Unchanged from its earlier finding.

`validateEvidenceMatrix` no longer reads every `UNAVAILABLE` as "the authority
publishes nothing". Wolf-and-coyote is unavailable for species attribution and
its Wildlife Management Unit geography is the same good geography every other
Ontario harvest dataset uses; the old rule would have forced it to disclaim a
precision it genuinely has — a false statement about a source, made in order to
satisfy a rule about sources.

### Green is an opportunity, not a season open to everybody (2026-09-29)

§41A was amended by the owner after the binary rule shipped and its consequence
was visible in production. The rule was followed correctly; it was the rule that
was wrong.

**What green means now.** At least one current legal hunting opportunity exists
for the selected species, zone and date. Open without material conditions is
green; open with material conditions is green plus one `!`; closed, a season in
the future, and unknown or uncertified coverage are ungreen — and ungreen is
still never called closed.

**How it is established.** `src/lib/hunt/exploration/opportunity.ts` walks the
CANONICAL ENGINE'S OWN answer tree. A pending question is not an open season:
`NEEDS_INPUT` means the engine has not looked at a season window yet, so painting
it green would assert a season nobody published. Instead the walk answers the
engine's question each way the engine offers and asks again until it resolves; a
zone is green when one of those leaves is an open season on the date. Every leaf
is the engine's own output. There is no second legality implementation, and the
walk cannot reach a status the engine would not.

**Bounds and honesty.** The walk is capped at 64 engine runs per zone, species
and date. A walk that hits the ceiling reports `UNRESOLVED`, never `CLOSED` —
stopping a search is not a finding. `UNSURE` is never walked as an answer.

**What counts as conditional is structured.** The dimensions the engine asked
about, and the `RegulatoryCondition` rows a resolved answer carries. No prose is
matched anywhere; a renderer testing for "Depends on your hunt" would be
deciding legality from a label.

**Opening values are named only when ONE fact gates the answer.** They are a
union over open paths, so with two gates they do not combine: Manitoba deer opens
for a muzzle-loader and for a hunter under eighteen, and printing those beside
each other reads as a recipe for a hunt nobody published. One gate names its
answers; two name the fact and send the hunter to the card.

**Measured effect** (certified bundles, 2026-09-29, whole jurisdictions):

| Species | Layer | zones | green before | green now | with `!` |
|---|---|---|---|---|---|
| Moose | Ontario WMU | 150 | 0 | 49 | 49 |
| White-tailed deer | Ontario WMU | 150 | 0 | 36 | 36 |
| White-tailed deer | Manitoba GHA | 62 | 0 | 41 | 41 |
| Ruffed grouse | Ontario WMU | 150 | 150 | 150 | 150 |

Predicted 40–70 for moose before measuring; measured 49.

**The indicator.** One `!` per zone, riding WITH the zone's label — §41A already
solved "one mark per zone, in its largest part, omitted rather than stacked", and
a second placer would disagree with the first the moment a label was dropped for
a collision. A zone too small to be named carries no indicator; it stays in the
zone list and its own card. It is a real `<button>` on both renderers, in a pane
that is neither `aria-hidden` nor pointer-events-none, and its accessible name
says what it means rather than naming the glyph.

**Open question for the owner.** Ontario ruffed grouse is 150 of 150 green WITH
`!`, because the bundle enumerates a licence condition that applies everywhere.
That is truthful — the licence is genuinely required — but an indicator that
fires on every zone carries no information at that scale. Whether a universally
applicable licence condition should raise the `!` is a product decision, not a
data one; nothing was inferred from the prose to suppress it.

### Authority language is immutable; a reading of it is North Ground's (2026-09-29)

Recorded in §41A by the owner the same day.

**The model** is `src/lib/hunt/translation.ts`. A `Translation` carries
`owner: "NORTH_GROUND"` and no `sourceId` or `citation`, so it cannot satisfy
`AuthorityQuotation` — a renderer cannot put a reading through the quotation path
because the mistake does not compile. That negative type test extends the
provenance split rather than duplicating it. Where the authority itself published
both languages, BOTH stay authority-owned and neither is called a translation.

**A reading is keyed by the source text verbatim.** Change a word in the source
and the key misses and the interface says no reading exists, rather than showing
yesterday's reading of today's rule.

**Language is metadata, never detection — with one deliberate exception.**
`src/lib/hunt/language-integrity.test.ts` evaluates a real hunt in every served
jurisdiction and compares each line's DECLARED language with its own characters.
Detection is the point there and is safe there: a wrong guess fails a test rather
than mislabelling a ministry.

**Two live mislabels it found**, both invisible to the existing suite because
`answer-invariants.test.ts` asserts `owner` on every condition and never asserts
`lang`, and nothing anywhere compared a declaration against the text:

- Québec's ministry notes ("Dans la zone 17, l'utilisation de collets…") reached
  a reader through `general()`, which hardcodes `en-CA` and `NORTH_GROUND`.
- Québec's statements were transcribed with guillemets baked into the text and
  tagged `NORTH_GROUND`, so a renderer that quotes authorities and prints North
  Ground plainly printed the ministry's sentence plainly with stray marks in it.

Both are fixed at the PRODUCER, which is the only place that knows: a note now
arrives as an `AuthorityQuotation` requiring its language, source and citation,
and a bundle condition declares its own `owner`.

**Surfaces converted** to `AuthorityText`: conditions, "Applies here today", the
always-true limitations, both source-caveat lists, and legal hours. Legal hours
was the worst — Québec's wild-turkey answer is the ministry's own French sentence
and `LegalTimeResult` had nowhere to say so, so a LEGAL-HOURS ANSWER rendered in
a language the reader may not have.

**Readiness names stay French and stop claiming to be English.** « Certificat du
chasseur » was hardcoded `en-CA`, so a screen reader pronounced it with English
phonetics. It is not translated — §47 keeps an official name in the authority's
words, and a licence a hunter asks a vendor for by name is what that rule is
for. What was wrong was the label. The JURISDICTION MODULE declares the
language, not the bundle: Ontario's readiness bundle is generated by
`scripts/build-ontario-readiness.mjs`, so a field hand-added to it disappears at
the next rebuild — silently, with the mislabel back and nothing to show it.

**Stored readings** live in `content/regulatory/translations/hunt.json`: eleven
rows covering Québec's seven distinct overlay statements, the wild-turkey hours
and the two regulatory class definitions. Every one is `NORTH_GROUND_GENERATED`
and is labelled "not yet reviewed" in the interface. **Promotion to
`NORTH_GROUND_REVIEWED` is a human act and has not happened.**

**Gaps left, with reasons.** The remaining French-bearing surfaces are not yet
converted: `regulation.summary` ("Why this answer", which embeds French season
labels and phrases), `specialAreas[].line` on the zone card (a pre-baked string
from `provenancedLine`, which discards `lang` and `owner` by returning a string),
the Hunt Brief's flattened warnings (same class of loss in
`from-hunt-evaluation.ts`), source titles, publishers and section headings in the
source drawers, Ready to Hunt's own display rows (which read a flattened
`ReadinessResult`, not the structured `RequirementRow`), dimension option details
(« carabine »), and the Québec layer coverage note on `/hunting`. Each needs its
producer to carry provenance across a boundary that currently returns `string`;
none was guessed at.

**One fix is latent and says so.** The engine composes "Bag limit: …" in English
and took the BUNDLE's language, so a Québec bag limit would have gone out as
French. Québec is the only `fr-CA` bundle and encodes no harvest limit, so
reverting that fix leaves the sweep green. It is recorded rather than left to
look tested.


### 2026-09-29 — A latent false number became publishable, so it was fixed first
`build-bc-harvest-evidence.mjs` passed `harvestRanks[index]` as the
`normalizedValue` for `HARVEST_TOTAL`, **`HUNTER_COUNT` and `HUNTER_DAYS`
alike**, while the two ratio metrics correctly used their own series. A rank
attributed to a metric it was never computed from is a fabricated number on a
sourced record (§61).

**Why it had to be fixed in this lane rather than deferred.** The endpoint
served Ontario white-tailed deer only, so the false values were unreachable.
The species layer makes all 5,980 British Columbia records reachable — it turns
a latent defect into a published one, at scale, on a visible surface.

**The discriminating fact is `HUNTER_COUNT`, not the row of equal numbers.**
MU 3-14 (5 hunters) and MU 3-17 (65 hunters) both carried `0.081461` — a
thirteenfold difference in hunters producing an identical rank. Both units have
zero kills, so three of their five metrics tie *legitimately*; a reader
comparing all five and seeing them equal would conclude "correlated data" from
the right observation. After the fix those two read `0.011236` and `0.36236`,
and **0 of 179 moose units still have all three metrics tied**.

**Blast radius, measured rather than asserted.** The source hash still matches
the pinned `EXPECTED_HASH`, so the authority's CSV is unchanged. Across all
5,980 records the only field that differs anywhere is `normalizedValue`, and
only on `HUNTER_COUNT` (1,176 records) and `HUNTER_DAYS` (1,184). Bundle
headers are byte-identical and record counts unchanged.

**Effect on the map: 308 of 1,196 BC zones (25.8%) changed heat class; Ontario
0.** The distribution moved off the extremes and toward the middle — VERY_HIGH
203 -> 140, LOW 545 -> 418, MODERATE 254 -> 411, HIGH 295 -> 328. That is the
signature of removing a triple-weighted variable: the old score was 3/5 one
series, which pushed zones to the tails. Largest single move is LOW -> MODERATE
(135), because the many zero-kill units all shared one harvest rank and spread
out once ranked on hunters. Sixty-three fewer zones are now drawn at the top of
the ramp. `opportunity-v1` is unchanged — the data now matches the definition
rather than the definition being bent to the data.

**Prediction and gap, recorded.** ~500 BC zones were predicted to change, range
420-580. The measurement was 308: a 62% overshoot, outside the stated range.
The error was assuming the hunter-effort ranks would diverge substantially from
the harvest rank; they are strongly rank-correlated with kills, so the
correction is much smaller than the triple-weighting suggested.

**Coverage semantics: a gap worth naming.** `evidenceCoverage` counts DISTINCT
METRICS, not independent values, so five metrics carrying three values still
graded `ROBUST_DATA`. The class could not have detected this defect, and did
not. British Columbia's `ROBUST_DATA` is now true rather than accidentally
true. Ontario's `PARTIAL_DATA` was and remains correct: its script ranks each
of its two metrics on its own series and never had the bug, so the two
jurisdictions now compare like with like — 2 real metrics against 5 real ones.

**Guarded structurally, not by field name.** `bundles.test.ts` asserts that no
metric's normalized series is a copy of another's across every geography of
every bundle. Written against the signature rather than the two fields that had
it, and deliberately not "these metrics never tie" — zero-harvest units tie
honestly. Falsified against the actual pre-fix bundles: it fails with
`HUNTER_COUNT carries HARVEST_TOTAL's rank on all 206 geographies`.

### 2026-09-29 — The species layer ships: heat and open season, over one geography
CLAUDE.md §41A's species-layer decision is now implemented end to end.

**The gap it closed.** `intelligence/handler.ts` tested
`speciesId !== "species:white-tailed-deer"` against an Ontario-shaped zone
pattern. Nine of the ten committed bundles — 5,980 records, every British
Columbia species — returned 400. Every test passed, because every test asked
about Ontario deer. What is servable is now DERIVED from the bundles
(`intelligence/bundles.ts`); no route, handler or UI constant names a species,
a jurisdiction or a zone shape. **10 species x jurisdiction pairs, 1,297 zones,
6,182 records**, all reachable, and `/api/hunt/opportunity/coverage` computes
those three numbers at call time so none can be typed by hand.

**Absence is a finding.** A well-formed species at a zone holding no evidence is
404 NO_HEAT_MAP_DATA, not 400. A zone missing from the viewport reply holds no
evidence and draws NO heat — never a cold value. LOW stays distinguishable from
no-data by hue and by opacity, and LIMITED_DATA takes no fill either, because
the evidence will not support a rank.

**Two channels, deliberately different ones.** Heat is the FILL (an ember ramp
along §38's campfire-amber line: LOW is `--ng-bark-light`, HIGH is `--ng-amber`,
and no step borrows a regulatory semantic token). An open season is the STROKE,
binary, in `--ng-open` — the same green as the sheet's "In season" chip. The
eight-state colour ramp is gone: five tints answered no question at a glance,
and one of them drew CLOSED, which a map must never assert.

**Heat is exempt from the focal-plane dim.** The rule that a neighbour's fill
recedes when a zone is chosen was written when a fill was decoration. Dimming
heat meant choosing one zone erased the evidence for every other zone on
screen — the whole thing the hunter switched the layer on to see. The chosen
zone still leads: its fill is computed to clear the undimmed ceiling.

**Selectable is not answerable, again, one level down.** Six of the nine species
with committed evidence — bobcat, lynx, caribou, elk, gray wolf, mule deer —
have no certified rules in any jurisdiction. `explorable` was gated on rules
alone, so all six were unselectable and their evidence unreachable. It is now
rules OR evidence, and heat is keyed on the chosen species directly rather than
on `exploreSpecies`, which still requires rules and still drives the green.

**The two sentences the layer cannot ship without** are in
`exploration/species-layer.ts` and asserted by
`species-layer.test.ts`: a zone without a green outline is not closed, and an
unshaded zone is not a zone with no animals. The first is on the legend's
COLLAPSED face, not behind its disclosure, because a false closure is the
failure this product exists to avoid.

**Exercised on a phone (375x812) against the live engine**, not fixtures:
Find Game -> Moose turns the layer on; searching Prince George resolves MU 7-15
and BC heat appears (0 -> 10 -> 17 zones with evidence as the viewport grows,
so unasked ground is asked about rather than drawn cold); American black bear on
Nov 10 draws 16 green and 16 shaded at once, and on Dec 20 draws 0 green and
still 16 shaded, so green is date-dependent and heat is not; Ruffed grouse (no
evidence anywhere) draws no heat and the legend says "no heat evidence held";
Mule deer — previously unselectable — draws 23 shaded with no value leaked from
either previous species. Also verified on the no-basemap boundary view and at
1440x900.


### 2026-09-22 — Drawing a boundary and answering its rules are separate switches
`ZoneLayer.serving` governs drawing and zone resolution; a new `rulesServing`
(absent means no) governs whether the jurisdiction's certified rules answer.
Until now one flag did both, so serving a jurisdiction's boundaries would have
silently switched on any rules bundle it had. That made CLAUDE.md §41A's "a
drawn boundary is not a claim that the rules inside it are certified" true only
in the words on the card. It is now true in code: a layer can be drawn, named
and resolved while every species there answers UNKNOWN with the authority's
link, and the coverage summary counts a jurisdiction as covered only when its
rules are certified and answering. Ontario, Manitoba, Alberta and Québec carry
both flags; British Columbia, Saskatchewan, Newfoundland and Yukon will be
served boundary-only first.

### 2026-09-22 — The Northwest Territories and Nunavut are out of scope for now
Owner decision. The current national target is the ten provinces, Yukon and the
federal layer. This is a scope decision, not a finding: everything established
about those two territories stands, including that neither publishes reusable
vector hunting geography and that both prohibit commercial reuse without
written permission. `CanadaJurisdiction.scope` records the decision with its
date and reason; the coverage report keeps both territories in its listing, has
them declare their gaps as before, computes national milestones over in-scope
jurisdictions only, and states in each milestone that they are out of scope and
not counted either way. They are never reported as complete and never quietly
dropped. The Statistics Canada attribution layer the owner approved earlier is
deferred with them, and stays approved for later.

### 2026-09-22 — Migrations with triggers or functions are dry-run in production first
Every migration that creates or changes a trigger or function is run with its assertions inside `BEGIN … ROLLBACK` against production before it is applied. `20260922190000` shipped a trigger function that failed every zone write at commit (42703). Its pgTAP file had never run, because there is no local database harness. The post-apply dry-run caught it, and `20260922200000` fixed it. Bulk writes through REST RPCs are batched under the 8-second statement timeout (≤15 records, ≤400 KB per call); a timed-out attempt is not retried. Repeated attempts loaded production during an owner upload.

### 2026-09-23 — A hole too small to test, and a positional rule that is wrong for ESRI data
New Brunswick failed parity at 3 of 127 points, all of kind HOLE, in zones 3, 4 and 26. Traced rather than promoted or tuned: **New Brunswick's own live service placed all three points inside those zones, our stored geometry contained them, and our parts covered each zone exactly (0.0 m² uncovered).** Both sides of the comparison agreed with the authority; only the audit's derived `expected` disagreed.

The cause was two things, and the first hypothesis was wrong.

**Wrong first: "ESRI ring order misread as holes."** The audit's `pointInPolygon` used the GeoJSON convention — ring 0 is the exterior, the rest are holes — which is positional. ESRI distinguishes exterior rings from interior ones by ORIENTATION, and New Brunswick's zone 3 arrives from the authority as orientations `-++`, meaning ring 0 is the hole and rings 1 and 2 are exteriors. That is a real defect and it is fixed: containment now decides, by counting rings (even-odd), which is orientation-free and therefore right for both conventions and for geometry whose winding survived conversion imperfectly. But fixing it did not change the result, which is how the second cause surfaced.

**Right: the holes are degenerate.** The failing rings are 3 and 4 points with a pole-to-edge distance of **0.000 m** — zero-area holes the province publishes. Their furthest-from-any-edge point lies ON their edge, so whether a point is "in" them turns on differences far below any boundary North Ground reports. This is exactly the untestable-sliver case, in holes rather than in parts, and it takes the same treatment: recorded as its own outcome with its pole-to-edge distance and ring size, never as agreement. New Brunswick then certifies on evidence — 118/118 testable, 0 disagreements, 9 untestable holes (7.1%, under the 15% ceiling).

**The sentence that matters more than New Brunswick: this was LATENT in every ESRI jurisdiction.** Ontario, Québec, Manitoba, Alberta, Yukon, Nova Scotia and Newfoundland all certified clean under the positional rule only because their sampled rings happened to be genuine holes. Re-running every jurisdiction after the change left all outcomes UNCHANGED, and reclassified one sample: **Ontario went from 607 to 608 testable points**, a ring the positional rule had mis-read now being tested for the first time.

### 2026-09-23 — The tiling demotion is reversed, on evidence
The demotion recorded above rested on one premise: a viewer at the national extent genuinely needs all 1,397 zones on first paint, so tiling would split the same bytes across more requests. That premise was true BY CONSTRUCTION while the served footprint and the opening camera were the same box.

Colorado breaks it. `SERVED_EXTENT` is 41.5°N-69.8°N, a Canada-shaped box; Colorado (36.99-41.01) lies entirely south of it, so it is served, invisible on first paint, and costs 0 KB. A jurisdiction that is served but unviewable means the premise no longer holds. The real condition was never "the opening camera narrows" — it is that **the opening camera and the served footprint stop coinciding**, which is the same consequence reached from the opposite direction.

The decision is to decouple them: make the overview VIEWPORT-SCOPED so SERVED and OPENING stop being the same thing, and do NOT widen `SERVED_EXTENT` to cover the lower 48, which would add every southern state's zones to a paint nobody is looking at. What Hunt should open on — national, local, or the last hunt location — then becomes a product decision the owner can make on its merits rather than under payload pressure. That is the main argument for doing it first.

### 2026-09-23 — Three ways a measurement lies, collected
A measurement can be precise, reproducible and about the wrong thing. Three instances in one day:
- **The wrong artifact.** New Brunswick's payload measured 150.9 KB brotli — real, and about the province's SOURCE geometry, because that was easy to fetch. The overview ships the level-1 DRAWING: the same zones are 2.3 KB, and 195,606 vertices become 640. Reporting the first would have triggered a tiling project on a true number about something the system never sends. Measure the artifact the system ships, not the one convenient to obtain. This is the twin of "audit what the application loads, not what looks like the right directory".
- **The wrong setting.** Compressing at maximum quality understated the payload by about a quarter against the quality actually served.
- **The silent omission.** A harness reported 49.8 KB with Québec, British Columbia and Yukon silently missing from the answer. **A measurement that silently omits part of the system is the same lie as a map that does** — and the fix is the same: refuse to report at all when any layer failed to draw, exactly as the map refuses to draw 400 of 443 zones.

### 2026-09-23 — `publish_zone_run` cannot publish a first ingest (proposal)
`publish_zone_run` hard-codes `coverage_status = 'VERIFIED'`, and the derivatives invariant refuses a VERIFIED zone that has no derivatives — which a first ingest never does. So the REST publish path cannot publish a new jurisdiction at all. It fails CLOSED with a clear message, so this is a papercut and not a defect, but it is now the third operation needing a direct session rather than the script, after the Newfoundland geometry repair and the Newfoundland bear derivatives. Three is a pattern.
PROPOSAL, not implemented: give `publish_zone_run` a coverage argument defaulting to `NEEDS_VERIFICATION`, so a first ingest publishes uncertified in one step and promotion stays the separate, deliberate act it already is. It is a shared function, so it should be taken deliberately rather than mid-province.

### 2026-09-23 — Nova Scotia: rows are parts, and one province's two datasets have opposite licences
Nova Scotia is served boundary-only: 12 Deer Management Zones (101-112), parity-certified against the province 2026-09-23 — 12/12 inventory, 0 missing, 0 invented, 0 geometry disagreements, 54/54 testable points, with two slivers below the 1.2 m sampling tolerance recorded as untestable. Total area 55,263 km² against the province's own ~55,284 km², which is the corroboration that nothing is missing.

**Moose is licence-blocked, not missing.** The province's open-data catalogue licenses ONLY the deer zones, under the Nova Scotia Open Government Licence. Its moose geography exists solely on the Provincial Landscape Viewer's ArcGIS service, which carries no licence of any kind. So North Ground holds no Nova Scotia moose boundary, and choosing moose there draws NOTHING rather than showing deer zones under a moose answer. One province, two datasets, opposite answers — the same shape as Saskatchewan, where the zone geometry is commercially licensed and the harvest PDFs are not. An earlier reconnaissance row had generalised the unlicensed ArcGIS item to the whole province and marked Nova Scotia licence-blocked; that was wrong in the other direction. Read the licence at the dataset, both ways.

**The first authority that publishes parts rather than zones.** Twelve zones arrive as 234 Socrata rows, one per polygon part — 106 is 59 parts, 104 is 1. Reading a row as a zone would have invented 234 zones out of twelve. Parts are grouped by the authority's designation and merged into one MultiPolygon each, and how many parts each zone has is DECLARED and checked, so a zone quietly gaining or losing one fails the ingest rather than publishing a redrawn boundary. That is the Alberta multipart lesson generalised into the adapter contract.

**A fourth instance of the sentinel class: a wrong value that does not fail, it passes.** The designation arrives as `"101.0"` because the Socrata column is numeric. Left alone the canonical id would have been `management_zone:ca-ns-dmz-101-0` — joining nothing to nothing, and failing no test, because nothing would have looked for it. Normalised to the integer the regulation uses. The collection so far: the certification script's prefix table yielding `undefined*`; the British Columbia species-group lookup comparing empty to empty and reporting agreement; the caribou comment reporting a gate's answer as an absence in the world; and now a float rendering minting an id nothing joins to. In every one, the wrong value PASSED.

Serving it also surfaced two requirements a new layer must satisfy and which now fail loudly rather than silently: a jurisdiction drawn without certified rules must carry `huntingAuthorityUrl` so the card can link its authority, and every served layer must have exactly one zone-presentation profile. Both were caught by existing tests the moment the layer was served, which is the system working.

### 2026-09-23 — Québec and Newfoundland both publish hunting geography over Labrador
Serving Newfoundland made a certified Québec case fail. It is not a Newfoundland stacking bug and it is not a defective ingest: **Québec's zone 19N covers 99.8% of NL moose area 050 (8,982 of 9,004 km²), 87.0% of 049, 84.0% of 086, 53.2% of 060 and 10.3% of 058, and overlaps black bear area 200 by 28,904 km².** Both geometries are the authorities' own, each parity-certified against its own source. Serving Newfoundland REVEALED a conflict that was always in the data and had been resolved silently in Québec's favour, because Québec's was the only claim North Ground held.

Audited across every served jurisdiction, the scale separates cleanly: **NL/QC 21 overlapping pairs, largest 28,904 km²**; ON/QC 13 pairs, largest 13 km²; BC/YT 9 pairs, largest 9 km²; AB/BC 2 pairs, largest 4 km². Everything outside Labrador is a border sliver of a few km² — ordinary digitising mismatch along a shared boundary. Labrador is three orders of magnitude larger and is a territorial dispute, not a data artefact.

What North Ground says at a point two governments both claim is an owner decision, not an engineering one, and is NOT implemented here. Until it lands, the honest answer is a conflict naming every claimant, and the certified case `zone19n-grouse` stays red on purpose. **Do not tune it green.** That point has two location-layer claimants for every species, because moose is Newfoundland's `drawnByDefault` geography, so no species filter resolves it.

Three defects were fixed, none of them the policy:

**A required field that cannot always be truthfully filled manufactures falsehood.** `ZoneResolution.sourceId` was required, so a generic path had to name SOME authority — and named Ontario, which is why a point in Labrador cited the Ontario WMU service. There were eight hard-coded `source:ca-on-wmu-service` in `zone.ts`, not the two first reported; four are legitimately inside Ontario's own resolver and stay. The field is now optional and six consumers filter an absent source rather than carry a false one.

**A default that is silently wrong rather than absent, again.** The country-wide registry resolver was named `resolveOntarioWmuFromSupabase` — a leftover from when Ontario was the only jurisdiction — and answered for every province while attributing Ontario. Renamed `resolveZoneFromRegistry`. Same class as the prefix table and the caribou comment: the name, like the constant, was a claim nobody re-examined.

**A filter that narrows candidates is only safe once the source of candidates is complete.** The resolver ended with `limit 2`, and at the Labrador point returned the two lowest canonical ids — both Newfoundland — dropping Québec before the application saw it. Filtering species-scoped layers on top of that truncated set would have left exactly one row and RESOLVED silently to Newfoundland: a confident wrong answer replacing an honest conflict. The limit had to be raised (to 8) BEFORE the filter was added. Found by tracing what the change would do rather than assuming an improvement was an improvement. Generalise it: never narrow a set that may already be truncated.

### 2026-09-23 — Audit what the application LOADS, not what looks like the right directory
Hunt tells a hunter "Not covered here" for a species it cannot answer for, and names the authority whose rules they are, linking its published source. That link is a `SourceRecord.url`. In production, **seven of the eight served Canadian jurisdictions had no published source record at all**, and the one that did — Ontario — pointed at `ws.lioservices.lrc.gov.on.ca/arcgis2/rest/services/...`, an ArcGIS MapServer endpoint titled "Wildlife Management Unit feature layer". A hunter got either no link or a machine endpoint. Section 7 requires provenance a person can inspect; a FeatureServer URL is not that.

**The audit that nearly missed it.** The first pass scanned `content/regulatory/*.json`, found `source:ca-mb-gha-service` there, and reported Manitoba as fine. But `getSources` reads the published bundles — `content/published/en-CA.json` and the species waves — which is a different set of files. The directory looked authoritative and was not what the application loads. Re-running the audit through `contentRepository.getSources` gave the true answer and showed Manitoba had no record either.
This is the same class as the certification script's prefix table and the caribou comment: **a check pointed at the wrong thing reports false comfort.** It does not fail, it passes, which is worse. When auditing what a user sees, go through the code path the application uses, not the data that looks like it should be behind it.

**A citation that 404s is worse than none, because it looks like diligence.** Every one of the eight replacement URLs was fetched and confirmed 200 before landing.

The standard is now enforceable rather than remembered: a test asserts that every served Canadian layer has a published source record, that its url is not a GIS endpoint (`arcgis`, `/rest/services`, `FeatureServer`, `MapServer`, `/ows`), and that its title is not a bare layer name.

KNOWN DECISION, not taken here: `SourceRecord` has a single `url` serving two purposes — the provenance of the geometry ingested (a service endpoint, hashed) and the citation a hunter reads (a published page). They are different facts and cannot both live in one field. Resolved for now by making `url` the readable page, since that is what the consumer renders and what §7 asks for, with ingestion provenance recorded separately in `zone-layers.ts`, the Canada registry's `serviceUrl`, and the certification fixtures with their hashes. A record that must carry both needs a second field (`citationUrl` vs `retrievalUrl`), decided deliberately rather than discovered when someone hashes a web page. The content contract is Agent C's and the U.S. state services will hit the same thing, so it goes through the moderator.

### 2026-09-23 — Cost tracks parts per zone, and a KNN index that was never used
Québec's p90 was the national outlier at roughly 1.5 s on both lanes. Root cause: `zone_boundary_distance_meters` walks a zone's boundary parts nearest-first and exits as soon as the next cannot beat the best distance found — a sound design whose ordering could not use an index. The query filters on `management_zone_id` and orders by `geometry <-> point`, and no index covered both, so PostgreSQL scanned every boundary part of the zone by primary key and top-N heapsorted them. **All the work happened before the early exit could prevent any of it**: at Maniwaki the scan produced all 611 parts in 91.1 ms, of which the loop consumed 15.

`btree_gist` plus a composite GiST index on `(management_zone_id, geometry)` (migration 20260923044747) makes it a true KNN index scan that yields parts lazily in distance order. Same parts, same order, same answer — found rather than sorted. Isolated query 91.9 ms → 5.2 ms, 611 rows scanned → 15, buffers 275 → 22. Build cost 4.6 s plus 1.3 s analyze, 12 MB index on 112,670 rows, taken as a brief exclusive lock rather than CONCURRENTLY because a half-built index from a failed concurrent build is worse than six seconds of blocking.

**The real invariant: cost tracks PARTS PER ZONE, not geometry size and not zone count.** That is what made Québec look mysterious — 59 very large zones averaging 656 boundary parts each, against Ontario's 84 and Yukon's 16. British Columbia carries more zones and heavier level-0 geometry (54 kB/zone) and resolved in 3.7 ms throughout, because its zones have 86 parts each.

**Scope a performance investigation to the SYSTEM, not to the reported symptom.** The report was "Québec's p90 is the national outlier", and measuring only Québec would have fixed Québec and left a Labrador point at 181.6 ms average and 713.6 ms worst indefinitely — the slowest point in the country was not in the province being chased. The symptom named a province; the cause was a missing index shared by every jurisdiction, and the worst instance of it was somewhere nobody had complained about. Measure every jurisdiction before and after, not the one in the ticket. A Labrador point was 181.6 ms average and 713.6 ms worst — worse than Maniwaki — because Newfoundland is second on parts per zone at 211. It is now 13.6 ms average, a 13× improvement, and its components are 0.3 ms parts lookup, 1.3 ms boundary distance, 4.1 ms display serialisation: all real work, no scan overhead.

**Two plausible hypotheses killed by measurement before any code was written.** First, "it is the level-0 display geometry": no — Québec averages 61 kB per zone, Newfoundland 65 kB and British Columbia 54 kB, and BC resolved in 3.7 ms. Second, "it is `ST_Segmentize(0.01°)` on long boundary pieces": also no, and this one nearly became a commit. The segmentize blowup factor is **1.0× in every jurisdiction**, and Québec's boundary pieces are the SHORTEST in the country at 1.7 km average against Yukon's 11.6 km. The story was exactly backwards and only the measurement said so. Do not re-propose a segmentize fix without re-measuring that factor.

**A measurement that returns an impossible number is not a slow result, it is no result.** The first timing run used a window function over a reordered set and reported negative milliseconds; it was discarded rather than interpreted.

KNOWN ITEM, deliberately not bundled: the resolver sets `plan_cache_mode = force_custom_plan` (added in 20260922200000 to avoid a bad generic plan), and planning measured 22-61 ms on these queries. With execution down to single digits, planning is now plausibly the larger half — at Maniwaki the three measured components sum to about 22 ms against a 73.6 ms full-resolver average, and the gap is planning and function overhead. Revisiting it is a separate decision with its own risk.

### 2026-09-23 — Checking a gate and reporting it as an absence nearly minted a duplicate species
The Newfoundland caribou layer is correctly unserved, but the reason recorded on it was wrong, and the wrong reason was load-bearing.

I wrote that `species:caribou` "has no canonical species record". I had checked `speciesById()`, which reads `SUPPORTED_SPECIES` — the SELECTABILITY gate, admitting only species North Ground can answer for somewhere — and reported its answer as a fact about the species LIBRARY. The record exists and is published: `content/published/species-wave-2d.json` holds `species:caribou`, status active, with Rangifer tarandus as a verified alias, loaded by the repository and the species route, and the production species page returns 200. The real blocker is that no Newfoundland caribou rule is certified, so the species is not selectable, so nothing reaches the layer. The layer's own `coverageNote` had been saying the true thing all along.

**What it nearly cost.** The moderator read that comment and tasked Agent C with creating the missing record. Agent C checked before building; had it not, it would have minted a duplicate canonical `species:caribou` — one day after the rule that caribou must be exactly one canonical species, with herds and subspecies as attributes and as jurisdiction-specific regulatory geography, so that a hunting ban attaches to a jurisdiction's rules and never to a biological identity.

The generalisation: **a gate's answer is not a fact about the world.** `speciesById` returning undefined means "not selectable", not "does not exist"; `regulatoryEntryFor` returning undefined means "does not answer", not "no rules exist". When recording WHY something is absent, name the specific gate and the file it lives in, so the next reader can check the gate rather than trusting a paraphrase. A comment stating a cause is an instruction to whoever reads it next.

Related structural gap, routed to Hunt overhaul and the owner: `SUPPORTED_SPECIES` conflates SELECTABLE with ANSWERABLE. §41A solved the same problem on the layer side with `rulesServing` — drawing a boundary and answering its rules are separate switches — and the species side has no equivalent. It is the same shape British Columbia, Saskatchewan, Yukon and Newfoundland all need, and it is what would actually make the 19 certified caribou areas reachable.

### 2026-09-22 — Falling back to a default is safe for a search box and dangerous for geography
Newfoundland's caribou areas are certified but unreachable, so asking the map about caribou should draw nothing. It drew Newfoundland's MOOSE areas instead.

The cause was a convenience in the zones route: a species the library does not hold was treated as "no species", which falls back to the geography drawn before any species is chosen. That fallback is itself a claim — it puts the wrong official boundary under a species North Ground cannot answer for, which is worse than drawing nothing, because a hunter could read a caribou season against a moose boundary.

Two things about how this was found are worth keeping.

**I predicted this exact failure and then built it.** The species-scoped work exists because I had written, two days of work earlier, that "choosing caribou would leave moose areas on the map beneath a caribou answer". Then I reintroduced it myself, in the validation, while fixing it. Knowing a failure mode is not protection against implementing it.

**The unit tests did not catch it; five end-to-end cases did.** The tests covered `layersForBounds` directly and passed. The defect lived in the route's translation of a query parameter into that call — the seam between the thing tested and the thing shipped. Driving a real server with no species, the right species, another served species, an unserved species and an unrelated species took minutes and found two defects, the other being that black bear was certified but never promoted so it drew nothing at all.

The generalisation, for anyone touching the species parameter or any other input that selects geography: **ignore-and-fall-back-to-the-default is a safe convention for a search box and a dangerous one for geography, because the fallback is a claim.** An input we cannot honour must produce nothing, not something plausible. The species is now passed through on its id shape alone and the layer filter decides.

### 2026-09-22 — A point sample cannot test a sliver, and saying so is not lowering the bar
Newfoundland's black bear areas failed parity at 3 of 30 points. Traced: not the derivatives and not the resolver — North Ground's stored source geometry does not contain those points either, by **0.001 m, 0.059 m and 0.006 m**. All three are in areas 200, 201 and 205, three of the four whose invalid geometry we repaired with `ST_MakeValid`.

The cause is a limit of the METHOD. The audit samples a secondary part at its pole of inaccessibility, computed to 1e-5 degrees — about a metre. For a degenerate sliver, which is exactly what made the authority's geometry invalid, the furthest-from-any-edge point is itself sub-metre from the edge, so a millimetre-scale difference flips containment.

**This is why a 0.000000 m² symmetric-difference check did not catch it.** Area is blind to zero-width slivers. The repair was lossless by area and still moved a boundary by millimetres. That is a real limit of the guard the repair standard relies on, and it applies to every authority whose invalid geometry North Ground must repair — three provinces so far.

The certification now records an untestable part as its own outcome, never as agreement: per part, its pole-to-edge distance, the tolerance that made it untestable, its area, and whether North Ground repaired it. A record reads "27/27 testable points agree; 3 parts untestable (slivers, pole-to-edge 0 / 0.061 / 0.011 m)". Certification rests on the independent full-component inventory comparison — 0 missing, 0 invented, 0 geometry disagreements — with point sampling as corroboration, exactly as the sampler's own comment says: "The full component inventory is independently compared below, so an island cannot disappear merely because it was not chosen as a point sample."

**The ceiling is 15% of a layer's samples**, above which the layer fails rather than certifying. The reason for a ceiling at all is that untestable must never become the route by which a badly degenerate layer passes: if sampling loses its power over most of a layer, the inventory is carrying the certification alone and that should be a failure, not a pass. 15% sits above the observed worst case (Newfoundland black bear at 10%, being 3 of 30) and far above every other layer measured (Ontario 1 of 608, Yukon 1 of 1770, Québec 1 of 257 — all under 0.4%), so it admits the degenerate-sliver case without admitting a layer that is mostly untestable.

Re-running every stored jurisdiction after the change left all outcomes **unchanged** — Ontario, Manitoba, Alberta, Québec, British Columbia, Yukon and both certified Newfoundland layers still VERIFIED. It also reclassified two parts: Ontario zone 56 (pole-to-edge 0.905 m) and Yukon 1-71 (0.357 m). **This is not a regression in either layer — both were passing UNTESTED.** Their sampled points sat closer to their own edges than the tolerance the points were found to, so "agreement" there turned on differences below what the method can resolve; the agreement was luck, not evidence. Both layers remain VERIFIED on their inventories, and the record now states that two of their parts cannot be point-tested instead of quietly counting them as corroboration.

### 2026-09-22 — The PostgREST wall is 8 seconds and the direct session's is two minutes
Newfoundland's black bear derivative build failed on its first zone with `57014 canceling statement due to statement timeout`, so none of the seven built. Area 200 — Labrador, 4,210 polygons, 197,117 vertices, 275,389 km² — takes **9.67 s** to build derivatives for, against PostgREST's 8 s limit. The wall was 1.7 seconds wide. The other six take 1.6-6.3 s and would have built had the script not stopped at the first failure, which it correctly does.
The tool for these is a direct session, whose statement timeout is 2 minutes: the same route the NL geometry repair took. Build ascending by vertex count so the cheap zones land before the expensive one, and check `ST_NPoints` first to know which zone will be the problem.

### 2026-09-22 — A drawn zone carries only the precision its zoom can show, and tiling is not what the overview needed
The overview was 145.9 KB brotli with 4 KB of headroom under the payload budget, and tiling was queued first to fix it. Measurement said otherwise and the plan changed.

**Tiling does not help the national overview.** Hunt opens at the served extent — the whole country — so a viewer genuinely needs all 1,212 zones on first paint. Cutting that into tiles splits the same bytes across more requests, adds cache keys and a per-tile completeness rule, and buys nothing. Tiling becomes necessary when the opening camera narrows, or when a viewport at high zoom holds more geometry than the level-2/3 budget allows. It is not a fix for a view that legitimately shows everything. Do not re-propose it for the overview without one of those two conditions.

**The poster was never part of the problem.** It is server-side, `unstable_cache` with a six-hour revalidate shared across instances, so its fetch happens a few times a day on the server, not once per viewer. The payload that matters is the client's single overview request.

**Repeated metadata was the obvious wrong target.** Per-zone metadata is 283 KB of the 646 KB raw response — the same label and presentation strings on all 1,212 features — which looks like the thing to shrink. It is not: dropping `accessibleLabel` saves 3.3 KB brotli and dropping the full label too saves 6 KB, because brotli already collapses repeated strings. Reasoning from raw bytes would have sent the work in the wrong direction; measure compressed. The accessible label also stays because it is an accessibility contract, not payload.

**What worked: coordinate precision by display zoom.** The response serialised at six decimal places — about 0.1 m — for a view where one pixel spans more than a kilometre. `drawingPrecision` now gives 3 decimals at the overview zooms, 4 at level 1, and leaves the detailed levels at 6. Measured: 145.9 → 108.2 KB brotli, 646 → 562 KB raw, all 1,212 features and all seven layers intact, and zoom 11 still serialises at 6 decimals. Headroom went from 4 KB to about 42 KB, which covers Newfoundland, Nova Scotia, New Brunswick and Prince Edward Island. A second-order win measured by the U.S. agent: it also halved Québec's evaluation payload, 16 KB to 7 KB median.

**The guard, because this is geometry.** It is a RENDERING precision on a drawing, and section 41A is explicit that the drawing is never a boundary determination. Zone resolution, boundary distance and `nearBoundary` are answered by the PostGIS resolver at full precision and are untouched; no stored geometry changes. The evidence is sub-pixel at every zoom the overview is drawn at: 0.001° is 56-79 m depending on latitude, against 611-1730 m per pixel — 0.023 of a pixel at zoom 5, 0.046 at zoom 6 (the overview's own request zoom), 0.091 at zoom 7, and by zoom 8 finer geometry has taken over. It is applied once, where the layers' features are assembled, so a stored layer and a live-service layer behave identically and the map and its poster cannot be drawn from different geometry.

### 2026-09-22 — Applying through the MCP assigns the version, so the file is renamed to match
The platform assigns a migration's version when it is applied through the Supabase MCP rather than the CLI: `20260922233000_zone_display_level_aware_limit.sql` was recorded as `20260922204235`. Left alone the repository would hold a version the ledger does not, and a replay would treat the file as a second, separate migration of the same change — breaking the version-for-version agreement recorded in Data Providers. After every MCP `apply_migration`, read `list_migrations` and rename the file to the version the platform recorded. The check is unchanged: `select version from supabase_migrations.schema_migrations` against `ls supabase/migrations`.

### 2026-09-22 — A VERIFIED zone always has its derivatives
The fast resolver reads parts only, so a VERIFIED zone without them would silently match nothing. The database now makes that state impossible, and the resolver fails closed into the authority's own service if it ever occurs.

### 2026-09-22 — Legal restriction areas are stored in the regulatory lane
Restricted-area geometry the rules engine reads lives in `regulatory_special_areas`, keyed by layer and the authority's own record id, with its verbatim restriction text. It is separate from map-intelligence `land_features`. A layer is stored only under a licence that permits it and is read only while it matches the reviewed catalogue.
### 2026-09-22 — Hunt is rebuilt as a map-first application
Recorded in `CLAUDE.md` §41A ("Hunt is map-first", "Shareable Hunt state", and the location, date and exploration subsections). One contextual sheet (phones) or panel (wide screens) over a full-screen map; automatic evaluation keyed by its inputs; Today and Choose date only, with "This weekend" rejected because its two days can have different rules and Tomorrow rejected as one tap the calendar already covers; "Use my location" as the one explicit device-to-hunt-location action; a link carries zone, species, date and explore, never a coordinate; polygons carry compact labels, cards full labels (owner decision relayed by the moderator); a server-drawn poster of the same served overview may stand in until the live map draws (moderator rules 1–5).

### 2026-09-22 — Zone identity is separate from zone presentation
Recorded in `CLAUDE.md` §41A ("Zone identity and presentation"). Canonical id, source designation and official name are identity; full, compact and accessible labels are derived per locale (en-CA, fr-CA) by `src/lib/hunt/zone-presentation.ts` and never join, key or select anything. Audited against all 461 certified zones: Québec compass parts are localised from the ministry's part names (10O → Zone 10 West / 10W; Zone 10 Ouest / 10O), subdivision letters (Ontario 76E, Manitoba 25A) are never expanded, 19SNO is preserved, and an unregistered jurisdiction shows its raw designation.

### 2026-09-21 — Québec: each published year is its own rule, and a closed territory is quoted, not certified
The ministry prints two seasons in one table and a cell can differ between them ("2026 Orignal avec bois / 2027 Orignal"), so each year is its own rule, in force for its own year or licence year, in the bundle and in the store; the shared publisher now takes a rule's own period where it states one. A fragment the builder cannot map (« Partie est et partie ouest de 19 sud (sauf la partie nord-ouest) », « Île-du-Havre-Aubert ») stays unresolved on purpose and answers NEEDS_VERIFICATION where it may apply, never CLOSED. A point inside the ministry's `Chasse_Interdite` layer is NEEDS_VERIFICATION quoting « Territoires où toute activité de chasse est interdite », not CLOSED, and no "Season dates" are shown there (`6571e5a`, shared). Answers cover sport hunting only; zone 17 moose is closed as the ministry states, and harvesting under the James Bay and Northern Québec Agreement is named as a context North Ground does not evaluate. Large zones are resolved through subdivided parts and measured to the straight edges membership tests.

### 2026-09-21 — Ready to Hunt, and a third location that cannot become the hunt location
Recorded in `CLAUDE.md` §41A and §5. A permitted hunt carries a concise checklist of what must be held, worn and carried — licences, hunter orange, legal methods and ammunition, verified fees, where to obtain each — not a gear list. Law (REQUIRED/ALLOWED) and North Ground advice (RECOMMENDED) are separate in data and on screen; advice cannot change legal status. Fees are never guessed or blended across residency. Vendors come only from an authority's own dataset. The vendor-search location is its own type, device position is used only on request and only on the device, and nothing about it reaches the evaluation, analytics or a Hunt Brief.

### 2026-09-21 — The Hunt map is an exploration surface; device location is not the hunt location
Recorded in `CLAUDE.md` §41A. A zone card is the canonical engine asked about the whole zone (`scope: "ZONE"`), never a second regulatory truth, and it never says OPEN. The device location is ephemeral map context and never becomes the hunt location, reaches a Hunt Brief, a URL or analytics; only a search result, a confirmed map pin or the explicit "Hunt at my location" sets the hunt location. Special layers appear only where North Ground already reads the authority's service.

### 2026-09-21 — A jurisdiction's silence means what its law says it means
Each conditional bundle declares what an undesignated place means. In Manitoba, s. 3 makes it CLOSED, because a licence authorises only what the regulation designates. In Alberta and Ontario, a unit no row names stays UNKNOWN. That meaning applies only to species a bundle encodes; a species North Ground has not encoded is UNKNOWN everywhere. Routing is by the resolved zone's jurisdiction, through one registry (`src/lib/hunt/regulatory/registry.ts`), never by a bounding box.

### 2026-09-20 — North Ground Master Direction
North Ground is an outdoor knowledge/data/tools/field-testing platform rather than simply a bushcraft blog.

### 2026-09-20 — Hunting Intelligence
Hunt is a flagship product. Core question: “Where are you hunting, when are you hunting, and what do you need to know?”

### 2026-09-20 — International Architecture
Canada is the initial expertise/coverage base but core systems must not be hard-coded as Canada-only.

### 2026-09-20 — Regulatory Trust
Government/authoritative sources remain the source of truth. North Ground improves discovery, interpretation and usability while exposing provenance.

### 2026-09-20 — Content Standard
No predetermined word counts. Answer intent immediately and completely with maximum information density.

### 2026-09-20 — AI
LLMs are not regulatory authorities. Core regulatory results are deterministic and source-backed. AI usage should be conservative and primarily assistive.

### 2026-09-20 — Future Platform Potential
Keep regulatory/geospatial infrastructure sufficiently separated from North Ground presentation that it could eventually support APIs, white-label products or government deployments.

### 2026-09-20 — Shared Content Contract v1
Canonical IDs are URL- and locale-independent. Editorial App Blocks use deterministic contextual matching. Editorial fallback is allowed only to deliberately broader editorial blocks; missing regulatory data never falls back to inferred legality. Authoring systems integrate through a normalized `ContentBundle` rather than being forced into a specific CMS/storage format.

### 2026-09-20 — Main-Site Technical Foundation
The public site identity is North Ground, with North Ground Bushcraft retained as an alternate entity name. The canonical default origin is `https://www.northgroundbushcraft.com` and is environment-configurable. Newsletter subscriptions persist server-side to Resend Contacts plus a dedicated Segment and fail closed when credentials/provider confirmation are unavailable. Only actual published routes enter the sitemap or structured data.

### 2026-09-20 — First Integrated Vertical Slice
The first production-shaped loop is source → deterministic regulation → Hunt → canonical content/App Blocks → indexable species/tool routes. The certified scope is intentionally limited to ruffed grouse in Ontario WMU 57 for the 2026 source period. Regulatory, weather, and editorial layers remain structurally separate; an unavailable forecast or missing regulation cannot be filled by climatology, prose, AI, or a broader editorial fallback.

### 2026-09-20 — Hunt Brief Sharing
Hunt Briefs are immutable, versioned snapshots of an existing deterministic Hunt result, not a second evaluation path. Opaque 144-bit URLs expose no coordinates or raw location input. Snapshots are retained without automatic expiry, remain `noindex`, show source and verification timestamps with a standing staleness warning, and link back to Hunt for a current check.

### 2026-09-20 — First Integrated Production Release
The public `www` host now serves the first source → deterministic regulation → Hunt → canonical content/search loop. The release is `PARTIAL`: public discovery, Hunt evaluation, species content, SEO, security and newsletter persistence are certified; recipient-specific Hunt Brief persistence remains fail-closed.

*Superseded on 2026-09-20 by the Hunt Infrastructure Direction decision above: the storage dependency is Supabase, not Upstash, and both Supabase/PostGIS and Google Maps Platform are now part of the product.*

### 2026-09-20 — Hunt Infrastructure Direction (supersedes the Upstash selection)
Supabase (PostgreSQL + PostGIS) is North Ground's application database and spatial platform. Upstash Redis is removed from the code and dependency list and is not to be reintroduced. Google Maps Platform supplies the consumer geographic experience — map, place search, geocoding, and weather where suitable. Government sources remain the only authority for hunting zones and regulations. A provider fallback may change availability; it may never change regulatory truth.

### 2026-09-20 — Hunt Is Map-First
Hunt opens on official hunting-zone geometry rather than a form. Location is entered as a place, never as coordinates. A location alone resolves and reports its official zone; date and species are required only for regulatory evaluation. Zone geometry is delivered viewport-bounded and generalised server-side, and a boundary is never drawn unless it traces to a named authority's own published GIS service. Drawing a boundary is not a claim that the rules inside it are certified, and the interface says which is which. Full specification in `CLAUDE.md` section 41A.

### 2026-09-20 — Hunt Route Is Canonical at `/hunt`
`tool:season-finder` resolves to `/hunt` through `canonicalPath()`, with `/tools/season-finder` recorded as a previous path and redirected 308 from `redirectPairs()`. Sitemap, canonical, Open Graph, internal links and the homepage `Enter the North` CTA all follow the registry rather than hard-coded strings.

### 2026-09-20 — Species Surfaces Belong To The Hunt Product Family
The species library and canonical species profiles adopt Hunt's product visual
language. They are the same product as Hunt, not a North Ground blog, and a
person moving Hunt → Species Library → a species profile → back should never
feel they changed sites. Hunt remains the visual source of truth and is not
adapted to meet them. Materials live once in `globals.css`; species route
stylesheets carry layout only. Species pages stay information-focused — matching
Hunt does not mean adding a decorative map.

### 2026-09-20 — Main Site and Hunt Are Visually Distinct
The homepage stays dark, cinematic and immersive. Hunt is clean, glassy, precise and map-driven. They share the brand, mark, palette and typography and nothing else about their composition. Neither is to be redesigned into the other.

### 2026-09-20 — Hunt Date Model
Only `Today` and `Choose date`. Display is `YYYY/MM/DD`, storage and transport are ISO `YYYY-MM-DD`, and a hunt date is treated as a calendar day rather than an instant so no time zone can shift it. Fast numeric entry, pasted-format normalisation and real calendar validation are required behaviour, covered by tests rather than by screenshots.

## Source Reliability

**Government GIS services fail transiently, and a run must survive it
(2026-09-23).** Measured, not assumed: Statistics Canada's boundary service
answered one byte-identical geometry request 500, then 200, then 500; British
Columbia's GeoServer answered 400 once mid-run and then 200 on four consecutive
probes of the same URL. Either was enough to abort a whole certification part-way
through thousands of parity reads.

Three changes, in `src/lib/hunt/ingestion/transient-retry.ts` and the audit:

- **One retry policy, stated rather than inferred.** 5xx, 429 and transport
  failures are the service's fault and are retried; **4xx is never retried**,
  because a wrong request repeated is still wrong. The one exception is opt-in
  per status with measured evidence — the WFS adapter declares 400 transient
  *for British Columbia's GeoServer specifically*. A malformed body is not a
  transient fault and is not retried either.
- **Every retry is announced.** A service that needs coaxing is a fact about the
  source; smoothing it into silence would hide a degrading authority.
- **`--all` no longer abandons the national audit at the first bad provider.**
  The jurisdiction is recorded **UNREAD** — neither certified nor uncertified,
  just unanswered — every other jurisdiction is still audited, and the run still
  exits non-zero. A single-jurisdiction run still re-throws.

This replaced an indiscriminate 3-attempt retry in the WFS adapter that repeated
4xx as readily as 5xx, and gave the ArcGIS adapter (which had none) the same
policy. `transient-retry.test.ts` pins the boundary in both directions.

## Federal Migratory Birds — The Blocker Was Wrong

**A stale blocker costs more than a stale gap (2026-09-23).** The registry
recorded federal district geometry as blocked: the only district dataset found
was Environment and Climate Change Canada's Québec layer, published as **Draft,
indicative only, no legal value**. That layer is still unusable and is not read.

But the blocker was wrong for most of the country, and nobody re-examines a
door marked closed.

**The Migratory Birds Regulations, 2022 (SOR/2022-105) carry Schedule 3**,
which s. 28(1) binds to directly — "a person must not hunt a species of
migratory game bird in an area referred to in Schedule 3 except during ... any
open season for that area and that species". Columns: Area, Species, Possession
Limit, Open Season, Daily Bag Limit. It is the binding text, not the annual
summary.

**And it defines most federal areas as named sets of provincial units North
Ground already holds parity-certified**, in the regulation's own words:

- British Columbia — "District No. 1 means Provincial Management Units 1-1 to 1-15."
- Alberta — "Zone No. 1 means Provincial Wildlife Management Units 200, 202 to 204, ..."
- Saskatchewan — "District No. 1 (North) means Provincial Wildlife Management Zones 43 and 47 to 76."
- Ontario, Québec — districts defined over provincial WMUs and Hunting Zones.
- Yukon — latitude bands, computable **exactly** from a point.
- Prince Edward Island — "Throughout Prince Edward Island", which is the
  jurisdiction-level geography landed the same morning. That model earned its
  place the day it shipped.

So the federal layer **composes with provincial geography by the regulation's
own construction**. It is not a parallel dataset to be sourced.

### What wave 1 encodes, and what it refuses

PE, YT and AB. 55 rows considered, **26 encoded** (3 of them declared
closures), **29 refused** into `notEncoded` with the regulation's own words:
residency-varying limits, seasons narrowed to a sub-list of units, bags that
change inside a window, and Table 2's overabundant-species regime. Encoding the
readable half of such a row would publish a limit right for some hunters and
wrong for others.

**Groups, never per-species limits.** Schedule 3 regulates "all Ducks,
combined", not mallard. Six a day is shared across seventeen library species; a
page printing "6" beside mallard tells a hunter they may take six mallards.
Every group carries the regulation's words, states whether it binds birds the
library does not publish, and is matched on **exact text** — "Ducks (other than
Harlequin Ducks)" and "Ducks (other than Harlequin Ducks, Common and
Red-breasted Mergansers, Long-tailed Ducks, Eiders and Scoters)" are different
groups with different limits, and a test asserts no normaliser can merge them.

**Harlequin Duck's "No open season" is CLOSED, not UNKNOWN** — a declared
closure is a fact from the authority, not an absence of one.

**The registry closes both ways**: 474 Schedule 3 rows across all of Canada, 32
groups, **zero unmatched cells and zero unused groups**, with the single
`[Repealed, SOR/2024-129]` row skipped rather than encoded.

**Alberta's unit references were checked against the certified inventory**:
every unit the regulation names exists, 177 of 179 fall in a federal zone, and
the two that fall in none (728, 730) answer UNKNOWN rather than being assumed.

**Saskatchewan — decided 2026-09-23 (moderator), so wave 2 does not re-litigate
it.** SK's federal districts name provincial zones ("Zones 43 and 47 to 76",
plus the named Saskatoon and Regina-Moose Jaw zones), but SK is a LIVE_SERVICE
layer by owner decision and holds no stored identifier list to check those
references against. The fix is a **live identifier check in the build**, not a
stored inventory: storing one would quietly reverse the live-service-only
decision and create a copy whose staleness nobody watches. At build time, ask
SK's own service for its zone identifiers, expand the federal references
against that answer, and record the retrieval with a hash like any other source
read. **If the service is unreachable at build time the build fails**, rather
than emitting unverified references — the same posture as every other source
check here.

**WIRED AND CERTIFIED 2026-09-23.** `FEDERAL_MIGRATORY_SERVING` is on: 24
migratory game birds are selectable and answerable nationally. 18 of 18
certification cases agree with the law, each written from Schedule 3 before any
of them ran. Zone lookup median 111 ms / p90 414 ms; evaluation median 140 ms /
p90 678 ms.

**Flipping the flag broke four invariants, and each encoded a real assumption
that had quietly stopped being true: that SELECTABLE species ARE provincially
certified species.** All four were strengthened rather than relaxed:

- **A selectable species with no engine falls through to small game and answers
  from the wrong bundle** — a grouse season for a mallard, which reads as a
  normal answer. An engine is now asked only about species its OWN bundle
  certifies. The hazard predates the federal work; migratory birds, selectable
  nationally while almost no province certifies them, are what made it
  reachable.
- Ontario's species lists are now a **partition**: every selectable species is
  provincially certified or a federal migratory bird, never both, never
  neither.
- A boundary-only layer claims no **provincial** rule. A federal season may
  still apply inside it, and that is composition working rather than the
  boundary-only claim leaking.
- A test used `species:mallard` as its example of "not certified". It silently
  stopped testing anything the day mallard became certified, so it now uses a
  species that is genuinely uncertified.

**Not yet wired into Hunt.** Migratory-bird queries still answer UNKNOWN until
this is certified in production. Saskatchewan is deferred because it is a
LIVE_SERVICE layer with no stored identifier list to check the regulation's
zone references against.

## The Wrong-Bundle Answer

**The worst failure mode this product has, found 2026-09-23. Recorded as a
CLASS, not a Canada note.**

A species that is SELECTABLE in a jurisdiction whose bundle does not certify it
fell through to that jurisdiction's SMALL GAME path and answered from the wrong
bundle. **A grouse season returned for a mallard** — not an error, not an
UNKNOWN: a normal-looking answer, with a season and a limit, for the wrong
animal.

Every honesty mechanism in Hunt assumes a wrong answer LOOKS UNCERTAIN. This
one looked right.

Fixed by asking an engine only about species its own bundle certifies, and by
restating Ontario's species lists as a **partition** — provincially certified
or federal migratory, never both and never neither — which makes the
fall-through *unrepresentable* rather than merely unreached.

Three things about it that generalise:

1. **The hazard predated the work that exposed it.** It would be reached by any
   species certified somewhere other than where it is offered, which is now the
   normal shape of expansion rather than an edge case.
2. **The existing test KNEW.** It described the fall-through precisely and was
   unreachable only because `SUPPORTED_SPECIES` and the provincial bundles
   happened to be the same list. **A safety property held by coincidence is not
   held.** The selectable-vs-answerable split was always going to break that
   coincidence, and it did.
3. **Running the full suite with the flag ON before landing is what caught
   it.** A flag flipped after the gate would have shipped it.

### Standard: a flag flip is gated with the flag ON

**Every future flag flip runs the whole suite in its ON state before landing,
and the flip lands only if that passes.** A feature built behind a flag is
tested in its OFF state by default, which proves nothing about the state it is
about to be put into. Four invariants broke when `FEDERAL_MIGRATORY_SERVING`
was flipped; all four were strengthened rather than relaxed, and one was this
defect.

### The build is part of the gate, not a formality after it

**Recorded as a gate finding, 2026-09-23.** An import prepended ABOVE a
`"use client"` directive passed `tsc` **and the entire test suite** — 834 tests
— and was caught only by `npm run build`. A directive that must be the first
statement in a file is invisible to every other check.

So the build is not a final rubber stamp on work the gate already approved: it
is the only thing that sees a whole class of defect. Run it before landing, not
after.

### A test that passes because its premise expired

The seventh form of measuring the wrong thing, and the quietest: nothing fails,
and coverage still reports the test as passing.

A test used `species:mallard` as its example of "not certified". It silently
stopped testing anything the day mallard became certified.

**The fix is not a better example — it is making a test ASSERT ITS OWN
PREMISE**, so expiry fails loudly with an instruction. `registry.test.ts` now
checks that `species:gray-wolf` is still uncertified before relying on it, and
fails with "this test needs a different uncertified example, not a passing
assertion". Proven by pointing it at a certified species and watching it fire.

Swept for siblings: `zone-jurisdiction.test.ts` uses `jurisdiction:ca-nt`,
whose premise is durable by owner decision (out of scope, no reusable
geography) and is annotated as such. `united-states/routing.test.ts` asserts
Montana's rules never answer because Montana is not served — the same shape,
in the U.S. agent's file, and reported to them rather than edited here.

## Provenance — Whose Words, Enforced By The Type

*Implemented 2026-09-29 (Codex, finished by the United States agent).*

**The invariant.** AUTHORITY-owned text must be the authority's actual wording and
must carry its provenance. NORTH_GROUND-owned text must be structurally
incapable of being rendered or serialized as an authority quotation merely
because it sits in a generic string field.

**Where it lives.** `src/lib/hunt/provenance.ts`. It GENERALISES `limitation.ts`'s
existing `owner: "AUTHORITY" | "NORTH_GROUND"` tag rather than introducing a
second vocabulary (§14):

- `AuthorityQuotation` — `owner`, `text`, and **mandatory** `sourceId`,
  `citation` and `lang`. There is no overload that omits them: a quotation
  without a source is a rumour, and a language that defaults mislabels
  Québec's French as English (§47).
- `NorthGroundStatement` — `owner` and `text`, and deliberately **no**
  `sourceId`. Giving it an optional one would let authored text drift back
  into an attributed position, which is the failure the type exists to prevent.
- `quoting()` / `authored()` are the only constructors; `isQuotation()` reads
  the tag and never infers from another field; `provenancedLine()` decides the
  quote marks from authorship, so no renderer types a quotation mark itself.

**Why a second field would not have been enough.** The defect was produced by a
convention held at six call sites. Six chances to get it right is not a
guarantee. `src/lib/hunt/provenance.test.ts` asserts the wrong construction
**does not compile**, using `@ts-expect-error`: TypeScript reports an unused
directive as an error and `npm test` runs `tsc --noEmit` first, so widening a
type to "make it easier" fails the gate. Both mechanisms were verified by
falsification — widening the renderer, and defaulting `lang`, each break the
build.

**Where the split reaches.** Overlay catalogue features (`CatalogueFeature`,
`OverlayFeature` — `statedAs` exists only on the authority branch), restriction
records, within-zone restrictions, gear-class definitions, the generated B.C.
closed-areas artifact, absence rules, disputes and amendment conflicts. The
zone-summary API payload carries only a pre-rendered `line`, so no ambiguous
field crosses the boundary at all.

**The lesson that cost three repeats: data + type + GENERATOR must move together.**
A converted JSON file survives until the next rebuild and then silently
reverts. It happened three times and each was found by regenerating, never by
reading:

1. Montana's 50 big-game-restricted features (one North Ground sentence) were
   converted in the catalogue but not in `build-us-mt-upland.mjs`.
2. Absence rules and disputes were typed but still emitted as bare strings by
   five generators.
3. Manitoba's and Québec's catalogue `lang` was set in JSON only.

Regeneration is now idempotent: every generator run twice produces no drift.

**Classification is decided by evidence, not by reading the prose.** An absence
sentence is the authority's where its generator verifies it verbatim against
the live instrument (`containsVerbatim`, `requireProvision` throw if the
wording moves) — British Columbia and Manitoba. It is North Ground's where it
is a hand-written constant — Alberta, Idaho, Montana. Disputes and amendment
conflicts are authored **by construction**: a dispute exists because North
Ground's cross-check found two readings, and an `AmendmentConflict` is COMPOSED
by joining sentences. A composition is authorship, not annotation.

**Québec's absence carries no `words`, deliberately.** It held a French ministry
sentence with no `sourceId` and no section. The type requires a citation, and
that refusal is the point: a quotation nobody can cite is not evidence, calling
it ours would be the opposite lie, and inventing a citation is forbidden. The
absence RULE is stated beside it in North Ground's own words (§8). Restoring
the quotation needs one thing — the page it appears on.

**Measured corpus, 2026-09-29:** 1,122 provenanced records — **522 AUTHORITY**
(0 missing `sourceId`/`citation`/`lang`, 0 naming North Ground) and **600
NORTH_GROUND** (0 carrying authority fields). 2,630 bare `statedAs` strings
remain and **0 of them name North Ground**. B.C. closed areas: 325
restrictions, 180 AUTHORITY / 145 NORTH_GROUND — the 145 being the known mixed
summaries, which can no longer be marked as quotations. Montana catalogue: 13
authority / 50 authored.

**Genuine remaining ambiguity, stated rather than closed.** The 2,630 bare
`statedAs` strings are authority-sourced and none launders our words today, but
most of their declarations still carry **no doc comment stating whose words they
hold** — `seasonPhrase` (verbatim, in each jurisdiction's own format and
language, the largest uncontracted quotation field), `officialSpec`,
`implementLabel` (whose contract, *"Quoted, never translated or reformatted"*,
is on only one of its two declarations). Giving each declaration a contract is
the remaining work; nothing in it is known to be misattributed.

## Agreeing With The Service Is Not Agreeing With The Law

Recorded once, in **Recent Product Decisions** under *2026-09-23 — Audit
answer: all twelve Canadian spatial certifications are service-only*. That
entry is the fuller one and carries the containment measurement too; a second
copy here would drift from it.

## Known Design Gap — Promotion Cannot Certify A Row It Did Not Insert

**Stated so it is not re-derived (2026-09-23).** `publish_zone_run` sets
`coverage_status = 'VERIFIED'` on INSERT and its `ON CONFLICT` branch
deliberately does **not** touch `coverage_status` — correctly, because
republishing geometry must never silently certify it. The consequence is that a
zone row created **outside** that function enters as `NEEDS_VERIFICATION` and
**no promotion path can ever lift it**. Republishing reports "1 updated" and
changes nothing that matters.

Prince Edward Island hit this because its row had to exist before its
derivatives could be built. Any future jurisdiction in the same position hits
the identical wall, and the symptom is severe and quiet: `zone_display_in_view`
returns only VERIFIED zones, so the map draws nothing while the coverage report
calls the jurisdiction certified.

It was closed for PEI by `20260923_certify_prince_edward_island_province`, a
one-row UPDATE scoped to that canonical id with its certification evidence in
the comment. **That is the symptom, not the fix.**

The missing capability — the same one the `publish_zone_run` coverage-argument
proposal already logged describes from the other side — is **a promotion path
that takes certification EVIDENCE as its input** rather than inferring status
from which function happened to insert the row. Not built; stated.

## Served Layers Must Actually Draw

`npm run certify:served-layers` → `fixtures/hunt/served-layers.json`, replayed
without a network by `src/lib/hunt/served-layers.test.ts`.

**Why it exists.** Three times the coverage report said VERIFIED while the map
showed nothing: Yukon (refused by a 400-row cap), Newfoundland's caribou areas
(unreachable behind a species gate), Prince Edward Island (certified, never
promoted).

**Why the old cross-check could not catch the third.** It compared a national
**sum** of official units against a national sum of drawn features. Prince
Edward Island contributes **zero** units — a jurisdiction-level geography has
none — and drew zero. Zero equalled zero, the sum balanced, and it would have
balanced at any moment it ran. The defect was the check's *shape*, not its
timing.

**The shape now.** Expectations are per layer and never satisfied by a balance:
a zone layer must draw its authority's own unit count; a jurisdiction-level
layer must draw exactly one area; **any serving layer drawing zero is a
failure, always.** Counts are read from the ingestion adapter, the U.S. adapter
table, or the layer's own certification fixture — never typed.

**It makes the class impossible, not merely detectable.** A layer switched to
`serving: true` without re-certifying fails the suite by name, and a layer left
in the record after it stops serving fails too. Both directions are tested by
deliberately corrupting the fixture.

Current state: **14 of 14 serving layers draw**, 13 against an exact count —
ON 151, MB 62, AB 189, QC 59, BC 225, NL moose 74 / caribou 19 / bear 7, NB 27,
PE 1, NS 12, YT 443, SK 83, ID 99.

## Corrections To Earlier Claims

### My aggregate about whose words a closure is got 12 of 23 wrong (2026-10-07)

`e016bdfd` renamed the bundle field `closureStatedAs` to `closureSummary` and
declared, in the type, that **every value in the corpus is North Ground's**. The
rename's direction was right: a field documented as "the authority's own words"
held a sentence naming North Ground in the third person, which is our prose
sitting in the authority-quotation path. The aggregate was wrong, and wrong in
the direction that strips an authority's provenance — the same defect pointed
the other way.

The moderator read the 23 values instead of accepting the aggregate and
questioned 10 occurrences. All 10 were the authority's, and so was a third
value I had not questioned either. Established per value against the reader in
each build script that asserts it against the source:

- **AUTHORITY (12).** Montana's "Closed to all hunting" (8) — `build-us-mt-upland.mjs:191` matches p. 10 as "Gates of the Mountains Game Preserve: Closed to all hunting:". Montana's "Closed West of the Continental Divide." (2) — `:111` and `:166` match p. 9 ending in exactly that sentence, and §41A says the authority's words ARE the fact where scope turns on wording, which is precisely what that sentence does. Wyoming's "Closed" (2) — `build-us-wy-elk.mjs:121` extracts the Chapter 7 cell with `/^(\d{1,3})\s+Closed$/`.
- **NORTH_GROUND (11).** Montana's reservation paragraph (8) names the Commission in the third person and says what North Ground does not evaluate; Iowa's carries our own citation inside the sentence; New Brunswick's "closed to antlered deer" compresses s. 11.1(1)'s "No person shall hunt antlered deer in wildlife management zone 4, 5 or 9"; Newfoundland's "no open season" describes an Order that names no season, so there is nothing to quote.

Fixed in `216eb3f8`: the field is `closureBasis?: ProvenancedText`, declared per
value, the page number moved out of the quotation into `citation` ("Closed to
all hunting (p. 10)." is not a sentence Montana prints), and the engine passes
the declaration through instead of wrapping it in `authored()`.
`LimitationLang` gained `en-US`, because tagging a Montana regulation `en-CA`
would state a locale the authority does not have.

**Two method lessons, both costly here.** A clean mechanical diff is not
evidence about what the strings ARE: 23 insertions and 23 deletions with every
value paired proved the rename was mechanical and said nothing about ownership.
And the reachability sweep could not have caught it — stripping Wyoming's Area
72 quotation of its source and citation broke no test, because that record is
real, shipped, and outside the four units per bundle the sweep drives. A
population check over every bundle catches it; a filter question did not.

### Four claims from the 2026-09-30 Species Heat entries (corrected the same day)

- **Manitoba's changed guide "needed nothing".** Wrong in the unsafe direction:
  page 14 is the province warning that sunrise and sunset data may not reflect
  its move to permanent daylight time, and Hunt's Manitoba clock was an hour
  early until main's `observed-clock.ts` (`eb49c7a`). The review entry now says
  so.
- **"Recorded-presence grids" as a shipped surface.** They were built and then
  withdrawn before landing: a grid of record squares drew where people report
  animals, not where animals are. What ships instead is range + habitat, where
  records only decide the range and never set a value.
- **Survey movement.** 65 of the 72 breeding-survey surfaces called their bird
  MIGRATORY by default, including quails, grouse, pigeons and sparrows whose own
  published profiles say "permanent resident". Movement is now declared once,
  quoting that text, in `content/intelligence/seasonal-movement.json`.
- **"Range from GBIF's 0.35° squares (about 39 km)".** Wrong by a factor of
  sixteen in area. GBIF's ad-hoc map aggregates 16 × 16 cells per tile whatever
  square size is asked for, and every read was a zoom-3 (22.5°) tile, so each
  0.35° square stood for a 1.40625° cell. The evidence: across every species
  read, no 1.40625° cell ever held two squares, and house sparrow's 14.8
  million records came back as 763 squares. Ranges were drawn from a sixteenth
  of the ground their records covered, in bands with gaps between them
  (mallard's prairie bars, the alligator's discs). Found by looking at the
  surfaces, before any of it reached main. The builder now uses each square at
  the size of the cell it stands for and states that size; the fetcher reads a
  coarse zoom-3 pass and a fine zoom-5 pass, whose cells are the 0.35° the
  first reads were taken for.

### Québec antlerless moose was already guarded (corrected 2026-09-23)

A finding relayed to the owner said Québec's antlerless-moose rows were
unconstrained and that "correctness rests on the rows happening to match —
nothing would stop a future ingest reintroducing an unpermitted grant."

**That was wrong, and it was flattering to the finding, which is the kind that
spreads.** `crossCheckMoose` (`scripts/build-quebec-regulations.mjs:609`,
called at `:767`) already asserts the antlerless designation sets per implement
section and per year, then re-verifies that the MFFP prose it was written from
still says what it said. The committed bundle satisfies it exactly:

    bow 2026: 13, 19, 29        bow 2027: 13, 18, 19, 28, 29
    gun 2026:     19, 29        gun 2027: 13, 18, 19, 28, 29

Zone 13 is **absent** from gun-2026. That is r. 12 art. 17 3° already enforced
in the data: in 2026 zone 13 antlerless is permitted only during an « engin de
type 11 » period, and the bundle grants it only on the bow/crossbow rows.

The guard has now been fired rather than only read. A live read with
`--save-pages` (186 rules, hash matching the committed bundle) gave a passing
control at exit 0; perturbing the gun-2026 expectation to claim zone 13 exits 1
with *"prose says 13,19,29, tables say 19,29"*, and perturbing one expected
prose string exits 1 too. **The control is what makes the failures mean
anything** — without it a throw could have been the offline mode. `--out`
protects production: `:889` writes the certified-units file only when the
output path is the committed one.

Two things that were real, and remain open. The citation first relayed named
the *Loi* (C-61.1); art. 17 is in the *Règlement* (C-61.1, r. 12), and the
Act's art. 17 concerns seizure reports — a wrong citation attached to a true
finding discredits it. And the guard is anchored to **MFFP's summary prose, not
to the regulation**, so if the ministry's summary were rewritten the build would
follow it; anchoring the same expectation to art. 17 gives a second anchor that
cannot drift with the first. That anchor is blocked (see Blocked).

The zone 13 / 13SO 2026 row is **certified, not NEEDS_VERIFICATION**: annexe
III lists zone 13 under type 11 for "du samedi le ou le plus près du 27
septembre au dimanche le ou le plus près du 5 octobre", which resolves for 2026
to 26 September – 4 October, exactly the rule's window. It remains
**unevidenced in the data** until gear classes are populated — a different
repair from being wrong.

### A green suite did not prove types (fixed 2026-09-23)

`npm test` runs the suites through Node's TypeScript type-stripping, which
**erases** types rather than checking them. A test calling
`zoneCoverage(layer)` — which takes two arguments — ran and PASSED; `tsc`
caught it. Every "tests green" reported from a local run was therefore a weaker
claim than it read as.

CI was never exposed: `.github/workflows/ci.yml` runs `npm run typecheck`
before `npm test` in the same job, so a type error already failed the build.
The gap was local only.

`npm test` now runs `npm run typecheck` first. Typecheck is 1–2 s against a
14 s suite, so the cost is immaterial, and a local green now means what people
read it as. Proven by introducing a deliberate type error the runtime cannot
see and watching `npm test` fail on it.

It paid for itself within the hour: it caught two real errors in newly written
British Columbia tests — a property that does not exist on a typed bundle, and
a possibly-null unit count — both of which the runtime would have passed.

### Cases written from the law protect against the implementer, not only the code

**An argument for the practice, not an anecdote (2026-09-23).** Certifying
British Columbia, I evaluated the disputed spring black bear window on
2026-06-25, got `NEEDS_VERIFICATION`, and briefly read it as a defect. It was
correct: the bundle is certified for 2026-07-01 to 2027-06-30, so June **2026**
is before the certified period and the dispute is never reached. The case file,
written from the regulation before any code ran, already carried the right date
(2027-06-25).

So the cases did not only check the engine. **They checked the person checking
the engine.** An implementer's assumptions are written *after* they have been
reasoning about the implementation; cases written from the law are written
before that reasoning exists, which is exactly what makes them able to catch
it. That is a reason to keep writing them first that has nothing to do with the
code being wrong.

### An authority's words attach only to what the authority described

**A rule, from three instances in one day (2026-09-23).** Marking something as
an authority's words is an attribution, and an attribution to a government is a
claim. It may only be attached to the thing that authority actually described.

1. **The map-standing line.** "Québec's hunting-zone boundaries are the
   ministry's map, which states « … n'a aucune portée légale … ». Near a
   boundary, confirm which zone you are in." Marking the whole line AUTHORITY
   would attribute *North Ground's* caution to a ministry that never issued it.
   It stays GENERAL; only the wholly-French page statements are SOURCE_DETAIL.
2. **`season.label`.** The authority's name for a season segment is carried
   ONLY where every rule behind that season agrees on it. Where they differ,
   the season is a combination the ministry never named, and picking one of
   their labels would attribute a name to a ministry that did not write it.
3. **Splitting a mixed line** into an attributed quotation plus North Ground's
   own sentence is **authorship, not annotation**. It is a deliberate editorial
   act by whoever owns that jurisdiction's voice, never a side effect of a
   shape migration.

**The symmetric failure to §8's.** There we must not assert a prohibition
nobody legislated; here we must not assert a *caution nobody issued*. Both put
words in a government's mouth, and the second is quieter because it looks like
caution.

**And a related trap, found in the same pass:** Québec already HELD the
ministry's full segment name and was SHORTENING it into a display label. The
authority's words were being destroyed at the point of display — upstream of
anywhere a person would look for them, and invisible because the short form
read perfectly well.

### Stop calling it a conflict, rather than describe the conflict better

**From the overlap exchange with the U.S. agent, 2026-09-23.** Newfoundland's
moose, caribou and black bear areas stack over the same ground. That LOOKED
like a conflict and was not one — the province publishes those layers over each
other deliberately. The fix was not to name the overlapping zones better; it
was to stop calling it a conflict at all (`isLocationLayer` removes
species-scoped layers from the location-only question).

The principle generalises, and it is the reasoning behind Michigan's design
too: **before improving how a conflict is reported, check whether it is a
conflict.** Three situations look identical at a point and are not:

1. **One authority's layers stacking by design** — not a conflict. Answer from
   the location layer.
2. **Two authorities both claiming a point** (Québec 19N and Newfoundland's
   moose area 050 in Labrador) — a real conflict, named, never resolved by
   preferring whoever answered.
3. **One authority's service returning several of its own features** — a real
   ambiguity within one source.

A fourth, which Michigan forces: **units that nest by design**, where a point
is in three at once and all three apply. That is not a conflict either, and a
flat list of "conflicting" ids cannot express it. Letting the ABSENCE of a
precedence rule push nesting into the conflict bucket would report a defect
where the authority intends a hierarchy. UNKNOWN is for what North Ground does
not know; nesting the authority publishes on purpose is something it does know.

Note the limit of North Ground's own mechanism, which the U.S. agent caught:
Michigan's nesting is WITHIN ONE LAYER — 115 units in one service with no field
distinguishing county from CWD-core from urban — so there is nothing for
`isLocationLayer` to filter on. The Newfoundland mechanism does not transfer,
and the containment state is being designed as a shared concept instead.

### Why cross-review found a clause the author would not have written

**On the viewport contract (2026-09-23).** Hunt overhaul found the `whole`
invariant — see above — which the contract's own author had not written. The
reason is worth keeping, because it is the argument for routing shared
contracts through review rather than trusting the author:

> I was reasoning about what the request ASKS FOR, and they were reasoning
> about what the answer ASSERTS.

Not more care. A different question.

### True by construction is not a property

**A general form worth keeping (2026-09-23, from the viewport contract).** When
a request's shape changes, **every value that was true because of the OLD shape
is suspect.** "True by construction" is not a property of the value; it is a
coincidence of the design that produced it.

The instance that named it: the geometry store marks every level-0 piece
`whole`, which is correct only because level 0 *was* the whole served extent.
Make level 0 a viewport and a piece can be clipped — and a clipped drawing
treated as a zone's full extent lets the camera frame a zone by a boundary that
is only the edge of a request box. A map asserting a boundary it was never
given, looking entirely normal on screen. Nothing about it looks wrong, which
is exactly why it is the dangerous kind.

### Measured the wrong thing — the collected forms

Every one of these produced a **number, and the number was real**. What was
wrong was what it was a number **about**. Collected because the class keeps
recurring in new disguises.

1. **Source geometry, not the drawing.** New Brunswick's payload reported at
   150.9 KB; the level-1 drawing the map ships is 2.3 KB. Nearly triggered an
   unneeded tiling project.
2. **A stale server.** A performance run measured a build with no British
   Columbia layer. Caught only because the overview returned four layers.
3. **A configuration that was not the product (2026-09-23).** A probe run
   without `.env.local` made the Supabase client throw, so stored-geometry
   layers silently fell back to live services and the Maritimes box reported
   **0 features**. With credentials: 46. There was no defect.
4. **A truncated page read as a complete set (2026-09-23).** An audit of
   `coverage_status` returned `ca-yt VERIFIED 174` against a certified 443 —
   one step from reporting Yukon as a production defect an order of magnitude
   worse than the real one. The query had returned exactly **1000** rows:
   PostgREST's default cap. Re-queried with exact counts, Yukon is 443/443.
   **The tell was the total being exactly a round number equal to a known
   limit.** Note what this is: the *same failure mode* as the Yukon 400-row cap
   that started the served-but-not-drawn class, arriving this time in the
   diagnostic rather than in the product.
5. **A harness that asks a different question than the product (2026-09-23).**
   The first run of `certify-served-layers.mjs` reported four FAILs against
   working code: it asked at a zoom the map never requests (Yukon's whole layer
   refused) and without a species (Newfoundland's caribou and bear areas
   absent). All four were the harness.

6. **Searched for a WORD when the thing is a STRUCTURE (2026-09-23).** Asked
   to confirm British Columbia's two cross-check disputes survived, a text
   search of the bundle for `CONFLICT` returned **zero** and nearly had them
   reported as resolved away. They were all there — modelled as a `disputes[]`
   array per rule, which is the better design, and as a *status* word they
   never appear. The search was real; what it searched was wrong. **Check the
   schema before searching for a word.**
7. **A test that passes vacuously.** A green that is a number about nothing.
   `boundary-only-layers.test.ts` guards against it by asserting up front that
   at least one boundary-only layer exists, and failing with "this file needs
   deleting, not passing" when the last one is promoted.
8. **A cached FILE read as a cached DOCUMENT (2026-09-23).** The relative-date
   certification reported every British Columbia and Ontario window as
   disagreeing with the authority — 0/6 and 0/5 — and the dates were correct.
   An earlier fetch of a wrong URL had left Canada.ca's **404 page** at the two
   cache paths the script reads, and because the files *existed* it read them.
   The script now requires the page to BE a summary, for the declared season,
   before believing it, and never caches a non-200. **A cached file is not a
   cached document.** Note what this form does that the others do not: a broken
   verifier does not fail safe — without the check we would have shipped 24
   correct windows unverified, and with a naive one we would have gone hunting
   a parser bug that did not exist. **It sends you to fix the wrong thing.**
9. **A count of what was ENCODED, not of what can be ANSWERED (2026-09-23).**
   The federal build reported 194 rules; 67 of them — over a third — named an
   area the bundle does not contain. Conjunctions stored whole ("Districts C
   and D"), and rows for districts whose definitions the same build had
   refused. **No hunter ever saw anything false** — an unmatched area already
   answers UNKNOWN — so this one is invisible from the product side entirely.
   It is the inverse of every other form here: not a wrong answer, a wrong
   account of what we can answer. It is the same family as the coverage-report
   false negative the American agent found: **reports about capability**, which
   nothing else in the gate looks at. Real count 145, pinned by a test asserting
   zero rules name an underived area, so it cannot drift back.

   Reconciling the two numbers, because they do not subtract cleanly: of the 67,
   **54 were removed outright** (rows for districts whose definitions were
   refused — they are refusals now) and **13 were recovered as 18 rules** (8
   Québec rows for "Districts C and D" now encode for District C; 5 Saskatchewan
   rows naming both districts in one cell now encode for each). 194 − 67 + 18 =
   145.

**Rule: a round number that exactly equals a known limit is a truncation until
proven otherwise.** And before reporting a defect from a measurement, confirm
the harness asked the question the product answers.

### A count that moves because the classifier reordered is not a count that moved

*2026-09-23.* Refusal buckets are now something work is prioritised from — 53 of
84 refusals being one thing is what identified relative dates as a missing
capability rather than a pile of oddities. That makes bucket arithmetic
load-bearing, and it has a trap.

The federal area check runs BEFORE the residency and window checks, so when it
was added, rows refused for those reasons that ALSO named a refused district
moved into the area bucket. Across that one commit "the limit or season varies
by residency" read 23 → 15 and "the season is not a plain calendar window" read
27 → 22. **Those rows did not become readable.** They were reclassified to the
first reason that applies, and anyone comparing the two commits would read an
improvement that did not happen.

A bucket's size is comparable only against itself **under an unchanged
classifier**. When the order changes, say so beside the numbers. Full statement
in `docs/contracts/relative-season-dates.md`.

### A refusal can rest on a reason that is about to stop being true

*2026-09-23.* One level up from the test whose premise expired, and the same
shape.

Fifty-seven federal rows were refused because their seasons were written as
relative dates. Among them were rows that ALSO carry a qualifier — "(only on
farmland)", "(only in Provincial Management Units 1-3 and 1-8 to 1-15)", ",
for Ducks other than Eiders". Those rows were being refused for their
unreadable **dates**, not for their **qualifiers**.

Teaching the build to compute relative dates therefore removed a shield nobody
had noticed was load-bearing. The dates became readable; nothing about who the
seasons apply to changed; and rows whose scope North Ground still cannot honour
became encodable. A window now splits at its first `" to "` and both halves
must parse whole, so a qualifier refuses the season, with a test pinning eight
specific rows as refused.

**Before adding a capability, ask what was being refused only because that
capability was missing.** The failure mode is silent in both directions: the
refusal looked principled, and the new encoding would have looked like
progress.

### A refusal whose stated reason restates its own trigger

*2026-09-23.* The sibling of conservatism-has-a-failure-mode, and harder to see,
because it survives review by looking like two independent safeguards.

British Columbia answered UNKNOWN for a species in four Management Units, and a
test defended it: *"a certified species in an UNCERTIFIED unit still answers
UNKNOWN."* That reads as a second, independent reason to withhold an answer —
the unit is not certified, so say nothing.

It is not independent. `certifiedDesignations` is documented as **"designations
with at least one certified rule"**, so those units are uncertified *because* no
row names them. "We will not say closed because the unit is uncertified" and
"the unit is uncertified because it has no rules" are **the same fact twice**,
and withholding the authority's own statement on that basis is the refusal
citing itself as its own justification.

**The tell is that the reason and the trigger are the same observation in
different vocabulary.** Ask what would have to be true for the safeguard to
fire while the trigger did not — if nothing could, it is one safeguard doubled,
and the second copy is buying nothing while costing a real answer.

Here it cost 391 species × unit pairs a certified CLOSED.

### Conservatism has a failure mode, and it does not announce itself

*2026-09-23.* Québec writes one season for "Districts C and D". District C is
derived; D was refused. The first fix refused both, reasoning that encoding
half was a quieter error than encoding none.

That was wrong, and worth recording because it was wrong in the direction this
project usually rewards. There was no guess to refuse: the season the
regulation states for both districts is correct in C, and a point in D cannot
resolve to D in the first place. Refusing C discarded eight real rules to
protect against nothing.

**Conservatism has a failure mode too, and it isn't free — it just doesn't
announce itself, because a refusal always looks defensible.**

This is the counterweight to everything else built this week. All of that
machinery exists to stop false certainty, and every piece of it can be
over-applied at a cost nobody will ever report: a wrongly-refused rule produces
an UNKNOWN indistinguishable from an honest one. It is the same principle as
the stricter-than-source rule, read from the other end — **a restriction
stricter than the source is false, and a refusal stricter than the evidence is
a loss.** "Refuse rather than guess" applies where there is a guess.

- **The ESRI-orientation fix was NOT what fixed New Brunswick's holes
  (2026-09-23).** Both facts belong together: the orientation change was
  approved and applied, and it did not resolve the failures. The real cause was
  zero-area 3–4-point holes below the sampling tolerance, now recorded as
  untestable rather than as agreement.
- **A level-1 drawing is not its source geometry.** New Brunswick's payload was
  reported at 150.9 KB from measuring the source geometry; the drawing the map
  actually ships is **2.3 KB**. That nearly triggered an unneeded tiling
  project. Related lesson from the same area: approximating geometry while
  omitting per-feature label metadata moved a payload 2.3 → 4.2 KB — **zone
  count costs, not vertex count.**

## Saskatchewan's Permanent CST Is A 2026 Coincidence (2026-10-01)

For whoever builds `saskatchewan-legal-time.ts`, because the obvious premise is
wrong for any date before November 2026.

Saskatchewan looks like the easiest legal-hours jurisdiction left: single zone,
Central Standard year-round, and its own regulation declares the basis (The Open
Seasons Game Regulations, 2009, s. 3(b)). **The year-round part is not a property
of Saskatchewan.** Until 2026 the City of Lloydminster and the surrounding area
observed Mountain Standard Time (UTC−7) from November to March to stay aligned
with Alberta — the §41A Atikokan problem, in Saskatchewan, for the whole late
season. It ended only because **Alberta** moved to UTC−6 year-round, so there was
nothing left to align with. The Time Act, 2026 expressly allows time option areas
to be established in regulation for border communities, defined by a neighbouring
jurisdiction's observed time, and the province's own page says there are
currently none.

So the module must read the time basis as **data for the date asked**, not as a
constant. §41A already requires a date to be evaluated under the rule applicable
to that date; a module built on "permanent CST" is right for 2026-27 and silently
wrong for a 2025 late-season date near Lloydminster, in the direction that
produces a plausible window an hour out with no error anywhere.

Both directions of the error were made and both are recorded:

- A standing limitation said legal times are CST "except that the Lloydminster
  area observes Alberta time", which told a Lloydminster hunter their clock
  differed from the law when it no longer does — the understating direction §8
  names, and a hunter wrongly warned about a conversion simply distrusts a
  correct window (fixed in `f1dab89`).
- A condition-kinds reason asserted "permanent Central Standard Time" as
  structural, which would have been load-bearing for the module (removed in
  `0069fe6`).

Verified on the province's own Saskatchewan Time System page and Alberta's new
time system page, 2026-10-01.

## Validation

- **Non-resolved outcome causes, 2026-10-07, api-v1 at `a4419bb7` rebased onto
  main `f250bda1`.** `npm test` exit 0 — **2,472 passing, 0 failing, eighteen
  `# fail 0` lines, 0 `not ok`**; tsc clean; lint 0 errors (33 warnings, none in
  the changed files); production build exit 0. Measured on the REBASED tree, not
  the base the work was written on: that base gated at 2,445, and quoting it
  would have reported a number four geography commits out of date.

  Falsified along the way, each by measurement rather than review: the first
  CLOSED sweep reported 0 missing causes while 648 answers had none (it drove no
  hunter answers, and the hunt-code site needs one); the first unresolved sweep
  reached no CONFLICT at all (the corpus's only one needs two answers at once);
  three of the first eight mutations silently patched dead code and were re-run
  at a verified location; two of my own assertions were wrong, one failing on the
  §8 disclaimer it was written to protect; and the claim that four bundles
  rendered an empty absence slot was refuted by their own absence meaning being
  UNKNOWN, so the guard added for it changes no answer and says so.

- **Species Heat 2.4.0, 2026-10-08, main at `5607f0f`.** `npm test` exit 0 in a
  clean worktree of main — 2,416 passing, 0 failing, eighteen `# fail 0` lines;
  tsc clean; lint 0 errors (31 warnings, none new in the changed files);
  production build exit 0 (run from the main checkout: Turbopack refuses a
  symlinked `node_modules`); `check:bbs-surfaces` and the range-habitat
  builder's `--check` pass. Falsified: the stray-jurisdiction test failed against
  the first 2.4.0 build (king eider painted at 26.55°N 80.05°W from squares
  centred offshore). **Production** (GitHub runner, `certify-browser.yml`, run
  37706843052, Vercel deployment of `5607f0f`): species surface certification
  **1,558 / 1,558** at **390 × 844, 1280 × 800 and 1920 × 1080** — every species
  and season at 1280, the twelve regions and the map interactions at all three
  sizes; FULLY_PRODUCTION_REACHABLE **230 / 230**. Hunt app certification
  **425 / 425** (two scenarios skipped by flag: the 60 s self-heal and the Hunt
  Brief). The three Hunt app failures of 2026-10-07 are closed: two were stale
  checks, and Québec's French prose carried doubled « » marks and an area name
  inside the ministry's quotation (fixed in `6aab043`); the Natashquan
  legal-hours check now waits for the point's own answer rather than the zone
  card's status. **Main's CI is red independently of this work**: every
  completed CI run on main since `6e6099e` (before these commits) concluded
  failure; at `02a0619` the runner's `test:hunt` failed 4 of 1,652 tests that
  all pass in a clean local worktree of the same commit (names not yet read —
  the job log is only reachable here by its tail). "Regulatory bundles match
  their builders" fails at `2752893` because Ontario's live licence-vendor
  dataset has changed (an address and a vendor type) — a source change for
  review in the regulatory lane, not refreshed here unreviewed.

- **Species Heat, 2026-10-07, main at `a8fb344`.** `npm test` exit 0 —
  2,358 passing, 0 failing, seventeen `# fail 0` lines (the whole `&&` chain);
  tsc clean; lint 0 errors (29 pre-existing warnings); production build exit 0;
  `validate:seo`, `validate:content:published`, `validate:us-coverage`,
  `check:bbs-surfaces` and the range-habitat builder's `--check` pass.
  `check:intelligence-sources` fails only on a live fetch this container's
  egress proxy refuses (Ontario harvest source, HTTP 403), unrelated to the
  change. Falsified: the visible-view tests fail with `surfaceInView` made a
  no-op; the Adak test fails against the 2.2.0 artifact.
  **Production** (GitHub runner, `certify-browser.yml`, run 37624741021,
  Vercel deployment of `a8fb344`): species surface certification 1,502 / 1,502
  — every species and season, the twelve regions (Atlantic, Québec/Ontario,
  Prairies, Rockies, Pacific coast, Alaska, the Aleutians across 180°, the Near
  Islands east of 180°, Arctic, Hawaiʻi, Southwest, Southeast), pan, zoom, the
  October → June date change, the shared link that misses its map, Show where,
  and the zone card's Animal and Method filters, on phone and desktop;
  FULLY_PRODUCTION_REACHABLE 230 / 230. Hunt app certification 420 / 423, the
  same three failures as before this work (legal-hours display and Québec's
  French prose at 320 px), outside heat.

- **Species authority universalization, 2026-10-06 (species lane).** `npm test`
  exit 0 — **every one of the 17 `# fail 0` lines zero and no `not ok`**, which
  is the claim that matters: `npm test` is an `&&` chain that stops at the first
  failing step, so a count of steps is what distinguishes a full run from an
  early exit. tsc clean; lint exit 0 (29 pre-existing warnings, none in the
  changed files); production build exit 0. Output-file tracing unchanged at 236
  traced files for the species route, 0 media or `public/` entries in it or in
  Hunt's. §29 measured on the SERVER response text of all 485 pages before and
  after the renderer change: 484/485 direct answers, 485/485 exactly one `h1`,
  485/485 JSON-LD — identical on both sides (the exception is white-tailed deer,
  whose authored page carries its own answer). Four gates were falsified by
  mutating a real value and running the whole suite: carrying one group instead
  of all, dropping `statuses` from an evidence row, removing the Species Heat
  capability gate, and restoring the section-split order each turn the suite
  red, and reverting each turns it green.

- **Cross-surface opportunity convergence, 2026-10-06 (Hunt UX lane), `a0aa7b7e`.**
  `npm test` exit 0 — **2,259 passing, 0 failing, and FIFTEEN `# fail 0` lines**,
  which is the claim that matters: `npm test` is an `&&` chain that stops at the
  first failing step, so a count of steps is what distinguishes a full run from
  an early exit. tsc clean; lint exit 0 (29 pre-existing warnings, none in these
  files); production build exit 0.

  **Counterfactual, whole suite, defect live.** With the Ontario wiring reverted
  and the new guard present: `npm test` exits 1 having reported only **3** steps,
  **1,592 passing and exactly ONE failure** — the new guard. *Every pre-existing
  test passed with the defect live*, which is the evidence that the guard is not
  redundant rather than the claim that it is.

  **Browser-verified against real Ontario data**, which is where this defect was
  visible to a hunter and nowhere else. WMU 57, white-tailed deer, 2026-10-15
  renders two opportunity cards — "Open on this date": Antlered, Bow and
  Crossbow, 2026-10-01 to 11-01 and 11-16 to 12-15; "Opens later": Antlered,
  Rifle, Shotgun, Muzzleloader, Bow and Crossbow, 11-02 to 11-15 — each with its
  3 conditions, and a live Method filter. The archery season beside the gun
  season is the exact distinction §8 requires and the one Ontario could not draw
  before. The live API for that unit carries rows for deer (4), moose (2), bear
  (2) and turkey (1, closed and carrying its season); the four small-game species
  carry none, as recorded.

- **Species images, 2026-10-01 evening, branch `species-images` rebased on `origin/main`.**
  `npm test` exit 0 (2,190 pass, 0 fail); `npm run lint` 0 errors; `npm run build`
  exit 0; `validate:seo` passed on port 3221; `git diff --check` clean. The
  manifest reconciles: 485 rows, 269 shown, 216 placeholder.
- **Main green again, 2026-10-01 (moderator), `origin/main` at `83145d4`.**
  - `npm test` exit 0, zero failures, run four times: once on `6fc5e75` to
    establish the failure, then once per landing.
  - Main had been RED since `a804ec0` on
    `range-habitat.test.ts` — "214 of 218 surfaces stale" — which blocked every
    lane's gate, because a baseline of known failures is not a gate.
  - **The surfaces were never wrong; the check was.** All 217 committed
    artifacts decode BYTE-IDENTICAL to a fresh build. Only the deflate stream
    differed: Abert's squirrel is committed as 2,377 bytes and no level 0-9 of
    this machine's zlib 1.2.12 reproduces it, its best being 2,408, so the
    authoring machine's zlib compresses better. `--check` byte-compared
    `cellsEncoded.data`, which is a property of the zlib build and not of the
    data, so it tested the compressor and would have had somebody regenerate
    215 files whose content was unchanged and whose diff is opaque base64 —
    unreviewable, and indistinguishable from real work. Fixed in `7da6e0d`:
    equality is of the decoded cells plus every other byte, write mode leaves an
    unchanged surface alone, and `artifactHash` stays a hash of the file as
    committed because `surface.ts` verifies it against the bytes it loads and
    the production-verification records are keyed by it.
  - Landed in order: `7da6e0d` (the check), `0e21dcc`+`1c59569` (Newfoundland
    black bear area 200 is Labrador, not an area the Order creates),
    `dfc516b` (`next dev`'s agent block goes to AGENTS.md, not CLAUDE.md),
    `7e2e058`+`3dcec54` (three dimensions that read 0% while shipping, plus the
    readiness CSV that moved with them), `83145d4` (the control that commit was
    missing).
  - **Carried forward, understating:** `hoursResolvable` in
    `research/hunting/species-jurisdiction-coverage.csv` is still the per-rule
    `resolves(..., "LEGAL_HOURS")`, now deliberately false for every rule, so
    the column reads UNRESOLVED everywhere while `legalHoursDelivery()` reports
    a window delivered for 453 of 466 big-game rules. §8 counts understating a
    capability as a false claim; the column wants to become a delivery level.
  - **Known gap:** `npx next dev -p <port>` skips `predev`, so a lane running
    its own port still exposes CLAUDE.md to Next's generator.

- **Every species has a map, 2026-09-30 (Species Heat lane), branch
  `claude/amazing-archimedes-b4ngh2` merged with `origin/main` at `ded8103`.**
  - `npm test` exit 0: **2,094 passing, 0 failing** across every suite,
    typecheck included.
  - `test:timezones`: 7 × 95, 0 failing.
  - Lint: 0 errors. The warnings are pre-existing; the one in this lane's code
    was removed.
  - `npm run build`: exit 0.
  - `validate:seo`: passed on the fresh build. It had failed on a stale
    `.next` that served 137 species pages against 489.
  - `validate:content:published`: 0 errors.
  - `check:bbs-surfaces`: 72 valid.
  - `validate:us-coverage`: exit 0.
  - `check-hydration`: 8 pages in 3 browser time zones.
  - `build-range-habitat-surfaces --check`: current.
  - `certify-species-surface.mjs` against the local production build: 14 of 20.
    Every surface check passed. The 6 failures are the geocoder and the
    Supabase-backed zone cards, conditions and Alberta unit evidence, which
    need services this container has no credentials or network for; the
    runner covers them against production.
  - Continental surface replies are 230–350 KB raw, and 37 KB gzip for
    white-tailed deer. Vercel compresses JSON in production.

- **Opportunity rows, 2026-09-30 (Hunt UX lane), branch `opportunity-ux` tip
  `885ef14` on current `origin/main`.** `npm test` exit 0 — **2,005 passing, 0
  failing** (the aggregate across every suite, not one run's tail); lint exit 0
  (0 errors, 16 pre-existing warnings); production build exit 0. Component
  tests run under a new `test:hunt-components` script inside the aggregate
  `test`, so the gate covers rendering as well as domain logic.

  **Both swap behaviours were falsified rather than merely asserted**: breaking
  the rows path fails 1 test, rendering both the rows and the sentence fails 3.
  A test that passes when the thing it guards is deleted guards nothing, and
  this lane has shipped two of those.

  **End to end against the running app, not fixtures.** All ten of Québec zone
  10O's species return opportunities through `/api/hunt/...`, and arctic hare
  comes back `NOT_APPLICABLE` for animal class — the species dimension profile
  deciding absence on real certified data.

  **Verified in a browser, and it earned its keep.** The first attempt failed
  and the reason recorded here was WRONG: it was read as "this container cannot
  reach the authority's GIS service" when the actual cause was that an isolated
  `git worktree` has no `.env.local`, so the app had no Supabase credentials.
  Copying the shared checkout's env in fixed it immediately — the same class of
  mistake as gating without `npm ci`. Worth keeping, because "the network is
  blocked" is an unfalsifiable-sounding excuse that would have shipped two
  defects.

  With credentials, Québec Zone 10 West / white-tailed deer / 2026-10-05 renders
  four opportunity cards from certified rules, each carrying both its 2026 and
  2027 windows, and choosing Rifle narrows four to two with the October
  archery-only season dropping — affirmative filtering on real data.
  `RefererNotAllowedMapError` means the Maps key does not authorise
  `localhost:3187`, so no basemap loads; official boundaries still draw and the
  app says so, which is the §41A behaviour.

  **The browser found two defects that 2,005 tests, lint and build had all
  passed over** — a compound class token rendered raw in the filter, and both
  filters disabled in the live app. Details in *In Progress*. Re-gated after the
  fixes: `npm test` exit 0, **2,007 passing, 0 failing**; lint 0 errors; build
  exit 0.

- **Species readiness and group resolution, 2026-09-30 (species lane).** On
  the rebased tree (main `50b7de4` + this commit): `npm test` exit 0 — **1,959
  passing, 0 failing**; lint 0 errors; production build clean; `validate:seo`
  pass (run on port 3291: another session's dev server holds 3217 and answers
  for it); content contract `--strict` over **all 12 published bundles** 0
  errors (the script previously listed six, so waves 3/4 and take evidence had
  never been validated — it found 318 invalid source ids); `validate.py` 0
  warnings; `git diff --check` clean. Production verification is of the
  deployment before this commit; re-run `npm run species:verify-production`
  after it deploys.

- **Species Heat, 2026-09-30, deployed `1059d02` (`dpl_AUoMqG7AacPZUWJ3CjRHXwpkuu2p`, READY; canonical host confirmed serving it).**
  Local: `npm test` exit 0 — **1,689 passing, 0 failing** across 14 suites
  (18 in the new `surface-independence.test.ts`); `test:timezones` pass; lint 0
  errors (10 warnings, down from 1 error + 11 on `heat-legible` as found);
  typecheck clean; production build clean; `validate:seo`, content contract
  (published and fixture), `check:bbs-surfaces`, `validate:us-coverage` pass;
  `git diff --check` clean; hydration 8 pages × 3 browser time zones against a
  UTC server pass. The three live-source checks cannot reach their hosts from
  this container (403); run from a network-enabled Vercel Sandbox:
  `check:intelligence-sources` pass, `check:ews-source` pass ("unchanged: 332
  plots, 36 bundles"), `check:regulatory-sources` stops on Manitoba's changed
  2026 guide (see Known Problems — upstream, untouched).
  Browser, production: `certify-species-surface.mjs` **30/30** (390×844 and
  1280×800, 4× CPU throttle): grouse requested 200 and painted, tap GHA 3A →
  ruffed-grouse card → close keeps species, explore, date and surface; turkey
  replaces grouse with no leak; mallard draws SAMPLE_PLOT + MODELLED_RASTER;
  moose clears the heat and says "no fine-grained evidence held"; `!` markers
  focusable. All 25 BBS species opened from their links: **25/25** requested 200
  and painted. Search Maniwaki → card → close → regional view: surface painted,
  53 green zones, 22 `!` markers, no extra surface request.
  `certify-hunt-app.mjs` against production: **418 passed, 3 failed**, and
  all three fail identically on the `23ed04d` deployment — the two stale
  legal-hours assertions, and "the ministry's French prose is out of the scan
  path" at 320px, which is the untranslated-French Known Problem at the top of
  that section. "X closes the card · the species goes with the card" still
  passes outside the layer. GitHub CI run 181
  on `main` (including the new species-surface step): success.

- **Eastern Waterfowl Survey ingest, 2026-09-29** (private worktree, on
  `origin/main`): typecheck 0 errors; `npm test` exit 0, **1,615 passing, 0
  failing** (9 new EWS cases, plus corpus counts updated from 13 to 49 datasets,
  1,469 to 3,943 geographies and 6,642 to 9,116 records); production build clean;
  lint 0 errors (8 pre-existing warnings); `validate:seo` and
  `check:intelligence-sources` pass; `git diff --check` clean.
  `npm run check:ews-source` reproduces all 37 artifacts from the live ECCC data
  mart: "332 plots, 36 bundles, 14 pairs below the plot-share floor".

  **Each refusal was proven able to fail** before it was trusted: mutating one
  committed bundle's `geographyType` to `POLYGON` fails 2 cases, its metric to
  `POPULATION_DENSITY` fails 1, and `matchesHuntingSeason` to true fails 1;
  deleting the warning from a mismatched bundle stops the module loading with
  the species and jurisdiction named.

  The source check is its own script rather than part of
  `check:intelligence-sources`, because the observations file is 58 MB and the
  shared gate should not quietly grow by that much without the owner choosing it.

- **Hunt mobile composer, 2026-09-29** (private worktree `kbfix`, branch
  `hunt-composer-keyboard`, rebased onto `origin/main` fe78c54): typecheck 0
  errors; `npm test` exit 0, **1,584 passing, 0 failing** (10 new: 8
  composer-layout invariants, 2 band-relative geometry, measured on the rebased
  tree); production build clean on Next 16; lint
  0 errors (8 pre-existing warnings); `git diff --check` clean; `validate:seo`,
  `validate:content` and `check:intelligence-sources` pass.

  **Both guards were proven able to fail** before being trusted: reinstating the
  `order` pair fails 1 of 8, and restoring the viewport-relative header read
  fails the geometry test. The served CSS bundle was checked directly — 5
  `[data-composer=open]` blocks, 0 declaring `order` — with a positive control
  that injected the regression into a copy and made the same probe fire.

  **Browser certification is Chromium (the app's browser pane, Pixel 8 mobile UA
  at phone widths) against a local production build — not WebKit, and not a
  physical device.** At 360x740, 375x667, 390x844 and 430x932 the composer opens
  with the field above the rows it offers, and simulating the keyboard through
  `visualViewport` (height shrunk 336 px, `offsetTop` 0 and 52) moves the field
  by **0 px** while the region below it shrinks to the space that is left; with
  the band scrolled, field and sheet move together by exactly the offset;
  dismissing returns every measurement to its resting value **exactly**. One
  scroller, no transform on the shell, no horizontal overflow at any width.
  Desktop 1440x900 keeps the panel layout with the field above the list.

- `check:regulatory-sources` **fails on the base commit too** and is unrelated to
  this work: quebec.ca published a zec paragraph the ingest classifier does not
  recognise, and the builder refuses to promote it. Reproduced on `02f68fd` with
  none of these changes present. That refusal is the pipeline behaving as §41B
  requires; the paragraph needs reading and classifying in the Québec lane.

- **Species heat intelligence, 2026-09-29** (private worktree `feat/species-heat-intelligence`): typecheck 0 errors; `npm test` exit 0, **1,574 passing, 0 failures** (baseline 1,542; +32 new assertions across `methodology.test.ts`, `rendering.test.ts`, `ontario-harvest.test.mjs`, and extensions to the bundle, route and species-layer suites); production build clean; lint **0 errors, 8 pre-existing warnings**; `validate:seo` clean; `check:intelligence-sources` reproduces all four Ontario and both British Columbia bundles byte-for-byte from the live authoritative CSVs; `git diff --check` clean.

  **The band-movement figure was predicted before it was measured** (320–440 predicted, 540 measured, 41.6%) and the gap is recorded above with its cause rather than the number alone.

  **Measured against a local production build** (`next start`, nothing else on the machine), server-side:

  | endpoint | p50 | p90 | payload |
  | --- | --- | --- | --- |
  | `/heat`, 10 zones | 2 ms | 3 ms | 4.7 KB |
  | `/heat`, 50 zones (one phone viewport) | 1 ms | 1 ms | 12.5 KB |
  | `/heat`, 430 zones (the practical ceiling) | 2 ms | 2 ms | 39 KB |
  | `/coverage` | 1 ms | — | 10.3 KB |
  | `/methodology?speciesId=…` | 1 ms | — | 6.0 KB |
  | `/opportunity?speciesId=…&geographyId=…` | 1 ms | — | 3.8 KB |

  **`MAX_HEAT_ZONES` (450) and `MAX_BODY_BYTES` (24,000) disagree, and the body limit binds first — at a point that depends on the layer.** Measured by encoding the real request shape: `layer:ca-on-wmu` fits all 450, `layer:ca-qc-zone-chasse` is refused at 400, `layer:ca-nl-caribou-area` at 393. So there is no single "practical ceiling"; there is a range, 392–450, set by the length of the layer id in the request.

  Two consequences, neither yet fixed. The client (`useSpeciesHeat.ts`) caps its own request at 450, so for a long-id layer it can ask for a request the server will refuse. And the refusal it gets is the *body-size* error, not the zone-count error, so a caller obeying the documented 450 is told the wrong thing about why. A refused heat request paints nothing, and §41B is explicit that a blank map reads to a hunter as "there are no animals here" — which is why this is a defect to reconcile rather than a tuning note. It is pre-existing on production, not introduced by this work: both constants and the client cap are identical at `9329453`.

  **Production-smoked on the real map** at 375×812: Ontario white-tailed deer draws 101 zones with continuous multi-tone heat under the green outlines and the `!` markers, the chosen zone keeps the only bone outline, and "How is this calculated?" opens the real record naming both authorities with weights summing to 100% and both effort measures shown as "not counted". Ontario moose (a dataset that did not exist this morning) draws 66 zones, warm in the north and unshaded in the south. Wild turkey resolves and answers "In season" with no heat ramp claim it cannot support. The basemap did not load — this host's Google key is refused — and the official boundaries and every answer were unaffected, which is the behaviour §41A requires.

- **Provenance split completed, 2026-09-29** (Codex worktree `codex/provenance-split`): typecheck 0 errors; `npm test` exit 0, **1,421 passing, 0 failing, 0 skipped**; production build clean; lint **0 errors** (9 pre-existing warnings); `validate:seo` and `validate:content:published` clean. The B.C. closed-areas artifact was verified by REGENERATING it from source and comparing rather than by reading the generated JSON — byte-identical, 325 restrictions, 180/145. Every regulatory generator was run twice with no drift. The compile-time protections were falsified and restored individually.

  **B.C. Reg. 190/84 re-consolidated September 15 → September 22, 2026** during this work and the pin was advanced only after review (§45): every rule, group and unit is byte-identical across the two consolidations (79 rules, 225 units), only `retrievedAt`, the content hash and the consolidation sentence moved, and the generator's own verbatim guards on s. 4 and s. 5 did not fire.

- **The map and the coverage report agree on 1,212 official units by two independent paths (2026-09-22).** The national overview answer contains 1,212 drawn features across the seven served layers (Ontario 151, Québec 59, Manitoba 62, Alberta 189, British Columbia 225, Saskatchewan 83, Yukon 443), and `canadaCoverageReport()` computes 1,212 parity-certified units from the certified rule bundles and ingestion adapters. Neither number is typed, and they are derived from different sources: one from PostGIS drawings and live services at request time, the other from the bundles and adapters at call time. Their agreement is a real cross-check — if a jurisdiction is ever promoted without being drawn, drawn without being certified, or silently truncated by a query limit, the two numbers separate. Yukon is exactly how that was caught: it reported 443 certified units while the map drew 0, because a 400-row cap refused the layer.

- **Canada spatial complete + Prince Edward Island, 2026-09-23** (private worktree): typecheck and lint clean; **722 tests, 0 failures** across every suite (7 new `transient-retry` cases, 7 new Prince Edward Island cases, 1 new presentation case, 1 new milestone-caveat case); production build passes on Next 16. `audit-zone-certification.mjs --all` re-ran **every** jurisdiction after the audit change: BC 890/890, AB 763/763, YT 1769/1769, NL moose 303/303, NL caribou 76/76, NL bear 27/27, NB 118/118, NS 54/54, MB 249/249, ON 608/608, QC 256/256 — all VERIFIED, and **every existing fixture is byte-identical to HEAD** (`git status` shows only the new `ca-pe` file). That is the evidence the audit's designation fix changed nothing for the token-designation jurisdictions. Prince Edward Island certified separately, 5/5 testable, VERIFIED; in the `--all` run its Statistics Canada service exhausted all four attempts and was recorded UNREAD, which is exactly the behaviour intended.

- **British Columbia rules landing, 2026-09-23** (private worktree): typecheck, lint clean; **734 tests, 0 failures**; production build passes. **20 of 20 production cases** against a local production build with the live registry and the province's WFS, each case written from B.C. Reg. 190/84 before the run — CONDITIONAL, CLOSED, UNKNOWN, NEEDS_VERIFICATION, CONFLICT and two ASK states (HUNTER_AGE, HUNT_METHOD) all as the law says. Served-layer certification re-run: 14/14. Coverage report recomputed from the bundles: coreGameComplete 4 → 5 of 11, rules 477 → 556, species certified 10 → 12.

  **Timing, reported as measured rather than as a story.** Zone lookup median 125 ms, p90 171 ms. Evaluation median 122–172 ms across runs, **p90 ~700 ms**, payload median 15 KB. Map: 339 features / 168 KB / 21 ms for the whole province at zoom 5, 5 features / 5 KB / 8 ms at Kamloops zoom 10.

  The p90 is real and **its cause is NOT isolated.** Four of twenty cases sit at ~670–730 ms in every batch run, which looked structural; but a direct A/B on one of those points — same coordinates and species, near date against far date, three runs each — produced overlapping ranges (0.24–1.04 s near, 0.27–0.74 s far) and did **not** reproduce a stable difference. A first hypothesis that it was the weather provider is therefore unsupported, and a second that it was cache warm-up is contradicted by the tail surviving a third full run. Recorded as an open performance question rather than explained; it is the general evaluate path, not anything British Columbia introduced. Do not re-propose the weather or caching explanations without new measurement.

### Build
- `canada-bc` landing, 2026-09-22, rebased on `9e82000`: typecheck and lint clean; full `npm test` green (hedge 11/11, `test:hunt` including BC unserved/served-state and the Cranbrook attribution); 5/5 time zones; published content contract 0 errors, 0 warnings; `check:regulatory-sources` all unchanged, BC bundle reproduces byte for byte; production build; hydration check 8 pages × 3 browser time zones clean. Against a local production build (Manitoba store read path live): Manitoba 24/24 (evaluation p90 264 ms), Québec 21/21, Ontario regression 7/7, Alberta regression 13/13.
- Map intelligence foundation, 2026-09-21: `npm run build` passes on the integrated working tree and includes dynamic `/api/hunt/opportunity`. Typecheck, lint and the full `npm test` repository suite are clean; all five timezone runs pass; the published content contract has 0 errors and 0 warnings. `npm run test:intelligence` passes 18/18; `npm run check:intelligence-sources` reproduces the 581,805-byte evidence bundle byte-for-byte from the live authoritative CSV; `git diff --check` is clean. Remote Supabase lint reports no errors in the existing public schema. The new migration was not applied or locally replayed: starting the absent local stack required a large image pull and was cancelled, while production migration reconciliation is concurrently owned.
- Opportunity API local production measurement: 2,283-byte WMU 57 response; 44 ms first request and 3–5 ms across four warm requests. The response explicitly reports PARTIAL_DATA, two evidence components, source/limitations and `legalStatus: null`, with a six-hour shared-cache directive.
- `npm run build` passed on 2026-09-20 after the species visual integration (Next.js 16.1.1). `/hunting/species` remains static and all 60 species routes remain statically generated; route inventory and rendering strategy are unchanged.

- `npm run build` passed on 2026-09-20 (Next.js 16.1.1). The species library is static and all 60 species pages are statically generated; Hunt, its evaluation/share APIs, shared Hunt Brief page and per-brief Open Graph image are dynamic; home, 404, site Open Graph image, robots, and sitemap are generated successfully.

### Tests
- Hunt map-first, 2026-09-22, branch `hunt-map-first` on main `3a11519`: typecheck and lint clean; 969 tests across every suite; 5/5 time zones (now including the date presets); production build on Next 16.3.5; content contract 0 errors; `validate:seo` pass; hydration 8 pages × 3 browser time zones against a UTC server. `scripts/certify-hunt-app.mjs`: 134/134 against the local production build and 136/137 on the deployed preview (the one failure was the harness waiting for share wording that the copy step had replaced; the brief itself was created and opened 200 — `/hunt/share/CI8tdk3kh8KbHSF92wz2QEX4` — carrying the readiness checklist and no coordinate, and the check now watches the link field). Preview also ran the four provincial case suites through the deployed endpoints: Ontario 7/7, Alberta 13/13, Manitoba 24/24, Québec 21/21, and `evaluateRequestBody` reproduces all 65 case bodies byte-for-byte. Found and fixed while driving a wide screen: "Check an exact spot" pinned the moving camera's centre (once in Montana) instead of the chosen zone.
- Québec, 2026-09-21, on `215db41`: typecheck and lint clean; `test:hunt` 437 (Québec engine 15, overlays 4, Québec integration 7, WFS fallback 7), `test:hunt-share` 56 (Québec briefs 9), `test:regulatory-sources` 90 (Québec source 22, publisher 7), `test:ingestion` 51, `test:canada` 11. Live: builder `--check` reproduces the bundle and certified units byte for byte; the closed-territories and zone-layer checks read unchanged; regulatory drill 5/5 and GIS drill 9/9 leave committed files untouched; parity 306/0; mirror read back 130/130 and 66/66; 20 production cases 20/20 in process with the ministry's services live; Ontario 7/7, Alberta 13/13 and Manitoba 24/24 regressions agree on the same code. Hunt driven in a private worktree with Québec switched on: Maniwaki → 10O, moose asks the implement, bow CONDITIONAL 26 Sep–4 Oct, Gatineau Park NEEDS_VERIFICATION naming the sanctuary; no horizontal overflow at 320, 375, 768, 1024 or 1440 px.
- Ready to Hunt, 2026-09-21, in an isolated worktree rebased on `5e21a34`: typecheck and lint clean; 683 tests across every suite (`test:hunt` now includes `src/lib/hunt/readiness/`: 38 resolver/Ontario cases, 11 vendor-search, 8 isolation; `test:hunt-share` adds 8 brief cases); 5/5 time zones; production build; both readiness bundles and the major-game bundle reproduce from live sources (`--check` unchanged). Browser (dev server, real Chromium): Bancroft/WMU 57 grouse today shows Outdoors Card, small game licence (residency asked inline, then resident fees only), firearms licence as "Depends", orange required for the open elk season; location permission denied → place search → five nearest issuers to North Bay with directions; the hunt stayed Bancroft/WMU 57 and no evaluation or zone request followed the vendor search; no browser storage written; no horizontal overflow at 375 px.
- Map exploration, 2026-09-21, in an isolated worktree on `0c1693e` + this work: typecheck and lint clean; 591 tests across every suite (`test:hunt` 348, including 38 new exploration tests: interaction-state invariants, zone summaries against the engine for Ontario, Manitoba and Alberta, labels, multipart merging, neighbour naming, handlers); 5/5 time zones; content contract 0 errors; production build (three new dynamic API routes); hydration check 8 pages × 3 browser time zones clean against a UTC server.
- Browser certification, boundary view (real Chromium in the app's browser pane, and Playwright against the production build): zone tap → card; search (Bancroft) → hunt pin, WMU 57 highlighted and framed beside its card, boundary warning naming WMU 61; drop pin → preview "GHA 25A · Manitoba" → confirmed hunt location with "Status on Nov 10, 2026"; location denied → non-blocking notice, hunt zone unchanged; location granted (injected fix) → blue dot, recentred camera, hunt zone unchanged; species filter with glyph labels and worded legend; Manitoba overlays drawn and tapped; keyboard: zones list → Enter opens the card with focus in it → Escape closes. At 320, 360, 375, 390, 430, 768, 1024 and 1440 px: no horizontal overflow, the sheet stays inside the map and scrolls, controls clear of it, no console errors.
- Manitoba, 2026-09-21, on `c077595`: typecheck and lint clean, and every suite passes (11 suites, 0 failures), including 29 Manitoba engine tests, 12 integration tests through Hunt's real path (overlays, outages, the 2.5 s hanging-registry fallback, jurisdiction attribution), 24 geometry tests (two jurisdictions in one view, a PARTIAL outage), the Manitoba Hunt Brief round trip, and 21 source tests. `publish-regulations.mjs --verify` reads back 85 of 85 identical. The change drill passes 8 of 8 and leaves the committed files untouched. Hunt at 320, 360, 375, 390, 430, 768, 1024 and 1440 px has no horizontal overflow, with 213 zones drawn across Ontario and Manitoba.
- Alberta served, 2026-09-21, on the landed tree `f07a886` (isolated worktree): typecheck and lint clean, 540 tests across every suite, 5/5 time zones, content contract 0 errors, production build compiles, the Alberta bundle reproduces byte for byte. Responsive sweep of the species library, two profiles and Hunt at 320, 360, 375, 390, 430, 768, 1024 and 1440px: no horizontal overflow, no clipped coverage label, no console errors (a 1.4px library overflow at 320px was found and fixed in `bc25153`). The Hunt selector was driven in real Chromium with an emulated Alberta and Ontario location: options are 48px targets and disabled state is carried by `aria-disabled`, not colour alone.
- Alberta and species recovery, 2026-09-21, verified in an isolated worktree on `083963f` so concurrent sessions' in-progress edits could not affect the result: typecheck and lint clean, 481 tests across every suite (including `test:regulatory-sources` with 19 Alberta reading and certified-fact tests, and 14 Alberta engine tests whose expectations were read from the guide, not from the engine), 5/5 time zones, content contract 0 errors, production build compiles. `node scripts/build-alberta-regulations.mjs --check` reproduces the bundle byte for byte.
- Ontario was re-certified after the promotion change: 309 of 309 points agree with the Government of Ontario service (live, 2026-09-21 ~02:42 UTC), and the Ontario adapter reproduces all 151 published canonical ids and names (`fixtures/hunt/ontario-registry-identity.json`).
- The hydration check now pins the missing-brief page: `/hunt/share/bad` must answer 404 with "This Hunt Brief isn’t available" in the server-rendered body. A malformed ID is decided without storage, so it exercises proxy, rewrite and page identically in CI and in production. Proven by removing the proxy: the check failed on the body alone — the status was still 404 without it, so a status-only check would have passed the empty page. 24 page loads clean under CI conditions (no storage, no Maps key, UTC server). `test:hunt-share` 32/32 including six routing cases.
- A local-testing trap worth knowing: building with the real Maps browser key and serving from `127.0.0.1` fails the hydration check with `RefererNotAllowedMapError`, because the key is restricted to the production domain. CI builds without the key and cannot hit it. The checker was deliberately left strict rather than taught to ignore it.
- A browser hydration check runs in CI as of 2026-09-21 (`scripts/check-hydration.mjs`, CI job **hydration**). It builds for production, starts the server in UTC as on Vercel, and loads seven pages in real Chromium under three browser time zones — Toronto, Kiritimati (UTC+14) and Pago Pago (UTC−11). Toronto alone would be insufficient: it shares UTC's calendar day for twenty hours of every twenty-four, so a check run mid-afternoon would pass a regression of the very bug it exists for. Kiritimati differs from UTC from 10:00 and Pago Pago until 10:59, so between them some browser disagrees with the server about the date at every one of the day's 96 quarter-hours. It fails on hydration errors, console errors, broken sub-resources, an unexpected status, and — for pages that declare it — body text missing from the server-rendered HTML.
- Both guards were proven by reintroducing the defects they guard against, rather than assumed. Putting the original `todayIso()` seed back into `HuntComposer` failed `/hunt` with React #418 under Toronto and Pago Pago at 02:24 UTC (Kiritimati shared UTC's day at that hour, as predicted). Removing `dynamicParams` failed the unknown-species page on its server-rendered body.
- Proving it caught a bug in the check itself. The first version searched the whole document for "Page not found" and passed a 404 whose body was empty, because that text is also the `<title>` — in `<head>`, always server-rendered, and silent on whether a reader sees anything. It could not have failed. It now searches the body only, for text that exists only there.
- Verified in an isolated worktree on `f36cb41` so that concurrent sessions' in-progress edits could not affect the result: typecheck and lint clean, 330 tests, 5/5 timezone runs, content contract clean, build compiles, 21/21 page loads hydrate cleanly.
- CI's first run failed, which is the point of having it: `persistence.test.ts` needed Supabase credentials. It touches no network — importing `publish-regulations.mjs` read the environment at module scope and exited, so a pure test of which rule dimensions the schema can represent could only run on a machine that already had a production service-role key, and therefore never ran in CI. Credentials resolve on first use now; publishing still refuses loudly without them (exit 1). The full suite is verified to pass with no environment file present, so no gate depends on a secret and every gate runs on a fork's pull request.
- CI exists as of 2026-09-21 (`.github/workflows/ci.yml`). It had not before, which is how a defect that only appears under a UTC server reached production. Three jobs on every push and pull request to main, all under `TZ=UTC` and needing no secrets: **gates** (typecheck, lint, all 320 tests, build, content-contract validation); **timezones**, which runs the clock-reading suites under UTC, Toronto, Vancouver, Sydney and Kiritimati, because a developer's machine shares its zone with its browser and hides the whole class; and **regulatory-bundles-are-generated**, which rebuilds from the official pages and fails if a committed bundle is not exactly what its builder produces — a bundle edited by hand would pass every test and still be wrong against its own source. That job warns rather than fails when the province is unreachable, since an outage there is not a defect here.
- The timezone guard was verified by reintroducing the defect: it fails 4 of 5 assertions under UTC and only 1 under Toronto, which is the point — the bug is invisible in the developer's own zone.
- `.github/workflows/regulatory-sources.yml` runs the source check daily at 11:00 UTC and opens (or comments on) a single `regulatory-source` issue when a page moves or cannot be read. It never publishes; promoting a change stays a human decision made against the rule-level diff. This is the answer to "a source silently failing for six months is unacceptable".
- Deployed and verified in production 2026-09-20, commits `fb683f4` then `1901e0f` (`dpl_7491…`). All 292 tests pass locally across eleven suites; typecheck and lint clean; build compiles.
- Production regulatory verification, live against `www.northgroundbushcraft.com`: WMU 71 deer resident on 10 November returns CLOSED for a rifle and CONDITIONAL 2–15 November for shotgun, muzzle-loader and bow — the footnote case, end to end. Turkey asks only for the implement and closes to a rifle; bear in WMU 7A states its restriction without asking; moose asks for the tag; WMU 51 is UNKNOWN; WMU 1C splits resident CONDITIONAL from non-resident CLOSED. Ruffed grouse still asks nothing and answers directly, so small game is unregressed.
- Untrusted answers verified against production: an unrecognised residency, `__proto__` and an unknown implement all leave the question open rather than narrowing the rule set into a closure; malformed shapes return 400.
- Production hygiene: six security headers present, `/`, `/hunt`, `/hunting/species`, a species profile, `/sitemap.xml` and `/robots.txt` all 200, and a clean browser session on the current deployment records zero console errors.
- Production wiring certified 2026-09-20. `npm run typecheck` and `npx eslint src scripts` clean. `test:hunt` 176/176, `test:regulatory-sources` 20/20, `test:hunt-share` 26/26, `test:content-repository` 12/12, `test:content-contract` 8/8, `test:content-urls` 21/21, `test:seo` 3/3, `test:newsletter` 9/9. `npm run build` compiled. `npm run check:regulatory-sources` reports both sources unchanged.
- Hunt was driven in a real browser rather than assumed. Bancroft resolved to WMU 61 with a 4 m near-boundary warning; white-tailed deer produced the residency question with its reason and source section, then the implement question, then a CLOSED result for 20 September with "Seasons open to this combination here: gun season November 2 to November 15" and a "THIS ANSWER ASSUMES" block listing both answers over the line that nothing here confirms a licence, tag or residency is valid. Zero console errors.
- The footnote case was proved through the live API, not only in unit tests. Identical request to `/api/hunt/evaluate` at WMU 71's interior point on 10 November, resident: `HUNT_METHOD: "RIFLE"` returns CLOSED, `HUNT_METHOD: "SHOTGUN"` returns CONDITIONAL on the 2–15 November gun season. That is the whole wave, end to end.
- Mobile at 375 x 812: no horizontal overflow, question options single-column at the 48 px `--ng-tap` target.
- Canada wave, 2026-09-20. `npm run typecheck` and `npm run lint` clean. `test:hunt` 176/176 (up from 145: conditional dispatch, answer validation, engine routing and persistence guards). `test:hunt-share` 26/26 including Hunt Brief v1 preservation and v2 round-trip. `test:canada` 8/8. `test:content-repository` 12/12, `test:content-urls` 21/21, `test:content-contract` 8/8, `test:seo` 3/3, `test:newsletter` 9/9. `validate:content:published` 0 errors.
- Live conditional flow certified against the running app on 2026-09-20. Deer at 45.23/-77.94 for 2026-11-10 asked RESIDENCY, then HUNT_METHOD, then resolved CONDITIONAL with the gun season 2-15 November. Turkey resolved without ever asking residency. Moose asked residency first. Small game resolved with no questions at all, unchanged.
- Invalid-input safety certified live through the real endpoint: `RESIDENCY: "DEFINITELY_A_RESIDENT"`, `HUNT_METHOD: "BAZOOKA"` and an empty string each left the question outstanding at NEEDS_INPUT and produced no status. None became CLOSED.
- Question UI certified at 320, 360, 375, 390, 430, 768, 1024 and 1440 CSS pixels with zero horizontal overflow at every width. Options are 48px tall and full width on phones, side by side from 640 up, in a `radiogroup` with the reason and source section always shown.

- Ontario conditional regulatory engine, 2026-09-20. `npm run typecheck` clean, `npx eslint src scripts` clean (the previously noted unused-variable warning in `scripts/build-ontario-regulations.mjs` is resolved). `npm run test:hunt` 169/169 — the 117 pre-existing hunt tests plus 28 deer cases and 24 turkey/bear/moose/untrusted-input cases, with the small-game suite unchanged. `npm run test:regulatory-sources` 16/16 covering WMU specification expansion, footnote-to-token attachment, and the bundle change report. `npm run build` compiled successfully.
- Both bundles rebuild byte-identically when the sources have not moved, which is what makes a diff meaningful.
- Source-change drill performed 2026-09-20 against the four-species bundle. Three realistic changes were simulated — a turkey spring season shortened, WMU 7A's bear implements narrowed, and a moose "None" cell becoming dates. All three were detected, each was named with its field-level before/after and the number of units it touches (91, 1 and 19 respectively), the production bundle and file were untouched, the engine continued to return the pre-change answers, and the report exited 3 to require review. Nothing was promoted automatically.
- The drill also demonstrated the blast-radius value of the report: two edits intended as separate landed on a single deer rule, because WMUs 48 and 60 share a season grouping that spans 36 units.

- Species visual integration, 2026-09-20. `npm run typecheck` and `npm run lint` clean (one pre-existing unused-variable warning in `scripts/build-ontario-regulations.mjs`, owned by the regulatory work). `test:hunt` 145/145, `test:hunt-share` 23/23, `test:content-repository` 12/12, `test:content-urls` 21/21, `test:content-contract` 8/8, `test:seo` 3/3, `test:newsletter` 9/9. `validate:content:published` 0 errors / 0 warnings across 83 entities, 61 resources, 46 blocks. `validate:seo` passed against a production build.
- Species browser certification 2026-09-20 at 320, 360, 375, 390, 430, 768, 1024 and 1440 CSS pixels on both the library and a profile: zero horizontal overflow at every width, zero console errors. Contrast measured against composited glass on the library (412 text nodes, zero failures); the two apparent primary-button failures were a probe artifact — the control paints a gradient via `background-image`, and the real worst-case ratio along it is 11.22:1 for `--ng-black` on `--ng-bone`.
- Heading order verified: library H1 → H2 (Find a species) → H2 (Species); profile H1 → eight H2 sections → H3 App Blocks, no skips. Coverage state is carried by a ring glyph and a word as well as by colour. Breadcrumb links raised to a 28px target; the remaining sub-36px links are inline links inside sentences, which WCAG 2.5.8 excludes.
- Library search certified against the real bundle: `wolf` → Eastern wolf + Gray wolf, `doe` → both deer, `orignal` → Moose, `Canard colvert` → Mallard, `rabbit` → the three hares and rabbits, `grouse` → three grouse plus two ptarmigan, and an unmatched query renders the empty state. Coverage labels matched `SUPPORTED_SPECIES_IDS` exactly — grouse and snowshoe hare `Rules available`, the rest `Rules in development`.
- Structured data and SEO preserved on `/hunting/species/ruffed-grouse`: Article + Taxon + BreadcrumbList emitted, canonical unchanged, `<h1>Ruffed grouse</h1>` server-rendered, sitemap still 63 URLs. Page weight on the wire: Hunt 11.7 KB, the 60-species library 11.8 KB, a species profile 8.0 KB.

- `npm run typecheck` passed on 2026-09-20.
- `npm run test:content-contract` passed 8/8 on 2026-09-20, including scientific-name, duplicate-alias, regulatory-class sourcing and species-media-role verification failures.
- `npm run validate:content:strict` passed the contract fixture with 0 errors and 0 warnings on 2026-09-20.
- `npm run validate:content:published` passed both published bundles with 0 errors and 0 warnings (26 entities, 11 resources, 14 blocks) on 2026-09-20.
- `npm run test:content-urls` passed 21/21 on 2026-09-20; `npm run test:content-repository` passed 12/12, including hunter/class intents, broad-category choice behavior, French/scientific search, lookalikes, compact selector size and exact-species image gating. `npm run test:hunt` passed 114/114 including the new biological/regulatory characteristic contract.
- `npm run test:hunt` passed 67/67 on 2026-09-20, covering request origin/media/body/rate controls, season boundaries, fail-closed unknowns, forecast horizon, official-zone response handling/boundary warning, regulatory/editorial separation, place search and geocoding providers, the date composer, and the spatial/zone-geometry engine.
- The spatial engine has 18 deterministic tests in `src/lib/hunt/zone-geometry.test.ts`: point inside a zone, point outside supported geography (no authority is queried at all), point near a mapped boundary, overlapping zones requiring human verification, invalid coordinates, the Canada/United States jurisdiction distinction, per-zone versus per-layer coverage, zoom-dependent simplification monotonicity, the exact query sent to the authority, cache reuse, outage handling that is deliberately not cached, degenerate-feature rejection, and viewport validation.
- The date composer has 19 tests in `src/lib/hunt/date.test.ts`, including `20260808` → `2026/08/08`, pasted `2026-08-08` and `2026/08/08`, progressive partial input distinguished from invalid input, `20260229` rejected and `20280229` accepted, `20261301` and `20261232` rejected, calendar/text round trips, and the time-zone cases that would otherwise shift a hunt by one day.
- `npm run test:hunt-share` passed 13/13 on 2026-09-20, covering privacy stripping on both client and server, the real Hunt adapter, opaque IDs, immutable persistence, exact regulatory-status preservation, unsupported versions, API validation/rate limiting, native-share/copy fallbacks, server-rendered card content, staleness/source labels, and noindex/social metadata.
- `npm run test:newsletter` passed 9/9 on 2026-09-20.
- `npm run test:seo` passed 3/3 and `npm run validate:seo` passed production-server checks for metadata, SSR H1/indexability, social image, robots, sitemap, 404 and trailing-slash redirects on 2026-09-20. The validator was moved to the canonical `/hunt` route and now additionally asserts that `/tools/season-finder` returns 308 to `/hunt` and that the superseded path is absent from the sitemap.
- `npm run lint` passed on 2026-09-20.
- Local browser certification passed for the species library and ruffed grouse, white-tailed deer, moose, American black bear, mallard and Canada goose at 1280 and 390 CSS pixels with no horizontal overflow or framework overlays. All six pages emitted Article + Taxon and breadcrumb structured data. `orignal` found Moose, and the Hunt selector found disabled White-tailed deer through `whitetail` while exposing only ruffed grouse as `Rules available`. The only local console error was the expected Google Maps referrer refusal for `127.0.0.1`, which does not occur on the authorized production origin.
- Finalized homepage/Hunt metadata validation passed on 2026-09-20: exact emitted title, description, canonical, Open Graph, Twitter fields, `www` URLs, image alt text, and the Hunt JPEG's 200 `image/jpeg` response were verified against a production build.
- Local production runtime certification resolved 45.23, -77.94 to WMU 57, returned `CONDITIONAL` for 2026-09-20, returned live weather inside the forecast horizon, returned explicit `UNAVAILABLE` weather 46 days out without provider fallback, and retrieved legal, identification, and habitat App Blocks by canonical species context.
- Hunt browser certification passed on 2026-09-20 at 320, 360, 375, 390, 430, 768, 1024, 1280 and 1440 CSS pixels with zero horizontal overflow at every width. Mobile order is composer then map; desktop is a sticky composer beside a map that fills the viewport height. The full navigation appears from 768 up and collapses to a compact disclosure menu below it.
- Live Hunt workflow certified locally: the map drew 151 official Ontario WMU boundaries before any input; searching `Bancroft Ontario` returned a real suggestion, resolved the point to `WMU 57` with a `CERTIFIED` coverage badge and a real 113 m boundary warning, all before a species or date was chosen; typing `20260808` displayed `2026/08/08`; `20260229` was refused with "February 2026 has 28 days, so 29 is not a date."; `20261301` with "There is no month 13."; the calendar opened on the typed month with the day selected; arrow keys, PageDown, Home and Enter navigated and selected, closing the calendar and returning focus to its trigger; and the evaluation returned `CONDITIONAL` with Overview, Regulations, Weather, Field notes and Sources (5) tabs all carrying real content.
- Hunt accessibility certification on 2026-09-20: heading order H1 → H2 → H3 with no skips; 84 rendered text nodes measured for contrast against their composited glass background with zero genuine failures after the secondary-token fix; no interactive control shorter than 36 CSS pixels; combobox, listbox, grid/row/gridcell and tablist semantics present with correct roving focus; status is carried by a glyph and a word as well as colour; reduced-transparency and missing-backdrop-filter both fall back to opaque surfaces.
- Share Hunt Brief certified fail-closed locally: the dialog opened with focus on its close control, previewed only zone, jurisdiction, date and exact status with no coordinates, stated the privacy boundary, and reported "Hunt Brief sharing is temporarily unavailable" because Supabase is not provisioned.
- Earlier browser checks passed at 375, 768, and 1440 CSS-pixel widths without horizontal overflow or console errors. Mobile Hunt and desktop species Lighthouse audits each scored 100 for accessibility, best practices, SEO, and agentic browsing.
- Hunt Brief card checks passed at 320, 360, 375, 390, 430, 768, 1024, and 1440 CSS-pixel widths with no horizontal overflow; the 320-pixel share dialog opened with focus on its close control, visible privacy guidance, native-share/copy actions, and no runtime exception.
- Release browser checks passed at 320, 360, 375, 390, 430, 768, 1024 and 1440 CSS pixels on both the local production build and canonical production homepage. Hunt remained visible in primary navigation and no width produced horizontal overflow. Reduced-motion mode now pauses both decorative videos in addition to removing CSS animation.
- Release Lighthouse audits scored 100 for accessibility, best practices, SEO and agentic browsing on mobile and desktop home, plus a mobile Hunt snapshot. The Hunt navigation path, form controls, live regions and map text equivalent were present in accessibility snapshots.
- Real browser scenarios passed locally for in-season (`CONDITIONAL`), out-of-season (`CLOSED`), unsupported WMU (`UNKNOWN`), exact mapped-boundary warning (0 m), and an aborted API request with a visible recoverable error.

### Production
- **Canonical species media is activated and production-certified as of 2026-09-22.** Migration `20260921113816` was applied alone through a reconciled temporary migration set; the unrelated pending map-intelligence migration was not applied. The private `species-media` bucket is WebP-only with a 15 MiB object limit. Commit `2072933` is live in Vercel deployment `dpl_CBDJj6BD2eD7wjeH4bgd6PdRkvTc`; it fixes the production function trace so Sharp's Linux libvips runtime is packaged. Real production Chromium signed in, performed a true DataTransfer drop with an unrelated filename, replaced the primary through the confirmation dialog, and rendered the final canonical relationship in the library card, profile, Hunt selector, map filter, Hunt result and Ready to Hunt. Desktop 1440 px and mobile 390 px had no horizontal overflow or console errors.
  - Security certification: anonymous, ordinary-user, tampered-cookie and expired-cookie uploads were refused; non-image/polyglot, unknown-species and oversized bodies failed; direct publishable-key table reads were denied; raw masters remained private; the service-role credential was absent from rendered HTML and 31 client bundles. Re-encoded masters contained no EXIF, IPTC, XMP or ICC metadata. Client-supplied storage paths were ignored.
  - Atomic replacement certification: two concurrent replacements with the same expected asset produced exactly one success and one `PRIMARY_MEDIA_CHANGED` conflict. The losing upload left no database row or Storage orphan. Avatar/card/profile responses were 2,862 / 50,462 / 233,682 bytes, and list/Hunt surfaces fetched only the appropriate compact rendition.
  - Certification cleanup completed: 12 Storage objects, three assets, nine renditions, the primary relationship and two temporary Auth users were deleted and verified absent. `SPECIES_MEDIA_ADMIN_USER_IDS` was removed from Production, leaving administrator access fail-closed until the owner provides the permanent administrator email. The isolated release gate passed typecheck, lint, the full test matrix, 7/7 focused media tests, the 73-route production build, strict published-content validation, and SEO validation.
- **Ready to Hunt released and certified on production, 2026-09-21.** Pushed on the owner's instruction after the full gate passed on each exact pushed tree: `a00f3d0` (Vercel `dpl_3irCeCPfwxbUNMTpZrgHD2zbd1yj`) and then `5db7c51` (`dpl_xZ5t8jU7TuJcAHNu7nzvgWiEWC2F`). Gate: typecheck, lint, 706 tests, 5/5 time zones, content contract (fixture and published), SEO validation, production build, hydration (8 pages × 3 browser time zones), and every regulatory bundle rebuilt from live sources byte-identical. Re-certified on the current live `2d9ed56` (`dpl_GAwRrXz1dAyVTXznzrodWCDV2FWk`, which the map-intelligence release carried).
  - **Defect found and fixed in production certification (`5db7c51`).** The Share button's request allowlist (`createHuntBriefRequestPayload`) never carried `readiness` or `assumptions`, so browser-created briefs stored neither — true of v2 assumptions since v2 shipped. A test now follows the button's whole path and fails without the fix. Briefs created before `5db7c51` stay as stored (immutable): v1 `ozXRVpuI0x8oo_hd4TzHramL` and the pre-fix v3 `j4mqFv2w7IieQe9D7-vVzGa8` both render, 200, noindex, without a checklist.
  - **API, 16/16 on production.** Every production checklist is byte-identical to what the gated code computes for the same zone, answers and day. WMU 57 grouse today: Outdoors Card REQUIRED at $8.57 + HST, small game licence asks residency, then resident fees only ($22.76 / $68.28) or non-resident only ($121.52 / $364.56). The federal firearms licence is REQUIRED for a shotgun, absent for a bow, CONDITIONAL when unstated, with "Check current official fee" (no verified fee). Orange is REQUIRED (elk season open, 400 sq in minimum, s. 26), CONDITIONAL for a bear hunter on 1 Sept (tree stand), and NOT_REQUIRED for grouse on 16 Sept (s. 26(4)(a)). A non-resident bear hunter needs the validation certificate through a licensed operator. Deer on 2 Nov: legal methods and shot size come from the engine, with no big-game recommendation. The grouse legal ammunition rules are separate from the labelled recommendations, and the rifle line says "In force today". Turkey on 30 Apr 2026: muzzle-loading shotgun CONDITIONAL with the s. 79(1)(a) condition, rifle CLOSED. A CLOSED hunt shows no checklist. Manitoba GHA 35A and Alberta WMU 302 show "not built yet" with the regulation's own source link. Québec is not served in production, so no Québec checklist is reachable.
  - **Three locations, proven in a real browser on `www` with network capture.** The injected device fix in Thunder Bay drew the self dot and recentred the map (one viewport tile request); the hunt stayed Bancroft/Maynooth, WMU 57, same weather. "Find a licence vendor near me" with an injected Ottawa fix listed ServiceOntario Ottawa first, with **zero** network requests. When permission was denied, place search sent only `{"action":"suggest","query":"North Bay ON"}` and listed ServiceOntario North Bay. Across self → vendor (device) → denied → vendor (place) there were 0 evaluate, zone or zone-summary requests; hunt, zone, weather and fees were unchanged; no local or session storage and no cookies were written; and no analytics script is present on `/hunt`. Directions links carry only the issuer's name and address.
  - **Hunt Brief v3 in production.** A WMU 61 resident shotgun deer brief (`D8i3s-n0aws-J8H1Fwq1Jzr_`) server-renders "This result assumed" (Ontario resident, Shotgun), "Ready to hunt" (Outdoors Card, Deer licence, Firearms licence, Hunter orange), fees labelled "2026 fee (Resident deer licence): $43.86 + 13% HST" and legal methods. It has 0 coordinate, vendor or issuer strings, and its URL is the opaque ID only.
  - **Layout.** No horizontal overflow at 320, 360, 375, 390, 430, 1024 or 1440 px, and zero console errors. Inline text buttons (fee residency switch, source disclosure) are 32 px tall; the primary actions are 44 px.
- **Map-intelligence API foundation deployed and certified on `9ccedc7`, Vercel `dpl_9T2ieXVW64cybVSUna1Z694725Yn`, 2026-09-21.** `GET /api/hunt/opportunity` returns the official Ontario white-tailed deer WMU 57 bundle as PARTIAL DATA with two inspectable evidence components, `legalStatus: null`, and bounded cache headers; a WMU without evidence returns `NO_HEAT_MAP_DATA`/404 and malformed identifiers return 400. The map does not consume the endpoint, the PostGIS migration remains unapplied, and no Crown/public-land geometry or map-layer claim is live. Local gates passed on the exact release commit (build, typecheck, lint, full tests, five time zones, published-content validation, SEO validation and live source checks); GitHub CI run `35591997476` passed. Public-host regressions passed Ontario 7/7, Alberta 13/13 and Manitoba 24/24. Core routes, robots, sitemap, the canonical redirect and the legacy Hunt redirect were rechecked live.
- **Re-certified on `a00f3d0`, `dpl_3irCeCPfwxbUNMTpZrgHD2zbd1yj`, 2026-09-21.** This deployment carries the Google-refusal logging, the Geocoding fallback and the question's arrow keys.
  - Regressions, all agreeing: Ontario 7/7 (zone median 124 ms / evaluation median 106 ms), Alberta 13/13 (122 / 96 ms), Manitoba 24/24 (202 / 235 ms).
  - The runtime log now names the Google failure exactly, with no query or coordinate: `[hunt-location] Google Places returned 403 (PERMISSION_DENIED, API_KEY_HTTP_REFERRER_BLOCKED)`, and the same for Weather.
  - A dropped pin at the WMU 57 regression point now gets a place name from Nominatim instead of "no named place".
  - The residency question moves with the arrow keys, Home and End, wraps at the ends, answers only on Enter, and then asks the next question.
  - No horizontal overflow at 320 or 390 px.
  - Ontario spatial parity was re-run live: 309 points, 0 disagreements. The Manitoba control point now records GHA 30 as a neighbour instead of failing (`08f3fba`).
  - The 18 applied migration files replay to production's exact schema (`158bce6`, `docs/supabase-migration-history.md`).
- **National regression on production, 2026-09-21** (`39dc7c1`, `dpl_99MphvNNqTHBUNDAsqPRseZF61zs`). Each case restates an answer already certified from the law, through `/api/hunt/zone` and `/api/hunt/evaluate` on `www` via `scripts/certify-hunt-cases.mjs`:
  - Ontario: 7/7 (`fixtures/hunt/ca-on-regression-cases.json`).
  - Alberta: 13/13 (`ca-ab-regression-cases.json`), including the Sunday bow closure, antler class asked, antlerless general CLOSED, and Banff/Elk Island NEEDS_VERIFICATION.
  - Manitoba: 24/24 (`ca-mb-certification-cases.json`).
  - Latency (zone median / evaluation median / payload median): Ontario 155 / 124 ms / 11 KB, Alberta 104 / 98 ms / 8 KB, Manitoba 144 / 215 ms / 12 KB.
  - Ontario wide views re-certified after the tiling fix: 39/39 checks, every expected unit in 151/151 across 5 envelopes, largest payload 108 KB.
  - Hunt Brief: a stored brief 200; a missing brief 404 with a server-rendered body in 0.29 s; a malformed one 404 in 0.06 s; one robots tag each.
  - Responsive audit at 320, 360, 375, 390, 430, 768, 1024 and 1440 CSS pixels: no horizontal overflow, no unnamed or undersized controls, the textual zone list present beside the map, no console errors.
  - Keyboard-only flow (Playwright, 1440): place search → option → zone (GHA 31) → typed `20261120` becomes `2026/11/20` → species picker → "Check this hunt" → residency radiogroup → answer. Every control shows a visible focus ring. The one gap found, arrow keys not moving between answers, is fixed in `a54edd4`.
  - Google: Weather and Places are running on their fallbacks because the server key is refused (Known Problems).
- **Map exploration deployed and certified on production, 2026-09-21** (`f5a96b4`, CI green). Real browser on `www`, Google basemap: zone labels drawn in each authority's terms over quiet fills with Google attribution uncovered; tapping GHA 35A selects it (bone outline, highlighted label), frames it beside its card, and shows three grouse "In season" and white-tailed deer "Depends on your hunt"; "Choose a spot" → preview → "Check this location" sets the hunt pin, resolved to GHA 35A and labelled "Near Mitchell, MB"; a device fix draws the blue dot in Winnipeg and recentres the camera while the hunt location stays GHA 35A; zero console errors, no overflow. APIs: zone summary for WMU 71 on 10 November matches local (deer "Depends on your hunt", moose "Not covered here"); Alberta's view returns 189 unique WMUs; the zone lookup returns the designation. Regression: `certify-hunt-cases.mjs` Manitoba 24 of 24 agree with the law (zone lookup median 165 ms, evaluation 235 ms).
- **Manitoba certified on production, 2026-09-21** (`cb7240e`, which carries all Manitoba work through `d10d9e5`): 24 real places through `/api/hunt/zone` and `/api/hunt/evaluate`, every expectation written from the law first, 24 agree. The record is `fixtures/hunt/ca-mb-production-certification.json`. Zone lookup median 369 ms; evaluation median 237 ms, p90 about 3 s (cold overlays); payload median 12 KB. All of Manitoba's map at zoom 5 is 22 KB.
- **Deployed 2026-09-21 03:43 UTC: `fa1973c`, Vercel production `dpl_AgZ8aWXzBMrQm2UPTY6vVYBdFgvx`,** pushed on the owner's explicit decision after every gate passed on that exact commit (548 tests, typecheck, lint, 5/5 time zones, content contract, build). It carries the Alberta, Manitoba, Québec, species-coverage and hydration work.
- Alberta certified live on `www`: WMUs 102 (south), 322 (central), 531 (north), 357 (Peace Country), both sides of the 247/248 boundary and a part of multipart 718 resolve correctly; Elk Island and Banff resolve to no WMU. Evaluations: grouse in season CONDITIONAL and before 1 September CLOSED; deer on 4 November asks the antler class; antlered rifle CONDITIONAL; antlerless rifle CLOSED on a general licence and CONDITIONAL on a special one; a bow on Sunday in WMU 102 CLOSED; WMU 718 UNKNOWN; Alberta moose UNKNOWN as a coverage gap; a tampered answer leaves the question open. In the browser, Pincher Creek resolves through Google Places to WMU 302 · Alberta, badged Certified, over Alberta's own boundaries.
- Regressions held: Ontario WMU 71 resident deer on 10 November is CLOSED to a rifle and CONDITIONAL 2–15 November to a shotgun, exactly as first certified; Manitoba GHA 23A resolves.
- Latency on the new deployment: zone resolution median 171 ms, evaluation median 137 ms (max 224 ms); the whole-Alberta map view is 42.7 KB (198 drawn records) and a Calgary view 8.4 KB. One Supabase lookup fell back to official GIS at 03:46 UTC while Québec's layer was being published; the answer stayed correct and the 2.5 s bound held.
- Species surfaces certified live: library search for wolf, eastern wolf, coyote, fox, arctic fox, rabbit, snowshoe hare, doe, buck, bull moose, duck, mallard, goose and Canada goose returns the expected choices (`goose` shows 4 cards in the library, where Brant's name does not contain the word, against 5 from repository search); the selector enables 8 species before a place, the four Alberta species at an Alberta point and 8 at an Ontario point, with 48px options and `aria-disabled`; no horizontal overflow or console error at any of the eight widths; sitemap 63 URLs; Article, Taxon and BreadcrumbList structured data intact.
- The hydration check passed against production itself (8 pages, 3 browser time zones), and the Hunt Brief paths answer as designed: malformed and missing briefs are 404 with the page in the server-rendered body, a stored brief renders, one robots tag each.
- Hunt is fully configured and certified live as of 2026-09-20. Supabase project `nxzaatqovhbvziecogan` holds both migrations and the certified Ontario record; the Google project `ngbc-509209` supplies the map, place search, geocoding and weather through two separately restricted keys. `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `GOOGLE_MAPS_SERVER_API_KEY`, `GEOCODING_PROVIDER`, `WEATHER_PROVIDER`, `WEATHER_FALLBACK_PROVIDER` and `SPATIAL_PROVIDER` are set in Vercel Production and Preview alongside the existing site, newsletter and share-secret variables.
- Live Supabase certification: PostGIS resolves 45.23/-77.94 to WMU 57 at 14,415 m from the boundary and a point 56 m from the mapped line as `near_boundary`; a point outside the registry and an out-of-range latitude both return no row rather than a guess. RLS is enabled on every public table with zero permissive policies; `anon` can neither read Hunt Briefs nor execute the zone resolver; a privileged update to a stored brief is refused by the immutability trigger and the snapshot stayed at version 1. The WMU 57 geometry loaded as a valid 7,738-point MultiPolygon in SRID 4326 covering about 2,020 km², matching the recorded migration exactly.
- Live Google certification: Places (New) autocomplete, Geocoding and Weather all answer through the server key, and each key was tested against an API it is NOT permitted to use — both correctly returned `REQUEST_DENIED`, confirming the restrictions bite. The browser key is additionally refused when sent without a referrer.
- Live Hunt Brief end to end: a real brief was created on the canonical host at `/hunt/share/ozXRVpuI0x8oo_hd4TzHramL`, stored durably in Supabase, and retrieved as a `noindex, follow, noarchive` read-only page carrying the species, zone, date, exact `CONDITIONAL` status, season snapshot, captured weather and conditions — with no coordinate, address or raw location input anywhere in the snapshot or the rendered page. This closes the release's sole open P1; P0 and P1 counts are now zero.
- Live browser certification at 1440 CSS pixels: the real Google map loads with a Canada/United States extent, 151 official Ontario WMU boundaries overlaid, a Terrain/Satellite control, Google's attribution uncovered, zero console errors and zero horizontal overflow. A point in WMU 57 reports `Certified`; a point in WMU 61 reports `Boundary only`, which is the honest distinction between knowing a boundary and having certified its rules.
- The map-first Hunt release was pushed to `origin/main` as `95749db` and deployed by the Git integration as Vercel production deployment `dpl_9xNh7AenZx9B9pvZf3zXey2rDVxX` on 2026-09-20.
- Canonical production certification passed live: `/`, `/hunt`, `/hunting/species/ruffed-grouse`, `/robots.txt`, `/sitemap.xml`, `/apple-icon.png` and the Hunt social JPEG all return 200; `/tools/season-finder` returns 308 to `/hunt`; the sitemap lists home, `/hunt` and the species page and no longer lists the superseded path; `/hunt` emits the canonical, title, description, Open Graph and Twitter metadata for `/hunt` and server-renders its H1.
- Live Hunt APIs certified: `GET /api/hunt/zones` returned 53 official WMU features in 16 KB in 1.1 s for a four-degree viewport at zoom 7, with WMU 57 the only `VERIFIED` zone in view; `POST /api/hunt/zone` resolved 45.23, -77.94 to `WMU 57` / `VERIFIED`. The live browser workflow searched Bancroft, resolved WMU 57 with the real 113 m boundary warning, and returned `CONDITIONAL` with all five result tabs carrying real content.
- Live browser certification passed at 1440 and 390 CSS pixels with zero console errors and zero horizontal overflow, 151 official boundaries drawn before any input, and the compact navigation on mobile. The homepage hero is unchanged: `Enter the North` is a link to `/hunt` and `Who we are` opens the mission deck.
- `/hunt/share/<unknown>` returns 200 with a `noindex, follow, noarchive` Hunt Brief unavailable page and a Check current Hunt action, which is the correct fail-closed state while Supabase is unprovisioned. Security headers verified live: CSP now including the Google Maps origins, HSTS, `X-Frame-Options: DENY`, `nosniff`, strict referrer policy and a camera/microphone-denying permissions policy that allows same-origin geolocation.
- Production environment variables are `NEXT_PUBLIC_SITE_URL`, `HUNT_SHARE_RATE_LIMIT_SECRET`, `RESEND_API_KEY` and `RESEND_SEGMENT_ID`. No Supabase or Google credentials are configured, so the live map runs its boundary view and Hunt Brief creation fails closed. Both are owner actions, not defects.

- Previous release commit `cc320ea` was pushed to `origin/main` and deployed by the Git integration as Vercel deployment `dpl_AyxwuxFYsYidRqC3DqKQNLZEKA56` (`https://ngbc-mgcc00j33-jaedens-projects-d98cdcfc.vercel.app`). The immutable deployment URL is Vercel-SSO protected; the public certification surface is `https://www.northgroundbushcraft.com`.
- Canonical production returns 200 for `/`, `/tools/season-finder`, `/hunting/species/ruffed-grouse`, `/apple-icon.png`, `/robots.txt` and `/sitemap.xml`; the apex permanently redirects 308 to `www`. Canonical URLs, Open Graph URLs/images, Twitter images and JSON-LD use the canonical origin. The sitemap contains home, Hunt and species and excludes recipient-specific share routes.
- The live Hunt evaluation at 45.23, -77.94 for 2026-09-20 resolved official WMU 57, returned `CONDITIONAL`, returned available Open-Meteo environmental context, retrieved canonical North Ground knowledge, and exposed official sources. This certifies only the documented narrow slice.
- One controlled production newsletter subscription returned 200 and a direct Resend segment-contacts query confirmed the address is a subscribed member. The test created durable provider state and did not send an email.
- Hunt Brief creation currently returns 503 because no Supabase project is provisioned (it returned 503 for the absent Upstash credentials before the migration; the fail-closed behaviour is identical). The UI displays a privacy-safe temporary-unavailability state, coordinates/raw location are excluded before transmission, and a valid-format recipient URL renders a noindex storage-unavailable page. Release status is therefore `PARTIAL`, with this external storage dependency as the sole open P1; P0 count is zero.
- Security headers verified live: CSP, HSTS, `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, strict referrer policy and a camera/microphone-denying permissions policy. No Google browser/server keys, database URL, PostGIS migrations or Google CSP origins are required by this release.

### Data
- `python3 research/hunting/validate.py` passed on 2026-09-20 for 66 jurisdictions, 68 authorities, 96 regulatory/scientific sources, 27 GIS records, 133 species, 56 aliases, 156 evidence rows, 66 regulatory mappings, 15 identification risks, 25 range records, 66 source-coverage rows and 25 content opportunities (0 warnings or structural errors).
- The research-scoped Canada candidate manifest now covers all 11 jurisdictions outside active Ontario/Québec ownership with 13 GIS candidates and 45 official regulation sources. `node scripts/validate-canada-source-reconnaissance.mjs` and its 4-test Node suite pass, enforcing exact jurisdiction coverage, unique jurisdiction/source/GIS IDs, authority, GIS/legal-standing/licence state, regulation state, readiness, blockers and future fixtures. Full findings and implementation order are in `docs/canada-source-reconnaissance.md`.
- Research counts remain research-only. The only locally certified production-shaped exception is the explicit Ontario WMU 57 / ruffed grouse 2026 slice described above.

## Agent Handoff Notes

### 2026-09-21 — Québec: shared changes other sessions should know
Cross-session messages from the Québec session expired unread, so these are recorded here.
- **Resolver.** The served resolver is unchanged. `resolve_management_zone_v2` is live beside it and answers identically to it for Ontario, Manitoba and Alberta; swapping it in waits on the owner. It does not fix their boundary distance (Known Problems).
- **Map (Hunt map session).** `zone_display_in_view` returns Québec only once its zones are promoted to VERIFIED. Québec's closed-territories catalogue is WFS, which `overlay-layers.ts` rightly skips. Its registry entry has no `zoneIndex`, so its cards carry `pointOnlyChecks`. The zones API now sends `officialTermPlural`.
- **Registry and engine.** The conditional overlays config requires `layersDescribedAs`; Manitoba's sentence is unchanged. A restriction that downgrades CONDITIONAL now drops `season` (`6571e5a`).
- **Official-GIS fallback.** A layer may declare `wfs`; the fallback asks it which zone contains the point and whether a zone record contains the 150 m disk. It reports near/not-near without a distance.
- **Parity script (American agent).** `certify-spatial-parity.mjs` has `--unverified`, `--samples FILE`, samples scoped to the adapter's own zone ids, and `certifiedOn` in `ZoneLayerSource.timeZone`. Add U.S. `EXTRA_CASES` on top.
- **Publisher.** A rule's own `effectiveFrom`/`effectiveTo` wins over the bundle's period; nothing else changed.
- **Hunt Brief (Canada clean-up).**
  - Creating a brief throws when a field exceeds its limit (authority > 120, summary > 700), so the whole share fails. Québec answers now fit, but any long listing can still hit this.
  - The 8-warning cap drops the rest silently.
  - A Québec moose brief lists `source:ontario-moose-habitat` as an official source, via a knowledge block.

### 2026-09-21 — Hunt map: remaining opportunities, in order
1. Build stored drawings for Ontario, Manitoba and Alberta (`build_zone_derivatives`, one jurisdiction at a time, not during another ingest), then set `mapGeometry: "stored"` on each; this removes per-view authority queries and Ontario's tiling.
2. When Québec is served, add its special-area catalogue (the Québec session's WFS overlays) to the zone index; the builder currently reads ArcGIS layers only.
3. Owner: widen the Maps browser key's localhost ports (see Known Problems).
4. Persisted map state (last view, chosen layers) is deliberately not built; add only with a product reason.

### 2026-09-21 — Manitoba: what is left, in order
Geometry, parity, the first rule wave, persistence, change detection and production certification are done. Remaining:
1. After any deploy, rerun `node scripts/certify-hunt-cases.mjs --base https://www.northgroundbushcraft.com --cases fixtures/hunt/ca-mb-certification-cases.json`. It must stay at 24 of 24, and an expectation is corrected only with a recorded revision.
2. Moose from Schedule C, in the same builder. Section 10.3's moose-season conditions already read those seasons for deer, so the parser work is half done. Then elk, black bear and mule deer.
3. The Oak Hammock Waterfowl Control Area needs a polygon built from M.R. 171/2001 s. 9(2)'s legal description, or an official one.
4. When a source moves: rebuild, read `diffConditionalBundles`' blast radius, re-certify, republish with `publish-regulations.mjs` (which verifies itself), and rerun `scripts/certify-hunt-cases.mjs` against production. The drill (`scripts/drill-manitoba-regulatory-change.mjs`) is the rehearsal.

### 2026-09-21 — Alberta: what is left, in order
Geometry, parity, serving and the first rule wave are done. Remaining:
1. Deployed and certified in production on 2026-09-21 (see Production).
2. Next species from the same tables and builder: mule deer (antler-point classes), moose (general and ■ by unit), then elk once the online/PDF divergence on late seasons (N17–D31 vs N17–D20) is settled with Alberta.
3. Ingest the Wildlife Regulation (Alta. Reg. 143/97) itself as the controlling text; the guide is a summary.
4. Everything the builder needs is in `scripts/alberta-source.mjs`; re-run `scripts/crosscheck-alberta-guide.py` whenever the PDF hash changes, because the builder refuses a cross-check made against a different PDF.

### 2026-09-20 — Remaining Canada source runway

Deep regulatory and GIS source reconnaissance is complete for BC, AB, SK, MB,
NB, NS, PE, NL, YT, NT and NU. This is research-only: no production GIS,
rules, migrations, UI or coverage state changed.

- Ready to begin a reviewed ingestion implementation: Manitoba, Alberta,
  British Columbia and Yukon. Yukon first needs the 445 service-feature versus
  443 stated-GMS discrepancy reconciled (done 2026-09-22: features 102 and 103
  are national parks and stay quarantined).
- Source review needed: New Brunswick's stable summary PDF is stale (2024–25),
  and Prince Edward Island's apparent no-comprehensive-zone model needs legal
  confirmation.
- Licence blocked: Saskatchewan's ArcGIS item says “Not for resale” despite a
  permissive government licence; Nova Scotia's useful deer/moose service has no
  item-specific licence.
- GIS blocked: Newfoundland and Labrador and the Northwest Territories expose
  official reference artifacts but no complete reusable vector system was
  found. Nunavut has geometry, commercial-reuse and authority-model blockers.
- Architecture finding: Nova Scotia, Newfoundland and Labrador, the Northwest
  Territories and Nunavut cannot be represented as one universal zone layer.
  Nunavut additionally needs TAH, allocation, assignment and authority-chain
  semantics; NWT's mobile Bathurst zone needs effective-dated geometry history.

Use `docs/canada-source-reconnaissance.md` for the implementation handoff and
`research/hunting/canada-source-reconnaissance.json` for exact endpoints,
fields, licence classifications, source hierarchy, change detection and future
fixtures. Do not promote a candidate to the production registry without the
normal endpoint/schema/version/licence and representative-query certification.

### 2026-09-20 — Canada rollout: where this stops and what is next
*Québec parts superseded on 2026-09-21: the geometry was found on the ministry's GeoServer and Québec is now certified and not served (see In Progress).*
**Last completed jurisdiction:** Ontario, now complete end to end — 151 units
parity-certified, 8 species, 146 rules, and the conditional question flow live
in the interface.

**Next jurisdiction:** Québec (Wave 1). It is blocked on one thing: the zone
boundaries are not published as open data. Structure is verified (28 zones,
1-24 and 26-29; zone 25 is fishing only, from quebec.ca). Searched Données
Québec for `zones-de-chasse`, `"zones de chasse"`, `faune chasse` and
`title:chasse` — no boundary dataset exists there. Try the service behind
Forêt ouverte (foretouverte.gouv.qc.ca) or ask MELCCFP directly.

**Sources discovered.** Québec: quebec.ca hunting-zone maps page (structure,
per-zone PDFs); diffusion.mffp.gouv.qc.ca carries wildlife protection districts
(CC-BY 4.0, usable) and structured wildlife territories (CC-BY-NC-ND 4.0, NOT
usable — non-commercial, no derivatives). Federal: ECCC publishes Québec
migratory-bird district boundaries under the Open Government Licence, updated
2025-06-17, but marked Draft and expressly of no legal value — it fails the
boundary standard and must not be ingested as certified geometry. Every other
jurisdiction's official source is named in the coverage registry.

**Sources still needed.** Québec zone geometry; Québec season tables; federal
migratory-bird district geometry with legal standing; everything for MB, SK, AB,
BC, NB, NS, PE, NL, YT, NT, NU.

**Migrations pending.** `supabase/migrations/20260921000400_conditional_regulatory_rules.sql`
is written and tested but NOT applied to the live project. Apply it, then run
`node scripts/publish-regulations.mjs` against both Ontario bundles. The
publisher now refuses to write a rule whose dimensions it cannot represent,
which is deliberate — extend schema and publisher together or not at all.

**Tests pending.** None failing. A Québec fixture set is needed before any
Québec rule is certified, and per §67 one coordinate is not a jurisdiction:
plan several interior, boundary and outside-province points.

**Known legal uncertainties.** Ontario WMU 51 (Algonquin) is governed by
provincial park legislation North Ground does not hold. Ontario controlled deer
hunts and moose controlled-hunter seasons are published but deliberately not
certified — both are allocated per hunt code or by draw and are not decidable
from location and date. In Yukon, NT and Nunavut, harvesting under Final
Agreements and land-claim agreements is a distinct legal context from licensed
recreational hunting; North Ground must never present a recreational result as
describing rights-based harvesting. Nova Scotia's management zones are
species-specific, which breaks the one-zone-per-point assumption everywhere
else. Newfoundland and British Columbia allocate big game substantially by
draw and Limited Entry Hunting respectively.



### 2026-09-20 — Ontario major game is NOT a bigger grouse table
Turkey, white-tailed deer, black bear and moose are the next species in the
canonical library without rules, and the small-game model cannot carry them
honestly. The published tables for these species turn on dimensions the current
schema has no field for: resident versus non-resident, licence and tag class, tag
validation, sex and age restrictions, firearm versus archery versus muzzle-loader
seasons, controlled hunts and draw allocation, and per-WMU conditions attached to
individual rows. A user who supplies only location, date and species has often not
supplied enough information for an unconditional answer, and the correct result is
CONDITIONAL with the missing dimensions named — not a season lookup that silently
ignores them. Extend the schema deliberately before encoding any of it.

### 2026-09-20 — WMU 51 is excluded from every small-game row, and that is a question not an answer
WMU 51 is Algonquin Provincial Park. It is named by no small-game season row in
the 2026 summary — not the grouse rows, not hare, not the cormorant row that
otherwise spans "1-50, 53-95". Hunting there is governed by provincial park
legislation rather than the general summary, which is the most likely reason.
North Ground does not currently hold that source, so every small-game query in
WMU 51 returns UNKNOWN with an explicit statement that an absent row is not
evidence of a closed season. Resolving this properly means ingesting the
Provincial Parks and Conservation Reserves framework, not inferring from silence.

### 2026-09-20 — Ontario ruffed grouse groupings, extracted and verified, ENCODED
The current Ontario Hunting Regulations Summary states ruffed grouse as four WMU
groups. Recorded here verbatim so the next pass encodes the authority's wording
rather than re-deriving it:

| Official WMU spec | Season | Limits |
| --- | --- | --- |
| `1-4, 16-18, 24-27` | September 15 to March 31 | Combined daily 5 / possession 15 with spruce grouse |
| `5-15, 19-23, 28-50, 53-67, 69B` | September 15 to December 31 | Combined daily 5 / possession 15 with spruce grouse |
| `68, 73-76, 82-84` | September 25 to December 31 | Daily 5 / possession 15 (no spruce grouse season) |
| `69A, 70-72, 77-81, 85-95` | September 25 to December 31 | Daily 2 / possession 6 (no spruce grouse season) |

The summary writes bare numbers while the GIS layer carries lettered sub-units,
so whether "68" means 68A and 68B is a legal interpretation, not a formatting
detail. It was settled by evidence rather than assumption: expanding each bare
number to all its sub-units makes the four groups partition 150 of the 151 units
with zero overlaps and zero units named that do not exist. A wrong reading would
leave dozens uncovered. The one unit the table never mentions is **WMU 51**,
which is also absent from the summary's other small-game rows — it therefore gets
no rule and must resolve to UNKNOWN. Absence from an open-seasons table is not
evidence of a closed season.

Two cross-year cases need care when encoding: "September 15 to March 31" runs
into the following calendar year, and "the last day of February" moves in leap
years. The same fetch also captured sharp-tailed grouse, ptarmigan, ring-necked
pheasant, gray partridge, cottontail and European hare, snowshoe hare and
squirrel groupings, which is Wave 3.

The schema for this already exists: `regulatory_groups` carries the authority's
`official_spec` verbatim alongside `regulatory_group_members`, and
`regulatory_rules.regulatory_group_id` lets one stated rule address many units
without duplicating it per unit.

**Encoded on 2026-09-20.** The bare-number reading was settled by evidence rather
than assumption: expanding each bare number to all its sub-units makes the four
ruffed grouse groups partition 150 of 151 units with zero overlaps and no unit
named that does not exist, and `scripts/build-ontario-regulations.mjs` asserts
that partition on every run. The sharp-tailed grouse and snowshoe hare tables
from the same page are encoded too. Ring-necked pheasant, gray partridge,
cottontail and European hare, squirrel, cormorant and the furbearer rows were
extracted but NOT encoded, because the canonical species library has no entity
for them; add the species first.


Keep temporary but important cross-agent coordination here.

Remove obsolete handoff notes once they no longer help future work.

- Shared foundation files created: `docs/content-system/*.md`, `src/lib/content-contract/{ids,types,index}.ts`, `scripts/validate-content-contract*.mjs`, `fixtures/content-contract/valid-bundle.json`, and `docs/technical-foundation-audit.md`.
- The fixture demonstrates validation only; it is not published coverage or evidence.
- Future stitching must compare Hunt/content implementations with `docs/content-system/INTEGRATION-HANDOFF.md` and adapt rather than create duplicate registries/APIs.
- Hunting research handoff: `research/hunting/HANDOFF.md`; counts/gaps: `research/hunting/COVERAGE-REPORT.md`. Research IDs follow the shared canonical convention, while legality remains in the regulatory domain.
- Integrated-slice ownership: `content/published/en-CA.json` is the published source/content registry; `src/lib/content/repository.ts` is the content boundary; `src/lib/hunt/` owns deterministic zone/weather/regulation composition; `/api/hunt/evaluate` is the bounded public evaluation surface. Do not merge regulation into App Blocks or import the research CSVs at runtime.

### 2026-09-20 — Route Architecture (decided)
Hunting content is namespaced under `/hunting/` with no trailing slashes; `/tools/{slug}` stays at the root. The flat `/species/{slug}` candidates in CONTENT-CONTRACT.md are superseded by `docs/content-system/ROUTE-REGISTRY.md`. Canonical IDs remain identity; applications resolve links through IDs and never construct path strings. Cross-vertical knowledge is promoted to a shared root with a 301 when a second vertical needs it, rather than duplicated.

### 2026-09-20 — Content Roadmap
`docs/content-system/CONTENT-ROADMAP.md` owns production order and the definition of done. Wave 0 is the render layer and blocks all content. Species x jurisdiction pages require material information beyond both parents before they may be created. Media must be accurate to the species or absent — a wrong species image is a factual error and, on identification pages, a safety failure.

### 2026-09-20 — Canonical URL Resolution (Wave 0)
`src/lib/content/urls.ts` is the single implementation of ROUTE-REGISTRY. Content records store canonical IDs and never store paths; pages, sitemaps, structured data and Hunt resolve paths through `canonicalPath()`. Entity types that intentionally have no page (`activity`, `source`, `content_block`, `equipment_item`, `product`, `management_zone`, `special_territory`) return null, and callers MUST treat null as "do not link" rather than constructing a fallback string. Jurisdiction IDs stay globally unique (`jurisdiction:ca-qc`) while routes nest (`/hunting/ca/qc`). Covered by `npm run test:content-urls` (9/9).

### 2026-09-20 — Production
Superseded by the current Production validation section above. The earlier apex/canonical issue is resolved: `NEXT_PUBLIC_SITE_URL` is the `www` origin and the apex now redirects permanently with 308.

### 2026-09-23 — Agreeing with the GIS service is not agreeing with the law
Michigan's open-data DMU layer still publishes DMU 351 and DMU 352, and still publishes the
limited-firearms deer zone. Michigan's own 2026 Deer Hunting Regulations Summary says 351 and 352
"have been rescinded" and the limited firearms deer zone "has been eliminated". All 115 rows carry
`Year = "2026"`; the rescinded rows were last edited 2026-09-22. Nothing in the data distinguishes
them. Verified live twice through the browser pane — curl and WebFetch receive 403.

**A fifth instance of the sentinel class, and the first one inside a GATE rather than a dataset.**
Map-lane parity certification asks whether North Ground draws what the authority's service
publishes. When the service is itself stale, that check PASSES while the map is wrong: a hunter
would be shown a rescinded unit as current, certified. Service parity is necessary and not
sufficient. A map lane is certified only when it also agrees with a REGULATORY product — the
regulations summary, the hunting guide, the regulation itself. **Idaho was believed safe by method
and was not**: checked against the fixture rather than left as a belief, its MAP lane was certified
against IDFG's GIS service alone (`fixtures/hunt/us-id-gmu-live-parity.json`, 99 units, 708 points,
0 disagreements), and the Hunt Planner cross-check belongs to the RULES lane, where it reached 42 of
99 units — `content/regulatory/us-id-certified-units.json` already records that split. So 57 units
are drawn and resolvable having never been checked against any regulatory product, and the unit LIST
never was. Thirteen lanes service-only, not twelve plus a safe one. An audit is
open with Canada: for each certified Canadian layer, was it certified against the service ALONE,
or also against a regulatory product. A layer in the service-only column is not thereby wrong — it
is unverified against the law, which is a smaller claim than our certification currently implies.

Michigan stays held, and UNAVAILABLE is the correct answer while it is. The rescinded units may be
excluded only by an explicit sourced list from the instrument that rescinds them, never by a rule
inferred from the data. The summary is not that instrument and is not the complete legal picture
either: it never mentions DMU-333, DMU-419 (two different Lansing CWD geographies), DMU-486,
DMU-487 or DMU-499, yet it sells a "DMU 487 antlerless deer license". The Wildlife Conservation
Order is unread. These are recorded as UNREAD, not as absent.

One Michigan fact reshapes the containment contract: universal antlerless use limits are set "by
DMU in the Upper Peninsula and by county in the Lower Peninsula". The governing geography is not
the same KIND of thing in the two halves of one state — a further reason precedence is never
inferable from unit numbers, and a case where the governing geography may not be in the DMU layer
at all.

### 2026-09-23 — Audit answer: all twelve Canadian spatial certifications are service-only
Asked whether any certified Canadian layer was certified against a regulatory product as well as
against the authority's GIS service. **None was.** Every certification fixture's `sourceUrl` is a
GIS endpoint — Alberta MIMAS, BC openmaps WFS, Manitoba ArcGIS FeatureServer, Ontario LIO, Québec
GeoServer, Yukon GeoYukon MapServer, NL WLD_BigGameManagementArea, NS Socrata, NB gis-erd-der, PE
StatCan. Zero cite a regulations summary, hunting guide or regulation.

It is true **by construction, not by accident**: `audit-zone-certification.mjs` asks the
authority's SERVICE for its inventory and then resolves parity points against that same service.
The question it answers is "does North Ground's copy match the service", and it cannot answer any
other. So the Michigan finding lands on every Canadian lane. A layer in this column is not thereby
wrong — it is unverified against the law, a smaller claim than the certification currently
implies.

Regulatory cross-checks that do exist are incidental, and none is part of certification:
- **Prince Edward Island** — strongest, and about EXISTENCE rather than inventory. "PEI publishes
  no hunting zones" came from the Wildlife Conservation Act Hunting Regulations text itself (zone
  0, county 0, district 0; Schedule 2 province-wide), corroborated by the Migratory Birds
  Regulations' "Throughout Prince Edward Island". Geometry is StatCan's; the regulatory claim is
  law-verified.
- **Alberta** — cross-checked today as a by-product of the federal work: Migratory Birds
  Regulations Schedule 3 names Alberta's WMUs explicitly, every named unit exists in our certified
  inventory, 177 of 179 fall in a federal zone.
- **British Columbia** — the RULES bundle carries `officialIdentifiers` (225) read from B.C. Reg.
  190/84, matching the service's 225. A real law-vs-service inventory check, but the SPATIAL
  certification does not consult it.
- **Yukon** — 445 service features reconciled against "the 443 subzones Yukon states", but the
  comment does not record WHERE Yukon states 443. That provenance gap is itself a finding.
- **Nova Scotia** — total area against the province's published ~55,284 km². Plausibility, not
  inventory, not a regulatory product.

No regulatory cross-check of any kind: **Ontario, Québec, Manitoba, New Brunswick, Newfoundland
(all three layers).**

**The instrument for five provinces already exists.** Schedule 3 of the Migratory Birds
Regulations enumerates provincial units BY NAME for British Columbia, Alberta, Saskatchewan,
Ontario and Québec ("District No. 1 means Provincial Management Units 1-1 to 1-15"). That is a
federal regulatory product independently listing five provinces' units, from a different authority
than the one publishing the service, and the federal build already expands and verifies those
references — so the check is nearly free. It cannot detect everything: a unit rescinded
provincially may still be named federally, and the federal list is itself dated. It gives nothing
for MB, NB, NS, NL, PE or YT, which need their own regulatory product read.

**A cheaper tripwire worth considering first:** most provinces publish a unit COUNT in their
hunting summary. A mismatch does not say which unit is wrong, but it is fast and it is exactly
what Michigan would have failed (115 rows including two rescinded). Yukon's 443 is that check
already, done informally with its provenance unrecorded.

**Recommendation carried to the owner: make law-certification a SECOND, SEPARATE certification
with its own name and state, rather than widening the existing one.** The current certification's
claim is true and useful — it is what catches an ingest defect — and widening its meaning would be
the same mistake avoided with serving/rulesServing and with RESOLVED-vs-containment. Two facts:
"MAP CERTIFIED: service" and "MAP CERTIFIED: law".

**Canada's answer to the containment contract, measured rather than recalled: no Canadian layer
nests within itself.** 73 bounding-box candidates across all certified layers, ZERO true
containments, maximum overlap 0.206% — boundary slivers. Canadian overlap is only ever
species-scoped or cross-authority, so within-layer nesting is a US-shaped mechanism and the
contract should say so. And Michigan's by-county fact is a stronger constraint than nesting: if
antlerless limits are set by DMU in the Upper Peninsula and by county in the Lower, the governing
geography may not be in the DMU layer at all, which a model that only orders units WITHIN one
layer cannot express.


### 2026-09-24 — Homepage semantic/search discovery layer certified
The homepage now preserves the existing immersive North Ground entrance while adding a
server-rendered discovery layer that explains North Ground's current hunting product surface.

The crawlable homepage now has exactly one H1: "Canadian hunting knowledge, built for the field."
It introduces North Ground Hunt, distinguishes zone/species/season discovery, and provides real
crawlable links to `/hunt` and `/hunting/species`. No future jurisdiction or zone destinations
were invented.

Certification passed:
- `git diff --check`
- `npm run typecheck`
- scoped ESLint
- `npm run test:seo` — 9/9 passed
- `npm run test:content-urls` — 22/22 passed
- `npm run build`
- post-build `npm run validate:seo`
- production artifact inspection confirmed meaningful prerendered homepage content, exactly one H1,
  and crawlable `/hunt` and `/hunting/species` links.

The initial pre-build SEO-validator attempt failed only because `.next` did not yet contain a
production build; after `npm run build`, the required post-build validator passed.

### 2026-09-24 — Hunting discovery hub established
`/hunting` is now the crawlable parent discovery hub between the main North Ground site and the
Hunt/species surfaces. It is deliberately separate from `/hunt`: `/hunting` explains and organizes
the hunting knowledge/product surface, while `/hunt` remains the interactive regulatory tool.

The hub is server-rendered and statically prerendered. It has one H1 (`Hunting`), canonical
metadata, crawlable paths into `/hunt` and `/hunting/species`, and derives current mapped
jurisdictions from `ZONE_LAYERS` rather than maintaining a second hand-written coverage list.
Boundary coverage is explicitly distinguished from served regulatory coverage; the hub does
not infer certification from `rulesServing`, and no jurisdiction or zone destination was invented.

The information hierarchy is now Home → Hunting → Species library → canonical species profile.
Species-profile breadcrumbs include `/hunting`; the species library exposes the Hunting parent;
`HuntNav` exposes the Hunting hub; and `/hunting` is included in the generated sitemap.

Certification passed:
- `git diff --check`
- `npm run test:seo` — 9/9 passed
- `npm run validate:seo`
- `npm run test:content-urls` — 22/22 passed
- `npm run build`
- production build output confirmed `/hunting` as statically prerendered
- source inspection confirmed exactly one `/hunting` H1 and real links to `/hunt` and
  `/hunting/species`.

The unrelated untracked media files and `supabase/.temp/` were not part of this change.

### 2026-09-23 — The detector sweep, handed off part-done
A pattern written from the first jurisdiction that needed it works perfectly on that
jurisdiction and silently mislabels every other one. Three confirmed instances before the sweep
began — `"Provincial Management Units"` vs `"Provincial WILDLIFE Management Units"`, the
district-portion classifier, and `/\(in Provincial/i` — and the sweep found a fourth before it was
paused. **It is unfinished. Whoever resumes the Canada lane finishes it BEFORE building the 39
recoverable rows**, because two of those rows' refusal reasons are wrong for this reason.

The form required is which jurisdictions' ACTUAL WORDING a pattern was checked against — not
whether it looks general. A pattern verified against fewer than all seven is a finding whether or
not it is currently wrong.

| detector | verified against | status |
|---|---|---|
| `/resident/i` | all 7 jurisdictions carrying the concept, 47/47 | clean |
| `/\(in Provincial/i` | Alberta only (2/2); Ontario 10/12 | **misses BC entirely — 22 rows** |
| `/plus an additional/i` | PE, NS, NB, MB | **misses BC — 3 rows** |
| `/\(from [A-Z]/i` | Prince Edward Island only | one jurisdiction — a finding by the standard |

Unswept: `^No open season$`, `^No limit$`, `^N/A$`, `^\[Repealed`, the
`(Districts|Zones|Units)` conjunction plural, `PORTION_OF_A_UNIT`, the definitions parser, and
`expandRange`'s two forms.

**The extra-allowance miss is not a live defect, and WHY it is not is the finding.** BC writes the
allowance as a new sentence — `10 (not more than 5 may be Ross's Geese). An additional 5 Snow
Geese may be killed or taken in Provincial Management Units 2-4 and 2-5` — so `/plus an
additional/i` never matches. Zero encoded rules carry that cell, but **they are refused by
`readLimit`, not by the allowance detector**: the cell ends in `2-5` rather than a closing paren,
so it matches neither limit form and returns null. A strictness written for something else is what
stopped a bag of 10 being published where the law allows 15 in two units. **The guard that held
was not the guard designed for it**, which is luck, and luck is not a control. The safety survives
the 39-row work — `readLimit` refuses that cell regardless of whether its season becomes readable,
verified specifically — but two of the three refusal REASONS are wrong, which is the same
mislabelling class and must be fixed in the same pass.

**A refusal reason is itself a claim, and it can be wrong while the refusal is right.** §8 now
requires refusal metrics to use stable classification semantics; this adds that they must also be
accurate, because a stable-but-wrong reason misleads exactly as much as a reordered bucket.

## A Field Shape Is Not The Fact — Five Instances In One Day (2026-09-30)

*Recorded by the Canada regulatory lane. Landed as 967675b, 6b809e7 and the commits
that follow.*

Five defects in one day share one move: a FIELD SHAPE was read as a LEGAL FACT.
Two arose from bad data; three were **created by a correct fix**, which is why the
pattern is worth a section rather than five bullets.

**1. Québec's antler threshold lived in a French display string.** « Cerf de
Virginie avec bois (7 cm ou plus) » carried the legal test as prose in
`classLabel`: unqueryable, uncomparable against Ontario's 7.5 cm, and reading as
coverage while computing as nothing. Now `legalAnimalClasses` with a structured
`PhysicalCriterion` — measure, comparator, published values in the authority's
own units, aggregation, wording and language.

**2. And encoding it made a WRONG ANSWER reachable.** Zone 6 nord and 6 sud
publish « avec bois (norme RTLB) », which the builder flattened to
`animalClasses: ["ANTLERED"]` — the same value « avec bois (7 cm ou plus) »
flattens to. Eight rules therefore resolved to the 7 cm class while the RTLB
class sat in the same bundle with its unresolved blocker, pointed at by nothing.
A hunter under a standard North Ground cannot state would have been handed a
number from a different one, at the moment of the shot. Rules now carry
`legalAnimalClassIds`: which legal class, by canonical id.

**The rule: the word is a filter; it is not an identity.** Ontario's 7.5 cm,
Alberta's 10.2 cm and Québec's 7 cm are all "ANTLERED".

The RTLB threshold itself is NOT published on the ministry's deer page, which
describes an RTLB as « basée le plus fréquemment sur le nombre de pointes » — a
statement about RTLBs in general — and links a 6 nord / 6 sud experiment that
ended in spring 2022. Those eight rules are UNRESOLVED with the blocker named.

**`criterionStatus` distinguishes four absences that used to be one.** A class
with no criterion was either "the authority measures nothing" (a turkey's beard)
or "we could not resolve the test" (RTLB) — identical bytes. STATED,
NOT_MEASURED, BY_NEGATION, UNRESOLVED, with `classDefect()` refusing the
inconsistent combinations and a cross-bundle contract test enforcing it over the
published corpus rather than beside one builder.

**3. `filled()` accepted `false`.** `declaredNoSeason: false` — "this rule is not
a declared closure" — counted as a resolved date on 119 of Ontario's 135
major-game rules, whose seasons sit in `seasonPhrase` as "September 19 to
December 15" without a year. The measure built to catch facts living in display
strings was certifying a display string as a fact.

**4. Animal class was read from one home when the corpus had two.** Alberta
states it inside `appliesWhen` as `ANIMAL_CLASS:ANTLER_CLASS`; 20 deer rules that
DO state a class read as classless.

**5. Ontario's certified rules understated the law on crossbows** — the
over-strict direction §8 says nobody reports, because a refusal always looks
defensible. A hunter filtering for a crossbow was told there was no opportunity
where the law provides one. The opposite error any hunter who reads the
regulations would catch; this one is invisible to them.

The chain, from the instruments rather than from North Ground's own second-hand
method table:

- O. Reg. 670/98 Tables 1/5/8 give a "Class of Firearm" NUMBER per season;
- O. Reg. 670/98 s. 6 sends that number to O. Reg. 665/98 s. 69;
- s. 69's Table: "Class 1 … Bow" — also classes 2, 3 and 7; not 4, 5 or 6;
- s. 82: "A person shall not hunt big game with a bow unless it is a CROSSBOW
  OR LONG-BOW", ≥45 kg crossbow / ≥18 kg long-bow for deer and woodland
  caribou, ≥54 kg / ≥22 kg for bear, American elk and moose;
- s. 79 (1) (b) and (3): the same for wild turkey, at ≥45 kg and ≥18 kg.

**Widening is safe in Ontario and is NOT safe in Québec**, and the reason lives
in `gear-class.ts` where the next person changes the code: Québec's types 11 and
12 share their entire bow-and-crossbow definition while only type 11 is exempt
from hunter orange, so a list holding both cannot tell which applies. Ontario's
exemption is scoped to the SEASON — s. 26 (1) (a) exempts "the seasons
restricted to the use of bows only" — and s. 82 puts both implements inside
"bows".

**Fixing it broke two more of the same shape, immediately.** `bowsOnly` was
`length === 1 && [0] === "BOW"`, so every bows-only season silently started
REQUIRING hunter orange — the requirement §62 places closest to safety. It
failed in the survivable direction; the mirror would not have. And
`permitted.length >= 4` stood for "nothing is restricted here": true while four
implements existed, and with five a season permitting four reads as unrestricted
while the hunter it excludes is never told.

**The cause behind three of the five is TWO HOMES FOR ONE FACT.** Implements in
three shapes, animal class in two, and "what may I hunt this with" in both the
certified rules and a one-line widening inside Ready to Hunt. Each side was
internally consistent, which is why nothing surfaced the disagreement. Readiness
happened to be right, which is luck rather than architecture.

## Ontario's Seasons Are Rules "In Any Year" (2026-09-30)

O. Reg. 670/98 does not print dates. Table 5 item 1 reads "From September 1 to
the Friday preceding the Saturday closest to October 8, IN ANY YEAR." The
regulations summary prints one year's answer with no year on it, and a guide's
derivation is not the law.

**All 56 distinct date segments the ministry published for 2026 are reproduced
by the instrument's own rules resolved for 2026.** Two independent derivations
agreeing on every segment. 72 of Ontario's 74 season phrases resolve; the two
that do not are an extraction artefact with no separator between its endpoints,
and the alternating-weekly construct, which is not a window and is refused.

`relative-date.ts` was EXTENDED, not replaced: `WEEKDAY_CLOSEST_TO`, the general
nested `WEEKDAY_FROM`, the start-anchored `WEEKDAY_FROM_START` and
`DAY_IN_START_MONTH`, and `NAMED_DAY` for Labour Day and Thanksgiving Monday
(Canadian definitions only — a bare "Thanksgiving" would be November in the
United States). The three earlier kinds keep their names so no certified federal
record changes shape, and all four now resolve through one `weekdayFrom`.

**"following" was deliberately refused and is now verified, not waived.** The
module's own comment said no published date had confirmed the reading and that
the wave needing it would verify it. Federal coverage is unchanged at 150 parsed
of 723, resolving to byte-identical dates.

**The window split can no longer be the first " to "**, because Ontario's
operators contain one. Every separator is tried in order and the first split
where both halves parse whole wins — which keeps the property the original rule
protected rather than its mechanism: a trailing qualifier still fails every
candidate, so a row whose dates are right only for some hunters or some land
stays unencodable.

Still to do, and all in the same table rows: extracting Table 5/8/2/7.2 into
rules with the class-of-firearm number, both residency columns ("Closed season"
appears in one while the other is open — WMUs 76A–81B archery is residents
only), and bag, possession and age limits.

## Alberta's Aerial Surveys — The First Absolute Big-Game Density (2026-09-30)

77 Wildlife Management Units of animals per km² across moose (31), mule deer
(26), white-tailed deer (13) and elk (7), with Alberta's own 90% confidence
interval, survey year and method. Every other big-game heat value North Ground
held is HARVEST — a record of hunting, which tracks access and effort as much as
animals. §41B prefers density over harvest at the same resolution: the
resolution does not improve, what the number MEANS does.

`surfaceSitesFrom` REFUSES these records with reason AREA_EVIDENCE and names
every offending record, tested against the published bundles rather than
remembered at render time. Flown in January and February, when ungulates are
yarded against snow; every bundle carries the months and says that autumn is a
different question.

**Each bundle now records what was NOT read**, because the refusals were being
counted, printed and dropped — the fourth instance of evidence built, committed
and unreachable. `reading` carries reports read, reports and rows refused, the
shapes with counts, and a worked example of each. Remaining and declared: 59
ROW_SHAPE, 14 reports whose titles name no WMU, 1 malformed density in Alberta's
own document ("White-tailed Deer 2003 Total Minimum Count 388 0.0.19", refused
rather than coerced).

**"We could not read it" and "there is nothing to take" are different
findings**, and calling both ROW_SHAPE hid the larger behind the smaller:
Alberta publishes minimum total counts with no surveyed area, so 21 rows are
read perfectly and the authority published no density. Reporting them as parse
failures invited someone to fix an extractor that was working.

---

## Atlantic Canada And New Brunswick Answer — And Nova Scotia Shipped Broken First (2026-09-30)

*Recorded by the Canada regulatory lane. Landed as the Nova Scotia bundle, its
fix, Newfoundland and Labrador, and New Brunswick.*

Three jurisdictions went from certified geography and zero rules to answering, in
one day: **Nova Scotia** (11 rules, 8 species), **Newfoundland and Labrador** (13
rules, 3 species, 100 areas) and **New Brunswick** (15 rules, 11 species, 27
zones). `coreGameComplete` moved 5 of 11 → 8 of 11; certified rules 556 → 595;
species 12 → 19. Jurisdictions with geography and no rules: 6 → 3.

### Nova Scotia answered CLOSED everywhere, in production, and eleven tests passed over it

The most important thing in this section is the failure, not the coverage.

The Nova Scotia bundle landed and **answered CLOSED for every species in every
zone**, including deep inside seasons it encoded correctly. A hunter in Deer
Management Zone 104 on 15 November was told deer hunting was closed, with the
Wildlife Act quoted underneath as the authority for it.

    as-shipped shape  -> CLOSED
    fixed shape       -> CONDITIONAL

**The cause.** `areaOf` resolves a point's zone id to an authority IDENTIFIER
through the bundle's `units`, and `appliesInWorld` matches that identifier against
a rule's `include.ghas`. The bundle held zone ids in both, and `units` as a bare
array of strings rather than `{identifier, zoneId}` pairs — so `unit.zoneId` was
undefined, `areaOf` returned null for every point in the province, and not one of
eleven rules applied. Three required rule fields (`notes`, `disputes`,
`sourceVersion`) were also absent and crashed the engine the moment the geography
started matching.

**Why nothing caught it.** All eleven Nova Scotia tests passed, and all eleven read
the BUNDLE — windows, closures, conditions, negative controls. Not one asked the
ENGINE for an answer. **A test that asserts the data you just typed cannot fail,
whatever the data says.** TypeScript could not help either: a bundle is JSON loaded
with an import assertion and cast through `as unknown as`, so nothing checks its
shape between the producer and the hunter.

Two guards now exist, and both have positive controls so they cannot pass by
covering nothing:

- **`src/lib/hunt/regulatory/engine-answers-somewhere.test.ts`** — for every
  conditional bundle in `content/regulatory/`, a real point in a real area on the
  MIDPOINT of a real window must not answer CLOSED. Reproducing the shipped shape
  in memory makes it fail; the fixed shape passes. A bundle neither driven there
  nor named as evaluated elsewhere fails the wiring check.
- **`src/lib/hunt/regulatory/bundle-condition-provenance.test.ts`** — a second
  defect in the same bundle. All ten Nova Scotia conditions carried `citation`
  where the contract says `sourceId` and `sourceSection`, so every condition
  reaching a hunter — a licence requirement, a bag restriction, the Sunday
  prohibition — had BOTH provenance fields undefined, which is exactly what
  `condition.ts` says the design exists to prevent. Swept all six bundles: Nova
  Scotia was the only one, 10 of 10. The sweep also removed a bare top-level
  `contentHash` that nothing verified and no permitted snapshot could verify
  against, which `source-rights.ts` already forbids.

### Two reporting defects the same work exposed

- **`unitsDeclaredClosed` counted only closure by SILENCE.** Newfoundland's six
  closed caribou areas reported as zero closed, and so did Nova Scotia's
  province-wide moose closure — which now reads 12 covered / 12 closed. A closure
  the authority states outright is the most useful thing a coverage report can
  show. `conditionalCoverage` now returns `unitsDeclaredClosedByRule` separately
  and the registry sums the two; they cannot double-count, because a unit closed
  by an explicit rule is a unit the rules reach.
- **One unit count per jurisdiction is wrong wherever species have separate
  geographies.** Newfoundland manages each big-game species in its own areas — 74
  moose, 19 caribou, 7 black bear, 100 polygons over the same ground — so a single
  denominator reported moose CLOSED in 26 units that are caribou and bear areas,
  and caribou CLOSED in 81 that are not caribou areas at all. Closures no hunter
  could ever be shown, because the layers are species-scoped. `conditionalCoverage`
  now honours `officialUnitCountBySpecies`; §8 requires capability reporting to
  measure deliverable answers.

### Newfoundland and Labrador — the seasons are in ORDERS, not in a regulation

The Wild Life Regulations (CNLR 1156/96) carry no dates at all. s. 38 delegates
them to ministerial order, s. 39(1) makes hunting lawful only inside an order's
season, and **s. 89, "Closed season except by order", reads "In relation to any
wild life species that is not named in an order made under these regulations,
there is no open season."** So the bundle is built from the annual **Open Seasons
Hunting and Trapping Order, 2026-2027 (NLR 43/26**, filed 7 August 2026, marked
"This is an official version") for the dates, and three standing species orders
for the areas. A new licence year is a new Order.

It is genuinely two answers. Island moose closes 31 December; Labrador moose runs
to 14 March. Labrador black bear opens 10 August against the Island's 12
September. Caribou has four Island windows and, by declaration for conservation in
s. 8, **no Labrador season at all**. The Island/Labrador split was derived from the
Moose Hunting Order's own wording for each of its 76 named areas — Schedule B's
entries open "All that area of Labrador" — rather than from a numeric range,
because the ranges interleave (Labrador is 48-60 AND 84-96) and **area 51 is
"Baikie Lake" in Labrador in the Order while the province's own map service calls
the same area "Grand Falls"**, which reads as an Island town.

Findings recorded rather than smoothed over:

- **Six caribou areas are closed and the department's guide names three.** 63, 65
  and 69 are in the guide; 73, 74 and 75 are equally unnamed by the Order and
  equally tagged CLOSED by the province's map. A hunter reading the guide's closed
  list would infer three open areas that are not.
- **A GIS attribute contradicted a filed regulation.** Caribou area 071 is tagged
  `status_ope: CLOSED` in the service while NLR 43/26 opens it 12 September to 30
  November and the guide prints the same dates. The Order is the law; the attribute
  is stale administrative metadata. **If a GIS attribute is ever used as a legality
  input anywhere, that is a bug.**
- **Black bear area 200 is not a management area in law.** The Order's Schedule
  describes 201-206 only, all on the Island; 200 exists solely in the map service,
  named "Labrador". It answers correctly because s. 6 sets the Labrador season for
  Labrador as a whole — but `officialNamePrefix` renders it "Black Bear Management
  Area 200", asserting a legal object no order creates. §41A zone-presentation
  defect, open: `zone-presentation.ts` needs a row naming it "Labrador".
- **Moose areas 100 and 101** are 3 km Trans-Canada Highway buffer corridors that
  OVERLAP the numbered areas, with no geometry from the province and its own note
  that "MRZ maps are for general reference purposes only". The numbered area's
  answer is still right; the MRZ licence opportunity is what is missing.
- **Gros Morne and Terra Nova run their own moose hunts** in park sub-areas ("2E:
  Zone 1" to "2E: Zone 4", "28A") the provincial order does not describe, with 90
  licences from Parks Canada. The province quarantines both park polygons, so no
  zone resolves there and **nothing may read as saying moose is closed inside a
  park**.
- **Legal hours are Island-only, deliberately.** The rule is province-wide and
  certain (s. 42(2) inverted), and unlike Nova Scotia the province defines sunrise
  nowhere, so our astronomy is the right instrument. The CLOCK is not certain:
  Labrador keeps two — most of it Atlantic Time, a southeastern coastal strip
  Newfoundland Time — and where that line runs is not certified. Thirty minutes
  wrong at both ends puts a hunter shooting before it was lawful, so Labrador
  states the rule and declines the window.

The three NL layers also carried a stale authority name, "Department of Fisheries,
Forestry and Agriculture". The Order is signed by the Minister of **Forestry,
Agriculture and Lands** and the guide says the same throughout. Fixed; worth
sweeping the other jurisdictions for the same thing.

### New Brunswick — standing rules, so no annual ingest

Every window in Hunting Regulation s. 11(1) ends in the word **"annually"** and is
written as an ordinal over weekdays, and 94-47 s. 2 defines "moose season", with
reference to any year, as the Tuesday to Saturday of the last full week of
September. The regulation is standing law: the dates are DERIVED by
`scripts/nb-dates.mjs` and both forms are stored, so a bundle for 2027 is one
constant.

"The last full week of September" does not say where a week begins, and three
provisions turn on it. The derivation computes it under BOTH conventions and
THROWS if the Tuesday, the Saturday or the preceding Saturday differ. For 2026 and
2027 they agree — a checked fact, not an assumption.

- **Deer is three answers by zone**, and this is the first Canadian bundle where
  the ZONE changes a season's LENGTH rather than only its conditions. s. 11.1(1)
  closes zones 4, 5 and 9 to antlered deer entirely; s. 11.1(3) gives zones 1, 2
  and 3 antlered only and five consecutive weeks instead of eight; every other
  zone has eight.
- **The crossbow is INCLUDED in the opening weeks** (s. 11.2), the opposite of
  Newfoundland, whose pre-season is a long bow or compound bow and expressly not a
  crossbow. Anyone who assumes archery means one thing across provinces encodes one
  of the two wrongly; the falsification moves the crossbow between them.
- **Antlerless deer is not answered in either direction.** Its season is certain —
  the same eight weeks — but s. 3.1(4.1) lets the Minister set a quota of ZERO for
  a zone, which closes it without amending any regulation, and the quotas are
  published nowhere. The closure in zones 4, 5 and 9 accordingly reads "closed to
  antlered deer", not "closed". Same for the moose quota per zone.
- **The muzzle-loading week is not claimed.** s. 3.11(1) reserves the week
  beginning the seventh Monday after the first Monday in October to muzzle-loaders,
  and only in the zones where antlerless deer may be hunted — the same unpublished
  quota. So every deer rule is certified to 22 November rather than to the 29th the
  eight-week grant reaches.
- **Hunter orange is a regulation with a measurable minimum.** N.B. Reg. 81-58
  s. 3(1): a solid hunter orange hat AND at least **2 580 cm²** above the waist,
  with "hunter orange" defined as an L value of at least +55.0 Judd units, a at
  least +65.0, b at least +30.0 on a HunterLab instrument. It applies only from 1
  September to 31 December (s. 5), so it does NOT reach the spring bear season, and
  s. 3(2) excepts bow and crossbow deer hunters in the first three weeks **only
  while hunting from a tree stand or ground blind**.
- **The province gave up its sunrise table**, which is why computing is right here
  and wrong in Nova Scotia. Old Act s. 34, "Times of sunrise and sunset", was
  repealed by 2021, c.12, s. 2 and replaced by s. 109.1, making a Herzberg
  Astronomy and Astrophysics Research Centre confirmation or an ECCC
  climatologist's certificate proof of the time. No table is the law; our
  astronomy is the right instrument — and s. 109.1 also makes plain that our value
  is not the legal PROOF, which is the strongest reason yet for the inward
  precision margin.

**The currency banner nearly cost us the province.** Every page on `laws.gnb.ca`
prints "Current to 1 January 2024", the Act's included. Each regulation then ends
with its OWN note and they differ: the Hunting Regulation is consolidated to 26
July 2024, the Moose Hunting Regulation to 21 April 2026, the Wild Turkey
Regulation to 30 March 2026. The Hunting Regulation also cites amendment 2024-42
inside s. 11(1)'s own history, which a document current to 1 January 2024 could not
contain. Reading the banner as a currency statement would have recorded New
Brunswick as two years stale and refused it — §8's unnecessary-refusal direction,
the one nobody reports because a refusal always looks defensible. **Worth checking
wherever else a site banner has been taken for a consolidation date.**

New Brunswick is also **the first jurisdiction where §41A's two fee certifications
both hold**: s. 3(1) states each fee in the same paragraph that defines what the
licence authorizes, and the regulation carries its own consolidation date. Class I
$173, II $72, III $29, IV $14, guide exemption $150, antlerless application $4.
They are recorded in the bundle's `licenceClasses` and NOT surfaced, because what
is still unestablished is what the figure EXCLUDES — HST and any vendor surcharge
sit outside the regulation, as Newfoundland's guide shows by naming a $3.00 vendor
fee its own regulation does not. **If fees are to be shown, the missing piece is a
certified statement of the exclusions, not the figures.**

### Nova Scotia, for completeness

11 rules over 8 species from six codified instruments. Three things carried
forward: `licenceYear` is null with the negative control recorded ("licence year"
occurs zero times across eight instruments while "open season" occurs 48 times in
the Regulations alone); `certifiedPeriod` ends 2026-12-31 because almost every
window is a weekday ordinal and the derivation is certified for that year alone;
and the hours are a PUBLISHED TABLE — General Wildlife Regulations s. 11(3)
defines sunrise and sunset as the values tabulated in Schedule A for Yarmouth,
Halifax and Sydney in AST, with no interpolation formula — so no clock is offered
rather than a computed one. **Six prohibition orders under Wildlife Act s. 21 are
in force whose consolidated text the Registrar does not publish**, so in six named
localities North Ground knows a prohibition exists and cannot read its extent;
that is a standing limitation on every Nova Scotia answer.

### What each remaining jurisdiction is blocked on

- **Saskatchewan** — 83 WMZs, live-service only by owner decision (Standard
  Unrestricted Use Data Licence v2.0 grants commercial reuse and the same item
  adds "Not for resale"). The seasons instrument is under investigation.
- **Prince Edward Island** — the 11-page Wildlife Conservation Act Hunting
  Regulations consolidation contains ZERO occurrences of "open season", so the
  dates live in an instrument not yet located. Its `/en/legislation/` paths are a
  soft-404 shell that redirects into a robots-disallowed `/en/search/`, and a
  browser attempt produced a Radware CAPTCHA. **That route is closed and is not to
  be retried.** The permitted paths are `/sites/default/files/legislation/` and
  `/sites/default/files/publications/`.
- **Yukon** — `yukon.ca`, `laws.yukon.ca` and `legislation.yukon.ca` all return 403
  behind a Cloudflare challenge, and it is the HOST rather than a path. Its DATA
  hosts answer normally (`open.yukon.ca` 200, `mapservices.gov.yk.ca` 200). The
  territory publishes its geography openly and challenges its law.

Also open from this work: **wild turkey** (N.B. Reg. 2021-30, retrieved, not
encoded) and **fur harvesting** (N.B. Reg. 84-124) in New Brunswick; NL's small
game, coyote, wolf and fur bearers, whose Island geographies are small game
management areas and named islands North Ground does not hold, while **Labrador's
small game seasons are region-wide and would answer if a Labrador extent were
served**; and the species the sources themselves do not name — New Brunswick's
"squirrel" and "cormorant", plus groundhog, which needs canonicalizing.
