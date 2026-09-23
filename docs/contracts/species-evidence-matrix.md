# Species evidence matrix — what Canadian authorities actually publish

Research snapshot: **2026-09-23**. Provinces only; the Northwest Territories and
Nunavut are out of scope per the owner's decision recorded in CLAUDE.md §9.

This document answers one question for each province North Ground serves: **what
wildlife evidence does the authority actually publish, at what spatial
resolution, under what licence?** It is a research finding, not a plan. It
certifies nothing and grants nothing.

It is a **snapshot, not a registry.** The living record is
`content/intelligence/source-registry.json`, and
`src/lib/hunt/intelligence/evidence-matrix.ts` derives from that file at call
time. Where this document and the registry disagree, the registry is right and
this document is stale. Nothing here should ever be copied into code.

Rows marked **[reached]** were loaded during this snapshot — the HTTP status,
content type and size were checked, and for CSVs the column header was read, for
PDFs the table extracted, for services the query run. Rows marked **[registry]**
come from North Ground's certified source research without independent
re-verification here. Rows marked **[not reached]** are leads, recorded as leads.
No row asserts a dataset exists on the strength of a citation in a PDF.

One finding is explicitly **not** independently verified and says so where it
appears: the IUCN licence terms, because the site returns HTTP 403 to
programmatic access.

---

## The headline number

The moderator asked how many jurisdictions publish any harvest data at zone
resolution, because that decides whether the Specie Heat Map is a real product
in Canada now. The honest answer has two layers, and the second one matters more.

**Eight of the ten provinces publish some harvest at the authority's own zone
resolution.** Ontario, Québec, British Columbia, Alberta, New Brunswick, Nova
Scotia, Newfoundland and Labrador, and — partly — Saskatchewan. Manitoba
collects a hunter harvest survey and publishes no results; Prince Edward Island
has no unit system to report by.

**Three of them — Ontario, Québec and British Columbia — publish it in a
machine-readable file under a licence that permits commercial use.** Everything
else is blocked by a licence, trapped in a PDF, or both.

So the constraint on the Specie Heat Map in Canada is **not** that the data does
not exist. Almost every province measures this and most publish it at the right
resolution. The constraint is that the data is locked in licences and PDFs. That
is a different problem with a different remedy, and it is worth knowing before a
map is built rather than after.

### Verdicts by row

| Verdict | Count |
|---|---|
| USABLE | 3 provinces (ON, QC, BC) for harvest; 1 province (QC) for range |
| PDF_ONLY | 1 province (AB) — licence permits commercial use, format and geography do not |
| LICENCE_PENDING | 3 provinces (NB, NS, NL) |
| LICENCE_BLOCKED | 2 datasets (SK harvest survey; BC hunter sample survey estimates) + IUCN range |
| NOT_PUBLISHED | 2 provinces (MB collects but does not publish; PE has no unit system) |
| NOT YET RESEARCHED | population/survey, seasonal range and habitat in **every** province |

Alberta is the case that shows the pattern most clearly. It has the most
permissive licence of any province — the Open Government Licence – Alberta
explicitly grants commercial use — and is still unusable, because every year of
every species is a PDF and its unit column is frequently a *group* of WMUs
rather than a WMU. Good licence, wrong container, and a geography that is not
what its column heading suggests.

### The evidence ladder is still one rung, but no longer empty above it

Every dataset in the registry today is measured harvest — tier T1. This pass
found the first genuine **T3 authoritative range** in Canada, and exactly one:
Québec's 69 terrestrial mammals under CC BY. It also established that federal
Canada publishes no range for common game species at all, and that IUCN's
spatial data is barred to a commercial product. Population, seasonal range and
habitat remain unresearched, and this document does not pretend otherwise.

---

## Harvest and hunter effort, by province

### Ontario — USABLE **[reached]**

