# Contract — Test craft

**Status:** written 2026-09-23, from rules each earned by a specific failure
on this project, under one parent rule they are all cases of.
**Scope:** how a check is built, so that it checks rather than agrees.

> These began in `docs/contracts/relative-season-dates.md` because the first of
> them was written there. They are general and have nothing to do with seasons.
> Moved here when there were four.

Every rule below is recorded with **the failure it prevents**, because a bare
list is easy to trim and a list of failures cannot be trimmed without first
arguing that the failure is acceptable.

---

## The parent rule: a check must be decided by the property it names

*Added 2026-09-23 by Hunt overhaul, as the family the rules below belong to.*

Every failure in this document is one case of a single fault: **a check whose
result is determined by something other than the property it names.** It runs,
it reports, and what it reports is about something else. Three ways it shows up,
and the middle one is the most dangerous:

- **It can only pass.** A hard-coded example that expired; four assertions that
  were never in the suite's glob at all and were counted in green reports for a
  day. Dead weight — it protects nothing and nobody notices.
- **It can only fail.** A visibility check on a map label, written as
  `elementFromPoint` over the label's centre. Map labels are `pointer-events:
  none`, so that call *never* returns one — the check reported "covered"
  whether the label was covered or not. **Worse than dead weight, because it
  recruits someone into changing working code to satisfy it.**
- **It measures the wrong subject.** A geometry floor read 253 where the value
  was 1425: the number was real and the thing it was a number *about* was a
  half-loaded map. A viewport comparison that could never see the bug it was
  aimed at, because on a desktop emulator the two viewports it compared are
  always equal. Two z-index walkers that returned confident values for the
  wrong elements.

The question that catches all three, before writing the assertion: **what,
other than the property I am naming, could decide this result?** A timing
window, a pointer-events rule, an emulator's equality, a glob — each of those
has produced a green or red that was about itself.

And the move when a derived number disagrees with your model: **print the raw
structure, not a second derived number.** Two derivations can share an
assumption. The ancestor chain, printed once, settled in a single run what two
z-index walkers had each got confidently wrong.

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

---

## A file is not a document

*Added 2026-09-23, after the third instance in one day.*

**Verify that a retrieved artefact IS what was asked for before believing
anything about its contents.** A fetch that returns bytes has not necessarily
returned the document, and the filename is the one piece of evidence that came
from us rather than from the server.

Three instances, all on the same day, all in source ingestion:

- **Cached 404 pages at summary cache paths.** The files existed, were the
  right size for prose, and sat exactly where the summaries belonged. Read as
  summaries they reported British Columbia 0/6 and Ontario 0/5 — a certification
  failure that was really a retrieval failure. Fixed by `assertIsASummary()`,
  and by never caching a non-200.
- **919 bytes of HTML written to `annexe-iii.pdf`.** legisquebec returns 403 to
  curl's default agent and serves the file to a browser agent. `curl -o` wrote
  the refusal body under the name we chose. `file` caught it in one command:
  `PDF document` versus `HTML document text`.
- **A cached file standing in for a cached document**, which is why
  `assertIsASummary()` exists at all.

The shape is always the same: **the transport succeeded and the retrieval
failed**, so every downstream check runs happily against the wrong bytes. It is
particularly dangerous in ingestion because the next step is usually a parser,
and a parser that finds nothing reports *the source does not contain this* —
which is a claim about the authority, not about our plumbing. That is how a
retrieval failure becomes a false finding about a government's own data.

The check is cheap and belongs at the boundary, before any parse:

- Assert the **content type or magic bytes** match what was requested
  (`file`, a leading `%PDF-`, a JSON parse, an expected root element).
- Assert a **document-specific invariant** — a title, a known heading, a
  section number the document must contain. Size alone proves nothing: a 404
  page and a summary are both a few kilobytes of HTML.
- **Never cache a non-200**, and never let the cache path imply the contents.

**Never infer the contents from the extension, the path or the byte count** —
all three were chosen by us, and none of them was sent by the server.
