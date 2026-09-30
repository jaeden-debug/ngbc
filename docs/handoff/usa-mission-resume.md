# Hunt USA mission — resumption note

**Written 2026-09-29 by the United States agent, on hitting a session limit.**
Read this before re-running anything. Three lanes died on the limit and ~2.9M
subagent tokens produced almost nothing recoverable. Do not repeat them blind.

---

## What is landed and verified

**`c2d57dd`** on local main. `origin/main` is UNCHANGED — nothing has deployed.

It recovered `codex/usa-hunt-completion`, which was **stale in an important
way**: reported as a large implementation pass, it was a *single commit, 14
behind main, unlanded*. Rebased with no conflicts. Contents: a 3,198-line
51-jurisdiction coverage matrix with discovered authorities and source leads,
Idaho Ready to Hunt, state-boundary resolution via Census TIGERweb,
unsupported-response handling.

Gate at landing: tsc 0 · **1,587 passing, 0 failing** · build clean · lint 0
errors · `validate:seo` and `validate:content:published` clean · matrix
regenerates byte-identically.

---

## The finding that reframes the mission

The bottleneck is **not** the 8 licence-blocked states. It is that **44 of 51
jurisdictions have no boundary source at all** — nobody has found their GIS
endpoint. 42 are UNSUPPORTED with map *and* regulations UNAVAILABLE.

Measured from the landed matrix:

| boundarySource licence status | count | states |
|---|---|---|
| NO_SOURCE | 44 | AL AR AZ CA CT DC DE FL GA HI IA IL IN KS KY LA MA MD ME MI MN MO MS NC ND NE NH NJ NV NY OH OK OR PA RI SC SD TN TX VA VT WA WI WV |
| UNRESOLVED | 3 | AK NM UT |
| SEE_MAP_LAYER_LICENCE | 4 | CO ID MT WY |

So lane one is **discovery at scale**, not licence negotiation.

---

## 49 CFR Part 71 — the authoritative US time-zone instrument

Saved artifact: `CFR-2024-title49-vol1-part71.xml`, **sha256
`9988f17d4ce54d153a98a5e660080edbd5a5e135b79354b221f2cf9cc5989ee1`**, from
`https://www.govinfo.gov/content/pkg/CFR-2024-title49-vol1/xml/CFR-2024-title49-vol1-part71.xml`
(200, 27,364 bytes). The eCFR API returns 406; govinfo works.

Sections: 71.3 Atlantic · 71.4 Eastern · 71.5 E/C boundary · 71.6 Central ·
71.7 C/M boundary · 71.8 Mountain · 71.9 M/P boundary · 71.10 Pacific ·
71.11 Alaska · 71.12 Hawaii-Aleutian · 71.13 Samoa · 71.14 Chamorro.

### § 71.9(a) verbatim — Idaho's line (read by me, not delegated)

> (a) Montana-Idaho-Oregon. From the junction of the Idaho-Montana boundary
> with the boundary between the United States and Canada southerly along the
> Idaho-Montana boundary to the boundary line between Idaho County, Idaho, and
> Lemhi County, Idaho; thence southwesterly along the boundary line between
> those two counties to the main channel of the Salmon River; thence westerly
> along the main channel of the Salmon River to the Idaho-Oregon boundary; …

**A naive county→timezone table is WRONG for Idaho County**, which the Salmon
River splits. Any implementation must refuse Idaho County rather than assign it.

### Alaska and Hawaii (§ 71.11, § 71.12) — read but NOT verified

The verify agent died, so treat these as one reading, not a certified fact.

- **Alaska has no counties.** § 71.12's carve-out is a *longitude* —
  `169°30′ W` — qualified by "the Aleutian Islands", a class Part 71 nowhere
  defines.
- **A longitude-only test is wrong in the LOOSE direction.** Alaska land west
  of the meridian that is not Aleutian stays in the Alaska zone under § 71.11.
  **St. Lawrence Island (Gambell, Savoonga) is the live case** — inhabited
  hunting country that a naive west-of-169°30′ test would show as
  `America/Adak`, an hour off.
