# New Brunswick — the research, done; the bundle, not yet built

**Written 2026-09-30, after Newfoundland landed.** Every source below was
retrieved and read. Nothing here is inferred from a guide or a summary. Read this
before re-fetching anything: two of the findings cost real time and one of them
would have made a certified bundle wrong.

New Brunswick is the EASIEST remaining Canadian province, and the reason is
structural: **its seasons are standing relative rules in a consolidated
regulation, not an annual order.** Every window in s. 11(1) of the Hunting
Regulation ends in the word "annually". There is no NLR 43/26 equivalent to
re-ingest each year, so one build serves every year until the regulation is
amended.

## The instruments, all readable, all official

`laws.gnb.ca` serves consolidated regulations as HTML at `/en/showdoc/cr/<number>`
and acts at `/en/showdoc/cs/<chapter>`. **Both paths are permitted**; what
`robots.txt` disallows is `/en/search`, `/en/searchadvanced`, `/en/result`,
`/en/showPdf`, `/en/pdf`, `/en/epub`, `/en/showVersion`, `/en/version` and
`/en/resource`, in both languages. So the regulation text is reachable and the
PDF and the search are not. `/en/tdm` and `/en/tdm/cr` both return HTTP 500;
`/en/browse?letter=F` works.

Sixteen regulations are made under the **Fish and Wildlife Act, SNB 1980
c. F-14.1** (`/en/showdoc/cs/F-14.1`, 603 KB). The seven that matter:

| Number | Title | Retrieved | Consolidated to |
|---|---|---|---|
| 84-133 | **Hunting** | 293 KB | **26 July 2024** |
| 94-47 | **Moose Hunting** | 258 KB | **21 April 2026** |
| 2021-30 | **Wild Turkey Hunting** | 133 KB | **30 March 2026** |
| 81-58 | **Hunter Orange** | 31 KB | 24 August 2021 |
| 94-43 | Wildlife Refuges and Wildlife Management Areas | 102 KB | 5 June 2006 |
| 89-106 | Posting of Signs on Land | 35 KB | — |
| 84-124 | Fur Harvesting | — | not retrieved |

The others: 82-103 General Angling, 84-125 Pheasant Preserves, 92-74 Exotic
Wildlife, 97-141 Nuisance Wildlife Control, 2002-6 Wildlife Trust Fund and
Wildlife Council, 2005-138 Forensic Analysis, 2007-75 Game Bird Farm Licence,
2011-70 Hunting and Fishing Guides Licence, 2015-4 Registration Procedure.

### CURRENCY: the page banner is wrong and the per-regulation note is right

Every page on `laws.gnb.ca` prints **"Current to 1 January 2024"** in its
header — including the Act's and the Hunting Regulation's. That banner is
generic and it is NOT the consolidation date. Each regulation ends with its own
note: "N.B. This Regulation is consolidated to July 26, 2024", and the Moose
Hunting Regulation's says 21 April 2026.

The Hunting Regulation also cites amendment **2024-42** in s. 11(1)'s own
amendment history, which a document "current to 1 January 2024" could not
contain. **Trust the per-regulation note; the banner is not a currency
statement.** This is the `check-currency-before-comparing` failure in the
unusual direction — a source more current than its own header claims — and
recording NB as two years stale would have been an unnecessary refusal under §8.

## The season table, verbatim in substance, from 84-133 s. 11(1)

"Wildlife may be hunted as follows:"

- **(a) antlered deer and antlerless deer** — "for a period of eight consecutive
  weeks beginning on the first Monday in October annually", subject to ss. 3.1,
  3.11, 11.1, 11.2 and 11.3.
- **(a.1) bear** — "from the third Monday in April until the last Saturday in
  June, inclusive, annually AND from the first day in September until the first
  Saturday in November, inclusive, annually". Two windows.
- **(b) varying hare**, with or without a dog of any breed — 1 October to the
  last day in February.
- **(b.1) squirrel** — 1 October to the last day in February.
- **(b.2) raccoon** — 1 October to 31 December.
- **(b.3) skunk** — 1 October to 31 December.
- **(c) groundhog, coyote and crow** — 1 January to "the Saturday before the last
  full week of September" AND 1 October to 31 December. Two windows.
- **(c.1) cormorant** — 1 March to the Saturday before the last full week of
  September, AND the federal duck open season under the Migratory Birds
  Regulations. The second window therefore DEPENDS ON THE FEDERAL LAYER, which is
  unmet — so cormorant's second window is not derivable yet.
- **(c.2) male ring-necked pheasant** — "two consecutive weeks beginning on the
  fourth Monday in October annually". Male only, by the paragraph's own words.
