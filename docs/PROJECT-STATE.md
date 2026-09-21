# North Ground — Project State

> Living operational state.
> Read `../CLAUDE.md` first.
> Update this file after material project changes.

Last updated: 2026-09-21 (Alberta served in Hunt: 189 WMUs parity-certified 592/0, first rule wave; species coverage per jurisdiction; Supabase outage 02:50–03:24 UTC resolved)

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
- Ontario major game is wired end to end as of 2026-09-20. `evaluateHunt` routes by how the province publishes a species: small game answers from location, date and species and asks nothing; deer, turkey, black bear and moose go to `evaluateOntarioMajorGame`, which asks only what the applicable rules disagree on, one fact at a time, with its reason and source section. All eight certified species are now selectable, and the selector distinguishes "Rules available" from "Rules available · asks a question".
- `HuntEvaluation` carries `completeness` separately from regulatory status, so NEEDS_INPUT (North Ground knows the law and needs a fact) can never be rendered as UNKNOWN (North Ground does not know the law) or as CLOSED. While a question is outstanding the regulatory placeholder is `NEEDS_VERIFICATION`.
- Answers are untrusted at two layers. `/api/hunt/evaluate` refuses anything that is not a known dimension key with a bounded string value, and the engine then refuses any value its own dimension did not offer. Certified live: an invalid residency or implement leaves the question outstanding and never produces a status. Answers are cleared whenever species, place or date changes.
- Hunt Brief is at schema version 2, which records the assumptions a result depended on in the words the question used. Version 1 briefs remain readable and are rebuilt as version 1 with no assumptions; a stored v1 record cannot acquire assumptions even if its payload claims them.
- Canada coverage is machine-readable. `src/lib/hunt/canada/registry.ts` declares all thirteen provinces and territories plus the federal layer with each authority's own management term, official source and known gaps; `report.ts` computes every count from the certified bundles at call time. `npm run report:canada` renders it, `-- --json` emits it.
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

- Québec spatial ingestion is NO LONGER BLOCKED. The source was found on 2026-09-20 — the ministry's own GeoServer behind Forêt ouverte, not the open-data portal — and all 59 designations read cleanly through `createQuebecZoneSource`. What remains is engineering: stage into PostGIS, certify parity against the service the way Ontario's 309 points were certified, then switch the resolver on. `docs/quebec-regulatory-sources.md` has the measured detail. Still do not ingest the structured-territory layer as a substitute: zecs are not hunting zones, and which licence governs — the portal's CC-BY-NC-ND or the GeoServer's `AccessConstraints: NONE` — is unsettled.
- Federal migratory birds. The only district layer located (ECCC, Québec) is marked Draft and states it has no legal value, so it fails the boundary standard. Certified geometry must come from the Migratory Birds Regulations text or a layer the authority stands behind. 25 waterfowl and migratory species have published biological profiles and no rules.
- Prairie provinces, British Columbia, Atlantic Canada and the territories: official sources are named in the coverage registry; none is ingested.
- Main site visual direction / hero.
- Hunting Intelligence application.
- Structured North Ground content/resource system.
- Search/keyword research informing Hunt terminology, URLs and content.

## Known Problems / Technical Debt

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

1. Québec geometry into PostGIS. The source is found and proven readable; this is now ingestion and parity certification, not discovery. Stage the 59 designations, certify against the ministry's service the way Ontario's 309 points were, then switch the resolver on and upgrade the registry to VERIFIED.
2. Québec seasons. The structure has been read and written down in `docs/quebec-regulatory-sources.md` — do not re-derive it. Two things must be settled before encoding: the rule schema cannot yet represent a segment that differs between the two published years ("2026 Orignal avec bois / 2027 Orignal"), and the two coordinated-ellipsis zone labels need an explicit, evidence-carrying mapping rather than a regex. Preserve official French terminology rather than translating legal terms. Zone 17 moose is closed to sport hunting and the ZSR designations must never inherit their parent zone's season.
3. Distributed rate limiting and production observability before broad Hunt rollout. Hunt's limiter is still process-local.
4. Federal migratory birds. Establish certified district geometry from the Migratory Birds Regulations or an authority-backed layer — the ECCC draft layer disclaims legal value and cannot be used. This unblocks 25 published waterfowl species that currently have no rules at all.
5. Prairie provinces (MB, SK, AB), then British Columbia, then Atlantic Canada, then the territories. Each wave: research, ingest, certify parity, encode rules, test, deploy, verify, record exact coverage in the registry.
6. Complete current visual foundation without locking poor information architecture.
7. Establish technical/semantic site architecture.
8. Establish trust pages and North Ground Verified framework.
9. Continue Hunting Intelligence core.
10. Build structured knowledge/content graph alongside Hunt.
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

**Direction (2026-09-20): all of Canada is Hunt's first complete geographic
target.** Recorded in `CLAUDE.md` section 9. Canada is the minimum complete
footprint before broad United States expansion — not the initial market to be
moved past.

Coverage is machine-readable rather than prose. `src/lib/hunt/canada/registry.ts`
declares structure and known gaps; `src/lib/hunt/canada/report.ts` computes every
count from the certified bundles. Run `npm run report:canada`. Do not restate
those counts here — they would go stale the moment a bundle changes.

