# Contract — Legal Hunting Time (engine half)

**Status:** proposed 2026-09-23 by the Canada agent, written against Hunt
overhaul's half rather than in parallel with it.
**Scope:** how North Ground DETERMINES a legal hunting window. Rendering is
Hunt overhaul's.

---

## Agreed with Hunt overhaul's half

No disagreement. Restated so the seam is explicit:

- The engine returns **times on the chosen date, already resolved** in the
  zone's own timezone. Hunt overhaul does not compute sunrise offsets, and must
  not have to.
- `basis` names the rule form, `timezone` is IANA, the date is carried, and
  `sourceId` points at the authority.
- **`NOT_CERTIFIED` is a first-class result**, carrying the authority to link.
  It is the honest answer far more often than the current code implies, and it
  is not an error state.

---

## What legal time is, and what it is not

**A legal hunting time is a regulatory determination.** It is derived from an
authority's rule, carries that rule's provenance, and is wrong in the same way
a season is wrong — with the same consequences.

**Sunrise and sunset from a weather provider are environmental context and may
never become legal time.** `weather.ts` already says so, and this contract makes
it architectural rather than a comment: the weather response is not an input to
this determination, and the two values are computed by different code with
different provenance. A hunter must be able to see a 06:56 sunrise in the
conditions panel and a 06:26 legal start beside it without either having
borrowed from the other.

That separation is also why the engine computes its own solar times rather than
reading a provider's. The calculation is deterministic, offline, versioned and
testable; a provider's is none of those and can change without notice.

---

## The rule forms the model must express

Every one of these exists in a jurisdiction North Ground already serves or
intends to.

| Form | Example | Needs |
| --- | --- | --- |
| `SUNRISE_TO_SUNSET` | plain sunrise to sunset | solar times |
| `SUNRISE_SUNSET_OFFSET` | "30 minutes before sunrise to 30 minutes after sunset" (ON, MB, AB, BC) | solar times + signed offsets, which may be **asymmetric** |
| `FIXED_LOCAL_TIMES` | "05:00 to 23:00" | no solar times |
| `AUTHORITY_TABLE` | the authority publishes its own table of legal hunting times | **the table, not our astronomy** |
| `NOT_CERTIFIED` | Québec today: "set by rules North Ground has not certified" | the authority to link |

Three qualifiers ride on any of them, because the regulations use all three:
**species-specific** (migratory birds differ from big game), **date-specific**
(a season with different hours in its first week), and
**jurisdiction-specific definitions** of the terms themselves.

### `AUTHORITY_TABLE` is not a variant of the others

Where an authority publishes its own table of legal hunting times, **that table
is the law and our astronomy is not.** A computed time that disagrees with the
published table by a minute is wrong, however good the algorithm. The model
must be able to carry a table value with its source and must never silently
substitute a calculation for one. This is the same rule as
`DERIVED_FROM_LEGAL_DESCRIPTION` on zone geometry.

---

## THE BLOCKER: the timezone must come from the POINT, not the jurisdiction

**This is the one thing I need settled before building, and it is already
producing wrong values.**

Legal time is a wall-clock time, so it depends entirely on the timezone at the
hunt location. Layers today carry ONE `timeZone` per jurisdiction. That is
insufficient, and it is already incorrect in production:

| Place | Declared on the layer | Actual IANA zone | Error |
| --- | --- | --- | --- |
| BC Peace River (Fort St John) | `America/Vancouver` | `America/Dawson_Creek` | **1 hour, in winter only** |
| Labrador (Goose Bay) | `America/St_Johns` | `America/Goose_Bay` | **30 minutes, year-round** |
| Northwest Ontario (Kenora) | *none declared* | `America/Winnipeg` | unresolvable |
| Ontario, Manitoba, Alberta, Québec | *none declared* | several | unresolvable |

Measured, not asserted: at 2026-12-05T20:00Z, `America/Vancouver` is GMT-08:00
and `America/Dawson_Creek` is GMT-07:00; at 2026-09-20T20:00Z **both are
GMT-07:00.**

Two of those are worse than they look:

- **The BC error is seasonal.** It is correct in September and an hour wrong in
  December. A spot-check during an open season passes; the error appears later,
  in the dark, at the exact hour a hunter is deciding whether it is legal to
  shoot.
- **The Labrador error is 30 minutes, which is the size of the offset itself.**
  A rule that says "30 minutes before sunrise" evaluated in a zone half an hour
  out silently cancels or doubles its own offset, and the result still looks
  like a plausible time.

**Four of the five jurisdictions with certified rules have no timezone at
all.** Legal time cannot be computed for Ontario, Manitoba, Alberta or Québec
today, whatever the model.

### What I propose, and the decision I need

1. **A point-resolved timezone.** The hunt location's IANA zone, not the
   jurisdiction's. That needs a timezone boundary dataset with a reviewed
   licence — a real ingest, sized like a zone layer, and I will not fake it
   with a bounding box.
2. **Until that exists, a jurisdiction that spans more than one IANA zone
   answers `NOT_CERTIFIED` for legal time**, naming the authority. A
   single-zone jurisdiction (Saskatchewan, Yukon, PEI, Nova Scotia, New
   Brunswick) answers normally.

That is a smaller first wave than "legal time for every served jurisdiction",
and it is the honest one. **The alternative is a wall-clock time that is an
hour wrong in December, which is worse than no time at all** — a hunter shown
no time checks; a hunter shown a wrong one does not.

I need the owner's call on whether to fund the timezone ingest, because it
decides whether Ontario and BC get legal time in this wave or the next.

---

## Rounding is asymmetric, deliberately

Solar calculation is accurate to about a minute, and the rule is a boundary.
**Round INWARD: later start, earlier end.** A rounding error must never
authorise a minute outside the legal window. The cost of the other direction is
a hunter losing a minute they were entitled to; the cost of this one is a
hunter shooting a minute before it was legal.

The engine states its precision rather than implying exactness, and
`NOT_CERTIFIED` remains available where the answer would turn on it.

---

## Provenance and versioning

A legal-time result stores the rule it came from, the authority, the section,
the retrieved date, and — where computed — the algorithm and its version. A
result computed under one algorithm version is not silently comparable with one
computed under another, the same way two bundle versions are not.

---

## Tests required before this serves

- **DST transitions in both directions**, including a hunt on the transition
  day itself, in a zone that observes DST and one that does not
  (`America/Regina`, `America/Whitehorse`).
- **A half-hour zone** (`America/St_Johns`), because a 30-minute offset in a
  30-minute zone is where sign errors hide.
- **A case proving the weather provider's sunrise cannot become a legal
  answer**: a hunt where the weather sunrise and the computed legal start
  differ, asserting the two are independently sourced and that suppressing
  weather does not change the legal window.
- **A case per rule form**, including `AUTHORITY_TABLE` disagreeing with the
  computed value and the table winning.
- **The inward-rounding asymmetry**, asserted at a boundary minute.

---

## Open questions for Hunt overhaul and the owner

1. **Fund the timezone ingest, or ship legal time only for single-zone
   jurisdictions first?** Mine to raise, the owner's to decide.
2. Does Hunt overhaul need the **solar times themselves** (sunrise 06:56) as
   well as the resolved window, or only the window? Passing both invites a
   renderer to recompute the offset; passing only the window does not.
3. For `AUTHORITY_TABLE`, is a **table value without a computed cross-check**
   acceptable, or should a disagreement beyond a stated tolerance raise
   `NEEDS_VERIFICATION`? My view: cross-check and report the disagreement,
   because a table we transcribed wrongly is otherwise undetectable.
