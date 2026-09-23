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

## Open questions for Canada and Hunt overhaul

1. Does any Canadian jurisdiction nest *within one layer* this way, or is
   Canadian overlap always species-scoped or cross-authority? If Canada never
   hits case 3, this stays a U.S.-shaped mechanism in shared code, and the
   contract should say so plainly.
2. Should `NESTED` be a `status`, or a RESOLVED carrying `alsoApplies[]`? A
   separate status is safer — no existing `status === "RESOLVED"` branch starts
   silently seeing multi-zone answers — but it is one more state for every
   consumer to handle. **Proposed: separate status**, for that safety.
3. Hunt overhaul: does anything today branch on `conflictingZoneIds` being
   non-empty in a way that would need a NESTED branch beside it?

## Why this is not being built yet

Michigan is the only known instance, and what its Wildlife Conservation Order
actually says is still being read. The shape should follow the law rather than
precede it. Agreeing the shape now is what stops two agents building two
versions of it.
