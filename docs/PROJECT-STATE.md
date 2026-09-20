# North Ground — Project State

> Living operational state.
> Read `../CLAUDE.md` first.
> Update this file after material project changes.

Last updated: 2026-09-20

## Current Product State

### Main Site
- Visual/hero work is currently being developed.
- Brand direction: dark boreal, warm, rustic, clean, outdoorsy; not tactical.
- Broader North Ground architecture is being established.
- Technical foundation remediation is implemented: truthful durable newsletter handling, production robots/sitemap, canonical and social metadata, justified Organization/WebSite structured data, a breadcrumb primitive, server-rendered homepage H1, and branded 404 behavior.
- The published bundle now drives two indexable application routes: `/tools/season-finder` and `/hunting/species/ruffed-grouse`. Both are included in the generated sitemap alongside `/`.
- Finalized homepage metadata remains broad across Canadian outdoor knowledge and tools. `/tools/season-finder` has dedicated North Ground Hunt metadata and a static 1536×803 JPEG social preview; dynamic `/hunt/share/[shareId]` metadata remains independently overridable and `noindex`.
- The integrated release is deployed on the canonical public host. Homepage navigation now exposes Hunt and the ruffed-grouse species guide on desktop, mobile and keyboard paths; the approved brand mark also supplies a 180×180 Apple touch icon.

### Hunting Intelligence
- Flagship product under active development.
- Intended capability: location/date/species → zone + season + applicable rules + authoritative sources + environmental context + North Ground knowledge.
- Architecture should support international expansion while initial verified coverage is developed jurisdiction by jurisdiction.
- An isolated research foundation now exists in `research/hunting/`; it is an inventory/review input, not production rule data.
- The first certified vertical slice is implemented locally for ruffed grouse in Ontario WMU 57 using the 2026 Ontario small-game table. An official Ontario GIS feature service resolves the point to a WMU; the deterministic evaluator returns `CONDITIONAL`, `CLOSED`, or an explicit unknown/verification state and never infers legality from editorial content.
- Hunt keeps regulatory evidence, environmental context, and North Ground knowledge as separate response layers. Exact legal astronomical times, municipal discharge rules, land access, Sunday gun-hunting rules, protected areas, and overlapping restrictions remain outside the certified result.
- Evaluated Hunt results can now be projected into privacy-safe, versioned Hunt Brief snapshots and shared through opaque `/hunt/share/[shareId]` URLs. The projection preserves the engine's exact status, excludes coordinates and raw location inputs, and stores only an explicitly approved coarse location label.

### Content / Knowledge Graph
- Structured content system being developed in parallel with Hunt.
- Editorial standard: maximum useful information with minimum necessary words.
- Species, conditions, clothing, packing, skills, regulations and related entities should be reusable by the application.
- Shared content contract v1 is defined in `docs/content-system/` with canonical ID, species/resource, App Block, deterministic matching, relationship, source, media, URL, quality and lifecycle rules.
- Storage-neutral TypeScript contracts live in `src/lib/content-contract/`. The strict validated production bundle is `content/published/en-CA.json`; `src/lib/content/repository.ts` provides canonical entity/resource/source lookup, deterministic App Block matching, related-resource lookup, and URL resolution without binding the product to a CMS.
- The first canonical species resource is `species:ruffed-grouse` at `/hunting/species/ruffed-grouse`. It is server rendered, source-backed, structured-data enabled, and connected bidirectionally with Hunt. No species image is published because an accurately identified licensed asset has not been certified.

### Field Testing
- Methodology planned.
- Original North Ground field data should become a long-term authority moat.

### Cold / Winter
- Identified as an early topical-authority wedge.
- Cold is an entry strategy, not the permanent limit of the brand.

### Crown / Public Land
- Identified as another major future data/content/tool opportunity.

