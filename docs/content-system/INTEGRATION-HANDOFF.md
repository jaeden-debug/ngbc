# Integration Handoff

## What now exists

The v1 shared contract is defined in this directory. TypeScript representations live in `src/lib/content-contract/types.ts`, identity helpers in `src/lib/content-contract/ids.ts`, and a storage-neutral normalized-bundle validator in `scripts/validate-content-contract.mjs`.

The first integrated slice now exists. `content/published/en-CA.json` is a strict-valid published bundle; `src/lib/content/repository.ts` is the storage-neutral in-process boundary; `src/lib/hunt/evaluate.ts` composes official zone resolution, deterministic regulation, bounded forecast context, and contextual App Blocks while keeping those layers separate. The representative public resources are `/tools/season-finder` and `/hunting/species/ruffed-grouse`.

## Authoritative locations

| Concern | Current authority |
| --- | --- |
| Product direction | `CLAUDE.md` |
| Operational state | `docs/PROJECT-STATE.md` |
| ID/entity rules | `docs/content-system/ENTITY-TAXONOMY.md` and `ids.ts` |
| Resource/species/source/API shapes | `CONTENT-CONTRACT.md` and `types.ts` |
| Blocks/matching | `APP-BLOCKS.md` and `types.ts` |
| Relationship semantics | `RELATIONSHIPS.md` |
| Normalized validation | `scripts/validate-content-contract.mjs` |
| Published normalized bundle | `content/published/en-CA.json` |
| Content repository boundary | `src/lib/content/repository.ts` |
| Regulatory/zone/weather composition | `src/lib/hunt/` |
| Public Hunt evaluation boundary | `src/app/api/hunt/evaluate/route.ts` |
| Canonical species pattern | `src/app/hunting/species/[species]/` |

Canonical IDs now live in the published bundle for the first slice. A durable authoring store has not been selected; any future CMS/file authoring adapter must export this normalized shape and preserve the existing IDs instead of creating a second runtime registry.

## Required next integration sequence

1. Keep `content/published/en-CA.json` strict-valid with `npm run validate:content:published`.
2. Decide the authoritative authoring store and create one adapter/exporter to the normalized bundle; preserve all shipped canonical IDs.
3. Expand regulatory records only after claim-level primary-source review and representative zone/date tests.
4. Add new page families through the URL resolver and repository; never construct fallback paths in consumers.
5. Keep Hunt's regulatory result, environmental context, and knowledge result independently typed and labeled.
6. Replace process-local API rate limiting with a distributed implementation before high-volume production use.
7. Add source-change monitoring, reviewer workflow, and production observability without retaining precise location inputs.

## Hunt block request

Hunt should resolve coordinate/date/species inputs through its own authoritative systems, then call the content boundary with a request equivalent to:

```json
{
  "locale": "en-CA",
  "countryId": "country:ca",
  "jurisdictionIds": ["jurisdiction:ca-qc"],
  "speciesIds": ["species:ruffed-grouse"],
  "date": "2026-12-10",
  "activityId": "activity:hunting",
  "huntTypeId": "hunt_type:upland",
  "temperatureC": -18,
  "precipitation": "snow",
  "activityLevel": "high",
  "durationMinutes": 480,
  "blockTypes": ["weather_tip", "clothing_tip", "packing_tip", "safety_note"]
}
```

The returned editorial blocks are deterministically filtered/ranked. Hunt obtains OPEN/CLOSED/CONDITIONAL/UNKNOWN/CONFLICT/NEEDS_VERIFICATION from its separate regulatory engine. If Hunt already implemented a context schema, prefer an adapter at the boundary over rewriting stable Hunt logic.

## URL resolution

Consumers store IDs. Server-side URL resolution returns locale-specific canonical URLs and redirect history. Public pages use the current canonical URL; historical slugs redirect permanently without chains. Hunt-owned routes remain Hunt's responsibility. The shared contract does not freeze the candidate URL families in `CONTENT-CONTRACT.md`.

## Sources and relationships

- A resource/block references source IDs; claims map to exact supporting source IDs when practical.
- Regulatory claims require official provenance and applicable dates/jurisdiction.
- Field evidence resolves through a field-test entity/source rather than a boolean alone.
- Relationships are typed edges. Manual and derived edges remain distinguishable.
- UI modules request allowed edge types with strict limits; they do not recursively dump the graph.

## Validation usage

The validator consumes one or more JSON files containing a complete `ContentBundle` or merges bundle fragments. It checks structural and cross-reference rules and returns nonzero only in strict mode when errors exist. During migration:

```sh
npm run validate:content
npm run validate:content:strict -- path/to/exported-bundle.json
```

The default fixture proves the validator runs; it is not published content or coverage. CI should validate the content adapter's normalized export once one exists. Do not point strict mode at partially migrated authoring files without an agreed rollout.

## Compatibility questions to verify

- Does Hunt use the same canonical ID grammar and normalized units?
- Does the content implementation model blocks as records or embedded fields?
- Are locales per resource, per field, or separate records?
- Which system owns source snapshots/hashes and claim mappings?
- Does an emerging API already expose equivalent repository operations?
- How does Hunt represent overlapping jurisdictions/zones and context date/time?
- Which route registry owns canonical/legacy URLs?
- Which records are currently publication-ready versus examples/placeholders?

Record adapters and intentional deviations here and bump the contract when semantics change.

## Unfinished work

- durable CMS/file authoring adapter and normalized export workflow;
- repository persistence/caching if the published bundle outgrows in-process reads;
- broader certified jurisdiction/species coverage beyond Ontario WMU 57 / ruffed grouse / 2026;
- exact certified legal-time computation and overlapping local-rule coverage;
- distributed Hunt API rate limiting;
- localization workflow;
- source-change monitoring and reviewer administration;
- additional migrated/certified page families and blocking CI thresholds;
- analytics/observability that avoids precise-location leakage.

The first representative integration passes deterministic repository/Hunt tests, strict bundle validation, production build/SEO validation, responsive browser checks, and local runtime source/unknown-state checks. It is not yet production-certified because the current public deployment predates these routes and returns 404 for both.
