# North Ground Technical Foundation Audit

Audit date: 2026-09-20; extended 2026-09-21 for canonical species-media foundations

Scope: current `main` worktree through the technical-foundation remediation commits, excluding uncommitted files owned by other agents.

Method: repository inspection, `next build`, and HTTP inspection of the production build on localhost. No production deployment, third-party analytics property, email provider, or external domain configuration was inspected.

## Priority scale

- **P0:** active safety, legal, security, or irreversible data-loss incident; fix before traffic.
- **P1:** blocks trustworthy launch, discovery, accessibility, or a core user promise.
- **P2:** material quality/scale issue that should be scheduled before expanding content.
- **P3:** hardening or optimization with limited current impact.

The newsletter false-success defect was treated as P0 and remediated. Production activation remains explicitly blocked until the Resend credentials documented in `.env.example` are configured; an unconfigured deployment now returns a truthful service-unavailable error instead of success.

## Remediation status

Status vocabulary: **FIXED** is complete in repository code and local production validation; **PARTIAL** has a safe foundation but remaining work; **BLOCKED** needs an external credential, policy, deployment, or owner decision; **REMAINS** is confirmed and intentionally untouched because it belongs to active visual/content work or is premature.

| Finding | Status | Current evidence / next boundary |
| --- | --- | --- |
| Newsletter persistence and false success | **FIXED** / production activation **BLOCKED** | Server route now validates and normalizes email, persists idempotently to Resend Contacts plus a dedicated Segment, re-subscribes existing contacts, fails closed, avoids PII logging, and returns stable errors. Nine tests pass. `RESEND_API_KEY` and `RESEND_SEGMENT_ID` must be configured before deployment. |
| Newsletter abuse/privacy controls | **PARTIAL** | Same-origin and JSON checks, a 1 KiB body limit, honeypot, per-IP/per-email in-process limits, privacy-conscious logging, and operational documentation are present. A distributed Vercel Firewall rate rule and published privacy/retention policy remain deployment/owner work. |
| robots.txt | **FIXED** | `/robots.txt` permits public pages, blocks `/api/`, declares the canonical host and sitemap, and returns 200 in the production build. |
| Sitemap | **FIXED** | `/sitemap.xml` contains only the current public homepage. Hunt/content routes are intentionally excluded until their owners publish them. |
| Canonical URL behavior | **PARTIAL** | Homepage emits an absolute canonical that excludes query parameters; trailing slashes redirect permanently to the no-slash path. Canonical host/HTTPS redirects remain **BLOCKED** on confirmed deployment/DNS topology. |
| Metadata and OG/Twitter previews | **FIXED** | Accurate site naming/description, title template, indexing policy, locale, theme, Open Graph, Twitter card, and generated 1200×630 image are present and production-HTML tested. |
| Server-rendered H1 | **FIXED** | The only indexable page now has one meaningful H1 in prerendered HTML. It is visually hidden to avoid conflicting with active hero work; the visual owner should incorporate it visibly when safe. |
| Server-rendered indexability | **PARTIAL** | Metadata, H1, organization/site identity, contact copy, and newsletter shell are prerendered. Mission Deck copy remains interaction-gated in active visual architecture. |
| Breadcrumbs and structured data | **FIXED** baseline | Organization and WebSite JSON-LD use stable IDs. A reusable semantic breadcrumb plus matching `BreadcrumbList` primitive exists and rejects non-hierarchies; it is correctly unused on the one-level homepage. No speculative Article/Person schema was added. |
| Homepage form label | **FIXED** | Newsletter input has an accessible name, described status, invalid state, and bounded input length. |
| Placeholder internal link | **FIXED** | The `href="#"` YouTube control was removed; no destination was invented. Real primary navigation remains **REMAINS** until public routes exist. |
| Custom 404 | **FIXED** | Unknown routes return status 404, a branded recovery page with H1/home link, and `noindex`; verified against the production server. |
| Redirect behavior | **PARTIAL** | A no-trailing-slash policy and 308 normalization are tested. No historical redirects were invented; host/HTTPS rules remain deployment-owned. |
| Framework signature | **FIXED** | `poweredByHeader` is disabled. |
| Analytics | **BLOCKED** | No analytics is configured. Provider, consent, coarse-location policy, retention, and event design must be approved before instrumentation. |
| Canonical species PRIMARY media | **PARTIAL** / production activation **BLOCKED** | Server-authenticated card drop, canonical-ID binding, private storage, metadata-stripping WebP pipeline, service-role-only schema, atomic replacement/history, placeholders and shared library/profile/Hunt consumers are implemented. Schema replay and seven focused tests pass; a real local browser proved sign-in plus first durable upload and immediate library refresh. Production migration/bucket/admin variables and the interrupted replacement/all-consumer browser certification remain. |
| Hero scroll/reflow, modal semantics, native image, lint, media performance | **REMAINS** | These findings are still valid in active visual files and were not modified. |
| Route error/loading boundaries | **REMAINS** | Still premature until dynamic public route ownership settles. |

