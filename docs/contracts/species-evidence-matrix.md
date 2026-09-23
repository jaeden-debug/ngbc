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

### The evidence ladder, after two passes

Every dataset in the registry is measured harvest — tier T1. Research now says
that is a gap in North Ground's ingestion, not a gap in Canada.

| Tier | Best usable source in Canada | Verdict |
|---|---|---|
| **T1** measured harvest | Ontario, Québec, British Columbia | USABLE |
| **T2** modelled population | **Ontario moose, per WMU, with 90% CI, XLSX** | **USABLE** |
| **T3** authoritative range | **Québec, 69 terrestrial mammals, CC BY** | **USABLE**, small-scale |
| **T4** habitat model input | **NRCan Land Cover of Canada 2020, national, 30 m** | **USABLE** |
| **T5** context | Out of scope for this pass | — |

The single most useful finding of the second pass: **Ontario publishes moose
population estimates with confidence intervals on the same WMU geography as its
harvest data, under the same open licence.** Ontario is therefore the one place
in Canada where T1 and T2 genuinely coexist on one unit — the case the evidence
ladder was built for, and until now hypothetical.

**Seasonal range remains unresearched**, and is named in its own section rather
than left implied.

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

## Bird evidence, and the two leads closed

Second research pass, 2026-09-23. Both open leads now have verdicts rather than
remaining leads.

### NatureServe Canada EBAR — NOT_PUBLISHED for game species **[reached]**

The most plausible remaining source of Canadian range geometry for species that
are *not* at risk. It is real, it is live, its licence is clean — and it holds
none of what North Ground needs.

Queried live against its own public feature service
(`gis.natureserve.ca/arcgis/rest/services/EBAR-KBA/EBARPublic/FeatureServer`,
layer 1), counting range polygons by scientific name:

| Genus | Features |
|---|---|
| *Alces* (moose) | **0** |
| *Odocoileus* (white-tailed and mule deer) | **0** |
| *Cervus* (elk) | **0** |
| *Ursus americanus* (black bear) | **0** |
| *Bonasa* (ruffed grouse) | **0** |
| *Meleagris* (wild turkey) | **0** |
| *Branta* (geese) | **0** |
| **Whole layer** | **21,706** |

So this is a decisive negative, not an empty service: EBAR holds 21,706 range
polygons and not one of them is a game species. Its 34 mammals are bats, shrews,
prairie dogs, badger, swift fox and similar — a species-at-risk product, exactly
as its own scope statement says (COSEWIC priorities, Key Biodiversity Area
trigger species, ECCC priorities).

The licence is CC BY 4.0 and would have permitted commercial use. That is not
the blocker; the absence of the species is. NatureServe also states the project
**concluded 31 March 2026 due to funding constraints.**

**Do not reopen this lead** unless the species list changes.

### eBird Status and Trends — LICENCE_BLOCKED **[reached]**

eBird publishes exactly what a heat map would want: modelled seasonal range and
weekly relative abundance for the game birds North Ground lacks. It is barred.

Read verbatim at <https://ebird.org/about/products-access-terms-of-use>
(2026-09-23), under the section heading **"Websites, web-based platforms, mobile
applications, and decision-support tools"** — a heading that describes this
product precisely:

> "No use of eBird Status and Trends Data Products is permitted without the prior
> written consent of the Cornell Lab of Ornithology."

And separately:

> "Use for Commercial Purposes is not covered in these Terms, and require
> separate permission, which may be requested at ebird@cornell.edu."

Two independent bars, and the terms add that where several uses apply, "the most
restrictive type of use shall apply". Nothing may be built on this before
written permission. The contact is on record; whether to ask is an owner
decision.

### Birds Canada / NatureCounts — LICENCE_PENDING, and the wrong shape **[reached]**

Breeding bird atlases publish **observation records on a 10 × 10 km square**, not
range geometry. There is no blanket licence: each dataset carries its own policy,
custodian approval is required at most access levels, and the default is stated
plainly — "As a general rule, data acquired from NatureCounts should not be
redistributed directly to third parties or made available publicly for download."

Even resolved, this is tabular observation evidence, not a range layer.

### ECCC waterfowl surveys — USABLE, and they are survey evidence, not range **[registry of the research pass]**

