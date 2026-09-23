# Contract — Several Zones At One Point

**Status:** proposed 2026-09-23 by the United States agent, for the Canada agent
(Newfoundland, Québec/Labrador) and Hunt overhaul (`src/components/hunt/*`).
**Scope:** what the zone resolver returns when more than one zone covers a
point, and how those answers are told apart.
**Not in scope:** which zone's rules govern (that is precedence, below), any
jurisdiction's actual geography, styling, or regulatory evaluation.

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

**Containment is computed from the geometry, not from the codes.** Which zone
sits inside which is a spatial fact the service can answer. A unit's kind is
**never** inferred from its number: "4xx means multicounty" is a sentinel value
waiting to happen, and Michigan gives us no field that carries kind. If
containment cannot be established from geometry, the answer is not NESTED.

**Precedence is a separate question from nesting, and its absence is recorded.**
`governing` appears only when an authority's own words say which of its units
prevails — quoted, cited. Where no such provision exists, `governing` is absent
and the answer still stands: *these three all apply, and here is how they nest*
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
- **Regulatory engine** — evaluates against every zone in the set and composes,
  exactly as federal and provincial layers already compose. Where the rules
  disagree and no `governing` is stated, that disagreement surfaces as the
  engine's existing CONFLICT — which is then a real one, about rules, and no
  longer hidden behind a geographic UNKNOWN.
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
while the hunting layer is a DMU is a different problem — composition across
layers, as federal and provincial rules already compose — and it needs its own
answer rather than being forced into containment because containment is the
mechanism that exists.

It is recorded here because it is the strongest evidence for the rule above:
precedence is never inferable from unit numbers, because the governing unit may
not be a unit.

## Open questions

1. **Open, with Canada.** Does any Canadian jurisdiction nest *within one
   layer* this way, or is Canadian overlap always species-scoped or
   cross-authority? If Canada never hits case 3, this stays a U.S.-shaped
   mechanism in shared code, and the contract should say so plainly.
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
