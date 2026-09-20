# North Ground — Project State

> Living operational state.
> Read `../CLAUDE.md` first.
> Update this file after material project changes.

Last updated: 2026-09-21 (species library and profiles brought into the Hunt product visual language; Ontario conditional regulatory engine — turkey, deer, black bear, moose)

## Current Product State

### Main Site
- Visual/hero work is currently being developed.
- Brand direction: dark boreal, warm, rustic, clean, outdoorsy; not tactical.
- Broader North Ground architecture is being established.
- Technical foundation remediation is implemented: truthful durable newsletter handling, production robots/sitemap, canonical and social metadata, justified Organization/WebSite structured data, a breadcrumb primitive, server-rendered homepage H1, and branded 404 behavior.
- The published bundles now drive `/hunt`, the searchable `/hunting/species` library, and ten indexable species routes. All are included in the generated sitemap alongside `/`. `/tools/season-finder` is superseded and redirects permanently (308) to `/hunt`; the redirect is generated from `redirectPairs()` in `src/lib/content/urls.ts`, not hand-written in config.
- Finalized homepage metadata remains broad across Canadian outdoor knowledge and tools. `/hunt` has dedicated North Ground Hunt metadata and a static 1536×803 JPEG social preview; dynamic `/hunt/share/[shareId]` metadata remains independently overridable and `noindex`.
- The homepage hero is unchanged and stays the dark, immersive entrance. Its `Enter the North` control is now a link to `/hunt`; the mission deck it previously opened moved to a quieter `Who we are` control directly beneath it, with focus return repointed accordingly.
- The integrated release is deployed on the canonical public host. Homepage navigation now exposes Hunt and the ruffed-grouse species guide on desktop, mobile and keyboard paths; the approved brand mark also supplies a 180×180 Apple touch icon.

### Hunting Intelligence
- Flagship product under active development.
- Intended capability: location/date/species → zone + season + applicable rules + authoritative sources + environmental context + North Ground knowledge.
- Architecture should support international expansion while initial verified coverage is developed jurisdiction by jurisdiction.
- An isolated research foundation now exists in `research/hunting/`; it is an inventory/review input, not production rule data.
- The first certified vertical slice is implemented locally for ruffed grouse in Ontario WMU 57 using the 2026 Ontario small-game table. An official Ontario GIS feature service resolves the point to a WMU; the deterministic evaluator returns `CONDITIONAL`, `CLOSED`, or an explicit unknown/verification state and never infers legality from editorial content.
- Hunt keeps regulatory evidence, environmental context, and North Ground knowledge as separate response layers. Exact legal astronomical times, municipal discharge rules, land access, Sunday gun-hunting rules, protected areas, and overlapping restrictions remain outside the certified result.
- Evaluated Hunt results can now be projected into privacy-safe, versioned Hunt Brief snapshots and shared through opaque `/hunt/share/[shareId]` URLs. The projection preserves the engine's exact status, excludes coordinates and raw location inputs, and stores only an explicitly approved coarse location label. Snapshots persist to Supabase; Upstash has been removed from the code and the dependency list.
- Hunt is now a map-first application at `/hunt`, built to the approved premium glass direction recorded in `CLAUDE.md` section 41A. It opens on official Ontario Wildlife Management Unit boundaries before anything is typed, so a first-time visitor sees hunting zones rather than a coordinate form.
- Zone geometry is served by `GET /api/hunt/zones` from the Government of Ontario feature layer: viewport-bounded, generalised server-side by a tolerance chosen from the requested zoom (`maxAllowableOffset`), capped at 400 features, and cached for six hours on a snapped viewport key. The whole province at the opening zoom is roughly 35 KB across 151 units. A provider outage returns `PROVIDER_ERROR` and an empty map; no approximate boundary is ever drawn.
- Per-zone coverage is distinguished on the map and in the composer: `VERIFIED` for a zone with a certified regulatory record (currently WMU 57 only) and `IN_DEVELOPMENT` for a zone whose official boundary is known but whose rules are not certified. Drawing a boundary is explicitly not a claim about the rules inside it.
- `POST /api/hunt/zone` resolves a point to its official management zone from location alone, with no species or date. It returns zone identity, jurisdiction, coverage and boundary proximity, and deliberately returns nothing about legality.
- The Hunt interface assembles progressively: location resolves the zone, date enables time-specific evaluation, species completes the regulatory overview. The overview separates regulatory, environmental and editorial layers into tabs that appear only when they have real content.
- Location is entered through one place-search composer with Google Places where a key is configured and Nominatim otherwise; attribution follows whichever provider answered. `Use my location` is a separate explicit action. Coordinates remain available under a `Location details` disclosure and are never the primary input.
- Date entry is `Today` plus `Choose date` only. The canonical display format is `YYYY/MM/DD` with progressive numeric entry (`20260808` becomes `2026/08/08`), pasted ISO and slash forms normalise, and impossible dates are refused with a plain-language reason. The text field and the accessible calendar share one ISO value and cannot disagree. Covered by 19 tests in `src/lib/hunt/date.test.ts`.
- Where no Google Maps browser key is configured the map falls back to a basemap-free boundary view that draws the same official geometry, supports pan, zoom and zone inspection, and labels itself as having no basemap. It is not a substitute basemap and invents no geography.

