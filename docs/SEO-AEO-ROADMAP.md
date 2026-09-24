# North Ground — SEO / AEO Roadmap

> Persistent operating plan for organic discovery of North Ground and North Ground Hunt.
>
> Read `/CLAUDE.md` first.
> Read `/docs/PROJECT-STATE.md` second.
> Read this file before performing SEO, AEO, information-architecture, landing-page, internal-linking, metadata, schema, or search-discovery work.
>
> `/CLAUDE.md` is the governing product blueprint.
> `/docs/PROJECT-STATE.md` is the current implementation state.
> This document governs the SEO/AEO workstream and must remain consistent with both.

Last updated: 2026-09-24

---

## 1. Current objective

North Ground is currently product-rich but content-surface-poor.

The immediate organic-growth objective is NOT to build a broad bushcraft blog.

The immediate objective is:

**Make North Ground Hunt discoverable through authoritative, crawlable hunting information that naturally leads users into the Hunt tool.**

North Ground Hunt is the flagship acquisition target.

The species library is the second major search surface.

Broader survival, bushcraft, winter survival, camping, fishing, firecraft, shelters, gear and field-guide content remain valid future North Ground directions, but they are not the current SEO implementation priority.

---

## 2. Product/search relationship

The intended hierarchy is:

North Ground
→ Canadian outdoor authority
→ Hunting knowledge
→ Jurisdictions
→ Hunting zones / management units
→ Game species
→ Regulatory information
→ North Ground Hunt

North Ground Hunt answers the personalized question:

**What applies to this hunt, in this place, on this date, for this species?**

SEO/AEO pages should answer the broader questions people search before they reach that point and then provide a natural path into Hunt.

Examples:

- What hunting zone am I in?
- Quebec hunting zones
- Ontario hunting zones
- Ontario WMU map
- Quebec hunting zone map
- Manitoba game hunting areas
- Alberta wildlife management units
- hunting season Ontario
- deer hunting season Quebec
- ruffed grouse season Ontario
- hunting regulations Manitoba

The goal is:

**search / AI answer → useful North Ground factual page → North Ground Hunt**

Do not attempt to force `/hunt` itself to rank for every hunting query.

---

## 3. Implementation order

Unless evidence discovered during implementation requires a documented change, work in this order:

### Phase 1 — Existing-surface audit

Audit:

- homepage
- `/hunt`
- `/hunting/species`
- species profiles
- metadata
- canonical URLs
- robots
- sitemap
- structured data
- server-rendered content
- navigation
- breadcrumbs
- internal links
- social metadata
- crawlability
- indexability
- current URL architecture

Do not redesign before understanding the existing implementation.

### Phase 2 — Homepage semantic layer

Preserve the existing immersive North Ground hero and brand entrance unless a specific defect requires changing it.

Improve the crawlable semantic layer beneath/around it so humans, search engines and answer engines can understand:

- what North Ground is;
- what North Ground Hunt does;
- that North Ground provides Canadian hunting information;
- that hunting zones, species and regulatory information exist;
- where Hunt lives;
- where the species library lives.

Do not turn the homepage into a long generic SEO article.

### Phase 3 — `/hunting/` hub

Create `/hunting/` as the principal crawlable hunting knowledge gateway.

It should connect:

- Hunt
- jurisdictions
- hunting zones
- species
- current regulatory coverage
- authoritative sources where appropriate

It must be useful independently and must not exist merely to pass PageRank.

### Phase 4 — Jurisdiction pages

Build useful jurisdiction resources such as:

- `/hunting/ontario/`
- `/hunting/quebec/`
- `/hunting/manitoba/`
- `/hunting/alberta/`
- `/hunting/british-columbia/`

Additional provinces/territories follow only when the underlying North Ground data supports a useful and truthful page.

These pages should become major organic entrances into Hunt.

### Phase 5 — Zone / management-area pages

After the jurisdiction template has been proven, design crawlable canonical pages for official hunting-management geography.

Potential shapes include:

- `/hunting/ontario/wmu/57/`
- `/hunting/quebec/zones/10-west/`
- `/hunting/manitoba/gha/38/`
- `/hunting/alberta/wmu/247/`

Final URL design must be decided from repository architecture and canonical identifiers before implementation.

Do NOT mass-publish zone pages before the template, factual scope and indexability rules have been validated.

### Phase 6 — Jurisdiction × species

After jurisdiction and zone architecture is stable, consider search-intent pages such as:

- `/hunting/ontario/white-tailed-deer/`
- `/hunting/quebec/moose/`
- `/hunting/ontario/ruffed-grouse/`

These are regulatory/search resources, distinct from general biological species profiles.

### Phase 7 — Broader editorial authority

Only after the hunting discovery architecture is established should the current workstream expand heavily into:

