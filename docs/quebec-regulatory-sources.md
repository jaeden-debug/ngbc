# Québec — what the authority actually publishes

Read before encoding a Québec regulatory bundle. Everything here was read from
the ministry's own services and pages on **2026-09-20** (America/Toronto). Every
claim says how it is known. Nothing here is inferred from Ontario.

The short version: Québec's geometry is **found, verified and readable**, and its
regulatory text is **significantly more conditional than Ontario's**. The season
tables turn on the implement, the animal class, the calendar year and, for
antlerless moose, a draw. Three of those Ontario also has. The fourth — a
segment that changes between the two years printed in the same cell — it does
not.

---

## 1. Geometry — verified

**Service.** `https://servicesvecto3.mern.gouv.qc.ca/geoserver/SmartFaunePub/ows`,
layer `SmartFaunePub:Zone_chasse_da3_sefaq`. WFS 2.0.0, `application/json`
output, native reprojection from EPSG:32198 to EPSG:4326 on request.
`AccessConstraints: NONE`, `Fees: NONE`, provider MFFP.

**How it was found.** Not in the open-data portal — searches there for *zones de
chasse*, *faune chasse* and *title:chasse* return no hunting-zone boundary
dataset, which is what the registry used to record as "not available as open
data". It is the GeoServer behind the government's own *Forêt ouverte* map, and
it was located by reading that map's published layer context
(`/contexts/_chasse.json`).

**Measured, by a full live read through `createQuebecZoneSource`:**

| | |
|---|---|
| Designations | 59 |
| Numeric zones | 28 — 1 to 24 and 26 to 29 |
| Source polygons | 9,509 |
| Vertices | 2,424,980 |
| Geometry problems | 0 (every ring closed, every coordinate inside Québec) |
| Full fetch | ~65 s at 500 features per page |

The 28 numeric zones match quebec.ca's published "28 hunting zones, 1 to 24 and
26 to 29" exactly. **There is no zone 25** — it exists for fishing only.

**The part is the regulatory unit, not the number.** The authority divides a
numbered zone into named parts and writes its season tables per part: 19N, 19SE,
19SO and 19SNO are four different seasons. Keying on `No_zone` would merge them.

**Encoding defect.** `Partie_zon` is served as CP850 bytes decoded as Latin-1:
`Île` arrives as `×le` (CP850 0xD7), `Beaupré` as `Beaupr` + 0x82. The
neighbouring `Chasse_Interdite` layer returns accents correctly, so it is this
layer's attributes, not the service. `repairPartName` reverses it through the
code page itself. Verified: all 59 designations come back as correct French.

**Sibling layers on the same server**, not yet reviewed:
`Chasse_Interdite` (130 hunting-prohibited areas — this is the protected-area
gap), `TFS` (structured territories: zecs, réserves fauniques, pourvoiries),
`UGAF`, `secteur_chasse_anticosti`, `DISTRICTS_PFQ`, `LIMITE_REGIONS_PFQ`,
`Bureaux_protection_faune`, `Chemins_Forestiers`.

**Licence caution.** The Données Québec copies of the structured-territory
layers are CC-BY-NC-ND 4.0, whose non-commercial and no-derivatives terms would
not permit product use. The GeoServer itself declares `AccessConstraints: NONE`.
Which governs is **unsettled** and must be settled before those are ingested.

---

## 2. The 59 designations

Territories that are **not** compass subdivisions, and therefore are never
swept into their parent label:

| Designation | Part | What it is |
|---|---|---|
| `08NMR` | Nord (Montagne de Rigaud) | Named territory; deer gets its own row |
| `08NZ` | Nord ZSR | Enhanced surveillance zone — see §5 |
| `09OZ` | Ouest ZSR | Enhanced surveillance zone |
| `10EZ` | Est ZSR | Enhanced surveillance zone |
| `27ESB` / `27OSB` | Est / Ouest (Seigneurie de Beaupré) | Named territory |
| `02EI` `02OI` `03EI` `03OI` `27EI` `27OI` | … (Île) | St Lawrence islands |

The six `(Île)` designations correspond **exactly** to the deer table's row
"l'ensemble des îles et îlots du fleuve Saint-Laurent en aval du pont
Pierre-Laporte compris dans les zones 2 est, 2 ouest, 3 est, 3 ouest, 27 est,
27 ouest". That correspondence is measured, not assumed.

`19SE` alone is **8,091 polygons** — islands. One regulatory area, not 8,091.

---

## 3. Season pages

French is the authoritative text; the English pages are translations.

- `quebec.ca/tourisme-loisirs-sport/activites-sportives-et-de-plein-air/chasse-sportive/periodes-limites/`
  - `orignal`, `cerf-virginie`, `ours-noir`, `dindon-sauvage`, `petit-gibier`,
    `grenouilles`, `reserves-fauniques`

**Table shape** (all species): `Zone où la chasse est permise | Segment |
Période de chasse 2026 | Période de chasse 2027`.

- **Implement is a section heading, not a column.** "Périodes de chasse à
  l'arbalète et à l'arc", "à l'arc", "aux armes à feu, à l'arbalète et à l'arc".
  Deer splits further: "au fusil, à l'arme à chargement par la bouche, à
  l'arbalète et à l'arc" is a different section from "aux armes à feu (carabine,
  fusil, arme à chargement par la bouche), à l'arbalète et à l'arc".
- **Segment is the animal class**: "Orignal avec bois" / "Orignal", "Cerf sans
  bois", and so on.
- **A cell can carry two years' segments at once.** Moose zone 13 firearms reads
  "2026 Orignal avec bois / 2027 Orignal". The segment differs *by year* inside
  one row. Flattening it produces a wrong animal class for one of the two years.