### Content / Knowledge Graph
- Structured content system being developed in parallel with Hunt.
- Editorial standard: maximum useful information with minimum necessary words.
- Species, conditions, clothing, packing, skills, regulations and related entities should be reusable by the application.
- Shared content contract v1 is defined in `docs/content-system/` with canonical ID, species/resource, App Block, deterministic matching, relationship, source, media, URL, quality and lifecycle rules.
- Storage-neutral TypeScript contracts live in `src/lib/content-contract/`. The strict validated production bundles are `content/published/en-CA.json` and `content/published/species-wave-1.json`; `src/lib/content/repository.ts` provides canonical entity/resource/source lookup, alias-aware species search, exact-species media gating, deterministic App Block matching, related-resource lookup, and URL resolution without binding the product to a CMS.
- Wave 1 publishes ten source-backed species profiles, a searchable grouped library, identification/habitat App Blocks, breadcrumbs, Taxon structured data, internal relationships and Hunt links. A published biological profile is not evidence of a huntable season: the Hunt selector labels ruffed grouse `Rules available` and the other nine species `Rules in development`.
- No Wave 1 species image is published because no candidate has completed exact-species and attribution verification. The per-species decision record is `docs/species-media-audit.md`; the UI renders a deliberate no-photo state instead of a potentially incorrect wildlife image.
- The species library and every canonical species profile now render in the Hunt product visual language rather than the separate editorial identity they had developed. They carry Hunt's floating glass navigation, its atmospheric ground, its Inter type scale, its glass panel/card hierarchy and its primary/quiet action pair. Hunt was not changed to meet them: the only edit to Hunt was replacing its `.page` background literal with the shared `--ng-product-bg` token, which computes identically.
- Shared product primitives were extracted into `globals.css`, which `CLAUDE.md` section 41A already names as the single home for Hunt's tokens and surfaces: `--ng-product-bg`, `.ng-product-page`, `.ng-shell`, `.ng-coverage`, `.ng-action`, `.ng-action-quiet`, `.ng-section-title` and `.ng-breadcrumb`. `HuntNav` gained an optional `current` prop so the same navigation serves `/hunt` and both species routes. The species route stylesheets now hold layout only and no longer define colour, blur, border or radius values of their own.
- `.ng-coverage` is deliberately separate from the regulatory `.ng-status`. Coverage answers whether North Ground holds certified rules for a species at all (`Rules available` / `Rules in development`, sourced from `SUPPORTED_SPECIES_IDS`); regulatory status answers what those rules say for a location and date, which only Hunt can do. A library card can never imply a season.
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

