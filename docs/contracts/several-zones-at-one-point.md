# Contract — Several Zones At One Point

**Status:** proposed 2026-09-23 by the United States agent, for the Canada agent
(Newfoundland, Québec/Labrador) and Hunt overhaul (`src/components/hunt/*`).
**Scope:** what the zone resolver returns when more than one zone covers a
point, and how those answers are told apart.
**Not in scope:** which zone's rules govern (that is precedence, below), any
jurisdiction's actual geography, styling, or regulatory evaluation.

> **This is a United-States-shaped mechanism living in shared code, and it says
> so deliberately.** Measured 2026-09-23: no Canadian layer nests within
> itself — 73 bounding-box candidates across every certified Canadian layer,
> zero true containments, maximum overlap 0.206%. Canadian overlap is only ever
> species-scoped (filtered upstream) or cross-authority (already a conflict).
> The mechanism belongs in shared code because the resolver is shared, not
> because the problem is general. A later jurisdiction may need it; none does
> today, and the contract should not claim otherwise.

---

## The problem

"More than one zone covers this point" is currently one answer. It is at least
three different facts, and two of them are not problems at all.

Today the resolver has two outcomes for a point: RESOLVED with one zone, or
UNKNOWN. Everything multi-zone that is not filtered out upstream lands in
UNKNOWN with `conflictingZoneIds`. So a hunter standing where an authority
*deliberately* publishes three nested units is told the same thing as a hunter
standing where two governments genuinely disagree: *we cannot say*.

That is wrong in the direction that matters. `UNKNOWN` means we do not know.
Nesting that an authority publishes on purpose is something we **do** know, and
it deserves to be said rather than flagged.

## The three situations

**1. Species-scoped peers.** Newfoundland publishes moose, caribou and black
bear areas over the same ground. Already solved, upstream, and not by this
contract: `isLocationLayer` filters species-scoped layers out of the
location-only question (`zone.ts:577`, `:677`), so a Labrador point RESOLVES to
the moose area and the bear area is simply not a location answer.
`labrador-overlap.test.ts` pins it. **No change proposed.**

**2. Cross-authority conflict.** Québec's zone 19N and Newfoundland's moose area
050 both claim the same Labrador point, because two governments both publish
there. A real conflict: the authorities disagree, and North Ground must not
pick. Already names every claimant on `conflictingZoneIds` in the registry path.
**No change proposed.**

**3. Nesting within one authority.** Michigan draws a county deer unit, a
multicounty unit, a CWD core area and an urban zone over the same ground, on
ONE layer, one row each, no field naming the kind. A point at the Lansing
capitol is in three units at once; Detroit is in two. Nobody disagrees. One
authority is describing its geography at several levels at once. **This is the
gap.**

## Proposed

A third completeness, beside RESOLVED and UNKNOWN:

```ts
/**
 * Several of one authority's own zones cover this point, and the authority
 * publishes them that way on purpose. Not a conflict: nobody disagrees.
 */
status: "NESTED";
zones: Array<{
  zoneId: string;
  officialName: string;
  /** Larger zones first; the innermost zone is last. */
  containedBy: string[];
}>;
/**
 * The smallest zone containing the point, stated outright. NEVER re-derived
 * from array position: position-as-meaning is how a renderer eventually shows
 * the wrong unit as the specific one, and an explicit field cannot be misread
 * where a documented convention can.
 */
innermostZoneId: string;
/** Which zone's rules govern, WHERE THE AUTHORITY SAYS SO. Absent otherwise. */
governing?: { zoneId: string; statedAs: string; citation: string };
```

Three rules make this honest rather than a second guess:

**Nesting is declared per layer, never detected.** A layer states that its
features may legitimately cover each other. Absent that declaration, several
features at one point remain what they are today: not a nesting, and not
silently promoted into one. A layer whose features overlap *unexpectedly* is
still a defect and must still read as one.

**NESTED requires a TOTAL order, and anything less is not NESTED.**
Containment is a PARTIAL order: three zones can each contain the point while
two of them merely overlap each other. NESTED describes a chain — every zone in
the set contains, or is contained by, every other — and `containedBy` as an
array only means anything under that condition. A set that is not fully
containment-ordered falls back to today's behaviour rather than being ranked
into a chain it does not form. Stated as a positive requirement because the
contract otherwise excludes it only by implication, and an implication is not a
check.