| | |
|---|---|
| Authority | Ontario Ministry of Natural Resources |
| Datasets | White-tailed deer / moose / black bear / wolf and coyote / wild turkey hunting activity and harvest |
| Evidence kind | Harvest, and hunter effort as an active-hunter count |
| Geography level | ZONE |
| Published unit | "Wildlife Management Unit" |
| Period | Deer 2008–2025; moose 2006–2025; bear and wolf/coyote 2012–2025; turkey 2008–2025 |
| Format | CSV, machine-readable |
| Licence | "Open Government Licence – Ontario" — <https://www.ontario.ca/page/open-government-licence-ontario> |
| Commercial use | Allowed |

Columns read from the 2025 deer file: `WMU, Year, Active Hunters, Antlered
Harvest, Antlerless Harvest, Total Harvest`. So Ontario publishes a **hunter
denominator** but no hunter-days. Harvest per active hunter is therefore
derivable; harvest per unit effort is not.

**Elk is the exception and is not usable.** Ontario publishes elk harvest by
**Elk Harvest Area** (57-01 to 63-08, nine areas), which is a different geography
from the Wildlife Management Units the map draws. North Ground does not hold that
geometry, so there is nothing to draw at any resolution. Openly licensed;
held back for want of the geography, not for a licence.

**Chronic wasting disease surveillance** is a separate dataset under
"Ontario.ca Terms of Use" (<https://www.ontario.ca/page/terms-use>), commercial
use unclear, and its reusable spatial fields have not passed schema review. A
sample record is not a confirmed detection area, not a mandatory-testing area and
not a carcass-transport restriction — three different legal objects a reader
would assume from a dot on a map.

### Québec — USABLE **[reached]**

| | |
|---|---|
| Authority | Ministère de l'Environnement, de la Lutte contre les changements climatiques, de la Faune et des Parcs |
| Dataset | Statistiques historiques de chasse et piégeage au Québec |
| Evidence kind | Harvest only |
| Geography level | ZONE |
| Published unit | « Zone de chasse » |
| Period | 1971–2025 (wild turkey 2008–2025) |
| Format | CSV, machine-readable |
| Licence | "Creative Commons Attribution 4.0 (CC BY)" — <https://www.donneesquebec.ca/licence/#cc-by> |
| Commercial use | Allowed |

Columns read from the moose file: `Annee, Zone, Engins, Femelle_adulte,
Jeune_femelle, Indetermine, Jeune_male, Male_adulte, Total_general`. 4,098 data
rows, zone codes matching North Ground's certified Québec designations.

**Québec publishes no hunter count and no hunter days.** Harvest per hunter and
harvest per unit effort are both underivable here, and any attempt to produce one
would be inventing a denominator. Québec supports `HARVEST_TOTAL` and nothing
else. It does break harvest down by weapon and by sex and age class, which is
richer than Ontario in a different direction.

Species files: moose (30 zones), white-tailed deer (56), black bear (30), wild
turkey (16).

### British Columbia — USABLE, and the richest in Canada **[reached]**

| | |
|---|---|
| Authority | BC Ministry of Water, Land and Resource Stewardship, Wildlife and Habitat Branch |
| Dataset | Big Game Harvest Statistics 1976 to 2024 |
| Evidence kind | Harvest, hunter effort (hunters and days), resident and non-resident separately |
| Geography level | ZONE |
| Published unit | "Management Unit" |
| Period | Hunt years 1976–2024 |
| Format | CSV, machine-readable, 4.09 MB |
| Licence | "Open Government Licence – British Columbia" — <https://www2.gov.bc.ca/gov/content?id=A519A56BC2BF44E4A008B33FCF527F61> |
| Commercial use | Allowed |

Columns read: `HUNT YEAR, SPECIES, CI, WMU, REGION, RESIDENT HUNTERS, RESIDENT
DAYS, RESIDENT KILLS, RESIDENT MALE/FEMALE/JUVENILE/UNKNOWN RATIO, NON-RESIDENT
HUNTERS, NON-RESIDENT DAYS, NON-RESIDENT KILLS, NON-RESIDENT …RATIO`.

British Columbia is the only province researched that publishes **both a hunter
count and hunter days**, so it is the only one where harvest per unit effort is
derivable from open data. It also keeps resident and non-resident figures
separate, which must never be mixed.

Species carried: black bear, bobcat, caribou, mule deer, white-tailed deer, elk,
Canada lynx, moose, grey wolf. Cougar, mountain goat, mountain sheep and grizzly
bear appear in the file but build no evidence — North Ground holds no canonical
record for them, and grizzly hunting has been closed in British Columbia since
2017.

**Rollup rows are excluded, not demoted.** Region (R99), province (999) and the
regional codes 100–900, with 770/780 for regions 7A Omineca and 7B Peace, are
totals over the units beneath them. They are not coarser evidence; reading them
that way would put a provincial number on the map that double-counts its own
units.

### British Columbia hunter sample survey — LICENCE_BLOCKED **[registry]**

The same programme publishes **Hunter Sample Survey Estimates 1976 to 2024** at
Management Unit resolution, adding 95% confidence bounds. The BC Data Catalogue
marks it **Access Only**: "reproduction is not permitted without written
permission" and "It may not be reproduced or redistributed without the prior
written permission of the Province of British Columbia"
(<https://www2.gov.bc.ca/gov/content?id=1AAACC9C65754E4D89A118B875E0FBDA>).

Recorded here because it is the dataset someone will reach for. It is excluded
permanently unless written permission is obtained.

### Saskatchewan — LICENCE_BLOCKED, PDF only **[registry]**

| | |
|---|---|
| Authority | Saskatchewan Ministry of Environment |
| Dataset | Hunter Harvest Survey Results |
| Geography level | ZONE, partly |
| Published unit | "Wildlife Management Zone", for draw and big-game-management licences **only** |
| Period | 2020–2025 |
| Format | PDF |
| Licence | Crown copyright; non-commercial reproduction only — <https://www.saskatchewan.ca/copyright> |
| Commercial use | **Prohibited** without advance written permission |

Two separate problems, and the licence is the operative one. Beyond it, zone
resolution covers the **minority** of the data: the highest-volume regular-licence
harvest, including resident white-tailed deer, is published province-wide with no
zone breakdown at all.

Worth remembering: the same ministry publishes its zone *geometry* under a
licence granting commercial reuse while these harvest PDFs fall under the general
site copyright. Read the licence at the dataset, never at the province.

### New Brunswick — LICENCE_PENDING, PDF only **[reached]**

| | |
|---|---|
| Authority | NB Department of Natural Resources and Energy Development, Fish and Wildlife Branch |
| Dataset | Big Game Harvest Reports |
| Geography level | ZONE |
| Published unit | "Wildlife Management Zone" (27) |
| Species | White-tailed deer, moose |
| Period | Moose from 1960, deer from 1970; editions 2020–2025 |
| Format | PDF (2024 edition reached, 3.66 MB) |
| Licence | **None stated.** © Government of New Brunswick — <https://www.gnb.ca/en/admin/disclaimer.html> |
| Commercial use | Unclear |

Silence is not permission. The data is good and at the right resolution; there is
no licence to rely on.

### Nova Scotia — LICENCE_PENDING, PDF only, and the edition matters **[reached]**

| | |
|---|---|
| Authority | Nova Scotia Department of Natural Resources and Renewables |
| Dataset | Deer and moose harvest statistics |
| Geography level | ZONE |
| Published unit | "Deer Management Zone"; moose success rate by zone |
| Period | Zone-level deer 2018–2024; moose success by zone 2019–2023 |
| Format | PDF (2024 deer edition reached, 348 KB) |
| Licence | Crown copyright, Government of Nova Scotia; no open licence on these pages |
| Commercial use | Unclear |

**Per-zone deer harvest was dropped from the 2025 edition, which is province-wide
only.** Any pipeline must pin the edition and its hash rather than follow
"latest", or it silently downgrades zone evidence to jurisdiction evidence and
reports no error.

Nova Scotia publishes a **moose success rate by zone**. It is publishable as such
because the authority computed it; North Ground never derives a success rate from
harvest and hunters.

Nova Scotia's only openly licensed wildlife data is its bear extracts, which are
**county-level** — the wrong geography for a zone map, and the reason COUNTY had
to become a first-class geography level rather than being flattened onto the
nearest unit.

### Newfoundland and Labrador — LICENCE_PENDING **[registry]**

| | |
|---|---|
| Authority | Government of Newfoundland and Labrador |
| Dataset | Hunting and Trapping Guide quota and success tables, and per-area survey tables |
| Geography level | SPECIES_ZONE |
| Published unit | "Moose Management Area" and "Caribou Management Area" — separate maps, not interchangeable |
| Species | Moose, caribou |
| Period | Quota and success 2024; per-area survey tables 2006, 2012, 2018; hunter statistics 2017–2021 |
| Format | Web tables within the guide |
| Licence | **None named.** Crown copyright, permission extended to public and non-government organizations — <https://www.gov.nl.ca/disclaimer/> |
| Commercial use | Unclear; North Ground is a commercial product |

North Ground has parity-certified both geographies (74 Moose Management Areas,
19 Caribou Management Areas), so the blocker here is the licence, not the
geography.

One page **mixes vintages** — 2022 survey tables beside 2024 success rates — so
every record must carry its own effective period rather than the page's.

### Manitoba — NOT_PUBLISHED, but collected **[reached]**

Manitoba publishes **no harvest evidence at Game Hunting Area resolution**. The
finding is sharper than "no data exists", and the distinction is actionable.

Manitoba **runs** a Hunter Harvest Survey. Its own page says the survey "provides
valuable information on harvest rates, success levels and hunting trends" and
that it influences "decisions on licence numbers, bag limits and season dates"
(<https://www.gov.mb.ca/nrnd/fish-wildlife/wildlife/survey_nondraw.html>, read
2026-09-23). The page reached is purely a solicitation asking hunters to complete
the survey through `manitobaelicensing.ca`. It carries **no results, no tables
and no links to results** — the only link on the page is its own French
translation.

So Manitoba is **collected but not published**, which is a different problem from
Prince Edward Island's, where no unit system exists to report by. Manitoba's own
open licence would permit commercial use if results were released, so the remedy
here is a data request rather than a licence negotiation. That is an owner
decision and none has been drafted.

Manitoba has certified rules and certified geometry in production. It simply has
no evidence layer to paint, and the Specie Heat Map will be empty there for
reasons that have nothing to do with licensing.

### Prince Edward Island — NOT_PUBLISHED **[registry]**

No comprehensive hunting-unit system has been identified, so there is no unit to
report harvest by and no dataset to licence. Prince Edward Island is served at
JURISDICTION level.

### Alberta — PDF_ONLY, and the geography is not what it looks like **[reached]**

| | |
|---|---|
| Authority | Alberta Forestry and Parks, Hunting and Fishing Branch |
| Datasets | `Hunter harvest report : <species>` — elk, moose, mule deer, white-tailed deer, pronghorn antelope, black bear, bighorn sheep; plus outfitter-guided variants |
| Evidence kind | Harvest and estimated hunter success; effort only in the special-licence report |
| Geography level | ZONE, **but frequently a group of zones** |
| Published unit | "Wildlife Management Unit (WMU)" |
| Period | Elk 2010–2025 (16 editions); most species 15–16 editions |
| Format | **PDF only** |
| Licence | Open Government Licence – Alberta v2.2 — <https://open.alberta.ca/licence> |
| Commercial use | **Allowed**, explicitly |
| **Hard line** | Alberta's "estimated hunter success" **exceeds 100%** in published rows (103%, 115%, 131% in the 2024 elk report). It is not a share of hunters. It must never be rendered as a percentage of hunters, never compared against another province's success rate, and never passed to a range check written for a bounded rate — it will pass one written for a count. |
| **Hard line** | The unit column mixes single WMUs with **groups** of WMUs. A group is `reportedAtLargerArea`. It must never be split across its member units. |

The licence is the best of any province and is not the blocker. Read verbatim at
that URL on 2026-09-23:

> "The Information Provider grants you a worldwide, royalty-free, perpetual,
> non-exclusive licence to use the Information, **including for commercial
> purposes**, subject to the terms below."

Required attribution, verbatim: "Contains information licensed under the Open
Government Licence – Alberta."

Two things block it instead.

**First, it is PDF and only PDF.** Every resource of every year of every species
is a PDF; there is no CSV, XLSX, JSON or spatial service for harvest. There *is*
a working CKAN metadata API at `https://open.alberta.ca/api/3/action/package_show`,
which is useful for detecting when a new year is posted but serves no harvest
values. (`open.alberta.ca` returns HTTP 520 to some fetchers and 200 to plain
curl — a tooling artifact, not an outage.)

**Second, and more consequential: the row key is often a group of WMUs, not a
WMU.** Read from the 2024 elk report (191,805 bytes, reached), the unit column
interleaves single units with groups, because licences are issued over multi-unit
areas. Eighteen distinct grouped keys appear in that one species-year, including:

```
116/118/119
116/118/119/624
124/128/142/144/148/150
200/202/203/232/234
206/222/226/244/246
214/314
```

A naive join on WMU fails on a large fraction of Alberta's rows, and splitting a
group across its member units would invent per-unit evidence. This is the
`reportedAtLargerArea` case — the same one Ontario has for WMU 76 — except in
Alberta it is routine rather than exceptional.

The report's own scope line, verbatim: "This report is a summary of provincial
resident harvest, combining harvest from general and special licences." Its table
is titled "Estimated resident harvest for elk - 2024 (% estimated hunter success
by Wildlife Management Unit)".

**"Estimated hunter success" is not a bounded rate.** Values above 100% are
published as-is — 103%, 115% and 131% all appear in the 2024 elk report. Whatever
Alberta's denominator is, it is not "share of hunters who succeeded", and the
figure must never be presented as a probability or compared against another
province's success rate.

**Effort exists in exactly one place.** The `Special licence hunter harvest
report` publishes `Average days hunted` and `Hunter days per animal` per draw
code — but it is keyed by draw code and draw choice first, with an Antelope
Management Area letter and a WMU or WMU group second, and the series has only two
editions. It is not a drop-in effort denominator for the per-species reports.

**No upland bird or waterfowl harvest exists.** A catalogue search returned zero
results for waterfowl harvest, and every grouse hit was a species-at-risk or
oil-sands study rather than harvest. Alberta publishes big-game harvest only.

---

---

## Authoritative range (tier T3)

First research pass, 2026-09-23. The finding is sharper than expected.

### Federal Canada publishes no range for common game species **[reached]**

The federal geospatial product tied to the *Species at Risk Act* is **critical
habitat, not range**, and it covers listed species only. Queried live against
ECCC's own service (`CWS_SCF/CriticalHabitat/MapServer`, layer 3, polygon
critical habitat), counting features by common name:

| Species | Features |
|---|---|
| Moose | **0** |
| White-tailed deer | **0** |
| Elk | **0** |
| Black bear | **0** |
| Ruffed grouse | **0** |
| **Caribou** | **121** |

Of the six common game species, only caribou appears — and even then it is
critical habitat rather than range, and ECCC disclaims it: "It is intended to
provide general guidance only, not legally authoritative boundaries."

Natural Resources Canada does publish `Ranges of Principal Mammals` and `Ranges
of Principal Birds`, which sound exactly right and are not. They are plates from
the **1957** Atlas of Canada, delivered as **JPG and PDF**, and NRCan's own
description says "some range limits are hypothetical." A 69-year-old scanned
paper map is not a range layer.

### IUCN is categorically unusable — two independent bars

The IUCN Red List Terms and Conditions of Use (version 3.1, June 2024) prohibit
commercial use of spatial data, and separately prohibit redistribution "through
interactive web maps that grant users download access". North Ground is a
commercial product and would be serving the geometry through a map, so either
clause alone is disqualifying. A written waiver from IUCN would be required.

**Verification note:** `iucnredlist.org` returns **HTTP 403** to programmatic
access, including to this snapshot's own checks. The clauses above come from the
research pass reading the page in a browser and were **not independently
re-verified here.** Before anyone relies on this as a settled licence finding, a
person should read the terms directly.