- Ontario major game (turkey, deer, black bear, moose): the regulatory ENGINE is complete and tested; the Hunt interface is not yet wired to it. `evaluateOntarioMajorGame` returns `completeness: "NEEDS_INPUT"` with one question at a time, and no UI renders that yet. The four species also remain absent from the Hunt species selector until that wiring lands.
- Mirroring major-game rules into Supabase. Blocked on schema: `public.regulatory_rules` has no `applies_when` column, so a conditional rule would be stored as though it were unconditional — a WMU 71 deer rule would read as open to rifles. Needs an additive migration (`applies_when jsonb`, `declared_no_season boolean`, `season_label text`) and a publisher that reads `bundle.sources` (array) as well as `bundle.source`. Small game remains mirrored and unaffected.
- Québec zone ingestion, once the Ontario pipeline has run through a source change at least once.
- Main site visual direction / hero.
- Hunting Intelligence application.
- Structured North Ground content/resource system.
- Search/keyword research informing Hunt terminology, URLs and content.

## Known Problems / Technical Debt

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
- Hunt does not read a `species` query parameter. The species profile CTA previously linked to `/hunt?species=<slug>`, which Hunt silently ignored. The link now routes to `/hunt` plainly rather than carrying state that does nothing. If species preselection is wanted, implement it in the Hunt composer and update the link together.
- The species library page title rendered as `Species Library | North Ground | North Ground` because the route set the brand in its own title while the root layout template also appends it. The route now sets `Species library` and the template supplies the brand once.
- Secondary text tokens were failing WCAG AA on the dark glass: `--ng-bone-faint` measured 2.9:1 at 11–12px. Both secondary tiers were raised (0.80 and 0.62 alpha) and re-measured at 6.7:1 and 4.7:1. Any new token added to the palette must be measured against the glass it sits on, not against the page background.

## Next Priorities

The first three are the open ends of the conditional-regulatory wave and should be taken in order.

1. Wire Hunt's interface to `evaluateOntarioMajorGame`: render `NEEDS_INPUT` as one question at a time with its stated reason and source section, re-evaluate on each answer, and keep the small-game path unchanged (it asks nothing and must keep asking nothing). This touches `coverage.ts`, `SpeciesSelect.tsx` and `src/app/hunt/page.tsx`, which a concurrent species/content session was editing on 2026-09-20 — confirm ownership before starting.
2. Add the four major-game species to the Hunt selector and the coverage matrix, with a state that distinguishes "rules available, some questions required" from small game's "rules available".
3. Mirror major-game rules into Supabase, which needs the additive migration described under In Progress. Do not mirror them against the current schema: a conditional rule stored without its conditions reads as unconditional.
4. Version the Hunt Brief schema before any brief can contain an answer that depended on user-supplied context, so an old brief is never re-rendered as though it applied to everyone.
5. Complete current visual foundation without locking poor information architecture.
6. Establish technical/semantic site architecture.
7. Establish trust pages and North Ground Verified framework.
8. Continue Hunting Intelligence core.
9. Build structured knowledge/content graph alongside Hunt.
10. Expand verified regulatory coverage one source-backed record at a time. Waterfowl is federal (migratory birds) rather than provincial and needs its own source review; Québec has not been started.
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
Both former blockers are resolved. Nothing external is currently blocking Hunt.

## Regulatory Coverage

### Canada
Record each jurisdiction as:
VERIFIED / PARTIAL / IN DEVELOPMENT / UNAVAILABLE

Do not mark VERIFIED until actual data and representative queries have been certified.