- survival
- extreme cold
- winter survival
- bushcraft
- camping
- backcountry camping
- navigation
- firecraft
- shelters
- fishing
- equipment
- emergency preparedness

These remain part of the broader North Ground vision, not the current acquisition priority.

---

## 4. Homepage direction

The existing homepage hero is a brand asset.

Default rule:

**Preserve it.**

SEO improvements should primarily happen through semantic HTML, metadata, navigation and useful crawlable content below the immersive opening experience.

The homepage should clearly establish North Ground as a Canadian hunting/outdoor knowledge and tools brand without becoming keyword-stuffed.

Expected conceptual content:

- one accurate H1;
- concise explanation of North Ground;
- prominent Hunt gateway;
- hunting/jurisdiction gateway;
- species gateway;
- truthful current-coverage context where useful.

Exact wording must be based on current product state at implementation time.

---

## 5. `/hunting/` role

`/hunting/` should become the central search-oriented hunting hub.

It is not a replacement for `/hunt`.

Difference:

`/hunting/`
= browse, learn, discover, understand.

`/hunt`
= interact, locate, evaluate, explore.

The hub should make the site's hunting knowledge graph legible to users and crawlers.

---

## 6. Jurisdiction-page standard

A jurisdiction page must provide real value.

Potential sections include:

- direct explanation of the jurisdiction's hunting-management system;
- management geography;
- North Ground Hunt entry point;
- species for which North Ground holds useful information;
- current North Ground regulatory coverage;
- explicit limitations;
- official authorities/sources;
- concise FAQs where real search questions can be answered accurately;
- links to relevant zone and species resources.

Do not claim complete regulatory coverage merely because North Ground has official geometry.

Boundary coverage and rule coverage are separate facts.

The regulatory engine and canonical coverage data remain authoritative.

---

## 7. Zone-page standard

A zone page must never infer regulatory certainty from the existence of a boundary.

Possible facts include:

- official designation;
- North Ground readable designation;
- jurisdiction;
- official management-area type;
- map;
- species with supported information;
- certified regulatory information;
- known limitations;
- authoritative sources;
- source/check dates;
- deep link into Hunt.

The page must preserve the same distinctions Hunt preserves between:

- official geography;
- certified rules;
- partial coverage;
- unknown;
- conflict;
- point-specific facts;
- zone-wide facts.

Never flatten these states for SEO copy.

---

## 8. Species architecture

General species pages and hunting-regulation pages have different jobs.

Example:

`/hunting/species/white-tailed-deer`
= biological/general species entity.

Potential future:

`/hunting/ontario/white-tailed-deer/`
= Ontario-specific hunting/regulatory search intent.

Do not duplicate large blocks of content between them.

Use canonical North Ground species IDs and existing repository relationships.

---

## 9. AEO principles

North Ground should be easy for answer engines to understand and cite because its strongest advantage is structured, sourced information.

Important pages should favor concise answerable passages.

Good pattern:

Question / descriptive heading

Direct factual answer

Necessary qualification

Authority/source context

Path into Hunt where personalization is required

Avoid burying the answer beneath long introductions.

Where North Ground cannot truthfully answer a question, say so rather than generating generic filler.

---

## 10. Source and factual integrity

SEO must never weaken North Ground's evidence standards.

Do not:

- invent hunting rules;
- infer rules from boundaries;
- convert UNKNOWN into an answer;
- silently resolve CONFLICT;
- imply point-specific legality from a jurisdiction or zone summary;
- translate or reinterpret legal language without an owned content path;
- manufacture FAQ answers merely because a keyword exists;
- claim comprehensive coverage where coverage is partial;
- create fake freshness;
- use editorial prose as regulatory authority.

Prefer existing canonical repository data.

Official-source provenance should remain visible where useful.

---

## 11. Programmatic SEO rule

Programmatic pages are allowed only when each page has a defensible reason to exist.

Do not mass-generate thin pages merely because North Ground has hundreds of zone IDs or dozens of species.

Before scaling a template:

1. build a small representative set;
2. inspect rendered HTML;
3. inspect factual correctness;
4. inspect internal links;
5. inspect canonical behavior;
6. inspect structured data;
7. inspect mobile UX;
8. validate indexability;
9. validate that the page provides independent utility;
10. only then scale.

Quality outranks URL count.

---

## 12. Internal-linking model

The intended graph is broadly:

Homepage
↕
Hunting hub
↕
Jurisdiction
↔ Species
↕
Zone
↔ Jurisdiction × Species
↘
Hunt

Hunt should be contextually linked where the next useful action is to evaluate an exact place/date/species.

Anchor text should describe the destination naturally.

Avoid repetitive sitewide keyword stuffing.

---

## 13. Structured-data rule