- **§ 71.2 names NO exempt state.** Arizona's and Hawaii's DST exemptions are
  **not established by Part 71 at all** and must be sourced to each state's own
  exemption under 15 U.S.C. 260a(a). Do not assume them from this instrument.
- **Versioning trap:** § 71.11's carve-out exists only as a cross-reference to
  § 71.12. An amendment to § 71.12 alone changes what § 71.11 means while
  § 71.11's own text and citation line stay identical. **Watch both sections** —
  a hash on § 71.11 alone would not detect it.
- No geodetic datum is stated for the meridian. Risk is low (open water) but
  none should be assumed.

**Still unread:** § 71.5 (E/C), § 71.7 (C/M), § 71.9 beyond (a). Those cover
the bulk of the lower 48.

---

## Idaho

Current: **75% readiness, 1 species (pronghorn), 42 of 99 units**,
LEGAL_HOURS `SOURCE_BLOCKED`, CRITICAL_EXCEPTIONS `RESEARCH_REQUIRED`.

### Hunt Planner species expansion path (verified, 200s)

`https://idfg.idaho.gov/ifwis/huntplanner/api/1.1/list/?game=N&start=2026-1-1&end=2027-12-31&limit=2000&offset=0`

- `game=1` → **"Mule and White-tailed Deer"**
- `game=2` → **"Elk"**
- `game=3` → Pronghorn Antelope (already certified)
- `game=4`–`8` → empty

Record shape: `{season, tagid, tag, tagarea, ornament, open, close, number,
permits, game, method, area, areaid, id}`. `ornament` is the **animal class**
("Antlered"); reuse the repo's existing animal-class model, do not fork one.

### Two things that make deer/elk unlike pronghorn

1. **Deer is EITHER-SPECIES.** One Idaho tag covers "Mule and White-tailed
   Deer". North Ground has both as separate canonical species. Represent that
   the authorization is not species-specific — do not invent a distinction
   Idaho does not make, and do not collapse the two canonical species.
2. **Deer and elk have BOTH general (OTC) and controlled seasons.** Pronghorn
   was simple because Idaho states *all* pronghorn hunting is by controlled
   hunt. A deer bundle holding only controlled hunts would answer UNKNOWN for a
   hunter with a general tag who is legally hunting — a serious under-claim
   under §8.

### Latent timezone error — do not inherit it

`TIME_ZONE = "America/Boise"` in `build-us-id-pronghorn.mjs` is **Mountain**.
All 42 certified units are numbered **21A and above — none in the Pacific
panhandle** (verified against `us-id-certified-units.json`). So the hour error
is **latent, not live**, and becomes real the moment deer, elk, bear, turkey or
grouse is added, because those occur in units 1–10.

---

## Other verified state

- **Manitoba's source hash is still unresolved and correctly refusing.** The
  province replaced its 2026 guide (`sha256:402f9485…` on disk vs
  `sha256:74a15553…` transcribed). Do not bypass it. This is a Canada
  external-data blocker, **not** a USA regression.
- **The Québec legal-hours browser assertion is NOT the §49 bug.** Québec's
  undefined point timezone is deliberate and documented in
  `src/lib/hunt/time-zone.ts` — it genuinely spans zones. The suspect is
  `readAnswer()` in `scripts/certify-hunt-app.mjs`, which navigates with
  `?zone=X` and then calls `chooseOnMap(page)`; the chosen spot may not land
  inside the URL's zone. Unconfirmed — needs a dev server to prove.
- **`src/lib/hunt/time-zone.ts` records a live Saskatchewan exposure**: SK(W)
  around Lloydminster keeps Alberta time, so `America/Regina` is correct in
  summer and an hour wrong in winter. Already reported to the SK lane; do not
  re-discover it.

---

## What killed the three lanes

All on the same session limit, not on defects in the work:

| lane | outcome | cost |
|---|---|---|
| 10-state source discovery | **all 10 agents failed, `{"states":[]}`, 0 journal results** | 2,000,838 tokens |
| 49 CFR Part 71 | 3 of 7 done (71.11, 71.12 + one), verify died, 71.5/71.7/71.9 unread | 905,159 tokens |
| Idaho deer + elk | stalled at "All sources fetched with status 200" | — |

Both workflows are **resumable from cache** — completed agents replay free:

```
Workflow({scriptPath: '…/workflows/scripts/us-timezone-authority-wf_46c46bf4-1d6.js', resumeFromRunId: 'wf_46c46bf4-1d6'})
Workflow({scriptPath: '…/workflows/scripts/us-state-source-discovery-wf_df7383b0-712.js', resumeFromRunId: 'wf_df7383b0-712'})
```

The timezone one is worth resuming (3 cached). The discovery one cached
nothing — but its script is sound and the schema was never the problem, so
re-run it rather than rewriting it. **Run smaller batches**: 10 concurrent
research agents each doing dozens of fetches is what exhausted the limit.
Batches of 3–4 states are the lesson.

---

## Constraints still in force

- **Do not contact any authority.** Outward-facing contact is the owner's.
- **Do not push.** The moderator session controls `origin/main` while a
  keyboard fix is mid-flight. Land to local main and hand over the SHA. This
  conflicts with the user's §52 (deploy milestones) — flagged, unresolved.
- **Do not touch** `HuntApp.tsx`, `HuntSheet.tsx`, `sheet/PlaceComposer.tsx`,
  `HuntApp.module.css`, `exploration/sheet.ts`, `exploration/map-state.ts`.
- Gate with the project's own commands at **exit 0 and zero failures**.
  A baseline of known failures is not a gate.
- **Commit before stopping, red or green.** An entire implementation was lost
  earlier in this program to a pruned scratchpad.

---

# Hawaii is ready to serve — everything needed, verified 2026-09-30

Hawaii is the only US state whose terms permit use, and the US pattern is
LIVE_SERVICE (owner decision 2026-09-21: no US polygons stored). So it needs a
`UsLayer` entry in `src/lib/hunt/united-states/layers.ts` and nothing else.
Every value below was fetched, not inferred.

**Service** `https://geodata.hawaii.gov/arcgis/rest/services/Terrestrial/MapServer/33`
— "Hunting Areas", polygon, `maxRecordCount` 1000, Query supported.

**Extent is wkid 3750, NOT 4326** (xmin 419184.497, ymin 2100495.819, xmax
936090.333, ymax 2456442.367). NAD83(HARN) / Hawaii zones in metres. A `bounds`
block copied from the extent without reprojecting would be nonsense; derive it
from Hawaii's own latitude/longitude range instead.

**Point queries work and are fast.** `?geometry=-155.47,19.75&inSR=4326` returned
exactly one feature in 0.44 / 0.42 / 0.40 s across three runs:
`unit_name "Unit A", mammal_uni "A", bird_unit "A", status "Hunting Area (Mammal
and Bird)", game_desig "Mammal and Bird", island "Hawaii"`.

**`nameField` is `unit_name`.** Other useful fields: `mammal_uni`, `bird_unit`,
`status`, `game_desig`, `island`, `descriptio`, `gis_acres`.

**QUARANTINE IS MANDATORY, and it is 65 of 186 records.** Measured by groupBy:

| status | n | huntable |
|---|---|---|
| Hunting Area (Mammal and Bird) | 81 | yes |
| Hunting Area (Mammal ONLY) | 35 | mammals only |
| Hunting Area (Bird ONLY) | 5 | birds only |
| Safety Zone | 19 | **no** |
| Safety Zone (NO HUNTING) | 17 | **no** |
| No Hunting | 16 | **no** |
| CLOSED | 13 | **no** |