The Canadian Wildlife Service publishes waterfowl survey data under the **Open
Government Licence – Canada**, machine-readable and commercially usable. The
Eastern Waterfowl Survey's own files were downloaded during research: a 12.4 MB
file geodatabase and a KMZ carrying **332 survey-plot polygons**, covering
Ontario, Québec and Atlantic Canada.

ECCC's own description of the unit: helicopters survey "square plots located
either systematically (Ontario and Québec) or semi-randomly (Atlantic region)",
historically "202 10x10 km (100 km²) plots".

**This is T1 measured survey observation at POLYGON precision — it is not
range.** It says where CWS flew and what they counted. A plot with no
observations is a plot, not an absence of ducks.

Roughly ten further CWS waterfowl survey packages exist in the same catalogue
under the same licence; only this one's files were opened.

**No federal bird *range* geometry exists.** The North American Breeding Bird
Survey "maps for Canada" are PDFs of volunteer route maps, not distribution.

### Yukon Wildlife Key Areas — USABLE, and they are not range either **[reached]**

Outside this document's provincial scope, but recorded because it is the only
place in Canada with usable game-*bird* geometry, and Yukon is served.

Queried live against `mapservices.gov.yk.ca/.../GY_Biological/MapServer`:

| Layer | Features |
|---|---|
| WKA Sharp-tailed Grouse – 250k | 25 |
| WKA Waterfowl – 250k | 244 |
| WKA Moose – 250k | 359 |
| WKA Elk – 250k | 13 |

**Hard line: a key area is not a range.** Yukon's own description — "Wildlife Key
Areas (WKA) are locations used by wildlife for critical, seasonal life functions
… identified by interpreting observed locations of wildlife at key times of year,
not through intensive habitat assessment". Relabelling these as range would claim
the species is absent everywhere else in Yukon, which the layer does not say and
which is false.

**Licence caveat, and it is unresolved.** OGL–Yukon is reported to permit
commercial use, but `yukon.ca` returns **HTTP 403** to programmatic access,
including to this snapshot's own check. The verbatim text available came from an
Internet Archive capture dated 2026-08-31, not the live page. **A person must
read the live licence before anything is built on this.**

### Bird evidence: verdict

| Source | Verdict |
|---|---|
| NatureServe Canada EBAR | **NOT_PUBLISHED** — 21,706 polygons, zero game species; lead closed |
| eBird Status and Trends | **LICENCE_BLOCKED** — commercial and decision-support both barred |
| Birds Canada / NatureCounts atlases | **LICENCE_PENDING** — and observation records, not range |
| ECCC / CWS waterfowl surveys | **USABLE** — OGL-Canada; survey plots, not range |
| ECCC bird range geometry | **NOT_PUBLISHED** |
| Breeding Bird Survey maps for Canada | **PDF_ONLY** — route maps, not distribution |
| Yukon Wildlife Key Areas | **USABLE**, licence unverified live; key areas, not range |
| BC sharp-tailed grouse leks, CRIMS geese | **LICENCE_BLOCKED** — catalogue "Access Only" |
| Any other provincial game-bird range | **NOT_FOUND** |

**There is no Canada-wide game-bird range geometry available to a commercial
platform.** What exists is jurisdiction-scoped survey and key-area evidence,
which fits the evidence model — and which must never be presented as range.

Ruffed grouse, which has certified rules in Hunt, still has no evidence layer
anywhere in Canada.

---

## Population and survey estimates (tier T2)

Second research pass, 2026-09-23. **Canada does have T2 evidence.** The first
pass was wrong to leave this blank, and one province turns out to publish it
cleanly.

### Ontario — USABLE, and the first T2 evidence North Ground can use **[reached]**

| | |
|---|---|
| Authority | Ontario Ministry of Natural Resources |
| Dataset | Moose population monitoring summaries |
| Evidence kind | **Population estimate from aerial survey** (T2) |
| Geography level | ZONE, and finer where surveyed |
| Published unit | "WMU", with `SurveyScale` of `Plot` or `Sub-WMU` |
| Period | 1975-01-01 to 2026-03-31 |
| Format | **XLSX, machine-readable** (167,608 bytes, reached) |
| Licence | Open Government Licence – Ontario |
| Commercial use | Allowed |