### Québec is the one usable game-species range dataset in Canada **[reached]**

| | |
|---|---|
| Authority | MELCCFP (Québec) |
| Dataset | Aires de répartition des mammifères terrestres |
| Evidence kind | Authoritative range (T3) |
| Geography level | POLYGON, one per species |
| Species | **69 terrestrial mammals**, including moose, white-tailed deer, black bear, woodland caribou, snowshoe hare, arctic hare, eastern cottontail, coyote, grey wolf, red/arctic/grey fox, bobcat, Canada lynx and the full trapline set |
| Format | GeoJSON, GPKG, SHP, FGDB, SQLITE — machine-readable |
| Licence | Creative Commons Attribution 4.0 (CC BY) — <https://www.donneesquebec.ca/fr/licence/> |
| Commercial use | **Allowed** — "même à des fins commerciales" |
| **Hard line** | This layer may say **"this species occurs in Québec"** and may **NEVER** support a hotspot, a ranking, a per-zone class or any comparison between places. The authority calls it "produced on a small scale… indicative". It is tier T3 `RANGE_PRESENCE`, whose only permitted claim is `PRESENCE_EXTENT`. Painting it per zone de chasse, or shading it by any value, is fabrication. |
| **Why this needs guarding** | It is 776 MB for 69 features — dense enough to *look* precise at any zoom. It is simultaneously the first real T3 evidence North Ground has in Canada and the single most likely source of a fabricated heat map. The temptation is the danger. |

