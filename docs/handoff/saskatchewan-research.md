# Saskatchewan — the research, verified against the instruments

**Written 2026-10-01.** Every quotation below was read out of the authority's own
consolidated text, not out of a summary and not out of an agent's report. Four
independent discovery agents converged on the instrument set; I then downloaded
the instruments and re-derived each load-bearing fact myself, because an agent
report is a lead.

Saskatchewan is the **easiest remaining Canadian jurisdiction on its sources and
the hardest on its geography**: its seasons are a standing regulation with no
annual order to chase, and its bird seasons are written in a second geography
composed out of the first.

## The instruments, and how to fetch them

The King's Printer catalogue has a JSON API. `publications.saskatchewan.ca/robots.txt`
returns 404 — no restrictions — and `www.saskatchewan.ca/robots.txt` likewise has
no robots file.

```
product metadata   https://publications.saskatchewan.ca/api/v1/products/<productId>
document download  https://publications.saskatchewan.ca/api/v1/products/<productId>/formats/<formatId>/download
acts + regulations https://publications.saskatchewan.ca/api/v1/freelaw/acts        (509 acts, 758 KB)
```

| Instrument | Chapter | product / format | Retrieved |
|---|---|---|---|
| **The Wildlife Act, 1998** | W-13.12 | 938 / 1513 | 445 KB, 38 pp |
| **The Wildlife Regulations, 1981** | W-13.1 Reg 1 | 1602 / 2841 | 846 KB, 78 pp |
| **The Open Seasons Game Regulations, 2009** | W-13.12 Reg 3 | 27548 / 34643 | 509 KB, 36 pp |
| WMZ and Special Areas Boundaries Regulations, 1990 | W-13.1 Reg 45 | 1607 | — |
| Firearm Safety/Hunter Education Regulations, 2009 | — | 27080 / 34275 | 121 KB |
| Fur Animals Open Seasons Regulations | — | 32635 / 39653 | 119 KB |
| 2026-27 Hunters Guide | *(a summary)* | 121483 / 140653 | 7.1 MB, 24 pp |

Three API hazards, learned the hard way and worth not relearning:

- **An unrecognised query parameter triggers an unfiltered scan of all 62,600
  products and hangs.** `?q=`, `?keyword=` and `?customIdentifierStartsWith=` each
  timed out at 40 s with zero bytes. Only the declared filters work
  (`nameStartsWith`, `active`, `categoryId`, `productTypeId`, `agencyId`,
  `statusType`), and `nameStartsWith` accepts **one word only** — `Wildlife`
  returns 19 products, `Open%20Seasons` returns `[]`.
- **There is no server-side full-text search.** `/api/v1/products/search` 400s
  because "search" parses as a numeric id; the site's own search redirects to an
  external Coveo instance. `/api/v1/freelaw/acts` is the browse endpoint to use.
- **A newer format id is not a newer English version.** Product 938 format 1513 is
  the English Act; format **110897 is the FRENCH text** (« Loi de 1998 sur la
  faune »). Never choose a format by recency.

### Currency

The Open Seasons Game Regulations consolidation carries its own amendment trail,
ending **SR 50/2026**, filed 31 July 2026, with the catalogue reporting "Last
update posted 11 Aug 2026". It is current for the 2026-27 season. Every
consolidation also carries the King's Printer's own caveat: *"This consolidation
is not official. Amendments have been incorporated for convenience of reference
and the original statutes and regulations should be consulted for all purposes of
interpretation and application of the law."*

## Where the season dates legally live — settled

**Option (a): a standing ministerial regulation.** Not an annual order, and not
the guide. Three provisions of the Act point one way:

- **s. 2**: *"'open season' means a period specified in the regulations during
  which wildlife may be lawfully hunted or taken"*. The legal home is a
  regulation, by definition.
- **s. 83(2)**: *"The minister may make regulations: (a) defining and declaring
  open seasons during which and areas within which a person may hunt certain
  wildlife"*. A ministerial power, distinct from the LGIC's s. 83(1).