Column headers read from the file: `MostRecentUpdate, SurveyYear, SurveyScale,
SurveyArea, WMU, Type, Aircraft, SamplingEffort, SamplingEffort_WMU, Obsv_Moose,
Obsv_Bull, Obsv_Cow, Obsv_Calf, Obsv_Unk, Projected_Moose, Projected_Bull,
Projected_Cow, Projected_Calf, Projected_Unk, CI90perc, CImethod, Notes`.

This matters more than one row suggests. It is a **published population estimate
with a 90% confidence interval, on the same WMU geography as Ontario's harvest
data**, under the same open licence. So Ontario is the one place in Canada where
T1 measured harvest and T2 modelled population genuinely coexist on one unit —
the case the evidence ladder was built for, and until now hypothetical.

The authority's own caveat, verbatim: "Moose populations are estimated based on a
sample of plots and are subject to statistical error. We may update data
periodically as errors are identified and corrected."

**Hard line:** observed counts (`Obsv_*`) and projected estimates (`Projected_*`)
are different columns and different claims. An observation is what a crew saw
from an aircraft on a sample of plots; the projection is a model output with an
interval. They must never be conflated, and the interval must travel with the
estimate.

### Alberta — PDF_ONLY again **[reached]**

Alberta publishes **one aerial ungulate survey report per WMU per survey year** —
titles such as "Wildlife Management Unit 353 aerial ungulate survey (2023)". A
catalogue query returned 279 hits; one PDF was confirmed reachable (255,994
bytes). Every resource format returned was PDF.

Licence is OGL–Alberta and permits commercial use. The blocker is the same as for
Alberta's harvest: the estimate for each unit lives in its own PDF.

### British Columbia — the richest survey data in Canada, and LICENCE_BLOCKED **[reached]**

Two live WFS layers from the Wildlife Species Inventory return exactly what a
careful T2 record needs: `PARAMETER_NAME` ("Individuals/km2"), `PARAMETER_VALUE`,
`SIGHTABILITY_CORRECTION`, `CONFIDENCE_LIMIT_LOWER`/`UPPER`,
`CONFIDENCE_LEVEL_PERCENT`, `STANDARD_ERROR`, `COEFFICIENT_VARIATION`,
`SAMPLE_SIZE`, plus per-point ungulate observations.

**The licence is the wall.** Both carry "Access Only", which is not an open
licence at all but BC's all-rights-reserved copyright page. Read verbatim at
<https://www2.gov.bc.ca/gov/content?id=1AAACC9C65754E4D89A118B875E0FBDA>:

> "Copyright © 2026, Province of British Columbia. All rights reserved. This
> material is owned by the Government of British Columbia and protected by
> copyright law. It may not be reproduced or redistributed without the prior
> written permission of the Province of British Columbia."

Note the contrast within one province: BC's harvest statistics are OGL-BC and
usable, and its survey estimates are all-rights-reserved. **Read the licence at
the dataset, never at the province** — the same lesson Saskatchewan taught.

Two further notes. The geography is a **survey block** (`BLOCK_LABEL`), not a
management unit, so these would not paint the MU map even if licensed. And BC
withholds some records under its Species and Ecosystems Data and Information
Security Policy — a real-world instance of the sensitivity gate in
`publication.ts`, arriving before North Ground built one.

### Manitoba — LICENCE_PENDING, and three units in a year **[reached]**

Manitoba's `2024 Big Game Surveys` reports per **Game Hunting Area**, and the
2024 edition covered **three areas only**: GHA 26, GHA 17A, and GHAs 21 & 21A.
GHA 26: "The total population is estimated to be 1,405 (90% CI: 1,020 – 1,792)
moose… approximately 0.19 moose/km2."

**Hard line, and Manitoba states it itself: a minimum count is not a population
estimate.** For GHAs 21 and 21A, verbatim: "Due to the small number of
observations, it is not possible to calculate an accurate population estimate;
therefore, moose population numbers in these GHAs are reported as minimum
counts." Eleven moose and 29 moose are what was *seen*. Treating either as an
estimate — or ranking it against GHA 26's 1,405 — would be exactly the
false-comparison the architecture exists to refuse.

Manitoba also changed method: distance sampling replaced stratified random block
sampling after 2022, so figures either side of that change are not a series.

**No licence text was found** on or near the PDF. Commercial reuse is unknown,
not permitted-by-default.

### Nova Scotia — LICENCE_PENDING, and Cape Breton only **[reached]**