The GeoJSON was reached: HTTP 200, **776,037,558 bytes (776 MB)** for 69
features, confirmed by Content-Length. That is extraordinarily dense geometry and
would need its own simplified render layer, exactly as §41B prescribes keeping
source, analysis, simplified and render geometry distinct.

**Two limits the authority states itself, and both are binding.** Verbatim:

> "The distribution areas were produced on a small scale; they provide indicative
> information on the presence of the species in Quebec."

> "There may be differences between the ranges of the species shown in the files
> and the current spatial distribution of the species."

Small-scale and indicative means this is presence at the scale it was drawn. It
may **never** be painted per zone de chasse, and it may never be shaded into
hotspots — which is precisely what the spatial-precision contract refuses and
what tier T3 is forbidden from claiming.

**Elk is absent** (no *Cervus canadensis*), consistent with elk not being
established in Québec. **All birds are absent** — this file is mammals, reptiles,
amphibians and freshwater fish. There is no ruffed grouse range here.

### Other provincial range, catalogue-level only **[not reached]**

Woodland caribou range for Québec and Saskatchewan, boreal caribou for the
Northwest Territories, and Yukon's `Wildlife Key Area - 250k` series. Recorded as
leads, not findings; none was loaded.

Yukon's is the only non-Québec layer seen that covers a common game species
(elk), and its name is a warning: **key areas are seasonally critical habitat,
not range.** They must not be relabelled as range if they are ever ingested.

