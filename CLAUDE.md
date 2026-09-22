# NORTH GROUND — MASTER PROJECT BLUEPRINT

> This file is the permanent directional context for North Ground.
>
> Read this document completely before planning, modifying, generating, deleting, migrating, deploying, researching, or otherwise changing anything in this repository.
>
> Also read `docs/PROJECT-STATE.md` before beginning work.
>
> A user prompt tells you WHAT to work on next.
> This document tells you WHAT NORTH GROUND IS, WHY WE ARE BUILDING IT, and HOW your work must fit the larger system.
>
> Do not optimize a local task at the expense of this blueprint.

---

# 1. THE PROJECT

North Ground is being built into a high-trust outdoor knowledge, data, tools, field-testing, and eventually outdoor-intelligence platform.

It begins with a strong Canadian identity and Canadian expertise but must not be architecturally limited to Canada.

North Ground is not simply:

- a bushcraft blog
- a hunting website
- an SEO content site
- an affiliate website
- a collection of calculators
- a hunting map
- a survival website
- an AI wrapper
- a gear-review site

Those may all become components of North Ground.

The larger vision is:

**North Ground helps people understand the outdoors, make better field decisions, and determine what applies where they are actually going.**

The long-term platform combines:

1. authoritative external data
2. North Ground structured knowledge
3. location and geospatial intelligence
4. environmental/weather data
5. original field testing
6. useful interactive tools
7. concise editorial resources
8. species and wildlife knowledge
9. outdoor regulations and access information
10. eventually tested gear and products

The system should increasingly be able to answer:

> **I'm going HERE, on THIS DATE, to do THIS. What do I need to know?**

That question extends far beyond hunting.

---

# 2. NORTH STAR

The long-term North Ground product is a location-aware outdoor intelligence platform.

A future user should be able to provide:

- location
- date
- intended activity
- species where relevant
- trip duration
- experience/context where relevant

and receive useful information assembled from authoritative and North Ground sources.

Examples:

> I'm hunting grouse near Maniwaki this weekend. What zone am I in, is the season open, what rules apply, what will the weather be like, what should I wear, and what should I pack?

> Can I camp on this Crown/public land?

> Can I have a fire here today?

> What fishing zone am I standing in?

> What regulations apply to this lake?

> What can I hunt here today?

> What should I wear for a six-hour stationary hunt at -20°C?

> What emergency equipment should I carry for this winter trip?

> What species are found here?

> What does this weather mean for my planned activity?

North Ground should progressively answer these questions better than fragmented browsing across maps, PDFs, government pages, generic articles, forums, and search results.

---

# 3. THE CENTRAL POSITIONING

North Ground should become known for:

**Canadian outdoor decisions, verified against authoritative sources and tested in actual field conditions.**

Canada is the initial credibility base.

Canada is NOT the architectural ceiling.

North Ground may eventually serve users in:

- Canada
- United States
- additional countries

but geographic expansion must follow verified data availability and genuine product quality.

Never pretend global coverage exists when it does not.

---

# 4. THE THREE NORTH GROUND TRUST SYSTEMS

Three concepts should become recognizable parts of the brand.

## 4.1 NORTH GROUND VERIFIED

Used for information validated against authoritative sources.

Examples:

- hunting regulations
- season dates
- management zones
- Crown/public land rules
- fire regulations
- fishing regulations
- safety thresholds
- legal hunting times

Verification should expose:

- authority
- source
- jurisdiction
- effective period where applicable
- retrieved date
- last verified date
- important limitations
- conflicting sources where they exist

Verification does NOT mean North Ground replaces the governing authority.

North Ground makes authoritative information easier to understand and use.

---

## 4.2 NORTH GROUND FIELD TESTED

Used for first-hand testing performed by North Ground.

A field test should record enough context to make the result meaningful.

Where applicable:

- location/region
- date
- duration
- temperature
- wind
- precipitation
- terrain
- equipment
- method
- observations
- failures
- result
- limitations
- applicability
- photos/video
- measurement equipment

Failures are valuable evidence.

Do not hide them.

Never call something field tested unless North Ground actually tested it.

---

## 4.3 NORTH GROUND TOOLS

Interactive utilities that turn complicated information into decisions.

Examples include:

- Hunting Intelligence / Season Finder
- Hunting Zone Finder
- Cold Risk
- Crown/Public Land tools
- fishing-zone tools
- fire restriction tools
- trip planning
- packing systems
- weather/condition interpretation

Tools should solve real problems.

Do not create calculators solely because a keyword exists.

---

# 5. CURRENT FLAGSHIP PRODUCT: HUNTING INTELLIGENCE

A major early North Ground product is the Hunting Intelligence platform.

This is NOT merely a hunting-season table.

The fundamental question is:

> **Where are you hunting, when are you hunting, and what do you need to know?**

A user should eventually be able to:

- use their location
- search an address
- search a postal/ZIP code
- search a city/region
- select a point on a map
- choose a date
- browse species
- identify their hunting management zone/unit
- inspect zone boundaries
- determine what seasons apply
- see applicable restrictions
- see authoritative sources
- understand legal hunting-time rules where available
- view relevant weather
- receive relevant North Ground knowledge
- find deeper guides
- plan the hunt
- save/share/print useful information

The highest-value user question is:

> **What can I hunt here today?**

Other important intents include:

> What hunting zone am I in?

> What is in season right now?

> When can I hunt [species] here?

> What rules apply here?

> What should I know before hunting here?

> What should I wear/pack for this hunt?

> What do I need before I can go?

The interface through which this is asked and answered, including the Ready to
Hunt checklist, is specified in section 41A.

---

# 6. HUNTING PLATFORM DATA PHILOSOPHY

The hunting platform has multiple information layers.

They MUST NOT be confused.

## Layer A — Official / Regulatory Data

Examples:

- hunting zones
- management units
- season dates
- bag limits
- possession limits
- licence/tag requirements
- legal methods
- sex/age restrictions
- hunter classifications
- legal hunting hours
- special territories
- municipal restrictions

Source this from authoritative sources.

Do not use an LLM as the authority for these facts.

---

## Layer B — Environmental Data

Examples:

- weather
- temperature
- wind
- precipitation
- snow
- visibility
- sunrise
- sunset
- alerts
- cold conditions

These come from legitimate environmental/weather providers.

---

## Layer C — North Ground Knowledge

Examples:

- species knowledge
- hunting techniques
- habitat
- clothing
- packing
- seasonal considerations
- navigation
- safety
- field care
- outdoor skills

This is North Ground editorial knowledge.

---

## Layer D — North Ground Evidence

Examples:

- original field tests
- measurements
- equipment tests
- photographs
- video
- observed conditions
- repeated experiments

These are first-party North Ground evidence.

The interface should make these layers understandable rather than blending everything into unattributed prose.

---

# 7. GOVERNMENT DATA IS AN INPUT, NOT AN ENEMY

Government agencies and other regulatory authorities are expected to remain the legal authority.

North Ground should not attempt to pretend otherwise.

The opportunity is:

**Government owns the rule. North Ground can own the experience of understanding and using it.**

Government information is often distributed across:

- web pages
- PDFs
- maps
- GIS systems
- regulatory documents
- tables
- multiple departments
- special territory pages

North Ground should turn that fragmentation into:

**Answer → Map → Rule → Source → Action**

Whenever possible, a user should be able to inspect the original authoritative source.

North Ground should earn trust by making provenance obvious.

---

# 8. REGULATORY ACCURACY IS NON-NEGOTIABLE

A polished incorrect regulatory answer is a failed product.

Never infer legality from missing information.

Never convert:

> “I could not find a restriction”

into:

> “There is no restriction.”

Never allow AI to fill missing regulatory fields.

Regulatory results should support states such as:

- OPEN
- CLOSED
- CONDITIONAL
- UNKNOWN
- CONFLICT
- NEEDS VERIFICATION

Uncertainty is preferable to false certainty.

A coordinate can belong to multiple overlapping regulatory layers.

Do not assume:

**coordinate → one zone → one rule**

Possible layers include:

- country
- province/state/territory
- wildlife management unit
- subzone
- special management area
- wildlife reserve
- controlled area
- federal migratory-bird district
- municipality
- private/public land context
- species-specific management area

The data architecture must support this complexity.

---

# 9. INTERNATIONAL ARCHITECTURE

## Canada is the first complete geographic target