- Research inventory: PARTIAL for federal plus all 13 provinces/territories. Principal authorities, official terminology and regulatory-source leads are recorded; no jurisdiction is certified `VERIFIED` for production.
- Canadian species evidence: 102 source-linked rows across all 14 jurisdiction records, with deeper big-game, upland-bird, ptarmigan, hare, and small-game leads. These remain research inputs rather than certified rules.
- GIS: every North American jurisdiction now has an explicit availability classification; 16 are official-interactive-map-only, one is official-PDF-map, 48 need research, and D.C. has no source found. No machine-readable layer has passed the full endpoint/schema/version/licence gate.
- Ontario geographic coverage is COMPLETE as of 2026-09-21: all 151 official Wildlife Management Units are normalized in Supabase/PostGIS, ingested from the province's own feature layer. 1,298,941 vertices, every geometry valid, every one EPSG:4326 MultiPolygon, 1,078,174 km2 in total against Ontario's actual area of roughly 1,076,000 km2. Sub-unit designations are preserved exactly as the authority writes them (69A-1 stays 69A-1).
- Spatial parity with the authority is CERTIFIED: 309 points — one inside every unit, one just inside every unit's boundary, five outside the province, two impossible coordinates — resolve identically in North Ground's PostGIS registry and in the Government of Ontario service, with zero disagreements. `scripts/certify-ontario-spatial-parity.mjs` performs the live comparison; `src/lib/hunt/spatial-parity.test.ts` replays the recorded result and never touches the network.
- `SPATIAL_PROVIDER` is now `supabase` with `official-gis` as the fallback, in local and in Vercel Production and Preview. The condition recorded for this switch — demonstrated parity — is met, and PostGIS measured steadier than the live service (median 170 ms versus 207 ms, p90 215 ms versus 1,460 ms). Production resolves WMU 3, 15B, 36, 57, 61, 80 and 94A through PostGIS.
- Ontario small-game regulatory coverage expanded on 2026-09-21 from one unit to the province. Against the 2026 Ontario Hunting Regulations Summary (`sha256:99fadfbb…`, retrieved 2026-09-20), 8 official season groupings and 11 rules now cover four species:

| Species | Certified units | Declared no season | Unknown | Rules |
| --- | --- | --- | --- | --- |
| `species:ruffed-grouse` | 150 | 0 | 1 | 4 |
| `species:snowshoe-hare` | 150 | 0 | 1 | 2 |
| `species:sharp-tailed-grouse` | 85 | 0 | 66 | 3 |
| `species:spruce-grouse` | 85 | 65 | 1 | 2 |

- The rules are generated, never hand-written. `npm run build:regulations` rebuilds both `content/regulatory/ca-on-small-game-2026.json` and `ca-on-major-game-2026.json` from the published summaries, and `npm run check:regulatory-sources` fails if either source has moved since its bundle was built. A moved hash now names the affected rules with field-level before/after and the number of units each change touches; `scripts/regulatory-change-report.mjs <old> <new>` produces the same report between any two bundles and exits 3 when review is required. Parsing is strict: an unreadable season phrase, limit or WMU reference aborts the build rather than dropping a row. `scripts/publish-regulations.mjs` mirrors the bundle into Supabase for coverage reporting and the review lifecycle; Hunt itself evaluates from the committed bundle, which keeps evaluation deterministic and offline-testable.
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

### United States
Not assumed complete.
Add jurisdictions only when genuinely implemented.

- Research inventory: IN DEVELOPMENT for federal plus all 50 states; D.C. relevance remains unresolved. Principal wildlife authorities and official hunting hubs are inventoried. Every state now has at least one species/source evidence lead, but current-guide and claim-level certification is not complete.

### Other Countries
Future.

## Species Coverage

Maintain a reference to the authoritative species registry rather than duplicating the entire registry here.

Research registry: `research/hunting/species-master.csv` currently contains 127 North American species and protected identification-risk entities, with 48 alias records. Separate research tables cover 66 jurisdiction-specific regulatory-group mappings, 15 identification risks, 25 range-source leads, 24 seasonal modules, and 25 content opportunities. None encodes universal huntability or production editorial coverage.

Current editorial coverage:
- Wave 1 publishes ruffed grouse, spruce grouse, sharp-tailed grouse, wild turkey, white-tailed deer, moose, American black bear, snowshoe hare, mallard and Canada goose in `en-CA`.
- The production selector searches common, scientific, French and alternate names while keeping the 127-record research registry out of runtime publication. Hunt-rule availability remains an independent regulatory capability.

## Data Providers

Record actual production providers here once selected:

- Database: Supabase (PostgreSQL + PostGIS in the `extensions` schema), project `nxzaatqovhbvziecogan` in the North Ground Bushcraft organisation, PostgreSQL 17.6. Both migrations are applied and the certified Ontario record is loaded. It backs Hunt Brief snapshots, share rate limiting and the normalized zone registry. Configured in Vercel Production and Preview.
- GIS: Government of Ontario LIO Wildlife Management Unit Feature Layer, used both for certified point resolution and for the map's viewport zone geometry. It is the only jurisdiction whose boundary layer has passed endpoint, schema, coordinate-system and licence review.
- Map: Google Maps JavaScript API, live, with North Ground's own regulatory overlays on top and a Terrain/Satellite control. The basemap-free boundary view remains the fallback when the key or the API is unavailable. Neither is a legal survey, and Google's required attribution is never covered.
- Geocoding / place search: Google Places API (New) and Geocoding API, live. Nominatim remains the keyless fallback. The attribution shown follows whichever provider answered, and provider choice never changes regulatory truth.
- Weather: Google Weather API, live, with Open-Meteo as the configured fallback. Environmental context only, current day through the provider's horizon; no climatology substitution.
- Google Cloud project `ngbc-509209`. Two keys, each restricted to exactly what it needs: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is HTTP-referrer restricted to the production host, the apex, `*.vercel.app` and `localhost:3100`, and limited to the Maps JavaScript API alone — the browser never calls Places directly. `GOOGLE_MAPS_SERVER_API_KEY` is server-only and limited to Places API (New), Geocoding API and Weather API. Both restrictions were verified by calling a non-permitted API with each key and confirming `REQUEST_DENIED`.
- Analytics:
- Email: Resend Contacts + dedicated Segment, configured and production-certified.
- Error monitoring:

Do not list aspirational providers as implemented.

## Recent Product Decisions

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

### 2026-09-21 — Species Surfaces Belong To The Hunt Product Family
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

## Validation

### Build
- `npm run build` passed on 2026-09-21 after the species visual integration (Next.js 16.1.1). `/hunting/species` remains static and all 60 species routes remain statically generated; route inventory and rendering strategy are unchanged.

- `npm run build` passed on 2026-09-20 (Next.js 16.1.1). The species library is static and all ten species pages are statically generated; Hunt, its evaluation/share APIs, shared Hunt Brief page and per-brief Open Graph image are dynamic; home, 404, site Open Graph image, robots, and sitemap are generated successfully.

### Tests
- Ontario conditional regulatory engine, 2026-09-20. `npm run typecheck` clean, `npx eslint src scripts` clean (the previously noted unused-variable warning in `scripts/build-ontario-regulations.mjs` is resolved). `npm run test:hunt` 169/169 — the 117 pre-existing hunt tests plus 28 deer cases and 24 turkey/bear/moose/untrusted-input cases, with the small-game suite unchanged. `npm run test:regulatory-sources` 16/16 covering WMU specification expansion, footnote-to-token attachment, and the bundle change report. `npm run build` compiled successfully.
- Both bundles rebuild byte-identically when the sources have not moved, which is what makes a diff meaningful.
- Source-change drill performed 2026-09-20 against the four-species bundle. Three realistic changes were simulated — a turkey spring season shortened, WMU 7A's bear implements narrowed, and a moose "None" cell becoming dates. All three were detected, each was named with its field-level before/after and the number of units it touches (91, 1 and 19 respectively), the production bundle and file were untouched, the engine continued to return the pre-change answers, and the report exited 3 to require review. Nothing was promoted automatically.
- The drill also demonstrated the blast-radius value of the report: two edits intended as separate landed on a single deer rule, because WMUs 48 and 60 share a season grouping that spans 36 units.

