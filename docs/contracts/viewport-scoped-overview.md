# Contract — Viewport-Scoped Overview

**Status:** proposed 2026-09-23 by the Canada agent, for Hunt overhaul (owns
`src/components/hunt/*`) and the United States agent (adds served layers).
**Scope:** how much geography Hunt asks for, and where its map opens.
**Not in scope:** what is drawn, how it is styled, or any regulatory behaviour.

---

## The problem

One constant does three unrelated jobs.

`SERVED_EXTENT` (`src/lib/hunt/exploration/overview.ts`) is the union of every
serving layer's bounds. Today it is used as:

1. **the coverage test** — is this point or box inside anything North Ground
   serves (`/api/hunt/zone` rejects outside it);
2. **the overview request** — `OVERVIEW_URL` asks for the whole union;
3. **the opening camera** — `HuntApp.tsx` passes `startBox={geometry.extent}`,
   and `zones-poster.ts` draws the server-side poster from the same box.

Only the first is what a union of bounds means. The other two are a camera, and
a camera derived from coverage moves every time coverage grows.

### Measured, 2026-09-23

Server-side, against the live registry and authorities:

| Box | Features | Bytes | Median |
| --- | ---: | ---: | ---: |
| `SERVED_EXTENT` (88.6° × 28.3°) — what the map asks for on open | 658 | 349.3 KB | 218 ms |
| Prairies | 247 | 104.2 KB | 22 ms |
| Southern Ontario / Québec corridor | 105 | 39.6 KB | 8 ms |
| Maritimes | 47 | — | — |

The opening request is roughly **9× the bytes and 27× the time** of the view a
hunter is actually looking at. `SERVED_EXTENT` already spans Yukon to Idaho;
every state the U.S. agent adds widens it further, and each one silently zooms
out the opening view for hunters in Canada who will never look at it.

This is the payload rule already established for zone drawings: **zone count
costs, not vertex count.** Level-1 simplification flattens geometry, so the
only lever that matters is how many zones are in the answer, which is exactly
what the box decides.

---

## The contract

### 1. Three names, never one constant

| Name | Meaning | Derived from |
| --- | --- | --- |
| `SERVED_EXTENT` | Where North Ground serves anything. Answers "is this inside coverage?" | Union of serving layers' bounds. **Unchanged.** |
| `OPENING_CAMERA` | Where the map opens before anyone acts. | **Declared, not derived.** |
| request box | What geometry is actually asked for. | The current viewport, clamped to `SERVED_EXTENT`. |

**`SERVED_EXTENT` is not widened and not narrowed by this change.** Its meaning
is correct; only its misuse as a camera is removed. Narrowing it would shrink
coverage, which is a regulatory claim, not a performance decision.

### 2. The opening camera is declared

`OPENING_CAMERA` is a written-down view, changed deliberately and never as a
side effect of serving a new jurisdiction.

> **Adding a jurisdiction must not move any other hunter's opening view.**

This is the load-bearing clause for the U.S. agent. Serving Florida widens
`SERVED_EXTENT` (correct — Florida is now covered) and must leave
`OPENING_CAMERA` exactly where it was. Moving it is a product decision for the
owner, not a consequence of an ingest.

### 3. The overview request is the opening camera, not the union

`OVERVIEW_URL` asks for `OPENING_CAMERA`, not `SERVED_EXTENT`. Subsequent
requests ask for the viewport as it moves, which the geometry store already
does (`requestBoxFor(view.box, level, SERVED_EXTENT)` — note it already clamps
to `SERVED_EXTENT`, which remains correct and unchanged).

### 4. The poster follows the camera

Blueprint §41A requires the server-drawn poster to be "the live map's exact
projection and opening camera". `POSTER_BOX` therefore becomes `OPENING_CAMERA`
and must remain identical to whatever the live map opens at, or the poster will
not be replaced in place. If the two can ever disagree, they must come from one
exported value, not two.

### 5. Honesty invariants that must survive

These are the ones a viewport change is most likely to break, and none of them
is negotiable for performance:

- **"No zones here" and "we didn't ask" stay distinguishable.** A layer that
  intersects the request box and cannot be read reports its status; it is never
  silently omitted. This is why `ZoneGeometryResult.layers[]` carries a
  per-layer status, and it must keep doing so per request box.
- **A partly drawn jurisdiction is refused, not shown.** The stored query
  already throws when it reaches its safety limit, because a partly drawn
  jurisdiction is a silent lie about where its boundaries are. Viewport scoping
  must not turn "truncated" into "that's all there is in view".
- **Coverage is still judged against `SERVED_EXTENT`.** A point outside the
  opening camera but inside coverage is served normally. The camera is a view,
  never an answer about what is covered.
- **A flag that was true by construction must be re-derived.** The geometry
  store marks every level-0 piece `whole`, and that is correct today only
  because level 0 **was** the whole served extent — the flag is true by
  construction, not by evidence. Once level 0 is a viewport, a piece can be
  clipped, and a clipped drawing treated as a zone's full extent means the
  camera can frame a zone by a boundary that is only the edge of a request box:
  **a map asserting a boundary it was never given, looking entirely normal on
  screen.** `whole` must be computed from containment, with a store test. This
  is the invariant most likely to bite, precisely because nothing about it
  looks wrong.

  The general form, which applies to anything else the new request shape
  touches: **when a request's shape changes, every value that was true because
  of the old shape is suspect. "True by construction" is not a property; it is
  a coincidence of the old design.**
- **Every serving layer must still draw.** `npm run certify:served-layers`
  asks each layer in its own bounds, which is independent of the camera; it
  must stay that way, so shrinking the opening view can never make a broken
  layer look fine.

### 6. Out of scope

Vector tiles. The blueprint permits adopting them "when measurements show
GeoJSON no longer meets the budget". Viewport scoping is the cheaper fix and
should be measured first; if a realistic viewport still exceeds budget after
this, that is the evidence for tiles.

---

## Acceptance

1. `OPENING_CAMERA` exists as a declared value, and `SERVED_EXTENT` is
   byte-identical to today.
2. A test asserts adding a serving layer outside the opening camera changes
   `SERVED_EXTENT` and does **not** change `OPENING_CAMERA`.
3. The opening overview request's measured features/bytes/time are reported
   against the 658 / 349.3 KB / 218 ms baseline above.
4. The poster and the live map open at the same box, from one exported value.
5. `certify:served-layers` still passes 14/14.
6. A point inside coverage but outside the opening camera still resolves.
7. `whole` is derived from containment, not from the level, and a store test
   covers a clipped piece.

---

## Amendments

**2026-09-23 — `whole` is true by construction (§5, fifth invariant).** Raised
by Hunt overhaul while planning the implementation, added here so the
requirement lives in the contract rather than only in their code. They own the
implementation.
