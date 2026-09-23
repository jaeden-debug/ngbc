# Contract — Seasons the regulation writes as a rule

**Status:** implemented 2026-09-23 by the Canada agent.
**Scope:** how North Ground reads, stores, computes and refuses a season date
that the authority states as a rule rather than as a calendar day.

---

## The fact this exists for

Schedule 3 of the Migratory Birds Regulations, 2022 writes 57 seasons like
this:

> The Saturday after the first Monday in October to the first Sunday after
> January 19

That is not a date. It is a rule that produces a different date every year.

---

## A relative date is stored as the expression, never as a day

**The rule is stored; the day is resolved for the year being asked about.**

Computing it once and storing month and day would be correct for one season and
quietly wrong for the next. The example above is **October 10 in 2026 and
October 9 in 2027**. A bundle holding "October 10" answers 2027 wrongly by one
day, in the direction that tells a hunter the season is closed when it is open —
the direction nobody reports.

This is the same class as flattening a species' shared limit to a per-species
number: a true-once value stored as though it were a constant.

A window crossing the new year has **two candidate seasons** on any date. January
3 belongs to the season that opened in October, not to one that has not started,
so both are tested and the containing one is returned.

Implementation: `src/lib/hunt/regulatory/relative-date.ts`.

---

## Verified against the authority, not against our reading of it

Schedule 3 states these seasons as rules. Environment and Climate Change
Canada's provincial hunting regulations summaries state **the same seasons as
calendar dates**. Two documents, one authority, one fact stated twice.

`scripts/certify-relative-dates.mjs` computes every relative window and requires
it to appear, to the day, among the dates that authority published for that
province. **24/24** across British Columbia, Ontario and Québec; the record is
`fixtures/hunt/ca-federal-relative-date-certification.json`.

The check is **containment, never equality** — the published summary is a
superset, carrying rows this build refuses.

An implementation verified only against its own reading of the rule is verified
against nothing: the reading and the check would share any mistake in it. Same
standard as the solar computation against USNO's published tables.

**A cached file is not a cached document.** The summary is verified to BE a
summary, for the declared season, before it is believed, and a non-200 is never
cached. A 404 page sitting at a cache path once made 11 correct windows report
as disagreeing — and a broken verifier does not fail safe, it sends you to fix
the wrong thing.

---

## Only operators the authority's published dates confirmed

`after`, `before`, and the month prepositions `in` and `of` each appear in a
window whose computed date was checked against a published summary.

`following` does not. Ontario writes "the Saturday **following** the fourth
Saturday in September", which almost certainly means "after" — and every row
using it is refused for a unit list, so no published date ever confirmed the
reading. **It is refused.** A grammar widened for coverage it never receives is
a regex relaxed until it passes, with the relaxation invisible because nothing
exercises it. The wave that needs it verifies it then.

---

## Refuse rather than guess, and keep the refusal counted

"The first Sunday after January 19" and "the first Sunday **on or after**
January 19" differ by up to seven days and read almost identically. There is no
nearest match, no fallback and no heuristic: a phrasing not recognised exactly
goes to the refusal bucket with its own reason.

Back-references are refused: "the second Sunday after **that Monday**", "to
**the following Friday**" — both are relative to the other half of the window,
not to a month.

---

## There is no safe direction to round a season

**A legal-time window may be narrowed inward; a season may not.**

`SOLAR_UNCERTAINTY_MINUTES` is applied inward because a shorter legal window is
genuinely the safer error — a hunter who waits two extra minutes breaks no law.

A season has two ends and no such direction. Moving an opening later protects
nobody at the closing; moving a closing earlier protects nobody at the opening.
So where a date cannot be computed the answer is **UNKNOWN**, never a date
nudged somewhere safe.

---

## A readable date must not make an unreadable ROW encodable

A window splits at its **first** `" to "` and **both halves must parse whole**.
A trailing qualifier therefore refuses the season:

- `(only on farmland)`
- `(only in Provincial Management Units 1-3 and 1-8 to 1-15)`
- `, for Ducks other than Eiders and Long-tailed Ducks`
- `(excluding Sundays in municipalities where hunting with guns on Sundays is
  not permitted by provincial regulations)`
- `(not an open season for Eiders or Long-tailed Ducks)`

Those rows' dates were **always** readable. They were being refused for their
unreadable dates, not for their qualifiers, so teaching the build to compute
relative dates removed a shield nobody had noticed was load-bearing. Nothing
about who those seasons apply to changed.

**Before adding a capability, ask what was being refused only because that
capability was missing.** The failure mode is silent in both directions: the old
refusal looked principled, and the new encoding would have looked like progress.

Eight specific rows are pinned as refused in
`src/lib/hunt/regulatory/relative-date.test.ts`.

---

## Refusal buckets are comparable only against themselves

*Added after the Saskatchewan area fix.*

Bucket sizes are now something work is prioritised from — 53 of 84 refusals
being one thing is what identified relative dates as a missing capability rather
than a pile of oddities. That makes bucket arithmetic load-bearing, and it has a
trap.

When the area check was added it runs **first**, so rows that were refused for
residency or an unreadable window **and** named a refused district moved into
the area bucket. "Varies by residency" read 23 → 15 and "not a plain calendar
window" 27 → 22 across that commit. **Those rows did not become readable.** They
were reclassified to the first reason that applies.