National position as of 2026-09-20:

| | |
| --- | --- |
| Jurisdictions tracked | 14 (13 provinces and territories + federal) |
| Spatial VERIFIED | 1 (Ontario) |
| Official units parity-certified | 151 |
| Species with certified rules | 8 |
| Certified rules | 146 |
| Jurisdictions with any certified rule | 1 |

Milestones: `spatialComplete` NOT met (1 of 13). `coreGameComplete` NOT met
(1 of 13). `migratoryComplete` NOT met (no federal rules). `coverageAudited`
MET — every jurisdiction declares its own gaps, so what is missing is
intentionally UNKNOWN rather than accidentally absent.

Record each jurisdiction as:
VERIFIED / PARTIAL / IN DEVELOPMENT / UNAVAILABLE

Do not mark VERIFIED until actual data and representative queries have been certified.

- Research inventory: PARTIAL for federal plus all 13 provinces/territories. Principal authorities, official terminology and regulatory-source leads are recorded; no jurisdiction is certified `VERIFIED` for production. Deep source reconnaissance is complete for the 11 jurisdictions outside the Ontario and Québec workstreams in `research/hunting/canada-source-reconnaissance.json`; this remains research-only and does not change coverage.
- Canadian species evidence: 102 source-linked rows across all 14 jurisdiction records, with deeper big-game, upland-bird, ptarmigan, hare, and small-game leads. These remain research inputs rather than certified rules.
- GIS: every North American jurisdiction has an explicit availability classification. The Canada deep pass verified machine-readable official management geometry for BC (225 MUs), Alberta (199 WMUs), Saskatchewan (83 WMZs), Manitoba (63 service features/62 named GHAs), New Brunswick (27 WMZs), Nova Scotia (separate deer and moose layers) and Yukon (445 service features versus 443 stated GMS). These are source candidates, not production-certified geometry: Saskatchewan and Nova Scotia have unresolved reuse terms, Yukon has a count discrepancy, and most authorities describe the geometry as indicative or generalized. PEI has no comprehensive hunt-zone system identified; NL, NWT and Nunavut remain map/geometry blocked.
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

**Québec — source found and read, nothing certified (2026-09-20).**
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
- Lookalike paths are reciprocal and generated (`ef6e924`): snowshoe hare ↔ eastern cottontail and Arctic hare, mallard ↔ American black duck, each already named on the Wave 2 side.
- Search certified 2026-09-21 against the production repository: `wolf` → Eastern + Gray wolf; `fox` → Arctic, gray, red; `rabbit` → Arctic hare, eastern cottontail, snowshoe hare; `duck` → 17 species, never Mallard alone; `goose` → 5; `doe`/`buck` → both deer with a sex intent on white-tailed deer; `bull moose` → Moose with a MALE intent; exact names resolve to one species.

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

## Validation

### Build
- `npm run build` passed on 2026-09-20 after the species visual integration (Next.js 16.1.1). `/hunting/species` remains static and all 60 species routes remain statically generated; route inventory and rendering strategy are unchanged.

- `npm run build` passed on 2026-09-20 (Next.js 16.1.1). The species library is static and all 60 species pages are statically generated; Hunt, its evaluation/share APIs, shared Hunt Brief page and per-brief Open Graph image are dynamic; home, 404, site Open Graph image, robots, and sitemap are generated successfully.

### Tests
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
- **Not deployed as of 2026-09-21 ~03:45 UTC.** `origin/main` is still `4fb85d9`; `main` carries the Alberta, Manitoba, Québec, species and hydration work on top of it, none of it pushed. Every commit's owner reports it technically ready, but the owner of the hydration commits reserved the deploy decision, and a push of the linear `main` ships all of them together, so no session has pushed. Production therefore still serves Ontario only, with the pre-recovery species labels. Deploying, then certifying production for Alberta, Manitoba and the species surfaces, is the next step once the owner decides.
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

### 2026-09-21 — Alberta: what is left, in order
Geometry, parity, serving and the first rule wave are done. Remaining:
1. Deploy. `main` is well ahead of `origin/main` and nothing from this run of work has been pushed; the deploy decision is the owner's (see Production).
2. Next species from the same tables and builder: mule deer (antler-point classes), moose (general and ■ by unit), then elk once the online/PDF divergence on late seasons (N17–D31 vs N17–D20) is settled with Alberta.
3. Ingest the Wildlife Regulation (Alta. Reg. 143/97) itself as the controlling text; the guide is a summary.
4. Everything the builder needs is in `scripts/alberta-source.mjs`; re-run `scripts/crosscheck-alberta-guide.py` whenever the PDF hash changes, because the builder refuses a cross-check made against a different PDF.

### 2026-09-20 — Remaining Canada source runway

Deep regulatory and GIS source reconnaissance is complete for BC, AB, SK, MB,
NB, NS, PE, NL, YT, NT and NU. This is research-only: no production GIS,
rules, migrations, UI or coverage state changed.

- Ready to begin a reviewed ingestion implementation: Manitoba, Alberta,
  British Columbia and Yukon. Yukon first needs the 445 service-feature versus
  443 stated-GMS discrepancy reconciled.
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