- **(e) spruce grouse and ruffed grouse** — 1 October to 31 December.

Paragraphs (d), (f) and (g) are repealed by 84-213 and must not be resurrected.

### Three zone-specific deer rules, in s. 11.1 — the reason NB needs its zones

- **11.1(1): "No person shall hunt antlered deer in wildlife management zone 4,
  5 or 9."** A flat closure in three of the 27 zones.
- **11.1(3): "A person may hunt only antlered deer in wildlife management zone 1,
  2 or 3 for a period of five consecutive weeks only beginning on the first
  Monday in October annually."** Five weeks, not eight, and antlered only.
- **11.1(2)**: no antlerless deer in any zone where the Minister has set a quota
  of zero under s. 3.1(4.1). A ministerial determination, published nowhere in
  the regulation — the Nova Scotia pattern, and it must be UNKNOWN per zone
  unless the determination is located.

So NB deer is genuinely three different answers by zone: eight weeks either-sex
in most zones, five weeks antlered-only in 1–3, and no antlered season at all in
4, 5 and 9.

### Method restrictions that change the answer

- **11.2: "No person shall hunt antlered deer or antlerless deer for the first
  three consecutive weeks beginning on the first Monday of October except by
  means of a bow or crossbow."** Unlike Newfoundland, the crossbow IS included.
- **11.3(1)**: a muzzle-loading firearm authorization holder may hunt only with a
  muzzle-loader during the period in s. 3.11(1) — read s. 3.11 for that period.
- **9.1**: ring-necked pheasant only with a bow, a crossbow, or a shotgun no
  larger than 10 gauge with shot no larger than #2.
- **3.02**: a 16- or 17-year-old licence holder may not hunt with a centre-fire or
  rim-fire rifle .23 calibre or larger, or a shotgun with ball, slug, lead shot
  larger than BB or steel shot larger than F, unless accompanied by an adult.
- **6(3)**: no shooting a female bear accompanied by cubs from the third Monday
  in April until the last day in June.

### Moose: a five-day season, defined as a rule

94-47 s. 2 defines **"moose season"** as "with reference to any year, … the
Tuesday, Wednesday, Thursday, Friday and Saturday of the last full week of
September". s. 3: the wildlife management zones are the same as the Hunting
Regulation's. s. 5(1): the Minister may set an annual resident quota per zone,
varying by zone — another ministerial determination, so quota is UNKNOWN unless
located. Licences are by random computer draw (s. 9(2)) with an outfitter stream
(s. 9.1(1)(b)).

### Hunter orange: a dedicated regulation, with a real minimum

81-58, in full, and this is exactly what §41A's Ready to Hunt asks for:

- **s. 3(1)**: every person hunting, and every licensed guide accompanying a
  hunter, shall wear **(a) a solid hunter orange hat** and **(b) above the waist,
  a solid hunter orange or camouflage blaze orange exterior garment of which not
  less than 2 580 cm² in total is exposed to view and clearly visible from all
  directions.**
- **"hunter orange"** is defined instrumentally: "a colour having an 'L' value of
  not less than +55.0 Judd units, 'a' values of not less than +65.0 Judd units
  and 'b' values of not less than +30.0 Judd units as determined by a HunterLab
  colour measuring instrument."
- **"camouflage blaze orange"** means a camouflage pattern containing at least
  50% hunter orange.
- **s. 3(2) exemption**: does not apply to a person hunting antlered or antlerless
  deer with a bow or crossbow during the three consecutive weeks beginning the
  first Monday in October **when hunting from a tree stand or ground blind** —
  both defined in s. 2. The exemption is conditional on the stand, not on the
  weapon alone.
- **s. 4**: does not apply to persons authorized to hunt raccoons at night, to
  waterfowl hunters, or to licensed guides in their company.
- **s. 5**: the Regulation applies from 1 September to 31 December inclusive each
  year. So orange is NOT required in the April–June bear season.

### Licence classes worth modelling

From 84-133 s. 3(1) and ss. 5–6: class I (non-resident, $173), class II, class
III (resident deer), class IV, minor's licence, resident and non-resident bear
licences, and a **guide exemption licence** ($150, s. 3.011) where the Minister
authorizes a non-resident to hunt unaccompanied. A non-resident bear licence
holder may obtain a SECOND one after registering the first bear (s. 3.2(19),
s. 6(2.4)). s. 5(2): a class I or III licence authorizes one antlered deer **in
any one wildlife management zone**; the antlerless authorization names its zone
(s. 3.1(1)(b), s. 3.1(10)(b)(ii)).