*Decided 2026-09-21.*

North Ground Hunt's first mature version covers **all of Canada**: the ten
provinces, the three territories, and the federal layers that compose with them.
Canada is not the initial market to be moved past — it is the minimum complete
footprint before broad United States regulatory expansion begins.

*Scope, 2026-09-22.* The current national target is the ten provinces, Yukon and
the federal layer. The Northwest Territories and Nunavut are out of scope for
now: neither publishes reusable vector hunting geography, and both prohibit
commercial reuse without written permission. They remain in the coverage
registry with their findings and their gaps, are never counted toward a national
milestone in either direction, and are never reported as complete. Canada
complete means the in-scope jurisdictions; the two territories are named as out
of scope wherever coverage is stated.

Complete does not mean every location and species appears supported. It means
North Ground can state exactly, per jurisdiction and per species, what it knows,
what applies, what further input a rule requires, what is not yet verified, and
which authority supports the answer. A correct UNKNOWN is a covered case; a
plausible guess is not.

That claim has to be measurable, so coverage is machine-readable rather than
prose: `src/lib/hunt/canada/registry.ts` declares each jurisdiction's structure
and known gaps, and `report.ts` computes every count from certified bundles at
call time. No number in that report is typed by hand, so no jurisdiction can be
made to look covered by editing a constant.

The national milestones are:

- **Canada spatial complete** — every in-scope jurisdiction that publishes
  management geography has it ingested and parity-certified against its own
  authority.
- **Canada core game complete** — the commonly hunted species in each
  jurisdiction have deterministic rule coverage, or a documented legal reason why
  another model applies.
- **Canada migratory complete** — federal migratory-game-bird rules compose
  correctly with provincial and territorial layers nationally.
- **Canada coverage audited** — every remaining gap is machine-readable and
  intentionally UNKNOWN or PARTIAL rather than accidentally absent.

Do not claim Canada complete until those are satisfied on evidence. Until then,
report the exact counts.

## Underlying architecture

North Ground starts with Canada but the underlying architecture should support:

Country
→ jurisdiction
→ management system
→ zone/unit
→ subzone
→ special territory
→ species
→ season
→ method
→ hunter attributes
→ date/time
→ applicable rules

Do not hard-code Ontario/Québec terminology into universal models.

Different jurisdictions use concepts such as:

- WMU
- GMU
- hunting zone
- management unit
- district
- region
- game management area

Normalize concepts while retaining official terminology.

International expansion must be truthful.

Coverage states should be explicit:

- VERIFIED
- PARTIAL
- IN DEVELOPMENT
- UNAVAILABLE

---

# 10. THE UNDERLYING PLATFORM MAY BECOME BIGGER THAN NORTH GROUND HUNT

Architect important systems so they can eventually support additional outdoor domains.

The fundamental technical concept is:

**Who + Where + When + Activity → What applies here?**

Future applications could include:

- hunting
- fishing
- Crown/public land
- camping
- fire restrictions
- ATV
- snowmobile
- boating
- protected/conservation areas
- outdoor permits
- weather hazards
- emergency information

Do not prematurely build all of these.

But avoid architecture that makes expansion unnecessarily difficult.

---

# 11. POSSIBLE B2B / GOVERNMENT PLATFORM

The regulatory/geospatial engine may eventually have commercial value outside North Ground.

Potential future models include:

- government licensing
- white-label government portals
- regulatory APIs
- third-party outdoor-app APIs
- tourism/outfitter integrations
- custom government implementations
- enterprise licensing

Therefore separate:

1. source ingestion
2. normalized regulatory data
3. geospatial engine
4. rules engine
5. internal APIs
6. North Ground presentation

Conceptually:

AUTHORITATIVE SOURCES
        ↓
INGESTION + VERSIONING
        ↓
NORMALIZED DATA
        ↓
GEOSPATIAL + RULES ENGINE
        ↓
INTERNAL/API LAYER
        ↓
NORTH GROUND / FUTURE GOVERNMENT / FUTURE PARTNERS

Do not unnecessarily entangle North Ground branding with the core regulatory engine.

Preserve reusable intellectual property.

Important enterprise-quality concerns include:

- provenance
- auditability
- historical versions
- deterministic evaluation
- accessibility
- localization
- privacy
- security
- documented APIs
- monitoring
- human approval workflows

Do not over-engineer prematurely, but do not make decisions that prevent this future.

---

# 12. NORTH GROUND CONTENT PHILOSOPHY

North Ground does NOT write for word count.

North Ground writes for:

**maximum useful information in the minimum words required to communicate it completely.**

The editorial rule is:

> **Answer the intent immediately. Include every fact that materially helps the user. Remove every sentence that does not.**

Concise does NOT mean thin.

Thin content provides little useful information.

North Ground content should be:

- concise
- complete
- factual
- structured
- scannable
- specific
- useful
- source-aware
- easy for humans to understand
- easy for machines to parse

Do not add:

- generic introductions
- fake storytelling
- filler
- repeated conclusions
- obvious statements
- SEO padding
- artificial word count
- “ultimate guide” fluff
- unnecessary history
- generic outdoor clichés

unless they genuinely satisfy the user's intent.

A 600-word page that completely resolves an intent is better than a padded 5,000-word page.

A complicated subject may legitimately require more.

No predetermined word counts.

---

# 13. CONTENT COMPLETENESS RULE

A page is complete when:

- primary intent is answered
- meaningful follow-up questions are answered
- important exceptions are covered
- useful actions are available
- claims are properly sourced where necessary
- related deeper resources are available where useful

It is NOT complete because it reached a word target.

Every paragraph should do at least one of:

- answer a question
- provide a fact
- explain a condition
- explain an exception
- provide evidence
- support a decision
- prevent a mistake
- lead to a useful next action

Otherwise remove it.

---

# 14. ONE FACT, ONE BEST HOME

Avoid duplicating substantial explanations across dozens of pages.

Important concepts should have a canonical North Ground home.

Other pages can:

- give the necessary short answer
- provide contextual information
- link to the canonical resource

This helps:

- users
- internal linking
- search engines
- AI systems
- maintenance
- regulatory updates
- content consistency

Avoid cannibalization and repetitive programmatic content.

---

# 15. THE NORTH GROUND KNOWLEDGE GRAPH

Content should increasingly behave like structured knowledge rather than disconnected blog posts.

Important entity types include:

- species
- jurisdictions
- management zones
- seasons
- activities
- hunt types
- conditions
- weather conditions
- clothing systems
- equipment categories
- pack items
- skills
- safety topics
- regulations
- guides
- field tests
- tools
- products
- videos
- authoritative sources

Relationships matter.

Example:

Ruffed Grouse
→ Québec
→ applicable zone
→ season
→ winter
→ active/upland hunt
→ clothing system
→ day-hunt pack
→ habitat guide
→ field-care guide
→ field test
→ relevant equipment

Do not hard-code relationships into arbitrary UI components if they belong in structured content/data.

---

# 16. SPECIES LIBRARY

North Ground should eventually maintain a global species registry.

Do NOT blindly publish “every huntable species in the world.”

Legal hunting status varies by jurisdiction and time.

First build structured entities.

Then publish hunting-specific resources where:

- hunting is legally documented
- North Ground can provide meaningful information
- search/user demand justifies publication
- adequate source quality exists

Species records may contain:

- common name
- scientific name
- aliases/local names
- taxonomy
- geographic range
- identification
- similar species
- habitat
- diet
- behaviour
- seasonal behaviour
- signs/tracks
- activity patterns
- hunting context
- documented hunting jurisdictions
- conservation/regulatory context
- related North Ground resources

Species identity is biological and canonical. Sex, age, hunter terminology and
regulatory animal class are related attributes, not additional species. The
domain must keep biological sex/age separate from source-defined classes such as
antlered, antlerless or bearded. A search may resolve to a species plus an
optional characteristic intent; only the applicable regulatory source can decide
whether that characteristic satisfies a legal class.

The library may include protected, trapping-focused or otherwise non-huntable
species when identification or regulatory interpretation justifies them. Library
presence never implies legal opportunity. Hunting and trapping are distinct
activities, and regulatory coverage remains a separate capability from the
species profile.

Species media may include multiple verified roles (general, adult male, adult
female, juvenile, seasonal form or lookalike comparison). Every label must match
what was independently verified. If exact identity, licence and attribution are
not verified, publish no photo.

