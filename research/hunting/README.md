# Hunting authority and species research

Status: research foundation; not production regulatory data.

This directory inventories hunting jurisdictions, authorities, official sources, GIS endpoints, species identities, aliases, and species–jurisdiction evidence. It is deliberately separate from the Hunt rules engine and the editorial content bundle.

## Safe-use boundary

- A species record establishes biological identity, not legal huntability.
- An evidence row establishes what a cited official source documents. It does not answer whether a hunt is open for a person, point, method, or date.
- `NOT_FOUND` never means prohibited. `PROTECTED_OR_CLOSED` requires direct official evidence.
- Only `VERIFIED` records have completed claim-level review. Most first-pass records are `SOURCE_FOUND` or `NEEDS_REVIEW`.
- Indigenous, treaty, Aboriginal, tribal, and subsistence frameworks are not flattened into ordinary recreational rules.

## Files

| File | Purpose |
| --- | --- |
| `jurisdictions.csv` | Canada, U.S. federal, provincial, territorial, state, and D.C. inventory |
| `authorities.csv` | Current official wildlife/regulatory bodies and roles |
| `regulatory-sources.csv` | Official regulations, licensing, species, and emergency-update sources |
| `gis-sources.csv` | Official management-boundary and open-data discovery records |
| `species-groups.csv` | Non-legal grouping concepts |
| `species-master.csv` | Stable North American species identity registry |
| `species-aliases.csv` | Locale- and region-aware names; ambiguity is explicit |
| `species-jurisdiction-evidence.csv` | Source-backed hunting-context relationships |
| `research-queue.csv` | Prioritized verification and content-research work |
| `source-gaps.csv` | Missing or weak official-source coverage |
| `media-needs.csv` | Identification-media needs; no downloaded media |
| `global-expansion-candidates.md` | Planning-only international candidates |
| `methodology.md` | Evidence and verification method |
| `data-dictionary.md` | Schemas and controlled vocabularies |
| `validate.py` | Referential/data-quality checks with no network dependency |
| `COVERAGE-REPORT.md` | Counts and coverage limitations |
| `HANDOFF.md` | Hunt/content integration boundary |

## Contract mapping

The inventory follows `docs/content-system/ENTITY-TAXONOMY.md`:

- species IDs: `species:<stable-key>`
- jurisdiction IDs: `jurisdiction:<iso-derived-key>`
- source IDs: `source:<authority-document-key>`
- group IDs: `species_group:<stable-key>`

The shared content contract is currently an uncommitted concurrent workstream. These CSVs therefore preserve proposed canonical IDs but do not modify or duplicate that contract. Integration must validate IDs against the finalized contract.

## Validation

Run:

```bash
python3 research/hunting/validate.py
```

The validator checks IDs, ISO country codes, enums, dates, duplicate URLs/scientific names, and orphan references. It does not certify legal interpretation or URL availability.