Licence expiry is not a licence year: s. 4(1) has class I–IV and minor's licences
expiring "annually" on a date tied to "the Saturday before the last full week of
September", and s. 4(4) has bear licences expiring "seven weeks after the first
Monday in October". Two different bases — record them, do not normalise.

## The geography

27 Wildlife Management Zones, designations "1" through "27", parity-certified
2026-09-22 (118/118 testable points, nine degenerate holes below tolerance
recorded as untestable). `layer:ca-nb-wmz`, stored geometry, serving, from
`https://gis-erd-der.gnb.ca/server/rest/services/OpenData/WMZ/MapServer/0` under
the New Brunswick Open Government Licence. `rulesServing` is not yet set.

84-133 s. 12 establishes the zones in the regulation's own words; read it before
building, because the layer is the province's digital product OF s. 12 and s. 12
controls.

## What to do, in order

1. Read 84-133 s. 12 (zone establishment), s. 3.11 (the muzzle-loader period) and
   s. 3.1(4) (the antlerless quota mechanism).
2. Build `content/regulatory/ca-nb-2026.json` with a
   `scripts/build-new-brunswick-regulations.mjs` that holds the ORDINAL RULES and
   derives the 2026 dates, keeping both forms — Nova Scotia's
   `relativeDateRules` pattern, which exists for exactly this.
3. `units` must be `{identifier, zoneId}` pairs and `geography.include.ghas` must
   hold the IDENTIFIERS ("1" … "27"). **This is the defect that made Nova Scotia
   answer CLOSED across the province.** `engine-answers-somewhere.test.ts` will
   catch it, and the NB bundle has to be added to that file's `WIRED` list or its
   positive control will fail — which is the point.
4. Legal hours: check 84-133 and the Act for a night provision. New Brunswick is
   single-timezone (`America/Moncton` is already in `SINGLE_ZONE_JURISDICTIONS`),
   so a computed window is available for the whole province — unlike Newfoundland.
5. Hunter orange is a first-class Ready to Hunt fact here, with 2 580 cm² as the
   law's actual minimum and the tree-stand exemption as a genuine condition.
6. Ministerial determinations to locate or leave UNKNOWN: the antlerless deer
   quota per zone, and the resident moose quota per zone.

## §44 source-rights record, as established

`accessState` PUBLIC_READABLE for `/en/showdoc/*`; `reuseState` UNSTATED (no
licence notice located on any regulation page); `archiveState` UNCONFIRMED;
`derivedFactsState` USABLE; `authorityLevel` PRIMARY_GOVERNMENT; `termsStatus`
NOT_LOCATED; `retrievalMethod` OFFICIAL_HTML. The GIS layer is separate and
licensed: New Brunswick Open Government Licence, `reuseState` GRANTED.

---

## Added after the first pass: the Act's own provisions, which decide two things

### Absence means CLOSED, on two provisions read together

- **Fish and Wildlife Act s. 34(2)(a)**: "Every person commits an offence who
  hunts wildlife, other than beaver, bobcat, fisher, marten, mink, otter, raccoon
  or red fox unless authorized by licence issued under this Act or the
  regulations". Paragraph (b) says the same for the eight species it excepts, so
  between them every wildlife species needs a licence.
- **84-133 s. 11(1)** opens "**Wildlife may be hunted as follows:**" and then
  enumerates. It is an exhaustive grant, not a list of examples.

So a species or a period s. 11(1) does not name has no authorization behind it and
is CLOSED. There is no "closed season except by order" sentence to quote the way
Newfoundland's s. 89 gives one — the closed world is the two provisions together,
and the bundle's `absence.words` should therefore be s. 34(2)(a)'s own wording with
`section` citing both. **"close season" occurs zero times in the Act and "closed
season" twelve, none of them a general prohibition** — they are evidentiary and
offence provisions about particular species, so do not mistake one for the rule.

### Legal hours: a prohibition on NIGHT, and New Brunswick deliberately gave up its table

- **s. 33(1)(a)**: "every person commits an offence who … hunts wildlife in the
  night".
- **s. 1 definition**: "**'night' means that period of time elapsing between
  one-half hour after sunset and one-half hour before sunrise of the following
  day**".

So the permitted window is half an hour before sunrise to half an hour after
sunset, derived by inverting a prohibition over a defined term — a third encoding
path, different again from Manitoba's stated window and Newfoundland's stated
prohibition.

**And the province moved FROM a table TO the astronomical event, which is the
exact opposite of Nova Scotia.** Old s. 34, headed "Times of sunrise and sunset",
was REPEALED by 2021, c.12, s.2, and replaced by a new **s. 109.1** headed
"Evidence – sunrise and sunset times": in a prosecution, proof of the time of
sunrise or sunset in a given area on a given day may be a written confirmation
certified by the **Herzberg Astronomy and Astrophysics Research Centre, National
Research Council of Canada**, or a certificate signed by a climatologist employed
by **Environment and Climate Change Canada**.