### Canonical species PRIMARY media

Each canonical biological species may have exactly one current `PRIMARY` image.
That relationship is runtime data keyed by the canonical `species:*` ID; it does
not live in a route, filename, content bundle, jurisdiction, or individual UI
component. Every surface that needs the general species image resolves the same
relationship. Current consumers are the species library, species profile, Hunt
selector, Hunt result, Hunt map species filter and Ready to Hunt. A future
consumer must use this relationship rather than create another image mapping.

The administrator assigns identity by dropping an image onto the species card in
the canonical library. The card supplies the species ID. Filenames, OCR, AI
classification and slug matching must never decide identity. Replacing an image
must show the current and proposed images and use optimistic concurrency so an
older browser cannot silently replace a newer assignment.

Uploads are server-handled and administrator-only. The raw upload is decoded and
re-encoded without EXIF, GPS, XMP or IPTC; it is never retained. Store one
sanitized master plus immutable, versioned WebP derivatives for avatar, card and
profile use in private storage. The database keeps creator, licence, accessible
alt text, source hash, verifying administrator and retirement history. Public
pages receive only same-origin rendition URLs with fixed dimensions and a
neutral placeholder when no verified PRIMARY exists. Removing a temporary admin
uploader must never remove the schema, storage, read model or consumer contract.

Hunting content may include:

- hunting methods
- habitat by season
- typical hunt style
- physical activity
- terrain
- weather considerations
- clothing considerations
- packing considerations
- field care
- identification/safety
- common mistakes
- North Ground field notes

Species editorial content must not replace jurisdiction-specific regulation records.

---

# 17. SPECIES × LOCATION CONTENT

Canonical species entities can connect to jurisdiction-specific resources.

Examples conceptually:

Ruffed Grouse
→ Québec
→ Ontario
→ Maine

These pages combine:

- species knowledge
- local habitat/context
- applicable regulatory framework
- official sources
- North Ground resources

Do not generate every theoretical species × jurisdiction permutation.

Index a page only when it provides substantial unique value.

---

# 18. HUNT-TYPE KNOWLEDGE

The system should understand HOW someone is hunting.

Potential hunt/activity concepts include:

- upland
- big game
- waterfowl
- small game
- turkey
- migratory bird
- mountain
- backcountry
- stand
- still hunting
- spot-and-stalk
- calling
- tracking

Why this matters:

-10°C during an active grouse hunt is not equivalent to -10°C sitting stationary for six hours.

Context affects:

- clothing
- equipment
- food/water
- safety
- pack weight
- exposure
- duration

---

# 19. CONDITIONS KNOWLEDGE

North Ground should build reusable knowledge around conditions such as:

- extreme cold
- sub-zero conditions
- cold rain
- freezing rain
- wet snow
- deep snow
- high wind
- wind chill
- warm early season
- hot conditions
- fog
- rapid temperature change
- ice

Do not create arbitrary pages for every numeric temperature unless search intent/user value warrants them.

Structured condition logic can be more granular than indexable content.

---

# 20. CLOTHING KNOWLEDGE

Avoid generic:

> “Dress in layers.”

Build a useful clothing system based on:

**temperature + precipitation + wind + activity + duration + hunt/activity type**

Knowledge areas can include:

- base layers
- midlayers
- insulation
- shells
- pants
- boots
- socks
- gloves/mittens
- head/face protection
- rain systems
- snow systems
- visibility requirements
- moisture management
- changing layers
- stationary insulation

The application should eventually retrieve the appropriate knowledge based on context.

Do not make unsafe promises about exact temperature ratings without evidence.

---

# 21. PACKING / EQUIPMENT KNOWLEDGE

Build reusable equipment entities and packing logic.

Contexts include:

- short hunt
- half day
- full day
- overnight
- multi-day
- winter
- remote/backcountry
- vehicle-based
- active
- stationary

Species/activity-specific packing resources can reuse these entities.

Do not maintain dozens of contradictory handwritten lists when structured reusable items can solve the problem.

---

# 22. SKILLS & SAFETY

North Ground's bushcraft identity remains important.

Relevant knowledge includes:

- navigation
- compass use
- map reading
- GPS limitations
- trip planning
- getting lost
- signalling
- emergency shelter
- fire
- water
- cold exposure
- first aid
- group separation
- wildlife encounters
- field care
- remote emergency planning

This knowledge should naturally connect into hunting, camping, fishing and other tools.

---

# 23. GEAR PHILOSOPHY

North Ground must not become an affiliate-content farm.

Initial recommendations should usually be category-level and context-specific.

Example:

> Forecast: -18°C
> Hunt type: stationary
> Duration: 6 hours
>
> Consider additional stationary insulation and insulated footwear.

Later North Ground can recommend individual products when there is a legitimate basis.

Prefer:

Category knowledge
→ buying guidance
→ individual product
→ North Ground field test

Never claim product testing that did not happen.

Affiliate relationships must be disclosed.

Commercial incentives must not determine regulatory/safety recommendations.

---

# 24. ATOMIC CONTENT / APP BLOCKS

Editorial content should be reusable inside tools.

Do not force the application to scrape its own website.

Where appropriate, resources should expose structured content blocks such as:

- quick_answer
- app_tip_short
- app_tip_medium
- key_facts
- habitat_tip
- weather_tip
- clothing_tip
- packing_tip
- identification_warning
- safety_note
- legal_note
- seasonal_behavior
- field_care_tip
- north_ground_field_note

These should have stable IDs and metadata.

The application can retrieve the correct block based on context.

Example:

species = ruffed_grouse
condition = winter
activity = active
temperature_band = cold
duration = day

→ appropriate North Ground clothing/packing/species guidance.

Do not hard-code editorial prose throughout application components.

---

# 25. QUICK ANSWER STANDARD

Important resources should contain a concise direct answer near the beginning.

This answer should:

- directly resolve the query
- contain meaningful facts
- avoid filler
- stand on its own
- remain accurate outside surrounding prose
- be suitable for contextual app display where applicable
- be easy for search/answer systems to understand

Do NOT write specifically to manipulate snippets.

Write excellent extractable answers.

---

# 26. SEARCH STRATEGY

Search demand should inform product language and content creation BEFORE copy is finalized.

Workflow:

**QUERY → INTENT → SERP → EVIDENCE/DATA → BEST SURFACE → COPY**

Not:

**WRITE → ADD KEYWORDS**

Use legitimate keyword research.

Never fabricate:

- search volume
- keyword difficulty
- traffic
- CPC
- ranking probability

Record whether evidence is:

- MEASURED
- OBSERVED
- INFERRED
- ESTIMATED
- NEEDS VERIFICATION

---

# 27. SEARCH INTENT OWNERSHIP

Do not make every query an article.

Choose the best owner.

A query may belong to:

- interactive tool
- jurisdiction hub
- zone page
- species page
- species × jurisdiction page
- guide
- field test
- reference page
- gear resource

Examples:

“What hunting zone am I in?”
→ tool

“Quebec hunting zones”
→ jurisdiction/map resource

“Ruffed grouse”
→ species entity

“Ruffed grouse season Quebec”
→ species × jurisdiction/regulatory surface

“How to dress for winter grouse hunting”
→ editorial guide

Avoid internal competition.

---

# 28. SEO DOES NOT MEAN CONTENT FARMING

North Ground must not create:

- millions of thin parameter pages
- empty zone pages
- AI-spun species pages
- doorway pages
- location swaps
- duplicated season pages
- fake FAQ pages
- schema spam
- indexable filter combinations without unique value

Programmatic pages are acceptable only when the underlying data creates substantial unique value.

Interactive query states usually should not become independently indexable pages unless deliberately designed as durable search destinations.

---

# 29. GOOGLE / AI / AEO PHILOSOPHY

Build information that is easy to:

- crawl
- understand
- extract
- cite
- verify

Important facts should exist in server-rendered HTML where appropriate.

Do not hide essential information exclusively inside:

- map canvas
- client-only state
- images
- modals inaccessible to crawlers
- JavaScript requiring interaction

Use:

- semantic HTML
- clear headings
- concise answers
- tables where appropriate
- definition lists
- breadcrumbs
- stable URLs
- explicit entities
- units
- dates
- jurisdiction
- source attribution
- last-reviewed dates

Structured data should be accurate and use supported vocabulary.

Never invent schema properties.

