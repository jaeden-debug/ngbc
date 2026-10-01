# Saskatchewan — hand-over

**Landed 2026-10-01 on `main` (`7a0f29b` … `cb7bed0`), branch
`handoff/saskatchewan-regulatory`.** Gate on every code commit: `npm test` exit 0,
`npm run build` exit 0, `npm run lint` 0 errors.

This states what a hunter can actually do in Saskatchewan, what is still UNKNOWN
there, and the four things worth knowing before anyone changes it.

---

## What resolves and what answers

**All 83 Wildlife Management Zones resolve**, read from the ministry's own ArcGIS
service at request time. **North Ground stores no copy** — the licence grants
commercial reuse and the same item says "Not for resale" (owner decision,
2026-09-22) — which makes Saskatchewan the first jurisdiction whose regulatory
answers rest on geometry that exists only as a live read.

**13 species answer**, from 149 certified rules in 44 groups over the period
**2026-04-15 to 2027-03-15**:

| | |
| --- | --- |
| Big game | white-tailed deer, mule deer, elk, moose, pronghorn, American bison, black bear |
| Predator | gray wolf |
| Upland bird | sharp-tailed grouse, ruffed grouse, spruce grouse, gray partridge, ring-necked pheasant |

Six of those — American bison, elk, gray partridge, gray wolf, mule deer and
pronghorn — no other Canadian bundle held.

## The answer asks which licence, and that IS the answer

Saskatchewan writes **every** season for a named licence class, and the class
changes both the zones and the dates: a Saskatchewan resident, a Canadian resident
and a guided non-resident have different seasons in different zones for the same
species. So a resolved zone returns `NEEDS_INPUT` with `LICENCE_TYPE` rather than a
status, and only the classes whose own rules reach that zone are offered — not all
41. A status produced without the class would be a guess about which hunter is
standing there.

Worked example, zone 29, white-tailed deer, First Saskatchewan Resident licence:

| when | means permitted | section |
| --- | --- | --- |
| 15 Sep – 14 Oct | bow | s. 92 |
| 1 – 14 Oct | bow, crossbow, muzzleloader | s. 112 |
| 20 – 30 Nov | all lawful means | s. 132 |

## The method ladder NESTS, and that is read rather than inferred

The regulation writes a season as the means permitted during it. "By any means
other than a bow and arrow, crossbow, muzzle-loading firearm or shotgun"
**PERMITS** those four rather than excluding them. So the envelopes nest, and a bow
hunter is in season inside the muzzle-loading window — 1–14 October in zone 29
above.

Forty season names map to five envelopes in
`src/lib/hunt/regulatory/saskatchewan-methods.ts`, each read from the section's own
first subsection. `implementsPermittedIn()` throws on an unrecorded season name
rather than defaulting, and `envelopeContains()` pins the ladder.

**A build driven by section HEADINGS would have closed those two weeks to every bow
hunter in the province and said nothing about it.** That is the single most
important thing to preserve here.

## Four findings to read before changing anything

1. **A missing "than" hid a whole shotgun season.** s. 35(1) reads "by any means
   other a bow and arrow, crossbow, muzzle-loading firearm or shotgun" — no
   "than". My extraction required "other than", so I produced 39 envelopes and
   **asserted in a test that mule deer has no shotgun season**. It was caught only
   because a per-section tally put one row in s. 35 while the envelope tally had
   none: a cross-check between two counts of the same thing, not a review of the
   regex. The typo is recorded in `KNOWN_DRAFTING_INCONSISTENCIES`.
2. **The Prince Albert zone is CLOSED to all game bird hunting**, stated three
   times by the ministry. I first recorded it UNRESOLVED, which was an unnecessary
   refusal — the §8 direction nobody reports, because a hunter told "we don't know"
   just goes elsewhere. `zonesWithNoGameBirdDistrict()` returns exactly `["PWMZ"]`
   with the reason.
3. **ss. 7 and 7.1 DEEM eight protected and national wildlife areas OPEN** inside
   an open zone. This inverts the usual assumption and prompted the owner's
   2026-10-01 §41A ruling. The real exclusions run the other way: Fort à la Corne
   WMU and St. Denis NWRA are carved out, and provincial parks are closed **except
   those the regulation lists** — a positive list, not a prohibition. North Ground
   holds no boundary for any of them, so the deeming is stated and not resolved at
   a point.
4. **Bull elk and antlerless elk are NOT complementary.** A bull elk is a male with
   an antler ≥15 cm. A male elk over a year old with antlers under 15 cm is in
   neither class, so deriving one from the other BY_NEGATION would be a
   misstatement. Bull moose is a male ≥1 year, and `physical-criterion.ts` has no
   AGE measure for it.

Also: **Saskatchewan is not a blaze-orange jurisdiction.** Four colours or a
CAN/CSA Z96 Class 2 label satisfy s. 21; **white is lawful for the garment and NOT
for the cap**; the requirement binds whoever accompanies or guides as well as the
hunter; s. 21(2) lifts it for a bow, crossbow, muzzleloader or shotgun season and
s. 21(3) reinstates it for an archery mule deer licence while the special rifle
season runs concurrently.

## Legal hours, and a contingency that will matter

Hours are not certified as a clock: `legalTimeAt` answers a point and declines a
whole zone. The rule is the inverse of a prohibition — WLR s. 11(1) prohibits
hunting from half an hour after sunset to half an hour before sunrise — and OSGR
s. 3(b) makes every time in those regulations Central Standard Time.