## Verified baseline

- Framework: Next.js 16.1.1 App Router, React 19.2.3, TypeScript strict mode.
- Routes: `/`, branded `/_not-found`, `/opengraph-image`, `/robots.txt`, and `/sitemap.xml` are statically generated; `/api/subscribe` is dynamic.
- `npm run build`: passed on 2026-09-20.
- Production HTTP validation: `/`, `/robots.txt`, `/sitemap.xml`, and `/opengraph-image` return 200; an unknown path returns a branded 404/noindex page; trailing-slash variants normalize with 308.
- Home HTML contains one server-rendered H1, an absolute canonical URL, complete baseline metadata, Open Graph/Twitter tags, and Organization/WebSite JSON-LD.
- Media payload on disk is approximately 7.1 MB across video variants; browser transfer depends on codec/media selection and was not measured with Lighthouse.
- Species media uses fixed-dimension avatar/card/profile WebP derivatives, lazy loading by default and immutable asset URLs. Raw uploads and embedded location metadata are not retained.

## Original findings

This table preserves the evidence captured at audit time. The remediation-status table above is authoritative for current disposition.

| Priority | Problem | Evidence | Impact | Recommended fix | Likely ownership | Safe now? |
| --- | --- | --- | --- | --- | --- | --- |
| P1 | Newsletter reports success but stores nothing | `src/app/api/subscribe/route.ts:11-15` only logs the email and returns `{ok:true}`; `NewsletterForm.tsx:27-29,54` clears the address and says “Locked in” | Silent subscriber loss and a false user promise; raw email also enters logs | Disable the form or connect a real provider with consent text, durable idempotent persistence, provider-error handling, rate limiting, and privacy-safe logging; test a real subscription end to end | Main site + email/data owner | No; provider/consent decision required and visual form is active-agent territory |
| P1 | No crawl directives or sitemap | No `src/app/robots.ts` or `sitemap.ts`; production-build requests to both routes returned 404 | Crawlers lack declared policy/discovery feed; becomes worse as resources launch | Confirm production canonical host, then add MetadataRoute-based robots and sitemap generated only from published canonical resources/tools | Platform/SEO | No; canonical host and future route registry are not confirmed |
| P1 | No canonical URL strategy in rendered site | Root metadata has title/description only (`layout.tsx:4-19`); rendered HTML had no `rel=canonical`; no redirect registry/config exists | Host/path variants and future aliases can split signals or create duplicates | Set `metadataBase`, per-page alternates/canonical values from the URL resolver, one host/trailing-slash policy, and tested permanent redirects for historical paths | Platform/SEO | No; host and route decisions pending |
| P1 | Home page has no H1 | Rendered home HTML contains only the footer H2; hero has a logo image and tagline (`Hero.tsx:365-392`) | Weak document outline and inaccessible/ambiguous page purpose | Add one visible, brand-appropriate H1 in the active homepage design; keep it useful rather than visually hidden keyword text | Main site visual/content | No; active visual files |
| P1 | Important homepage copy is client-state gated | `page.tsx` is entirely a Client Component (`:1`); Mission Deck is not mounted until interaction (`:35`), so its copy was absent from initial HTML | Crawlers and no-JS users receive little substantive information; content is not a durable search surface | Keep interaction in a client island, but render the core homepage proposition/navigation in server-rendered HTML; do not rely on a modal/deck for essential facts | Main site visual/platform | No; active visual architecture |
| P1 | Global scroll lock makes footer/content reachability fragile | `globals.css:11-15` permanently sets `html, body { overflow:hidden }`; footer follows the full-screen experience at `page.tsx:37-63` | Keyboard, zoom, small viewport, and no-JS users may be unable to reach the form/contact content | Limit scroll locking to the open overlay, verify 200%/400% zoom and small-height devices, and provide a normal document-flow route to key content | Main site visual/accessibility | No; active visual files |
| P1 | Mission Deck is not implemented as an accessible modal/dialog | `MissionDeck.tsx:247-257` is a labeled section, not a dialog; focus is restored on close but not moved into or trapped within it (`page.tsx:23-27`); background is not inert | Screen-reader/keyboard users can lose context or interact with content behind the overlay | Use dialog semantics (`role=dialog`, `aria-modal`, label/description), initial focus, focus containment, inert background, Escape/close behavior, and reduced-motion testing | Main site visual/accessibility | No; active visual files |
| P1 | Newsletter input has no programmatic label | `NewsletterForm.tsx:37-47` supplies only a placeholder | Assistive technology and voice input users lack a stable form label | Add a visible label or accessible name; retain explicit status messaging and associate errors/help text | Main site visual/accessibility | No; active visual files |
| P1 | Subscription endpoint lacks production abuse/privacy controls | Route accepts any string (`route.ts:5-9`), logs raw email (`:13`), and has no size/content-type/rate/CSRF-or-origin considerations | PII leakage, log abuse, spam/provider cost, and unreliable validation | Validate normalized email and body size/content type, avoid raw PII logs, add IP/provider controls appropriate to deployment, define consent/retention, and return stable error codes | Platform/security/email | No; implement with real provider and privacy policy |
| P2 | Metadata does not reflect the broader North Ground direction and lacks social cards | `layout.tsx:5-18` identifies “North Ground Bushcraft” and legacy scope; no Open Graph/Twitter metadata or image convention exists | Inconsistent positioning and poor link previews | Approve public naming/copy, add title template, accurate description, metadata base, OG/Twitter images/tags, and route-specific metadata from resource records | Brand/content/SEO | No; needs owner-approved positioning and active visual assets |
| P2 | No structured-data or breadcrumb implementation | Repository search found no JSON-LD or breadcrumb code; current site has only one page | Future entity/resource relationships will not be explicitly expressed to search systems; multi-level navigation would lack orientation | Add visible semantic breadcrumbs plus matching supported `BreadcrumbList`; add only schema types supported by visible page content, with validation tests | Platform/SEO/content | Not yet; wait for actual resource routes |
| P2 | Internal navigation is effectively absent and one link is a placeholder | Home footer YouTube link is `href="#"` (`page.tsx:54-56`); no primary navigation or resource links exist | Users cannot discover durable site areas; placeholder creates confusing focus/history behavior | Remove/disable placeholder until real URL exists; introduce server-rendered primary navigation and relationship-driven links as real surfaces ship | Main site visual/content | No; active homepage |
| P2 | Generic framework 404 does not recover users | No `src/app/not-found.tsx`; unknown route rendered “404: This page could not be found” with no North Ground navigation | Dead-end experience and no recovery to tools/resources | Add branded, lightweight custom 404 with home/search/tool paths; keep true 404 status and noindex behavior | Main site visual/platform | No; design ownership active |
| P2 | Error/loading boundaries are not defined | No `error.tsx`, `global-error.tsx`, or route-specific loading/error UI | Future APIs/content routes will fall back to generic errors and may not provide recovery | Add boundaries when dynamic surfaces land; log errors without sensitive location/context | Platform/application | Yes in isolation, but premature before route ownership settles |
| P2 | Current lint gate is red in active hero code | `npm run lint` reports `react-hooks/set-state-in-effect` at `Hero.tsx:25` plus the native-image warning at `:365` | CI cannot use lint as a clean release gate and a potential extra render remains unresolved | Refactor capability detection to avoid synchronous state mutation in an effect, then rerun interaction/device tests; address or deliberately suppress the image rule with evidence | Main site visual/performance | No; active hero file |
| P2 | Above-the-fold logo uses native `<img>` | `Hero.tsx:365-372`; current build preloads it, but no Next image optimization/sizing policy is applied | Missed consistent optimization/format behavior; limited current impact because asset is local WebP with dimensions | Use `next/image` with correct sizing/priority if visual testing shows no interaction regression | Main site visual/performance | No; active hero |
| P2 | Entire homepage is hydrated for a small amount of state | `page.tsx:1` makes footer and static shell part of the client boundary; Hero/Mission Deck also contain substantial client code | More JavaScript/hydration work than a server shell with client islands; hurts scale and low-end mobile resilience | Split server-rendered document content from interactive hero/deck islands; measure bundle and INP before/after | Main site visual/platform | No; active architecture |
| P2 | Analytics/consent and privacy boundaries are absent | No analytics dependency, script, event schema, or consent/privacy implementation found | No trustworthy conversion/product measurement; adding ad hoc analytics later risks collecting precise outdoor locations | Define privacy-first events, coarse location policy, consent requirements, retention, and provider before instrumentation; never send precise hunt coordinates by default | Product/privacy/analytics | No; provider/policy decision required |
| P3 | Redirect behavior and security headers are undefined | `next.config.ts` is empty; no proxy/redirect map/header configuration exists | Future migrations may create chains; baseline headers depend entirely on hosting | Define host/HTTPS redirects at edge, route migrations in a tested registry, and a CSP/security-header plan compatible with video/analytics | Platform/security | No immediate route migration; schedule before integrations |
| P3 | Media performance is optimized in part but not certified | AV1/H.264 variants and posters exist; hero videos are 584 KB–1.7 MB and deck videos 1.1–1.8 MB; autoplay loops in `Hero.tsx:336-362` and `MissionDeck.tsx:259-275` | Data/battery/GPU cost may be meaningful outdoors; actual Core Web Vitals unknown | Run mobile Lighthouse/WebPageTest and real-device tests, honor reduced-data as well as reduced-motion, verify correct source selection/posters, and set budgets | Main site visual/performance | No; measurement can be run, changes belong to visual agent |
| P3 | Default framework signature is exposed | Local production response includes `X-Powered-By: Next.js`; `next.config.ts` has no `poweredByHeader:false` | Minor information disclosure; not a primary security control | Disable the header during platform hardening | Platform/security | Yes, but defer while concurrent owners may change config |

