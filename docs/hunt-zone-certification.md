# Hunt zone certification

This is the release gate for every served management-zone layer. A matching
count is not certification.

## Authority-first evidence

The government layer is always the expected side. North Ground's PostGIS rows,
resolver, map API and labels are systems under test. A run must:

1. read the complete authority layer with a count/identifier completeness check;
2. compare every official identifier and reject missing or invented units;
3. compare polygon, ring, hole and vertex counts, bounding box, area and a stable
   full-geometry fingerprint for every unit;
4. derive independent interior, second-interior, both-sides-of-boundary,
   multipart and representative-hole points from the authority geometry;
5. resolve every point through the production membership path with no
   disagreement or unresolved case;
6. verify every official identifier is drawable through the public map API at
   zooms 4, 7 and 10;
7. test at least one independently geocoded real place per jurisdiction through
   both the authority point service and North Ground;
8. fail closed on a short, saturated, malformed or unavailable provider response.

An invalid authority geometry is never silently accepted. `ST_MakeValid` is
permitted only in staging when the repaired polygon is valid and its symmetric
difference is no more than one square metre. The authority error, method and
measured difference are persisted. Material movement fails the run.

Boundary-distance certification is separate from membership. Sparse GeoJSON
segments are segmentized before geography distance measurement so PostGIS does
not reinterpret the authority's straight coordinate edge as a long great-circle
arc. A resolver change must preserve every inside-edge membership sample.

## Commands and artifacts

```sh
node --import tsx scripts/audit-zone-certification.mjs --all
node scripts/audit-boundary-distance.mjs
node --import tsx scripts/audit-production-zone-map.mjs --base https://www.northgroundbushcraft.com
```

Compact results live in `fixtures/hunt/*-zone-certification.json`,
`boundary-distance-certification.json`, and `production-map-certification.json`.
They contain counts, identifiers, hashes, normalization evidence and failures,
not copied government polygons.

Certification is revoked when an authority content hash moves, an inventory or
geometry comparison fails, a point disagrees, a map response is incomplete, or
the production commit/deployment does not match the audited code.