**Saskatchewan is the best remaining candidate for a legal-time module** (single
zone, no DST, the regulation states its own basis). One thing must not be
hard-coded when someone builds it:

> All of Saskatchewan observes CST (UTC−6) year-round and there are currently **no
> time option areas** — but that is contingent, not structural. Until 2026 the City
> of Lloydminster and its surrounding area observed **Mountain Standard Time
> (UTC−7) from November to March**, an hour behind the province. It ended only
> because Alberta adopted Alberta Time (UTC−6) year-round from November 2026. **The
> Time Act, 2026 expressly allows time option areas to be established in regulation
> for border communities.** §41A requires a date to be evaluated under the rule
> applicable to that date, so the basis must be read as data for the date asked.

The whole finding is on the `ca-sk-time-is-cst` condition. My own limitation
asserted the Lloydminster exception after it had ended, which told a Lloydminster
hunter their clock differed from the law when it does not; fixed in `f1dab89`.

## What is NOT claimed

- **Ptarmigan, barren-ground caribou, waterfowl and fur animals** — UNKNOWN. The
  subsistence barren-ground caribou licence under WLR Part IX.1 is a different model.
- **Every fee** — UNKNOWN. 41 licence classes are named and no fee instrument was
  located, so no number is shown. §41A forbids showing a current-looking number
  merely because one was found.
- **Upland bird limits, ss. 52–58** — extracted, not yet encoded as conditions.
- **47 of the 197 extracted rows reach only provincial parks and recreation
  sites**, whose boundaries North Ground does not hold. The answer says so rather
  than implying a zone season covers a park inside it.
- **Migratory birds** — the federal layer is uncertified nationally, so waterfowl is
  UNKNOWN here for the same reason it is everywhere.

## Where the work is

| | |
| --- | --- |
| Bundle | `content/regulatory/ca-sk-2026.json` |
| Builder | `scripts/build-saskatchewan-regulations.mjs` |
| Extracted rows | `content/regulatory/sources/ca-sk-open-seasons-rows.json` |
| Vocabulary | `src/lib/hunt/regulatory/saskatchewan.ts` |
| Geography, s. 3(c) suffix rule, bird districts | `src/lib/hunt/regulatory/saskatchewan-geography.ts` |
| Method envelopes | `src/lib/hunt/regulatory/saskatchewan-methods.ts` |
| Engine tests | `src/lib/hunt/regulatory/saskatchewan.test.ts` |
| Research | `docs/handoff/saskatchewan-research.md` |

The rows artefact carries `whatMustNotBeTrustedHere` — notably that its `methods`
field came from section headings and is **not** the method envelope. Read that
before reusing it.

## The test that matters

`saskatchewan.test.ts` exists because **Nova Scotia shipped eleven passing tests
that all read the bundle and answered CLOSED at every point in the province**. A
test that asserts the data you just typed cannot fail, whatever it says about the
data. These ask the engine for an answer: a season at a real point, the bow hunter
inside the wider envelope, the wolf season still open on 1 February (it is encoded
`2026-10-15..2027-03-15` with `crossesYear` true — my builder first emitted
`2026-10-15..2026-03-15`, which matches no date in the year), every instrument the
answer makes a claim from reachable from it, and all 83 zones accounted for exactly
once per species.

`engine-answers-somewhere.test.ts` is the generic guard across every bundle, and
now also holds `crossesYear`'s two definitions together.

## Open items for whoever picks this up

1. Encode **ss. 52–58** upland bird limits as conditions.
2. A **legal-time module** — read the contingency above first.
3. `physical-criterion.ts` needs an **AGE measure** for bull moose.
4. The non-complementary elk classes need a representation that is not BY_NEGATION.
5. **Fees** need an instrument; none was located.

## Two findings for the take-eligibility lane, not this one

Noticed while regenerating the readiness report over Saskatchewan. Both are about
`content/published/species-take-evidence.json`, which is generated from its own
sources, so neither is fixed here.

- **Saskatchewan bison take is established and the audit does not list it.** The
  coverage row reads `RULES_CERTIFIED_NO_AUDIT_LISTING` / `NOT_LISTED`, which is
  the honest state and a real gap: the audit records bison take in nine
  jurisdictions (AB, BC, NT, AK, AZ, MT, SD, UT, WY) and not Saskatchewan, while
  OSGR s. 282 gives a Saskatchewan Resident Special Plains Bison Licence season of
  1 September to 19 December in zones 53, 66, 67 and 69. The audit holds Saskatchewan
  listings for 73 of its 467 species, so Saskatchewan is not simply absent from it.
- **`species:american-bison` is classified HUNTABLE, and the evidence looks like
  LIMITED_TAKE.** Eight of the audit's nine jurisdictions record `PERMIT_OR_DRAW`;
  only British Columbia records `OPEN_SEASON`. Saskatchewan's own season is a
  resident-only special licence in four of 83 zones. §16 reserves LIMITED_TAKE for
  "legal take only under narrow conditions — a quota, a draw, a collection permit,
  special geography" and says a narrow quota "must never read as huntable
  everywhere" — and HUNTABLE is what grants a continental Species Heat surface
  under §41B. Worth a second look by whoever owns that classification; it is the
  owner's declared system and not something to change in passing.

Related and already noted above: the regulatory class is **plains** bison
(*Bison bison bison*), while the audit's Northwest Territories row is **wood**
bison. Both map to the canonical `species:american-bison`, which is correct at the
species level under §16, but a reader comparing rows should know the licences are
not about the same subspecies.