- Species visual integration, 2026-09-21. `npm run typecheck` and `npm run lint` clean (one pre-existing unused-variable warning in `scripts/build-ontario-regulations.mjs`, owned by the regulatory work). `test:hunt` 145/145, `test:hunt-share` 23/23, `test:content-repository` 12/12, `test:content-urls` 21/21, `test:content-contract` 8/8, `test:seo` 3/3, `test:newsletter` 9/9. `validate:content:published` 0 errors / 0 warnings across 83 entities, 61 resources, 46 blocks. `validate:seo` passed against a production build.
- Species browser certification 2026-09-21 at 320, 360, 375, 390, 430, 768, 1024 and 1440 CSS pixels on both the library and a profile: zero horizontal overflow at every width, zero console errors. Contrast measured against composited glass on the library (412 text nodes, zero failures); the two apparent primary-button failures were a probe artifact — the control paints a gradient via `background-image`, and the real worst-case ratio along it is 11.22:1 for `--ng-black` on `--ng-bone`.
- Heading order verified: library H1 → H2 (Find a species) → H2 (Species); profile H1 → eight H2 sections → H3 App Blocks, no skips. Coverage state is carried by a ring glyph and a word as well as by colour. Breadcrumb links raised to a 28px target; the remaining sub-36px links are inline links inside sentences, which WCAG 2.5.8 excludes.
- Library search certified against the real bundle: `wolf` → Eastern wolf + Gray wolf, `doe` → both deer, `orignal` → Moose, `Canard colvert` → Mallard, `rabbit` → the three hares and rabbits, `grouse` → three grouse plus two ptarmigan, and an unmatched query renders the empty state. Coverage labels matched `SUPPORTED_SPECIES_IDS` exactly — grouse and snowshoe hare `Rules available`, the rest `Rules in development`.
- Structured data and SEO preserved on `/hunting/species/ruffed-grouse`: Article + Taxon + BreadcrumbList emitted, canonical unchanged, `<h1>Ruffed grouse</h1>` server-rendered, sitemap still 63 URLs. Page weight on the wire: Hunt 11.7 KB, the 60-species library 11.8 KB, a species profile 8.0 KB.

- `npm run typecheck` passed on 2026-09-20.
- `npm run test:content-contract` passed 6/6 on 2026-09-20, including scientific-name, duplicate-alias and species-media verification failures.
- `npm run validate:content:strict` passed the contract fixture with 0 errors and 0 warnings on 2026-09-20.
- `npm run validate:content:published` passed both published bundles with 0 errors and 0 warnings (26 entities, 11 resources, 14 blocks) on 2026-09-20.
- `npm run test:content-urls` passed 13/13 on 2026-09-20; `npm run test:content-repository` passed 7/7, including alias search, related species, sources, App Blocks and exact-species image gating.
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
- `python3 research/hunting/validate.py` passed on 2026-09-20 for 66 jurisdictions, 68 authorities, 88 regulatory/scientific sources, 27 GIS records, 127 species, 48 aliases, 156 evidence rows, 66 regulatory mappings, 15 identification risks, 25 range records, 66 source-coverage rows and 25 content opportunities (0 warnings or structural errors).
- Research counts remain research-only. The only locally certified production-shaped exception is the explicit Ontario WMU 57 / ruffed grouse 2026 slice described above.

## Agent Handoff Notes

### 2026-09-21 — Ontario major game is NOT a bigger grouse table
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

### 2026-09-21 — WMU 51 is excluded from every small-game row, and that is a question not an answer
WMU 51 is Algonquin Provincial Park. It is named by no small-game season row in
the 2026 summary — not the grouse rows, not hare, not the cormorant row that
otherwise spans "1-50, 53-95". Hunting there is governed by provincial park
legislation rather than the general summary, which is the most likely reason.
North Ground does not currently hold that source, so every small-game query in
WMU 51 returns UNKNOWN with an explicit statement that an absent row is not
evidence of a closed season. Resolving this properly means ingesting the
Provincial Parks and Conservation Reserves framework, not inferring from silence.

### 2026-09-21 — Ontario ruffed grouse groupings, extracted and verified, ENCODED
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

**Encoded on 2026-09-21.** The bare-number reading was settled by evidence rather
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