- **s. 83(1)(g)** gives the LGIC *"respecting the hunting or trapping of wildlife
  during open seasons"* — conduct during a season someone else declared.

**The negative control that rules out an annual order.** The Act contains exactly
one order power, **s. 27**, and it is geography: *"the minister may, by order,
constitute any area of the province as a … conservation block"*. There is no power
to open, close, vary or shorten a season by order, so there is no unpublished
annual layer to miss between consolidations. (Caveat kept: s. 83(1) runs (a)–(vv)
and not every intervening clause was read in full; the order-language grep is a
term search, and an exception implies a rule.)

**The guide disclaims itself**, which rules out option (c). p. 2: *"The guide is
not a legal document and is intended for use as a reference only."* p. 8 names the
instruments and says *"Always consult the original statutes for interpretation and
application of the law."*

**Dates are month and day with no year**, so the seasons stand and recur until
amended, and every amendment arrives as a numbered Saskatchewan Regulation.

## Four provisions of the Open Seasons Game Regulations that decide the encoding

### s. 3(c) — the suffix rule, and it is load-bearing

> *"unless otherwise indicated, references to Wildlife Management Zones by number
> include zones that contain the descriptor 'East', 'West', 'North' or 'South' in
> the zone title."*

A season written for "Zones 1 to 14" reaches **2E, 2W, 7E, 7W, 14E and 14W**, and
there is no zone "2", "7" or "14" for it to reach instead. A literal numeric match
would drop twelve of the province's 83 zones from every season naming their
number — reported CLOSED. §8 treats a restriction stricter than the source as
exactly as false as a looser one, and this is the stricter kind, which nobody
complains about.

Numbers the province publishes **no bare zone** for: 2, 7, 14, 20, 42, 45, 51, 68.
(20 and 51 have no zone at all, suffixed or otherwise.)

### s. 3(b) — the statutory time basis

> *"references to time are references to Central Standard Time"*

This is squarely §41A's statutory-basis-versus-civil-clock case. Saskatchewan does
not observe DST, so for most of the province CST **is** the civil clock and the
conversion is the identity — but the regulation fixes CST as the legal basis
regardless, and the Lloydminster area observes Alberta time. Preserve the basis,
present the converted local clock, never collapse them.

### ss. 7 and 7.1 — protected areas are DEEMED OPEN, which inverts §41A's default

> **s. 7**: *"When a wildlife management zone is open for hunting a species of big
> game, the following protected areas lying within that wildlife management zone
> are deemed to be open for hunting that species during the open season … (a)
> Anderson Island Protected Area; (b) Waskwei River Protected Area."*

**s. 7.1** does the same for six federal areas: Bradwell, Last Mountain Lake,
Prairie National Wildlife Area Unit Numbers 1 to 28, Stalwart Lake, Tway and Webb
National Wildlife Areas.

§41A's zone-card rule — never claim a season inside a published restricted area
within a zone — is right in general and **wrong for these eight named areas**,
where the regulation itself deems them open. The genuine exclusions run the other
way, and the guide states them (p. 18): Fort à la Corne WMU and the St. Denis
National Wildlife Research Area are carved out, and provincial parks and
recreation sites are closed **except those explicitly listed** — a positive list,
not a negative one. Wildlife Regulations s. 9 adds that where a park season
exists, hunting is still prohibited in posted areas, which is ground signage no
dataset carries.

### s. 4 — the validity basis, and it is not a licence year

> *"Subject to sections 22, 27, 29.2, 51, 58 and 63, a licence authorizes the
> person to whom the licence is issued to hunt only during the calendar year in
> which the licence is issued."*

A **calendar year of issue**, with six named exceptions. §41A forbids
manufacturing a generic annual period; this is a fifth distinct validity basis
across the provinces done so far, alongside Nova Scotia's four bases, New
Brunswick's two adjacent-subsection expiries and Newfoundland's event-based one.

## The second geography — and the one zone that does not map

Bird seasons in Parts VIII to X are written in **Game Bird District** terms. The
districts compose out of six **Game Bird Management Units** (ss. 2(n.1)–(n.6)), and
each unit is defined as a list of Wildlife Management Zones **plus** named
provincial parks, recreation sites, Fort a la Corne Wildlife Management Unit and
federal national wildlife areas. North Ground holds none of that park or NWA
geometry.

