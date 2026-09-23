# Point Timezone — sourcing assessment

**Status:** assessment only, 2026-09-23. **NOTHING INGESTED.** The licence
question is unresolved and, per the standing rule, that is not a judgement for
an ingest to make.

The ingest is funded. This says what it should ingest, and why the obvious
answer is not obviously usable.

---

## 1. The licence trap is real, and the metadata is misleading

`timezone-boundary-builder` is what almost everything uses. GitHub's repository
metadata declares **MIT**. That is the CODE.

Its own README:

> The code used to construct the timezone boundaries is licensed under the MIT
> License. **The outputted data is licensed under the Open Data Commons Open
> Database License (ODbL).**

So a licence check against repository metadata returns the wrong answer. Anyone
verifying this the fast way gets MIT and proceeds. **The licence of a dataset
is not the licence of the tool that built it.**

### The ODbL question North Ground actually has to answer

ODbL carries **share-alike on Derivative Databases**, and distinguishes a
*Derivative Database* from a *Produced Work*. The two questions that decide our
exposure:

1. **Does a spatial join against North Ground's zone geometry create a
   Derivative Database?** Storing the boundaries and joining them at query time
   is arguable; precomputing and storing a `zone → tzid` table looks much more
   like one.
2. **Is serving a resolved IANA identifier "use" or "distribution"?** A single
   resolved `America/Dawson_Creek` in an answer reads as a Produced Work, which
   needs attribution but not share-alike. "Publicly Use" of a Derivative
   Database is defined broadly enough that this is not obvious.

**§11 contemplates licensing this engine to governments and partners.** A
share-alike obligation reaching the regulatory database is an expensive thing
to discover after it has reached it.

**Assessment: LICENCE_PENDING.** Not a refusal — a question for the owner with
counsel, not for me.

---

## 2. A second problem with that dataset, independent of its licence

Its own words: "the **approximate** boundaries", and "the most accurate
possible boundaries of timezones **according to community input**."

- **It states no accuracy figure.** For a value whose error shows up as a wrong
  wall-clock time in the dark, "approximate, per community input" is a
  provenance statement we would have to publish alongside a safety output.
- **Its default variation MERGES zones that currently agree on timekeeping.**
  That is a deliberate simplification, and it can erase exactly the exceptions
  that matter (below).

Even if the licence clears, this is third-party community data standing in for
a legal fact — the same shape as ECCC's Draft district layer, which was
rejected for saying it had no legal value.

---

## 3. The authority for a Canadian timezone boundary is a statute

Time zones in Canada are set by **provincial legislation**, not by a national
dataset. Ontario's is a clean legal description:

> **Time Act, R.S.O. 1990, c. T.9, s. 2(1):** "Standard time in the part of
> Ontario that lies east of the meridian of 90° W. longitude shall be reckoned
> as five hours behind Greenwich time."

That is a meridian — computable exactly from a longitude, with a statute as its
source, and no licence at all. The same shape as Yukon's federal latitude bands
and Saskatchewan's federal districts: **the regulation defines the geography, so
no third-party geometry is needed.**

### But the statute alone is NOT sufficient, and this is the finding that matters

Measured against IANA:

| Ontario zone | Summer | Winter | Follows the 90° W statute? |
| --- | --- | --- | --- |
| `America/Toronto` | GMT-04:00 | GMT-05:00 | yes (east) |
| `America/Winnipeg` | GMT-05:00 | GMT-06:00 | yes (west) |
| `America/Atikokan` | **GMT-05:00** | **GMT-05:00** | **no** |

**Atikokan is west of 90° W and does not keep Central time, and does not
observe DST at all.** The statute gives the standard-time offset; actual
observance includes municipal exceptions the statute does not carry. And a
dataset that merges zones agreeing on current timekeeping may hide Atikokan
behind Toronto for part of the year.

So: a legal description gets most of a province right and is silent on the
exceptions — which are precisely the places a hunter would be misled.

---

## Recommendation

**Do not ingest `timezone-boundary-builder` pending the ODbL answer.** Two
things can proceed now without it:

1. **Single-zone jurisdictions already work** — PE, NS, NB, SK, YT need no
   dataset, and PE and YT have certified federal rules to attach a time to.
2. **A legal-description resolver for provinces whose statute states a
   boundary**, with the statute as the source, PLUS an explicit table of known
   exceptions (Atikokan, Pickle Lake) each carrying its own evidence. Where a
   point is near the statutory meridian or inside an exception North Ground has
   not verified, the answer is **NOT_CERTIFIED** rather than confidently one
   side — the same reasoning as the near-boundary zone warning and the
   asymmetric solar rounding.

**Natural Earth** is public domain and was not discarded silently: its timezone
polygons are generalised for small-scale mapping, and a boundary generalised
for a world map is wrong by far more than the distance at which a hunter near
it needs the right answer. Public domain does not make it fit for this.

**Whatever is ingested carries the full zone-layer discipline** — fetch,
validate, stage, normalize, compare, licence check, human review, publish,
version, with source, retrieval date, hash and provenance — because a wrong
wall-clock time in the dark is a safety output.

---

## Open, for the owner and counsel

1. Does a spatial join against our zone geometry create an ODbL Derivative
   Database, and does serving a resolved identifier constitute Publicly Using
   one?
2. If it does, is a share-alike obligation on a derived timezone table
   acceptable given §11, or does it disqualify the dataset for North Ground?
3. Is there a licensed commercial or governmental point-timezone service whose
   terms permit this, which would make both questions moot?