## Category disposition

| Requested category | Result |
| --- | --- |
| robots.txt | **FIXED** |
| sitemap | **FIXED** for current published route set |
| canonical | **PARTIAL**; page/trailing-slash policy fixed, edge host policy blocked |
| metadata | **FIXED** baseline |
| OG/Twitter | **FIXED** baseline |
| H1 | **FIXED** in SSR HTML; visible integration remains with visual owner |
| SSR/indexability | **PARTIAL**; semantic shell fixed, interaction-gated deck copy remains |
| structured data | **FIXED** justified Organization/WebSite baseline |
| breadcrumbs | **FIXED** implementation; correctly unused on one-level homepage |
| internal linking | **PARTIAL**; fake link removed, real navigation waits for routes |
| 404 | **FIXED** |
| redirects | **PARTIAL**; path normalization tested, host/HTTPS edge policy blocked |
| accessibility | **PARTIAL**; label/H1/404 fixed, active hero/modal/reflow findings remain |
| performance | Build passes and media variants are compact, but no CWV certification; P2/P3 findings |
| newsletter persistence | **FIXED** in code; production credentials **BLOCKED** |
| analytics | **BLOCKED** on policy/provider decision; intentionally not added |
| canonical species media | **PARTIAL** in repository; production activation and final replacement/browser sweep **BLOCKED** |