What makes the districts answerable anyway: **the zone lists alone are disjoint
and all but complete.** Derived and tested in
`src/lib/hunt/regulatory/saskatchewan-geography.ts`:

| Unit | zones | District |
|---|---|---|
| 1 | 18 | South |
| 2 | 11 | South |
| 3 | 13 | South |
| 4 | 9 | South |
| 5 | 14 | North |
| 6 | 17 | North |

82 memberships, zero overlaps, 31 zones North and 51 South. So a point that
resolves to a zone resolves to a district without any park geometry.

**The Prince Albert Wildlife Management Zone is named in no unit.** The regulation
names the Regina/Moose Jaw zone in unit 2 and the Saskatoon zone in unit 3 and
simply does not name the Prince Albert one — while naming it **twelve times** in
the big-game Parts, so this is not an omission from the instrument as a whole. A
bird question there is UNRESOLVED, never closed; guessing a district from latitude
would be inventing geography to avoid an UNKNOWN.

## Silence means CLOSED, on one unusually complete provision

> **Act s. 25(1)**: *"Subject to subsection (2), no person shall hunt any wildlife
> within Saskatchewan: (a) other than at the times, in the places and in the
> manner prescribed by this Part and the regulations; and (b) without a licence
> where a licence is required by this Part or the regulations."*

Times **and** places **and** manner, in one sentence. This is the cleanest
closed-world provision of the four provinces done so far: Newfoundland needed
three provisions and New Brunswick two read together.

## The animal classes are structured, and two of them are not complementary

OSGR s. 2 defines the classes, and they fit `physical-criterion.ts`:

- **s. 2(h) "bull elk"** — *"a male elk having an antler at least 15 centimetres in
  length as measured on the outside curve of the antler from the skull to the
  tip"*. `STATED`: ANTLER_LENGTH, AT_LEAST, 15 cm, ANY_SIDE ("an antler").
  Saskatchewan's 15 cm joins Ontario's 7.5, Alberta's 10.2 and Québec's 7 — all
  called "antlered" by a word that is a filter, not an identity.
- **s. 2(i) "bull moose"** — *"a male moose that is at least one year old"*. An AGE
  test, which `CriterionMeasure` has no measure for.
- **ss. 2(b)–(e), (m) antlerless elk / moose / mule deer / white-tailed deer, doe
  pronghorn** — defined affirmatively as *"a female X"* **or** a young animal, and
  the age limb differs between species: elk is *"less than one year old"* while
  moose, both deer and pronghorn are *"born in the year in which it is being
  hunted"*. **Two different tests, and collapsing them would be wrong.**
- **s. 2(f) "archery"** — *"hunting with a bow and arrow but does not include
  hunting with a crossbow"*. Saskatchewan excludes the crossbow from archery, like
  Newfoundland and unlike New Brunswick — and gives the crossbow **its own
  sections** (10, 15, 31, 33, 38).
- s. 2(k) "cock pheasant" means a male pheasant. s. 2(l.1) "dark geese" means
  Canada geese, white-fronted geese and cackling geese.
- **"buck" is NOT defined anywhere**, so it carries its ordinary meaning.

**The finding that matters most here: bull elk and antlerless elk are not
complementary.** A male elk over a year old whose antlers are under 15 cm is
neither a "bull elk" nor an "antlerless elk" on the definitions' own terms. So
`BY_NEGATION` — the convention Ontario and Québec use for antlerless — would be a
misstatement in Saskatchewan, and the two classes must be encoded separately.

**Open against `physical-criterion.ts`:** `CriterionMeasure` has only antler and
horn measures, so there is no way to state an AGE test, and `PublishedValue.unit`
has no "years". §41A says to expand the model rather than round the source into
the nearest field — but that contract is another lane's and actively being worked,
so Saskatchewan's age-based classes are encoded `NOT_MEASURED` with the full
definition in `statedAs` and the modelling gap recorded in the bundle. **Raise an
AGE measure with that lane rather than adding one unilaterally.**