AI crawlers and answer engines are distribution channels, not authorities.

---

# 30. METADATA

Metadata should be compelling without being deceptive.

Do not use misleading clickbait.

Titles/descriptions should:

- match intent
- communicate utility
- use important terminology naturally
- use location/species/year when genuinely useful
- differentiate North Ground
- encourage clicks by offering a better answer

Never keyword-stuff.

Never promise functionality/data the page does not provide.

---

# 31. SEARCH OPPORTUNITY: DECISION INTENT

Government sites are expected to dominate some authoritative head terms.

North Ground does not need to outrank a government agency for the government's own regulation name to succeed.

Important opportunities include decision/tool intents such as:

- what hunting zone am I in
- find my hunting zone
- hunting zones near me
- what can I hunt today
- what is in season now
- what hunting season is open
- [species] season near me
- WMU lookup
- hunting regulations by zone
- hunting season by date

North Ground can provide a better decision interface while citing government authority.

The strategy is not:

> Beat government at being government.

It is:

> Make authoritative information dramatically easier to use.

---

# 32. INITIAL TOPICAL WEDGE: CANADIAN COLD

North Ground's early editorial authority strategy includes Canadian cold-weather decision-making.

This is an ENTRY WEDGE, not the permanent ceiling of the brand.

Important early areas include:

- cold risk
- wind chill
- winter camping
- clothing
- cold-weather hunting
- winter field skills
- fire in snow
- shelters
- cold-weather equipment
- ice safety
- winter emergency preparation

Build this authority while keeping North Ground visually and structurally broader than “a cold-weather website.”

---

# 33. SECOND MAJOR KNOWLEDGE FRONT: ACCESS / CROWN LAND

North Ground should eventually become highly useful for Canadian Crown/public land questions.

Potential information includes:

- where Crown/public land exists
- provincial differences
- camping rules
- stay limits
- permits
- access
- fire rules
- hunting relationships
- restrictions
- authoritative mapping sources

Legal interpretation must follow the same North Ground Verified standards.

Absence of a discovered rule is not proof that no rule exists.

---

# 34. SEASONAL EDITORIAL ENGINE

North Ground should operate with outdoor seasonality.

General planning pattern:

Fall:
- hunting
- winter preparation
- cold-weather equipment

Winter:
- cold
- winter camping
- field testing
- survival skills
- winter hunting

Spring:
- Crown/public land
- camping preparation
- fishing
- access

Summer:
- camping
- fishing
- navigation
- wildlife
- field skills

Late summer:
- hunting preparation
- regulations
- season planning

Publish sufficiently ahead of demand.

Do not wait until peak season to begin indexing seasonal resources.

---

# 35. FIELD WORK IS PART OF THE PRODUCT

North Ground cannot become a serious outdoor authority entirely from desk research.

Actual field work should generate:

- measurements
- observations
- failures
- photographs
- video
- field tests
- practical guides
- charts
- newsletter material
- product evidence

Do not wait for dramatic conditions.

Collect standardized information whenever possible.

A continuous dataset across ordinary and extreme conditions is more defensible than isolated stunts.

---

# 36. CONTENT FLYWHEEL

One legitimate field outing can produce:

- field-test record
- guide
- species observations
- photographs
- long-form video
- short videos
- newsletter material
- chart/data
- equipment observations
- updated app tips
- downloadable checklist

Reuse evidence.

Do not duplicate filler.

---

# 37. BRAND CHARACTER

North Ground should feel:

- Canadian-rooted
- capable
- warm
- quiet
- precise
- credible
- outdoorsy
- experienced
- practical
- curious
- field-oriented

It should NOT feel:

- military
- tacticool
- prepper-paranoid
- apocalyptic
- generic SaaS
- neon
- casino-like
- corporate-government
- fake-rugged
- AI-generated wilderness cliché

---

# 38. VISUAL DIRECTION

Visual inspiration:

- dark boreal forest
- campfire glow
- moonlight
- topographic maps
- field notebooks
- government survey maps
- weathered canvas
- natural wood
- steel
- snow
- warm paper/bone tones

Core palette direction:

- near black
- charcoal
- warm bone/cream
- forest greens
- earth/bark neutrals
- restrained campfire amber

Texture should be subtle.

The application itself must remain clean and highly usable.

Rustic does not mean cluttered.

The main site and the Hunt application express this direction differently and
deliberately. See section 41A.

---

# 39. LOGO / IDENTITY

Current North Ground identity includes:

- boreal trees
- mountains
- crescent moon
- campfire
- north/compass motif
- warm bone on black
- restrained fire-orange accent
- Canadian identity

Use this as an aesthetic anchor.

Do not plaster the logo or maple leaves everywhere.

The brand should feel authentic rather than themed.

---

# 40. UX PRINCIPLES

Mobile-first.

Many users may be:

- outside
- cold
- wearing gloves
- in poor connectivity
- in bright sunlight
- planning quickly
- unfamiliar with regulations

Prioritize:

- large touch targets
- immediate answers
- strong hierarchy
- clear states
- offline/read-later opportunities where practical
- excellent contrast
- low cognitive load
- fast maps
- textual alternatives to maps
- graceful API failure

Do not encode critical states only through color.

Hunt's own interface decisions are recorded in section 41A.

---

# 41. MAP PHILOSOPHY

Maps are a core interface, but not the only interface.

Users should be able to:

- search
- use location
- tap the map
- inspect boundaries
- understand overlapping layers
- view a textual result

Do not ship entire continental polygon datasets unnecessarily to the browser.

Use appropriate:

- spatial database
- indexes
- vector tiles
- level-of-detail
- caching
- server-side spatial queries

Boundary uncertainty must be communicated.

Consumer GPS should never be represented as legally infallible.

Hunt's map-first behaviour, its sheet and panel, zone-coverage honesty rules, map
exploration, shareable state and the distinction between device and hunt location
are in section 41A.

---

# 41A. NORTH GROUND HUNT — PRODUCT SURFACE

*Decided 2026-09-20. This section governs the Hunt application's interface.*

## Main site and Hunt are deliberately different

The North Ground homepage stays dark, cinematic and immersive: a wilderness
entrance. Hunt is clean, glassy, precise and map-driven: an instrument.

They share the brand, the approved mark, the palette and the typography. They do
not share their composition, and neither should be redesigned into the other. The
homepage hero is not to be converted into the Hunt interface.

`Enter the North` on the homepage goes to `/hunt`.

## Hunt is map-first

*Rebuilt as a map-first application 2026-09-22.*

North Ground Hunt is a map-first, mobile-first spatial hunting-intelligence
product. Its governing interface principles:

- **The map is the primary canvas.** On a phone it fills the screen under a
  compact header. No form, trust card or explanatory copy stands between a
  visitor and the map.
- **One contextual sheet; progressive disclosure.** Phones get one draggable
  bottom sheet with three resting heights (peek, half, full); wide screens get
  one floating panel over a full-bleed map, never a split screen. The sheet
  shows what the current state needs — getting started, a zone, an answer, a
  question — and the long form (conditions, Ready to Hunt, sources, Hunt Brief)
  opens on request. The map is sized to what the sheet leaves, so the sheet
  never hides the map provider's attribution.
- **Automatic evaluation.** There is no submit button. Once a place or zone, a
  date and a species are known, the answer is requested. Every answer is keyed
  by its exact inputs, and a response for inputs no longer on screen is
  discarded, never shown.
- **Direct zone interaction.** Zones are tapped on the map or chosen from the
  keyboard zone list; the selected zone stays highlighted through pan, zoom and
  any reload of its geometry.
- **Location-aware, location-optional.** Location helps and is never required;
  search is always a first-class alternative.
- **Official-source truth.** Every answer keeps its status word, its authority
  and a one-tap path to the official source. Presentation is simplified;
  provenance is never removed.
- **Shareable Hunt state.** A Hunt is a link (below).
- **Familiar, not imitative.** Gestures and controls behave as people expect
  from Google or Apple Maps; the look remains North Ground's.
- **Minimal permanent chrome.** Only the header, the sheet and the map's own
  controls are always present.
- **Desktop keeps the model.** A wide screen is the same map-first product, not
  a responsive form.

Hunt opens on a useful map, not on a form. Before a person types anything, the
official hunting-zone boundaries for supported jurisdictions are already drawn, so
the first thing they see is *these are hunting zones*. Until the live map is
ready, the page may show a server-drawn picture of the same official overview
answer in the live map's exact projection and opening camera. It is drawn only
from a complete overview answer, is never interactive, and is replaced in place.

