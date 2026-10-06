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

## Fidelity, in both directions

*Decided 2026-09-23 (owner).*

North Ground must not overstate or understate what authoritative evidence
establishes. **A restriction stricter than the authoritative source is a false
claim just as a restriction looser than the source is.** Likewise,
UNKNOWN/NEEDS_VERIFICATION must represent genuine unresolved evidence, not
implementation limitations or unnecessary refusal.

Where authoritative evidence establishes a rule for a resolvable geography and
population, North Ground should encode that supported rule; uncertainty in a
separate geography, population, or condition must not erase the supported
answer. Never fill an evidentiary gap by inference merely to reduce UNKNOWN
results.

Worked example. A source states a season for Districts C and D. North Ground can
authoritatively resolve C and deliberately cannot derive D:

- C → encode the rule.
- D → remain unresolved/unserviceable.
- Do not throw away C because D is unavailable.
- Do not invent D's geography just to make the rule usable.

The goal is not maximum conservatism; it is maximum fidelity to authoritative
evidence. Never claim more than the source establishes, but never deliberately
claim less either. A refusal always looks defensible, which is why an
unnecessary one is never reported by anyone.

## A season is not a date range

*Decided 2026-09-30 (owner).*

The fundamental regulatory object is a **LEGAL HARVEST OPPORTUNITY**, not a
season. It is species × geography × date and legal hours × legal animal class ×
implement × hunter eligibility × authorization × limits × material conditions ×
provenance.

Two rows carrying the same dates can be entirely different opportunities —
antlered with a bow in October is not either-sex with a rifle in November — and
North Ground must preserve that distinction structurally. **Never flatten them
into "deer season: Oct 1 – Nov 20."** That sentence is not an answer to the
question a hunter has, which is *what exactly may I take here, when, with what,
and under what conditions?*

Four rules follow, and each exists because of a way the answer degrades:

- **A fact that lives only in a display string is not resolved.** Québec's
  antler threshold is the legal test and sits in `classLabel` as « Cerf de
  Virginie avec bois (7 cm ou plus) » — the right words, and unqueryable. A
  threshold that cannot be filtered, compared or converted reads as coverage
  and computes as nothing. Physical criteria are structured facts — the
  measurement, comparator, value, unit and what is measured — and the
  authority's own wording is kept beside them, never instead of them.
- **One canonical home per dimension.** Implements currently live in three
  shapes across the corpus. A hunter asking what is open to a crossbow cannot
  be answered while one fact has three addresses. Normalise for computation;
  keep the authority's terminology for fidelity.
- **Never infer a legal fact from shorthand.** "Bucks only" is not a definition
  of antlered; "archery" does not establish that a crossbow is permitted;
  "firearm" is not every firearm; "antlerless" is not female. Where the
  authority does not settle a dimension it is UNRESOLVED — which is neither
  false, nor closed, nor permitted.
- **Certification tests the dimensions that decide legality, not the row
  count.** A bundle with every date and no animal class is not complete for a
  species whose legality turns on class. `dimension-matrix.ts` declares which
  dimensions may be material per species and measures what is actually held;
  `NOT_RESEARCHED` never arrives dressed as `NOT_APPLICABLE`.

The interface obligation is the opposite of the data's: the model is
sophisticated and the answer must be scannable. Status, legal animal class,
dates, implement and any material condition are visible immediately; permits,
limits, hours, details and sources come behind progressive disclosure. §41A's
classification governs which sentence sits where.

## Capability reporting measures deliverable answers

*Decided 2026-09-23 (owner).*

**Capability reporting must measure deliverable answers, not merely encoded
records.** A rule referencing geography that the resolver cannot produce must
not count as supported coverage. Refusal and reason metrics must use stable
classification semantics, so that a change in validation order cannot
masquerade as a coverage improvement.

This is a certification requirement, not a reporting nicety: a system that can
report something as built when a hunter could never receive it is
misreporting its own capability, which is as serious as an individual wrong
rule and much harder to notice.

## The law's answer, not a copy of the law's prose

*Decided 2026-09-23 (owner).*

North Ground does not need to reproduce government legislative prose
word-for-word in order to build hunting answers. The default model is:

**READ → INTERPRET ACCURATELY → STRUCTURE THE FACT → WRITE IT IN NORTH GROUND'S
OWN CONCISE WORDING → CITE THE OFFICIAL SOURCE.**

Where an authority establishes an orange requirement, a legal method, an
ammunition restriction, a licence requirement, an hours rule or a limit, what
North Ground needs is the **rule** — not a copied paragraph. Encode the fact:
licence required, additional permit or tag, permitted methods, ammunition and
projectile restrictions, hunter orange, legal hunting hours, daily/season/
possession limits, tagging and reporting, applicable restrictions.

Provenance is never reduced by this. Every fact keeps its authority, official
source URL, section/table/page where applicable, retrieval and verification
dates, scope and applicability, and whatever evidence is needed to audit the
interpretation.

Four limits on it:

- **Extract and model the actual legal fact.** Do not paraphrase legislative
  text sentence-by-sentence to make it look different; that is neither
  original wording nor a structured fact.
- **Do not change the legal meaning.**
- **Do not reproduce substantial tables, maps, images or other protected
  material** by altering a few words.
- **Do not remove attribution or evidence provenance.**

Verbatim retention remains correct where the authority's own words ARE the
fact — a quoted restriction whose exact scope turns on its wording, a stated
window, a critical exception — as §41A already requires. That is a deliberate
exception, not the default.

**A reproduction licence is therefore rarely a blocker.** Before treating one
as such, ask: does answering this genuinely require reproducing protected
wording, or can the underlying rule be encoded accurately as structured data in
North Ground's own words, citing the authority? If the latter, it is not a
licensing blocker and the work continues. Bring forward an authorization
request only for a specific piece of source material that is genuinely needed
and cannot be replaced this way.

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

### Species authority pages

*Decided 2026-10-06 (owner). White-tailed Deer is the reference implementation.
Rolled out catalogue-wide 2026-10-06 on the owner's instruction to universalize
the experience across the species catalogue: all 485 published species render
through this contract, the other 484 from an adapter over the structured
profile each already holds. One reversible switch returns them to the previous
renderer.*

One canonical species URL may render a durable authority page from a structured,
runtime-validated knowledge contract. The contract is reusable by HTML, JSON-LD
and future API/MCP consumers; the page is not a second store of facts hidden in
JSX. It keeps four evidentiary layers explicit: **biology**, **field knowledge**,
**hunting intelligence** and **geospatial intelligence**. A fifth handoff may
name regulatory coverage, but only Hunt and the cited responsible authority
answer legality for a place and date. Habitat, equipment, range and Species Heat
must never be allowed to imply an open season or lawful access.

Every rendered major section starts with a direct answer and owns a stable anchor.
Claims cite typed sources, with review dates visible. Runtime validation must
reject missing anchors or direct answers, duplicate section/FAQ ids, broken
species references, malformed or missing citations, orphan sources, invalid Hunt
links, and hunting-only guidance on a non-quarry page. Optional sections follow
capability and evidence, never a hard-coded species list.