**A count that moves because the classifier reordered is not a count that
moved.** A bucket's size is comparable only against itself under an unchanged
classifier; when the order changes, say so beside the numbers.


---

## A test's example must be derived, not hard-coded

*Added 2026-09-23, after the third instance in one day.*

A test that needs an example of something North Ground does **not** yet cover
should **derive the example from the data and assert that the category is
non-empty**. Hard-coding one guarantees it expires silently the day the work
succeeds.

Three instances, all the same shape:

- a test used `species:mallard` as "a species we do not certify", and stopped
  testing anything the day mallard was certified;
- a test asserted "the four unreadable windows are the leap-year form", and
  failed the day that form was read;
- a test named Manitoba as "a jurisdiction we have not encoded", and failed the
  day Manitoba was encoded.

Only the first failed *silently*, and only because the other two were written
with an explicit premise check. That is the construction to copy: asserting the
category is non-empty makes the test **demand its own deletion** when the last
member is covered, rather than passing vacuously forever.

## A test must not share its subject's blind spot

*Added 2026-09-23. Two instances, one lesson.*

A check that is built the same way as the thing it checks does not check it.
It agrees with it, which looks identical from the outside and is worth nothing.

- **The Oxford comma.** The area-cell splitter mishandled `", and "`, and the
  structural test written to classify those cells **split them the same way** —
  so it agreed that Newfoundland's five-zone cell was prose. The bug and its
  test shared one blind spot, and the test's green was a second copy of the
  defect rather than a check on it.
- **The repeated mapping.** The first bulk-versus-individual test re-derived
  the engine-outcome → state mapping inline, so a mapping bug would have been
  reproduced identically on both sides and cancelled out. Exporting the one
  `stateOf` and running both sides through it fixes what is actually under
  test: that the two paths reach the same **engine outcome**. The mapping has
  its own tests. **A test that repeats the mapping lets a mapping bug hide
  behind a second copy of itself.**

The rule: a test should reach its expectation by a **different route** than the
code reaches its answer — from the authority's published value, from an
independent calendar, from the law read by hand — or, where it must share a
step, share the *same instance* of that step rather than a copy of it.

This is the same family as the derived-example rule above. Both are about a
test whose subject has quietly moved underneath it: there, because the example
graduated; here, because the check was never independent to begin with.

*Note on where this lives:* the three test-craft rules in this contract — derive
the example, assert the category is non-empty, and do not share the subject's
blind spot — are general and have nothing to do with relative season dates.
They are here because the first of them was written here. They deserve their
own home once there is a fourth.

## Three states that all end in UNKNOWN

*Added 2026-09-23.*

They must never render alike, because they call for different actions:

| state | what it means | what it asks of us |
|---|---|---|
| **read and resolved** | the point is in a federal area | nothing |
| **read and blocked** | the Part was parsed; its zones are drawn on geography North Ground does not hold, and it names which | acquire that geography |
| **not read** | nobody has looked | read it |

"North Ground has not encoded this jurisdiction" invites waiting. Naming the
blocker says what would have to be acquired — Nova Scotia's two federal zones
are **counties**, and the province publishes county-based data under its own
open licence, so that is a concrete unlock rather than an open question.

The same distinction, one level down, separates two UNKNOWNs about a *point*:
Alberta's unit 728 is in **no** federal area, because the regulation does not
place it — a real answer about the regulation. A Manitoba hunting area outside
Zone No. 4 **is** placed, in Zone No. 2 or No. 3, and North Ground cannot say
which. Saying "the regulation places this in no federal area" there would be a
false claim about the law, not merely an unhelpful one.

## A conjunction in legal prose means what it joins

*Added 2026-09-23.*

**This is the detector-from-the-first-jurisdiction pattern arriving in grammar
rather than in a regex** — a reading taken from the first Part that needed it,
correct there and silently wrong everywhere else. Manitoba's "the portion lying
north of latitude 57°N and the portion lying east of longitude 94°W" is a
UNION of two portions; Newfoundland's "the portion of Labrador lying north of
latitude 54°24′N and east of longitude 65°W" is an INTERSECTION of two
conditions on one portion. The tell is whether "the portion" is repeated, and
nothing downstream can catch getting it wrong.

Never what the word suggests. Three readings of "and" in Schedule 3, each
settled by its operands and each wrong if carried to the next:

- **a list** — "Districts C and D" is two districts;
- **one description** — Nunavut's "the islands and waters of James Bay" is a
  single place, and splitting it yields fragments that are not zones;
- **a union of portions** — Manitoba's "the portion lying north of latitude
  57°N and the portion lying east of longitude 94°W" is two portions joined;
  reading it as an intersection would shrink the zone to a northeast corner and
  leave most of the province in no federal area;
- **an intersection of conditions** — Newfoundland's "the portion of Labrador
  lying north of latitude 54°24′N and east of longitude 65°W" is ONE portion
  with two conditions. The same sentence shape as Manitoba's, the opposite
  meaning, decided entirely by whether "the portion" is repeated.

Each is matched against the authority's own sentence, so a reworded definition
refuses rather than being approximated.