Two consequences for the bundle:

1. Our astronomy is the right instrument here — there is no table that is the law,
   so `SUNRISE_SUNSET_OFFSET` with −30/+30 is correct, and New Brunswick is
   already in `SINGLE_ZONE_JURISDICTIONS` as `America/Moncton`, so a computed
   window is available province-wide.
2. But **our computed value is not the legal proof** — the NRC's certificate is.
   That belongs in the answer's provenance, and it is the strongest reason yet to
   keep `SOLAR_UNCERTAINTY_MINUTES` applied inward: the margin is the distance
   between what we compute and what a court would accept.

### Further prohibitions worth encoding as conditions

- **s. 33(1)(b)**: hunting with the assistance of a light, with or without intent.
  **s. 108**: using a light capable of attracting or locating wildlife is prima
  facie proof of hunting.
- **s. 33(1)(c)**: hunting bear, moose, deer or a fur bearing animal by means of,
  or accompanied by, a dog. A permit under s. 33(2) may allow dogs for other
  wildlife, and 84-133 s. 3.03 lets the Minister permit dogs for varying hare,
  except at night.
- **s. 43.2**: an offence to hunt moose, deer or bear with a bow of draw weight
  under 20 kg at or before 70 cm draw, or with a crossbow under 20 kg. Arrow and
  broadhead rules are in the neighbouring provisions: no poisoned or explosive
  arrow, no barbed point, and a blade not less than 20 mm at its widest point.
- **s. 46.1**: hunting while impaired by alcohol or drug.
- **s. 15(2)(b)**: the holder of a guide I licence shall not hunt while guiding.

### The muzzle-loader week, exactly

**84-133 s. 3.11(1)**: no antlered deer hunting "during the period of one week
beginning the seventh Monday after the first Monday in October" unless the hunter
uses a muzzle-loading firearm, holds a class I (non-resident) or class III
(resident) licence bearing a muzzle-loading firearm authorization, and is hunting
in a zone referred to in s. 11.1(4) — which is the set of zones where antlerless
deer may be hunted. s. 3.11(2) is the antlerless counterpart, requiring both an
antlerless authorization and a muzzle-loading authorization.

### Licence classes, with the fees the regulation itself prescribes

From 84-133 s. 3(1):

| Class | Fee | Who | Authorizes |
|---|---|---|---|
| I | $173 | non-resident 12+ | antlered deer, varying hare, groundhog, coyote, crow, spruce grouse, ruffed grouse, cormorant, migratory game birds, ring-necked pheasant, raccoon, squirrel, skunk |
| II | $72 | non-resident 12+ | as class I without antlered deer |
| III | $29 | resident 12+ | as class I, plus antlerless deer under s. 3.1 |
| IV | $14 | resident 16+ | small game only |
| minor's | — | resident 12–15, accompanied by an adult | small game |
| guide exemption | $150 | non-resident the Minister authorizes to hunt unguided (s. 3.011) | — |

**This is the first jurisdiction where §41A's two fee certifications can both be
met**, and it is worth being precise about why: the fee is stated in the same
paragraph that defines the authorization, so it belongs to that authorization by
construction; and the source is current in its own terms, because the regulation
carries its own consolidation note. Plus: HST and any vendor surcharge are not in
the regulation, so a displayed figure is the statutory fee and must say so.

Licence validity has **two different bases** and they must not be normalised:
s. 4(1) has class I–IV and minor's licences expiring annually on a day tied to
"the Saturday before the last full week of September", and s. 4(4) has bear
licences expiring "seven weeks after the first Monday in October".

### Bear licences: a second one is available

s. 3.2(19) and s. 6(2.4): the holder of a non-resident bear licence who kills a
bear may, after receiving a copy of the registration permit, obtain a SECOND
non-resident bear licence for another bear in the same year, in the autumn season
(s. 11(1)(a.1)). s. 21.11(5): no hunting bear under a resident bear licence once
its tags are used.

### One local, time-of-day restriction that is not the general rule

**84-133 s. 8(1)**: no hunting in the Baie de Tracadie area (Gloucester County) or
the Tabusintac Lagoon area (Northumberland County) between one o'clock in the
afternoon and half an hour before sunrise the next day, excepting the Black Lands
and the inland lakes in the Tabusintac area. Both areas are described in words in
ss. 8(1.1) and following; North Ground holds no geometry for either, so this is an
UNRESOLVED special geography, not a province-wide rule.