The reference renderer connects to the existing canonical PRIMARY media,
regulatory engine and Species Heat surface rather than duplicating them. A
high-consequence visual such as shot placement is published only when original,
licensed and anatomically reviewed; until then the complete text guidance and an
explicit visual-asset manifest are the product, not a decorative substitute.

### Conservation status, take eligibility and legality are three questions

*Decided 2026-09-30 (owner). This replaces the earlier protected-versus-huntable
binary.*

- **CONSERVATION STATUS** answers *what is this animal's protection or
  conservation classification, and where?* Sourced statements per jurisdiction
  (ESA and SARA listings, state protection, closures), recorded exactly as the
  authority states them — a listed subspecies or population is named as such.
- **TAKE ELIGIBILITY** answers *is this species part of North Ground's
  meaningful hunting/removal universe anywhere?* One of `HUNTABLE`
  (conventional regulated quarry), `LIMITED_TAKE` (legal take only under narrow
  conditions — a quota, a draw, a collection permit, special geography),
  `NUISANCE_OR_INVASIVE_TAKE` (lawful removal that is not ordinary game),
  `NON_QUARRY` or `UNKNOWN`.
- **REGULATORY EVIDENCE** answers *can I legally take it HERE, NOW, and on what
  conditions?* Only a certified jurisdiction-specific rule answers it.

Never collapse them. Conservation status never decides eligibility; neither
decides legality. Trumpeter swan is protected in several states and taken under
a federal quota in Nevada: it is `LIMITED_TAKE` with its protection kept.

- **Features follow the class, never a list.** Hunt offers HUNTABLE,
  LIMITED_TAKE and NUISANCE_OR_INVASIVE_TAKE species. A continental "where to
  look" layer (Species Heat) is drawn only for HUNTABLE and
  NUISANCE_OR_INVASIVE_TAKE: a narrow quota in three counties must never read as
  huntable everywhere. Green outlines remain the only statement that a legal
  opportunity exists, and only where a certified rule establishes one.
- **A generic group season does not legalize every member.** A "swan" season is
  not trumpeter take unless the regulation says so. Species-specific findings are
  recorded in `research/hunting/take-eligibility-conflicts.csv`, which the tests
  read: a NON_QUARRY or UNKNOWN species with authority take evidence and no
  recorded finding fails, so no contradiction is silent.
- **Inclusion rule.** A species enters the quarry universe when authoritative
  evidence establishes a meaningful regulated recreational hunting or take
  opportunity in Canada or the United States — a named season, game
  classification, licence/tag/permit, bag or possession limit, draw, or an
  established removal program. "Unprotected", "pest" or "may be killed" alone is
  not enough. House mice, rats, voles, pocket gophers, moles, shrews, bats,
  feral cats and feral cattle stay out, documented in
  `research/hunting/take-exclusions.csv` with the jurisdictions and sources that
  list them.
- **A ranch, a release pen or a pet is not a wild population.** *Decided
  2026-10-06 (heat audit).* Where every North American animal of a species is
  held on private ranches, released from game farms, or of unconfirmed
  existence since its last study, an authority's season for it is still a real
  rule and Hunt delivers it — so the species is `LIMITED_TAKE`, never dropped
  from Hunt — but there is no wild range to show, so it carries no Species Heat.
  Red deer (Texas ranch exotics), Himalayan tahr (no record anywhere in Canada
  or the United States since 1990), Québec's released red-legged and rock
  partridges and guineafowl, and peafowl (taken only in three named Hawaiʻi
  hunting areas) are the first cases. A domestic animal with no established
  free-ranging population (the ferret) is `NON_QUARRY`, with the authority's
  removal listing recorded as a finding; it is never called protected, because
  it is not. Records of captive, released or escaped animals never draw a range.

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

### Provider images fill placeholders; they never outrank the administrator

*Decided 2026-09-30 (owner).*

A species with no manual image may show a photograph from an external photo
provider (Unsplash today; the model is provider-neutral). Precedence is
**MANUAL > VERIFIED PROVIDER IMAGE > PLACEHOLDER**, enforced in the read model,
and the provider pipeline never touches a species that has a manual image.

- **Identity comes from the photographer's own caption**, never from search
  relevance. Publishable only as VERIFIED (the caption gives the binomial) or
  HIGH_CONFIDENCE (the caption gives an identifying common name). A name shared
  by two catalogue species, a name built from describing words ("green frog"),
  a caption naming another species, or a generic word ("duck") never
  qualifies. A provider's machine-written alt text can disqualify, never
  identify. Visually near-identical pairs require the binomial
  (`content/species-media/identity-policy.json` records each and why).
- **A visual check can only reject.** It never approves a photograph whose
  caption does not already identify it. Uncertain means the placeholder stays.
- **The provider's terms override the same-origin rule for its images.**
  Unsplash requires hotlinked URLs, a visible "Photo by … on Unsplash" credit
  with both links, and one download event when a photo is chosen. Provider
  images are therefore served from the provider's host, shown only where their
  credit is shown (the species library and profile render `SpeciesPhotoCredit`),
  and never re-encoded into our social cards or claimed in our sitemap or
  structured data. A consumer with no room for a credit line — Hunt's compact
  avatars today — reads through `uncreditedSurfaceMedia`, which drops provider
  images and keeps every image of ours; a new consumer does one or the other.
- A manual image whose photograph came from a provider carries that credit too.

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

### Resolving inside a jurisdiction is not drawing its boundary

*Decided 2026-09-30 (owner).*

A statewide or province-wide rule has a geography — the jurisdiction itself —
and it is not a hunting zone. Most United States take listings are statewide
seasons, so without some way to place a point inside a state those rules can be
encoded and never delivered, which §8's capability rule counts as no coverage
at all.

**A jurisdiction boundary may therefore be used to RESOLVE a point for a rule
whose own scope is the whole jurisdiction.** The U.S. Census TIGERweb state
boundary is the first case.

Everything the existing prohibition protects stays in force:

- **It is never drawn as a hunting zone and never becomes a zone id.** §41A's
  rule that every line traces to a named authority's own published GIS service
  is unchanged; a cartographic boundary is not a regulatory one.
- **It is never the geography of a rule scoped to anything narrower** than the
  whole jurisdiction. A unit, district or county rule waits for the authority's
  own geometry.
- **It is labelled as what it is**, with its source, and never presented as the
  authority's determination of where hunting jurisdiction runs.
- **Proximity is stated.** A point near a jurisdiction line gets the same
  treatment §41 already requires for a zone line: the uncertainty is shown, and
  consumer GPS is never presented as a legal survey. Hunting jurisdiction and
  cartographic extent can differ — water boundaries, federal and tribal land —
  and where that is known it is said rather than smoothed.

The trade is deliberate and its failure directions are not symmetric: the error
this admits is a wrong answer within a few hundred metres of a jurisdiction
line, where the interface already warns; the error it removes is dozens of
jurisdictions answering nothing where the authority has published a season.

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
  each area with the authority's own restriction text.

### A protected area is not a closed one unless the authority says so

*Decided 2026-10-01 (owner), on Saskatchewan's ss. 7 and 7.1.*

