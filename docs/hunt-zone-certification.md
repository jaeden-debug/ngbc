# Hunt zone certification

This is the release gate for every served management-zone layer. A matching
count is not certification.

## Service parity is necessary and not sufficient

Everything below treats the authority's own GIS service as the expected side.
That is right about DRAWING and wrong about LAW, and the difference is not
theoretical: Michigan's open-data layer still publishes deer management units
351 and 352, stamped with the current year and edited the day before they were
checked, which Michigan's own 2026 regulations say "have been rescinded"
(verified 2026-09-23). Every step below passes on that layer. A hunter would be
shown a rescinded unit as current, certified.

These are **two certifications, not one widened one** — the same reasoning
that split `serving` from `rulesServing`. A layer carries two independent
facts:

- **MAP CERTIFIED: SERVICE** — North Ground draws what the authority's service
  publishes. Everything below is the evidence for this, and it is the only
  question the existing audit can answer.
- **MAP CERTIFIED: LAW** — the service itself agrees with a regulatory product:
  the regulations summary, the hunting guide, or the regulation. The unit LIST
  is the thing to check, because that is what a rescission changes: does the
  authority's law still recognise every unit its GIS returns, for the licence
  year being served?

A layer holding only the first is not thereby wrong. It is **unverified against
the law**, which is a smaller claim than certification, and it must read as the
smaller claim rather than be promoted to the larger one. Keeping them separate
is what makes that possible: one fact cannot be quietly satisfied by the other.

*(Not built. The owner decides the ordering of a second certification pass
across every existing lane. This section states the shape so that whatever is
built matches it, and so that nothing is certified against the law by accident
of wording in the meantime.)*

### Where every lane actually stands, 2026-09-23

**Every certified layer in the product is SERVICE-ONLY.** All twelve Canadian
spatial certifications and Idaho's. This is true by construction, not by
oversight: `audit-zone-certification.mjs` asks the authority's SERVICE for its
inventory and resolves its parity points against that same service, so "does
our copy match the service" is the only question it is capable of asking. Every
fixture's `sourceUrl` is a GIS endpoint.

Incidental law cross-checks that do exist, recorded so nobody re-derives them
and so nobody mistakes them for certification:

- **Prince Edward Island** — "publishes no hunting zones" came from the Hunting
  Regulations text itself. Law-verified, but about EXISTENCE, not inventory.
- **British Columbia** — the rules bundle carries 225 `officialIdentifiers`
  from B.C. Reg. 190/84 and the service returns 225. The spatial certification
  never consults it, so the agreement is real but unused.
- **Alberta** — checked against Migratory Birds Regulations Schedule 3 as a
  by-product of other work.
- **Yukon** — "443 subzones Yukon states" does not record WHERE Yukon states
  it. That is its own finding, not a cross-check.
- **Ontario, Québec, Manitoba, New Brunswick, Newfoundland** — none of any
  kind.

### The check passes and fails, which is what makes it a check

Measured across four states, 2026-09-23/24:

| State | GIS vs law |
| --- | --- |
| Michigan | **FAILS** — DMUs 351 and 352 still served, rescinded by the NRC on 2026-05-13 |
| Missouri | **FAILS** — a `CWD Management Zone` polygon still served; the phrase occurs zero times in the current Wildlife Code and the 2026 digest says it was removed |
| Indiana | **FAILS** — two layers from one DNR org disagree at the same coordinate on Porter County, which the regulation suspends for 2026-27 |
| Iowa | **PASSES, three times** — nonresident deer {1–10} against IAC 106.7(1), nonresident turkey {4–8} against 98.10, resident fall turkey {4–9} against 98.2(3) |

Iowa's passes are evidence, not a null result. **A check that never passes is
not a check** — it is a check that cannot distinguish, and three exact
agreements are what make the three failures meaningful rather than anecdotal.

The failures are SILENT, which is the reason this cannot be left to
inspection. Missouri's dead layer carries no name, no year and no edit field:
nothing on the service would have warned anyone. Michigan's rescinded units
carry `Year = "2026"` like every other row.

Where the two disagree, the regulatory product wins and the difference is
excluded by an **explicit, sourced list naming the instrument that changed it**
— never by a rule inferred from the data. Inferring which units are stale from
their numbers, their edit dates or their name text is the same mistake in a new
place: the data is what is wrong, so the data cannot be the test.

### What each served layer was actually certified against

| Layer | MAP CERTIFIED: SERVICE | MAP CERTIFIED: LAW |
| --- | --- | --- |
| `layer:us-id-gmu` | Yes — 99 units, 708 points, 0 disagreements, Yellowstone National Park quarantined as drawn-but-not-a-unit (`fixtures/hunt/us-id-gmu-live-parity.json`, 2026-09-21) | **PARTIAL.** The 2026 Big Game booklet and IDFG's Hunt Planner were read for pronghorn and cross-checked with 0 disputes, which reached 42 of the 99 units (`content/regulatory/us-id-certified-units.json`). The remaining 57 units are drawn and resolvable but have never been checked against any regulatory product, and the unit list as a whole was validated against the service alone. |

Idaho's rules lane is honest about this already: a unit outside
`certifiedUnits` answers UNKNOWN rather than guessing. The gap is the map lane,
where "unit 1 exists in 2026" currently rests on IDFG's GIS and nothing else.

## Authority-first evidence

The government layer is always the expected side FOR DRAWING (see above). North Ground's PostGIS rows,
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