**Partial overlap in a nesting-declared layer is STILL a defect.** Declaring a
layer nesting-capable must not silently downgrade real geometry defects there:
two units of one layer that overlap without containing each other are as wrong
in Michigan as anywhere else. Otherwise the declaration becomes a way for
breakage to stop being reported — the sentinel class wearing a new hat.

**Containment is computed from the geometry, not from the codes.** Which zone
sits inside which is a spatial fact the service can answer. A unit's kind is
**never** inferred from its number: "4xx means multicounty" is a sentinel value
waiting to happen, and Michigan gives us no field that carries kind. If
containment cannot be established from geometry, the answer is not NESTED.

Canada demonstrated this against real data while measuring whether Canadian
layers nest: an envelope query returned 73 "containment pairs", and reporting
those as nesting would have been the wrong measurement — bounding-box
containment is necessary, not sufficient. `ST_Contains` settled it at zero.
Québec 02E/02EI, Ontario 46/53B and Manitoba 14/14A all look like nesting BY
NAME and are not by geometry.

**Precedence is a separate question from nesting, and its absence is recorded
as a finding rather than as a failure to find.** `governing` appears only when
an authority's own words say which of its units prevails — quoted, cited.

Michigan, read 2026-09-24, is the worked example and it settles the default on
evidence rather than on caution. Across 183 pages of the Wildlife Conservation
Order: `precedence` 0 hits, `supersede` 0, `most restrictive` 0, `shall govern`
0, `shall control` 0, `overlap` 0. The single "more restrictive … shall
prevail" concerns federal versus state migratory-bird permits, not geography.

What makes that conclusive rather than merely negative: **where the drafters
wanted mutual exclusion, they wrote it into the definitions.** §12.19b defines
its unit as named counties "except those lands defined in section 12.33a". So
the absence elsewhere is a drafting choice, not an omission — units 486, 487,
499 and 333 genuinely overlap the county units and nothing resolves them.

The rule therefore stands on evidence: evaluate every containing unit and
return CONFLICT. That matters because a rule justified only by caution is one a
later agent can decide to trade away.

Where no provision exists, `governing` is absent and the answer still stands:
*these three all apply, and here is how they nest*
is useful, and is the truth. An absent precedence rule is recorded as
**explicitly absent**, not as not-yet-found, so nobody re-reads the same order
hoping for a different result.

## How it reads, and what that requires of the answer

Reviewed by Hunt overhaul, 2026-09-23. The rendering lead with what is the
SAME, not what differs: three nested units are one place described at three
grains, read innermost-first as a single line —

> You are in the CWD Core Area, inside Deer Management Unit 333, inside the
> multicounty unit.

— with the names as evidence, not as options to choose between.

The split that stops nesting reading as a defect: **the location reads certain;
the disagreement surfaces where it belongs.** Where no `governing` exists the
geography is NOT hedged — "all three apply" is a complete statement about where
someone is standing. What is unsettled is which RULE wins, and that belongs to
the regulatory line, as the engine's existing CONFLICT naming the units that
disagree.

So NESTED must carry enough to write that sentence without the renderer
inferring anything: every zone's official name, the containment order, and the
innermost zone stated outright.

## What each caller does with it

- **Zone card / Hunt result** — names every applicable zone, innermost first,
  and says they nest rather than that they conflict. No status word changes:
  NESTED is about geography, not legality.
- **Regulatory engine** — evaluates against every zone in the set and
  composes. **This is NOT the federal/provincial conjunction, and the federal
  composition path must not be reused for it.** Federal and provincial rules
  are two authorities with separate powers, both binding, neither refining the
  other: a hunter satisfies both. Nested units are ONE authority speaking at
  two granularities, whose ordinary legal reading is SPECIALIZATION — the inner
  refines the outer, and the specific governs. Encoding specialization as
  conjunction would MANUFACTURE conflicts the law does not intend: a CWD core
  zone permitting something the surrounding county unit restricts is not a
  contradiction, it is the entire point of having a core zone.

  That is what `governing` records, where the authority says so — and it is why
  its ABSENCE yields CONFLICT rather than a silent choice. Where the rules
  disagree and no `governing` is stated, the disagreement surfaces as the
  engine's existing CONFLICT: a real one, about rules, no longer hidden behind
  a geographic UNKNOWN. North Ground does not resolve a specialization the
  authority has not written down.
- **Map** — highlights the innermost zone; the containing zones stay visible.
- **Hunt Brief** — stores every zone id. A brief naming one of three units is
  not a record of where someone was.