`Winter 2024 Cape Breton Moose Survey` reports density per **Moose Management
Zone** — 0.10, 0.09, 0.0, 0.01 and 0.58 moose/km² across zones 1–5 and the
national park. It is one ecosystem, one species, not a provincial programme, and
carries no licence text.

Nova Scotia's deer Pellet Group Inventory is **province-wide only** and its own
page says reporting is "Internal and available to public upon request" — there is
no download.

### Québec — NOT_PUBLISHED as open data **[reached]**

Données Québec holds harvest statistics and caribou range, and **no population
estimates**: a search for "inventaire aérien" returned zero results.

Per-zone aerial inventory reports do exist as PDFs, but on a domain with heavy
link rot — three candidate URLs returned **404** and one returned 200 without
being opened. Evidence was found for zones 17, 27 and 28 only.

This is the largest gap among the four biggest provinces: Québec has the best
harvest licence in Canada and no reachable population data at all.

### Newfoundland and Labrador — a disclaimer worth keeping **[reached]**

NL publishes interpolated moose **density mapping**, and says plainly that it is
not the estimate: "It is important to note that population estimates developed
from these aerial surveys do not rely on this mapping methodology." A visual
product derived from a spatial model is not the survey result, and the authority
is explicit. No tables or downloads are linked.

### Saskatchewan, New Brunswick, Prince Edward Island

**NOT FOUND** for Saskatchewan and New Brunswick — New Brunswick's big game
report was read in full (23 pages) and contains harvest tables, not population
estimates. Prince Edward Island was **not searched**, and this document does not
claim otherwise.

### Population: verdict

| Province | Verdict |
|---|---|
| Ontario | **USABLE** — per-WMU, XLSX, with 90% CI, OGL-Ontario |
| Alberta | PDF_ONLY — one report per WMU, licence fine |
| British Columbia | **LICENCE_BLOCKED** — "Access Only"; survey blocks, not units |
| Manitoba | LICENCE_PENDING — per-GHA, 3 areas in 2024, no licence text |
| Nova Scotia | LICENCE_PENDING — Cape Breton moose only, no licence text |
| Québec | NOT_PUBLISHED as open data |
| Newfoundland and Labrador | NOT_PUBLISHED — density mapping is explicitly not the estimate |
| Saskatchewan, New Brunswick | NOT FOUND |
| Prince Edward Island | NOT SEARCHED |

---

## Land cover — the habitat-model input (tier T4)

**Land cover is not habitat.** It is the input a habitat model is built from, and
the distinction is the whole of tier T4. This section records inputs; North
Ground holds no habitat model.

### Land Cover of Canada 2020 — USABLE, national, 30 m **[reached]**

| | |
|---|---|
| Authority | Natural Resources Canada, Canada Centre for Remote Sensing |
| Resolution | **30 m**, in the authority's own words |
| Coverage | National; 2010 and 2015 editions also exist |
| Format | GeoTIFF — confirmed HTTP 200, `image/tiff`, **2,107,707,760 bytes** |
| Licence | Open Government Licence – Canada |
| Commercial use | Allowed |

This closes the input gap. A **CLASSIFIED** habitat model — named associations
from published research, no invented weights — is buildable in Canada today on
one national 30 m raster under a commercial licence. That is precisely why the
CLASSIFIED/WEIGHTED distinction was worth the amendment.

Its resolution also fixes the ceiling: a model built on 30 m land cover is a
30 m model, and nothing downstream may be drawn finer.

### AAFC Annual Crop Inventory — USABLE, and agricultural **[reached]**

30 m, one raster per province per year, 2009–2025 (national from 2011),
OGL-Canada, commercial use permitted. The file directory was listed and real
filenames confirmed. Its **non-agricultural classes are coarse**, so it
complements the NRCan layer rather than replacing it.

### Provincial land cover — usable, and two cautions **[registry of the research pass]**

Ontario's Far North Land Cover and SOLRIS 2.0 are OGL-Ontario and commercially
usable. **Neither publishes a raster cell size.** Ontario states a map scale
(1:100,000) instead, and a scale is not a resolution — it was not converted into
one here, and must not be. Under the precision contract those are `POLYGON`
sources of unstated size until someone establishes it.

British Columbia's Vegetation Resource Inventory is open for the **historical
2002–2024** compilation under OGL-BC, while the **current-year 2025** layers are
"Access Only". Same programme, same province, opposite licences by year. Do not
assume the newest edition shares the older one's terms.

