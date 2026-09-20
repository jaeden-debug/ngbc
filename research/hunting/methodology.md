# Methodology

## Research order

1. Establish every Canadian and U.S. first-order jurisdiction.
2. Identify the official wildlife authority and official hunting hub/regulation source.
3. Preserve each jurisdiction's own management-unit term.
4. Inventory official GIS before considering third-party boundaries.
5. Normalize high-priority North American species against a recognized taxonomic authority.
6. Add a species–jurisdiction relationship only when an official source names the species or an unambiguously defined regulatory group.
7. Record uncertainty and queue claim-level review.

## Source hierarchy

`PRIMARY_REGULATORY` legislation, regulations, official regulation summaries and emergency orders.

`PRIMARY_DATA` government GIS, open data and government species databases.

`AUTHORITATIVE_SCIENTIFIC` government science agencies and recognized taxonomic authorities.

`SECONDARY` reputable conservation or academic sources; useful for context, never sufficient alone for legality.

`DISCOVERY_ONLY` commercial pages, outfitters, blogs, forums and social media; never used here to establish huntability.

## Verification workflow

- `DISCOVERED`: candidate URL/entity located but contents not reviewed.
- `SOURCE_FOUND`: official source opened and its relevance confirmed.
- `PARTIALLY_VERIFIED`: claim and scope reviewed, but exceptions/effective period remain.
- `VERIFIED`: claim, scope, authority, effective period, and conflicts reviewed by a human.
- `CONFLICT`: authoritative sources appear inconsistent.
- `STALE`: source or review date is no longer suitable for current use.
- `NEEDS_REVIEW`: record is structurally useful but cannot safely be interpreted yet.

`VERIFIED` is provenance review, not legal advice or a guarantee that a season is open.

## Species evidence rule

Evidence rows describe a relationship, not a universal boolean. `DOCUMENTED_HUNTING` means the cited source explicitly includes a recreational hunting season or hunting rule for that taxon somewhere in the jurisdiction. `PERMIT_OR_QUOTA` and `PARTIAL_OR_SPECIAL` preserve constraints visible at inventory depth. A consumer still needs current rule text, date, hunter class, method, and all overlapping spatial layers.

## Federal overlap

Canada's migratory game-bird rules are federal and operate alongside provincial/territorial licensing and restrictions. The United States has a federal migratory-bird framework and annual frameworks alongside state seasons. Those sources are separate authority records and must be composed, not overwritten.

## Indigenous and subsistence frameworks

Inventory notes merely flag distinct frameworks. They do not interpret rights, beneficiaries, settlement lands, treaty scope, tribal regulation, or subsistence eligibility. Those require specialist, community- and authority-specific research.

## Maintenance

- Retain stable entity IDs through common/scientific-name changes.
- Record scientific synonyms as aliases.
- Preserve source records when superseded; point to the replacement.
- Re-check annual summaries before each season and emergency-update pages during the season.
- Do not promote a record merely to improve coverage statistics.
