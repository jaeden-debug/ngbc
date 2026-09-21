# United States hunting regulation and GIS reconnaissance

Status: **research only**. This directory does not claim product, legal, geographic, or regulatory coverage for any United States jurisdiction. Canada remains North Ground's first mature national production target.

Reviewed: 2026-09-20

## Deliverables

- `source-manifest.csv` is a national manifest of the official state, District of Columbia, and federal discovery hubs already held by the research database, plus deeper candidate sources for the eight Wave 1 states.
- `state-coverage-matrix.csv` contains exactly the 50 states and D.C. It distinguishes national discovery from deep Wave 1 reconnaissance and records blockers rather than promoting discovery into coverage.
- `build-manifests.mjs` reproducibly derives the national rows from the shared research catalog and supplies the deeper Wave 1 findings.
- `validate.mjs` enforces jurisdiction completeness, foreign-key references, conservative status values, and minimum Wave 1 depth.

Run:

```bash
node research/hunting/us/build-manifests.mjs
node research/hunting/us/validate.mjs
```

## Certification boundary

An official hunting landing page is evidence that an authority and source family exist. It is not evidence that North Ground has captured the controlling annual artifact, all amendments, a legally usable boundary dataset, or the complete decision model. The national rows outside Wave 1 therefore remain `DISCOVERY_ONLY`.

Even the Wave 1 rows are not implementation-ready. They identify concrete source families and structural requirements, but GIS service contracts, reuse terms, annual versioning, amendment precedence, and representative fixtures still require certification.

## Wave 1 findings

| Jurisdiction | Primary model | Boundary/authority issue | Dominant engine gap |
|---|---|---|---|
| Alaska | GMU/subunit plus hunt number/type, residency, permit or harvest ticket, and subsistence | Emergency orders and a parallel federal subsistence regime can supersede or diverge from state planning data | Dual authority scope, eligibility, hunt IDs, mutable emergency rules |
| Colorado | Eight-character hunt code encodes species, sex, GMU, season, and method; limited and OTC licensing | Brochures have corrections and hunt codes may bind one or more units | Hunt-code object, draw/quota lifecycle, correction precedence |
| Wyoming | Species hunt area plus license type and quota | Official maps explicitly defer to written legal descriptions; area systems vary by species | Species-specific geometry, written-description authority, access permits |
| Montana | Species regulation plus hunting district and license/permit | Planner is guidance; commission-adopted district descriptions control and may be species-specific | Species-bound district versions, permit/draw IDs, access overlays |
| Idaho | GMU/elk zone plus general or controlled hunt number and tag | Controlled hunts may use unit portions/combinations; planner defers to rule booklets | Hunt-number/unit expression, parallel geographies, quotas |
| Utah | Hunt/permit code plus unit and program (general, limited-entry, CWMU) | Guidebooks publish dated corrections; CWMU and extended-archery areas add independent geography | Permit code, correction ledger, program-specific boundaries |
| Arizona | GMU plus four-digit hunt number and permit-tag/draw | Booklets and commission orders must be composed; map service contract is unresolved | Hunt numbers, permit-tag taxonomy, order precedence, draw metadata |
| New Mexico | GMU plus hunt code/license and public/private-land program | Downloadable GMU shapefile/KMZ is dated October 2017 and the statewide map disclaims precise-boundary use | Geometry provenance, land authorization, hunt code, tribal scope |

These findings come from current official agency sources. Examples include Alaska's hunt-number/GMU maps, Colorado's 2026 hunt-code definition, Wyoming's map disclaimers and species chapters, Montana's commission-adopted legal descriptions, Idaho's regulation-backed Hunt Planner, Utah's versioned correction log, Arizona's four-digit draw hunt numbers, and New Mexico's official GMU download page.

## Architectural implications

### 1. A hunt is not a season row

The shared rule model needs a first-class `hunt` or `opportunity` entity. At minimum it must support:

- an authority-issued identifier such as hunt number, hunt code, license type, or permit code;
- one or more species or regulatory classes;
- sex/age or legal-animal restrictions;
- one or more geographic expressions, including partial and combined units;
- method, season, residency, eligibility, quota, draw, tag, and bag constraints;
- source/version lineage and amendments.

Encoding these fields only in prose or overloading `zone_id` would make Colorado, Alaska, Arizona, Idaho, New Mexico, Utah, and Wyoming lossy.

### 2. Geography is typed, versioned, and species-bound

