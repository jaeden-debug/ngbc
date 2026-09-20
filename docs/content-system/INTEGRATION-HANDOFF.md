# Integration Handoff

## What now exists

The v1 shared contract is defined in this directory. TypeScript representations live in `src/lib/content-contract/types.ts`, identity helpers in `src/lib/content-contract/ids.ts`, and a storage-neutral normalized-bundle validator in `scripts/validate-content-contract.mjs`.

This work does not claim that a CMS, registry, content repository, Hunt adapter, public API, or migrated content exists.

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

Canonical IDs do not yet live in a production registry. The stitching agent must identify the content agent's emerging storage and implement one adapter/exporter that produces `ContentBundle`. Do not create a second registry if that agent already has one; map its stable IDs to this grammar or document/version an intentional incompatibility.

## Required integration sequence

1. Inspect Hunt and content branches/current work before editing; their architecture may have advanced.
2. Compare existing IDs, lifecycle values, source model, and applicability fields against contract v1.
3. Decide the authoritative authoring store and create an adapter to the normalized bundle.
4. Run `npm run validate:content` in warning mode and triage output by page family.
5. Implement a `ContentRepository` behind the interface in `CONTENT-CONTRACT.md`; start in-process unless a separate runtime needs HTTP.
6. Make public routes resolve IDs to current canonical URLs rather than embedding route logic in content records.
7. Make Hunt send canonical context IDs/normalized units to `getContextualBlocks` and render `matchReasons`, locale/source/last-reviewed data where the UI requires trust context.
8. Compose regulatory results and editorial blocks as separate labeled payloads. Never use block absence/presence as a legal signal.
9. Certify migrated families, then promote their validation rules from warning to blocking.

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

- production entity/source/resource registries;
- CMS/file adapter and normalized export;
- content repository implementation and persistence;
- public content routes and canonical URL resolver;
- Hunt adapter and end-to-end context tests;
- localization workflow;
- source-change monitoring and reviewer administration;
- migrated/certified content and blocking CI thresholds;
- analytics/observability that avoids precise-location leakage.

Integration is complete only after representative content and Hunt contexts pass deterministic tests, sources/unknown states render correctly, canonical redirects work, and the content/Hunt owners approve the boundary.
