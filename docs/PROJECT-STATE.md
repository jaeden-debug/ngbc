# North Ground — Project State

> Living operational state.
> Read `../CLAUDE.md` first.
> Update this file after material project changes.

Last updated: 2026-09-23 (**British Columbia serves rules** — a first wave of 79 rules over seven species reaching 221 of 225 units, 20/20 production cases, three disputes preserved as CONFLICT; coreGameComplete 5 of 11. Earlier the same day: **Canada spatial complete**: all 11 in-scope provinces and territories have parity-certified official geography, Prince Edward Island last, served at geography level JURISDICTION because the province publishes no units. Rules remain the open front — 7 of 11 hold no certified rule and answer UNKNOWN. Government GIS transient failures are now retried under one stated policy and a national audit survives an unreadable provider.)

Previously: 2026-09-22 (Canonical species PRIMARY media schema, private storage and every shared consumer are activated and certified in production. Temporary certification media and users were removed; population is 0/60. Permanent administrator access remains fail-closed until the owner supplies the administrator email.)

## Current Product State

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
- Migration `20260921113816_canonical_species_primary_media.sql` is in the live ledger and the private WebP-only, 15 MiB-limited bucket is provisioned. `20260921093347_map_intelligence_foundation.sql` remains intentionally unapplied. **Permanent administrator (2026-09-22):** the owner created the administrator Supabase Auth account (confirmed; the only Auth user). Its UUID is set as `SPECIES_MEDIA_ADMIN_USER_IDS` in Vercel Production only; `SPECIES_MEDIA_ADMIN_SESSION_SECRET` is unchanged. It takes effect with the next production deployment; sign-in, `/admin/species-media` (expected 60 missing) and refusal of anonymous and non-allowlisted uploads are to be verified then. Production remains 0/60.

### Species media
- **Admin surface audited 2026-09-22 (§50).** Session cookie HttpOnly/Secure/SameSite=strict for 8 h, HMAC token compared with `timingSafeEqual`, the UUID allowlist re-checked on every verify (so removing a UUID revokes instantly, and is the revocation path — the token is otherwise stateless for its 8 h), same-origin on all three admin endpoints, uploads bounded and metadata-stripped, the public rendition route taking its storage path from the database and serving active assets only. Two findings were fixed: the pre-authentication sign-in limiter is now the durable Supabase one (`consume_hunt_share_rate_limit`, own HMAC namespace, 5 per 15 min, FAILS CLOSED — an unreachable limiter returns 503 rather than allowing), and a focal write now records `updated_by`/`updated_at` (migration `20260922220000`). Known and not acted on: every rendition costs a database read plus a storage download through the function, which the 1 h/1 day cache headers make fine at 60 cards — revisit with signed URLs or a public CDN path if the library grows by an order of magnitude.
- **Library cards are full-bleed photographs (2026-09-22).** The card image fills the card at a fixed 4:5 ratio and every line sits in one dense glass panel (`.ng-glass-dense`, added once in `globals.css`); worst measured contrast over the brightest blur-sized block under the panel across all photos is 4.54:1.
- **Focal point (2026-09-22).** Each asset carries `focal_x`/`focal_y` (percentages, default centred) and an uncropped card-sized `cover` rendition; every consumer applies them as `object-position`. An administrator presses and drags a card photo to place its subject; release saves through `POST /api/admin/species-media/focal` (admin session, same-origin, rate-limited, active asset only). Migration `20260922210000` is applied: variant check widened, focal columns added, `publish_species_primary_media` replaced to accept the optional cover while still requiring avatar/card/profile. Dry-run in BEGIN/ROLLBACK first, per the migration rule.
- **Population: 60 of 60.** Every active asset has a cover rendition (57 backfilled from their sanitized masters, 3 published with one).

### Hunting Intelligence
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
- **Saskatchewan is certified and unserved, live-service only.** 83 Wildlife Management Zones are read from the ministry's own service at request time; North Ground stores no copy, because the ArcGIS item says "Not for resale" despite the province's unrestricted licence (owner decision, 2026-09-22). Live-certified 2026-09-22: 265 points, 0 disagreements, 0 overlaps; authority p90 114 ms, production p90 141 ms (`fixtures/hunt/ca-sk-wmz-live-parity.json`). Certified geometry alone does not serve: `layer:ca-sk-wmz` stays `serving:false` until rules exist.
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
- No Waves 1–2 species image is published because no candidate has completed exact-species and attribution verification. The media contract now supports general, sex-, age-, seasonal- and lookalike-specific roles; the decision record is `docs/species-media-audit.md`, and the UI renders a deliberate no-photo state instead of a potentially incorrect wildlife image.
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
- Saskatchewan, Atlantic Canada: official sources are named in the coverage registry; none is ingested.
- Main site visual direction / hero.
- Hunting Intelligence application.
- Structured North Ground content/resource system.
- Search/keyword research informing Hunt terminology, URLs and content.