The rule above is the right default and it is not the whole law. An authority may
**DEEM** an area open to hunting inside an open zone, and where it does, that
deeming IS the rule — the area's protected status is a different fact, and
withholding the season because of it would refuse a hunt the authority has
granted. §8's fidelity runs in both directions, and this is the direction that
never gets reported: a hunter told "in season outside restricted areas" simply
goes somewhere else, and nobody writes in to say they were wrongly turned away
from ground that was open.

Saskatchewan's The Open Seasons Game Regulations, 2009 (W-13.12 Reg 3) is the
first case. ss. 7 and 7.1 deem eight protected and national wildlife areas open
inside an open zone — Anderson Island, Waskwei River, Bradwell, Last Mountain
Lake, the Prairie NWA units, Stalwart Lake, Tway and Webb. Its real exclusions
run the other way: Fort à la Corne WMU and St. Denis NWRA are carved out, and
provincial parks are closed **except those explicitly listed**, which is a
positive list rather than a prohibition.

So the model carries an area's **hunting effect as its own field**, decided by
the authority's own words and never inferred from what the area is called:

- **DEEMED_OPEN** — the authority states the season runs there. The card says
  the season is in season there, naming the area and the provision that opens
  it. A conservation designation never overrides this.
- **EXCLUDED** — the authority carves it out. The existing default applies.
- **OPEN_ONLY_IF_LISTED** — a class closed except for named members. Membership
  of the list is the fact; an unlisted area is closed and an absent list is
  UNKNOWN, never "all closed" and never "all open".
- **UNRESOLVED** — North Ground has not established which. It is UNKNOWN, which
  is neither open nor closed.

Three things this does not change. A deemed-open area still composes with every
other layer, so a federal rule or a separate order can still close it. North
Ground never derives any of these states from an area's name, type or
conservation status — "National Wildlife Area" predicts nothing about hunting,
which is exactly what Saskatchewan demonstrates. And where North Ground does not
hold the area's geometry, it says the rule and names the area without drawing a
boundary it cannot trace.

## The species layer: heat and open season

*Decided 2026-09-29 (owner). This supersedes the previous rule that the species
filter must never use colour for legality.*

Choosing a species turns the map into a **layer** over the same geography: a
semi-translucent **heat signature** showing where the evidence suggests
investigating, and a **green highlight** on the zones whose season is open for
that species. Nothing else is drawn. The layer answers one question — *where
should I look, and where is it open* — and it answers it at a glance.

- **Green means at least one current legal hunting opportunity exists** for the
  selected species, zone and date. *Amended 2026-09-29 (owner): green is no
  longer restricted to seasons open for every licence. A hunt that is legally
  possible now is green, whether or not it turns on the hunter.*

  - open without material conditions → **green**
  - open with material conditions → **green + a `!` condition indicator**
  - closed → no green
  - a season in the future → no green for the selected date
  - unknown or insufficient certified coverage → **no green, and never called
    closed**

- **There is no conditional map colour.** No yellow, no orange, no stripes, no
  second fill, no competing legend category. If hunting is legally possible now
  the zone is green, and conditions are carried by one compact `!` indicator per
  zone — legible over heat, green, the basemap and the boundaries, and never
  obscuring a zone label or the selected-zone treatment.

- **What counts as conditional is structured, never a display string.** It comes
  from the canonical regulatory result — licence class, tag, draw, sex, age,
  weapon or method, ammunition, permit, residency, hunter qualification, a
  method-specific season, or another real restriction. **Explanatory prose in a
  source is not a condition.** The `!` means: *there is a legal opportunity here
  now, and the hunter needs to know something material before assuming it
  applies to them.*

  *Amended 2026-09-30 (owner): "if there's no specific condition then no
  exclamation mark."* Measured that day, 2,682 of 2,993 green zones (89.6%)
  wore a `!`, almost all for the ordinary licence, a species-wide ammunition
  rule or a bag limit. Every condition now carries a DECLARED kind and scope
  (`content/regulatory/condition-kinds.json`, never read from prose), and a
  condition earns the `!` only when it **gates** the hunt — a tag or draw, a
  weapon-only season, a season for some hunters only — or when it is a
  standing requirement **declared for some zones** (a unit's discharge
  permit, orange while a deer season runs in that area, a firearms ban in part
  of a zone). A question the engine asks earns it only when some hunter's
  answer is not open. The ordinary licence, a species-wide method rule, bag
  limits, reporting and context are said once in the legend and in every
  zone's card, never as a marker. A tapped zone's card names the material
  conditions first, under "Conditions apply", from the same answer the
  marker was drawn from.

- **The `!` is a real control**, reachable by touch, mouse, keyboard and screen
  reader, and never by hover alone. It opens a concise glass popover naming the
  most important one to three conditions, with any remainder counted rather than
  listed, and a path into the zone sheet where the complete sourced answer
  already lives. The popover never duplicates the sheet.
- **The zone card is unchanged and remains the full answer.** Tapping a zone
  opens the ordinary zone sheet, with every state, condition, source and
  limitation §41A already requires. The layer is a way in, never the answer.
- **Green means a season is open for that species in that zone.** It is not a
  licence check and never implies one. Anything that turns on the hunter belongs
  in the card, where there is room to say it.
- **A zone that is not green is not thereby closed.** Uncertified and unknown
  zones are simply unhighlighted, and the layer's own legend says so in words.
  §48 still binds: the meaning is never carried by colour alone, so the legend
  and the card carry it in text.
- **Heat never implies legality and green never implies animals.** They are two
  independent layers over one geography, and §41B's separation of species
  opportunity from legal status is unchanged.
- **Heat resolution never exceeds evidence resolution** (§41B). A zone with no
  certified evidence draws no heat rather than a cold value, because absent
  evidence is not evidence of absence.

## Authority language is immutable; translation is presentation

*Decided 2026-09-29 (owner).*

Canadian authorities publish in French and in English, and a hunter must never
be required to read a language they do not have in order to use Hunt. Equally,
an authority's own words are the fact and may not be rewritten.

- **The original authority text is immutable and keeps its language.** It is
  never replaced in provenance by a translation, never re-labelled as
  authority-owned in another language, and never has its citation identity
  changed. A translation is **North Ground presentation over** the original.
- **The model distinguishes ORIGINAL AUTHORITY TEXT from TRANSLATED DISPLAY
  TEXT**, and the `owner` tag already carries that distinction: a translation is
  `NORTH_GROUND`, never `AUTHORITY`. A machine or North Ground translation must
  be structurally incapable of rendering through the authority-quotation path.
- **Source language is metadata, not detection.** Where a record knows its
  language, that is used; language is never re-guessed at render. Records
  holding foreign text without language metadata are corrected from
  authoritative evidence, never by guessing.
- **Preference order for a translation:** the authority's own published
  bilingual text first — in which case both texts are authority-owned and both
  provenance relationships are kept; then a stored, reviewed North Ground
  translation; then a clearly labelled generated one. Where no translation
  exists, the original remains available and the interface says so rather than
  hiding the fact.
- **Translation never changes structured legality.** Interpretation runs on the
  canonical regulatory data, never on translated prose.
- **The pattern is generic, not Québec-specific.** French→English and
  English→French are the same mechanism, and it extends to further source
  languages without rework.
- **The interaction is the familiar one:** the translation shown by default in
  the interface language, labelled as translated and from which language, with a
  control to see the authoritative original and return. Both are real accessible
  controls with their state conveyed.
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