The explanation of how Hunt works, what it covers and what its states mean is
server-rendered inside the sheet, below the actions, so crawlers and readers
without JavaScript receive it without it standing in front of the map.

The map must never draw an approximate or decorative regulatory boundary. Every
line traces to a named authority's own published GIS service, and a provider
outage shows an empty map with an explanation rather than a guess.

Drawing a boundary is not a claim that the rules inside it are certified. The map
distinguishes zones with a certified regulatory record from zones where only the
official boundary is known, and says which is which.

## The map is an exploration surface

*Decided 2026-09-21.*

The map is useful on its own, not only as a picture behind the composer. A hunter
can pan, read zone names, tap a zone and learn what applies there without running a
full Hunt each time.

- **Official names on the map.** Polygons carry the zone's compact label (57,
  25A, 10W); cards, results and briefs carry the full label (WMU 57, GHA 25A,
  Zone 10 West). Both come from the presentation contract below, derived from
  the canonical spatial layer, never from a separate label list. A zone the
  contract cannot present gets no polygon label rather than a raw code; the zone
  list still names it. One label per zone, inside its largest part; labels that
  do not fit or would collide are left out rather than stacked.
- **Quiet polygons.** Normal fills stay faint so the basemap reads; hover or focus
  strengthens a zone, the selected zone gets a clear bone outline, and special
  regulatory areas use a distinct dashed style rather than another solid colour.
- **Zone cards.** Tapping a zone (or choosing it from the keyboard-accessible zone
  list) opens a card — in the bottom sheet on phones, in the floating panel on
  wider screens with the zone framed beside it — that says what the certified
  rules say about the WHOLE zone on the
  Hunt date. It is produced by the same regulatory engine as a full Hunt, asked
  about the zone rather than a point. It is never a second regulatory truth.
- **"In season" is not "open to you".** A zone card never says OPEN. A season running
  for every licence the rules recognise is "In season"; anything that turns on the
  hunter (residency, licence, tag, draw, method, animal class, age) is "Depends on
  your hunt"; anything that differs inside the zone (a zone line, a base, a
  refuge) is "Needs a closer look"; UNKNOWN stays UNKNOWN and is never drawn as
  CLOSED. A season is never claimed inside a published restricted area that lies
  within the zone: the card says "In season outside restricted areas" and names
  each area with the authority's own restriction text. The optional species filter uses the same states, with a word and a glyph
  as well as a colour — never a green/red legality heatmap.
- **Address → zone card.** Choosing a searched place sets the hunt location, drops
  the hunt pin, resolves and highlights the official zone, frames it beside the card
  and opens that zone's card.
- **Boundaries are visible.** A hunt point near a mapped boundary is flagged, and
  names the neighbouring zone where the drawn geometry can; map geometry and
  consumer GPS are never presented as a legal survey.
- **Special layers only when certified to be read.** A Layers control offers
  special regulatory geography only where North Ground already reads the
  authority's own service (today: Manitoba's refuges, conservation areas, wildlife
  management areas and closed lands), each with its authority and legal standing.
  No decorative or unsourced layer is ever added to fill the control.

## Zone identity and presentation

*Decided 2026-09-22.*

A zone has one identity and several presentations, and they never mix.

- **Identity** is the canonical id (`management_zone:ca-qc-zone-10o`), the
  authority's source designation (`10O`) and its official name (« Zone de
  chasse 10O »). Only identity joins data, selects rules, keys geometry, records
  provenance or is stored in a Hunt Brief.
- **Presentation** is derived per locale: a full label for cards, results and
  briefs (en-CA "Zone 10 West", fr-CA "Zone 10 Ouest", "WMU 57"); a compact
  label for polygons and tight UI ("10W" / "10O", "57"); an accessible label
  that spells out abbreviations ("Wildlife Management Unit 57, Ontario").
  Changing locale changes words only, never a polygon, zone, rule, season,
  status or source.
- There is one presentation path, `src/lib/hunt/zone-presentation.ts`: a
  per-layer data table. A new jurisdiction adds a row. No component formats a
  designation itself or falls back to the raw code.
- A term or direction is localized only where the authority publishes that
  language. Proper names are never translated. An ambiguous suffix (Québec
  19SNO) keeps its code. A jurisdiction without a profile shows its raw
  designation and is never given an invented name.

## Device location is not the hunt location

Two locations exist on the map and must never be confused:

- **Self (device) location** — the conventional blue dot with an accuracy ring. It
  is optional, requested only after an explicit action, never persisted, never sent
  to North Ground, and never placed in a URL, analytics, a Hunt Brief or a share
  snapshot. The recentre control moves the camera to it and does nothing else.
- **Hunt location** — the distinct bone pin. It is set only by a deliberate act:
  choosing a search result, confirming a previewed map point, or the explicit
  "Use my location" action. Zone resolution, evaluation, weather, the Hunt
  Brief and sharing read this and nothing else.

A map point becomes the hunt location only through preview and confirmation: a long
press, a right-click or the "choose a spot" control previews it, and "Check this
location" confirms it. A plain tap on the map never selects a hunting location.

A third location, the **vendor-search location**, exists only inside Ready to Hunt
(below). It is its own type, is never converted into a hunt location, and can
never change the zone, the regulatory answer, the weather or the Hunt Brief. The interaction state is one explicit machine
(`src/lib/hunt/exploration/map-state.ts`), not accumulated booleans.

## Location is entered as a place, never as coordinates

The resting sheet is a prompt and one composer — place, town, address or
postal/ZIP code — backed by Google Places where configured and a keyless
provider otherwise. There is no second way in beside it: one tap reaches a
focused field with the keyboard up, and on a phone the sheet rises so the field
and what it offers stay above the keyboard.

Everything else a person can choose a place with lives INSIDE that opened
field, as labelled rows below it: their recent places, `Use my location`, and
`Choose a spot on the map`. A row is never dressed as a place result.

`Use my location` is a separate, explicit action, not a fake suggestion row, and
the only one that asks the browser for the device position. Its answer sets the
hunt location and says "You are in [zone]". Hunt never prompts on arrival. Where
permission was already granted, the map may show the self dot without asking,
but the hunt location still waits for the press. Refusal, timeout, low accuracy
and unsupported browsers each get a plain sentence, and search stays one tap
away: declining location never traps anyone.

Coordinates remain the internal truth and stay available as secondary detail. A
person is never asked to type latitude and longitude for normal use.

## The answer assembles progressively

- **Location** alone resolves the official management zone, its jurisdiction and
  any boundary warning. That is a real question with a real answer.
- **Date** makes time-specific regulatory evaluation possible.
- **Species** completes it, producing the full Hunt overview.

A zone chosen without a point gets the whole-zone answer (zone cards, above); an
exact point — a place, the device's position or a confirmed pin — gets the point
answer. Nothing about legality is shown from a zone alone.

## Date entry

Two controls: **Today** and **Choose date**; the calendar and typed field
appear only when asked for. There are no other presets (owner decision,
2026-09-22): "This weekend" is two days whose rules can differ (Sunday
hunting), so it has no single answer, and every other day is one tap on the
calendar. The page renders with the default jurisdiction's day, and an
untouched default then becomes the device's own calendar day.

The canonical visible format is `YYYY/MM/DD`; the stored and transmitted format is
ISO `YYYY-MM-DD`. Typing `20260808` becomes `2026/08/08` without anyone reaching
for the separator key, and pasted `2026-08-08` or `2026/08/08` normalise the same
way. Impossible dates are refused with a plain-language reason rather than rolled
forward. A hunt date is a calendar day and is never routed through a timestamp.

The text field and the calendar are two controls over one selected day. They hold
no separate state and cannot disagree.

## One state, said the same way everywhere

*Decided 2026-09-22.*

The composer, the sheet, the pin and the URL describe one state and can never
disagree. The field names the hunt location only while the sheet is about that
location — the opening state, or the hunt's own zone. Reading a zone tapped
somewhere else it returns to its prompt, because that zone is not that place and
a zone chosen without a point is not a point answer.

The three ways of choosing a place — a search result, `Use my location`, and a
confirmed map spot — end in the same state, through the same machine: the hunt
pin at the point, its official zone resolved and highlighted, the camera framed
on that zone clear of the sheet, and the zone's own card open. A searched place
and a tapped zone are the same card, from the same data, by the same path.