## Legal hours, and they are not sunrise to sunset

> **Wildlife Regulations, 1981 s. 11(1)**: *"No person shall hunt any wildlife
> during the period from one-half hour after sunset to one-half hour before
> sunrise."* s. 11(3) excepts a licensed trapper taking fur animals by trap in an
> open fur season.

A prohibition to invert, giving half an hour before sunrise to half an hour after
sunset. Verified by a positive control that the rule is **not** in the Open
Seasons Game Regulations: zero hits for sunrise/sunset terms there, against the
same grep matching in the Wildlife Regulations.

s. 11.1(5) separately bars discharging a firearm for hunting from a highway,
provincial or municipal road, road allowance, right of way or ditch during the
same night window.

## Hunter clothing — Saskatchewan is not a blaze-orange jurisdiction

**Wildlife Regulations, 1981 s. 21**, quoted in full because four things a generic
orange model would get wrong are in the wording:

> *"21(1) Every person hunting big game and every person accompanying or guiding
> him or her shall wear: (a) an outer garment that covers the torso and that is:
> (i) coloured scarlet, bright yellow, blaze orange, white or any combination of
> those colours; or (ii) approved by the Canadian Standards Association Group as
> high visibility safety apparel and carries the label CAN/CSA Z96 Class 2, as
> updated from time to time; and (b) a cap or toque coloured scarlet, bright
> yellow, blaze orange or any combination of those colours.
> (1.1) The outer garment … may display a patch or lettering in any colour that
> covers less than 100 centimetres² (15.5 inches²) …
> (1.2) The cap or toque … less than 50 centimetres² (7.8 inches²) …
> (2) Notwithstanding subsection (1), a person hunting big game with a bow and
> arrow, muzzle-loading rifle, crossbow or shotgun for which there is an open
> archery, a muzzle-loading firearm, a crossbow or a shotgun season established
> pursuant to The Open Seasons Game Regulations, 2009 may wear camouflage or other
> clothing.
> (3) Notwithstanding subsection (2), a person hunting mule deer pursuant to an
> archery mule deer licence is subject to clause (1)(a) during any period that the
> archery mule deer season runs concurrent with the special mule deer rifle
> season."*

1. **Four colours or a CSA label** — scarlet, bright yellow, blaze orange, white,
   any combination, or CAN/CSA Z96 Class 2 apparel instead of a colour at all.
2. **White is permitted for the torso and NOT for the cap.** The two lists differ
   by exactly one colour, and a single "approved colours" field would collapse them.
3. **It binds the person accompanying or guiding**, not only the hunter.
4. **It is a conditional chain, not a flag**: required for big game → lifted for
   archery, muzzle-loader, crossbow or shotgun where such a season exists →
   reinstated for archery mule deer while the special mule deer rifle season runs
   concurrently. (3) is a §41A contextual limitation — true only under a condition
   the engine can test from the OSGR's own dates.

**The guide diverges from the regulation in three places**, both current editions,
so these are genuine differences rather than an edition mismatch. (a) The guide
frames orange as triggered by hunting big game **with a rifle**; s. 21(1) imposes
it on every method with a method-scoped exemption. Encoding the guide's framing
would invert the default and lose s. 21(3). (b) The guide says Class 2 vests **and
Class 3 coveralls** are lawful; s. 21(1)(a)(ii) names only Class 2 — the guide is
more permissive than the text it summarises. (c) The guide says a crest "not
exceeding" 100 cm² (15 in²); s. 21(1.1) says "less than" 100 cm² (15.5 in²) — a
different test and a different imperial conversion. **Encode s. 21; record the
divergence; never let the guide's looser Class 3 widen a legal permission.**

## Landowner consent is the default, and the onus is reversed

