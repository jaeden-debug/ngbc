# Contract — Hunt's sheet: what it shows, and what it may never say

**Status:** landed 2026-09-23 by Hunt overhaul (`src/components/hunt/*`).
**Scope:** the consumer half of the zone summary — how the eight engine states
become what a hunter reads, the sheet's resting states, and the precedence
between a link, an action and what the device remembers.
**Not in scope:** what is true. That is the regulatory engine's
(`docs/contracts/zone-summary.md`), and nothing here may widen or narrow it.

This exists because two "contracts" were once agreed in conversation and never
written down. An agent went looking for one, found nothing, and was right to
refuse it. What follows is in the repository so the next agent reads the landed
architecture instead of reconstructing it.

---

## 1. Eight states in, as many words out as the surface needs

The engine keeps eight states and must keep them:
`SEASON_AVAILABLE`, `SEASON_EXCEPT_AREAS`, `CHECK_REQUIREMENTS`, `CLOSED`,
`NEEDS_VERIFICATION`, `CONFLICT`, `UNKNOWN`, `NOT_CERTIFIED`.

`src/lib/hunt/exploration/states.ts` already gives each one a label, a glyph and
a detail sentence in §41A's own words. **The renderer maps; it never collapses.**
Simplifying what a hunter sees is presentation. Collapsing the states behind it
would destroy three distinctions the programme exists to defend:

- `CONFLICT` is two authorities disagreeing, not an absence.
- `NOT_CERTIFIED` is a fact about North Ground; `UNKNOWN` is a fact about the
  rules. They are different sentences to a hunter and different work to fix.
- `SEASON_EXCEPT_AREAS` is a season that does not run everywhere inside the
  zone. Flattening it into "in season" claims a season inside a refuge.

A state is always a WORD and a glyph, never a colour alone (§40, §48).

## 2. Status and "what happens next" are two facts, never one word

A species may be `CLOSED` today and carry an upcoming season. Those are the same
legal status and different answers to a hunter, so both are rendered and neither
is merged into the other. **There is no `NOT_OPEN_BUT_UPCOMING`** in the
presentation layer: inventing one would recreate, one level down, exactly the
collapse the engine refuses.

A row shows a next opening only where the engine carries one. Where it does not,
the row says nothing about the future — "closed today" and "closed until further
notice" must never share a representation.

## 3. What the renderer owns, and what it must not accept

**Owned here:** grouping, ordering, which states share a colour, what the card
shows versus the drill-down, and every word of presentation.

**Never accepted from the engine:**

- **Counts.** They are derived from the rows that are drawn, so a count can
  never disagree with the list beside it.
- **Names.** Every `speciesId` resolves through the canonical presentation path.
  A server-supplied name would be a second naming system the moment there are
  two locales. **There is no fallback**: an id that does not resolve is a defect
  that fails loudly and is reported, never rendered around with a placeholder.
- **A criticality flag.** What is loud is presentation; what is true is the
  engine. One judgement in two lanes is one judgement that can disagree with
  itself.

## 4. What sits beside the status, and what may be collapsed

A limitation carries its own scope from its author (`src/lib/hunt/limitation.ts`)
and is rendered by `groupLimitations`:

- `CRITICAL` and `CONTEXTUAL` sit beside the status and are **never** placed
  behind a disclosure. A hunter who misses one can be stopped, fined or hurt.
- `GENERAL` collapses into one said-once section.
- `SOURCE_DETAIL` moves into Sources, quoted, attributed and `lang`-tagged —
  never translated (§47).

The rule for anything new: *could a hunter who ignored this break the law, be
unsafe, or be turned away — today, here?* If yes it is not a disclosure.

## 5. The sheet's resting states

`closed`, `peek`, `half`, `full` (`src/lib/hunt/exploration/sheet.ts`).

`closed` is a real dismissal: the card goes, the species goes with it, and the
map comes back. It is never REMEMBERED as a height — a device left closed
returns at `peek`, because coming back to a bare map reads as a failure to
restore rather than as a choice.

## 6. Precedence: a link means what it says

> **explicit URL state > the current explicit action > remembered session state > defaults**

Memory may hydrate state that is genuinely missing. It may **never** augment an
explicit link in a way that changes what the link says. A URL naming any hunt
dimension — zone, species, date, explore — is explicit, and no other dimension
is filled from memory; a bare `/hunt` names nothing and is restored in full.

The defect this prevents: a link naming a zone and a date came back from restore
carrying a species the device happened to remember, and the URL-sync effect then
wrote that species into the address bar. **A link that gains a species is a link
that no longer means what it said** — the person it was sent to gets someone
else's animal.

The stored PLACE is the one exception, and it is not an exception to the rule
above: it is kept only inside the link's own zone, it sharpens a zone answer
into a point answer without changing which zone the link is about, and no
coordinate ever reaches a URL — so the link a person shares still says exactly
what they shared.

Pinned by `urlBeatsMemory` in `scripts/certify-hunt-app.mjs`, which walks the
sequence the owner asked for: establish an Ontario hunt with a species and a
camera, navigate in the same tab to an explicit Québec zone-and-date link with no
species, and prove that Québec wins, that the camera frames it in **both** axes,
that the old camera does not survive, that no species is inserted, and that a
reload is stable.

## 7. Two tests worth keeping the shape of

- **Assert the capability, not the control.** A test that asserts "the dropdown
  shows ruffed grouse" dies with the dropdown and takes its coverage with it. A
  test that asserts "a link naming a species is answered for" survives the
  redesign — and caught a real defect the day the dropdown was removed.
- **Reforming an assertion needs a premise that moved in the WORLD**, stated
  independently of the failure. If the only evidence a premise changed is that
  the test is failing, it has not changed. A threshold lowered to match a number
  nobody understood leaves a green test measuring nothing.