### Land cover: verdict

| Source | Verdict |
|---|---|
| NRCan Land Cover of Canada 2020 | **USABLE** — national, 30 m, OGL-Canada |
| AAFC Annual Crop Inventory | **USABLE** — 30 m, agricultural classes coarse |
| Ontario Far North / SOLRIS | USABLE, **resolution unstated** — treat as unestablished |
| BC VRI 2002–2024 | USABLE (OGL-BC); the 2025 layers are LICENCE_BLOCKED |

---

## Seasonal range

**Not researched.** Named here so its absence is visible rather than implied.

---

## The United States — Idaho and the federal layer

*Added 2026-09-23.* Idaho is the one U.S. state where North Ground serves both
boundaries and rules, so it is where U.S. evidence would first become useful.

### Idaho harvest — the best-structured data in this entire research effort, and LICENCE_BLOCKED **[reached]**

| | |
|---|---|
| Authority | Idaho Department of Fish and Game |
| Dataset | `{year} {Species} {General\|Controlled} Hunt Harvest Statistics` (Hunt Planner) |
| Evidence kind | Harvest, hunters, **hunter days**, success, antler class |
| Geography level | ZONE |
| Published unit | "Unit" — Game Management Unit |
| Period | 2000–2025 for deer, elk, bear, lion; turkey from 1996; wolf from 2009 |
| Format | Server-rendered HTML tables. **No CSV, no JSON, no API** |
| Licence | **Commercial use prohibited** |

Columns read from the live 2024 elk page: `Take Method, Unit, Harvest, Hunters,
Success%, Days, Antlered, Antlerless, %Spike, %6+Pts, Year` — 325 data rows.

This is the richest harvest structure found anywhere in this research. It has
what British Columbia has — hunters *and* days, so harvest per unit effort is
derivable — plus take method and antler class, per unit, twenty-six years deep.

And it cannot be used. Read verbatim at <https://idfg.idaho.gov/terms>:

> "Permission is granted to temporarily download one copy of the materials
> (information or software) on our Websites for personal, non-commercial
> transitory viewing only. This is the grant of a license, not a transfer of
> title, and under this license, you may not: modify or copy the materials; use
> the materials for any commercial purpose, or any public display (commercial or
> non-commercial); … or transfer the materials to another person or "mirror" the
> materials on any other server."

Three separate clauses bite: commercial use, copying, and mirroring on another
server. A formal request through <https://idfg.idaho.gov/data/request> is the
only route, and that is an owner decision.

**Hard line: Idaho deer is ONE species in this data.** Mule deer and white-tailed
deer are not separate records — whitetail share is a `%Whitetail` *column*. A
per-species Idaho deer figure must be derived from that percentage, with the
derivation and its denominator carried, or not stated at all.

### Idaho population estimates — PDF_ONLY and stale, under a different licence **[reached]**

IDFG's Surveys and Inventories statewide reports exist for elk, mule deer,
white-tailed deer, black bear, moose, pronghorn, sheep and goat — as PDFs, moved
off IDFG's own site to the Idaho Commission for Libraries, and the most recent
reachable are **2014–2016**. One was downloaded and confirmed genuine.

Their rights statement there is materially different and better: "Publication is
in the public domain. Copyright does not apply." That applies to the library's
copies, **not** to the Hunt Planner tables. One agency, two licences, depending
where the file is hosted — the same lesson Saskatchewan and British Columbia
taught, in a third form.

### Idaho GIS — USABLE, and a precision trap avoided **[reached]**

IDFG's open-data portal carries 37 feature services, **none of them harvest or
population**. Their licences state no commercial prohibition, only a no-warranty
disclaimer — again different from the website terms.

Its **Species Ranges** service is live and queryable, covering every Idaho game
species including ruffed, dusky, spruce and sharp-tailed grouse, with a `Season`
and a `Data_Source` per record. IDFG states the scale itself — "Should be used at
1:100000-scale" — and draws the distinction this architecture draws:

> "Species ranges provide a general representation of where a species might occur
> during its lifetime. It's important to distinguish these from species
> 'distribution models,' which pinpoint potential habitat within the range."