> **Act s. 41(1)**: *"Subject to subsections (7) and (8), no person shall hunt any
> wildlife on any land except with the consent of the owner or occupant of the
> land."*
> **s. 41(6)**: *"In a prosecution for a contravention of subsection (1), the onus
> is on the person charged to prove that the person had obtained the consent."*
> **s. 41(7)**: subsection (1) does not apply to *"(a) vacant provincial land as
> defined in The Provincial Lands Act, 2016; (b) any other land or Crown land that
> is prescribed in the regulations."*
> **s. 41(8)**: for park land as defined in The Parks Act, *"that Act governs
> access to park land for the purposes of hunting."*

This is the inverse of most provinces and a §41A **critical operational warning**:
a hunter who ignored it could be charged, and the burden of proving consent is on
them. ss. 41(2)–(3) let an owner permit hunting by posting signs, and then hunting
must follow the posted instructions. s. 42 limits an occupier's duty of care.

s. 41(8) also reinforces why park geography in a season row is a separate legal
question: park access for hunting is governed by The Parks Act, not this one.

Other conduct provisions worth encoding: s. 38 careless use of a firearm, s. 39
hunting while intoxicated or under the influence, s. 40 no loaded firearm in or on
a vehicle or on horseback and no discharging from either.

## The licence classes are the dimension

The OSGR names **41 distinct licence classes**, and the seasons turn on them
heavily — residency changes both the zones and the dates. A broader extraction
found 41 against a narrower one's 27, and the twelve **Veteran** variants were the
ones the narrow pattern missed, which is the positive control on the count.

The axes: residency (**Saskatchewan Resident / Canadian Resident / Non-resident /
Guided**), a **Veteran** variant of most resident licences, ordinals (**First,
Second, Third, Fourth** — multiple licences in one season), and **Special** marking
a draw licence. Keep the authority's own names (§9), and use §41A's
`valuesFrom: "PLACE"` so a hunter is offered only the licences whose rules reach
their zone rather than all 41.

One inconsistency in the regulation's own naming, recorded rather than smoothed:
"First Saskatchewan **Antlerless** White-tailed Deer Licence" omits "Resident",
while "First Saskatchewan **Resident** Veteran Antlerless White-tailed Deer
Licence" includes it.

## The geography

83 Wildlife Management Zones, read live from
`https://gis.saskatchewan.ca/arcgis/rest/services/WildlifeManagement/MapServer/0`
on 2026-09-30 and matching the certification adapter's expected 83. **Live-service
only** by owner decision (2026-09-22): the Government of Saskatchewan Standard
Unrestricted Use Data Licence v2.0 grants commercial reuse and the same item adds
"Not for resale", so North Ground reads the service, stores no copy and
redistributes no file. The Wildlife Management Zones and Special Areas Boundaries
Regulations, 1990 supersede the layer.

Designations: 1, 2E, 2W, 3–6, 7E, 7W, 8–13, 14E, 14W, 15–19, 21–41, 42E, 42W, 43,
44, 45E, 45W, 46–50, 52–67, 68N, 68S, 69–76, plus PWMZ, RWMZ, SWMZ.

## §44 source-rights record, as established

`accessState` PUBLIC_READABLE; `reuseState` **UNSTATED** — the King's Printer terms
page was not located, which is one finding (terms unstated), not two;
`archiveState` UNCONFIRMED; `derivedFactsState` USABLE; `authorityLevel`
PRIMARY_GOVERNMENT for the Act and the regulations and GOVERNMENT_SUMMARY for the
guide; `termsStatus` NOT_LOCATED; `retrievalMethod` OFFICIAL_API. The GIS layer is
separate and licensed, and is live-service only.

## Deliberately not established

- **No fee or licence-class instrument was found.** The OSGR names 41 licence
  classes and prescribes no fees; the fee instrument, if there is one, is
  unlocated. So Saskatchewan fees are UNKNOWN, unlike New Brunswick's.
- **Waterfowl (Part X) composes with the federal Migratory Birds Regulations**,
  and `migratoryComplete` is unmet. Out of scope until the federal layer lands.
- **Fur animals are a separate instrument** (product 32635). Trapping is a
  distinct activity.
- **An AGE measure for `physical-criterion.ts`** — see the animal-class section.
- Two ministry summary products lag the current guide; the guide at 121483/140653
  is the one to use.