121 hunting areas, 65 non-hunting. Serving the layer without quarantining the
last four statuses would draw a **safety zone as a hunting unit** — the worst
available failure, and it would look perfectly normal. `expectedRecords` 186,
`expectedUnits` 121.

**THE SPECIES PROBLEM IS REAL AND MUST NOT BE FLATTENED.** A polygon can be open
to mammals and closed to birds. 35 areas are Mammal ONLY and 5 are Bird ONLY, so
a bird hunter standing in a Mammal ONLY area is **not in a bird unit at all**. A
single `designationOf` returning `unit_name` loses that. Two honest options:

- one layer, with `mammal_uni` / `bird_unit` / `status` in `keepFields` and the
  applicability consumed by the rules engine; or
- two layers, mammal units and bird units, which is more faithful.

Either way `rulesServing` stays **false**: no Hawaii rules are certified, so the
answer is §41A's "selectable is not answerable" — the official area a point is
in, an explicit UNKNOWN on legality, and the authority named.

**`legalStanding`** is `DERIVED_FROM_LEGAL_DESCRIPTION`. The controlling text is
Hawaii Administrative Rules Title 13, DLNR, Subtitle 5, Part 2, Chapters 122
(Game Birds) and 123 (Game Mammals), which the layer's own description cites.

**The licence qualification still stands** (recorded in
`content/registry/us-map-licence-findings.json`): "The contents of this web page
are public domain" qualifies itself "to the extent indicated otherwise in the
Terms of Use", and that page 404s at three candidate URLs. Live service does not
redistribute anything, so this is enough for LIVE_SERVICE and is **not** enough
to store a copy.

**Timezone** `Pacific/Honolulu` (already in `SINGLE_ZONE_JURISDICTIONS`). Note
Hawaii's DST exemption is **not** established by 49 CFR Part 71 — § 71.2 names no
exempt state — and must be sourced to 15 U.S.C. 260a(a). Unresolved.

---

# Discovery is complete for all 51 jurisdictions — six remain to be RECORDED

**2026-09-30.** Three discovery workflows covered every US jurisdiction. Forty-one
are recorded in `content/registry/us-map-licence-findings.json`. **Six are
researched and not yet written up: SC, TN, TX, VA, VT, WV.**

Do not re-run discovery for them. It cost ~8M subagent tokens across three runs
and the results are already on disk, durably, outside /tmp:

```
~/.claude/projects/-Users-jaedendoody-Desktop-ngbc/1b5bae5f-bb82-474c-8075-3ce1e12b9014/subagents/workflows/wf_92861a7c-687/journal.jsonl
```

Each line is one agent's return value; filter `type == "result"` and read
`result.code`. The fields are `managementGeography`, `licenceVerbatim`,
`legalHuntingHours`, `gisServices`, `blockers`, `conflicts`.

Their licence headlines, so the shape is known before reading:

| state | headline |
|---|---|
| SC | No grant and no prohibition stated anywhere |
| TN | No licence on any layer we would serve, and no prohibition either |
| TX | Three different instruments say three different things |
| VA | Three different instruments checked |
| VT | **Terms differ PER DATASET within one service owned by one account** |
| WV | The service says nothing and the portal item says everything |

Vermont is the one to read first: per-dataset terms inside a single service means
the state cannot be classified once, which is the same hazard as Indiana (a
refusal on one layer, conditions on the others) and Nebraska (nine items granting,
five silent). Expect to record it per layer rather than per state.

**One repo correction found in passing and not yet applied.** The Connecticut
authority URL stored in `src/lib/hunt/united-states/jurisdictions.generated.json`
for `jurisdiction:us-ct` —
`https://portal.ct.gov/deep/hunting/hunting-and-trapping` — is DEAD. It returns
HTTP 200 while redirecting to `portal.ct.gov/en/404error/?item=…`, i.e. a soft
404, which is why no link check caught it. The live hub is
`https://portal.ct.gov/deep/hunting`. The stored `officialSourceUrl` is still
live. Fix this with the SC/TN/TX/VA/VT/WV batch.