### Range: verdict

| Source | Verdict |
|---|---|
| Québec terrestrial mammals | **USABLE** — CC BY, machine-readable, small-scale/indicative |
| Federal SARA critical habitat | NOT RANGE; caribou only |
| NRCan Atlas ranges (1957) | PDF_ONLY, and obsolete |
| IUCN Red List spatial | **LICENCE_BLOCKED** for commercial use |
| Every other province | NOT YET RESEARCHED |
| Bird range, anywhere in Canada | NOT FOUND in the searches run |

---

## Population and survey, seasonal range, habitat

**Not yet researched in any province.**

This is stated rather than filled in because the alternative — naming plausible
datasets from general knowledge — is exactly the fabrication CLAUDE.md §61
forbids, and it would be indistinguishable from research until someone tried to
ingest it.

What is known without new research: North Ground's evidence architecture already
separates these tiers, and a new population or habitat dataset will fail
`validateEvidenceMatrix()` until someone declares its tier and precision
deliberately. So the gap is visible in code, not only here.

Two leads worth a later pass, neither reached: **NatureServe Canada EBAR**, the
most plausible remaining source of Canadian range geometry for species that are
not at risk; and per-province bird range, which this pass did not search for
specifically.

---

## Consequences for the product

**1. The heat map is viable in three provinces today, not nationally.** Ontario,
Québec and British Columbia have zone-resolution harvest that is machine-readable
and openly licensed. Those three cover a large share of Canadian hunting, but a
national Specie Heat Map is not available on current evidence, and drawing one
would require painting places nobody measured.

