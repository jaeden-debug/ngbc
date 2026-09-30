# Where the animals are — density evidence finer than a management zone

**Status:** research only. Nothing here is ingested, encoded or rendered. This
document is the evidence for the next lane's sequencing decision.
**Read:** 2026-09-29, from each authority's own catalogue, licence page and data
files. Every figure below was computed from a file that was downloaded, not from
a description of it.
**Question asked:** is there authoritative evidence of where a species actually
is, at a resolution finer than a hunting zone, under a licence North Ground may
use commercially?

---

## The answer

**One dataset qualifies today: the Canadian Wildlife Service's Eastern Waterfowl
Survey (EWS25).** It is 332 published 25 km² plots with per-observation
coordinates, under the Open Government Licence – Canada, covering Québec,
Ontario and the Maritimes for eight species Hunt already serves.

**No qualifying big-game dataset was found.** Every moose and deer programme
read — Ontario, Québec, Alberta, British Columbia, Manitoba — publishes its
results at management-zone resolution or coarser, keeps the finer geometry
unpublished, or licenses it against commercial use. Alberta is the best of them
and is still zone-resolution.

That asymmetry is the finding. **Waterfowl are surveyed on plots; ungulates are
surveyed on zones.** A hunter asking "where in WMU 57 are the moose" cannot be
answered from public data at any resolution finer than WMU 57, and no amount of
rendering changes that.

---

## The matrix

| Source | Authority | Measures | Unit | Geography | Published as vector? | Years | Licence | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Eastern Waterfowl Survey (EWS25)** | CWS / ECCC | breeding waterfowl counted on helicopter plots | birds per 25 km² plot; observations carry lat/lon | 332 square plots, 25 km² each | **Yes** — KMZ + file geodatabase, with `areaHa` 2500 on every plot | 1990–2025, annual, 3-year rotation | **OGL‑Canada** | **QUALIFIES** |
| Waterfowl Breeding Population & Habitat Survey | USFWS + CWS | total indicated birds | **birds per square mile** | survey strata (>50, continental) | strata map published; strata are **larger** than a hunting zone | 2000– | US federal, public domain | Better metric, **coarser** geography |
| Alberta WMU aerial ungulate surveys | Alberta Environment and Protected Areas | mule deer, white‑tailed deer, moose | **animals/km², with 90% CI** | the WMU | n/a — PDF reports, 126 of them | current, rolling | **OGL–Alberta** | Better metric, **same** resolution |
| Ontario moose population monitoring summaries | Ontario MNR | moose population estimate + composition | count, with 90% relative margin | `SurveyArea` = WMU, Amalgamated or **Landscape** | results in XLSX; geography by identifier | 1975–2026 | **OGL–Ontario** | **Same or coarser.** Sub‑WMU rows exist for WMUs 51 and 52 only, 1976–2001, with no published sub‑area boundary |
| Ontario moose aerial inventory plot grid | Ontario MNR | — | — | 23,550 plots, uniformly `PLOT_SIZE` 25 km² | **Yes** — ArcGIS FeatureServer | current | OGL–Ontario | **Sampling frame, not evidence.** Carries no count, year or density |
| Québec inventaires aériens de l'orignal | MELCCFP | moose density | orignaux/10 km², with CI | the hunting zone; occasionally a named zec/réserve/pourvoirie | no — PDF reports and press releases | irregular, by zone | see below | **Same resolution**, except a few sub‑zone cases |
| Québec Territoires fauniques structurés (TFS) | MELCCFP | zec / réserve / pourvoirie boundaries | — | sub‑zone polygons | yes | 2025 | **CC‑BY‑NC‑ND 4.0** | **LICENCE_BLOCKED** as packaged — but see TRQ |
| Québec Couche des territoires récréatifs (TRQ) | MRNF | the same territories | — | sub‑zone polygons | yes — FGDB + ArcGIS REST + WMS | annual | **CC‑BY 4.0** | Usable geography, **no animal evidence attached** |
| BC Wildlife Species Inventory (observations, study areas, Skeena moose SRB) | BC Ministry / Knowledge Management | survey observations, stratified random block moose surveys | counts | study areas, survey blocks | warehouse only; Skeena export disabled | current | **"Access Only" — "reproduction is not permitted without written permission"** | **LICENCE_BLOCKED** |
| eBird Status & Trends | Cornell Lab of Ornithology | modelled **relative abundance**, not density | unitless relative abundance, 3 km cells | 3 km raster | yes, on request | weekly, current | **Non‑commercial; commercial use needs separate permission** | **LICENCE_BLOCKED** by default; metric may never be called density |
| Manitoba geoportal | Manitoba | — | — | — | — | — | custom | **Nothing exists.** Hunting areas, closed lands and CWD zones only; no survey or density dataset |