Use structured data only when it truthfully represents visible page content and is supported by Google's/current web standards at implementation time.

Do not add schema solely because a schema type exists.

Potentially useful structures may include:

- Organization
- WebSite
- BreadcrumbList
- Article where genuinely applicable
- other page-specific types supported by evidence and current standards

FAQ content may still be useful for users/AEO even when search engines do not provide a special FAQ rich result.

Structured data must never state facts more strongly than the visible page.

---

## 14. Technical SEO baseline

Every indexable page should be reviewed for:

- unique title;
- useful meta description;
- one coherent primary heading;
- canonical URL;
- indexability;
- server-rendered meaningful content;
- crawlable internal links;
- sitemap inclusion where appropriate;
- breadcrumbs where appropriate;
- social metadata;
- mobile usability;
- performance;
- semantic HTML;
- accessibility;
- duplicate/thin-page risk.

Do not optimize metadata in isolation from page usefulness.

---

## 15. Working protocol

SEO/AEO work proceeds ONE MATERIAL CHANGE AT A TIME.

Required loop:

1. inspect current implementation;
2. identify one proposed change;
3. explain the change and why;
4. owner approves;
5. implement only that approved scope;
6. inspect the diff;
7. run relevant tests/checks;
8. run the development site;
9. visually inspect desktop/mobile where applicable;
10. fix or accept;
11. update documentation/state when material;
12. commit;
13. proceed to the next change.

Do not stack an unverified second material change onto the first.

Do not perform opportunistic unrelated refactors.

Do not redesign Hunt as part of SEO work unless an explicit task requires it.

---

## 16. Repository safety

The repository may contain unrelated untracked files, assets, temporary files and work from other sessions.

Do not delete, move, stage, rewrite or commit unrelated files.

Before each patch:

- inspect `git status`;
- identify exact files in scope;
- preserve concurrent work;
- inspect the resulting diff.

Commits should contain only the intended workstream change.

---

## 17. Documentation responsibility

When implementation materially changes repository state:

- update `/docs/PROJECT-STATE.md`.

When SEO/AEO strategy, page architecture, sequencing or governing decisions change:

- update this document.

Do not rewrite `/CLAUDE.md` merely to record implementation progress.

Update `/CLAUDE.md` only when product direction itself materially changes and the governing blueprint must change.

---

## 18. Current planned sequence

Current sequence as of 2026-09-24:

- [x] Audit current homepage/Hunt/species SEO implementation
- [x] Certify homepage semantic/search baseline
- [x] Improve homepage semantic layer if required
- [ ] Design and implement `/hunting/`
- [ ] Validate `/hunting/` in development
- [ ] Design jurisdiction-page data contract/template
- [ ] Publish first high-confidence jurisdiction pages
- [ ] Validate search/indexing architecture
- [ ] Design first zone-page prototype
- [ ] Validate before programmatic expansion
- [ ] Evaluate jurisdiction × species architecture
- [ ] Expand broader North Ground editorial authority later

---

## 19. Success criteria

This workstream succeeds when North Ground develops a coherent organic discovery system in which:

- search engines can understand what North Ground and North Ground Hunt are;
- users can enter through useful hunting queries rather than already knowing the brand;
- AI systems can extract concise, sourced, qualified North Ground answers;
- jurisdiction, zone and species entities are connected coherently;
- every important informational path can lead naturally into Hunt;
- pages remain useful without requiring Hunt;
- Hunt remains the superior personalized answer surface;
- regulatory truth is never sacrificed for traffic;
- broader North Ground authority can later grow around a strong hunting foundation.

---

## 20. Current decision log

### 2026-09-24 — Hunt-first organic acquisition

The immediate SEO/AEO priority is North Ground Hunt discovery, supported by species and hunting knowledge pages.

A broad generic bushcraft-content push is deferred.

### 2026-09-24 — Preserve homepage experience

The immersive homepage hero should remain the brand entrance by default. Search clarity should be added primarily through the semantic/crawlable layer rather than replacing the visual identity with a conventional SEO landing page.

### 2026-09-24 — Hunting knowledge architecture

The planned discovery architecture is:

`/hunting/` → jurisdictions → zones → jurisdiction/species resources → Hunt.

Exact child URL patterns remain subject to repository/data-contract inspection before implementation.


### 2026-09-24 — Homepage discovery baseline complete

The homepage semantic/search baseline is certified. The existing immersive entrance remains intact,
with a server-rendered discovery layer providing one coherent H1, concise explanation of North
Ground's hunting surface, and crawlable paths to North Ground Hunt and the species library.

The next separate material change is design and implementation of `/hunting/`.

### 2026-09-24 — Controlled programmatic expansion

North Ground will not mass-publish hundreds of zone/species pages until representative templates have been manually inspected and technically/factually certified.