**2. What can be said differs by province, and the contract already enforces it.**

| Province | `HARVEST_TOTAL` | `HARVEST_PER_HUNTER` | `HARVEST_PER_EFFORT` |
|---|---|---|---|
| British Columbia | yes | yes | **yes** — hunters and days both published |
| Ontario | yes | yes — active hunters published | no — no hunter days |
| Québec | yes | **no** — no hunter count published | no |

Québec is the case that proves the derivation rule on real data: a rich
55-year harvest series with no denominator anywhere in it. Any per-hunter figure
for Québec would be invented.

**3. Licence is the dominant blocker, not data availability.** Four of the eight
provinces that publish zone-resolution harvest cannot be used because of a
licence — three unstated or unclear, one prohibiting commercial use outright.
This is an owner decision, not an engineering one. No permission letters have
been drafted from this document.

**4. PDF is the second blocker, and Alberta shows they are independent.** New
Brunswick, Nova Scotia and Saskatchewan publish at the right resolution in PDF.
Alberta publishes in PDF under a licence that explicitly permits commercial use —
so fixing the licence question would still leave four provinces needing a PDF
extraction path with its edition pinned.

**5. Alberta needs a decision this document cannot make.** Its unit column mixes
single WMUs with groups of WMUs, so even a perfect PDF parser yields evidence at
two different resolutions from one table. Groups must be carried as
`reportedAtLargerArea` rather than split — the architecture already handles this
— but it means Alberta's map would be partly painted and partly not, and whether
that is a good experience is a product judgement.

**6. Range is real but singular.** Québec's mammals file is the only usable
authoritative range in Canada, and its authority calls it small-scale and
indicative. It can support "this species occurs in Québec" and can never support
a hotspot. Used correctly it would let the map say something true in a province
where it otherwise says nothing about where to look; used carelessly it is the
single most likely source of a fabricated heat map, because it is tempting and
it is dense enough to look precise.

**7. Birds have nothing, anywhere.** No harvest for upland birds or waterfowl in
Alberta, no bird range in Québec's file, and nothing federal newer than 1957.
Ruffed grouse is a supported species in Hunt with certified rules, and there is
currently no evidence layer for it in Canada at all.

---

## What this document does not do

It does not certify a source; Canadian source certification belongs to the Canada
workstream. It does not grant or assume a licence. It does not draft
correspondence. It does not add a dataset to the registry. And it does not claim
that an absence of published evidence means an absence of animals — for a hunter
reading a map, those must never look the same.
