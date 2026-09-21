# Hunt Map Intelligence Foundation

Status: architecture landed locally; one real evidence dataset integrated; map UI and database migration not deployed.

## Trust boundary

Hunt holds five independent facts:

1. species opportunity;
2. regulatory status;
3. ownership;
4. access;
5. environmental conditions.

Only the canonical regulatory engine decides legal Hunt status. An opportunity result always carries `legalStatus: null`. Public ownership never supplies access or permission to hunt. A condition becomes a closure only through an authoritative order represented by the regulatory/restriction system.

## Architecture landed

- `src/lib/hunt/intelligence/types.ts` — evidence, source/licence, land/access, coverage and opportunity contracts.
- `classification.ts` — immutable `opportunity-v1` methodology: tie-aware percentile normalization, equal-weight combination, and transparent class thresholds.
- `layers.ts` — one catalogue for EXPLORE, FIND GAME and CHECK HUNT with the required **SPECIE HEAT MAP** product name.
- `planning.ts` — conservative Potential Hunting Area composition. Unknown/conditional legality produces CHECK THIS AREA; a closure or known prohibition rejects the candidate.
- `content/intelligence/source-registry.json` — machine-readable source/licence/coverage registry.
- `20260921093347_map_intelligence_foundation.sql` — service-role-only PostGIS schema for sources, datasets, evidence, land, access, layer coverage, methodology and derived scores. It is not applied to production while database/migration reconciliation is active.
- `GET /api/hunt/opportunity` — bounded server route by canonical zone and species. It receives no personal coordinate and is cacheable.
- Official-source monitoring now checks both regulatory and map-intelligence inputs and never publishes automatically.

## Real data integrated

### Ontario white-tailed deer harvest

| Field | Value |
| --- | --- |
| Authority | Ontario Ministry of Natural Resources |
| Dataset | White-tailed deer hunting activity and harvest |
| Resolution | Wildlife Management Unit |
| Temporal coverage | 2008–2025, varying by WMU |
| Current evidence | 116 WMUs in 2025; 232 component records |
| Licence | Open Government Licence – Ontario |
| Source hash | `sha256:b91f14b15ac238a0b23761ad8ba692641049b77de8355148a1605e297f514a2d` |
| Production state | PARTIAL DATA through the server API; not drawn in the map UI |

The source contains 1,983 WMU-year observations plus 18 provincial-total rows. The published 2025 evidence components are estimated total harvest and a disclosed derivative, estimated harvest per estimated active resident hunter. Both are normalized as tie-aware ranks across the 116 represented WMUs.

The authority says both harvest and active-hunter values are estimates based on a sample of resident hunters and are subject to statistical error. North Ground therefore uses MODERATE confidence, does not call the active-hunter estimate a sample size, does not call the ratio a success probability, and does not infer current animal presence.

`scripts/build-ontario-harvest-evidence.mjs` validates the schema, row counts, WMU identifiers, integer/non-negative values, harvest arithmetic, latest year and source hash. Any source change exits for human review. Unchanged rebuilds are byte-identical.

## Datasets investigated but not live

The exact machine-readable record is `content/intelligence/source-registry.json`.

| Dataset | Finding | State |
| --- | --- | --- |
| Ontario Crown land: ministry unpatented land | Correct ownership concept and Open Government Licence, but the catalogue includes additional OGDE-only features, disclaims legal parcel use, and requires service/schema/exclusion certification. | LICENCE_PENDING |
| Ontario CLUPA Provincial | Land-use policy geography; the authority explicitly says not to use it as Crown/private/protected-area boundaries. | UNAVAILABLE for ownership; rejected |
| Ontario 2025 CWD surveillance | Current official sample data, but Ontario.ca Terms of Use and field/spatial semantics require review. Samples are not detection/restriction areas. | LICENCE_PENDING |
| Ontario in-year fire perimeters | Useful condition candidate; source-specific licence/service and closure-order composition are not certified. | NEEDS_VERIFICATION |

No blocked dataset has been copied, stored in PostGIS, or rendered.

## Delivery and performance

The first endpoint returns 2,283 bytes for WMU 57. Local production measurements on 2026-09-21 were 44 ms cold and 3–5 ms warm over five requests. Its six-hour shared-cache directive is appropriate because the committed evidence changes only through reviewed rebuilds.

Large spatial layers are designed for PostGIS GiST indexes, viewport delivery, simplification/render geometry separate from source geometry, bounded results and eventual vector tiles when measured payload/render budgets require them. No new client geometry was added in this slice.

## Not yet implemented or certified

- Map mode/layer-control UI, heat rendering, dynamic legend and evidence card.
- Crown/public land geometry or cards.
- Access, habitat, range, parking, trails or boat-launch datasets.
- Potential Hunting Area geometry/intersections.
- Distance/area measurement UI.
- Snow, wildfire/closure, CWD consequence and legal-hours layers.
- Offline packages or basemap caching.
- Saved Hunt model and field observations.
- U.S. public-land data.
- Vector-tile service.

Those are architecture-supported but not production claims. Each requires authoritative sources, licence review, bounded delivery, tests and browser/performance certification before its coverage status may become VERIFIED.
