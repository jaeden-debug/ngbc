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
- The only currently indexable route is `/`; Hunt and editorial routes are not included in the sitemap until their owners publish them.

### Hunting Intelligence
- Flagship product under active development.
- Intended capability: location/date/species → zone + season + applicable rules + authoritative sources + environmental context + North Ground knowledge.
- Architecture should support international expansion while initial verified coverage is developed jurisdiction by jurisdiction.
- An isolated research foundation now exists in `research/hunting/`; it is an inventory/review input, not production rule data.

### Content / Knowledge Graph
- Structured content system being developed in parallel with Hunt.
- Editorial standard: maximum useful information with minimum necessary words.
- Species, conditions, clothing, packing, skills, regulations and related entities should be reusable by the application.
- Shared content contract v1 is defined in `docs/content-system/` with canonical ID, species/resource, App Block, deterministic matching, relationship, source, media, URL, quality and lifecycle rules.
- Storage-neutral TypeScript contracts live in `src/lib/content-contract/`. A normalized-bundle validator and tests live in `scripts/`; production registries, adapters, repository/API and migrated content remain unfinished.

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
- Newsletter production activation still requires `RESEND_API_KEY` and `RESEND_SEGMENT_ID`; the route fails closed and does not claim success while unconfigured.
- Canonical host/HTTPS redirect enforcement still requires confirmed deployment/DNS topology. The repository enforces a no-trailing-slash path policy.
- Active visual files still contain the audited scroll/reflow, modal focus/semantics, native-image, and Hero lint findings. The server-rendered H1 is visually hidden until it can be incorporated without conflicting with active hero work.
- Analytics remains intentionally unconfigured pending provider, consent, retention, location-privacy, and event-design decisions.
- No production content registry, authoring adapter, canonical URL resolver, content repository/API, or Hunt-to-content adapter exists yet.

## Next Priorities

1. Complete current visual foundation without locking poor information architecture.
2. Establish technical/semantic site architecture.
3. Establish trust pages and North Ground Verified framework.
4. Continue Hunting Intelligence core.
5. Build structured knowledge/content graph alongside Hunt.
6. Establish initial verified regulatory coverage.
7. Connect Hunt to stable North Ground content IDs.
8. Build early cold-weather authority resources/tools.
9. Begin standardized field-data collection.
10. Build Crown/public-land data foundation ahead of seasonal demand.
11. Select the authoritative content store, export the shared normalized bundle, and certify page families before making content validation blocking.

## Blocked

Record only genuine blockers here.

Examples:
- missing API credentials
- unavailable official GIS data
- owner decision required
- third-party service issue

- Newsletter live persistence: provide a full-access Resend API key as `RESEND_API_KEY` and the dedicated Contacts Segment ID as `RESEND_SEGMENT_ID`; then perform a production smoke test and configure distributed edge rate limiting.
- Canonical host redirects: confirm the production domain/alias and HTTPS termination topology before enforcing host redirects.
- Analytics: approve provider, consent model, coarse-location constraints, retention, and event contract before adding instrumentation.

## Regulatory Coverage

### Canada
Record each jurisdiction as:
VERIFIED / PARTIAL / IN DEVELOPMENT / UNAVAILABLE

Do not mark VERIFIED until actual data and representative queries have been certified.

- Research inventory: PARTIAL for federal plus all 13 provinces/territories. Principal authorities, official terminology and regulatory-source leads are recorded; no jurisdiction is certified `VERIFIED` for production.
- Canadian species evidence: 68 source-linked rows across all 14 jurisdiction records; 41 are `SOURCE_FOUND`, 20 `NEEDS_REVIEW`, and 7 `STALE`.
- GIS: official discovery records exist, but most machine-readable service URLs/schemas and effective-version checks remain incomplete.

### United States
Not assumed complete.
Add jurisdictions only when genuinely implemented.

- Research inventory: IN DEVELOPMENT for federal plus all 50 states; D.C. relevance remains unresolved. Principal wildlife authorities and official hunting hubs are inventoried, but state species evidence/current-guide certification is not complete.

### Other Countries
Future.

## Species Coverage

Maintain a reference to the authoritative species registry rather than duplicating the entire registry here.

Research registry: `research/hunting/species-master.csv` currently contains 57 high-priority North American species and 27 alias records. It is not production editorial coverage and does not encode universal huntability.

Current editorial coverage:
- Update as resources ship.

## Data Providers

Record actual production providers here once selected:

- Database:
- GIS:
- Map:
- Geocoding:
- Weather:
- Analytics:
- Email: Resend Contacts + dedicated Segment selected for newsletter persistence; credentials not configured in the inspected environment.
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
The public site identity is North Ground, with North Ground Bushcraft retained as an alternate entity name. The canonical default origin is `https://northgroundbushcraft.com` and is environment-configurable. Newsletter subscriptions persist server-side to Resend Contacts plus a dedicated Segment and fail closed when credentials/provider confirmation are unavailable. Only actual published routes enter the sitemap or structured data.

## Validation

### Build
- `npm run build` passed on 2026-09-20 (Next.js 16.1.1; `/`, custom 404, Open Graph image, robots and sitemap statically generated; `/api/subscribe` dynamic).

### Tests
- `npm run typecheck` passed on 2026-09-20.
- `npm run test:content-contract` passed 4/4 on 2026-09-20.
- `npm run validate:content:strict` passed the contract fixture with 0 errors and 0 warnings on 2026-09-20.
- `npm run test:newsletter` passed 9/9 on 2026-09-20.
- `npm run test:seo` passed 3/3 and `npm run validate:seo` passed production-server checks for metadata, SSR H1/indexability, social image, robots, sitemap, 404 and trailing-slash redirects on 2026-09-20.
- `npm run lint` remains blocked by one existing error (`react-hooks/set-state-in-effect`) and one warning (`no-img-element`) in the active `src/components/Hero.tsx`; shared contract files introduce no reported lint findings.

### Production
- Update with actual deployment status.

### Data
- `python3 research/hunting/validate.py` passed on 2026-09-20 for 66 jurisdictions, 68 authorities, 76 regulatory/scientific sources, 27 GIS records, 57 species, 27 aliases and 68 evidence rows (0 warnings or structural errors).
- No hunting jurisdiction/species relationship or GIS layer is certified for production ingestion yet.

## Agent Handoff Notes

Keep temporary but important cross-agent coordination here.

Remove obsolete handoff notes once they no longer help future work.

- Shared foundation files created: `docs/content-system/*.md`, `src/lib/content-contract/{ids,types,index}.ts`, `scripts/validate-content-contract*.mjs`, `fixtures/content-contract/valid-bundle.json`, and `docs/technical-foundation-audit.md`.
- The fixture demonstrates validation only; it is not published coverage or evidence.
- Future stitching must compare Hunt/content implementations with `docs/content-system/INTEGRATION-HANDOFF.md` and adapt rather than create duplicate registries/APIs.
- Hunting research handoff: `research/hunting/HANDOFF.md`; counts/gaps: `research/hunting/COVERAGE-REPORT.md`. Research IDs follow the shared canonical convention, while legality remains in the regulatory domain.