**The trap: IDFG's own sampling unit for mule deer is not the GMU.** Its Mule
Deer Data Analysis Units are "comprised of multiple Game Management Units… now
used as the sampling unit for mule deer management". A GMU-keyed mule deer
population layer would invent a resolution the authority does not use. This is
Ontario's elk problem and Alberta's WMU groups again, in a third jurisdiction —
the pattern is now established rather than incidental.

### U.S. federal datasets

**USGS GAP species habitat and range maps** — 30 m habitat maps and
sub-watershed range maps, marked **CC0 1.0**, covering elk, mule deer,
white-tailed deer, moose and black bear; ruffed grouse has a range map and no
habitat map was found. Two caveats that matter more than the licence. The models
are built on **2001 ground conditions** — 25 years stale. And USGS names
"determining species abundance" among inappropriate uses: GAP is a suitability
surface, and it belongs in a heat map only as a labelled habitat component,
never as the score. **Not reached** — ScienceBase returns HTTP 403 to this
environment, so file formats and sizes are unverified.

**NLCD** — 30 m, 1985–2025, **CONUS only** (Alaska and Hawaii planned), public
domain, and its WMS was confirmed live by a successful GetMap over Idaho. The
U.S. counterpart to Canada's NRCan land cover, and the T4 input for any U.S.
habitat model.

**USFWS Waterfowl Breeding Population and Habitat Survey** — the most completely
verified U.S. dataset here: stratum polygons (81 records) and per-stratum
densities (36,234 rows, 22 species codes, 2000–2026), CSV and shapefile,
federal work with no commercial restriction stated. **Its geography is the
traditional survey area** — prairie and boreal Canada, the Dakotas, Montana,
Alaska. It is not a national layer and not an Idaho layer, and must never be
presented as national duck density.

**PAD-US** public-land services are live; terms not verified. Context, not
species evidence.

### United States: verdict

| Source | Verdict |
|---|---|
| Idaho Hunt Planner harvest | **LICENCE_BLOCKED** — per-GMU, 26 years, hunters and days; commercial use prohibited |
| Idaho statewide survey reports | PDF_ONLY and stale (2014–2016); public domain at the library |
| Idaho Species Ranges service | **USABLE** — 1:100,000, range not distribution |
| Idaho GMU and DAU boundaries | **USABLE** — no commercial prohibition stated |
| USGS GAP habitat and range | **USABLE** (CC0), not reached; 2001 conditions; never an abundance claim |
| NLCD land cover | **USABLE** — 30 m, CONUS |
| USFWS WBPHS waterfowl | **USABLE** — stratum polygons and densities; not national |
| PAD-US | Live; terms NOT VERIFIED |

**The U.S. position mirrors Canada's exactly.** The best harvest data in this
entire research effort is in the one state North Ground serves, at the right
resolution, with the effort denominator Canada mostly lacks — and it is locked
behind a terms-of-use page. Federal range, habitat and land cover are open and
usable; state harvest is not.

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

**7. Birds have nothing in Canada.** No upland or waterfowl harvest in Alberta,
no birds in Québec's range file, nothing federal newer than 1957, EBAR empty and
eBird barred. Ruffed grouse has certified rules in Hunt and no evidence layer
anywhere in Canada. It does have an Idaho range polygon and a USGS GAP range
map, so the first grouse evidence North Ground could hold would be American.

**8. The same pattern holds on both sides of the border, and it is a licence
pattern.** Canada: eight provinces publish zone-resolution harvest, three are
usable. United States: the one state North Ground serves publishes the best
harvest structure found in this entire effort — per-unit, twenty-six years,
hunters *and* days — under terms forbidding commercial use. Meanwhile federal
land cover, federal range and federal waterfowl surveys are open on both sides.
**Authorities publish their geography and their science openly, and reserve
their hunter data.** That is the shape of the problem, and no amount of
engineering changes it.

**9. Three jurisdictions have now shown the same precision trap.** Ontario
reports elk by Elk Harvest Area, Alberta by groups of WMUs, and Idaho manages
mule deer by Data Analysis Units — none of which is the unit the map draws.
Joining any of them to the drawn unit would invent evidence. This is routine,
not exceptional, and `reportedAtLargerArea` is the contract that carries it.

---

## What this document does not do

It does not certify a source; Canadian source certification belongs to the Canada
workstream. It does not grant or assume a licence. It does not draft
correspondence. It does not add a dataset to the registry. And it does not claim
that an absence of published evidence means an absence of animals — for a hunter
reading a map, those must never look the same.