The future geography contract should identify `system_id`, `feature_id`, `effective_from`, `effective_to`, source authority, legal-standing classification, and applicable species/program. A state can simultaneously have GMUs, elk zones, species hunt areas, private-land programs, access properties, refuge stations, and emergency closures. The geometry used for map display may not be legally authoritative.

Recommended legal-standing enum:

- `CONTROLLING_GEOMETRY`
- `DERIVED_FROM_LEGAL_DESCRIPTION`
- `PLANNING_GUIDANCE`
- `REFERENCE_ONLY`
- `UNRESOLVED`

No Wave 1 GIS source should be promoted to production until its license or reuse terms, stable download/service endpoint, field dictionary, effective version, and relationship to written legal descriptions are recorded.

### 3. Draw and quota systems need their own lifecycle

Quota, application window, choice rank, preference/bonus points, award, surrender, leftover/secondary draw, OTC availability, and tag validity are different facts. They change on different schedules and should not be flattened into season rules. The legal hunting opportunity can exist while inventory is unavailable to a particular hunter.

### 4. Method taxonomy must be jurisdiction-aware

`archery`, `muzzleloader`, and `rifle` are not sufficient universal atoms. Jurisdictions define associated methods, short-range weapons, crossbow eligibility, falconry, shotgun constraints, weapon-specific seasons, and equipment restrictions differently. Store a canonical method family for search plus the jurisdiction's exact regulatory class and source text.

### 5. Federal and state rules compose; they do not replace each other

Migratory birds require a federal framework plus the state or tribal season. Hunting on National Wildlife Refuges and other federal lands can add station-specific restrictions and permits. Federal land ownership alone does not determine the applicable hunting rule; the product needs explicit rule scopes and precedence.

A safe evaluation shape is:

1. determine sovereign/regulatory authority and hunter eligibility;
2. evaluate federal species framework when applicable;
3. evaluate state or tribal season and licensing rules;
4. evaluate land-manager and site-specific restrictions;
5. apply emergency closures, corrections, and later amendments;
6. preserve all contributing citations in the Hunt brief.

### 6. Tribal hunting is not a state overlay

Tribal governments are separate authorities. Reservation hunting, treaty rights, ceded-territory rules, and tribal member/nonmember licensing cannot be inferred from a state GMU or land-ownership polygon. This reconnaissance records tribal dependencies as blockers; it does not assert tribal coverage. Future work requires government-specific authoritative sources and explicit sovereign scope.

### 7. Alaska subsistence needs an explicit parallel regime

Alaska demonstrates why `resident` is not an adequate eligibility model. State subsistence rules and federal subsistence rules can differ by land, community/rural eligibility, species, unit, and permit. They require separately sourced rule sets whose results may be presented together without merging their authority.

## Waterfowl composition

Waterfowl and other migratory-game-bird answers need a source chain rather than a single state season row:

`USFWS annual framework/order → state or tribal adopted season → zone/unit → land-manager or refuge rule → current closure/amendment`

The federal source establishes outer frameworks and federal requirements; states and tribes select seasons within those bounds; refuge stations or other land managers can impose additional restrictions. Every displayed answer should retain citations for each applicable layer.

## Recommended implementation sequence after Canada

1. **Contract spike:** add opportunity/hunt identifiers, typed/versioned geography, eligibility, quota/draw, amendment precedence, and multi-authority citations without publishing U.S. coverage.
2. **Source certification pilots:** Idaho and New Mexico for downloadable GIS provenance; Colorado for hunt-code parsing; Wyoming for written-description authority; Alaska for dual subsistence authority.
3. **Fixture gate:** certify at least one ordinary, one draw/quota, one partial/multi-unit, one land-overlay, one amended, and one federal-composition fixture per pilot.
4. **Operational gate:** prove annual snapshotting, correction detection, geometry versioning, and rollback before exposing a state.
5. **Expansion:** proceed in source-compatible waves based on certification results, not geographic adjacency or raw source volume.

## Explicit non-claims

- No U.S. row is production-ready.
- No GIS source in this directory is approved for production reuse.
- No tribal government or treaty-rights regime has been researched to coverage standard.
- No federal-land polygon by itself establishes hunting legality.
- D.C. is recorded as unavailable pending legal confirmation, not as a categorical legal opinion.
- This work does not alter Hunt UI, Canadian regulation code, Supabase, PostGIS, or public coverage claims.