## What this does not change

`conflictingZoneIds` keeps its meaning exactly: genuine disagreement. Nothing
moves into it, and nothing already in it moves out. A UI reading that field as
"conflict" stays correct, which is the point — today, nesting rendering through
it would read as a defect.

## The governing geography may not be in the layer at all

*Added 2026-09-23, from Michigan.*

Michigan sets universal antlerless licence use limits "by DMU in the Upper
Peninsula and by county in the Lower Peninsula". The governing geography is not
the same KIND of thing in the two halves of one state, and in the Lower
Peninsula it is **not the DMU layer** — it is counties, which North Ground does
not draw as hunting geography at all.

This contract does not cover that, and should not pretend to. NESTED describes
several zones OF ONE LAYER covering a point. A rule whose geography is a county
while the hunting layer is a DMU is a different problem, and it needs its own
answer rather than being forced into containment because containment is the
mechanism that exists.

It is not the federal/provincial conjunction either, and should not borrow that
path any more than nesting should: Michigan's county-based antlerless limit and
its DMU rules come from ONE authority using two geographies, not from two
authorities with separate powers. Three different relations, then — conjunction
between authorities, specialization within a nested layer, and this, which is
so far unnamed. Naming it is out of scope here; mistaking it for either of the
others is what this paragraph exists to prevent.

**The worked example, confirmed from the Order itself 2026-09-24.** Michigan's
own table is keyed two ways: the Upper Peninsula column is headed "Deer
Management Unit" and the Lower Peninsula column is headed "County". The Order's
words are "each deer management unit in the Upper Peninsula and each county in
the Lower Peninsula".

Fifteen Lower Peninsula DMUs — 161, 162, 261, 262, 311, 312, 332, 341, 354,
359, 361, 452, 486, 487 and 499 — are not coterminous with counties. So a
county-keyed limit **cannot be resolved by DMU lookup at all**. This is not a
presentation problem and not a nesting problem: it is a rule whose geography
North Ground does not hold.

The consequence is plain and is not deferred: **Michigan's Lower Peninsula
cannot be answered until county geography exists**, with its own licence
reviewed to the same standard as any hunting-unit layer. A state GIS office's
county layer is not automatically reusable, and a rule's geography being
"just counties" does not make it free.

What stays deferred is the MECHANISM — how the model expresses a rule whose
geography is a different layer from the one the hunt resolves in. That is
composition across layers, it is neither conjunction nor specialization, and it
needs its own answer rather than being forced into containment because
containment is the mechanism that exists.

It is recorded here because it is also the strongest evidence for the rule
above: precedence is never inferable from unit numbers, because the governing
unit may not be a unit.

## Open questions

1. **Answered 2026-09-23 — NO Canadian layer nests within itself**, measured
   against the database rather than recalled: 73 bounding-box candidates across
   all certified Canadian layers, **zero** true containments, maximum overlap
   0.206% — boundary slivers, not nesting. Canadian overlap is only ever
   species-scoped or cross-authority.
2. **Answered 2026-09-23 — SEPARATE STATUS.** Not by analogy but by
   measurement: `HuntApp.tsx:383` and `:524` both read `payload.status ===
   "RESOLVED"` and take `payload.zone` — singular — as THE zone, which becomes
   the highlighted polygon, the pin's zone, the card's subject, the URL's
   `zone=` and the Hunt Brief's zone id. Under RESOLVED-with-`alsoApplies[]`
   neither site changes behaviour and neither fails: a hunter at the Lansing
   capitol would be shown ONE Michigan unit, confidently, and would share a
   link naming only that unit. A quietly narrowed truth that looks exactly like
   a correct answer. A separate status makes both fall through to the
   unresolved path instead — wrong but loud, and only until the NESTED branch
   is written.
3. **Answered 2026-09-23 — nothing.** `conflictingZoneIds` appears in three
   places, all server-side (`types.ts:43`, `zone.ts:568`, `zone.ts:693`).
   Components see `status` and `message` only, so no UI branches on it and
   there is no existing "conflict" rendering that nesting could be mistaken
   for. A NESTED answer renders today as the plain unresolved sentence.

## Why this is not being built yet

Michigan is the only known instance, and what its Wildlife Conservation Order
actually says is still being read. The shape should follow the law rather than
precede it. Agreeing the shape now is what stops two agents building two
versions of it.