## Known Problems / Technical Debt

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
5. Prairie provinces: Manitoba and Alberta are served with a first wave; Saskatchewan is next. Manitoba's second wave is moose (s. 10.3 already needs its seasons), then elk, black bear and mule deer, then the Oak Hammock polygon. Then British Columbia, Atlantic Canada, and the territories. Each wave: research, ingest, certify parity, encode rules, test, deploy, verify, record exact coverage in the registry.
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

- Analytics: approve provider, consent model, coarse-location constraints, retention, and event contract before adding instrumentation.
- Owner action: replace production's refused `GOOGLE_MAPS_SERVER_API_KEY` (see Known Problems). Hunt works without it on Open-Meteo and Nominatim, so this blocks Google, not Hunt.
- Owner decision: serving Québec. Three steps, each blocked on approval in the Québec session: the resolver swap (proven identical for Ontario, Manitoba and Alberta; it does not change their boundary distance — see Known Problems), promoting the 59 Québec zones to VERIFIED, and deploying the serving switch.
- Ontario Crown-land production layer: the catalogue combines Open Government Licence metadata with additional OGDE-only features. Production storage/redistribution is blocked until the service schema is certified and the redistributable subset can be proved, or Ontario confirms the rights.

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

National position as of 2026-09-23, from `npm run report:canada`:

| | |
| --- | --- |
| Jurisdictions tracked | 14 (13 provinces and territories + federal) |
| Spatial VERIFIED | 11 (every in-scope province and territory) |
| Official units parity-certified | 1,351 |
| Species with certified rules | 12 |
| Certified rules | 556 |
| Jurisdictions with any certified rule | 5 |

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

`coreGameComplete` NOT met (**5 of 11** — British Columbia landed 2026-09-23). `migratoryComplete` NOT met (no federal
rules). `coverageAudited` MET — every jurisdiction declares its own gaps, so
what is missing is intentionally UNKNOWN rather than accidentally absent.

**Drawing every boundary in Canada is not covering Canada.** Six of the eleven
hold no certified rule, so every species query there is UNKNOWN. The next front
is rules, jurisdiction by jurisdiction.

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

- Research inventory: IN DEVELOPMENT for federal plus all 50 states; D.C. relevance remains unresolved. Principal wildlife authorities and official hunting hubs are inventoried. Every state now has at least one species/source evidence lead, but current-guide and claim-level certification is not complete.
- Regulatory/GIS reconnaissance is now explicit and machine-readable in `research/hunting/us/`: 51 state/district readiness rows and 65 official-source rows, including a deeper first pass for Alaska, Arizona, Colorado, Idaho, Montana, New Mexico, Utah and Wyoming. This is research only. It adds no runtime rules, geometry, UI support, database migrations or public U.S. coverage claim.
- The Wave 1 pass confirms the existing engine is only partially compatible. U.S. implementation needs first-class hunt numbers/codes, draw and quota lifecycles, typed species-specific geography, land/authority overlays, amendment precedence, jurisdiction-defined method classes and multi-source citations. Migratory birds require federal plus state/tribal composition; federal and tribal subsistence or treaty regimes must remain separate authorities rather than state-rule flags.
- No Wave 1 GIS source is production-certified. Current blockers include unresolved reuse terms or stable service contracts, map disclaimers that defer to written legal descriptions, species-dependent boundaries, mutable corrections/emergency orders, and New Mexico's official downloadable GMU data being dated October 2017. Canada remains the first complete geographic target before broad U.S. implementation.

### Other Countries
Future.

## Species Coverage

Maintain a reference to the authoritative species registry rather than duplicating the entire registry here.

Research registry: `research/hunting/species-master.csv` currently contains 133 North American species and protected identification-risk entities, with 56 alias records. Eastern wolf, Arctic fox, Canada lynx, New England cottontail, striped skunk and wolverine were the only genuine gaps added during Wave 2 reconciliation; existing canonical records such as North American beaver, mountain lion/cougar and brown bear/grizzly were reused rather than duplicated. Separate research tables cover 66 jurisdiction-specific regulatory-group mappings, 15 identification risks, 25 range-source leads, 24 seasonal modules, and 25 content opportunities. None encodes universal huntability or production editorial coverage.

Current editorial coverage:
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

## Recent Product Decisions

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

**Not yet wired into Hunt.** Migratory-bird queries still answer UNKNOWN until
this is certified in production. Saskatchewan is deferred because it is a
LIVE_SERVICE layer with no stored identifier list to check the regulation's
zone references against.

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

**Rule: a round number that exactly equals a known limit is a truncation until
proven otherwise.** And before reporting a defect from a measurement, confirm
the harness asked the question the product answers.

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

## Validation

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