## In Progress

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
- The current certified regulatory record is deliberately narrow: ruffed grouse, Ontario WMU 57, 2026. The rest of the hunting research inventory remains research-only.
- Exact legal sunrise/sunset computation is not certified. Open-Meteo sunrise/sunset is displayed only as environmental context and never establishes legal hunting time.
- The canonical Hunt H1 remains “What applies here, on this date?” because the certified product currently evaluates one selected species rather than answering the broader species-discovery question implied by “What Can I Hunt Here?”. Revisit when coverage supports that promise.
- Hunt Brief live persistence requires private Upstash Redis credentials. `HUNT_SHARE_RATE_LIMIT_SECRET` is configured and was rotated during release, but `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are absent. Missing storage fails closed; no share URL is claimed until the snapshot is durably stored.

## Next Priorities

1. Complete current visual foundation without locking poor information architecture.
2. Establish technical/semantic site architecture.
3. Establish trust pages and North Ground Verified framework.
4. Continue Hunting Intelligence core.
5. Build structured knowledge/content graph alongside Hunt.
6. Expand verified regulatory coverage one source-backed record at a time, beginning only after reviewing what this first slice failed to certify.
7. Select a durable content authoring/store adapter that exports the existing normalized bundle without changing canonical IDs.
8. Build early cold-weather authority resources/tools.
9. Begin standardized field-data collection.
10. Build Crown/public-land data foundation ahead of seasonal demand.
11. Add distributed rate limiting, production observability, and an explicit regulatory/source review workflow before broad Hunt rollout.

## Blocked

Record only genuine blockers here.

Examples:
- missing API credentials
- unavailable official GIS data
- owner decision required
- third-party service issue

- Analytics: approve provider, consent model, coarse-location constraints, retention, and event contract before adding instrumentation.
- Hunt Brief production activation: the owner must provision Upstash Redis and add `UPSTASH_REDIS_REST_URL` plus `UPSTASH_REDIS_REST_TOKEN` to Vercel Production and Preview. Then redeploy and create/retrieve one real recipient link. The HMAC secret is already configured.

## Regulatory Coverage

### Canada
Record each jurisdiction as:
VERIFIED / PARTIAL / IN DEVELOPMENT / UNAVAILABLE

Do not mark VERIFIED until actual data and representative queries have been certified.

- Research inventory: PARTIAL for federal plus all 13 provinces/territories. Principal authorities, official terminology and regulatory-source leads are recorded; no jurisdiction is certified `VERIFIED` for production.
- Canadian species evidence: 102 source-linked rows across all 14 jurisdiction records, with deeper big-game, upland-bird, ptarmigan, hare, and small-game leads. These remain research inputs rather than certified rules.
- GIS: every North American jurisdiction now has an explicit availability classification; 16 are official-interactive-map-only, one is official-PDF-map, 48 need research, and D.C. has no source found. No machine-readable layer has passed the full endpoint/schema/version/licence gate.
- Production certification slice: PARTIAL. Ontario WMU 57 point resolution is implemented against the official Ontario Wildlife Management Unit Feature Layer. The layer endpoint/schema and representative WMU 57 query passed local certification; this does not certify every Ontario geometry or the whole jurisdiction.
- Regulatory certification slice: PARTIAL. The 2026 ruffed/spruce grouse row for WMU 57 is encoded from the official Ontario Hunting Regulations Summary with inclusive dates (September 15–December 31) and combined limits (5 daily, 15 possession). Ontario as a whole is not marked VERIFIED.

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
- `species:ruffed-grouse` is published in `en-CA` with source-backed taxonomy, Canadian range, habitat, seasonal context, a direct answer, key facts, three contextual App Blocks, and a canonical Hunt relationship.

## Data Providers

Record actual production providers here once selected:

- Database: the certified Hunt evaluation/content loop does not use a database or PostGIS. Upstash Redis is selected only for private, immutable Hunt Brief JSON snapshots; its production URL/token are not configured.
- GIS: Government of Ontario LIO Wildlife Management Unit Feature Layer for the certified WMU 57 slice.
- Map: North Ground-rendered SVG from the resolved official WMU polygon; no third-party basemap and not a legal survey.
- Geocoding: not implemented; Hunt accepts coordinates or browser geolocation. Google Maps Platform is not configured and is not a release dependency.
- Weather: Open-Meteo forecast API, environmental context only, current day through 15 days ahead; no climatology substitution.
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
The public `www` host now serves the first source → deterministic regulation → Hunt → canonical content/search loop. The release is `PARTIAL`: public discovery, Hunt evaluation, species content, SEO, security and newsletter persistence are certified; recipient-specific Hunt Brief persistence remains fail-closed until the owner supplies the two Upstash REST credentials. Google Maps Platform and PostGIS were deliberately not introduced because the certified flow has no implementation dependency on them.

## Validation

### Build
- `npm run build` passed on 2026-09-20 (Next.js 16.1.1). The ruffed-grouse species page is statically generated; Hunt, its evaluation/share APIs, shared Hunt Brief page and per-brief Open Graph image are dynamic; home, 404, site Open Graph image, robots, and sitemap are generated successfully.

### Tests
- `npm run typecheck` passed on 2026-09-20.
- `npm run test:content-contract` passed 4/4 on 2026-09-20.
- `npm run validate:content:strict` passed the contract fixture with 0 errors and 0 warnings on 2026-09-20.
- `npm run validate:content:published` passed the published bundle with 0 errors and 0 warnings (10 entities, 2 resources, 4 blocks) on 2026-09-20.
- `npm run test:content-urls` passed 13/13, including repository coverage, on 2026-09-20; `npm run test:content-repository` passed 4/4.
- `npm run test:hunt` passed 9/9 on 2026-09-20, covering request origin/media/body/rate controls, season boundaries, fail-closed unknowns, forecast horizon, official-zone response handling/boundary warning, and regulatory/editorial separation.
- `npm run test:hunt-share` passed 13/13 on 2026-09-20, covering privacy stripping on both client and server, the real Hunt adapter, opaque IDs, immutable persistence, exact regulatory-status preservation, unsupported versions, API validation/rate limiting, native-share/copy fallbacks, server-rendered card content, staleness/source labels, and noindex/social metadata.
- `npm run test:newsletter` passed 9/9 on 2026-09-20.
- `npm run test:seo` passed 3/3 and `npm run validate:seo` passed production-server checks for metadata, SSR H1/indexability, social image, robots, sitemap, 404 and trailing-slash redirects on 2026-09-20.
- `npm run lint` passed on 2026-09-20.
- Finalized homepage/Hunt metadata validation passed on 2026-09-20: exact emitted title, description, canonical, Open Graph, Twitter fields, `www` URLs, image alt text, and the Hunt JPEG's 200 `image/jpeg` response were verified against a production build.
- Local production runtime certification resolved 45.23, -77.94 to WMU 57, returned `CONDITIONAL` for 2026-09-20, returned live weather inside the forecast horizon, returned explicit `UNAVAILABLE` weather 46 days out without provider fallback, and retrieved legal, identification, and habitat App Blocks by canonical species context.
- Browser checks passed at 375, 768, and 1440 CSS-pixel widths without horizontal overflow or console errors. Mobile Hunt and desktop species Lighthouse audits each scored 100 for accessibility, best practices, SEO, and agentic browsing.
- Hunt Brief card checks passed at 320, 360, 375, 390, 430, 768, 1024, and 1440 CSS-pixel widths with no horizontal overflow; the 320-pixel share dialog opened with focus on its close control, visible privacy guidance, native-share/copy actions, and no runtime exception.
- Release browser checks passed at 320, 360, 375, 390, 430, 768, 1024 and 1440 CSS pixels on both the local production build and canonical production homepage. Hunt remained visible in primary navigation and no width produced horizontal overflow. Reduced-motion mode now pauses both decorative videos in addition to removing CSS animation.
- Release Lighthouse audits scored 100 for accessibility, best practices, SEO and agentic browsing on mobile and desktop home, plus a mobile Hunt snapshot. The Hunt navigation path, form controls, live regions and map text equivalent were present in accessibility snapshots.
- Real browser scenarios passed locally for in-season (`CONDITIONAL`), out-of-season (`CLOSED`), unsupported WMU (`UNKNOWN`), exact mapped-boundary warning (0 m), and an aborted API request with a visible recoverable error.

### Production
- Production release commit `cc320ea` was pushed to `origin/main` and deployed by the Git integration as Vercel deployment `dpl_AyxwuxFYsYidRqC3DqKQNLZEKA56` (`https://ngbc-mgcc00j33-jaedens-projects-d98cdcfc.vercel.app`). The immutable deployment URL is Vercel-SSO protected; the public certification surface is `https://www.northgroundbushcraft.com`.
- Canonical production returns 200 for `/`, `/tools/season-finder`, `/hunting/species/ruffed-grouse`, `/apple-icon.png`, `/robots.txt` and `/sitemap.xml`; the apex permanently redirects 308 to `www`. Canonical URLs, Open Graph URLs/images, Twitter images and JSON-LD use the canonical origin. The sitemap contains home, Hunt and species and excludes recipient-specific share routes.
- The live Hunt evaluation at 45.23, -77.94 for 2026-09-20 resolved official WMU 57, returned `CONDITIONAL`, returned available Open-Meteo environmental context, retrieved canonical North Ground knowledge, and exposed official sources. This certifies only the documented narrow slice.
- One controlled production newsletter subscription returned 200 and a direct Resend segment-contacts query confirmed the address is a subscribed member. The test created durable provider state and did not send an email.
- Hunt Brief creation currently returns 503 because the Upstash URL/token are absent. The UI displays a privacy-safe temporary-unavailability state, coordinates/raw location are excluded before transmission, and a valid-format recipient URL renders a noindex storage-unavailable page. Release status is therefore `PARTIAL`, with this external storage dependency as the sole open P1; P0 count is zero.
- Security headers verified live: CSP, HSTS, `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, strict referrer policy and a camera/microphone-denying permissions policy. No Google browser/server keys, database URL, PostGIS migrations or Google CSP origins are required by this release.

### Data
- `python3 research/hunting/validate.py` passed on 2026-09-20 for 66 jurisdictions, 68 authorities, 88 regulatory/scientific sources, 27 GIS records, 127 species, 48 aliases, 156 evidence rows, 66 regulatory mappings, 15 identification risks, 25 range records, 66 source-coverage rows and 25 content opportunities (0 warnings or structural errors).
- Research counts remain research-only. The only locally certified production-shaped exception is the explicit Ontario WMU 57 / ruffed grouse 2026 slice described above.

## Agent Handoff Notes

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