## Selectable is not answerable

*Decided 2026-09-23.*

Two different questions, and conflating them costs coverage:

- A species is **selectable** where North Ground can draw the official
  geography its seasons are written in and resolve a point to a zone.
- A species is **answerable** only where a certified regulatory record exists.

A jurisdiction can be drawn long before its rules are certified (`rulesServing`
on the layer side). Treating those as "nothing to offer" left hunters in
British Columbia, Saskatchewan, Yukon and Newfoundland unable to choose
anything at all — not even to learn which official zone they are standing in,
which is a real question with a real answer.

So: a selectable species may always be chosen. Choosing one that is not
answerable draws that species' own geography, resolves the zone, and answers
with an explicit UNKNOWN in the engine's own words, naming the authority whose
rules they are and linking the authority's own published source where North
Ground holds one — never a GIS endpoint dressed as reading, and never an
invented link. It never shows a season, a limit or a date.

The selector states which it is: rules here, boundaries only here, or no
official geography here. Coverage reporting counts only what is answerable; a
selectable species is not coverage.

## Coverage, camera and request are three different things

*Decided 2026-09-23.*

One constant used to do all three jobs, and the difference matters:

- **Coverage** is the union of every served layer's bounds. It decides whether
  a point is somewhere North Ground can answer about. It is never widened or
  narrowed for any other purpose: narrowing it to buy performance would shrink
  a regulatory claim.
- **The opening camera** is where the map opens. It is DECLARED, not derived
  from coverage. Deriving it meant every ingest moved every hunter's opening
  view — serving a new jurisdiction widened the union, so the map zoomed out
  and its first request grew with it. Moving the camera is the owner's
  decision, never a side effect of an ingest.
- **A request box** is the viewport, clamped to coverage, snapped to the level
  it is asked at. It is never the union of bounds, and each screen asks for
  what it can actually show.

Two honesty rules follow, and both are enforced in code:

- A drawing is **whole** only when the box it was asked for holds it with room
  to spare. Touching the edge is the signature of a clip, and a clipped
  drawing treated as whole would let the map draw the edge of a request box as
  a zone's boundary — asserting a boundary no authority gave it, while looking
  perfectly normal.
- Ground **nothing has been asked about** is not ground with no zones in it.
  Panning past the boxes already answered asks again rather than drawing an
  empty country.

The picture shown before the live map draws is a drawing of that first
request, from the same declared camera, so it lies under the lines the map is
about to draw.

## The map reads at three scales

*Decided 2026-09-22.*

The same official geometry is drawn three ways, automatically, with no mode
switch — because a hunter asks a different question at each scale:

- **National** (below zoom 6.5) — *where am I in the country?* Jurisdictions
  read as quiet tonal blocks, internal lines almost disappear, and only zones
  with real room on screen are named.
- **Regional** (to zoom 9.5) — *which zone is which?* Boundaries take over from
  fills and more names appear.
- **Local** — *where exactly?* Lines are crisp, fills nearly gone, and the
  terrain, water and roads underneath carry the ground.

One thing is always loudest: the zone you chose. It wears the only bone
outline on the map, the strongest fill and the top of the stack, and that is
computed to clear whatever the loudest unchosen zone can reach — not tuned by
eye. Its neighbours lose fill but keep their boundaries: a focal plane, never a
blackout.

Jurisdictions differ by **tone, not by loudness** — a family of quiet greens and
earths, so Ontario can be told from Manitoba at national scale without
colouring the country in. Colour still never carries meaning alone: a species
state is a word and a glyph as well as a tint.

How strongly the boundaries sit over the basemap is the reader's choice —
**Light / Standard / Strong**, Standard being the tuned default — and it lives
in the Layers control, which is appearance only: a label and a control per row,
no paragraphs. Anything needing explanation belongs on the thing it affects.

## The two markers are two different things

*Decided 2026-09-22.*

The device's position is a small high-contrast dot with an accuracy ring. The
hunt location is the bone pin. They are different concepts (see above) and must
never read alike; the pin is also scaled to sit between the chosen zone's
outline and the device's dot, because the subject of the map is the zone, not
the pin.

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
focused field with the keyboard up.

**The composer keeps its place; the keyboard only takes viewport away.**
*Amended 2026-09-29 (owner), reproduced on iPhone Safari.* The field stays where
it lives at the top of the sheet and does NOT move to sit above the keyboard.
Tapping it opens the sheet, focuses the input, and the keyboard rises from the
bottom; what remains between the field and the keyboard is the usable viewport,
and the sheet's content adapts to it. The previous rule made the field a
messaging-style bottom composer anchored to the visible bottom edge, which on a
real phone reads as the search field chasing the keyboard, with the sheet
rearranging around it.

There is ONE viewport model: the shell is inset to the visual viewport's visible
band. No second keyboard detector, no device-specific offset, no transform that
moves the sheet when the keyboard opens, and nothing of North Ground's floating
above the native keyboard — no custom accessory row and no keyboard-dismiss
control. The search field carries search semantics so the platform treats it as
a location search rather than as credentials or payment input.

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
- **Date** makes time-specific regulatory evaluation possible — and a zone and a
  date are already a useful answer: *what is open here today*.
- **Species** is a DRILL-DOWN into that answer, not the price of getting one.

*Amended 2026-09-23 (owner).* A resolved zone must be useful without choosing a
species. Location → zone → what is open here today, automatically. Requiring a
species first asks a hunter to name the thing they opened the app to find out.

A zone chosen without a point gets the whole-zone answer (zone cards, above); an
exact point — a place, the device's position or a confirmed pin — gets the point
answer. A zone's answer is always zone-scoped: it never becomes a point answer,
and it never says a rule applies TO THE HUNTER, because no hunter has been
described yet.

## Hunt answers before it explains

*Decided 2026-09-23 (owner), after using the live app at Maniwaki.*

The result was thorough and backwards: paragraphs where a hunter wanted to scan.
A hunter should feel ready after a few seconds of looking.

Primary surfaces carry the answer as STRUCTURED data — status, dates, legal
hours, methods, requirements, critical restrictions. Regulatory explanation and
provenance move behind progressive disclosure. **Long-form legal prose never
replaces a concise operational answer where the same information can be
represented accurately as structured data.** Where it cannot — where the
authority's own words are the fact — the words stay, quoted, attributed, and in
the language the authority published them in (§47).

Every sentence on a Hunt surface is classified, and the test is one question:
*could a hunter who ignored this break the law, be unsafe, or be turned away —
today, here?*

- **Critical operational warning** — yes. It sits beside the status. **A
  critical blocker is never progressive disclosure**: "IN SEASON ⚠ Permit
  required" is right; a permit requirement inside a collapsed section is not.
- **Contextual limitation** — true only under a condition the system can
  actually test (near a mapped boundary, inside a published restricted area,
  one licence class). Shown only when that condition holds, attached to what it
  qualifies. A warning that fires everywhere is a warning nobody reads, and then
  it is missing when it is specific.
- **General limitation** — true everywhere, always. Said once, collapsed, and
  never diluted: the statement that North Ground does not describe harvesting
  under treaty or Aboriginal rights is kept verbatim.