- Moose and deer both carry **zec tables** keyed by zec name, not zone. Those
  are different spatial units and are not in the zone layer.
- Deer carries a **"Périodes de chasse réservée à la relève"** section — a
  youth-only season. That is a hunter-attribute condition, not a zone one.

---

## 4. Conditions Québec's rules turn on

Beyond Ontario's residency/implement/tag/season-type:

1. **Implement, with a footnote that narrows the heading.** Moose: *"L'utilisation
   de l'arbalète est interdite dans les zones 22, 23 et 24."* This sits under a
   section headed "armes à feu, **arbalète** et arc". Stored flat, that rule says
   a crossbow is legal in zone 22. This is the Ontario WMU-71 failure again, in
   French.

2. **Antlerless moose — a drawn permit, with three different regimes.**
   - Zones 1–12, 14–16, 22, 26, 27, plus réserves fauniques and certain zecs:
     requires a permit won at the **tirage au sort**.
   - Zones 13, 18, 28: **alternating years** — closed 2026 (restrictive), open
     2027 (permissive). Zone 13 is *also* open during the bow/crossbow season in
     2026.
   - Zones 19 sud and 29: open every year, all segments, **no** special permit.

3. **Per-implement antlerless exceptions**, which cut across the above:
   - Bow/crossbow seasons — antlerless without a permit in 2026 **and** 2027:
     zone 13, the parts within 19 sud, zone 29. In 2027 only: 18 and 28.
   - Firearms seasons — antlerless without a permit in 2026 **and** 2027: the
     parts within 19 sud, zone 29. In 2027 only: 13, 18, 28.

4. **Youth-reserved seasons** (deer, "relève").

---

## 5. Things that must not be answered

**Zone 17 moose.** *"les activités de chasse à l'orignal dans la zone 17 seront
limitées aux prélèvements des Autochtones pour la chasse de subsistance. La
chasse sportive est interdite, et ce, jusqu'à nouvel ordre."* Under the
James Bay and Northern Québec Agreement, following the 2021 aerial surveys.

Sport hunting is **closed**. The harvest that continues is Indigenous
subsistence under a treaty, which North Ground does not evaluate and must never
present as a season. Nothing about a person's Indigenous status may be inferred
from their location, account or anything else.

**ZSR — zone de surveillance rehaussée.** `08NZ`, `09OZ`, `10EZ`. The enhanced
surveillance zone for chronic wasting disease (*maladie débilitante chronique*),
created around the 2018 infected farm and covering 17 municipalities: Grenville,
Notre-Dame-de-Bonsecours, Notre-Dame-de-la-Paix, Fassett, Namur,
Saint-Émile-de-Suffolk, Amherst, Huberdeau, Arundel, Barkmere, Montcalm,
Lac-des-Seize-Îles, Wentworth-Nord, Brownsburg-Chatham, Grenville-sur-la-Rouge,
Harrington, Boileau.

**No season table names any ZSR designation.** Antlerless deer permits are
issued there specifically to hold density down, and the area carries its own
registration and transport obligations that live on the CWD pages, not the
season pages. A hunter standing in a ZSR needs to be told they are in one.
Answering a ZSR with its parent zone's season would be a false answer.

**The authority's own caveat on sub-zone territories.** *"La chasse peut être
interdite dans certains territoires particuliers de zones données. Si elle est
permise, ses modalités peuvent différer de celles de la zone de chasse où se
trouvent ces territoires. Vous devez donc communiquer avec la personne
responsable des territoires en question."* This is the ministry stating that a
zone-level season does not settle the question everywhere inside the zone. It is
the reason `Chasse_Interdite` matters, and it belongs in any Québec answer.

---

## 6. Label resolution — measured

`resolveZoneLabel` (`src/lib/hunt/ingestion/quebec-zone-labels.ts`) was run over
**all 66 zone labels** the five species pages publish.

**62 resolve. 4 refuse, correctly:**

| Label | Why it refuses |
|---|---|
| `Île-du-Havre-Aubert` | In the Îles-de-la-Madeleine; the layer publishes no designation for it |
| `Dans les zones, les zecs et les réserves fauniques` | A table header, not a zone label |
| `Partie est et partie ouest de 19 sud (sauf la partie nord-ouest), 29` ×2 | Coordinated ellipsis — distributing the elided tail is where a parser starts inventing |

Each refusal stops a build and names what the layer does publish. The two
ellipsis rows need an explicit, evidence-carrying mapping in the bundle; they
mean 19SE + 19SO + 29, but that should be written down by a person, not guessed
by a regex.

**Exclusions the geometry cannot express** are carried verbatim in French rather
than dropped or silently applied: `sauf les cantons de Macpès et Duquesne`,
`sauf l'Île Verte`, `sauf les Îles-de-la-Madeleine`, `sauf l'île d'Orléans`,
`sauf la partie ouest de la zone 20`, `excluant le territoire de la montagne de
Rigaud`.

---

## 7. What is still open

- **Nothing is ingested into PostGIS**, parity-certified, or served. Every Québec
  query still answers UNKNOWN. The adapter exists; the coverage does not.
- **No regulatory bundle exists.** No Québec season is certified.
- The **zec and réserve faunique tables** on the moose and deer pages have no
  spatial home until `TFS` is ingested and its licence settled.
- The **ZSR obligations** are on the CWD pages, which have not been read as a
  regulatory source.
- `Chasse_Interdite` (130 areas) has not been reviewed.
- The **two-segments-in-one-cell** shape has no representation in the current
  rule schema. `applies_when` handles implement and residency; a segment that
  changes between the two published years does not fit it yet.
