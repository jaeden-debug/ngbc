# Contract — Test craft

**Status:** written 2026-09-23, from four rules each earned by a specific
failure on this project.
**Scope:** how a check is built, so that it checks rather than agrees.

> These began in `docs/contracts/relative-season-dates.md` because the first of
> them was written there. They are general and have nothing to do with seasons.
> Moved here when there were four.

Every rule below is recorded with **the failure it prevents**, because a bare
list is easy to trim and a list of failures cannot be trimmed without first
arguing that the failure is acceptable.

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

---

## Verify the output you did not predict

*Added 2026-09-23.*

Checking only the results that match your model tests **the model**, not the
code. Both outcomes are bad and neither announces itself: a correct answer you
did not expect gets reported as a bug, and a wrong answer you did expect gets
shipped.

British Columbia's next-opening work produced several species sharing one
September 1–9 window. It looked exactly like the leak I was hunting — a season
borrowed from another Management Unit. It was a real MU 2-8 rule, geography
"2-2 to 2-19", one of two the bundle holds there. Had I verified only the rows
that looked right, I would have shipped believing a correct answer was a defect,
or the reverse.

So: **before believing an output, check the row you cannot explain.** And check
the dangerous property directly rather than inferring it from the rows that
happened to look sensible — in that case, that a species with no rule in a unit
never names a date, proved across the 195 units where sharp-tailed grouse has
none.

This is the sibling of "do not share the subject's blind spot" one level up:
that rule is about how a check is built, this one is about which outputs you
bother to check at all.

## Measure the expander that actually runs

*Added 2026-09-23, from getting this wrong while hunting exactly this class.*

A sweep checked which test files the `test:*` scripts reach, by expanding each
script's globs and comparing. It reported `limitation-groups.test.ts` as
unreached by anything. **It runs, and it passes, six subtests at a time.**

The script is `node --test src/components/**/*.test.ts`. npm runs scripts
through `sh`, which has no globstar, so `**` is passed through **literally** —
`sh -c 'set -- src/components/**/*.test.ts; echo $#'` prints `1`, the unexpanded
pattern. **Node 22's `--test` then does its own glob expansion, which does
support `**`.** The files run, via Node, not via the shell.

So the sweep was correct arithmetic over the wrong expander. **Ask which
component actually resolves the thing you are measuring** — here, three
candidates disagree: the shell that launches the script, the runner that
receives the argument, and the developer's interactive shell (zsh expands it,
which is why it looks fine by hand).

**Verify by what was LOADED, not by what a pattern expands to.** `node --test`
names each file it ran; that list is the measurement. Applied to this
repository, every test file is reached — one orphan was real
(`validate-canada-source-reconnaissance.test.mjs`, now in
`test:regulatory-sources`) and one was an artefact of the wrong expander.

**And the arrangement is fragile although it works:** it depends on the runner's
glob support, and the same script under a different runner or an older Node
would silently drop those files. A green count would not change — the files
would simply stop being in it.

## An asymmetry is justified by its failure directions

*Added 2026-09-23.*

A margin, tolerance or rounding rule is justified by **which way it is wrong**,
so it does not travel to a fact whose failure directions differ.

- **Legal hunting time** — the solar margin is applied INWARD, narrowing the
  window, because a hunter who waits two extra minutes breaks no law.
- **A season** — two-ended, with no safe direction. Narrowing it tells a hunter
  a season is closed when it is open.

The dangerous shape is not carelessness: it is a **correct habit carried across
a boundary where its justification does not hold**, and it passes review
because the habit is genuinely right where it came from.

The test before transferring one: **name both failure directions in the new
context and check they are still unequal in the same way.** If they are not, the
margin is not conservative there — it is wrong in a direction nobody is
watching.

## The gate is proportionate to what the change can break

*Added 2026-09-23.*

- **Documentation only** — nothing under `src`, `scripts`, `content`,
  `fixtures`, and no bundle: verify the **tree is clean** and the commit
  **touches exactly the intended paths and nothing else**. Do not run the suite.
- **Anything touching code, scripts, content, fixtures or a bundle**: the full
  suite and the build, no exceptions, plus whatever certification that area has.

**Always say which you ran.** The failure this guards against is not a skipped
suite — it is a skipped suite that goes unmentioned.

Running 1296 tests against a nine-line Markdown addition proves nothing about
the change; it *performs* the gate instead of using it. The two checks that ARE
about a documentation change — clean tree, exact paths — catch the real risks at
that size: a stray file, or another session's uncommitted work swept into the
commit. Neither is hypothetical; a path-scoped sync has dropped files in this
repository before.

The rule generalises: **a check earns its place by what it would catch, not by
what it costs.** A gate that runs everywhere regardless becomes a ritual, and a
ritual is skipped quietly rather than deliberately.