The sheet is readable at every height. Anything longer than the height it is
resting at scrolls; nothing waits below the screen for a drag.

## What this device remembers

*Decided 2026-09-22.*

Coming back should not mean searching again. The URL carries the shareable
intent; everything else is remembered on the device alone — the chosen place,
the zone, the species, the day, where the map sat, which layers were on, the
sheet's height and recent places. None of it is ever sent to North Ground, put
in a link or a Hunt Brief, or used in analytics.

Three rules keep it honest:

- **A link wins.** Anything a URL names — even something it names badly — is
  what that visit is about, and nothing stored is restored over it.
- **The device fix is never stored.** A hunt location taken from the device is
  the device's position; §41A keeps that out of anything persistent. The zone it
  resolved to is remembered, so the answer returns; the point is not.
- **A day that has passed is not restored.** Seasons turn on the date, so a
  stored day in the past falls back to today rather than quietly answering for a
  day that has gone. Everything restored is evaluated again.

Storage can be absent, full or blocked; each of those is a device that does not
remember, never an error. `Start over` clears all of it, including recent
places, and leaves nothing behind.

## Shareable Hunt state

*Decided 2026-09-22.*

A Hunt is a link:
`/hunt?zone=ca-on-wmu-57&species=white-tailed-deer&date=2026-09-22&explore=1`.

- The URL holds only durable intent: the zone's canonical id without its
  `management_zone:` prefix, the species id without `species:`, the ISO date,
  and explore mode (written only with a species). It never holds a coordinate,
  the device location, search text, the sheet's position, a permission or a
  loading state.
- Each parameter is validated on its own. A malformed one is dropped with a
  notice and the rest restore. A zone number or label is never accepted as a
  zone. Older links (`?species=species:ruffed-grouse`) keep working.
- A link restores its zone only once the drawn official geometry confirms it,
  then highlights and frames it, restores species and date, evaluates and opens
  the sheet.
- `/hunt` stays the one canonical URL. A link's title and description may name
  its view; query states are never separate indexable pages.
- Share uses the device's share sheet where one exists and copies the link
  otherwise. The shared text names species, zone, jurisdiction and date, never
  a status, because the link re-evaluates when opened. The Hunt Brief remains
  the way to share an answer as it stood.

## Ready to Hunt

*Decided 2026-09-21.*

A permitted hunt (status CONDITIONAL) also answers **"What are the bare essentials
I need before I can go?"** It is a checklist, not a gear list:

- the licences, tags, permits, validations and cards required, with prerequisites;
- whether hunter orange is required here today, with the law's actual minimum;
- the legal methods, and legal ammunition restrictions;
- current official fees, where verified;
- where to obtain each item: online, by phone, in person, by draw, through a
  licensed operator or a federal program.

**Law and advice never blend.** REQUIRED and ALLOWED lines are the law, decided by
the regulatory engine and each carrying its source. RECOMMENDED lines are North
Ground's practical advice, labelled as such, offered only where defensible, checked
against the legal restriction, and never able to change a legal status. Status is
always a word, never only a colour.

**Authorizations are modelled generally** — hunting licence, species licence, tag,
permit, validation, stamp, draw authorization, hunt code, limited entry, federal
permit or stamp, conservation requirement — keeping the authority's own name for
each. Federal and state/provincial requirements compose in one list. North Ground
never infers that a hunter holds anything.

**Fees are never guessed.** A fee appears only when it is from the licence year in
force and the hunter's category is known; resident and non-resident figures are
never mixed. Where the category matters and is unknown, the hunter is asked once,
through the same answer the regulation reads — never a second questionnaire.
Otherwise the line says "Check current official fee" and links the authority.

**Vendors come only from an authority's own dataset.** A business on a map has not
thereby been shown to issue a licence. "Find a licence vendor near me" asks for the
device position only when pressed, says that it is used only to find vendors and
won't change the hunting location, computes distances on the device, and never
persists, transmits, logs or shares that position. A refused permission offers
"Search another location" (town, address or postal code), which is also always
available.

A jurisdiction without a checklist says so and links the authority rather than
showing an empty list. The Hunt Brief carries a compact checklist (licences,
orange, legal methods) and never a vendor, purchase link or any location.

## Glass design system

Hunt's surfaces come from one set of tokens and primitives — navigation, panels,
cards, controls, popovers, overlays, calendar — defined once in `globals.css`.
Individual components do not invent their own blur, border or shadow values.

Translucency is honoured as a preference: reduced-transparency and missing
backdrop-filter both fall back to opaque surfaces rather than unreadable ones.
Secondary text tiers are contrast-checked against the glass they sit on, not
against the page background.

## The species surfaces are part of this product surface

*Added 2026-09-21.*

`/hunting/species` and `/hunting/species/[species]` belong to Hunt's product
family, not to the main site's cinematic world and not to a separate editorial
identity. They share this shell: the same navigation, ground, type scale, glass
hierarchy and actions, drawn from the same primitives in `globals.css`.

They remain information surfaces rather than instruments. Sharing the shell does
not mean acquiring a map; a species profile is a species intelligence record
inside Hunt, and its job is identification, field context and provenance.

Species knowledge and regulatory coverage stay separate in the interface as well
as in the data. A species page states whether North Ground holds certified rules
for that species at all; what those rules say for a location and date is Hunt's
answer to give, and a profile never implies a season.

Hunt is the visual source of truth for all of these. When they disagree, the
species surfaces change.

## Navigation

Hunt carries its own floating glass navigation with the approved North Ground
mark. It links only to destinations that exist; a premium interface that navigates
to nothing is worse than a short one. Phones get a compact disclosure menu with
the same destinations, Escape handling and focus return.

---

# 41B. HUNT MAP INTELLIGENCE PLATFORM

*Decided 2026-09-21. This section expands, and does not replace, section 41A or
the regulatory principles elsewhere in this blueprint.*

The Hunt map is a first-class outdoor intelligence and hunt-planning platform,
not merely a visualization of management zones. It helps a hunter move through
one coherent experience:

**explore an area → investigate species opportunity → check the Hunt → prepare
what is required → preserve a Hunt Brief.**

The product is organized around three modes over one canonical map state:

- **EXPLORE** — management geography, Crown/public land, ownership, access,
  protected/restricted areas, roads and trails, access points, satellite,
  terrain and current conditions.
- **FIND GAME** — the explicitly named **SPECIE HEAT MAP**, species range,
  habitat, harvest, population/survey evidence and intersections with public
  land and access.
- **CHECK HUNT** — explicit Hunt location, date and species; deterministic
  legality; conditions; sources; Ready to Hunt; and Hunt Brief.

These are product concepts, not three disconnected applications. They share the
same species, date, hunt location, selected zone, camera and layer state. Device
location and vendor-search location remain separate exactly as section 41A
requires.

## Four separate questions

The architecture and interface always keep these facts separate:

1. **Species opportunity** — where evidence suggests the hunter investigate.
2. **Legal Hunt status** — what the canonical regulatory engine can determine.
3. **Ownership** — who holds or administers the land.
4. **Access** — whether and how the hunter may reach or use it.

Environmental conditions are a fifth independent lane. Public ownership is not
permission to enter or hunt. High opportunity is not an open season. A mapped
road is not proof of public vehicle access. Weather or fire conditions are not a
legal closure unless an authoritative rule or order says so.

## SPECIE HEAT MAP

The user-facing name is **SPECIE HEAT MAP**. It answers:

> Where does the available evidence suggest I should investigate for this
> species?

It never guarantees that animals are present and never decides whether hunting
is legal. Evidence may include official harvest, hunter effort/success,
population or survey observations, authoritative range, seasonal range, habitat,
land cover, elevation, water, public-land availability and source-backed access.
The product uses only the dimensions a jurisdiction/species actually supports.

Every evidence record preserves species, jurisdiction, geography and geography
type, source, metric, original value and unit, normalized value when justified,
sample size and methodology when published, effective and observation periods,
retrieval and verification dates, confidence, reuse status, spatial precision,
version and superseded state. Zone evidence and continuous/grid/polygon evidence
are both first-class; better spatial data is not flattened into a zone merely to
simplify rendering.