## Recommended order

1. Configure and smoke-test the documented Resend credentials, then add a distributed edge rate rule before campaign traffic.
2. Confirm production domain topology and enforce HTTPS/canonical-host redirects at the edge.
3. Resolve the remaining active-visual accessibility findings: document flow/reflow, visible H1 integration, and modal focus/semantics.
4. Apply the breadcrumb primitive and route-specific metadata only as real owned content routes ship.
5. Define privacy/consent/retention policy before analytics instrumentation.
6. Measure mobile performance/accessibility and add error boundaries alongside real dynamic routes.

## Validation evidence

```text
npm run build
✓ Compiled successfully
✓ Generating static pages (7/7)
○ / (static)
○ /_not-found (static)
○ /opengraph-image (static)
○ /robots.txt (static)
○ /sitemap.xml (static)
ƒ /api/subscribe (dynamic)

GET /              200
GET /robots.txt    200
GET /sitemap.xml   200
GET /opengraph-image 200 image/png
GET /does-not-exist 404, branded recovery + noindex
GET /does-not-exist/ 308 → /does-not-exist

npm run test:newsletter  9/9 passed
npm run test:seo         3/3 passed
npm run validate:seo     passed against `next start`
```

The audit intentionally makes no claim about production uptime, deployed cache/CDN behavior, Search Console state, real Core Web Vitals, live Resend persistence, or analytics dashboards because credentials and those production systems were not available in the repository evidence.