- **Source detail** — the authority's own caveat about its own data. It belongs
  in Sources, attached to the source it describes.
- **Redundant** — deleted. A line repeating what the header already says is not
  thoroughness.

Fifty closed species must never bury six open ones. A summary groups by state,
names its counts in words, and keeps UNKNOWN and uncertified species reachable
and labelled as themselves — never folded into "not open", because an absent
answer drawn as a closed season is the failure this whole product exists to
avoid.

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

**Fees are never guessed.** *Amended 2026-09-23 (owner): the previous rule said a
fee appears only when it is from "the licence year in force". That contained a
jurisdiction-specific assumption which does not hold — most Québec big-game
licences are not licence-year artefacts at all.*

A fee appears only when North Ground has certified **two independent things**:
that the fee belongs to the licence, permit or authorization applicable to the
evaluated hunt, and that **the fee source is current in its own terms**. An
authorization also carries its own **validity basis** — a licence year, a
calendar period, a season, fixed dates, an event-based expiry, a tagging or
harvest event, or another condition the authority defines. **Never invent an
annual licence period where the authority defines none**; model the difference
rather than normalising it away.

*Clarified 2026-09-23: the fee's currentness and the authorization's validity
are separate facts and must not be collapsed into one flag. Québec indexes its
fees annually on 1 April while the big-game licence those fees buy expires at
season end or on tagging — so a fee can be perfectly current while the
authorization has expired, and the reverse. A single "current" flag can only be
right by coincidence.*

The hunter's category must also be known, and resident and non-resident figures
are never mixed. Where the category matters and is unknown, the hunter is asked
once, through the same answer the regulation reads — never a second
questionnaire.

**If applicability or currentness cannot be established, omit the fee and keep
the evidentiary state.** Do not display an old or current-looking number merely
because one was found. Otherwise the line says "Check current official fee" and
links the authority.

**Legal hunting hours are shown as the clock the hunter should follow.**
*Decided 2026-09-23 (owner).* Where a jurisdiction's statutory time basis and
the locally observed civil clock differ — Atikokan is the first case — BOTH are
preserved: the statutory basis is the source of legal truth, and the converted
local clock is presentation and actionability. **The compact answer shows the
actionable local time**; Details and exceptions explains that the rule is
defined on a different statutory basis and shows the conversion and its
provenance. The hunter is never asked to perform the conversion.

The conversion is deterministic and tested, DST and non-DST behaviour is
explicit, and a date is evaluated under the rule applicable to that date. The
statutory basis is never silently discarded. A weather provider's sunrise and
sunset are never shown as legal hunting hours, and a general solar rule is never
assumed to apply where a relevant exception has not been resolved.

**The source model wins over our schema.** *Decided 2026-09-23 (owner).* If an
authority publishes something a North Ground field cannot express, expand the
model. Do not round the source into the nearest existing field, collapse legally
different concepts for convenience, manufacture a generic period, or mark
something incomplete merely because the schema expected a fact the authority
does not use. **A source that does not fit the schema is evidence that the
schema may be incomplete.**

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
- **FIND GAME** — the explicitly named **SPECIES HEAT** layer, species range,
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

## Heat is a real-data spatial species-intelligence layer

*Decided 2026-09-29 (owner). This sharpens the SPECIES HEAT section below; it
does not replace it.*

The heat layer is a genuine, source-backed, refreshable spatial wildlife
intelligence surface — not a shaded restatement of a zone list. It is rendered
as a semi-transparent multi-stop ramp UNDER the regulatory outlines and the
interaction layer, so the basemap, zone boundaries, the green legality outline,
the `!` marker and the selected zone all remain readable through it.

- **Heat and legal status are wholly independent.** Heat never affects legality
  and legality never affects heat. HOT+GREEN, HOT+not-green, LOW+GREEN,
  NO-HEAT+GREEN and NO-HEAT+unknown are all legitimate and must all render.
- **Legality is carried by the OUTLINE; abundance by the FILL.** *Amended
  2026-09-29 (owner), against a mockup. This supersedes the previous rule that
  the heat ramp may never contain green.*

  The ramp is a conventional heat spectrum and MAY pass through green, because
  a spectrum a person already knows how to read is worth more than a private
  palette. What carries "a legal season is open" is the zone's **outline**: a
  bright, thick, unmistakable ring that no fill in the ramp can be confused
  with, and which must remain legible over every point of the ramp including
  its green band.

  Two obligations come with this and neither is optional. The outline must be
  demonstrably distinguishable from the ramp's green at every intensity, tested
  rather than eyeballed. And §48 still binds: the meaning is never carried by
  colour alone, so the legend states in words that fill means evidence and
  outline means legality, and the zone card says it again in words.
- **A metric is named for what its source actually measures.** Harvest density
  is harvest density; habitat suitability is habitat suitability; occurrence
  probability is occurrence probability. **Only a source measuring animals per
  unit area may be called population density.** The consumer-facing umbrella is
  ANIMAL HEAT or SPECIES HEAT, with the evidence named beneath it. North
  Ground never manufactures density from an unrelated metric.