The map never shows an unexplained magic score. If a composite is useful, its
methodology and thresholds are immutable versions and its component evidence is
inspectable. User-facing classes are **VERY HIGH, HIGH, MODERATE, LOW** and
**LIMITED DATA**, with coverage separately labelled **ROBUST DATA, PARTIAL DATA,
LIMITED DATA, RANGE ONLY** or **NO HEAT-MAP DATA**. Broad range geometry stays a
range and is never fabricated into local opportunity.

## Crown/Public Land and the land model

Canada uses the layer name **CROWN LAND** where the authority does. United
States surfaces use **PUBLIC LAND** and each authority's real category (for
example BLM, National Forest or state land); they are never relabelled Crown
land.

The canonical model can represent provincial/federal/territorial public land,
U.S. federal/state land, private and municipal land, parks, reserves, wildlife
areas, refuges, Indigenous lands/territories where appropriate, special
management areas, hunting prohibitions, access restrictions and unknown
ownership. Ownership, access and hunting restriction are distinct fields.

Geometry is stored or redistributed only after its licence and terms have been
reviewed for commercial use, redistribution and attribution. When redistribution
is unclear, Hunt may use an allowed official live service or show
LICENCE_PENDING/LICENCE_BLOCKED; it does not silently copy the data.

## Potential Hunting Areas

The system may derive **POTENTIAL HUNTING AREA** or **CHECK THIS AREA** planning
candidates by intersecting available species evidence, public land, access,
selected date, management geography, canonical regulatory status and known
prohibitions. Every candidate explains its inputs and still points to the full
Hunt evaluation. It never claims every point is legally huntable.

## Map intelligence layers

Layer controls are organized around hunter questions rather than a flat list:

- **HUNTING** — Specie Heat Map, Open Seasons, Management Zones
- **LAND** — Crown/Public Land, Private Land, Potential Hunting Areas,
  Protected/Restricted Areas
- **ACCESS** — Roads & Trails, Parking / Access Points, Boat Launches
- **WILDLIFE** — Species Range, Harvest Data, CWD / Disease, Habitat
- **CONDITIONS** — Weather, Wind, Snow, Wildfire / Fire Restrictions
- **MAP** — Standard, Satellite, Terrain/Topo

Layer availability is contextual and comes from a machine-readable coverage
registry. An unavailable layer explains whether it is unverified, stale,
licence-blocked or absent; an empty result never means the underlying feature
does not exist. Active layers share a dynamic, textual, colour-accessible legend
and sensible automatic visual priority.

Management zones remain official interactive areas with the authority's own
terminology. Zone cards, What Can I Hunt Here, Potential Hunting Areas, Ready to
Hunt and Hunt Brief consume the one canonical regulatory engine. There is no
separate map-legality implementation.

## Planning capabilities

Hunt progressively supports deliberate point selection, address/place search,
satellite and licensed terrain/topographic views, habitat and range, harvest
history, access features, distance and approximate-area measurement,
location/date-specific sunrise and sunset, legal hunting windows only where the
rule supports the calculation, weather, wind, observed/forecast snow, wildfire
conditions and closure orders, CWD/disease consequences, and protected or
restricted subareas.

Every map-critical conclusion also has a textual equivalent. Heat and legal
states use words/glyphs or patterns as well as colour. Mobile uses compact
controls and bottom sheets; desktop uses the map without permanently surrendering
half its viewport.

## Offline planning and privacy

A deliberate offline Hunt package may contain the selected Hunt point, zone,
date, species, applicable regulations and sources, Ready to Hunt, legal-time
context, time-stamped condition snapshots, land/access context, restrictions and
Hunt Brief. Provider tiles are never cached without a licence that permits it.
When offline basemaps are unavailable, the regulatory and planning package still
works and says when dynamic information was downloaded.

Self/device location is never included. Sensitive wildlife observations support
precision classes, redaction and publication restrictions before any future
field-observation feature is exposed.

## Spatial delivery and operations

PostGIS is the canonical stored spatial platform where licensing permits, with
source, analysis, simplified and render geometry kept distinct. Feature delivery
uses viewport bounds, spatial indexes, zoom-aware simplification, bounded result
sizes, caching, cancellation and lazy loading; vector tiles are adopted when
measurements show GeoJSON no longer meets the budget. Official live services and
stored certified data sit behind one provider abstraction.

Every dataset follows fetch → validate → stage → normalize → compare → licence
check → human review where required → publish → rollback/versioning. Meaningful
source changes stop promotion and report their blast radius. Coverage states are
**VERIFIED, PARTIAL, LIMITED, IN DEVELOPMENT, UNAVAILABLE, LICENCE_PENDING,
LICENCE_BLOCKED, STALE** and **NEEDS_VERIFICATION**.

This platform remains deterministic at its trust boundaries. AI may explain
already-derived evidence; it never determines legal status, zone membership,
ownership, access legality, licence requirements or the existence of an animal.

---

# 42. WEATHER PHILOSOPHY

Weather should help make decisions.

Do not add weather simply because dashboards look better with weather.

Relevant information may include:

- temperature
- feels-like/wind chill
- wind
- gusts
- precipitation
- snow
- visibility
- alerts
- sunrise/sunset

Future-date behavior must be honest.

If the selected date exceeds reliable forecast range:

do not display fake forecasts.

Use legitimate climatological/historical information only if clearly labeled and sourced.

---

# 43. AI POLICY

AI is NOT the regulatory authority.

Core rules should be:

- deterministic
- structured
- source-backed

Use AI conservatively.

Potential useful AI applications:

- internal extraction assistance
- change summarization
- editorial assistance
- natural-language discovery
- contextual Q&A grounded in known data

Human review remains necessary for high-impact regulatory changes.

Never allow an LLM to invent missing legality.

Avoid unnecessary token/API costs.

A useful low-cost feature is:

**Copy Hunt Context**

Generate structured context users can paste into their preferred AI assistant.

---

# 44. SOURCE INGESTION

Prefer machine-readable authoritative data when available.

Before scraping HTML/PDF, look for:

- ArcGIS FeatureServer
- MapServer
- WFS
- WMS
- GeoJSON
- Shapefile
- geodatabase
- official API
- open-data portal

Provider-specific ingestion should be isolated behind adapters.

Do not build a fragile universal scraper.

---

# 45. SOURCE VERSIONING

Regulatory sources change.

Track where practical:

- source URL
- authority
- title
- retrieved date
- effective date
- content/document version
- hash
- verification status
- superseded status

A changed government document should trigger review.

Do not automatically convert changed legal text into published rules without verification.

Preserve historical data when useful.

---

# 46. ADMIN / HUMAN REVIEW

Long-term regulatory operations require a workflow.

Important states may include:

- discovered
- ingested
- draft
- needs review
- verified
- published
- stale
- superseded
- conflict

Admin tooling should eventually allow reviewers to understand:

- what changed
- source
- old value
- new value
- affected jurisdictions/species
- effective date

Audit important actions.

---

# 47. BILINGUAL / LOCALIZATION

North Ground begins in Canada.

Architecture should anticipate at least:

- English
- French

Do not assume English-only regulatory terminology.

Preserve official names.

Do not automatically translate legal terminology where an official localized term exists.

Internationalization should not require rebuilding the entire data model.

---

# 48. ACCESSIBILITY

Accessibility is a product requirement.

Especially important if the underlying technology may eventually serve governments.

Use:

- semantic HTML
- keyboard support
- screen-reader labels
- proper focus
- sufficient contrast
- reduced-motion support
- textual map alternatives
- meaningful status text

Treat accessibility defects as real defects.

---

# 49. PRIVACY

Location is sensitive.

Collect the minimum required.

Do not send precise hunting coordinates into analytics unnecessarily.

Prefer coarse analytics location.

Clearly distinguish:

- transient search location
- saved location
- analytics geography

Do not persist exact coordinates unless the feature genuinely requires it and the user reasonably expects it.

---

# 50. SECURITY

Treat external ingestion, maps, APIs and admin systems as attack surfaces.

Protect against:

- XSS
- SQL injection
- SSRF
- malicious source URLs
- oversized geometry
- unauthorized admin access
- exposed service credentials
- API abuse
- unsafe redirects

Keep secrets server-side unless a provider explicitly requires a restricted public browser token.

Use rate limiting where appropriate.

---

# 51. PERFORMANCE

North Ground should feel fast.

Especially mobile.

Prioritize:

- Core Web Vitals
- optimized images
- lazy-loaded heavy functionality
- efficient maps
- server-rendered critical information
- appropriate caching
- minimal client JavaScript
- good database indexes

Do not sacrifice usability for visual effects.

The immersive hero can be visually rich.

The utility/product interfaces should be efficient.

---

# 52. NORTH GROUND HOMEPAGE

North Ground itself remains broader than Hunt.

Potential major areas include:

- Cold & Winter
- Bushcraft & Skills
- Camping
- Access / Crown Land
- Hunting
- Fishing
- Wildlife & Safety
- Gear
- Field Tests
- Tools

Do not make the whole brand hunting-only merely because Hunt is currently a flagship product.

---

# 53. NEWSLETTER

North Ground should eventually maintain a useful newsletter.

The newsletter should not be generic content recaps.

Potential value:

- field observations
- conditions
- regulation changes
- useful seasonal knowledge
- new field tests
- tools
- practical skills

Hunt may eventually support personalized alerts:

- season opens soon
- season closes soon
- regulation changed
- saved zone updated

Do not build notification spam.

---

# 54. BUSINESS MODEL

Trust comes before monetization.

Potential future revenue includes:

- tested gear affiliate revenue
- digital guides
- field/reference cards
- premium planning features
- physical products
- sponsorships
- advertising where appropriate
- APIs
- B2B licensing
- government licensing
- white-label implementations

Regulatory and safety answers must never be distorted by monetization.

Tools with institutional trust value should avoid intrusive advertising.

---

# 55. STALKR / NAV TRL RELATIONSHIP

North Ground may naturally connect to STALKR/NAV TRL where useful.

Relevant contexts could include:

- group hunt separation
- trip planning
- check-ins
- location awareness
- emergency separation protocols

Do not force promotion.

North Ground content must remain valuable if STALKR disappeared tomorrow.

When comparing with satellite communication products, be explicit about capability differences.

Never imply cellular/location apps replace satellite emergency communications when they do not.

---

# 56. BUILD SYSTEMS, NOT DEAD ENDS

Before implementing a feature, ask:

1. Is this a one-off or a reusable concept?
2. Does this information belong in data rather than code?
3. Does this content belong in the CMS/knowledge graph rather than JSX?
4. Can another tool use this later?
5. Can this support another jurisdiction?
6. Can this support another language?
7. Can this be sourced and versioned?
8. Can this be tested?
9. Will this create maintenance debt?

Do not over-abstract trivial things.

But do not hard-code core business knowledge.

---

# 57. ARCHITECTURE PRINCIPLE

Prefer separation between:

DATA
→ DOMAIN LOGIC
→ APIs/SERVICES
→ PRESENTATION

Examples:

Government GIS should not directly determine UI structure.

Regulatory prose should not live only inside React components.

Species relationships should not be scattered across route files.

Weather providers should be replaceable.

Geocoders should be replaceable.

Core regulatory logic should be testable independently from UI.

---

# 58. OBSERVABILITY

Production-ready means observable.

Where appropriate maintain:

- error reporting
- API failure monitoring
- ingestion health
- stale-source detection
- data verification status
- job status
- uptime
- performance

A source silently failing for six months is unacceptable.

---

# 59. TESTING STANDARD

Tests should cover domain logic, not just rendering.

Especially test:

- coordinate → zone
- overlapping zones
- boundary points
- season opening date
- season closing date
- cross-year seasons
- timezones
- daylight rules
- species aliases
- hunter classes
- method restrictions
- conflicts
- stale records
- unknown records
- superseded records
- provider failure

Use deterministic fixtures.

Do not make unit tests dependent on live government APIs.

---

# 60. WHAT “PRODUCTION READY” MEANS

Do not claim production readiness because:

- it compiles
- localhost looks good
- TypeScript passes
- one happy-path test works

Production readiness requires appropriate verification of:

- build
- lint/typecheck
- tests
- mobile
- desktop
- accessibility
- API failure
- empty state
- loading state
- error state
- security
- SEO
- structured data
- analytics
- source provenance
- real representative data
- deployment behavior

Certify the actual feature.

---

# 61. DO NOT FABRICATE

Never fabricate:

- government rules
- season dates
- source citations
- species distribution
- product testing
- field experience
- search metrics
- API capabilities
- coverage
- user counts
- rankings
- performance results
- partnerships

If unknown, say unknown.

If unverified, mark unverified.

Trust is one of North Ground's primary assets.

---

# 62. DECISION HIERARCHY

When requirements conflict, prioritize roughly:

1. human safety
2. regulatory/factual accuracy
3. source integrity
4. user usefulness
5. privacy/security
6. accessibility
7. maintainability
8. performance
9. search discoverability
10. visual polish
11. monetization

SEO never overrides factual accuracy.

Design never overrides safety.

Revenue never overrides trust.

---

# 63. HOW TO HANDLE CURRENT TASK PROMPTS

A prompt may ask for one small feature.

Before implementing:

1. read this file
2. read `docs/PROJECT-STATE.md`
3. inspect the current code
4. inspect relevant existing documentation
5. inspect git state
6. understand how the task fits the master system
7. implement without damaging unrelated work
8. test
9. update relevant documentation/state

Do not restart completed work because a prompt lacks historical detail.

The repository is the source of truth for implementation state.

---

# 64. PROJECT STATE MANAGEMENT

`docs/PROJECT-STATE.md` is the living operational record.

Keep it concise enough to remain useful but detailed enough for another agent to resume work.

It should contain:

## Current Product State
What exists and works.

## In Progress
Active work and ownership where known.

## Known Problems
Confirmed defects/debt.

## Next Priorities
Ordered actionable work.

## Blocked
External credentials, decisions, data or dependencies.

## Coverage
Jurisdictions/species/data currently supported.

## Recent Decisions
Important architectural/product decisions and why.

## Validation
Latest build/test/deployment state.

## Last Updated
Timestamp and responsible agent/context.

Update PROJECT-STATE when your work materially changes any of these.

Do NOT rewrite the master vision in PROJECT-STATE.

---

# 65. UPDATING THIS BLUEPRINT

This document may evolve as North Ground evolves.

Do not casually rewrite the master vision because of one implementation task.

Update this file only when:

- product direction genuinely changes
- architecture principles materially change
- a new permanent product pillar is approved
- a previous assumption is explicitly superseded
- the owner explicitly changes direction

When changing this file:

1. preserve still-valid context
2. modify the smallest appropriate section
3. document material direction changes in `docs/PROJECT-STATE.md`
4. do not silently remove major product principles
5. mention the change in your completion report

Prompts control tasks.

This document controls direction.

---

# 66. QUESTIONS TO ASK BEFORE SHIPPING ANYTHING

Before completing meaningful work, ask internally:

### PRODUCT
Does this move North Ground toward the outdoor-intelligence vision?

### USER
Does it solve a real outdoor decision better?

### DATA
Is important information structured appropriately?

### SOURCE
Can important factual/regulatory claims be traced?

### TRUST
Are we claiming anything we cannot prove?

### CONTENT
Does every sentence earn its place?

### SEARCH
Does the correct surface own the correct intent?

### AI/AEO
Can machines understand the answer without guessing?

### UX
Can someone outside, on a phone, use it quickly?

### ARCHITECTURE
Are we creating a reusable system or an unnecessary dead end?

### GLOBAL
Are we accidentally hard-coding Canada-specific assumptions into universal systems?

### FUTURE
Could the regulatory engine eventually serve another North Ground tool, API, partner, or government deployment?

If the implementation performs well against those questions, it is probably moving in the correct direction.

---

# 67. THE END STATE

The end state is not “a website with lots of articles.”

It is not “a hunting app.”

It is not “a bushcraft blog.”

North Ground should become an interconnected outdoor knowledge and intelligence ecosystem where:

- authoritative data establishes what applies
- geospatial systems establish where it applies
- rules engines establish when/how it applies
- environmental data establishes current conditions
- North Ground knowledge explains what it means
- field testing provides original evidence
- tools turn complexity into decisions
- editorial resources provide depth
- search brings new users into the system
- AI systems can understand and cite the information
- users return because the utility is genuinely better
- commercial products emerge from earned trust

The site, content, data, tools, field work, maps, newsletter, video, APIs, and future products should reinforce one another.

The guiding principle is:

> **Do not merely publish outdoor information. Build the system people use to understand what applies to their next trip.**

That is North Ground.
