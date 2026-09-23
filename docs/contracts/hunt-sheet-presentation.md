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
  two locales.

  Three layers, which must not be conflated (owner, 2026-09-23):

  1. **The invariant.** Every id the canonical zone summary returns MUST
     resolve through the presentation registry **without invoking its
     humanisation fallback**. An unresolved id is a failing invariant, enforced
     at build and test time.
  2. **The escape hatch**, for a violation that reaches production anyway:
     **fail the ROW, never the Hunt.** Every other species still renders. A
     structured error carries the id, the surface and the zone.
  3. **The loophole, closed:** `speciesName` in `zone-summary.ts` turns
     `species:foo-bar` into "Foo bar". **That is not resolution.** It invents a
     name for any id at all, so relying on it would make the invariant pass on
     everything.

  A hunter is never shown a raw id, a prettified slug, "Unknown species", or
  any other invented name. The hatch is not permission for unresolved ids to
  pass certification.

  *A narrower rule was argued for here — keep the row, say it cannot be named —
  and overruled. A missing row is a defect an engineer finds from the error; a
  row reading "Unknown species" is a defect a HUNTER reads, in a forest, with
  no way to tell how much else on the card was invented.*
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

## 4a. A boundary's standing and a zone's rules are two facts

They are said at their own scopes and neither is deleted to make the other
legible.

- **The per-species answer on the card** is the most specific true thing and
  outranks either summary. A species that the engine answers CLOSED for, with a
  source, is closed — whatever the zone's coverage says.
- **Rules coverage** comes from the layer's `rulesServing`. That is what the
  zone list means by "Certified rules".
- **The boundary's own standing** is `coverage` on the layer — whether the
  authority's map is parity-certified. It belongs to the boundary, and is never
  rendered as a claim about rules.

British Columbia made the confusion visible: its units answer CLOSED quoting
B.C. Reg. 190/84 while their geometry is still `IN_DEVELOPMENT`, so the zone
list called them "boundary only" beside a card answering from certified rules.
Both claims were true; one was being made at the wrong scope. The list now
reads `rulesServing`, and says *"Official boundary, rules not yet certified"*
where the rules genuinely are not — which is the boundary fact and the rules
fact, each said once, about itself.

Pinned by `zone-list-labels.test.ts`, which asserts the two flags are
independent and that the case exists.

## 4b. The selected zone's label outranks its own polygon

The map paints in this order, and it is render order at Google's own layer
rather than CSS fighting a canvas:

```
base map → ordinary fills → ordinary borders → ordinary labels
        → selected fill → selected border → SELECTED LABEL → self marker
```

Google draws polygons into `overlayLayer` (pane z-index 101). A label in that
pane is inside the polygon's stacking context, so the selected zone —
deliberately the loudest fill on the map — painted over the name of the zone it
was highlighting, worst at far zoom where the shape is small and the label sits
inside it. Ordinary labels stay in `overlayLayer`; the **selected** label is
appended to `markerLayer` (103). The self marker shares that pane and carries a
higher z-index, because a hunter's own position is the one thing a zone name may
never cover.

**No geometry changes to solve a render-order problem.** No nudged anchor, no
shrunken fill, no second polygon.

**And the selected label is EXEMPT from the leave-it-out rule.** §41A says one
label per zone, inside its largest part, and labels that do not fit are left out
rather than stacked — *that is for ORDINARY labels*. The selected one is named
wherever it is, at any zoom, however small its polygon. It is also `force`d
through collision (`labels.ts`), so a neighbour may yield but the selected name
is never suppressed.

Pinned by `selectedLabelOnTop` at three zooms. It asserts PANE ORDER, not hit
testing: map labels are pointer-transparent, so `elementFromPoint` never returns
one and a naive check would report "covered" whether it was or not — and mere
existence proves nothing, because a label painted under a polygon is still in
the DOM.

## 5. The sheet's resting states

`closed`, `peek`, `half`, `full` (`src/lib/hunt/exploration/sheet.ts`).

`closed` is a real dismissal: the card goes, the species goes with it, and the
map comes back. It is never REMEMBERED as a height — a device left closed
returns at `peek`, because coming back to a bare map reads as a failure to
restore rather than as a choice.

## 6. Precedence: a link means what it says

> **explicit URL state > the current explicit action > remembered session state > defaults**
>
> **SAME HUNT LINK → SAME INITIAL ANSWER.**

An explicit link is restored onto **not at all** — not the place, not the
species, not the date, not the camera, not the sheet's height, not a layer,
**however compatible any of it looks** (owner, 2026-09-23). Compatibility is
exactly the justification that lets an exception grow: a remembered place inside
the link's own zone is compatible, a camera near it is compatible, a date inside
the season is compatible, and one by one they make a link mean something
different for each person who opens it.

A URL naming any hunt dimension — zone, species, date, explore — is explicit. A
bare `/hunt` names nothing, is not a link to anywhere, and is restored in full;
that is what remembering is for. Recent places survive either way: they live
inside the composer, are never shown until the field is opened, and are neither
the answer nor the view.

Nothing is lost that a hunter cannot reach. Once they search, use their
location, choose a point or choose a species, that explicit action specialises
the Hunt normally. What is forbidden is arriving there without having asked.

And coordinates stay out of shared URLs until a location-sharing feature is
deliberately designed.

The defect this prevents: a link naming a zone and a date came back from restore
carrying a species the device happened to remember, and the URL-sync effect then
wrote that species into the address bar. **A link that gains a species is a link
that no longer means what it said** — the person it was sent to gets someone
else's animal.

Pinned by two scenarios, because they prove different things.
`twoDevicesOneLink` seeds **two genuinely different histories** — one hunter
last in Ontario after deer, one last in Québec after grouse at a remembered spot
— opens the same link on both, and proves they converge on the same rows, the
same camera, no species and no place. A seeded-versus-clean pair would pass
while the real case failed. And `urlBeatsMemory` in `scripts/certify-hunt-app.mjs`, which walks the
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