- **Visualisation resolution may never exceed evidence resolution.** Point and
  grid evidence may render as continuous intensity; zone-level evidence
  **never paints hotspots inside a zone**; a range polygon shows range and is
  never shaded into density. *Amended 2026-09-30 (owner):* zone-level evidence
  is not painted on the map at all — no hunting-zone-shaped heat, no
  administrative polygon colouring. It is carried as supporting evidence.
  Heat is requested by ground, never through the zones in view. *Amended
  2026-09-30 (owner, "every Hunt-eligible species must have a map"):* a species
  whose only measured evidence is zone-level is no longer left without heat; it
  falls to the next tier below (range + habitat, "Every Hunt-eligible species
  has a map"), and its zone figures stay in the zone card, never in the paint.
- **Hunting pressure is not abundance.** Hunter counts and hunter-days measure
  effort, which tracks access, popularity and tradition as much as animals. If
  effort enters a derived score at all, the reason is documented and the
  denominator is the authority's own — never invented.
- **No data is not low population.** Absent evidence renders as no heat, never
  as a cold value, and the legend says so in words. Missing data is never
  normalised to zero.
- **Surveyed-and-none-found is not low, and colour is rank.** *Decided
  2026-09-30 (owner: "lay off the blue").* Ground a survey covered without
  finding the species is its own faint neutral state, never the bottom of the
  ramp: blue means LOW BUT FOUND. Where the evidence ranks places better than it
  measures ratios — a sparse survey count, measured by holding routes out —
  the ramp paints a place's rank among the ground where the species was found,
  in the owner's bands (bottom tenth faint blue … top tenth red), and the
  legend says so. A ratio scale anchored on a few exceptional counts is not
  more faithful; it spends the colour on outliers.
- **Confidence is a separate dimension from intensity.** Sparse evidence never
  becomes a confident hotspot.
- **The visual transform is not the value.** *Decided 2026-09-30 (owner).* How
  a value becomes a colour (rank, suitability class, level of detail, edge
  fade, opacity) is recorded separately from the scientific or model value and
  may never change it. A highly skewed distribution may be given a robust
  transform (quantile, rank, class) so it does not collapse into blue; no
  transform may manufacture a value the evidence does not hold — in particular,
  a renderer never blends "surveyed, none found" into a detected value, which
  invents low ground nobody measured.
- **Evidence is dated, and how years combine is declared.** Latest year, a
  multi-year average, a weighted history — whichever is used is documented and
  the evidence period is exposed. Years are never silently combined.
- **Derived heat is versioned.** A methodology carries its id, version,
  effective date, inputs, normalisation, weights, missing-data handling and
  confidence rule. Changing any of them is a new version, not an edit.
- **Raw authority evidence stays immutable and provenance-preserved**, and a
  derived North Ground value is North Ground-owned. Source class and confidence
  survive normalisation: community observation data never silently becomes
  equivalent to a government survey.
- **It is infrastructure, not a visualisation.** A new official dataset is
  ingested, normalised, validated and republished, and the map consumes the new
  artifact without a component being rewritten.

## SPECIES HEAT

*Renamed and re-architected 2026-09-29 (owner), after the density-evidence
survey found no public big-game evidence in Canada finer than the zone.*

**The user-facing name is SPECIES HEAT.** It replaces "SPECIE HEAT MAP", for
two reasons. A "specie" is coined money; the word was simply wrong, and it was
wrong in the product's own name. And the feature must never be called
"population density", because only some layers are a density: Alberta's aerial
surveys are animals/km², the waterfowl survey is breeding observations on a
plot, and harvest is a record of hunting. One name over many evidence classes,
with the legend saying exactly what THIS layer measures — "0.79 mule deer/km²",
"breeding survey observations, May" — lets the map get more precise as the
evidence improves without any layer being misrepresented as another.

### The animal layer and the zone layer are independent

This is architecture, not presentation, and it is the decision that keeps the
product honest as evidence improves:

- **ANIMAL EVIDENCE** answers *where does the best available evidence indicate
  this species occurs, and at what abundance*. Its geography is the evidence's
  own — a plot, a grid cell, a survey block, a raster, or a management unit
  when that is genuinely what the authority measured.
- **THE HUNTING-ZONE LAYER** answers *which regulatory zone is this*.
- **THE GREEN OUTLINE** answers *is there at least one current legal
  opportunity*, and **the `!`** answers *are there material conditions on it*.

They are separate data models and separate rendering layers even where their
geometry coincides. **A zone-resolution density estimate does not make the
hunting zone the heat layer** — it makes the zone the shape that one piece of
evidence happens to have. Zone boundaries are drawn OVER the animal geography,
never as its container.

Two consequences follow and both are testable. **Heat is never clipped to the
selected zone**; it covers the map wherever defensible evidence exists, because
an animal's distribution does not stop at a regulatory line. And sub-zone
evidence — the waterfowl plots are the first — **renders across zone boundaries
in its own geometry**, because its geography is independent of theirs.

### The surface is a raster, and the zones float above it

*Decided 2026-09-29 (owner).*

Species Heat is a **continental, species-specific opportunity raster** rendered
like weather radar, with hunting geography drawn over it as an independent
vector layer. North America is divided into cells at a declared resolution that
owes nothing to any regulatory boundary; each cell carries a score; the renderer
turns those cells into the continuous transparent → blue → cyan → green → yellow
→ orange → red surface. The draw order is fixed:

    satellite basemap
      → species opportunity surface
      → hunting-zone boundaries
      → bright-green legal-opportunity outlines
      → `!` condition markers
      → labels, selection, interface

**Surfaces are ranked by evidence tier** (*extended 2026-09-30, owner*; the
full ladder is in "Every Hunt-eligible species has a map" below):

1. **Measured or authority-modelled abundance.** Where an authority publishes
   density, survey grids, observation surfaces or aerial-survey polygons under
   a licence we may use, that evidence renders at its own legitimate
   resolution. This is always the stronger layer and is preferred wherever it
   exists.
2. **A North Ground habitat/opportunity model.** Where measured abundance does
   not exist, a reproducible species-specific model built from high-resolution
   published environmental inputs and published biological research. It is the
   fallback, never the preference, and never presented as the first.
3. **Range + habitat, then range alone.** Where neither exists, the species'
   defensible range with habitat variation inside it; where habitat cannot be
   modelled defensibly, the known distribution itself, labelled as such.

**A coarse measurement may never modify fine-resolution cells.** If a zone-wide
survey reports 0.8 moose/km², that is a real and valuable fact about the zone in
aggregate — and it still says nothing about whether the western valley holds
more moose than the eastern forest. A zone value multiplied across fine pixels
would let a regulatory boundary shape the animal surface while looking like
biology: the same defect as a zone choropleth, in disguise and harder to see.
Such a measurement is carried as supporting evidence and as confidence until
there is a defensible statistical method for incorporating it, and the absence
of that method is not a reason to approximate one.

**There is no generic wildlife formula.** `forest + water + elevation` is not a
model and must never be applied across species. Every species gets its own
versioned model: a moose model weighs wetlands, regenerating forest, aquatic
forage, thermal cover and snow; ruffed grouse, black bear and waterfowl each
turn on different relationships. **Season is part of the model, not a note on
it** — a September moose model is not a winter moose model, and using one for
the other is a silent error a hunter cannot see.

Every generated surface carries its own provenance block: species, model id and
version, output resolution, season represented, each input source, the
population evidence used, the biological literature supporting the weights, the
methodology, generation date and confidence. A model whose inputs cannot be
stored cannot promise reproducibility and says so.

**The interface names what it is.** "Moose opportunity — habitat suitability
and available population evidence", with an information control that says in
plain words: areas with environmental characteristics associated with moose
occurrence, supplemented by available population evidence; a habitat and
opportunity model, not a count of animals. It is never called population
density unless the underlying data measures density.

### Every Hunt-eligible species has a map

*Decided 2026-09-30 (owner). This changes product direction: a surface is no
longer binary on measured density.*

The product question is **"where should I expect to find this animal?"** Every
Hunt-eligible species in the canonical catalogue — the species whose canonical
take eligibility grants Species Heat (`permitsSpeciesHeat`: HUNTABLE or
NUISANCE_OR_INVASIVE_TAKE) — resolves to a species surface. The evidence quality may vary; the
existence of the map may not. The question is never "can we build a density
map?" but **"what is the strongest spatial statement the available evidence can
defensibly support?"** — and then the map is that.

**The evidence tiers**, strongest first. A species is served at the strongest
tier it holds, and promoting it later changes data, never the renderer:

| Tier | What the heat represents | May be called |
| --- | --- | --- |
| T1 MEASURED_DENSITY | animals per unit area, measured | density, abundance |
| T2 MODELLED_ABUNDANCE | an authority's published abundance model | the source's own metric |
| T3 SYSTEMATIC_SURVEY | a structured survey's occurrence/relative abundance | relative abundance, survey occurrence |
| T4 HABITAT_MODEL | a North Ground species-specific, validated habitat model | habitat suitability, opportunity |
| T5 RANGE_HABITAT | habitat variation inside a defensible range | range-constrained opportunity |
| T6 RANGE_ONLY | the known distribution, unvaried | known distribution |

Only T1 may say density. T4 and T5 never claim abundance or density, and T6
never ranks places within the range. Legality, zones and the green outline are
untouched by any of it.

**NO_SURFACE is exceptional and audited.** It means only: the species is not
Hunt-eligible; no defensible geographic distribution can be established; or
licensing forbids every viable spatial source. It never means "no aerial density
survey exists". Each exception is a documented blocker, and a coverage validator
over the whole catalogue fails the gate on an eligible species with neither a
surface nor a documented blocker.

**Range + habitat is the universal fallback.** A defensible range (from
authoritative distribution maps where licensed, otherwise from legally reusable
occurrence records under declared rules) is combined with continental
environmental foundations — land cover, water, terrain, coast — built ONCE and
reused by every species. Each species gets its own declarative **surface
profile**: supported range rule, preferred and avoided habitat, water, terrain
and coast relationships, season, the published habitat statement it rests on
and its source, and its fallback tier. A new species needs data and a profile,
never renderer code. Occurrence records validate and constrain; their absence
does not by itself block a map where range and habitat evidence exist.

**Weights are never invented, and a categorical model is publishable.** Where
the literature supports only associations — core, strong, moderate, avoided,
required — the model is a conservative categorical suitability model (CORE,
HIGH, MODERATE, LOW, UNSUITABLE) with its combining rule stated (a limiting
factor where a relationship is required). It is rendered on the same ramp and
never presented as population density. A defensible categorical model is
preferable to no map; a statistically fitted model is held to its declared bar
(§ "North Ground habitat models are reproducible or unpublished"), and one that
fails falls to the tier below rather than to nothing.

**One renderer, one visual language.** Every tier produces the same canonical
surface contract (species, surface kind, metric kind, evidence tier,
confidence, effective resolution, season, coverage, provenance, values,
what unshaded ground means, methodology, limitations) and draws through the one
continental pipeline — transparent, blue (lower relative opportunity) → cyan →
green → yellow → orange → red (higher), translucent, radar-like. **The numeric
meaning of a colour comes from the surface's own metadata**: red is the highest
supported opportunity for THIS species under THIS evidence, never an absolute
density comparable across species. A measured density states its metric
separately.

**Confidence is shown, never hidden.** Two equally smooth maps can rest on very
different evidence, so every surface exposes what it represents, its tier, a
categorical confidence (HIGH, MODERATE, LIMITED) decided by declared rules,
its resolution, sources, season, model version and limitations, compactly in
the map's own key. No numerical confidence is shown unless statistically
justified.

**Precomputed, never live.** Surfaces are built and certified ahead of time;
opening Hunt fetches a certified artifact and renders it. Nothing is fitted and
no occurrence service is queried when a hunter selects a species.

**Protected and non-quarry species get no hunter-facing map**, whatever
occurrence data exists; eligibility decides, as §16 and the eligibility
allowlist already require.

#### Every species, every season, end to end

*Decided 2026-09-30 (owner addendum). These make "every species has a map"
measurable and keep it honest as the universe grows.*

- **The denominator is live.** The universe is derived at run time from the
  catalogue and the canonical take eligibility, never a typed count, an
  allowlist or a second registry that can fall behind. The coverage module
  consumes that decision and never redefines it. `eligible − covered` (covered =
  a served surface or a genuine blocker) must be empty in CI;
  FULLY_PRODUCTION_REACHABLE is reported separately as X / Y.
- **Each species is its own work.** Its own profile, range, reading of its
  published habitat statement, artifact, provenance and certification. Two
  species whose surfaces are identical, or whose ranges came from one read of
  records, fail the gate unless a documented reason says why.
- **Range-only is a recorded fallback.** T5 is preferred wherever the published
  habitat statement names land, water or terrain; every T6 records why T5 was not
  defensible, and the report separates range + habitat with useful internal
  variation from range-only.
- **Records draw the range and never the value.** Occurrence records decide only
  whether ground is inside the range; where more people report wildlife never
  becomes where there are more animals. Each family states how its records are
  biased, and a range the records cannot support (another species filed under
  the name, no established population) is declined with that reason.
- **Evidence is used at its publisher's aggregation, never at the size it was
  drawn.** A service that aggregates records into cells and draws each cell as a
  smaller square has published the cell, not the square; the cell's size is
  recorded with the read and is the source resolution the surface states.
- **A range edge that stops where recording stops says so.** Absence of records
  is informative only where the species' kind of animal is recorded at all.
  Where the reads hold almost nothing of any hunted animal of the same group,
  the edge is where recording stops; the surface says so in words and the
  coverage report lists it as a geographic gap. Records never extend a range
  into ground nobody recorded — that would be inference, not evidence.
- **Seasonal truth.** Whether a bird moves between seasons is declared once, from
  North Ground's own published profile, quoted. Every surface declares the months
  it speaks for — all year, the breeding season, or the hunting season — and Hunt
  asks for the month of the hunt date (the month only; nothing legal travels with
  it). A breeding survey stands all year only for a bird that stays; a bird that
  moves is drawn in the hunting months from hunting-season records. Where no
  surface describes the month asked, the nearest season's is drawn and the key
  says so in words.
- **Four states, never mixed.** A measured zero, no data, modelled unsuitable and
  outside the range stay distinct from the artifact through the API, packing and
  renderer. Unsuitable and outside are drawn as nothing; a measured zero keeps
  its own neutral.
- **Masks and edges.** A terrestrial profile never paints open water, sea, ice or
  town it does not name; aquatic, marine and wetland profiles name their own. No
  smoothing paints past the supported range or into unsuitable ground, and it is
  tested.
- **Islands survive.** A coarse view takes the mean of a block's found cells, so
  an isolated population survives every level of detail and zooming in recovers
  it exactly.
- **Honest resolution, three ways.** Source, model and display resolution are kept
  apart and shown; the display is never read finer than the model.
- **Confidence from evidence, with its reason.** Range evidence, habitat
  concordance of the records, seasonal applicability, source age and resolution
  decide it, and the stored rule names which held. A habitat profile is never
  HIGH, because it measures no animals.
- **Staleness is declared and reported.** Each input's age is counted against
  rules declared once per kind of input; a surface is as current as its oldest
  input, and the key and the coverage report say so.
- **Composition is explicit.** The strongest surface for the season is PRIMARY; a
  weaker one is COMPLEMENT_BEYOND, drawn only where every stronger surface is
  silent, so unlike metrics never share ground. Promotion (T6 → T5 → T3 …) keeps
  every lower tier certified and serving beyond the stronger one; it is tested as
  a pure rule.
- **Coverage means reachable.** Profile → artifact → certified → registered →
  API served → Hunt selectable → requested by the client → rendered → production
  reachable. A species counts at a step only if it reached every step before it,
  and production reachability is established by a browser against production:
  the right species and month requested, a canonical reply, its layer drawn, and
  nothing of another species left on the map.

### Evidence class is preserved, never normalised away

Every dataset declares which class its metric belongs to — absolute density,
abundance, relative abundance, harvest, observation counts, or another — and
that class survives into provenance and into what the interface says. The
renderer may normalise values for visual intensity WITHIN one compatible
dataset and species; it may never normalise away what the number is.

**Where an authority publishes an absolute density, it is preferred over
harvest as heat evidence.** Harvest measures hunting; density measures animals,
which is what the hunter asked. Alberta's animals/km² supersedes its harvest
count at the same resolution, and carries the authority's confidence interval,
survey year, methodology and geography with it.

Provenance additionally carries **the season or time of year the evidence
represents**. A May breeding survey and an autumn hunting distribution are
different facts, and a layer that looks like a hunting map while answering a
breeding question is the most misleading artefact this section exists to
prevent.

The heat states are explicit and distinct: high, low, observed presence,
unsurveyed or no evidence, and stale. **No heat never means no animals.**

It answers:

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

## Species evidence architecture

*Decided 2026-09-22.*

Every statement Hunt makes about where animals are rests on evidence of a
declared kind, at a declared resolution, from a declared date. The contracts are
in `src/lib/hunt/intelligence/`; they are deterministic, server-side, and no
surface may reach around them.

**The governing rule: the resolution of a visualisation may never exceed the
resolution of its evidence.** A province-wide estimate is never painted per
management unit, and a range polygon is never shaded into hotspots. Precisions
that do not nest — a county and an ecoregion — are refused rather than ordered.
The vocabulary is the spatial registry's own geography LEVEL (ZONE,
SPECIES_ZONE, JURISDICTION, COUNTY), extended for grids, rasters, polygons,
corridors and points; a grid or raster without its publisher's cell size is a
shape, not a resolution.