---

## EWS25, measured rather than described

Downloaded and profiled on 2026-09-29:

- **158,185 observation records**, 1990–2025, 193 species codes.
- **332 unique plots**, each **25 km²** (`areaHa` 2500, `areaM2` 25 000 000,
  5 000 m × 5 000 m squares), by province: **QC 166, NL 52, ON 44, NB 40,
  NS 30**. No plots in PE, and none west of Ontario.
- Every observation carries `lat`/`lon`, species, sex counts, total, breeding
  evidence, plot id and year. **This is POINT evidence with real coordinates**,
  aggregable to a 25 km² polygon with the publisher's own denominator — exactly
  what `intelligence/rendering.ts` implements and nothing feeds.
- **Served species, by number of plots they have ever been recorded on, and
  records since 2020:** American Black Duck 331 / 2,950 · Green‑winged Teal
  325 / 1,086 · Ring‑necked Duck 321 / 2,185 · Canada Goose 306 / 1,719 ·
  Common Goldeneye 295 / 1,169 · Mallard 256 / 1,055 · Wood Duck 199 / 384 ·
  Bufflehead 167 / 316. Below that it thins fast — Gadwall 9 plots — and a
  species that thin must not be drawn.
- **Recency, from the rotation:** 155 plots last surveyed 2025, 82 in 2024,
  78 in 2023 — 315 of 332 within three years. The remaining 17 run back to 2010
  and are stale in their own right, not merely unvisited.
- **A trap in the file:** 3,220 of 158,185 rows (2.0%) carry `9999` for latitude
  and longitude as a missing-value sentinel. An ingest that trusts the column
  puts birds in the Pacific. The real extent is lat 43.64–54.74, lon −85.64 to
  −52.92.

### What it may and may not be used to claim

- **May:** *the authority counted this many birds of this species on this
  5 × 5 km plot in this year.* A density per plot, with the publisher's own area.
- **May not:** anything between the plots. 332 plots × 25 km² is **8,300 km²**
  across five provinces — a sample, not a coverage. A smooth surface interpolated
  across the gaps would be a model, not evidence, and §41B forbids a
  visualisation finer than its evidence.
- **May not:** *this is where the ducks will be in October.* The EWS is a **May
  breeding** survey. Breeding distribution is not the autumn distribution a
  hunter is asking about, and saying so is part of the record, not a footnote.
- The metric is **breeding birds on a plot**, and `brType`/`brCnt` carry the
  breeding evidence. It is not a population estimate and must not be relabelled
  as one.

---

## What does not exist, so the next lane does not look again

- **Manitoba publishes no wildlife survey or density dataset at all.** Its
  geoportal carries hunting areas, closed lands, provincial forests and CWD
  zones. Searched: moose, ungulate, wildlife.
- **Ontario's aerial inventory is moving away from sub-zone resolution, not
  toward it.** The modern `Landscape` scale (2017–2026, 19 landscape zones) is
  coarser than a WMU. The `Sub-WMU` scale is two units and stops in 2001.
- **Ontario's plot grid cannot be painted.** It has 23,550 plot polygons and not
  one count; the results workbook aggregates to the survey area and never to the
  plot.
- **Québec publishes no aerial-inventory results as data.** Données Québec's only
  moose dataset is `Statistiques historiques de chasse du gros gibier` — harvest,
  which Hunt already holds. The densities exist in PDF reports and press releases.
- **Québec's own zone-level report says the density varies inside the zone and
  illustrates it with a harvest-density map.** That map is a record of hunting,
  drawn at sub-zone resolution. It is precisely the thing that must not be
  presented as where the animals are.
