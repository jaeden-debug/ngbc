# North Ground Master Content Roadmap

Status: v1, 2026-09-20. Owns **what gets written, in what order, and when a page is done**.

It does not redefine schema. Identity lives in [ENTITY-TAXONOMY.md](./ENTITY-TAXONOMY.md), block shapes in [APP-BLOCKS.md](./APP-BLOCKS.md), the publication gate in [CONTENT-QUALITY.md](./CONTENT-QUALITY.md), paths in [ROUTE-REGISTRY.md](./ROUTE-REGISTRY.md). Source data is the CSV registry in `research/hunting/`.

## The nine libraries map to existing entity types

No new registries. The editorial libraries are views over the contract already built:

| Library | Entity types | Route family |
| --- | --- | --- |
| 1. Species | `species`, `species_group` | `/hunting/species/…` |
| 2. Species × location | `species` + `jurisdiction` + `management_zone` | `/hunting/{country}/{jur}/{species}` |
| 3. Hunt type | `hunt_type`, `method` | `/hunting/guides/…` |
| 4. Conditions | `condition`, `weather_condition`, `temperature_band` | `/hunting/conditions/…` |
| 5. Clothing | `clothing_system` | `/hunting/clothing/…` |
| 6. Pack & equipment | `pack_template`, `equipment_category`, `equipment_item` | `/hunting/packs/…`, `/hunting/gear/…` |
| 7. Skills & safety | `skill`, `safety_topic` | `/hunting/skills/…` |
| 8. Gear | `equipment_category`, `product`, `field_test` | `/hunting/gear/…`, `/hunting/field-tests/…` |
| 9. Regulations & location | `country`, `jurisdiction`, `management_zone`, `regulation_topic` | `/hunting/{country}/{jur}` |

## Page composition pattern

Every informational resource renders in this order. Sections with nothing material to say are **omitted, not padded**.

1. **Direct answer** — 40–80 words, resolves the query. No preamble, no history, no "hunting has long been."
2. **Key facts** — scannable card. Numbers, units, dates, limits, conditions.
3. **Interactive answer** — Hunt tool embed where location/date/species changes the answer.
4. **What you need to know** — material nuance, exceptions, conditions only.
5. **Practical guidance** — what to wear, do, pack, watch for.
6. **Sources** — primary sources, jurisdiction, effective date, last verified.
7. **Next question** — 3–5 tightly relevant links, chosen by relationship edges.

Section 1 maps to the `quick_answer` block. Sections 5 and 4 supply the typed tips (`clothing_tip`, `packing_tip`, `weather_tip`, `habitat_tip`, `identification_warning`, `field_care_tip`, `navigation_tip`, `seasonal_behavior`, `safety_note`). Authoring writes blocks; the page is their composition. The app retrieves the same blocks by `ContextRequest`. One paragraph, three consumers.

## Density rule

> Answer the intent immediately. Include every fact that materially helps the reader decide. Delete every sentence that does not.

- No target word count. 550 words is complete if the intent is resolved; a regulatory comparison may need 1,800.
- Every paragraph must answer a question, give evidence, explain an exception, support a decision, or lead to a next action.
- **Thin** is an unsourced generality: "Wear warm clothing and check local regulations."
- **Concise and substantial** changes what the reader does: "Winter grouse hunting is active. Dress lighter while moving and carry insulation for stops rather than dressing for your coldest stationary temperature from the start."
- One fact, one home. A fact gets one canonical page; every other page gives the short answer and links.

## Production waves

Ordered by dependency, not by appetite. Each wave is gated on the previous.

**Wave 0 — Render layer.** No content ships without it. Route handlers for the families above, the page pattern as components, `ContentBundle` → page adapter, JSON-LD per resource type, sitemap wiring. *Blocks everything.*

**Wave 1 — Canonical anchors (~24 pages).** The pages every later page links to.
- 11 `WRITE_NOW` species from `content-opportunity-matrix.csv` — identity pages whose range limits are already explicit.
- Conditions: −30, −20, −10, 0 °C; cold rain; wet snow; high wind.
- Activity split: stationary vs active (the distinction that makes clothing advice correct).
- Skills: navigation, trip plan, hypothermia recognition.

**Wave 2 — Clothing and packs (~18).** Temperature × activity × duration systems, and the day/half-day/winter/overnight/remote pack templates. Built from reusable equipment entities so the app generates checklists rather than reading 50 hand-written lists.

**Wave 3 — Hunt types and methods (~14).** Upland, big game, waterfowl, small game, predator, turkey; still hunting, spot-and-stalk, stand, calling, tracking. These give the app its `hunt_type` axis.

**Wave 4 — Jurisdictions (Canada first, 14).** The regulatory *system* per jurisdiction: zones, licences, terminology, authorities, legal-time framework, resident/non-resident, official sources. Season records stay structured data underneath — pages explain the system, the tool answers legality.

**Wave 5 — Species × jurisdiction.** Only where material information exists beyond both parents. Start with the 11 Wave-1 species × the jurisdictions Hunt actually supports. This is the long-tail SEO layer and the easiest place to generate sludge; the materiality test in ROUTE-REGISTRY is the gate.

**Wave 6 — Field evidence.** Original field tests, measurements, photography. The moat. Nothing here can be researched from a desk.

**Wave 7 — US expansion, then remaining species by keyword priority.** Taxonomy is already global (127 entities); publication order follows search demand, not alphabet.

## Definition of done

A page ships only when all hold:

- [ ] Resolves its primary query in the first 80 words
- [ ] Every regulatory claim carries a source ID, jurisdiction and verified date — or is deferred to the tool
- [ ] `quick_answer` block written by hand, not generated from the body
- [ ] At least one typed app-tip block with correct `applicability`
- [ ] 3–5 outbound internal links via relationship edges; no orphan
- [ ] Media accurate to the species/condition, or absent
- [ ] Passes `npm run validate:content:strict`
- [ ] `lastReviewed` set; expiry set for anything seasonal

## Media rule

Hard requirement from [MEDIA-STANDARD.md](./MEDIA-STANDARD.md), restated because it is the easiest rule to break at volume:

**Never illustrate a species with a different species.** A ruffed grouse page showing a spruce grouse is a factual error that destroys citability, and on an identification page it is a safety failure. Stock libraries mislabel game birds constantly.

If an accurate asset does not exist, ship without an image. Absent beats wrong. Record the gap in `research/hunting/media-needs.csv` so field work can fill it.

## Regulatory boundary

Restated because it is the one mistake that would create legal exposure:

Editorial content explains **what an animal is and how hunting it works**. The tool owns **what is legal here, now**. A `legal_note` block may explain or link to a regulatory result; it may never determine OPEN/CLOSED. Missing regulatory data fails closed — it never falls back to inferred legality.

## Dependencies on the Hunt build

1. All editorial references resolve through canonical IDs, never hard-coded URLs or prose. Already enforced by `src/lib/content-contract/ids.ts`.
2. Hunt consumes blocks via `ContextRequest`, not by scraping pages.
3. Route strings are resolved from the registry, never constructed.