**Five coexisting evidence tiers**, which never replace one another: measured
and reported by the authority; estimated by the authority; known range; a North
Ground habitat model; and context about the place. Each tier declares what it
may be used to CLAIM and what it may never say. Harvest is a record of hunting,
not a count of animals. Range says occurs somewhere in here, never more here
than there. Suitable habitat is not presence, abundance or density. Public land
and access are never evidence about an animal.

**A rate travels with its denominator or it is not published.** Only three
divisions are declared, each stating what the result means. A success rate is
the share of hunters who took an animal, so it is published only where the
authority published it — harvest over hunters is harvest per hunter and is
labelled that. A population estimate comes only from the authority's own survey
or model. A rate is never taken across geographies that do not nest. These rules
bind labels as well as arithmetic, because a legend is where a total quietly
becomes a rate.

**When evidence applies is separate from when it was measured.** Evidence does
not expire; it ages, and its age is stated. What goes stale is North Ground's
confidence that it is still the current published figure. A period that has not
begun is never shown as though it had.

**Coverage is machine-readable and always says something.** AVAILABLE, PARTIAL,
STALE, RESTRICTED, UNRESOLVED, UNAVAILABLE or IN_RESEARCH, mapped to the
registries already in use rather than forked. A layer that cannot paint explains
why, because a blank map reads to a hunter as "there are no animals here".
UNAVAILABLE is a finding about the data; IN_RESEARCH means nobody has looked.