- **A Québec zone density does not even cover its zone:** the zone 1 inventory
  excludes the réserves fauniques and the parks, in the authority's own words.
- **The one Québec sub-zone case is not attributable as published.** The 2021
  Bas‑Saint‑Laurent survey of four territories reports « les densités moyennes
  estimées se situent entre 10,1 et 12,9 orignaux/10 km2 » — a range across four
  named territories, with no per-territory figure. Four polygons and one interval
  cannot be joined.
- **British Columbia's boundaries are open and its animals are not.** Wildlife
  Management Units are OGL–BC, which is why Hunt draws them; every wildlife
  survey dataset is licence 22, "Access Only", whose terms say reproduction
  requires written permission. The Skeena moose stratified-random-block surveys —
  genuinely sub-zone evidence — are in the warehouse with export disabled.

---

## Recommendation

**First target: EWS25.** It is the only candidate that clears all four bars at
once — sub-zone geography, a real denominator, an open commercial licence, and
species Hunt already serves. It is also small: one 25 km² plot layer of 332
polygons and ~158 k observation rows, which is a serialized ingest measured in
minutes, not the geometry loads that have stalled the database before.

Ingest it as **plot-polygon evidence at 25 km², never as a continuous surface**,
labelled for what it measures — breeding waterfowl counted on a plot in May —
with the plot's own year, and drawn only where a plot exists.

*Done 2026-09-30:* 187 unit figures read from the reports, shown in each
Alberta unit's card and never painted; what was read, refused and not read is
in `alberta-ungulate-density-read.md`.

**Second, and separately: Alberta's 126 WMU survey reports.** They do not improve
resolution and should not be sold as if they did. They replace a harvest count
with **animals per km², with a 90% confidence interval, by species**, under a
licence that permits commercial use. That is a straight upgrade of what the
existing zone shade *means*, and §41B already requires the metric to be named for
what it measures. It is PDF extraction, so it is slower and needs the usual
verbatim-and-provenance discipline.

**Do not pursue** BC survey data or eBird Status & Trends without written
permission; both are worth an authorization request in the same batch as the
outstanding U.S. map licences, and neither should be planned around until one
comes back.

**And say the negative out loud in the product.** For moose, deer, elk and bear —
the animals most hunters open Hunt for — there is no public evidence finer than
the zone. The honest interface keeps drawing zone-resolution evidence and names
it as a record of hunting, which is what §41B already says. A smooth blob over a
zone we hold one number for would look exactly like the mockup and would send a
hunter somewhere North Ground invented.

---

## Sources

- Eastern Waterfowl Survey (EWS25), ECCC — https://open.canada.ca/data/en/dataset (search "Eastern Waterfowl Survey"), DOI 10.18164/b8c79d2f-3bd7-4f26-8102-be268be1582b, OGL‑Canada
- WBPHS stratum densities by species, USFWS — https://catalog.data.gov/dataset/wbphs-stratum-densities-by-species
- Moose population monitoring summaries and Ontario moose aerial inventory plot grid, Ontario MNR — https://data.ontario.ca, OGL–Ontario; plot service `LIO_OPEN_DATA/LIO_Open07/MapServer/35`
- Wildlife Management Unit aerial ungulate survey reports, Alberta — https://open.alberta.ca, OGL–Alberta (WMU 116, 2025 read in full)
- État de situation de la population d'orignaux en 2024 dans la zone de chasse 1, MELCCFP — cdn-contenu.quebec.ca
- Inventaire aérien de l'orignal, quatre territoires fauniques du Bas‑Saint‑Laurent, hiver 2021 — quebec.ca
- Territoires fauniques structurés (CC‑BY‑NC‑ND) and Couche des territoires récréatifs du Québec (CC‑BY) — donneesquebec.ca
- Wildlife Species Inventory datasets and the "Access Only" licence, BC — catalogue.data.gov.bc.ca
- eBird Status and Trends products terms of use — science.ebird.org
- Manitoba geoportal — geoportal.gov.mb.ca (searched: moose, ungulate, wildlife)