**North Ground habitat models are reproducible or unpublished.** Every input is
named with the hash of the exact data used, the combining rule is stated, and
the output is no finer than the coarsest input. Where the research supports only
qualitative associations the model stays classified and says so — and a
classified model is publishable (§ "Every Hunt-eligible species has a map");
where it supports weights, every weight is written down and sums to one. A model
whose inputs may not be stored cannot promise to be re-runnable and says so.

**Sensitive locations are coarsened or withheld, visibly.** The policy is
source-declared, never guessed, and the contract exists before any
field-observation feature may use it. A licence refusal and a protection
refusal both surface as RESTRICTED rather than as silence.

**Selection is explainable by construction.** The layer drawn is the strongest
tier that can carry the claim at the resolution requested on the date asked;
every rejected candidate keeps its reason, and the "Why am I seeing this?"
record is produced by that same decision rather than written separately. It
carries what is shown, the authority, when it was measured, how finely it
describes the ground, what it cannot tell you, and what was not used. It never
carries a legal status.

**Requests are viewport-scoped.** Bounds and a feature ceiling are part of the
question, not an optimisation; no national evidence dataset is sent to a
browser.

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

- **HUNTING** — Species Heat, Open Seasons, Management Zones
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

## Reading, deriving and archiving are three different rights

*Decided 2026-09-30 (owner). This supersedes any model in which one
licence flag decides whether a source may be used at all.*

**"No explicit reuse terms found" does not mean "North Ground may not use this
authority's regulations."** Collapsing those is the over-strict error §8 names,
and it is invisible: a jurisdiction reported blocked looks identical whether an
authority refused us or nobody asked. Eight U.S. states were reported
LICENCE_BLOCKED on unstated terms while nothing actually refused us.

Three capabilities are recorded separately and never collapsed:

1. **LIVE AUTHORITATIVE READ** — may North Ground retrieve and read the
   authority's current public regulation page or document, for extraction and
   verification?
2. **DERIVED REGULATORY FACTS** — may North Ground store the structured facts
   derived from it: season dates, species, zones, legal hours, limits, permit
   and tag requirements, weapon restrictions, residency conditions, with source
   URL, retrieval date and provenance?
3. **SOURCE ARCHIVAL OR REPUBLICATION** — may North Ground store, mirror,
   redistribute or reproduce substantial portions or full copies of the
   authority's material?

A source therefore records `accessState`, `reuseState`, `archiveState`,
`derivedFactsState`, `authorityLevel`, `retrievalMethod`, `sourceUrl`,
`lastVerified`, `termsUrl` and `termsStatus` independently, plus a
`contentHash` where a permitted snapshot exists. The common and previously
unrepresentable case is: publicly readable, terms unstated, archival
unconfirmed, derived facts usable, primary government authority.

Where an authority publishes its regulations publicly and no reuse terms have
been located, North Ground **may derive and maintain structured regulatory
facts with full attribution**, and stays conservative about storing or
republishing substantial source content. Never invent a licence. Never label an
authority CC0 or public domain unless that is established. Never store a full
local copy merely because the page can be read.

**This concerns facts, not prose.** §8 already requires the rule rather than a
copied paragraph — "Season: 17 October – 27 February", not the guide's
sentence. Minimal traceable quotation stays correct where the authority's own
words are the fact.

**It does not unblock geometry.** A polygon dataset cannot be reduced to a
derived fact — storing it IS archival — so the licence review above still
governs spatial data, and the standing decision that U.S. hunting geography is
live-service only is unchanged.

## A blocked reader is a technical problem, not a legal finding

An authority whose site refuses our automated client has not thereby made its
regulations unusable. That is a source-acquisition failure and it is recorded
as one.

Authoritative fallbacks are attempted in order: the official HTML page, the
official PDF or guide, the official regulations or code endpoint, an official
alternate domain, an official API or data endpoint, browser-rendered retrieval
within the site's normal public access, and only then a manually reviewed
authoritative snapshot with provenance.

**Never bypass authentication, CAPTCHAs, access controls, robots restrictions
or any other deliberate technical restriction**, and never substitute an
unofficial third-party site as regulatory truth because the official reader was
refused. Where every permitted route genuinely fails, the record names that
exact technical limitation rather than implying the regulations are unavailable.

## Regulatory confidence and reuse rights are independent dimensions

The engine still fails closed on FACTS. A reachable source that does not
establish whether a season is open is UNKNOWN. But a source that clearly
establishes the season does not become UNKNOWN because its page carries no
licence notice. Missing copyright labels never erase independently established
regulatory facts.

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
